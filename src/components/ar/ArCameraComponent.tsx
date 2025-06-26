// src/components/ar/ArCameraComponent.tsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { calculateBearing, gpsToThreeJsPosition, gpsToThreeJsPositionWithEntryOffset } from '../../utils/geoArUtils';
import { usePermissions } from '../../context/PermissionsContext';
import { PermissionType } from '../../utils/permissions';
import { useDeviceOrientation } from '../../hooks/useDeviceOrientation';
import { useGeofenceContext } from '../../context/GeofenceContext';
import { useARPositioning } from '../../hooks/useARPositioning';
import { ARRenderingEngine } from '../engines/ARRenderingEngine';
import { useARInteractions } from '../../hooks/useARInteractions';
import ModelPositioningPanel from '../debug/ModelPositioningPanel';



const SHOW_DEBUG_PANEL = true;

interface ArCameraProps {
  userPosition?: [number, number];
  anchorPosition: [number, number];
  anchorElevation?: number;
  coordinateScale?: number;
  experienceType?: string;
  onArObjectPlaced?: (position: THREE.Vector3) => void;
  onOrientationUpdate?: (orientation: { alpha: number; beta: number; gamma: number }) => void;
  onSceneReady?: (scene: THREE.Scene, camera: THREE.PerspectiveCamera) => void; 
  onModelRotate?: (deltaX: number, deltaY: number, deltaZ?: number) => void;
  onModelScale?: (scaleFactor: number) => void;
  onModelReset?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  useNewPositioning?: boolean;
  onElevationChanged?: () => void;
  sharedARPositioning?: ReturnType<typeof useARPositioning>;
  onPositioningReady?: (positioningFunctions: {
    positionObject: (object: THREE.Object3D, experienceId: string, options?: any) => boolean;
    adjustGlobalElevation: (delta: number) => void;
    isReady: boolean;
  }) => void;
  children?: React.ReactNode;
}

const ArCameraComponent: React.FC<ArCameraProps> = ({
  userPosition: propUserPosition,
  anchorPosition,
  anchorElevation = 2.0,
  coordinateScale = 1.0,
  onArObjectPlaced,
  onOrientationUpdate,
  experienceType,
  onSceneReady,
  onModelRotate,
  onModelScale,
  onModelReset,
  onSwipeUp,
  onSwipeDown,
  useNewPositioning,
  onElevationChanged,
  onPositioningReady,
  sharedARPositioning,
  children
}) => {
  
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

  const cameraDirectionVector = useRef(new THREE.Vector3());
  const lastCameraUpdateRef = useRef(0);
  const cameraUpdateIntervalRef = useRef<number | null>(null);
  const lastCameraQuaternionRef = useRef<THREE.Quaternion | null>(null);
  const swipeStartY = useRef(0);
  const swipeStartTime = useRef(0);

  //******** STATE **********
  const [isInitialized, setIsInitialized] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualScaleOffset, setManualScaleOffset] = useState(1.0);
  const [debugHeading, setDebugHeading] = useState<number | null>(null);
  const [compassCalibration, setCompassCalibration] = useState(0);
  const [adjustedAnchorPosition, setAdjustedAnchorPosition] = useState<[number, number] | null>(null);
  const [manualElevationOffset, setManualElevationOffset] = useState(0);
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
  const [gpsOffset, setGpsOffset] = useState({ lon: 0, lat: 0 });
  const [accumulatedTransforms, setAccumulatedTransforms] = useState({
    rotation: { x: 0, y: 0, z: 0 },
    scale: 1.0
  });
  const [debugCollapsed, setDebugCollapsed] = useState(true);
  const [isBottomDebugCollapsed, setIsBottomDebugCollapsed] = useState(true);
  const [arTestingOverride, setArTestingOverride] = useState<boolean>(() => {
    return typeof (window as any).arTestingOverride === 'boolean'
      ? (window as any).arTestingOverride
      : false;
  });



   //******** DEBUG PANEL FUNCTIONS **********
   const handleDebugSwipeUp = useCallback(() => {
      setIsBottomDebugCollapsed(false);
      console.log('🔼 Debug panel expanded');
    }, []);

    const handleDebugSwipeDown = useCallback(() => {
      setIsBottomDebugCollapsed(true);
      console.log('🔽 Debug panel collapsed');
    }, []);


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

  const newPositioningSystem = sharedARPositioning;
// And add a guard:
if (!newPositioningSystem) {
  console.error('❌ ArCameraComponent: No shared AR positioning provided!');
  return null;
}

  const { 
    adjustGlobalElevation: newAdjustElevation,
    positionObject: newPositionObject,
    isReady: newSystemReady 
  } = newPositioningSystem;

  const { isPermissionGranted, requestPermission } = usePermissions();

  //******** CONSTANTS **********

  const activeAnchorPosition = adjustedAnchorPosition || anchorPosition;
  const CAMERA_UPDATE_INTERVAL = 200;
  const currentExperienceType = experienceType || 'default';
  const experienceOffsets: Record<string, number> = {
    'lotus': -1.8,
    'lily': -1.8,       
    'cattail': -1.80,    
    'mac': -1.8,
    'helen_s': -1.8,    
    'volunteers': -1.8, 
    '2030-2105': -2,
    '1968': 0,
    '2200_bc': -1.6, 
    'default': 0
  };

  const typeKey = experienceType ?? 'default';
  const elevationOffset = experienceOffsets[typeKey] || experienceOffsets['default'];


  //******** HELPER FUNCTIONS **********
  const formatWithSign = (num: number, decimals: number = 1, totalWidth: number = 10) => {
    const sign = num >= 0 ? '+' : '';
    return `${sign}${Math.abs(num).toFixed(decimals)}`.padStart(totalWidth, '  ');
  };

  const detectEntrySide = useCallback((
    userPos: [number, number], 
    anchorPos: [number, number]
  ): string | null => {
    const angleToUser = Math.atan2(
      userPos[1] - anchorPos[1],
      userPos[0] - anchorPos[0]
    ) * (180 / Math.PI);
    
    const normalizedAngle = (angleToUser + 360) % 360;
    const directionIndex = Math.round(normalizedAngle / 45) % 8;
    const directions = ['east', 'northeast', 'north', 'northwest', 'west', 'southwest', 'south', 'southeast'];
    
    return directions[directionIndex];
  }, []);

  const getBestUserPosition = useCallback((): [number, number] | null => {
    if (propUserPosition) {
      return propUserPosition;
    }
    
    if (preciseUserPosition && isPositionStable && 
        currentAccuracy && currentAccuracy <= 10) {
      return preciseUserPosition;
    }
    
    if (preciseUserPosition && currentAccuracy && currentAccuracy <= 15) {
      return preciseUserPosition;
    }
    
    if (rawUserPosition) {
      return rawUserPosition;
    }
    
    return null;
  }, [propUserPosition, preciseUserPosition, rawUserPosition]);

  const getScreenOrientationCompensation = (): number => {
    let screenOrientation = 0;
    
    if (screen && screen.orientation) {
      screenOrientation = screen.orientation.angle;
    } else if (window.orientation !== undefined) {
      screenOrientation = window.orientation;
    }
    
    return -screenOrientation * (Math.PI / 180);
  };

  const getCurrentExpectedModelPosition = useCallback((): THREE.Vector3 | null => {
    if (!newPositioningSystem || !newSystemReady) return null;
    
    const experienceId = experienceType || 'mac';
    const result = newPositioningSystem.getPosition(experienceId);
    
    if (!result) return null;
    
    return result.relativeToUser;
  }, [newPositioningSystem, newSystemReady, experienceType]);

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
    console.log('🚀 Starting AR Camera initialization...');
    
    if (!isPermissionGranted(PermissionType.CAMERA)) {
      console.log('📸 Camera permission not granted, requesting...');
      const cameraGranted = await requestPermission(PermissionType.CAMERA);
      if (!cameraGranted) {
        setCameraError('Camera permission required for AR experience. Please allow camera access when prompted.');
        return;
      }
    }
    
    if (!isPermissionGranted(PermissionType.ORIENTATION)) {
      console.log('📱 Orientation permission not granted, requesting...');
      await requestPermission(PermissionType.ORIENTATION);
    }
    
    const cameraInitialized = await initializeCamera();
    if (!cameraInitialized) return;
    
    const engineInitialized = await initializeRenderingEngine();
    if (!engineInitialized) return;
    
    placeArObject();
    
    if (canvasRef.current && !isListening) {
      attachListeners();
      console.log('✅ AR interactions attached');
    }
              
    setIsInitialized(true);
    console.log('✅ AR Camera fully initialized');
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

  //******** AR OBJECT PLACEMENT **********
  const placeArObject = useCallback(() => {
    console.log('🎯 placeArObject() called');
    
    if (useNewPositioning) {
      console.log('🧪 NEW: Using ARPositioningManager - experiences handle their own positioning');
      return;
    }
    
    const userPosition = getBestUserPosition();
    
    if (!userPosition || !anchorPosition) {
      console.log('❌ Missing positions - userPosition:', userPosition, 'anchorPosition:', anchorPosition);
      return;
    }
    
    const entrySide = detectEntrySide(userPosition, anchorPosition);
    const finalElevationOffset = elevationOffset + manualElevationOffset;

    const position = gpsToThreeJsPositionWithEntryOffset(
      userPosition,
      activeAnchorPosition,
      entrySide,
      finalElevationOffset,
      coordinateScale
    );

    if (onArObjectPlaced) {
      onArObjectPlaced(position);
    }
  }, [useNewPositioning, getBestUserPosition, anchorPosition, adjustedAnchorPosition, coordinateScale, manualElevationOffset, elevationOffset, experienceType]);

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

  const updateElevationOffset = useCallback((deltaElevation: number) => {
    const newOffset = manualElevationOffset + deltaElevation;
    setManualElevationOffset(newOffset);
  }, [manualElevationOffset]);

  const updateAnchorPosition = useCallback((deltaLon: number, deltaLat: number) => {
    const newOffset = {
      lon: gpsOffset.lon + deltaLon,
      lat: gpsOffset.lat + deltaLat
    };
    
    setGpsOffset(newOffset);

    const newAnchorPosition: [number, number] = [
      anchorPosition[0] + newOffset.lon,
      anchorPosition[1] + newOffset.lat
    ];
    
    setAdjustedAnchorPosition(newAnchorPosition);
  }, [anchorPosition, gpsOffset]);

  const updateScaleOffset = useCallback((deltaScale: number) => {
    const newScale = Math.max(0.1, Math.min(8.0, manualScaleOffset + deltaScale));

    setManualScaleOffset(newScale);
    
    setAccumulatedTransforms(prev => ({
      ...prev,
      scale: newScale
    }));
    
    if (onModelScale) {
      onModelScale(newScale);
    }
  }, [manualScaleOffset, onModelScale]);

 

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

  // Positioning ready callback
  useEffect(() => {
    if (newSystemReady && onPositioningReady && renderingEngineRef.current?.isReady()) {
      onPositioningReady({
        positionObject: newPositionObject,
        adjustGlobalElevation: newAdjustElevation,
        isReady: newSystemReady
      });
    }
  }, [newSystemReady, onPositioningReady, newPositionObject, newAdjustElevation, isInitialized]);

  // AR object placement updates
  useEffect(() => {
    if (isInitialized) {
      placeArObject();
    }
  }, [anchorPosition, adjustedAnchorPosition, coordinateScale, isInitialized, manualElevationOffset]);

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

  const currentUserPosition = getBestUserPosition();

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
          <div>🎥 Starting AR Camera...</div>
          <div style={{ fontSize: '14px', marginTop: '10px', opacity: 0.8 }}>
            {!isPermissionGranted(PermissionType.CAMERA) && 'Please allow camera access when prompted'}
            {isPermissionGranted(PermissionType.CAMERA) && !isPermissionGranted(PermissionType.ORIENTATION) && 'Please allow motion sensors for best experience'}
            {isPermissionGranted(PermissionType.CAMERA) && isPermissionGranted(PermissionType.ORIENTATION) && 'Initializing AR positioning...'}
          </div>
        </div>
      )}
      
      {/* TOP Debug Panel */}
      {SHOW_DEBUG_PANEL && (
        <div style={{
          position: 'absolute',
          top: '1vh',
          left: '1vw',
          right: '35vw',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
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
            <span style={{ color: 'yellow' }}>🎥 AR CAMERA DEBUG</span>
            <span style={{ fontSize: '8px', opacity: 0.7, marginLeft: '8px' }}>
              {newSystemReady ? '(SHARED POSITIONING)' : '(LEGACY)'}
            </span>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'row', gap: '8px' }}>
            <div 
              onClick={() => {
                const newValue = !arTestingOverride;
                (window as any).arTestingOverride = newValue;
                setArTestingOverride(newValue);
                window.dispatchEvent(new CustomEvent('ar-override-changed', { 
                  detail: { override: newValue } 
                }));
              }}
              style={{ 
                cursor: 'pointer', 
                userSelect: 'none', 
                margin: '0rem', 
                padding: '4px 8px',
                backgroundColor: 'rgba(0,0,255,0.3)',
                marginTop: '8px',
                width: '100%' 
              }}
            >
              Override: {arTestingOverride ? '✅' : '❌'}
            </div>
            
            <button
              onClick={() => {
                if (newSystemReady) {
                  console.log('🔄 Resetting shared AR positioning system');
                  newPositioningSystem.resetAllAdjustments();
                  
                  if (onElevationChanged) {
                    onElevationChanged();
                  }
                  
                  console.log('🔄 Shared positioning system reset complete');
                } else {
                  setGpsOffset({ lon: 0, lat: 0 });
                  setManualElevationOffset(0);
                  setAdjustedAnchorPosition(null);
                  console.log('🔄 Legacy GPS and elevation offsets reset');
                }
              }}
              style={{
                fontSize: '10px',
                padding: '4px 8px',
                backgroundColor: newSystemReady ? 'rgba(0,255,0,0.3)' : 'rgba(255,0,0,0.3)',
                border: 'none',
                color: 'white',
                cursor: 'pointer',
                width: '100%',
                marginTop: '8px'
              }}
            >
              {newSystemReady ? '🔄 Reset Shared System' : '🔄 Reset Legacy'}
            </button>
          </div>

          <div>Engine Ready: {renderingEngineRef.current?.isReady() ? '✅' : '❌'}</div>
          <div>Render Loop: {renderingEngineRef.current?.isRenderingActive() ? '🔄' : '⏸️'}</div>

          {!debugCollapsed && (
            <div>    
              <div>
                User: [{currentUserPosition ? `${currentUserPosition[0].toFixed(10)}, ${currentUserPosition[1].toFixed(10)}` : 'No position'}]
              </div>

              <div>
                Anchor GPS: [{(() => {
                  const displayLon = activeAnchorPosition[0] + gpsOffset.lon;
                  const displayLat = activeAnchorPosition[1] + gpsOffset.lat;
                  return `${displayLon.toFixed(10)}, ${displayLat.toFixed(10)}`;
                })()}]
                <span style={{ fontSize: '8px', opacity: 0.7, marginLeft: '4px', color: newSystemReady ? 'lightgreen' : 'yellow' }}>
                  {newSystemReady ? '(live)' : '(legacy)'}
                </span>
              </div>  
                                        
              <div>
                GPS Bearing: {currentUserPosition ? `${calculateBearing(currentUserPosition, anchorPosition).toFixed(1)}°` : 'N/A'}
              </div>

              {newSystemReady && (
                <div style={{ 
                  marginTop: '5px', 
                  paddingTop: '5px', 
                  borderTop: '1px solid rgba(255,255,255,0.3)' 
                }}>
                  <div style={{ color: 'lightgreen', fontSize: '9px' }}>
                    <strong>Shared AR Positioning:</strong>
                  </div>
                  <div>Ready: {newSystemReady ? '✅' : '❌'}</div>
                  <div>Debug Mode: {newPositioningSystem.debugMode ? '✅' : '❌'}</div>
                  <div>Global Elevation: {newPositioningSystem.getCurrentElevationOffset().toFixed(3)}m</div>
                </div>
              )}
              
              <div>
                <span style={{ color: 'cyan' }}>Device Heading: {deviceHeading?.toFixed(1) ?? 'N/A'}°</span>
                <span style={{ color: 'white' }}> | Available: {orientationAvailable ? '✅' : '❌'}</span>
              </div>

              {orientationError && 
                <div style={{color: 'red'}}> Orient Error: {orientationError} </div>
              }
            </div>
          )}
        </div>
      )}

      {/* LOWER Debug Panel */}
  
      <ModelPositioningPanel
        isCollapsed={isBottomDebugCollapsed}
        isVisible={SHOW_DEBUG_PANEL && isInitialized}
        data={{
          accumulatedTransforms,
          cameraLookDirection,
          userPosition: currentUserPosition,
          activeAnchorPosition,
          coordinateScale,
          newSystemReady,
          experienceType,
          experienceOffsets,
          manualElevationOffset,
          manualScaleOffset,
          adjustedAnchorPosition,
          anchorPosition,
          gpsOffset,
          globalElevationOffset: newPositioningSystem.getCurrentElevationOffset()
        }}
        callbacks={{
          onElevationAdjust: newSystemReady ? newAdjustElevation : updateElevationOffset,
          onAnchorAdjust: updateAnchorPosition,
          onScaleAdjust: updateScaleOffset,
          onModelScale,
          onModelReset,
          onElevationChanged
        }}
      />
      {/* Child components (AR objects will be added here) */}
      {children}
    </div>
  );
};

export default ArCameraComponent;