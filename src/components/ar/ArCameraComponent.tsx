// src/components/ar/ArCameraComponent.tsx - Reformed to use only shared positioning system
import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { usePermissions } from '../../context/PermissionsContext';
import { PermissionType } from '../../utils/permissions';
import { useDeviceOrientation } from '../../hooks/useDeviceOrientation';
import { useGeofenceContext } from '../../context/GeofenceContext';
import { useARPositioning } from '../../hooks/useARPositioning';
import { ARRenderingEngine } from '../engines/ARRenderingEngine';
import { useARInteractions } from '../../hooks/useARInteractions';
import { debugModeManager } from '../../utils/DebugModeManager';
import ReformedModelPositioningPanel from '../debug/ModelPositioningPanel';
import ArrowLeftIcon from '@mui/icons-material/ArrowLeft';
import ArrowRightIcon from '@mui/icons-material/ArrowRight';
import TurnLeftIcon from '@mui/icons-material/TurnLeft';
import TurnRightIcon from '@mui/icons-material/TurnRight';
import { worldSystem } from '../../utils/coordinate-system/PositioningSystemSingleton';

const SHOW_DEBUG_PANEL = true;

interface ArCameraProps {
  // Core positioning (simplified)
  userPosition?: [number, number]; // Frozen position from ExperienceManager
  experienceType?: string;
  
  // Camera and scene callbacks
  onArObjectPlaced?: (position: THREE.Vector3) => void;
  onOrientationUpdate?: (orientation: { alpha: number; beta: number; gamma: number }) => void;
  onSceneReady?: (scene: THREE.Scene, camera: THREE.PerspectiveCamera) => void; 
  
  // Gesture callbacks (passed through to experiences)
  onModelRotate?: (deltaX: number, deltaY: number, deltaZ?: number) => void;
  onModelScale?: (scaleFactor: number) => void;
  onModelReset?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;

  isUniversalMode?: boolean
  
  // System callbacks
  onElevationChanged?: () => void;
  
  // Shared positioning system
  sharedARPositioning?: any; // Add proper type definition here based on your ARPositioning hook return type
  
  // Legacy props (deprecated, will be removed)
  anchorPosition?: [number, number]; // Used only for debug display
  anchorElevation?: number; // Deprecated
  coordinateScale?: number; // Deprecated
  
  children?: React.ReactNode;
}

const ArCameraComponent: React.FC<ArCameraProps> = ({
  userPosition: frozenUserPosition, // This is the frozen position from ExperienceManager
  experienceType = 'default',
  onArObjectPlaced,
  onOrientationUpdate,
  onSceneReady,
  onModelRotate,
  onModelScale,
  onModelReset,
  onSwipeUp,
  onSwipeDown,
  onElevationChanged,
  sharedARPositioning,
  anchorPosition, // Legacy - only for debug
  isUniversalMode = false,
  children
  
}) => {
  
  // Get live GPS context for comparison/debugging
  const {
    userPosition: rawUserPosition,
    averagedPosition: preciseUserPosition,
    currentAccuracy,
    positionQuality,
    isPositionStable
  } = useGeofenceContext();

  //********** REFS **********
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const renderingEngineRef = useRef<ARRenderingEngine | null>(null);
  const lastCameraUpdateRef = useRef(0);
  const cameraUpdateIntervalRef = useRef<number | null>(null);
  const cameraDirectionVector = useRef(new THREE.Vector3());

  //******** STATE **********
  const [isInitialized, setIsInitialized] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [debugHeading, setDebugHeading] = useState<number | null>(null);
  const [debugCollapsed, setDebugCollapsed] = useState(true);
  const [isBottomDebugCollapsed, setIsBottomDebugCollapsed] = useState(true);
  const [arTestingOverride, setArTestingOverride] = useState(false);
  const [debugFrozenModelPosition, setDebugFrozenModelPosition] = useState<THREE.Vector3 | null>(null);
  const [cameraLookDirection, setCameraLookDirection] = useState<{
    vector: THREE.Vector3 | null;
    bearing: number | null;
    expectedModelPosition: THREE.Vector3 | null;
    aimError: number | null;
    modelDistance: number | null;
  }>({
    vector: null,
    bearing: null,
    expectedModelPosition: null,
    aimError: null,
    modelDistance: null
  });

  const [manualScaleOffset, setManualScaleOffset] = useState(1.0);
  const [initStatus, setInitStatus] = useState<string>('Starting...');



  //******** DEBUG PANEL FUNCTIONS **********
  const handleDebugSwipeUp = useCallback(() => {
    setIsBottomDebugCollapsed(false);
    console.log('🔼 Debug panel expanded');
  }, []);

  const handleDebugSwipeDown = useCallback(() => {
    setIsBottomDebugCollapsed(true);
    console.log('🔽 Debug panel collapsed');
  }, []);

  const handleMLCorrectionToggle = useCallback((enabled: boolean) => {
  console.log(`🧠 ML Corrections ${enabled ? 'ENABLED' : 'DISABLED'}`);
  (window as any).mlAnchorCorrectionsEnabled = enabled;
  // You can add more ML integration logic here if needed
}, []);

  // Debug mode management
  useEffect(() => {
    debugModeManager.initialize();
    
    const handleDebugModeChange = (event: CustomEvent) => {
      setArTestingOverride(event.detail.enabled);
    };
    
    debugModeManager.addEventListener('debugModeChanged', handleDebugModeChange as EventListener);
    setArTestingOverride(debugModeManager.debugMode);
    
    return () => {
      debugModeManager.removeEventListener('debugModeChanged', handleDebugModeChange as EventListener);
    };
  }, []);

  const updateScaleOffset = useCallback((newScale: number) => {
  setManualScaleOffset(newScale);
  
  if (onModelScale) {
    onModelScale(newScale);
  }
}, [onModelScale]);


// Add to ArCameraComponent debug section
const createTestMarkers = useCallback(() => {
  if (!renderingEngineRef.current || !frozenUserPosition) return;
  
  const scene = renderingEngineRef.current.getScene();
  const [userLon, userLat] = frozenUserPosition;
  
  // Clear old markers
 if (scene && scene.children) {
  scene.children.filter(child => child.name?.startsWith('test-marker')).forEach(marker => {
    scene.remove(marker);
  });
}
  
  // Create test points around user
  const testDistance = 0.0005; // ~55 meters
  const testPoints = [
    { name: 'NORTH', gps: [userLon, userLat + testDistance], color: 0xff0000 },
    { name: 'SOUTH', gps: [userLon, userLat - testDistance], color: 0x00ff00 },
    { name: 'EAST', gps: [userLon + testDistance, userLat], color: 0x0000ff },
    { name: 'WEST', gps: [userLon - testDistance, userLat], color: 0xffff00 }
  ];
  
  testPoints.forEach(point => {
    // Convert GPS to world coordinates
    const worldPos = worldSystem.gpsToWorld(point.gps as [number, number], 2); // 2m high
    
    // Create visible marker
    const geometry = new THREE.SphereGeometry(0.5, 8, 6);
    const material = new THREE.MeshBasicMaterial({ color: point.color });
    const marker = new THREE.Mesh(geometry, material);
    
    marker.position.copy(worldPos);
    marker.name = `test-marker-${point.name}`;
    if (scene) {
      scene.add(marker);
    }
    
    console.log(`🎯 Test marker ${point.name}:`, {
      gps: point.gps,
      worldPos: worldPos.toArray(),
      bearing: Math.atan2(worldPos.x, -worldPos.z) * (180/Math.PI)
    });
  });
}, [frozenUserPosition]);

  //******* camera lookat Directions */
 const getTurnDirectionText = useCallback(() => {
  if (cameraLookDirection.aimError === null || !frozenUserPosition) {
    return 'No position available';
  }

  const aimError = cameraLookDirection.aimError;

  if (cameraLookDirection.aimError < 25) {
    return (
      <span>
        <ArrowRightIcon fontSize="small"  style={{ verticalAlign: 'middle', marginRight: '-10px', padding:'0px' }} />
        <ArrowRightIcon fontSize="small"  style={{ verticalAlign: 'middle', marginRight: '2rem' , padding:'0px'}} />
      
        {' ON TARGET '}
        <ArrowLeftIcon fontSize="small" style={{ verticalAlign: 'middle', marginRight: '-10px', marginLeft: '2rem' }}/>
        <ArrowLeftIcon fontSize="small" style={{ verticalAlign: 'middle', marginRight: '0px' }}/>
      </span>
    );
  }

  // Calculate turn direction (you'll need model bearing for this)
  const cameraBearing = cameraLookDirection.bearing || 0;
  // TODO: Calculate modelBearing from your positioning system
  const modelBearing = 0; // Replace with actual calculation
  const bearingDiff = ((modelBearing - cameraBearing + 540) % 360) - 180;
  const turnLeft = bearingDiff > 0;
  
  if (aimError < 40) {
    return `Close - aim error ${aimError.toFixed(1)}°`;
  } else if (aimError < 60) {
    return turnLeft ? (
      <span>
        <TurnLeftIcon fontSize="small" />
        {` TURN LEFT TO FIND MODEL (${aimError.toFixed(1)}°)`}
      </span>
    ) : (
      <span>
        {`TURN RIGHT TO FIND MODEL `}
        <TurnRightIcon fontSize="small" />
        {` (${aimError.toFixed(1)}°)`}
      </span>
    );
  } else {
    return turnLeft ? (
      <span>
        <TurnLeftIcon fontSize="small" />
        <TurnLeftIcon fontSize="small" />
        {` LOOK AROUND LEFT (${aimError.toFixed(1)}°)`}
      </span>
    ) : (
      <span>
        {`LOOK AROUND RIGHT `}
        <TurnRightIcon fontSize="small" />
        <TurnRightIcon fontSize="small" />
        {` (${aimError.toFixed(1)}°)`}
      </span>
    );
  }
}, [cameraLookDirection.aimError, cameraLookDirection.bearing, frozenUserPosition]);

  //******** HOOKS **********
  const { attachListeners, detachListeners, isListening } = useARInteractions({
    canvasRef,
    callbacks: {
      onModelRotate,
      onModelScale,
      onModelReset,
      onDebugSwipeUp: handleDebugSwipeUp,
      onDebugSwipeDown: handleDebugSwipeDown
    },
    enableDebugSwipes: true,
    debugMode: SHOW_DEBUG_PANEL
  });

  const { 
    heading: deviceHeading,
    deviceOrientation, 
    isAvailable: orientationAvailable,
    error: orientationError,
    getCameraQuaternion
  } = useDeviceOrientation({ 
    enableSmoothing: true,
    debugMode: SHOW_DEBUG_PANEL 
  });

  // Shared positioning system
  const positioningSystem = sharedARPositioning;
 if (!positioningSystem) {
  console.error('❌ ArCameraComponent: No shared AR positioning provided!');
  
  // Instead of returning null, show loading:
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      zIndex: 1000,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      color: 'white',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '18px'
    }}>
      🎯 Waiting for positioning system...
    </div>
  );
}

  const { 
    adjustGlobalElevation,
    positionObject,
    isReady: positioningSystemReady,
    debugMode: positioningDebugMode,
    getCurrentElevationOffset,
    resetAllAdjustments
  } = positioningSystem;

  const { isPermissionGranted, requestPermission } = usePermissions();

  //******** HELPER FUNCTIONS **********
  const getScreenOrientationCompensation = (): number => {
    let screenOrientation = 0;
    
    if (screen && screen.orientation) {
      screenOrientation = screen.orientation.angle;
    } else if (window.orientation !== undefined) {
      screenOrientation = window.orientation;
    }
    
    return -screenOrientation * (Math.PI / 180);
  };

  // Get current expected model position from positioning system
  const getCurrentExpectedModelPosition = useCallback((): THREE.Vector3 | null => {
    if (!positioningSystem || !positioningSystemReady || !frozenUserPosition) {
      return null;
    }
    
    try {
      const result = positioningSystem.getPosition(experienceType);
      if (result) {
        setDebugFrozenModelPosition(result.relativeToUser.clone());
        return result.relativeToUser;
      }
    } catch (error) {
      console.warn('Error getting model position:', error);
    }
    
    return null;
  }, [positioningSystem, positioningSystemReady, experienceType, frozenUserPosition]);

  //******** CAMERA INITIALIZATION **********
  const initializeCamera = async (): Promise<boolean> => {
    try {
      console.log('🎥 Initializing AR camera...');
      
      if (!isPermissionGranted(PermissionType.CAMERA)) {
        throw new Error('Camera permission not granted. Please enable in settings.');
      }
      
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('getUserMedia not supported');
      }
      
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        console.log('✅ Camera stream initialized');
      }
      
      return true;
    } catch (error) {
      console.error('❌ Camera initialization failed:', error);
      setCameraError('Failed to access camera. Please check permissions.');
      return false;
    }
  };

  //******** RENDERING ENGINE INITIALIZATION **********
  const initializeRenderingEngine = async (): Promise<boolean> => {
    if (!canvasRef.current) {
      console.error('❌ Canvas not available for rendering engine');
      return false;
    }

    try {
      console.log('🎨 Initializing AR Rendering Engine...');
      
      const engine = new ARRenderingEngine(
        {
          fov: 70,
          near: 0.1,
          far: 1000,
          enableOptimizations: true,
          antialias: true,
          alpha: true,
          clearColor: 0x000000,
          clearAlpha: 0
        },
        {
          onSceneReady: (scene, camera) => {
            console.log('📡 AR Rendering Engine: Scene ready');
            if (onSceneReady) {
              onSceneReady(scene, camera);
            }
          },
          onError: (error) => {
            console.error('🎨 AR Rendering Engine Error:', error);
            setCameraError(`Rendering engine error: ${error}`);
          },
          onRenderFrame: (deltaTime) => {
            // Optional: Per-frame updates
          }
        }
      );

      const success = await engine.initialize(canvasRef.current);
      if (!success) {
        console.error('❌ Failed to initialize rendering engine');
        return false;
      }

      renderingEngineRef.current = engine;
      engine.startRenderLoop();
      
      console.log('✅ AR Rendering Engine initialized and started');
      return true;
      
    } catch (error) {
      console.error('❌ Rendering engine initialization error:', error);
      setCameraError(`Failed to initialize rendering engine: ${error}`);
      return false;
    }
  };

  //******** MAIN INITIALIZATION **********
const initialize = async () => {
  setInitStatus('Starting AR Camera...');
  
  if (!isPermissionGranted(PermissionType.CAMERA)) {
    setInitStatus('Requesting camera permission...');
    const cameraGranted = await requestPermission(PermissionType.CAMERA);
    if (!cameraGranted) {
      setCameraError('Camera permission required for AR experience. Please allow camera access when prompted.');
      return;
    }
  }
  
  if (!isPermissionGranted(PermissionType.ORIENTATION)) {
    setInitStatus('Requesting motion permission...');
    await requestPermission(PermissionType.ORIENTATION);
  }
  
  setInitStatus('Accessing camera...');
  const cameraInitialized = await initializeCamera();
  if (!cameraInitialized) return;
  
  setInitStatus('Initializing 3D engine...');
  const engineInitialized = await initializeRenderingEngine();
  if (!engineInitialized) return;
  
  setInitStatus('Positioning AR objects...');
  triggerArObjectPlacement();
  
  if (canvasRef.current && !isListening) {
    setInitStatus('Setting up interactions...');
    attachListeners();
  }
  
  setInitStatus('AR Ready!');
  setIsInitialized(true);
};

  //******** REINITIALIZATION (FIXES PERMISSION BUG) **********
  const reinitializeAR = async (): Promise<void> => {
    console.log('🔄 Reinitializing AR after permission grant...');
    
    try {
      if (renderingEngineRef.current) {
        renderingEngineRef.current.dispose();
        renderingEngineRef.current = null;
      }
      
      setIsInitialized(false);
      setCameraError(null);
      
      await initialize();
      
    } catch (error) {
      console.error('❌ Reinitialization failed:', error);
      setCameraError(`Reinitialization failed: ${error}`);
    }
  };

  //******** NEW SIMPLIFIED AR OBJECT PLACEMENT **********
  const triggerArObjectPlacement = useCallback(() => {
  setInitStatus('Checking positioning system...');
  
  if (!positioningSystem || !positioningSystemReady) {
    setInitStatus('❌ Positioning system not ready');
    return;
  }
  
  if (!frozenUserPosition) {
    setInitStatus('❌ No user position available');
    return;
  }
  
  setInitStatus('Getting model position...');
  
  try {
    const result = positioningSystem.getPosition(experienceType);
    
    if (result && onArObjectPlaced) {
      setInitStatus('✅ AR positioned successfully');
      onArObjectPlaced(result.relativeToUser);
    } else {
      setInitStatus('❌ Failed to get model position');
    }
  } catch (error) {
    // setInitStatus(`❌ Error: ${error.message}`);
  }
}, [positioningSystem, positioningSystemReady, frozenUserPosition, experienceType, onArObjectPlaced]);


  //******** CAMERA DIRECTION UPDATES **********
  const updateCameraDirection = useCallback(() => {
    const camera = renderingEngineRef.current?.getCamera();
    if (!camera) return;

    camera.getWorldDirection(cameraDirectionVector.current);
    
    const bearing = Math.atan2(
      cameraDirectionVector.current.x,
      -cameraDirectionVector.current.z
    ) * (180 / Math.PI);

    const normalizedBearing = (bearing + 360) % 360;
    const expectedModelPosition = getCurrentExpectedModelPosition();
    
    let aimError = null;
    let modelDistance = null;
    
    if (expectedModelPosition && camera) {
      const cameraPosition = camera.position;
      const expectedDirection = expectedModelPosition.clone().sub(cameraPosition).normalize();
      
      const dotProduct = cameraDirectionVector.current.dot(expectedDirection);
      const angleDifference = Math.acos(Math.max(-1, Math.min(1, dotProduct))) * (180 / Math.PI);
      aimError = angleDifference;
      
      modelDistance = cameraPosition.distanceTo(expectedModelPosition);
    }
    
    setCameraLookDirection({
      vector: cameraDirectionVector.current.clone(),
      bearing: normalizedBearing,
      expectedModelPosition,
      aimError,
      modelDistance
    });
  }, [getCurrentExpectedModelPosition]);

  //******** WINDOW RESIZE **********
  const handleResize = useCallback(() => {
    if (renderingEngineRef.current?.isReady()) {
      renderingEngineRef.current.handleResize();
      console.log('📱 Window resized, engine updated');
    }
  }, []);

  //******** EFFECTS **********
  
  // Camera orientation updates
  useEffect(() => {
    if (!isInitialized || !renderingEngineRef.current?.isReady()) return;
    
    const cameraQuaternion = getCameraQuaternion();
    if (!cameraQuaternion) return;
    
    try {
      const betaCorrection = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(1, 0, 0), 
        Math.PI / 2
      );
      
      const flipUpDown = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 0, 1), 
        Math.PI
      );
      
      const flipXZ = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0), 
        Math.PI
      );

      const screenCompensation = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 0, 1), 
        getScreenOrientationCompensation()
      );
      
      let finalQuaternion = cameraQuaternion.clone();
      finalQuaternion.multiply(betaCorrection);
      finalQuaternion.multiply(flipUpDown);
      finalQuaternion.multiply(flipXZ);
      finalQuaternion.multiply(screenCompensation);

      renderingEngineRef.current.updateCameraOrientation(finalQuaternion);
      
    } catch (error) {
      console.warn('🎨 Error updating camera orientation:', error);
    }
  }, [isInitialized, getCameraQuaternion]);

  // Camera direction updates
  useEffect(() => {
    if (!isInitialized || !renderingEngineRef.current?.isReady()) return;
    
    cameraUpdateIntervalRef.current = window.setInterval(updateCameraDirection, 200);
    
    return () => {
      if (cameraUpdateIntervalRef.current) {
        clearInterval(cameraUpdateIntervalRef.current);
      }
    };
  }, [isInitialized, updateCameraDirection]);

  // Orientation callback
  useEffect(() => {
    if (onOrientationUpdate && deviceOrientation && 
        deviceOrientation.alpha !== null && 
        deviceOrientation.beta !== null && 
        deviceOrientation.gamma !== null) {
      onOrientationUpdate({
        alpha: deviceOrientation.alpha,
        beta: deviceOrientation.beta,
        gamma: deviceOrientation.gamma
      });
    }
  }, [deviceOrientation, onOrientationUpdate]);

  // AR object placement when system becomes ready
  useEffect(() => {
    if (isInitialized && positioningSystemReady && frozenUserPosition) {
      triggerArObjectPlacement();
    }
  }, [isInitialized, positioningSystemReady, frozenUserPosition, triggerArObjectPlacement]);

  // Main initialization
  useEffect(() => {
    initialize();

    window.addEventListener('resize', handleResize);
    
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      
      window.removeEventListener('resize', handleResize);
      if (isListening) {
        detachListeners();
      }
            
      if (renderingEngineRef.current) {
        renderingEngineRef.current.dispose();
        renderingEngineRef.current = null;
      }
      
      console.log('🧹 AR Camera cleaned up');
    };
  }, []);

  return (
    <div 
      ref={containerRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 1000,
      }}
    >
      {/* Camera video background */}
      <video
        ref={videoRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          zIndex: 1010
        }}
        autoPlay
        playsInline
        muted
      />

      {/* Semi-transparent background for water experiences */}
      {(experienceType === 'lily' || experienceType === 'lotus' || experienceType === 'cattail' || experienceType === '1968') && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          zIndex: 1015,
          pointerEvents: 'none'
        }} />
      )}

      {/* Three.js canvas overlay */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 1020,
          pointerEvents: 'auto', 
        }}
      />
  
      {/* Error display - only show for actual technical errors, not permission issues */}
      {cameraError && !cameraError.includes('permission') && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: 'rgba(255, 0, 0, 0.8)',
          color: 'white',
          padding: '20px',
          borderRadius: '8px',
          textAlign: 'center',
          zIndex: 1030,
          maxWidth: '80%'
        }}>
          <h3>Camera Error</h3>
          <p>{cameraError}</p>
          <p style={{ fontSize: '14px', marginTop: '10px' }}>
            Please try refreshing the page or check your device settings.
          </p>
        </div>
      )}
      
      {/* Permission request UI - gentler approach */}
      {cameraError && cameraError.includes('permission') && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          color: 'white',
          padding: '20px',
          borderRadius: '8px',
          textAlign: 'center',
          zIndex: 1030,
          maxWidth: '80%'
        }}>
          <h3>📸 Camera Access Needed</h3>
          <p>This AR experience needs camera access to work.</p>
          <button
            onClick={async () => {
              setCameraError(null);
              const granted = await requestPermission(PermissionType.CAMERA);
              if (granted) {
                await reinitializeAR();
              }
            }}
            style={{
              marginTop: '15px',
              padding: '10px 20px',
              backgroundColor: 'var(--color-blue)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            Allow Camera Access
          </button>
          <p style={{ fontSize: '12px', marginTop: '10px', opacity: 0.7 }}>
            Your camera data stays on your device and is not stored or shared.
          </p>
        </div>
      )}

      {/* Loading indicator */}
    {!isInitialized && !cameraError && (
  <div style={{
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    color: 'white',
    padding: '20px',
    borderRadius: '8px',
    textAlign: 'center',
    zIndex: 1030
  }}>
    <div style={{ fontSize: '18px', marginBottom: '10px' }}>🎥 {initStatus}</div>
    
    {/* Show positioning system status */}
    <div style={{ fontSize: '12px', opacity: 0.8 }}>
      Positioning Ready: {positioningSystemReady ? '✅' : '❌'}<br/>
      User Position: {frozenUserPosition ? '✅' : '❌'}<br/>
      Experience: {experienceType}
    </div>
  </div>
)}
      
      {/* SIMPLIFIED Debug Panel */}
      {SHOW_DEBUG_PANEL && (
        <div style={{
          position: 'absolute',
          top: '1vh',
          left: '1vw',
          right: '35vw',
          backgroundColor: 'transparent',
          backdropFilter: 'blur(4px)',
          color: 'white',
          padding: '10px',
          borderRadius: '4px',
          fontSize: '10px',
          zIndex: 1030,
          pointerEvents: 'auto',
          fontFamily: 'monospace'
        }}>
          <div 
            onClick={() => setDebugCollapsed(!debugCollapsed)}
            style={{ 
              cursor: 'pointer', 
              userSelect: 'none',
              marginBottom: debugCollapsed ? '0' : '5px'
            }}  
          >
            <span style={{ fontSize: '14px', marginRight: '8px' }}>
              {debugCollapsed ? '▶' : '▼'}
            </span>
            <span style={{ color: 'yellow' }}>🎥 AR CAMERA (REFORMED)</span>
          </div>

          {/* Frozen Position Status */}
          <div style={{ 
            marginTop: '5px', 
            paddingTop: '5px', 
            borderTop: '1px solid rgba(255,255,0,0.3)',
            backgroundColor: 'rgba(0,255,0,0.1)' 
          }}>
            <div style={{ color: 'lightgreen', fontSize: '9px' }}>
              <strong>🔒 FROZEN POSITION STATUS:</strong>
            </div>
            <div style={{ fontSize: '8px' }}>
              User: {frozenUserPosition ? 
                `[${frozenUserPosition[0].toFixed(8)}, ${frozenUserPosition[1].toFixed(8)}] ✅` : 
                '❌ NOT FROZEN'
              }
            </div>
            <div style={{ fontSize: '8px' }}>
              Model: {debugFrozenModelPosition ? 
                `[${debugFrozenModelPosition.x.toFixed(2)}, ${debugFrozenModelPosition.y.toFixed(2)}, ${debugFrozenModelPosition.z.toFixed(2)}] ✅` : 
                '❌ NOT CALCULATED'
              }
            </div>
          </div>
        
          
          <div style={{ display: 'flex', flexDirection: 'row', gap: '8px', marginTop: '8px' }}>
            <div 
              onClick={() => {
                debugModeManager.setDebugMode(!arTestingOverride);
              }}
              style={{ 
                cursor: 'pointer', 
                userSelect: 'none', 
                padding: '4px 8px',
                backgroundColor: 'rgba(0,0,255,0.3)',
                width: '50%',
                textAlign: 'center'
              }}
            >
              Override: {arTestingOverride ? '✅' : '❌'}
            </div>
            
            <button
              onClick={() => {
                console.log('🔄 Resetting shared positioning system');
                resetAllAdjustments();
                if (onElevationChanged) {
                  onElevationChanged();
                }
                console.log('🔄 Reset complete');
              }}
              style={{
                fontSize: '10px',
                padding: '4px 8px',
                backgroundColor: 'rgba(0,255,0,0.3)',
                border: 'none',
                color: 'white',
                cursor: 'pointer',
                width: '50%'
              }}
            >
              🔄 Reset System
            </button>
          </div>

          <div style={{ marginTop: '5px', display: 'flex', justifyContent: 'space-between' }}>
            <button
              onClick={createTestMarkers}
              style={{
                fontSize: '10px',
                padding: '4px 8px',
                backgroundColor: 'rgba(255,255,0,0.3)',
                border: 'none',
                color: 'white',
                cursor: 'pointer',
                width: '100%',
                marginTop: '5px'
              }}
            >
              🎯 Show Cardinal Markers
            </button>
            <div>Engine Ready: {renderingEngineRef.current?.isReady() ? '✅' : '❌'}</div>
            <div>Render Loop: {renderingEngineRef.current?.isRenderingActive() ? '🔄' : '⏸️'}</div>
          </div>

          {!debugCollapsed && (
            <div style={{ marginTop: '5px', paddingTop: '5px', borderTop: '1px solid rgba(255,255,255,0.2)' }}>    

            
          {/* Live GPS Comparison */}
          <div style={{ fontSize: '8px', marginTop: '3px', paddingTop: '3px', borderTop: '1px solid rgba(255,255,255,0.2)' }}>
            <strong>Live GPS (for comparison):</strong>
          </div>
          <div style={{ fontSize: '7px' }}>
            Raw: {rawUserPosition ? 
              `[${rawUserPosition[0].toFixed(8)}, ${rawUserPosition[1].toFixed(8)}]` : 
              'NULL'
            }
          </div>
          <div style={{ fontSize: '7px' }}>
            Precise: {preciseUserPosition ? 
              `[${preciseUserPosition[0].toFixed(8)}, ${preciseUserPosition[1].toFixed(8)}]` : 
              'NULL'
            }
          </div>
          <div style={{ fontSize: '7px' }}>
            Accuracy: {currentAccuracy?.toFixed(1)}m | Quality: {positionQuality} | Stable: {isPositionStable ? '✅' : '❌'}
          </div>

          {/* Positioning System Status */}
          <div style={{ 
            marginTop: '5px', 
            paddingTop: '5px', 
            borderTop: '1px solid rgba(255,255,255,0.3)' 
          }}>
            <div style={{ color: 'lightblue', fontSize: '9px' }}>
              <strong>Shared Positioning System:</strong>
            </div>
            <div style={{ fontSize: '8px' }}>Ready: {positioningSystemReady ? '✅' : '❌'}</div>
            <div style={{ fontSize: '8px' }}>Debug Mode: {positioningDebugMode ? '✅' : '❌'}</div>
            <div style={{ fontSize: '8px' }}>Global Elevation: {getCurrentElevationOffset()?.toFixed(3)}m</div>
            <div style={{ fontSize: '8px' }}>Experience: {experienceType}</div>
          </div>

              <div>
                <span style={{ color: 'cyan' }}>Device Heading: {deviceHeading?.toFixed(1) ?? 'N/A'}°</span>
                <span style={{ color: 'white' }}> | Available: {orientationAvailable ? '✅' : '❌'}</span>
              </div>

              {orientationError && 
                <div style={{color: 'red'}}> Orient Error: {orientationError} </div>
              }

              <div>
                Camera Look Direction: {cameraLookDirection.bearing?.toFixed(1)}°
              </div>

              {cameraLookDirection.expectedModelPosition && (
                <div>
                  <div>Expected Model: [{cameraLookDirection.expectedModelPosition.x.toFixed(2)}, {cameraLookDirection.expectedModelPosition.y.toFixed(2)}, {cameraLookDirection.expectedModelPosition.z.toFixed(2)}]</div>
                  <div>Aim Error: {cameraLookDirection.aimError?.toFixed(1)}°</div>
                  <div>Model Distance: {cameraLookDirection.modelDistance?.toFixed(1)}m</div>
                </div>
              )}

              {/* Legacy anchor position for reference only */}
              {anchorPosition && (
                <div style={{ marginTop: '5px', paddingTop: '5px', borderTop: '1px solid rgba(255,100,100,0.3)', backgroundColor: 'rgba(255,100,100,0.1)' }}>
                  <div style={{ color: 'pink', fontSize: '8px' }}>
                    <strong>LEGACY (Reference Only):</strong>
                  </div>
                  <div style={{ fontSize: '7px' }}>
                    Anchor GPS: [{anchorPosition[0].toFixed(8)}, {anchorPosition[1].toFixed(8)}]
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Camera Direction Guidance - Always Visible on Main Screen */}
{isInitialized && cameraLookDirection.bearing !== null && (
  <div style={{
    position: 'absolute',
    bottom: '20px',
    left: '50%',
    width: '90svw',
    
    transform: 'translateX(-50%)',
    backgroundColor: 'rgba(0, 0, 0, 0)',
    backdropFilter: 'blur(4px)',
    color: 'white',
    padding: '12px 20px',
    borderRadius: '8px',
    textAlign: 'center',
    zIndex: 1025,
    fontFamily: 'monospace',
    fontSize: '1rem'
  }}>
    {/* <div style={{ fontSize: '12px', color: 'cyan', marginBottom: '5px' }}>
      📷 {cameraLookDirection.bearing.toFixed(1)}°
    </div> */}
    {cameraLookDirection.aimError !== null && (
      <div 
      style={{ 
        fontSize: '14px', 
        color: 'yellow', 
        fontWeight: 'bold' ,

      }}
      >
        {getTurnDirectionText()}
      </div>
    )}
    {cameraLookDirection.modelDistance !== null && (
      <div style={{ fontSize: '11px', color: 'lightblue', marginTop: '3px' }}>
        {(cameraLookDirection.modelDistance * 3.28084).toFixed(1)}ft away
      </div>
    )}
  </div>
)}


      <ReformedModelPositioningPanel
  isCollapsed={isBottomDebugCollapsed}
  isVisible={SHOW_DEBUG_PANEL && positioningSystemReady}
  data={{
    cameraLookDirection,
    manualScaleOffset,
    frozenUserPosition: frozenUserPosition || null,
    debugFrozenModelPosition,
    experienceType,
    positioningSystemReady,
    arTestingOverride,
    globalElevationOffset: getCurrentElevationOffset() || 0
  }}
  callbacks={{
    onElevationAdjust: adjustGlobalElevation,
    onScaleAdjust: updateScaleOffset,
    onAnchorAdjust: (direction) => {
      // Handle anchor adjustments through positioning system
      console.log(`Anchor adjust: ${direction}`);
      if (onElevationChanged) onElevationChanged();
    },
    onElevationChanged,
    onMLCorrectionToggle: handleMLCorrectionToggle
  }}
  
  onClose={() => setIsBottomDebugCollapsed(true)}
/>


      {/* Child components (AR objects will be added here) */}
      {children}
    </div>
  );
};

export default ArCameraComponent;