// src/components/ar/ArCameraComponent.tsx - Updated for single source pattern
import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from '../../../node_modules/@types/three';
import { usePermissions } from '../../context/PermissionsContext';
import { PermissionType } from '../../utils/permissions';
import { useDeviceOrientation } from '../../hooks/useDeviceOrientation';
import { useGeofenceContext } from '../../context/GeofenceContext';
import { ARRenderingEngine } from '../engines/ARRenderingEngine';
import { useARInteractions } from '../../hooks/useARInteractions';
import { debugModeManager } from '../../utils/DebugModeManager';

const SHOW_DEBUG_PANEL = true;

interface ArCameraProps {
  // Core info (for reference/debug only - not used for positioning)
  userPosition?: [number, number]; // Frozen position from ExperienceManager
  experienceType?: string;
  isUniversalMode?: boolean; // 🆕 NEW: Universal mode flag
  
  // Camera and scene callbacks
  onOrientationUpdate?: (orientation: { alpha: number; beta: number; gamma: number }) => void;
  onSceneReady?: (scene: THREE.Scene, camera: THREE.PerspectiveCamera) => void; // 🆕 CHANGED: Just notifies scene ready
  
  // Gesture callbacks (passed through to experiences)
  onModelRotate?: (deltaX: number, deltaY: number, deltaZ?: number) => void;
  onModelScale?: (scaleFactor: number) => void;
  onModelReset?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  
  // System callbacks
  onElevationChanged?: () => void;
  
  // Legacy props (for debug display only)
  anchorPosition?: [number, number]; // Used only for debug display
  anchorElevation?: number; // Deprecated
  coordinateScale?: number; // Deprecated
  
  // 🚫 REMOVED: onArObjectPlaced - no longer calculates position
  // 🚫 REMOVED: sharedARPositioning - no longer needs it
  
  children?: React.ReactNode;
}

const ArCameraComponent: React.FC<ArCameraProps> = ({
  userPosition: frozenUserPosition, // This is the frozen position from ExperienceManager
  experienceType = 'default',
  isUniversalMode = false, // 🆕 NEW: Universal mode flag
  onOrientationUpdate,
  onSceneReady, // 🆕 CHANGED: Just notifies scene ready
  onModelRotate,
  onModelScale,
  onModelReset,
  onSwipeUp,
  onSwipeDown,
  onElevationChanged,
  anchorPosition, // Legacy - only for debug
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
  const [arTestingOverride, setArTestingOverride] = useState(false);
  const [cameraLookDirection, setCameraLookDirection] = useState<{
    vector: THREE.Vector3 | null;
    bearing: number | null;
  }>({
    vector: null,
    bearing: null,
  });

  //******** DEBUG PANEL FUNCTIONS **********
  const handleDebugSwipeUp = useCallback(() => {
    console.log('🔼 Debug panel interaction');
  }, []);

  const handleDebugSwipeDown = useCallback(() => {
    console.log('🔽 Debug panel interaction');
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
    
    // 🆕 CHANGED: Just notify scene is ready, don't calculate position
    if (onSceneReady && renderingEngineRef.current) {
      const scene = renderingEngineRef.current.getScene();
      const camera = renderingEngineRef.current.getCamera();
      if (scene && camera) {
        console.log('📡 AR Camera: Scene ready, notifying ExperienceManager');
        onSceneReady(scene, camera);
      }
    }
    
    if (canvasRef.current && !isListening) {
      attachListeners();
      console.log('✅ AR interactions attached');
    }
              
    setIsInitialized(true);
    console.log('✅ AR Camera initialized (display only)');
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
    
    setCameraLookDirection({
      vector: cameraDirectionVector.current.clone(),
      bearing: normalizedBearing,
    });
  }, []);

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

  // 🚫 REMOVED: AR object placement when system becomes ready
  // useEffect(() => {
  //   if (isInitialized && positioningSystemReady && frozenUserPosition) {
  //     triggerArObjectPlacement();
  //   }
  // }, [isInitialized, positioningSystemReady, frozenUserPosition, triggerArObjectPlacement]);

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
          <div>🎥 Starting AR Camera...</div>
          {isUniversalMode && (
            <div style={{ fontSize: '11px', marginTop: '3px', opacity: 0.7, color: '#90EE90' }}>
              🌐 Universal Mode Active
            </div>
          )}
          <div style={{ fontSize: '14px', marginTop: '10px', opacity: 0.8 }}>
            {!isPermissionGranted(PermissionType.CAMERA) && 'Please allow camera access when prompted'}
            {isPermissionGranted(PermissionType.CAMERA) && !isPermissionGranted(PermissionType.ORIENTATION) && 'Please allow motion sensors for best experience'}
            {isPermissionGranted(PermissionType.CAMERA) && isPermissionGranted(PermissionType.ORIENTATION) && 'Point your camera at your surroundings'}
          </div>
        </div>
      )}
      
      {/* UPDATED Debug Panel - Display Only */}
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
            <span style={{ color: 'yellow' }}>🎥 AR CAMERA (DISPLAY ONLY)</span>
          </div>

          {/* Reference Position Status */}
          <div style={{ 
            marginTop: '5px', 
            paddingTop: '5px', 
            borderTop: '1px solid rgba(255,255,0,0.3)',
            backgroundColor: 'rgba(0,255,0,0.1)' 
          }}>
            <div style={{ color: 'lightgreen', fontSize: '9px' }}>
              <strong>🔒 REFERENCE POSITION (NOT USED FOR AR):</strong>
            </div>
            <div style={{ fontSize: '8px' }}>
              User: {frozenUserPosition ? 
                `[${frozenUserPosition[0].toFixed(8)}, ${frozenUserPosition[1].toFixed(8)}] 📍` : 
                '❌ NOT PROVIDED'
              }
            </div>
            <div style={{ fontSize: '8px' }}>
              Universal Mode: {isUniversalMode ? '✅ ACTIVE' : '❌ DISABLED'}
            </div>
          </div>

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

          {/* Camera & Scene Status */}
          <div style={{ 
            marginTop: '5px', 
            paddingTop: '5px', 
            borderTop: '1px solid rgba(255,255,255,0.3)' 
          }}>
            <div style={{ color: 'lightblue', fontSize: '9px' }}>
              <strong>Camera & Scene Status:</strong>
            </div>
            <div style={{ fontSize: '8px' }}>Camera Ready: {isInitialized ? '✅' : '❌'}</div>
            <div style={{ fontSize: '8px' }}>Engine Ready: {renderingEngineRef.current?.isReady() ? '✅' : '❌'}</div>
            <div style={{ fontSize: '8px' }}>Render Loop: {renderingEngineRef.current?.isRenderingActive() ? '🔄' : '⏸️'}</div>
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
                console.log('🔄 Camera display refreshed');
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
              🔄 Refresh
            </button>
          </div>

          {!debugCollapsed && (
            <div style={{ marginTop: '5px', paddingTop: '5px', borderTop: '1px solid rgba(255,255,255,0.2)' }}>    
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

      {/* 🚫 REMOVED: Bottom debug panel with elevation controls */}
      {/* Elevation controls moved to ExperienceManager */}

      {/* Child components (AR objects will be added here) */}
      {children}
    </div>
  );
};

export default ArCameraComponent;