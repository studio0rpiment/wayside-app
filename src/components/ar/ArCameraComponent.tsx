// src/components/ar/ArCameraComponent.tsx
import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { gpsToThreeJsPosition } from '../../utils/geoArUtils';
import { usePermissions } from '../../context/PermissionsContext';
import { PermissionType } from '../../utils/permissions';

interface ArCameraProps {
  userPosition: [number, number];
  anchorPosition: [number, number];
  anchorElevation?: number;
  coordinateScale?: number;
  onArObjectPlaced?: (position: THREE.Vector3) => void;
  onOrientationUpdate?: (orientation: { alpha: number; beta: number; gamma: number }) => void;
  children?: React.ReactNode;
}

const ArCameraComponent: React.FC<ArCameraProps> = ({
  userPosition,
  anchorPosition,
  anchorElevation = 2.0,
  coordinateScale = 1.0,
  onArObjectPlaced,
  onOrientationUpdate,
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
  
  // State
  const [isInitialized, setIsInitialized] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [deviceOrientation, setDeviceOrientation] = useState<{
    alpha: number;
    beta: number;
    gamma: number;
  } | null>(null);
  
  // Permission handling - use existing system
  const { isPermissionGranted, requestPermission } = usePermissions();
  
  // Initialize camera stream
  const initializeCamera = async () => {
    try {
      console.log('🎥 Initializing AR camera...');
      
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
        console.log('✅ Camera stream initialized');
      }
      
      return true;
    } catch (error) {
      console.error('❌ Camera initialization failed:', error);
      setCameraError('Failed to access camera. Please check permissions.');
      return false;
    }
  };
  
  // Initialize Three.js scene
  const initializeThreeJs = () => {
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
    camera.position.set(0, 0, 0); // Camera at origin
    cameraRef.current = camera;
    
    // Create renderer with transparency for overlay
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      alpha: true, // Enable transparency
      antialias: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0); // Fully transparent background
    rendererRef.current = renderer;
    
    // Add basic lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);
    
    console.log('✅ Three.js scene initialized');
    return true;
  };
  
  // Calculate and place AR object
  const placeArObject = () => {
    if (!userPosition || !anchorPosition) return;
    
    // Convert GPS coordinates to Three.js position
    const arPosition = gpsToThreeJsPosition(
      userPosition,
      anchorPosition,
      anchorElevation,
      coordinateScale
    );
    
    console.log('📍 AR Object position:', arPosition);
    
    // Notify parent component about object placement
    if (onArObjectPlaced) {
      onArObjectPlaced(arPosition);
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
    const betaRad = THREE.MathUtils.degToRad(beta || 0);
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
      console.log('🚀 Starting AR Camera initialization...');
      
      // Check and request camera permission if needed
      if (!isPermissionGranted(PermissionType.CAMERA)) {
        console.log('📸 Camera permission not granted, requesting...');
        const cameraGranted = await requestPermission(PermissionType.CAMERA);
        if (!cameraGranted) {
          setCameraError('Camera permission required for AR experience. Please allow camera access when prompted.');
          return;
        }
      }
      
      // Check and request orientation permission if needed
      if (!isPermissionGranted(PermissionType.ORIENTATION)) {
        console.log('📱 Orientation permission not granted, requesting...');
        await requestPermission(PermissionType.ORIENTATION);
        // Don't fail if orientation is denied - AR can work without it
      }
      
      // Initialize camera stream
      const cameraInitialized = await initializeCamera();
      if (!cameraInitialized) return;
      
      // Initialize Three.js
      const threeInitialized = initializeThreeJs();
      if (!threeInitialized) return;
      
      // Setup orientation listener if permission is granted
      const orientationSupported = await requestOrientationPermission();
      if (orientationSupported) {
        window.addEventListener('deviceorientation', handleDeviceOrientation);
        console.log('📱 Device orientation tracking enabled');
      } else {
        console.warn('⚠️ Device orientation not available or permission denied');
      }
      
      // Place AR object
      placeArObject();
      
      // Start animation loop
      animate();
      
      setIsInitialized(true);
      console.log('✅ AR Camera fully initialized');
    };
    
    initialize();
    
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
      
      // Cleanup Three.js
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
      
      console.log('🧹 AR Camera cleaned up');
    };
  }, []); // Remove permission dependency to avoid loops
  
  // Update AR object position when GPS coordinates change
  useEffect(() => {
    if (isInitialized) {
      placeArObject();
    }
  }, [userPosition, anchorPosition, coordinateScale, isInitialized]);
  
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
          pointerEvents: 'none' // Allow touch events to pass through
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
      
      {/* Debug info (development only) */}
      {process.env.NODE_ENV === 'development' && deviceOrientation && (
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
          fontFamily: 'monospace'
        }}>
          <div>α: {deviceOrientation.alpha?.toFixed(1)}°</div>
          <div>β: {deviceOrientation.beta?.toFixed(1)}°</div>
          <div>γ: {deviceOrientation.gamma?.toFixed(1)}°</div>
          <div>GPS: [{userPosition[0].toFixed(6)}, {userPosition[1].toFixed(6)}]</div>
          <div>Scale: {coordinateScale}x</div>
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