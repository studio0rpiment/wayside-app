// src/components/ar/ArCameraComponent.tsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { calculateBearing, gpsToThreeJsPosition } from '../../utils/geoArUtils';
import { usePermissions } from '../../context/PermissionsContext';
import { PermissionType } from '../../utils/permissions';
import { validateTerrainCoverage, getEnhancedAnchorPosition } from '../../utils/geoArUtils'
import EdgeChevrons from './EdgeChevrons';

import GroundPlaneDetector, { GroundPlaneDetectorRef, GroundPlaneResult } from './GroundPlaneDetector';
import GroundPlaneTestUI from './GroundPlaneTestUI';

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
  const [manualScaleOffset, setManualScaleOffset] = useState(1.0); // Start at 1.0 (normal scale)
  const swipeStartY = useRef(0);
  const swipeStartTime = useRef(0);

  



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
  const [isBottomDebugCollapsed, setIsBottomDebugCollapsed] = useState(false);


  const [arTestingOverride, setArTestingOverride] = useState<boolean>(() => {
    // Initialize from global if available, otherwise false
    return typeof (window as any).arTestingOverride === 'boolean'
      ? (window as any).arTestingOverride
      : false;
  });

  const [showGroundPlaneTest, setShowGroundPlaneTest] = useState(false);
const groundPlaneDetectorRef = useRef<GroundPlaneDetectorRef>(null);


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
      'lotus': -1.8,
      'lily': -1.8,       
      'cattail': -1.80,    
      'mac': -1.8,
      'helen_s': -1.8,    
      'volunteers': -1.8, 
      '2030-2105': -2,  // Water rise starts at water surface
      '1968': 0,        // Smoke high above (was 10.0, now 8.2 relative to ground)
      '2200_bc': -1.6, 
      'default': 0
    };

    const typeKey = experienceType ?? 'default';
    const elevationOffset = experienceOffsets[typeKey] || experienceOffsets['default'];
    

    //helper
    const formatWithSign = (num: number, decimals: number = 1, totalWidth: number = 10) => {
      const sign = num >= 0 ? '+' : '';
      return `${sign}${Math.abs(num).toFixed(decimals)}`.padStart(totalWidth, '  ');
    };
//*****ADDING FOR SCREEN ROTATION TO LANDSCAPE */
    const getScreenOrientationCompensation = (): number => {
      // Get current screen orientation
      let screenOrientation = 0;
      
      if (screen && screen.orientation) {
        screenOrientation = screen.orientation.angle;
      } else if (window.orientation !== undefined) {
        screenOrientation = window.orientation;
      }
      
      // Convert to radians and return negative to compensate
      return -screenOrientation * (Math.PI / 180);
    }
//********FOR GROUND PLANE DETECTION  ******* */
const handleGroundPlaneDetected = useCallback((result: GroundPlaneResult) => {
  console.log('🌍 Ground plane detected in ArCamera:', result);
  
  // Here you could update your experience offsets based on detected ground
  // setDetectedGroundLevel(-result.distance);
}, []);

// Add these functions for the UI
const toggleGroundPlaneTest = useCallback(() => {
  setShowGroundPlaneTest(!showGroundPlaneTest);
}, [showGroundPlaneTest]);

const detectGroundNow = useCallback(() => {
  if (groundPlaneDetectorRef.current?.detectNow) {
    groundPlaneDetectorRef.current.detectNow();
  }
}, []);

const handleGroundAdjustment = useCallback((deltaOffset: number) => {
  console.log('🌍 ArCamera: handleGroundAdjustment called with:', deltaOffset);
  if (groundPlaneDetectorRef.current?.adjustGroundOffset) {
    groundPlaneDetectorRef.current.adjustGroundOffset(deltaOffset);
  } else {
    console.warn('❌ adjustGroundOffset method not available');
  }
}, []);

const handleGroundReset = useCallback(() => {
  console.log('🌍 ArCamera: handleGroundReset called');
  if (groundPlaneDetectorRef.current?.setManualGroundOffset) {
    groundPlaneDetectorRef.current.setManualGroundOffset(0);
  } else {
    console.warn('❌ setManualGroundOffset method not available');
  }
}, []);
const handleCameraCheck = useCallback(() => {
  const detector = groundPlaneDetectorRef.current;
  if (detector && 'checkCameraReadiness' in detector) {
    const readiness = (detector as any).checkCameraReadiness();
    console.log('📹 Camera Readiness:', readiness);
  } else {
    console.log('❌ checkCameraReadiness method not found');
  }
}, []);



//******************* SWIPES FOR DEBUG PANEL */
    const handleSwipeStart = (event: React.TouchEvent<HTMLDivElement>) => {
      swipeStartY.current = event.touches[0].clientY;
      swipeStartTime.current = Date.now();
    };

    const handleSwipeMove = (event: React.TouchEvent<HTMLDivElement>) => {
      // Prevent scrolling while swiping on debug panel
      event.preventDefault();
    };

    const handleSwipeEnd = (event: React.TouchEvent<HTMLDivElement>) => {
      const swipeEndY = event.changedTouches[0].clientY;
      const swipeDistance = swipeEndY - swipeStartY.current;
      const swipeTime = Date.now() - swipeStartTime.current;
      
      const MIN_SWIPE_DISTANCE = 50; // Minimum pixels for swipe
      const MAX_SWIPE_TIME = 500; // Maximum time for swipe (ms)
      
      // Check for valid swipe gesture
      if (swipeTime < MAX_SWIPE_TIME) {
        if (swipeDistance > MIN_SWIPE_DISTANCE) {
          // Swipe down - collapse panel
          setIsBottomDebugCollapsed(true);
          console.log('🔽 Debug panel collapsed');
        } else if (swipeDistance < -MIN_SWIPE_DISTANCE) {
          // Swipe up - expand panel
          setIsBottomDebugCollapsed(false);
          console.log('🔼 Debug panel expanded');
        }
      }
    };

    const getCurrentExpectedModelPosition = useCallback((): THREE.Vector3 | null => {
      if (!userPosition || !activeAnchorPosition) return null;
      
      const finalElevationOffset = elevationOffset + manualElevationOffset;
      // Use the SAME function your experiences use
      const position = gpsToThreeJsPosition(
        userPosition,
        activeAnchorPosition,
        finalElevationOffset,
        coordinateScale
      );
      
      return position;
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

  const updateScaleOffset = useCallback((deltaScale: number) => {
    const newScale = Math.max(0.1, Math.min(8.0, manualScaleOffset + deltaScale)); // Minimum 0.1, maximum 5.0

    setManualScaleOffset(newScale);
    
    // Update accumulated transforms to show in debug
    setAccumulatedTransforms(prev => ({
      ...prev,
      scale: newScale
    }));
    
    // Call the model scale callback if available
    if (onModelScale) {
      onModelScale(newScale);
    }
    
    console.log('📏 Manual scale:', newScale);
  }, [manualScaleOffset, onModelScale]);

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

    const position = gpsToThreeJsPosition(
      userPosition,
      activeAnchorPosition,
      finalElevationOffset,
      coordinateScale
    );

  if (onArObjectPlaced) {
    onArObjectPlaced(position);
  }

}, [userPosition, anchorPosition, adjustedAnchorPosition, coordinateScale, manualElevationOffset, elevationOffset, experienceType]);
  
//***********Effect 1: Update camera rotation using quaternions (with debug logging)
    useEffect(() => {
      if (!isInitialized || !cameraRef.current) return;
      
      const cameraQuaternion = getCameraQuaternion();
      if (!cameraQuaternion) {
        cameraRef.current.lookAt(0, 0, -1);
        return;
      }
      
      try {
        // Apply quaternion from hook
        cameraRef.current.quaternion.copy(cameraQuaternion);
        
        // Fix Y-axis (beta) - keep this since it's working
        const betaCorrection = new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(1, 0, 0), 
          Math.PI / 2  // +90° for correct Y-axis
        );
        
        // Fix upside down (rotate around Z-axis)
        const flipUpDown = new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(0, 0, 1), 
          Math.PI  // 180° flip around Z
        );
        
        // Fix 180° rotation in X-Z plane (rotate around Y-axis)
        const flipXZ = new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(0, 1, 0), 
          Math.PI  // 180° flip around Y
        );

        // Compensate for screen orientation to keep world coordinates fixed
        const screenCompensation = new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(0, 0, 1), 
          getScreenOrientationCompensation()
        );
        
        // Apply all corrections in order
        let finalQuaternion = cameraRef.current.quaternion.clone();
        finalQuaternion.multiply(betaCorrection);  // Fix Y-axis first
        finalQuaternion.multiply(flipUpDown);      // Fix upside down
        finalQuaternion.multiply(flipXZ);          // Fix X-Z rotation
        finalQuaternion.multiply(screenCompensation); //Cancel screen rotation

        
        cameraRef.current.quaternion.copy(finalQuaternion);
        
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
    }, [isInitialized, activeAnchorPosition, manualElevationOffset, coordinateScale, experienceType]);
      
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

//************************************** */ Updated touch handlers:
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


    
//********************* */ Cleanup function
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
}, [userPosition, anchorPosition, adjustedAnchorPosition, coordinateScale, isInitialized, manualElevationOffset]);


  
  // function handleSwipeStart(event: React.TouchEvent<HTMLDivElement>): void {
  //   throw new Error('Function not implemented.');
  // }

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

      {/* <GroundPlaneDetector
        videoElement={videoRef.current}
        deviceOrientation={deviceOrientation}
        scene={sceneRef.current}
        isTestMode={showGroundPlaneTest}
        onGroundPlaneDetected={handleGroundPlaneDetected}
        ref={groundPlaneDetectorRef}
      /> */}

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
      
{/* *************  TOP Debug Panel */}
     
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
                <div>User: [{userPosition[0].toFixed(10)}, {userPosition[1].toFixed(10)}]</div>
                <div>Anchor: [{activeAnchorPosition[0].toFixed(10)}, {activeAnchorPosition[1].toFixed(10)}]</div>  
                          
                <div >
                  GPS Bearing: {calculateBearing(userPosition, anchorPosition).toFixed(1)}°
                </div>
         
                <div>
                  <span style={{ color: 'cyan' }}>Device Heading: {deviceHeading?.toFixed(1) ?? 'N/A'}°</span>
                  <span style={{ color: 'white' }}> | Available: {orientationAvailable ? '✅' : '❌'}</span>
                </div>

                  {orientationError && 
                    <div style={{color: 'red'}}> Orient Error: {orientationError} </div>}
                    // Add this button in your debug panel, maybe near the ground plane test UI:

{/* <button
  onClick={() => {
    if (groundPlaneDetectorRef.current?.checkCameraReadiness) {
      const readiness = groundPlaneDetectorRef.current.checkCameraReadiness();
      console.log('📹 Camera Readiness Check:', readiness);
      // You could show this in a debug section too
    }
  }}
  style={{
    fontSize: '10px',
    padding: '4px 8px',
    backgroundColor: 'rgba(100,100,255,0.3)',
    border: 'none',
    color: 'white',
    cursor: 'pointer'
  }}
>
  📹 Check Camera
</button> */}
                  {/* <div>
                  <GroundPlaneTestUI
                        isTestMode={showGroundPlaneTest}
                        onToggleTestMode={toggleGroundPlaneTest}
                        onDetectNow={detectGroundNow}
                        onAdjustGround={handleGroundAdjustment}
                        onResetGround={handleGroundReset}
                        onCheckCamera={handleCameraCheck}  // NEW
                        currentOffset={groundPlaneDetectorRef.current?.getCurrentOffset?.() || 0}
                        lastResult={groundPlaneDetectorRef.current?.lastResult || null}
                      />
                    </div> */}

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
              </div>)}
            </div>
            
              
            )}
                  

//* *******LOWER DEBUG PANEL ******************** */ 
     {SHOW_DEBUG_PANEL && isInitialized && (
      <div 
        style={{
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
        }}
        onTouchStart={handleSwipeStart}
        onTouchMove={handleSwipeMove}
        onTouchEnd={handleSwipeEnd}
      >
        {/* Always visible: Title */}
        <div style={{ fontSize: '10px', color: 'yellow' }}>🎯 MODEL TRANSFORMS</div>
        
        {/* Always visible: Rotation values */}
        <div>
          Rot: X:{formatWithSign(accumulatedTransforms.rotation.x * 180/Math.PI)}° Y:{formatWithSign(accumulatedTransforms.rotation.y * 180/Math.PI)}° Z:{formatWithSign(accumulatedTransforms.rotation.z * 180/Math.PI)}° (±180°)
        </div>
    
    {/* Collapsible content */}
    {!isBottomDebugCollapsed ? (
      <>
        <div style={{ marginTop: '5px', borderTop: '1px solid rgba(255,255,255,0.3)', paddingTop: '2px' }}></div>
        
        {/* Device orientation section */}
        {deviceOrientation ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
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

        {/* Camera direction section */}
        <div style={{ fontSize: '0.5rem' }}>
          <span style={{ color: 'yellow' }}>Camera Lookat: {cameraLookDirection.bearing?.toFixed(1) ?? 'N/A'}°</span>
          <span> Aim Error: </span>
          <span style={{ color: 'yellow' }}>
            {cameraLookDirection.aimError !== null ? `${cameraLookDirection.aimError.toFixed(1)}°` : 'N/A'}
          </span>
        </div>

        {/* Model position section */}
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
                })()}
              </div>
            )}
          </>
        ) : (
          <div style={{ fontSize: '9px', opacity: 0.6 }}>No position calculated</div>
        )}

        {/* GPS calibration section */}
        <div style={{ marginTop: '5px', borderTop: '1px solid rgba(255,255,255,0.3)', paddingTop: '2px' }}>
          <div style={{ color: 'yellow', fontSize: '0.7rem' }}>
            USE BUTTONS TO MOVE ANCHOR: [{(adjustedAnchorPosition || anchorPosition)[0].toFixed(6)}, {(adjustedAnchorPosition || anchorPosition)[1].toFixed(6)}]
          </div>

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
        </div>

        {/* Elevation section */}
        <div style={{ marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.3)', paddingTop: '5px' }}>
          <div style={{ color: 'yellow', fontSize: '10px' }}>
            ELEVATION: {((experienceOffsets[experienceType ?? 'default'] || experienceOffsets['default']) + manualElevationOffset).toFixed(3)}m, offset: {manualElevationOffset.toFixed(3)}m
          </div>
          
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
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '2px', margin: '0.5rem' }}>
                <button onClick={() => updateElevationOffset(-0.1)} style={elevButtonStyle}>-0.1m</button>
                <button onClick={() => updateElevationOffset(-0.01)} style={elevButtonStyle}>-1cm</button>
                <button onClick={() => updateElevationOffset(0.01)} style={elevButtonStyle}>+1cm</button>
                <button onClick={() => updateElevationOffset(0.1)} style={elevButtonStyle}>+0.1m</button>
              </div>
            );
          })()}
        </div>

        {/* Scale section */}
        <div style={{ marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.3)', paddingTop: '5px', paddingRight: '5px' }}>
          <div style={{ color: 'yellow', fontSize: '10px' }}>SCALE: {manualScaleOffset.toFixed(1)}x</div>
          
          {(() => {
            const scaleButtonStyle = {
              fontSize: '12px',
              padding: '4px 12px',
              backgroundColor: 'rgba(255,255,255,0.2)',
              border: 'none',
              borderRadius: '0.5rem',
              color: 'white',
              cursor: 'pointer'
            };
            
            return (
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '2px', margin: '0.5rem' }}>
                <button onClick={() => updateScaleOffset(-0.2)} style={scaleButtonStyle}>-0.2</button>
                <button onClick={() => updateScaleOffset(-0.05)} style={scaleButtonStyle}>-0.05</button>
                <button onClick={() => {
                  setManualScaleOffset(1.0);
                  setAccumulatedTransforms(prev => ({
                    ...prev,
                    scale: 1.0
                  }));
                  
                  if (onModelScale) {
                    onModelScale(1.0);
                  }
                  
                  if (onModelReset) {
                    onModelReset();
                  }
                  
                  console.log('🔄 Scale reset to 1.0');
                }} style={scaleButtonStyle}>1.0</button>
                <button onClick={() => updateScaleOffset(0.05)} style={scaleButtonStyle}>+0.05</button>
                <button onClick={() => updateScaleOffset(0.2)} style={scaleButtonStyle}>+0.2</button>
              </div>
            );
          })()}
        </div>
      </>
    ) : (
      /* Collapsed state indicator */
      <div style={{ 
        fontSize: '8px', 
        opacity: 0.7, 
        marginTop: '2px',
        color: 'cyan'
      }}>
        ⬆ swipe up to expand
      </div>
    )}
  </div>
)}

      
      
      {/* Child components (AR objects will be added here) */}
      {children}
    </div>
  );
};

export default ArCameraComponent;


