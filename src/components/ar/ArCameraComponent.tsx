// src/components/ar/ArCameraComponent.tsx
import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { calculateBearing, gpsToThreeJsPosition } from '../../utils/geoArUtils';
import { usePermissions } from '../../context/PermissionsContext';
import { PermissionType } from '../../utils/permissions';
import { validateTerrainCoverage, getEnhancedAnchorPosition } from '../../utils/geoArUtils'
import EdgeChevrons from './EdgeChevrons';
import { loadHeightmap, testTerrainLookup, gpsToThreeJsPositionWithTerrain } from '../../utils/terrainUtils';
import { getOptimizedRendererSettings, optimizeWebGLRenderer } from '../../utils/systemOptimization';

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
  onModelRotate?: (deltaX: number, deltaY: number) => void;
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
  // Refs for DOM elements and Three.js objects
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const touchStartY = useRef(0);
  const touchEndY = useRef(0);
  const lastTapTime = useRef(0);
  const lastTouchX = useRef(0);
  const lastTouchY = useRef(0);
  const initialPinchDistance = useRef(0);

  const anchorSphereRef = useRef<THREE.Mesh | null>(null);
//add plane
  const anchorPlaneRef = useRef<THREE.Mesh | null>(null);
  // Add group
  const anchorGroupRef = useRef<THREE.Group | null>(null);

  // Touch constants
  const minSwipeDistance = 50;
  const doubleTapDelay = 300;
  
  // State
  const [isInitialized, setIsInitialized] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [deviceOrientation, setDeviceOrientation] = useState<{
    alpha: number;
    beta: number;
    gamma: number;
  } | null>(null);

//big red sphere for anchor testing
const [showAnchorSphere, setShowAnchorSphere] = useState(true);
const [sphereSize, setSphereSize] = useState(0.5); // Default 0.5m radius
const [planeRotation, setPlaneRotation] = useState(-Math.PI / 2.1 ); 
//chevrons for directions
const [showChevrons, setShowChevrons] = useState(true);
const [debugHeading, setDebugHeading] = useState<number | null>(null);


  // Debug/testing override state
  const [debugCollapsed, setDebugCollapsed] = useState(false);

  const [arTestingOverride, setArTestingOverride] = useState<boolean>(() => {
    // Initialize from global if available, otherwise false
    return typeof (window as any).arTestingOverride === 'boolean'
      ? (window as any).arTestingOverride
      : false;
  });
  
  // Permission handling - use existing system
  const { isPermissionGranted, requestPermission } = usePermissions();
  
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

  const createAnchorSphere = () => {
    // Create a group to hold both sphere and plane
    const anchorGroup = new THREE.Group();
    anchorGroupRef.current = anchorGroup;
    scene.add(anchorGroup);
    
    // Create sphere AT GROUP ORIGIN (no rotation)
    const sphereGeometry = new THREE.SphereGeometry(sphereSize, 16, 16);
    const sphereMaterial = new THREE.MeshBasicMaterial({ 
      color: 0xff0000, 
      transparent: true, 
      opacity: 0.7,
      wireframe: false 
    });
    
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    sphere.position.set(0, 0, 0); // Center at group origin
    sphere.visible = true;
    anchorSphereRef.current = sphere;
    anchorGroup.add(sphere);
    
    // Create plane AT GROUP ORIGIN with ALL rotation applied to it
    const planeGeometry = new THREE.PlaneGeometry(sphereSize * 3, sphereSize * 3);
    const planeMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ff00,     
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthTest: true,
      depthWrite: false
    });
    
    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.position.set(0, 0, 0); // Center at group origin
    plane.rotation.x = -Math.PI / 2.1 + (-0.05 * Math.PI); // Combine both rotations
    plane.visible = true;
    anchorPlaneRef.current = plane;
    anchorGroup.add(plane);
    
    // Set initial group position
    const currentOverride = (window as any).arTestingOverride ?? true;
    if (currentOverride) {
      anchorGroup.position.set(0, 0, -5);
    }
  };
  
  // Create camera with realistic FOV for mobile AR
  const camera = new THREE.PerspectiveCamera(
    70, // Field of view (typical for mobile cameras)
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
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

  createAnchorSphere();

  if (onSceneReady) {
    onSceneReady(scene, camera);
    console.log('📡 AR scene exposed to parent component');
  }
  
  console.log('✅ Three.js scene initialized with optimizations');
  return true;
};
  
  // Calculate and place AR object
// In ArCameraComponent.tsx, update the placeArObject function:
const placeArObject = () => {
  if (!userPosition || !anchorPosition) return;
  
  // Determine experience type - you'll need to get this from your context
  // This could come from props, route params, or experience manager
  const currentExperienceType = experienceType || 'default';

  // Get experience-specific elevation offset
  const experienceOffsets: Record<string, number> = {
    'lotus': 0.5,      // Water plants at surface level
    'lily': 0.5,       
    'cattail': 1.0,    
    'mac': 1.8,        // People at human height
    'helen_s': 1.8,    
    'volunteers': 1.8, 
    'default': 2.0
  };
  
  const typeKey = experienceType ?? 'default';
  const elevationOffset = experienceOffsets[typeKey] || experienceOffsets['default'];
  
  // Use terrain-aware positioning
  const result = gpsToThreeJsPositionWithTerrain(
    userPosition,
    anchorPosition,
    elevationOffset,
    coordinateScale
  );
  
  // console.log(`📍 Terrain-aware AR positioning:`);
  // console.log(`   Position: (${result.position.x.toFixed(2)}, ${result.position.y.toFixed(2)}, ${result.position.z.toFixed(2)})`);
  // console.log(`   User elevation: ${result.userElevation?.toFixed(2)}m`);
  // console.log(`   Anchor elevation: ${result.terrainElevation?.toFixed(2)}m`);
  // console.log(`   Using terrain data: ${result.usedTerrain ? 'Yes' : 'No (fallback)'}`);
  
      // Pass the terrain-aware position to your AR object placement
      // In the placeArObject function, update the sphere positioning:
      if (onArObjectPlaced) {
        onArObjectPlaced(result.position);
        
        // Update anchor sphere position
        if (anchorSphereRef.current) {
          const currentOverride = (window as any).arTestingOverride ?? true;
          
          if (currentOverride) {
            // In override mode, show sphere at the test position
            anchorSphereRef.current.position.set(0, 0, -5);
            // console.log('🔴 Anchor sphere positioned at override location (0, 0, -5)');
          } else {
            // In AR mode, show sphere at the ACTUAL AR ANCHOR position
            anchorSphereRef.current.position.copy(result.position); // This is the AR anchor
            // console.log('🔴 Anchor sphere positioned at AR anchor:', result.position);
          }
        }
      }
};
  
  // Handle device orientation events
  const handleDeviceOrientation = (event: DeviceOrientationEvent) => {
    if (!cameraRef.current) return;
    
    const { alpha, beta, gamma } = event;
    
    // Validate orientation data
    if (alpha === null || beta === null || gamma === null) return;
    
    // Store orientation data
    const orientation = { alpha, beta, gamma };
    setDeviceOrientation(orientation);
    
    // Convert device orientation to camera rotation
    // Apply rotation to camera to match device orientation
    const alphaRad = THREE.MathUtils.degToRad(alpha || 0);
    const betaRad = THREE.MathUtils.degToRad((beta || 0) - 80);
    const gammaRad = THREE.MathUtils.degToRad(gamma || 0);
    
    // Create rotation matrix from device orientation
    // Note: These may need adjustment based on device coordinate system
    const euler = new THREE.Euler(
      betaRad,  // X-axis rotation (tilt forward/back)
      alphaRad, // Y-axis rotation (compass heading)
      -gammaRad, // Z-axis rotation (tilt left/right, negated)
      'YXZ'     // Rotation order
    );
    
    cameraRef.current.setRotationFromEuler(euler);
    
    // Notify parent about orientation update
    if (onOrientationUpdate) {
      onOrientationUpdate(orientation);
    }
  };
  
  const getDeviceHeading = (): number | null => {
  // Use debug override if set
  if (debugHeading !== null) {
    return debugHeading;
  }
  
  if (!deviceOrientation || deviceOrientation.alpha === null) {
    // Fallback for desktop testing
    return 0; // Point north
  }
  
  let heading = deviceOrientation.alpha;
  while (heading < 0) heading += 360;
  while (heading >= 360) heading -= 360;
  
  return heading;
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
  
  // Request device orientation permission (iOS) - use existing system
  const requestOrientationPermission = async () => {
    // Check if orientation permission is already granted via existing system
    if (isPermissionGranted(PermissionType.ORIENTATION)) {
      return true;
    }
    
    // On iOS, we still need to explicitly request DeviceOrientationEvent permission
    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      try {
        const permission = await (DeviceOrientationEvent as any).requestPermission();
        return permission === 'granted';
      } catch (error) {
        console.error('Orientation permission error:', error);
        return false;
      }
    }
    
    // For non-iOS devices, rely on existing permission system
    return isPermissionGranted(PermissionType.ORIENTATION);
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
      const orientationSupported = await requestOrientationPermission();
      if (orientationSupported) {
        window.addEventListener('deviceorientation', handleDeviceOrientation);
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

      if (event.touches.length === 1) {
        // Single touch: store positions for rotation
        touchStartY.current = event.touches[0].clientY;
        lastTouchX.current = event.touches[0].clientX;
        lastTouchY.current = event.touches[0].clientY;
      } else if (event.touches.length === 2) {
        // Two finger pinch: store initial distance
        const touch1 = event.touches[0];
        const touch2 = event.touches[1];
        initialPinchDistance.current = Math.hypot(
          touch2.clientX - touch1.clientX,
          touch2.clientY - touch1.clientY
        );
      }

      // Multi-tap detection - SIMPLIFIED
      if (timeSince < doubleTapDelay && timeSince > 0) {
        // This is a double tap
        // console.log('👆 Double tap detected - reset');
        if (onModelReset) {
          onModelReset();
          // console.log('onModelReset called');
        }
        event.preventDefault();
        lastTapTime.current = 0; // Reset to prevent further detection
      } else {
        // This is a single tap (or first tap)
        lastTapTime.current = now;
      }
    };

const handleTouchMove = (event: TouchEvent) => {
  if (event.touches.length === 1) {
    // Single finger drag: rotate model
    const currentX = event.touches[0].clientX;
    const currentY = event.touches[0].clientY;
    
    const deltaX = currentX - lastTouchX.current;
    const deltaY = currentY - lastTouchY.current;
    
    // Only rotate if significant movement
    if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
      if (onModelRotate) {
        onModelRotate(deltaX * 0.01, deltaY * 0.01);
      }
    }
    
    lastTouchX.current = currentX;
    lastTouchY.current = currentY;
    
  } else if (event.touches.length === 2) {
    // Two finger pinch: scale model
    const touch1 = event.touches[0];
    const touch2 = event.touches[1];
    const currentDistance = Math.hypot(
      touch2.clientX - touch1.clientX,
      touch2.clientY - touch1.clientY
    );
    
    const scaleChange = currentDistance / initialPinchDistance.current;
    
    if (scaleChange > 0.1 && scaleChange < 10) {
      if (onModelScale) {
        onModelScale(scaleChange);
      }
    }
  }
  
  event.preventDefault();
};

const handleTouchEnd = (event: TouchEvent) => {
  // console.log('👆 Touch ended');
  // Could add swipe detection here if needed
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
      window.removeEventListener('deviceorientation', handleDeviceOrientation);
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
  

useEffect(() => {
  if (anchorGroupRef.current && showAnchorSphere) {
    let targetPosition;

    
    
    if (arTestingOverride) {
      targetPosition = new THREE.Vector3(0, 0, -5);
    } else {
      if (userPosition && anchorPosition) {
        const result = gpsToThreeJsPositionWithTerrain(
          userPosition,
          anchorPosition,
          anchorElevation,
          coordinateScale
        );
        targetPosition = result.position;
      }
    }
    
    if (targetPosition) {
      // Move the entire GROUP
      anchorGroupRef.current.position.copy(targetPosition);
      // console.log('🔴🟢 Anchor group moved to:', targetPosition);
    }
  }
}, [arTestingOverride, userPosition, anchorPosition, coordinateScale]);

  // Update AR object position when GPS coordinates change
  useEffect(() => {
    if (isInitialized) {
      placeArObject();
    }
  }, [userPosition, anchorPosition, coordinateScale, isInitialized]);

  const [gpsOffset, setGpsOffset] = useState({ lon: 0, lat: 0 });
  
  return (
    <div 
      ref={containerRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 1000
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
          zIndex: 1001
        }}
        autoPlay
        playsInline
        muted
      />
      
      {/* Three.js canvas overlay */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 1002,
          pointerEvents: 'auto' 
        }}
      />

      {showChevrons && userPosition && anchorPosition && (
        <EdgeChevrons
          userPosition={userPosition}
          anchorPosition={anchorPosition}
          deviceHeading={getDeviceHeading()}
          isVisible={showChevrons}
        />
        )}
      
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
          zIndex: 1003,
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
          zIndex: 1003,
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
      
          {/* Minimal Debug Panel */}
     
         {SHOW_DEBUG_PANEL && (
              <div style={{
                position: 'absolute',
                top: '10px',
                left: '10px',
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                color: 'white',
                padding: '10px',
                borderRadius: '4px',
                fontSize: '12px',
                zIndex: 1003,
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

                {deviceOrientation ? (
                  <>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <span>α: {deviceOrientation.alpha?.toFixed(1)}°</span>
                      <span>β: {deviceOrientation.beta?.toFixed(1)}°</span>
                      <span>γ: {deviceOrientation.gamma?.toFixed(1)}°</span>
                    </div>
                  </>
                ) : (
                  <div>Orientation: Desktop</div>
                )}
                
                <div>Scale: {coordinateScale}x</div>
                <div>User: [{userPosition[0].toFixed(6)}, {userPosition[1].toFixed(6)}]</div>
                <div>Anchor: [{anchorPosition[0].toFixed(6)}, {anchorPosition[1].toFixed(6)}]</div>
                <div>Elevation: {anchorElevation}m</div>

            
               
                <div style={{ marginTop: '5px' }}>
                <div style={{ color: 'yellow', fontSize: '10px' }}>🔴 ANCHOR SPHERE & PLANE</div>
                {/* Single toggle for BOTH sphere and plane */}
                <div 
                  onClick={() => {
                    setShowAnchorSphere(!showAnchorSphere);
                    if (anchorSphereRef.current) {
                      anchorSphereRef.current.visible = !showAnchorSphere;
                    }
                    if (anchorPlaneRef.current) {
                      anchorPlaneRef.current.visible = !showAnchorSphere;
                    }
                    
                    // console.log('🔴🟢 Anchor sphere & plane:', !showAnchorSphere ? 'ON' : 'OFF');
                  }}
                  style={{ 
                    cursor: 'pointer', 
                    userSelect: 'none', 
                    padding: '2px 4px',
                    backgroundColor: showAnchorSphere ? 'rgba(255, 100, 0, 0.3)' : 'rgba(100, 100, 100, 0.3)',
                    borderRadius: '2px',
                    fontSize: '9px',
                    marginTop: '2px'
                  }}
                >
                  Anchor: {showAnchorSphere ? '✅ ON' : '❌ OFF'}
                </div>
                {/* rotation */}
                <div style={{ marginTop: '2px', fontSize: '9px' }}>
                  <label>Plane Tilt: {((planeRotation + Math.PI / 2.1) * 180 / Math.PI).toFixed(1)}°</label>
                  <input 
                    type="range" 
                    min={-Math.PI / 2.1 - 0.5} // Allow range around the base horizontal rotation
                    max={-Math.PI / 2.1 + 0.5} 
                    step="0.01" 
                    value={planeRotation}
                    onChange={(e) => {
                      const newRotation = parseFloat(e.target.value);
                      setPlaneRotation(newRotation);
                      
                      if (anchorPlaneRef.current) {
                        anchorPlaneRef.current.rotation.x = newRotation;
                        // console.log('🟢 Plane rotation:', (newRotation * 180 / Math.PI).toFixed(1), 'degrees');
                        // console.log('🟢 Plane tilt from horizontal:', ((newRotation + Math.PI / 2.1) * 180 / Math.PI).toFixed(1), 'degrees');
                      }
                    }}
                    style={{ width: '80px', marginLeft: '5px' }}
                  />
                </div>
                {/* Size slider for BOTH sphere and plane */}
                <div style={{ marginTop: '2px', fontSize: '9px' }}>
                  <label>Size: {sphereSize.toFixed(1)}m</label>
                  <input 
                    type="range" 
                    min="0.1" 
                    max="2.0" 
                    step="0.1" 
                    value={sphereSize}
                    onChange={(e) => {
                      const newSize = parseFloat(e.target.value);
                      setSphereSize(newSize);
                      
                      // Update sphere geometry
                      if (anchorSphereRef.current) {
                        const newSphereGeometry = new THREE.SphereGeometry(newSize, 16, 16);
                        anchorSphereRef.current.geometry.dispose();
                        anchorSphereRef.current.geometry = newSphereGeometry;
                        // console.log('🔴 Sphere size updated to:', newSize);
                      }
                      
                      // Update plane geometry to match sphere size
                      if (anchorPlaneRef.current) {
                        const newPlaneGeometry = new THREE.PlaneGeometry(newSize * 4, newSize * 4);
                        anchorPlaneRef.current.geometry.dispose();
                        anchorPlaneRef.current.geometry = newPlaneGeometry;
                        // console.log('🟢 Plane size updated to:', newSize * 4);
                      }
                    }}
                    style={{ width: '80px', marginLeft: '5px' }}
                  />
                </div>
              </div>
                  
                  <div style={{ 
                      marginTop: '8px', 
                      borderTop: '1px solid rgba(255,255,255,0.3)', 
                      paddingTop: '5px' 
                    }}>
                      <div style={{ color: 'yellow', fontSize: '10px' }}>🧭 EDGE CHEVRONS</div>
                      
                      <div 
                        onClick={() => {
                          setShowChevrons(!showChevrons);
                          // console.log('🧭 Edge chevrons:', !showChevrons ? 'ON' : 'OFF');
                        }}
                        style={{ 
                          cursor: 'pointer', 
                          userSelect: 'none', 
                          padding: '2px 4px',
                          backgroundColor: showChevrons ? 'rgba(190, 105, 169, 0.3)' : 'rgba(100, 100, 100, 0.3)',
                          borderRadius: '2px',
                          fontSize: '9px',
                          marginTop: '2px'
                        }}
                      >
                        Chevrons: {showChevrons ? '✅ ON' : '❌ OFF'}
                      </div>

                      <div style={{ marginTop: '2px', fontSize: '9px' }}>
                      <label>Debug Heading: {debugHeading?.toFixed(1) || 'Auto'}°</label>
                      <input 
                        type="range" 
                        min="0" 
                        max="360" 
                        step="10" 
                        value={debugHeading || 0}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value);
                          setDebugHeading(value);
                          // console.log('🧭 Debug heading set to:', value);
                        }}
                        style={{ width: '80px', marginLeft: '5px' }}
                      />
                      <button 
                        onClick={() => {
                          setDebugHeading(null);
                          // console.log('🧭 Debug heading cleared, using auto');
                        }}
                        style={{ 
                          fontSize: '8px', 
                          padding: '1px 3px', 
                          marginLeft: '3px',
                          backgroundColor: 'rgba(255,255,255,0.2)', 
                          border: 'none', 
                          color: 'white' 
                        }}
                      >
                        Auto
                      </button>
                    </div>
                      
                  {deviceOrientation && (
                    <div style={{ fontSize: '9px', marginTop: '2px' }}>
                      Heading: {getDeviceHeading()?.toFixed(1)}°
                    </div>
                  )}
                  
                  {userPosition && anchorPosition && (
                    <div style={{ fontSize: '9px' }}>
                      GPS Bearing: {calculateBearing(userPosition, anchorPosition).toFixed(1)}°
                    </div>
                  )}
                </div>
                              
            

                <div 
                  onClick={() => {
                    const newValue = !arTestingOverride;
                    (window as any).arTestingOverride = newValue;
                    setArTestingOverride(newValue);
                    // console.log('🎯 AR Override:', newValue ? 'ON' : 'OFF');
                  }}
                  style={{ cursor: 'pointer', userSelect: 'none', marginTop: '5px' }}
                >
                  Override: {arTestingOverride ? '✅' : '❌'}
                </div>

                {/* Terrain Testing Section */}
                <div style={{ 
                  marginTop: '8px', 
                  borderTop: '1px solid rgba(255,255,255,0.3)', 
                  paddingTop: '5px' 
                }}>
                  <div style={{ color: 'yellow', fontSize: '10px' }}>🗺️ TERRAIN DEBUG</div>
                  
                  <div style={{ display: 'flex', gap: '4px', marginTop: '3px' }}>
                    <button 
                      onClick={() => {
                        import('../../utils/terrainUtils').then(utils => {
                          // console.log('🧪 Testing terrain lookup...');
                          utils.testTerrainLookup();
                        }).catch(err => console.error('❌ Terrain test failed:', err));
                      }}
                      style={{ 
                        fontSize: '9px', 
                        padding: '2px 4px', 
                        backgroundColor: 'rgba(0, 150, 255, 0.3)',
                        border: '1px solid rgba(0, 150, 255, 0.5)',
                        color: 'white',
                        cursor: 'pointer',
                        borderRadius: '2px'
                      }}
                    >
                      Test Lookup
                    </button>
                    
                    <button 
                      onClick={() => {
                        import('../../utils/geoArUtils').then(utils => {
                          // console.log('🧪 Testing all Kenilworth experiences...');
                          utils.testKenilworthExperiences();
                        }).catch(err => console.error('❌ Experience test failed:', err));
                      }}
                      style={{ 
                        fontSize: '9px', 
                        padding: '2px 4px', 
                        backgroundColor: 'rgba(0, 200, 100, 0.3)',
                        border: '1px solid rgba(0, 200, 100, 0.5)',
                        color: 'white',
                        cursor: 'pointer',
                        borderRadius: '2px'
                      }}
                    >
                      Test All
                    </button>
                  </div>
                  
                  <button 
                    onClick={() => {
                      import('../../utils/geoArUtils').then(utils => {
                        import('../../data/mapRouteData').then(data => {
                          // console.log('🔍 Validating terrain coverage...');
                          const anchors = data.routePointsData.features.map(f => ({
                            name: f.properties.iconName,
                            coordinates: f.properties.arAnchor?.coordinates || f.geometry.coordinates
                          }));
                          utils.validateTerrainCoverage(anchors);
                        });
                      }).catch(err => console.error('❌ Validation failed:', err));
                    }}
                    style={{ 
                      fontSize: '9px', 
                      padding: '2px 4px', 
                      marginTop: '2px',
                      width: '100%',
                      backgroundColor: 'rgba(255, 150, 0, 0.3)',
                      border: '1px solid rgba(255, 150, 0, 0.5)',
                      color: 'white',
                      cursor: 'pointer',
                      borderRadius: '2px'
                    }}
                  >
                    Validate Coverage
                  </button>
                  <button 
                      onClick={() => {
                        import('../../utils/terrainUtils').then(utils => {
                          // console.log('🔧 Running coordinate conversion debug...');
                          utils.debugCoordinateConversion();
                        });
                      }}
                      style={{ 
                        fontSize: '9px', 
                        padding: '2px 4px', 
                        backgroundColor: 'rgba(255, 100, 100, 0.3)',
                        border: '1px solid rgba(255, 100, 100, 0.5)',
                        color: 'white',
                        cursor: 'pointer',
                        borderRadius: '2px'
                      }}
                    >
                      Debug Coords
                    </button>
                      <button 
                        onClick={() => {
                          import('../../utils/terrainUtils').then(utils => {
                            // Test around the mac anchor point that showed (444, 95)
                            // console.log('🔍 Sampling area around mac anchor...');
                            utils.debugPixelArea(444, 95, 15);
                          });
                        }}
                        style={{ 
                          fontSize: '9px', 
                          padding: '2px 4px', 
                          backgroundColor: 'rgba(0, 255, 255, 0.3)',
                          border: '1px solid rgba(0, 255, 255, 0.5)',
                          color: 'white',
                          cursor: 'pointer',
                          borderRadius: '2px'
                        }}
                      >
                        Sample Area
                      </button>
                    <button 
                      onClick={() => {
                        import('../../utils/terrainUtils').then(utils => {
                          // console.log('📊 Sampling heightmap distribution...');
                          utils.sampleHeightmapDistribution();
                        });
                      }}
                      style={{ 
                        fontSize: '9px', 
                        padding: '2px 4px', 
                        backgroundColor: 'rgba(150, 100, 255, 0.3)',
                        border: '1px solid rgba(150, 100, 255, 0.5)',
                        color: 'white',
                        cursor: 'pointer',
                        borderRadius: '2px'
                      }}
                    >
                      Sample Map
                    </button>
                    
                    <button 
                      onClick={() => {
                        import('../../utils/terrainUtils').then(utils => {
                          // console.log('🔍 Analyzing raw pixel data...');
                          utils.debugPixelData();
                        });
                      }}
                      style={{ 
                        fontSize: '9px', 
                        padding: '2px 4px', 
                        backgroundColor: 'rgba(255, 0, 255, 0.3)',
                        border: '1px solid rgba(255, 0, 255, 0.5)',
                        color: 'white',
                        cursor: 'pointer',
                        borderRadius: '2px'
                      }}
                    >
                      Debug Pixels
                    </button>

                    <button 
                      onClick={() => {
                        import('../../utils/terrainUtils').then(utils => {
                          // console.log('🧪 Testing pixel interpretation methods...');
                          utils.testPixelInterpretation();
                        });
                      }}
                      style={{ 
                        fontSize: '9px', 
                        padding: '2px 4px', 
                        backgroundColor: 'rgba(255, 255, 0, 0.3)',
                        border: '1px solid rgba(255, 255, 0, 0.5)',
                        color: 'white',
                        cursor: 'pointer',
                        borderRadius: '2px'
                      }}
                    >
                      Test Methods
                    </button>
                </div>
              
                <div style={{ 
                  marginTop: '5px', 
                  borderTop: '1px solid rgba(255,255,255,0.3)', 
                  paddingTop: '5px' 
                }}>
                  <div style={{ color: 'yellow', fontSize: '10px' }}>🎯 GPS CALIBRATION</div>
                  
                  <div style={{ display: 'flex', gap: '2px', marginTop: '2px' }}>
                    <button onClick={() => setGpsOffset(prev => ({...prev, lon: prev.lon - 0.00001}))}
                            style={{ fontSize: '8px', padding: '1px 3px', backgroundColor: 'rgba(255,255,255,0.2)', border: 'none', color: 'white' }}>
                      W
                    </button>
                    <button onClick={() => setGpsOffset(prev => ({...prev, lon: prev.lon + 0.00001}))}
                            style={{ fontSize: '8px', padding: '1px 3px', backgroundColor: 'rgba(255,255,255,0.2)', border: 'none', color: 'white' }}>
                      E
                    </button>
                    <button onClick={() => setGpsOffset(prev => ({...prev, lat: prev.lat + 0.00001}))}
                            style={{ fontSize: '8px', padding: '1px 3px', backgroundColor: 'rgba(255,255,255,0.2)', border: 'none', color: 'white' }}>
                      N
                    </button>
                    <button onClick={() => setGpsOffset(prev => ({...prev, lat: prev.lat - 0.00001}))}
                            style={{ fontSize: '8px', padding: '1px 3px', backgroundColor: 'rgba(255,255,255,0.2)', border: 'none', color: 'white' }}>
                      S
                    </button>
                  </div>
                  
                  <div style={{ fontSize: '9px' }}>
                    Offset: {gpsOffset.lon.toFixed(6)}, {gpsOffset.lat.toFixed(6)}
                  </div>
                  
                  <button 
                    onClick={() => {
                      import('../../utils/terrainUtils').then(utils => {
                        // console.log(`🎯 Testing with GPS offset: ${gpsOffset.lon}, ${gpsOffset.lat}`);
                        // Test current anchor position with offset
                        const testLon = anchorPosition[0] + gpsOffset.lon;
                        const testLat = anchorPosition[1] + gpsOffset.lat;
                        const elevation = utils.getElevationAtGPS(testLon, testLat);
                        // console.log(`📍 Adjusted anchor elevation: ${elevation?.toFixed(2)}m`);
                      });
                    }}
                    style={{ 
                      fontSize: '9px', 
                      padding: '2px 4px', 
                      marginTop: '2px',
                      width: '100%',
                      backgroundColor: 'rgba(255, 200, 0, 0.3)',
                      border: '1px solid rgba(255, 200, 0, 0.5)',
                      color: 'white',
                      cursor: 'pointer',
                      borderRadius: '2px'
                    }}
                  >
                    Test Offset
                  </button>
                  <button 
                    onClick={() => {
                      import('../../utils/terrainUtils').then(utils => {
                        // console.log('🧪 Testing area sampling for all anchors...');
                        utils.testAreaSampling();
                      });
                    }}
                    style={{ 
                      fontSize: '9px', 
                      padding: '2px 4px', 
                      backgroundColor: 'rgba(0, 150, 255, 0.3)',
                      border: '1px solid rgba(0, 150, 255, 0.5)',
                      color: 'white',
                      cursor: 'pointer',
                      borderRadius: '2px'
                    }}
                  >
                    Test Area Sample
                  </button>
                  
                </div>

                </div>)}
              
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
          zIndex: 1003
        }}>
          <div>🎥 Starting AR Camera...</div>
          <div style={{ fontSize: '14px', marginTop: '10px', opacity: 0.8 }}>
            {!isPermissionGranted(PermissionType.CAMERA) && 'Please allow camera access when prompted'}
            {isPermissionGranted(PermissionType.CAMERA) && !isPermissionGranted(PermissionType.ORIENTATION) && 'Please allow motion sensors for best experience'}
            {isPermissionGranted(PermissionType.CAMERA) && isPermissionGranted(PermissionType.ORIENTATION) && 'Initializing AR positioning...'}
          </div>
        </div>
      )}
      
      {/* Child components (AR objects will be added here) */}
      {children}
    </div>
  );
};

export default ArCameraComponent;


