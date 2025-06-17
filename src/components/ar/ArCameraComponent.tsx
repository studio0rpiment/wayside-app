// src/components/ar/ArCameraComponent.tsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { calculateBearing, gpsToThreeJsPosition } from '../../utils/geoArUtils';
import { usePermissions } from '../../context/PermissionsContext';
import { PermissionType } from '../../utils/permissions';
import { validateTerrainCoverage, getEnhancedAnchorPosition } from '../../utils/geoArUtils'
import EdgeChevrons from './EdgeChevrons';
import { loadHeightmap, testTerrainLookup, gpsToThreeJsPositionWithTerrain } from '../../utils/terrainUtils';
import { getOptimizedRendererSettings, optimizeWebGLRenderer } from '../../utils/systemOptimization';
import { useDeviceOrientation } from '../../hooks/useDeviceOrientation';


const SHOW_DEBUG_PANEL = true;

interface ArCameraProps {
  userPosition: [number, number];
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
  children?: React.ReactNode;
}


const ArCameraComponent: React.FC<ArCameraProps> = ({
  userPosition,
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
  children
}) => {

//********** REFS REFS REFS  */
 
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const touchEndX = useRef(0);
  const touchEndY = useRef(0);
  const lastTapTime = useRef(0);
  const lastTouchX = useRef(0);
  const lastTouchY = useRef(0);
  const initialPinchDistance = useRef(0);
  const initialTwoFingerAngle = useRef(0);
  const previousTwoFingerAngle = useRef(0);
  const lastMultiTouchTime = useRef(0);
  const cameraDirectionVector = useRef(new THREE.Vector3());
  const lastCameraUpdateRef = useRef(0);
  const cameraUpdateIntervalRef = useRef<number | null>(null);

  const lastCameraQuaternionRef = useRef<THREE.Quaternion | null>(null);
  const enableSmoothing = true; // Add this as a configurable option


//******** STATE STATE STATE */

  const [isInitialized, setIsInitialized] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const { 
    heading: deviceHeading,
    deviceOrientation, 
    isAvailable: orientationAvailable,
    error: orientationError,
    getCameraQuaternion  // Get the camera quaternion function
  } = useDeviceOrientation({ 
    enableSmoothing: true,
    debugMode: SHOW_DEBUG_PANEL 
  });

  const [showChevrons, setShowChevrons] = useState(true); //for chevrons may delete
  const [debugHeading, setDebugHeading] = useState<number | null>(null);
  const [compassCalibration, setCompassCalibration] = useState(0); // Manual compass offset
  const [adjustedAnchorPosition, setAdjustedAnchorPosition] = useState<[number, number] | null>(null);
  const [manualElevationOffset, setManualElevationOffset] = useState(0);
//for comparing camera lookat inthe debug
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
//For Offseting in the debug panel
  const [gpsOffset, setGpsOffset] = useState({ lon: 0, lat: 0 }); 
  const [accumulatedTransforms, setAccumulatedTransforms] = useState({
    rotation: { x: 0, y: 0, z: 0 },
    scale: 1.0
  });
  // Debug/testing override state
  const [debugCollapsed, setDebugCollapsed] = useState(false);

  const [arTestingOverride, setArTestingOverride] = useState<boolean>(() => {
    // Initialize from global if available, otherwise false
    return typeof (window as any).arTestingOverride === 'boolean'
      ? (window as any).arTestingOverride
      : false;
  });

//******** DECLARATIONS AND HELPERS */
    // Touch constants
    const minSwipeDistance = 50;
    const doubleTapDelay = 300;
    // Permission handling - use existing system
    const { isPermissionGranted, requestPermission } = usePermissions();
    const activeAnchorPosition = adjustedAnchorPosition || anchorPosition;

    const CAMERA_UPDATE_INTERVAL = 200; 

    const currentExperienceType = experienceType || 'default';
    const experienceOffsets: Record<string, number> = {
      'lotus': 0.5,
      'lily': 0.5,       
      'cattail': 1.0,    
      'mac': 1.8,
      'helen_s': 1.8,    
      'volunteers': 1.8, 
      'default': 2.0
    };

    const typeKey = experienceType ?? 'default';
    const elevationOffset = experienceOffsets[typeKey] || experienceOffsets['default'];
    

    //helper
    const formatWithSign = (num: number, decimals: number = 1, totalWidth: number = 10) => {
      const sign = num >= 0 ? '+' : '';
      return `${sign}${Math.abs(num).toFixed(decimals)}`.padStart(totalWidth, '  ');
    };

    const getCurrentExpectedModelPosition = useCallback((): THREE.Vector3 | null => {
     
      if (!userPosition || !activeAnchorPosition) return null;
      
      const finalElevationOffset = elevationOffset + manualElevationOffset;
      
      // Use the SAME function your experiences use
      const result = gpsToThreeJsPositionWithTerrain(
        userPosition,
        activeAnchorPosition,
        finalElevationOffset,
        coordinateScale
      );
      
      return result.position;
    }, [userPosition, activeAnchorPosition, elevationOffset, manualElevationOffset, coordinateScale]);

  const updateElevationOffset = useCallback((deltaElevation: number) => {
  const newOffset = manualElevationOffset + deltaElevation;
  setManualElevationOffset(newOffset);
    console.log('📏 Manual elevation offset:', newOffset);
  }, [manualElevationOffset]);


    const updateAnchorPosition = useCallback((deltaLon: number, deltaLat: number) => {
  // Update the GPS offset state for display
  const newOffset = {
    lon: gpsOffset.lon + deltaLon,
    lat: gpsOffset.lat + deltaLat
  };
  setGpsOffset(newOffset);


    
  // Calculate new anchor position (use current anchor + total offset)
  const newAnchorPosition: [number, number] = [
    anchorPosition[0] + newOffset.lon,
    anchorPosition[1] + newOffset.lat
  ];
  
  // Store adjusted position locally
  setAdjustedAnchorPosition(newAnchorPosition);
  
  console.log('📍 Anchor moved to:', newAnchorPosition);
  console.log('📍 Total offset:', newOffset);
}, [anchorPosition, gpsOffset]);

  // Initialize camera stream
  const initializeCamera = async () => {
    try {
      // console.log('🎥 Initializing AR camera...');
      
      // Check permissions using existing system
      if (!isPermissionGranted(PermissionType.CAMERA)) {
        throw new Error('Camera permission not granted. Please enable in settings.');
      }
      
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('getUserMedia not supported');
      }
      
      // Request camera with appropriate constraints
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: 'environment', // Use back camera for AR
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
        // console.log('✅ Camera stream initialized');
      }
      
      return true;
    } catch (error) {
      console.error('❌ Camera initialization failed:', error);
      setCameraError('Failed to access camera. Please check permissions.');
      return false;
    }
  };
  
  // Initialize Three.js scene
 const initializeThreeJs = async () => {
  if (!canvasRef.current || !containerRef.current) return false;
  
  console.log('🎨 Initializing Three.js scene...');
  
  // Create scene
  const scene = new THREE.Scene();
  sceneRef.current = scene;

  // Create camera with realistic FOV for mobile AR
    const camera = new THREE.PerspectiveCamera(
      70, // Field of view (typical for mobile cameras)
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.lookAt(0, 0, -1);
    camera.position.set(0, 0, 0); // Camera at origin

  cameraRef.current = camera;
  
  // Create optimized renderer (CHANGED)
  try {
    const rendererSettings = await getOptimizedRendererSettings(canvasRef.current);
    const renderer = new THREE.WebGLRenderer(rendererSettings);
    
    await optimizeWebGLRenderer(renderer);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0); // Fully transparent background
    rendererRef.current = renderer;
    
    console.log('✅ Optimized renderer created');
  } catch (error) {
    console.warn('⚠️ Failed to create optimized renderer, using fallback:', error);
    // Fallback to your original renderer
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      alpha: true,
      antialias: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);
    rendererRef.current = renderer;
  }
  
  // Add basic lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);
  
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(1, 1, 1);
  scene.add(directionalLight);


  if (onSceneReady) {
    onSceneReady(scene, camera);
    console.log('📡 AR scene exposed to parent component');
  }
  
  console.log('✅ Three.js scene initialized with optimizations');
  return true;
};
  
  // Calculate and place AR object
// In ArCameraComponent.tsx, update the placeArObject function:
const placeArObject = useCallback(() => {
  console.log('🎯 placeArObject() called');
  console.log('🎯 onArObjectPlaced exists:', !!onArObjectPlaced);
  

  if (!userPosition || !anchorPosition) {
      console.log('❌ Missing positions - userPosition:', userPosition, 'anchorPosition:', anchorPosition);
      return;
    }

    const finalElevationOffset = elevationOffset + manualElevationOffset;

    const result = gpsToThreeJsPositionWithTerrain(
      userPosition,
      activeAnchorPosition,
      finalElevationOffset,
      coordinateScale
    );

  
  if (onArObjectPlaced) {
    onArObjectPlaced(result.position);
  }

}, [userPosition,anchorPosition, adjustedAnchorPosition, coordinateScale, experienceType, manualElevationOffset]); // Remove onArObjectPlaced from deps
  

// Effect 1: Update camera rotation using quaternions (with debug logging)
useEffect(() => {
  if (!isInitialized || !cameraRef.current) return;
  
  const cameraQuaternion = getCameraQuaternion();
  if (!cameraQuaternion) {
    cameraRef.current.lookAt(0, 0, -1);
    return;
  }
  
  try {
    // Apply quaternion to camera
    cameraRef.current.quaternion.copy(cameraQuaternion);
    
    // COMPENSATE: Apply inverse transformation to maintain model visibility
    // This rotates the camera coordinate system back to match the old system
    const compensation = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(1, 0, 0), 
      Math.PI / 2  // Opposite of the correction in createQuaternionFromDeviceOrientation
    );
    
    cameraRef.current.quaternion.multiplyQuaternions(cameraRef.current.quaternion, compensation);
    
  } catch (error) {
    console.warn('Error updating camera orientation:', error);
    cameraRef.current.lookAt(0, 0, -1);
  }
  
}, [isInitialized, getCameraQuaternion]);

// Effect 2: Update calculations on interval  
useEffect(() => {
  if (!isInitialized || !cameraRef.current) return;
  
  const updateCameraDirection = () => {
    if (!cameraRef.current) return;

    // Get camera world direction
    cameraRef.current.getWorldDirection(cameraDirectionVector.current);
    
    // Convert to compass bearing
    const bearing = Math.atan2(
      cameraDirectionVector.current.x,
      -cameraDirectionVector.current.z
    ) * (180 / Math.PI);

    const normalizedBearing = (bearing + 360) % 360;
    
    // Get expected model position
    const expectedModelPosition = getCurrentExpectedModelPosition();
    
    // Calculate aim error and distance
    let aimError = null;
    let modelDistance = null;
    
    if (expectedModelPosition && cameraRef.current) {
      const cameraPosition = cameraRef.current.position;
      const expectedDirection = expectedModelPosition.clone().sub(cameraPosition).normalize();
      
      const dotProduct = cameraDirectionVector.current.dot(expectedDirection);
      const angleDifference = Math.acos(Math.max(-1, Math.min(1, dotProduct))) * (180 / Math.PI);
      aimError = angleDifference;
      
      modelDistance = cameraPosition.distanceTo(expectedModelPosition);
    }
    
    // Update state
    setCameraLookDirection({
      vector: cameraDirectionVector.current.clone(),
      bearing: normalizedBearing,
      expectedModelPosition,
      aimError,
      modelDistance
    });
  };
  
  // Create interval
  cameraUpdateIntervalRef.current = window.setInterval(updateCameraDirection, 200);
  
  return () => {
    if (cameraUpdateIntervalRef.current) {
      clearInterval(cameraUpdateIntervalRef.current);
    }
  };
}, [isInitialized]); // ← Minimal dependencies, only recreate when component initializes
  
  // Your onOrientationUpdate callback still works:
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

  const getDeviceHeading = (): number | null => {
    // Use debug override if set
    if (debugHeading !== null) {
      return debugHeading;
    }
    
    // Return heading from hook (already normalized to 0-360)
    return deviceHeading;
  };

  // Animation loop
  const animate = () => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;
    
    // Render the Three.js scene over the camera stream
    rendererRef.current.render(sceneRef.current, cameraRef.current);
    
    requestAnimationFrame(animate);
  };
  
  // Handle window resize
  const handleResize = () => {
    if (!cameraRef.current || !rendererRef.current) return;
    
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    cameraRef.current.aspect = width / height;
    cameraRef.current.updateProjectionMatrix();
    
    rendererRef.current.setSize(width, height);
  };
  
  // Initialize everything
  useEffect(() => {
    const initialize = async () => {
      // console.log('🚀 Starting AR Camera initialization...');
      
      // Check and request camera permission if needed
      if (!isPermissionGranted(PermissionType.CAMERA)) {
        // console.log('📸 Camera permission not granted, requesting...');
        const cameraGranted = await requestPermission(PermissionType.CAMERA);
        if (!cameraGranted) {
          setCameraError('Camera permission required for AR experience. Please allow camera access when prompted.');
          return;
        }
      }
      
      // Check and request orientation permission if needed
      if (!isPermissionGranted(PermissionType.ORIENTATION)) {
        // console.log('📱 Orientation permission not granted, requesting...');
        await requestPermission(PermissionType.ORIENTATION);
        // Don't fail if orientation is denied - AR can work without it
      }
      
      // Initialize camera stream
      const cameraInitialized = await initializeCamera();
      if (!cameraInitialized) return;
      
      // Initialize Three.js
      const threeInitialized = await initializeThreeJs();
      if (!threeInitialized) return;
      
      // Setup orientation listener if permission is granted
      if (isPermissionGranted(PermissionType.ORIENTATION)) {
        // console.log('📱 Device orientation tracking enabled');
      } else {
        console.warn('⚠️ Device orientation not available or permission denied');
      }

          // Load terrain data
    // console.log('🗺️ Loading terrain data...');
    const terrainLoaded = await loadHeightmap();
    
    if (terrainLoaded) {
      // console.log('✅ Terrain system ready');
      
      // Test terrain coverage for your anchors (development only)
      if (process.env.NODE_ENV === 'development') {
        testTerrainLookup();
      }
    } else {
      console.warn('⚠️ Terrain system failed to load, using fallback positioning');
    }
      
       
        
      // Place AR object
      placeArObject();
      
      // Start animation loop
      animate();

      // Right before setIsInitialized(true)
      if (canvasRef.current) {
        canvasRef.current.addEventListener('touchstart', handleTouchStart, { passive: false });
        canvasRef.current.addEventListener('touchmove', handleTouchMove, { passive: false });
        canvasRef.current.addEventListener('touchend', handleTouchEnd, { passive: false });
        // console.log('✅ Touch events attached to canvas');
      } else {
        console.error('❌ Canvas ref is null, cannot attach touch events');
      }
            
      
      setIsInitialized(true);
      // console.log('✅ AR Camera fully initialized');
    };
    
    initialize();

    // Add these touch handlers in ArCameraComponent
// Updated touch handlers:
  const handleTouchStart = (event: TouchEvent) => {
    const now = new Date().getTime();
    const timeSince = now - lastTapTime.current;
    const timeSinceMultiTouch = now - lastMultiTouchTime.current;

    if (event.touches.length === 1) {
      // Store positions first
      touchStartX.current = event.touches[0].clientX;
      touchStartY.current = event.touches[0].clientY;
      lastTouchX.current = event.touches[0].clientX;
      lastTouchY.current = event.touches[0].clientY;

      // Check for double-tap FIRST (before cooldown check)
      if (timeSince < doubleTapDelay && timeSince > 0) {
        // Double-tap detected - this takes priority over cooldown
        console.log('👆 Double tap detected - reset');
        setAccumulatedTransforms({
          rotation: { x: 0, y: 0, z: 0 },
          scale: 1.0
        });

        if (onModelReset) {
          onModelReset();
        }
        event.preventDefault();
        lastTapTime.current = 0;
        return; // Exit early - don't check cooldown
      }

      // ONLY apply cooldown for non-double-tap single touches
      if (timeSinceMultiTouch < 200) {
        console.log('🚫 Ignoring single finger - just ended multi-touch');
        return;
      }

      // Regular single tap
      lastTapTime.current = now;
      
    } else if (event.touches.length === 2) {
      // Clear any pending double-tap when two fingers detected
      lastTapTime.current = 0;
      
      // Two finger setup...
      const touch1 = event.touches[0];
      const touch2 = event.touches[1];
      const fingerDistance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      
      const MIN_TWO_FINGER_DISTANCE = 100;
      
      if (fingerDistance > MIN_TWO_FINGER_DISTANCE) {
        console.log(`🤲 Two fingers detected ${fingerDistance.toFixed(0)}px apart`);
      }
      
      initialPinchDistance.current = fingerDistance;
      initialTwoFingerAngle.current = Math.atan2(
        touch2.clientY - touch1.clientY, touch2.clientX - touch1.clientX
      );
      previousTwoFingerAngle.current = initialTwoFingerAngle.current;

    } else {
      // More than 2 fingers: clear tap detection
      lastTapTime.current = 0;
    }

  };
  
  const handleTouchMove = (event: TouchEvent) => {
    if (event.touches.length === 1) {
      // ADD THIS: Check if we just ended multi-touch
      const now = new Date().getTime();
      const timeSinceMultiTouch = now - lastMultiTouchTime.current;
      
      if (timeSinceMultiTouch < 200) {
        console.log('🚫 Ignoring single finger move - just ended multi-touch');
        return;
      }

      // Single finger drag: rotate model
      const currentX = event.touches[0].clientX;
      const currentY = event.touches[0].clientY;
      
      const deltaX = currentX - lastTouchX.current;
      const deltaY = currentY - lastTouchY.current;

      // Only rotate if significant movement
      if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
        const rotDeltaX = deltaX * 0.01;
        const rotDeltaY = deltaY * 0.01;
        
        // Update accumulated rotation
        setAccumulatedTransforms(prev => ({
          ...prev,
          rotation: {
            x: prev.rotation.x + rotDeltaY,
            y: prev.rotation.y + rotDeltaX,
            z: prev.rotation.z
          }
        }));

        if (onModelRotate) {
          onModelRotate(rotDeltaX, rotDeltaY, 0);
        }
      }
      
      lastTouchX.current = currentX;
      lastTouchY.current = currentY;
      
    } else if (event.touches.length === 2) {
      // Two finger Z-rotation (stays the same)...
      const touch1 = event.touches[0];
      const touch2 = event.touches[1];
      
      const currentAngle = Math.atan2(
        touch2.clientY - touch1.clientY, 
        touch2.clientX - touch1.clientX
      );
      
      const rotationDelta = currentAngle - previousTwoFingerAngle.current;
      
      if (onModelRotate && Math.abs(rotationDelta) > 0.02) {
        const zRotDelta = rotationDelta * 0.5;
        
        setAccumulatedTransforms(prev => {
          const newZRotation = prev.rotation.z + zRotDelta;
          const limitedZRotation = Math.max(-Math.PI, Math.min(Math.PI, newZRotation));
          
          if (limitedZRotation !== prev.rotation.z) {
            const actualDelta = limitedZRotation - prev.rotation.z;
            onModelRotate(0, 0, actualDelta);
            
            return {
              ...prev,
              rotation: {
                ...prev.rotation,
                z: limitedZRotation
              }
            };
          }
          
          return prev;
        });
      }
      
      previousTwoFingerAngle.current = currentAngle;
    }
    
    event.preventDefault();
  };

    const handleTouchEnd = (event: TouchEvent) => {
      // Track when multi-touch gestures end
      if (event.touches.length === 0) {
        // All fingers lifted
        lastMultiTouchTime.current = new Date().getTime();
        console.log('👆 All touches ended');
      } else if (event.touches.length === 1) {
        // Went from multi-touch to single touch
        lastMultiTouchTime.current = new Date().getTime();
        console.log('👆 Multi-touch ended, one finger remains');
      }
    };

    // Add resize listener
    window.addEventListener('resize', handleResize);
    
    // Cleanup function
    return () => {
      // Stop camera stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      
      // Remove event listeners
      window.removeEventListener('resize', handleResize);
      if (canvasRef.current) {
        canvasRef.current.removeEventListener('touchstart', handleTouchStart);
        canvasRef.current.removeEventListener('touchmove', handleTouchMove);
        canvasRef.current.removeEventListener('touchend', handleTouchEnd);
      }
            
      // Cleanup Three.js
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
      
      // console.log('🧹 AR Camera cleaned up');
    };
  }, []); // Remove permission dependency to avoid loops
  


  // Update AR object position when GPS coordinates change
  useEffect(() => {
    if (isInitialized) {
      placeArObject();
    }
  }, [userPosition, anchorPosition, adjustedAnchorPosition, coordinateScale, isInitialized]);


  
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
      {/* Semi-transparent background for lily experience */}
        {(experienceType === 'lily' || experienceType === 'lotus' || experienceType === 'cattail' || experienceType === '1968') && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.7)', // Light blue water tint
            zIndex: 1015,
            pointerEvents: 'none' // Allows AR interactions to pass through
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

      {/* {showChevrons && userPosition && anchorPosition && (
        <EdgeChevrons
          userPosition={userPosition}
          anchorPosition={anchorPosition}
          deviceHeading={getDeviceHeading()}
          isVisible={showChevrons}
        />
        )} */}
      
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
                // Retry initialization
                window.location.reload(); // Simple approach - restart the component
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

            {/* Loading indicator - show permission request instead of error */}
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
      
          {/* Minimal Debug Panel */}
     
         {SHOW_DEBUG_PANEL && (
              <div style={{
                position: 'absolute',
                top: '1vh',
                left: '1vw',
                right: '40vw',
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                color: 'white',
                padding: '10px',
                borderRadius: '4px',
                fontSize: '10px',
                zIndex: 1030,
                pointerEvents: 'auto',
                fontFamily: 'monospace'
              }}>
               {/* Collapsible header */}
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
              </div>

               {!debugCollapsed && (
              <div>    
                <div>User: [{userPosition[0].toFixed(6)}, {userPosition[1].toFixed(6)}]</div>
                <div>Anchor: [{activeAnchorPosition[0].toFixed(6)}, {activeAnchorPosition[1].toFixed(6)}]</div>  
                          
                <div >
                  GPS Bearing: {calculateBearing(userPosition, anchorPosition).toFixed(1)}°
                </div>
         
                <div>
                  <span style={{ color: 'cyan' }}>Device Heading: {deviceHeading?.toFixed(1) ?? 'N/A'}°</span>
                  <span style={{ color: 'white' }}> | Available: {orientationAvailable ? '✅' : '❌'}</span>
                </div>

                

                {/* NEW: Model targeting validation */}
              
    
                  {orientationError && 
                    <div style={{color: 'red'}}> Orient Error: {orientationError} </div>}


                <div style={{ 
                    display: 'flex', 
                    flexDirection: 'row' ,
                    gap: '8px'
                  }}>
                  <div 
                    onClick={() => {
                      const newValue = !arTestingOverride;
                      (window as any).arTestingOverride = newValue;
                      setArTestingOverride(newValue);
                      // console.log('🎯 AR Override:', newValue ? 'ON' : 'OFF');
                    }}
                    style={{ cursor: 'pointer', 
                      userSelect: 'none', 
                      margin: '0rem', 
                      padding: '4px 8px',
                      backgroundColor: 'rgba(0,0,255,0.3)',
                       marginTop: '8px',
                      // border: '1px solid white', 
                      width: '100%' }}
                  >
                    Override: {arTestingOverride ? '✅' : '❌'}
                  </div>
                      <button
                          onClick={() => {
                            setGpsOffset({ lon: 0, lat: 0 });
                            setManualElevationOffset(0);
                            setAdjustedAnchorPosition(null);
                            console.log('🔄 GPS and elevation offsets reset');
                          }}
                          style={{
                            fontSize: '10px',
                            padding: '4px 8px',
                            backgroundColor: 'rgba(255,0,0,0.3)',
                            border: 'none',
                            color: 'white',
                            cursor: 'pointer',
                            width: '100%',
                            marginTop: '8px'
                          }}
                      >
                    Reset Calibration
                  </button>
                </div>

                <div style={{ marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.3)', paddingTop: '5px' }}>
                <div style={{ color: 'yellow', fontSize: '10px' }}>🎯 AR OBJECT DEBUG</div>
                <div style={{ fontSize: '9px' }}>
                  onArObjectPlaced called: {!!onArObjectPlaced ? 'YES' : 'NO'}
                </div>
                <div style={{ fontSize: '9px' }}>
                  User position: {userPosition ? `[${userPosition[0].toFixed(6)}, ${userPosition[1].toFixed(6)}]` : 'NULL'}
                </div>
                <div style={{ fontSize: '9px' }}>
                  Anchor position: {anchorPosition ? `[${anchorPosition[0].toFixed(6)}, ${anchorPosition[1].toFixed(6)}]` : 'NULL'}
                </div>
              </div>
              </div>)}
            </div>
            
              
            )}
                  

      
      {SHOW_DEBUG_PANEL && isInitialized && (
        <div style={{
          position: 'absolute',
          bottom: experienceType === '2030-2105' ? '11svh' : '2svh',
          left: '50%',
          width: '90vw',
          transform: 'translateX(-50%)',
          backgroundColor: 'rgba(0, 0, 0, 0)',
          backdropFilter: 'blur(20px)',
          color: 'white',
          padding: '0',
          borderRadius: '1rem',
          fontSize: '0.8rem',
          fontFamily: 'monospace',
          
          zIndex: 1025,
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '10px', color: 'yellow' }}>🎯 MODEL TRANSFORMS</div>
     
          <div>Rot: X:{formatWithSign(accumulatedTransforms.rotation.x * 180/Math.PI)}° Y:{formatWithSign(accumulatedTransforms.rotation.y * 180/Math.PI)}° Z:{formatWithSign(accumulatedTransforms.rotation.z * 180/Math.PI)}° (±180°)</div>
          {/* <div>Scale: {formatWithSign(accumulatedTransforms.scale, 2)}</div> */}
          <div style={{ marginTop: '5px', borderTop: '1px solid rgba(255,255,255,0.3)', paddingTop: '2px' }}></div>
        {deviceOrientation ? (
          <>
            <div style={{ display: 'flex',  justifyContent: 'center', gap: '10px' }}>
              <div>Raw Alpha: {deviceOrientation.alpha?.toFixed(1)}</div>
              <div>Raw Beta: {deviceOrientation.beta?.toFixed(1)}</div>
                  <div>Absolute: {deviceOrientation.absolute ? 'Yes' : 'No'}</div>
                  <div>WebKit: {(deviceOrientation as any).webkitCompassHeading?.toFixed(1) ?? 'N/A'}</div>
                  <div>Hook Heading: {deviceHeading?.toFixed(1) ?? 'N/A'}</div>
                  <div>Platform: {/iPad|iPhone|iPod/.test(navigator.userAgent) ? 'iOS' : 'Android/Other'}</div>

            </div>
          </>
        ) : (
          <div>Orientation: Desktop</div>
        )}

          <div style = {{fontSize: '0.5rem'}}>
            <span style={{ color: 'yellow'  }}>Camera Lookat: {cameraLookDirection.bearing?.toFixed(1) ?? 'N/A'}°</span>
              <span> Aim Error: </span>
                <span style={{ 
                  color: 'yellow'
                }}>
                  {cameraLookDirection.aimError !== null ? `${cameraLookDirection.aimError.toFixed(1)}°` : 'N/A'}
                </span>
          </div>
           {cameraLookDirection.expectedModelPosition ? (
            <>
              <div style={{ fontSize: '0.5rem' }}>
                Model Position: [{cameraLookDirection.expectedModelPosition.x.toFixed(1)}, {cameraLookDirection.expectedModelPosition.y.toFixed(1)}, {cameraLookDirection.expectedModelPosition.z.toFixed(1)}] | Distance: {cameraLookDirection.modelDistance?.toFixed(1)}m
              </div>

         {cameraLookDirection.aimError !== null && (
            <div style={{ fontSize: '0.8rem', opacity: 1, color: 'yellow' }}>
              {(() => {
                if (cameraLookDirection.aimError < 2) {
                  return '⮕⮕ RIGHT THERE ⬅⬅';
                 } else {
                  // Calculate which direction to turn
                  const gpsToAnchor = calculateBearing(userPosition, activeAnchorPosition);
                  const currentLooking = cameraLookDirection.bearing || 0;
                  
                  let turnDirection = gpsToAnchor - currentLooking;
                  
                  // Handle wraparound (e.g., 350° to 10°)
                  if (turnDirection > 180) turnDirection -= 360;
                  if (turnDirection < -180) turnDirection += 360;
                  
                  const turnAmount = Math.abs(turnDirection).toFixed(0);
                       if (cameraLookDirection.aimError < 10) {
                        return turnDirection > 0 
                          ? `→  Close - turn RIGHT ${turnAmount}° →` 
                          : `← Close - turn LEFT ${turnAmount}° ←`
                        } else if (cameraLookDirection.aimError < 30) {
                          return turnDirection > 0 
                            ? `⮕ TURN RIGHT ${turnAmount}° ⮕` 
                            : `⬅ TURN LEFT ${turnAmount}° ⬅`;
                        } else {
                          return turnDirection > 0 
                            ? `⮕⮕ TURN RIGHT ${turnAmount}° ⮕⮕` 
                            : `⬅⬅ TURN LEFT ${turnAmount}° ⬅⬅`;
                        }
                }
              })
              ()}
            </div>
          )}
            
            </>
          ) : (
            <div style={{ fontSize: '9px', opacity: 0.6 }}>No position calculated</div>
          )}


        <div style={{ marginTop: '5px', borderTop: '1px solid rgba(255,255,255,0.3)', paddingTop: '2px' }}>
        <div style={{ color: 'yellow', fontSize: '0.7rem' }}>USE BUTTONS TO MOVE ANCHOR: [{(adjustedAnchorPosition || anchorPosition)[0].toFixed(6)}, {(adjustedAnchorPosition || anchorPosition)[1].toFixed(6)}]</div>

        {(() => {
          const buttonStyle = {
            fontSize: '20px',
            padding: '4px 12px',
            backgroundColor: 'rgba(255,255,255,0.2)',
            border: 'none',
            borderRadius: '0.5rem',
            color: 'white',
            cursor: 'pointer'
          };
          
          return (
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '2px', margin: '0.5rem' }}>
              <button onClick={() => updateAnchorPosition(-0.00001, 0)} style={buttonStyle}>WEST</button>
              <button onClick={() => updateAnchorPosition(0.00001, 0)} style={buttonStyle}>EAST</button>
              <button onClick={() => updateAnchorPosition(0, 0.00001)} style={buttonStyle}>NORTH</button>
              <button onClick={() => updateAnchorPosition(0, -0.00001)} style={buttonStyle}>SOUTH</button>
            </div>
          );
        })()}
        {/* ELEVATION */}
        <div style={{ marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.3)', paddingTop: '5px' }}>
          <div style={{ color: 'yellow', fontSize: '10px' }}>ELEVATION:  {((experienceOffsets[experienceType ?? 'default'] || experienceOffsets['default']) + manualElevationOffset).toFixed(3)}m, offset: {manualElevationOffset.toFixed(3)}m</div>
          
          {(() => {
            const elevButtonStyle = {
            fontSize: '20px',
            padding: '4px 12px',
            backgroundColor: 'rgba(255,255,255,0.2)',
            border: 'none',
            borderRadius: '0.5rem',
            color: 'white',
            cursor: 'pointer'
            };
            
            return (
              <div style={{  display: 'flex', justifyContent: 'space-between', gap: '2px', margin: '0.5rem'  }}>
                <button onClick={() => updateElevationOffset(-0.1)} style={elevButtonStyle}>-0.1m</button>
                <button onClick={() => updateElevationOffset(-0.01)} style={elevButtonStyle}>-1cm</button>
                <button onClick={() => updateElevationOffset(0.01)} style={elevButtonStyle}>+1cm</button>
                <button onClick={() => updateElevationOffset(0.1)} style={elevButtonStyle}>+0.1m</button>
              </div>
            );
          })()}
        </div>

       
      </div>
    </div>
        
   )}

      
      
      {/* Child components (AR objects will be added here) */}
      {children}
    </div>
  );
};

export default ArCameraComponent;


