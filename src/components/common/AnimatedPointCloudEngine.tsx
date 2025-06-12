import React, { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { getDeviceCapabilities, OptimizedGeometryLoader } from '../../utils/deviceOptimization';
import { gpsToThreeJsPositionWithTerrain } from '../../utils/geoArUtils';

interface AnimatedPointCloudEngine {
  modelName: 'bc2200'; // Extensible for future animated models
  scene: THREE.Scene;
  isArMode: boolean;
  arPosition?: THREE.Vector3;
  userPosition?: [number, number];
  destinationPosition?: [number, number]; // From mapRouteData for spatial movement
  coordinateScale?: number;
  onModelLoaded?: (pointCloud: THREE.Points) => void;
  onLoadingProgress?: (progress: number) => void;
  onError?: (error: string) => void;
  onReadyForReset?: () => void;
  onAnimationLoop?: (frameIndex: number, progress: number) => void;
}

const AnimatedPointCloudEngine: React.FC<AnimatedPointCloudEngine> = ({
  modelName,
  scene,
  isArMode,
  arPosition,
  userPosition,
  destinationPosition,
  coordinateScale = 1.0,
  onModelLoaded,
  onLoadingProgress,
  onError,
  onReadyForReset,
  onAnimationLoop
}) => {
  // Configuration based on preprocessor settings
  const ANIMATION_CONFIG = {
    totalFrames: 24,           // Must match preprocessor
    fps: 24,                   // Target playback fps
    duration: 1.0,             // 1 second loop
    frameInterval: 1000 / 24   // ~41.7ms per frame
  };

  // Refs for animation state
  const mountedRef = useRef(true);
  const loadedRef = useRef(false);
  const groupRef = useRef<THREE.Group | null>(null);
  const pointCloudRef = useRef<THREE.Points | null>(null);
  const frameGeometriesRef = useRef<THREE.BufferGeometry[]>([]);
  const animationIdRef = useRef<number | null>(null);
  const loaderRef = useRef(new OptimizedGeometryLoader());
  
  // Animation timing
  const lastFrameTimeRef = useRef(0);
  const currentFrameRef = useRef(0);
  
  // Device capabilities
  const deviceCapsRef = useRef<ReturnType<typeof getDeviceCapabilities> | null>(null);
  
  const getDeviceCaps = () => {
    if (!deviceCapsRef.current) {
      try {
        deviceCapsRef.current = getDeviceCapabilities();
      } catch (error) {
        console.warn('Device capabilities failed, using fallback');
        deviceCapsRef.current = {
          quality: 'low' as const,
          isMobile: true,
          isLowEnd: true,
          maxVertices: 25000,
          shouldReduceFrameRate: true,
          maxPixelRatio: 1.5,
          rendererSettings: {
            antialias: false,
            powerPreference: 'low-power' as const,
            precision: 'mediump' as const
          }
        };
      }
    }
    return deviceCapsRef.current;
  };

  
  // Animation loop with frame-based playback
  const animate = useCallback((currentTime: number) => {
    if (!mountedRef.current || !pointCloudRef.current || frameGeometriesRef.current.length === 0) {
      return;
    }

    // Calculate frame timing
    const elapsed = currentTime - lastFrameTimeRef.current;
    
    // Only update frame if enough time has passed (target 24fps)
    if (elapsed >= ANIMATION_CONFIG.frameInterval) {
      // Update frame index
      currentFrameRef.current = (currentFrameRef.current + 1) % ANIMATION_CONFIG.totalFrames;
      
      // Get the geometry for current frame
      const frameGeometry = frameGeometriesRef.current[currentFrameRef.current];
      
      if (frameGeometry && pointCloudRef.current.geometry !== frameGeometry) {
    
        // Set new frame geometry
        pointCloudRef.current.geometry = frameGeometry;
      }

      // Handle spatial movement (canoe paddling from anchor to destination)
      if (isArMode && userPosition && arPosition && destinationPosition) {
        handleSpatialMovement();
      }

      // Notify parent about animation progress
      if (onAnimationLoop) {
        const progress = currentFrameRef.current / ANIMATION_CONFIG.totalFrames;
        onAnimationLoop(currentFrameRef.current, progress);
      }

      lastFrameTimeRef.current = currentTime;
    }

    // Continue animation loop
    if (mountedRef.current) {
      animationIdRef.current = requestAnimationFrame(animate);
    }
  }, [modelName, isArMode, userPosition, arPosition, destinationPosition, coordinateScale]);

   
  // Handle spatial movement for BC2200 canoe experience
  const animateConfigRef = useRef({
      isArMode,
      userPosition,
      arPosition,
      destinationPosition,
      coordinateScale
    });

    // Update refs when dependencies change
    useEffect(() => {
      animateConfigRef.current = {
        isArMode,
        userPosition,
        arPosition,
        destinationPosition,
        coordinateScale
      };
    }, [isArMode, userPosition, arPosition, destinationPosition, coordinateScale]);


  
  const handleSpatialMovement = useCallback(() => {

  const { isArMode, userPosition, arPosition, destinationPosition, coordinateScale } = animateConfigRef.current;


    if (!groupRef.current || !userPosition || !arPosition || !destinationPosition) return;

    // Calculate journey progress based on animation frame
    // The canoe moves from anchor to destination over the full animation cycle
    const journeyProgress = currentFrameRef.current / ANIMATION_CONFIG.totalFrames;

    // Calculate destination position in Three.js coordinates
    const destinationResult = gpsToThreeJsPositionWithTerrain(
      userPosition,
      destinationPosition,
      2.0, // Elevation offset for water surface
      coordinateScale
    );

    // Interpolate between anchor and destination
    const currentPosition = new THREE.Vector3().lerpVectors(
      arPosition,
      destinationResult.position,
      journeyProgress
    );

    // Apply smooth easing for more natural movement
    const easedProgress = 0.5 * (1 - Math.cos(Math.PI * journeyProgress));
    const smoothPosition = new THREE.Vector3().lerpVectors(
      arPosition,
      destinationResult.position,
      easedProgress
    );

    // Update group position
    groupRef.current.position.copy(smoothPosition);

    // Optional: Add slight bobbing motion for water effect
    const bobbingOffset = Math.sin(currentFrameRef.current * 0.5) * 0.1;
    groupRef.current.position.y += bobbingOffset;

  }, []);

  // Load all animation frames
// ✅ Make loadAnimationFrames stable
const loadAnimationFrames = useCallback(async () => {
  // Use refs for current values instead of dependencies
  const currentModelName = modelName;
  const currentScene = scene;
  
  console.log(`🎬 Loading ${currentModelName} animation frames...`);
  
  try {
    const deviceCaps = getDeviceCaps();
    const geometries: THREE.BufferGeometry[] = [];
    let loadedCount = 0;

    for (let frameIndex = 1; frameIndex <= ANIMATION_CONFIG.totalFrames; frameIndex++) {
      if (!mountedRef.current) return;

      try {
        const geometry = await loaderRef.current.loadAnimationFrame(
          currentModelName,
          frameIndex,
          deviceCaps.quality
        );

        geometries[frameIndex - 1] = geometry;
        loadedCount++;
        
        if (onLoadingProgress) {
          onLoadingProgress((loadedCount / ANIMATION_CONFIG.totalFrames) * 100);
        }
        
      } catch (frameError) {
        console.error(`❌ Failed to load frame ${frameIndex}:`, frameError);
        if (onError) {
          onError(`Failed to load animation frame ${frameIndex}: ${frameError}`);
        }
        return;
      }
    }

    if (!mountedRef.current) return;

    frameGeometriesRef.current = geometries;

    // Create point cloud with first frame
    const group = new THREE.Group();
    groupRef.current = group;

    const baseGeometry = geometries[0];
    const material = new THREE.PointsMaterial({
      size: 1.0,
      sizeAttenuation: false,
      vertexColors: baseGeometry.attributes.color ? true : false
    });

    if (!baseGeometry.attributes.color) {
      material.color.setHex(0x8B4513);
    }

    const pointCloud = new THREE.Points(baseGeometry, material);
    pointCloudRef.current = pointCloud;
    group.add(pointCloud);

    // Position based on current refs
    const { isArMode, arPosition } = animateConfigRef.current;
    if (isArMode && arPosition) {
      const useOverride = (window as any).arTestingOverride ?? true;
      group.position.copy(useOverride ? new THREE.Vector3(0, 0, -5) : arPosition);
    } else {
      group.position.set(0, 0, -3);
    }

    const initialScale = 10.0; // SCALE FOR MODEL
    group.scale.setScalar(initialScale);

    currentScene.add(group);

    // Start animation
    lastFrameTimeRef.current = performance.now();
    animate(lastFrameTimeRef.current);

    if (onModelLoaded) onModelLoaded(pointCloud);
    if (onReadyForReset) onReadyForReset();

  } catch (error) {
    console.error(`❌ Failed to load ${currentModelName} animation:`, error);
    if (onError) onError(`Failed to load ${currentModelName}: ${error}`);
  }
}, []); // ✅ No dependencies - access current values via refs

  // Main loading effect
  useEffect(() => {
    if (loadedRef.current) {
      console.log(`⏭️ ${modelName} already loading, skipping duplicate`);
      return;
    }
    
    loadedRef.current = true;
    mountedRef.current = true;

    loadAnimationFrames();

    return () => {
      console.log(`🧹 Cleaning up ${modelName} animation`);
      
      mountedRef.current = false;
      loadedRef.current = false;
      
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
        animationIdRef.current = null;
      }

      // Dispose all frame geometries
      frameGeometriesRef.current.forEach((geom, index) => {
        if (geom && typeof geom.dispose === 'function') {
          geom.dispose();
        }
      });
      frameGeometriesRef.current = [];

      if (groupRef.current && scene) {
        scene.remove(groupRef.current);
        groupRef.current.traverse((child) => {
          if (child instanceof THREE.Points) {
         
            
            if (child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach(mat => mat.dispose());
              } else {
                child.material.dispose();
              }
            }
          }
        });
        groupRef.current = null;
      }

      loaderRef.current.clearCache();

        pointCloudRef.current = null;
            animateConfigRef.current = {
              isArMode: false,
              userPosition: undefined,
              arPosition: undefined,
              destinationPosition: undefined,
              coordinateScale: 1.0
            };
                
      if ((window as any).gc) {
        (window as any).gc();
      }
    };
  }, [modelName, scene]);

  // Separate effect for position updates
  useEffect(() => {
    if (groupRef.current && isArMode && arPosition) {
      const useOverride = (window as any).arTestingOverride ?? true;
      groupRef.current.position.copy(useOverride ? new THREE.Vector3(0, 0, -5) : arPosition);
    }
  }, [isArMode, arPosition]);

  return null;
};

export default AnimatedPointCloudEngine;