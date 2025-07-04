// engines/WaterParticleEngine.tsx - Reformed to use PositioningSystemSingleton pattern
import React, { useRef, useEffect, useCallback, useState } from 'react';
import * as THREE from 'three';
import { getAssetPath } from '../../utils/assetPaths';
import { PositioningSystemSingleton } from '../../utils/coordinate-system/PositioningSystemSingleton';
import { useGeofenceBasics } from '../../context/GeofenceContext';
import { debugModeManager } from '../../utils/DebugModeManager';

// ✅ MOVED: Pond polygon to component level so both functions can access it
const KENILWORTH_POND_SHAPE: { x: number; z: number }[] = [
  { x: -37.5, z: -61.5 },
  { x: -50.5, z: -50.5 },
  { x: -61.5, z: -41.5 },
  { x: -71.5, z: -29.5 },
  { x: -72.5, z: -25.5 },
  { x: -79.5, z: -14.5 },
  { x: -79.5, z: -4.5 },
  { x: -65.5, z: -2.5 },
  { x: -49.5, z: 5.5 },
  { x: -41.5, z: 6.5 },
  { x: -33.5, z: 9.5 },
  { x: -22.5, z: 12.5 },
  { x: -12.5, z: 15.5 },
  { x: -1.5, z: 4.5 },
  { x: 6.5, z: 0.5 },
  { x: 21.5, z: -4.5 },
  { x: 26.5, z: -7.5 },
  { x: 36.5, z: -8.5 },
  { x: 37.5, z: -13.5 },
  { x: 8.5, z: -28.5 },
  { x: 7.5, z: -31.5 },
  { x: 3.5, z: -33.5 },
  { x: -5.5, z: -39.5 },
  { x: -10.5, z: -47.5 },
  { x: -15.5, z: -50.5 },
  { x: -20.5, z: -55.5 },
  { x: -23.5, z: -56.5 },
  { x: -29.5, z: -60.5 },
  { x: -36.5, z: -61.5 },
  { x: -37.5, z: -61.5 }
];

interface WaterParticleEngineProps {
  scene: THREE.Scene;
  enabled: boolean;
  
  // ✅ NEW: Positioning via singleton (like SmokeParticleEngine)
  experienceId: string;           // Which experience this water belongs to
  isUniversalMode?: boolean;      // Universal mode override
  lockPosition?: boolean;         // Lock position after first render (default: true)
  
  // ❌ REMOVED: position?, rotation?, scale? - now handled by singleton
  
  // Water-specific controls
  floodLevel: number; // 0-100 representing 2030-2100 progression
  particleColor?: THREE.Color;
  particleSize?: number;
  opacity?: number;
  particleSpacing?: number;
  scale?: number;
  rotation?: THREE.Euler

  // Animation controls
  waveSpeed?: number;
  waveAmplitude?: number;
  
  // Performance options
  gridResolution?: number; // Particle density
  waterSize?: number; // Coverage area size
  
  // Water system parameters
  maxWaterRise?: number;
  startYear?: number;
  endYear?: number;
  floodExpansionFactor?: number;
  particleSizeMultiplier?: number;
  
  // Callbacks
  onReady?: () => void;
  onError?: (error: string) => void;
  onProgress?: (progress: number) => void;
}

const WaterParticleEngine: React.FC<WaterParticleEngineProps> = ({
  scene,
  enabled,
  
  // ✅ NEW: Positioning props
  experienceId,
  isUniversalMode = false,
  lockPosition = true,
  
  // Water controls
  floodLevel,
  particleColor = new THREE.Color().setHSL(210/360, 0.8, 0.7),
  particleSize = 0.3,
  opacity = 1.0,
  particleSpacing = 1.0,
  scale= 1.0,
  rotation = new THREE.Euler(0, 0, 0),
  
  // Animation controls
  waveSpeed = 0.001,
  waveAmplitude = 1.0,
  
  // Performance options
  gridResolution = 50, // Reduced for AR performance
  waterSize = 40,
  
  // Water system parameters
  maxWaterRise = 2,
  startYear = 2030,
  endYear = 2100,
  floodExpansionFactor = 3.0,
  particleSizeMultiplier = 2.0,
  
  onReady,
  onError,
  onProgress
}) => {
  console.log('🌊 WaterParticleEngine: Received scale prop:', scale);

  const componentIdRef = useRef(Math.random().toString(36).substr(2, 9));
  console.log(`🌊 WaterParticleEngine: Initializing ${experienceId} with singleton positioning (ID: ${componentIdRef.current})`);

  // ✅ NEW: Capture universal mode and user position ONCE (like SmokeParticleEngine)
  const capturedUniversalModeRef = useRef<boolean | null>(null);
  const capturedUserPositionRef = useRef<[number, number] | null>(null);
  const positionLockedRef = useRef(false);

  // Get geofence context for initial values
  const { userPosition, isUniversalMode: contextUniversalMode } = useGeofenceBasics();
  
  // ✅ NEW: Capture values ONCE on first render (like SmokeParticleEngine)
  if (capturedUniversalModeRef.current === null) {
    capturedUniversalModeRef.current = isUniversalMode || contextUniversalMode;
    capturedUserPositionRef.current = userPosition;
  }

  // ✅ NEW: Debug mode state
  const [debugMode, setDebugMode] = useState(false);

  // Refs following WaterParticleEngine pattern - NO STATE!
  const waterSystemRef = useRef<THREE.Group | null>(null);
  const waterParticlesRef = useRef<THREE.Points | null>(null);
  const waterParticleIndicesRef = useRef<number[]>([]);
  const materialRef = useRef<THREE.PointsMaterial | null>(null);
  const animationIdRef = useRef<number | null>(null);
  const clockRef = useRef(new THREE.Clock());
  const initializationRef = useRef<boolean>(false);
  
  // ✅ NEW: Positioning state
  const [waterPosition, setWaterPosition] = useState<THREE.Vector3>(new THREE.Vector3(0, 0, -5));
  const [positionCalculated, setPositionCalculated] = useState(false);

  // Animation state ref (no React state to avoid re-renders)
  const animationStateRef = useRef({
    time: 0,
    isAnimating: false
  });

  // Configuration refs (no re-renders during animation)
  const waterParamsRef = useRef({
    minCoverageRadius: 12,        // Current pond radius
    maxCoverageRadius: 28,        // 2100 resilient marsh scenario
    startYear,
    endYear,
    baseWaterElevation: 1.5,      // Base water level
    maxFloodRise: maxWaterRise,   // Maximum rise by 2100
    baseParticleSize: particleSize,
    maxParticleSize: particleSize * particleSizeMultiplier,
    particleColor: particleColor.clone(),
    gridResolution,
    waterSize,
    waveSpeed,
    waveAmplitude,
    floodExpansionFactor
  });

  // ✅ NEW: Calculate position using singleton (like SmokeParticleEngine)
  const calculateWaterPosition = useCallback(() => {
    const finalUniversalMode = capturedUniversalModeRef.current;
    const finalUserPosition = capturedUserPositionRef.current;
    
    const positionResult = PositioningSystemSingleton.getExperiencePosition(
      experienceId,
      {
        gpsPosition: finalUserPosition,
        isUniversalMode: finalUniversalMode
      }
    );

    if (positionResult) {
      const freshPosition = positionResult.relativeToUser.clone();
      setWaterPosition(freshPosition);
      setPositionCalculated(true);
      
      // Lock position after successful positioning
      if (lockPosition) {
        positionLockedRef.current = true;
      }

      console.log(`✅ ${experienceId}: Water position calculated:`, {
        freshPosition: freshPosition.toArray(),
        rotation: [positionResult.rotation.x, positionResult.rotation.y, positionResult.rotation.z],
        scale: positionResult.scale,
        universalMode: positionResult.isUsingDebugMode,
        distance: positionResult.distanceFromUser?.toFixed(1) + 'm'
      });

      return {
        success: true,
        position: freshPosition,
        result: positionResult
      };
    } else {
      console.warn(`⚠️ ${experienceId}: No position result from positioning system`);
      return {
        success: false,
        position: null,
        result: null
      };
    }
  }, [experienceId, lockPosition]);

  // ✅ NEW: Force reposition function (like SmokeParticleEngine)
  const forceReposition = useCallback((currentDebugMode: boolean) => {
    if (!waterSystemRef.current) {
      return;
    }
    
    const finalUniversalMode = capturedUniversalModeRef.current;
    const finalUserPosition = capturedUserPositionRef.current;
    
    const positionResult = PositioningSystemSingleton.getExperiencePosition(
      experienceId,
      {
        gpsPosition: finalUserPosition,
        isUniversalMode: finalUniversalMode
      },
      {
        useDebugOverride: currentDebugMode // Force debug override
      }
    );

    if (positionResult && waterSystemRef.current) {
      const newPosition = positionResult.relativeToUser.clone();
      setWaterPosition(newPosition);
      
      // Update the group position directly
      waterSystemRef.current.position.copy(newPosition);
    }
  }, [experienceId]);

  //for Scaling the entire system
// ✅ NEW: Apply scale to entire water system
useEffect(() => {
  console.log('🔧 Scale effect triggered:', { scale, hasWaterSystem: !!waterSystemRef.current });
  
  if (waterSystemRef.current) {
    console.log('🔧 Before scale:', waterSystemRef.current.scale.toArray());
    waterSystemRef.current.scale.setScalar(scale);
    console.log('🔧 After scale:', waterSystemRef.current.scale.toArray());
    console.log(`🌊 WaterParticleEngine: ${experienceId} scaled to ${scale}x`);
  }
}, [scale, experienceId]);

// ✅ ADD: Apply rotation to entire water system
useEffect(() => {
  console.log('🔧 Rotation effect triggered:', { 
    rotation: [rotation.x, rotation.y, rotation.z], 
    hasWaterSystem: !!waterSystemRef.current 
  });
  
  if (waterSystemRef.current) {
    console.log('🔧 Before rotation:', waterSystemRef.current.rotation.toArray());
    waterSystemRef.current.rotation.copy(rotation);
    console.log('🔧 After rotation:', waterSystemRef.current.rotation.toArray());
    console.log(`🌊 WaterParticleEngine: ${experienceId} rotated to [${rotation.x.toFixed(2)}, ${rotation.y.toFixed(2)}, ${rotation.z.toFixed(2)}]`);
  }
}, [rotation, experienceId]);

  // ✅ NEW: Debug mode change handler (like SmokeParticleEngine)
  useEffect(() => {
    debugModeManager.initialize();
    
    const handleDebugModeChange = (event: CustomEvent) => {
      const newDebugMode = event.detail.enabled;
      const previousDebugMode = debugMode;
      
      setDebugMode(newDebugMode);
      
      // Force reposition if debug mode actually changed and water is ready
      if (previousDebugMode !== newDebugMode && waterSystemRef.current) {
        forceReposition(newDebugMode);
      }
    };
    
    debugModeManager.addEventListener('debugModeChanged', handleDebugModeChange as EventListener);
    setDebugMode(debugModeManager.debugMode);
    
    return () => {
      debugModeManager.removeEventListener('debugModeChanged', handleDebugModeChange as EventListener);
    };
  }, [debugMode, experienceId, forceReposition]);

  // ✅ NEW: Position update effect (only if not locked)
  useEffect(() => {
    if (lockPosition && positionLockedRef.current) {
      return;
    }

    if (positionCalculated) {
      return;
    }

    if (!lockPosition) {
      calculateWaterPosition();
    }
  }, [userPosition, isUniversalMode, contextUniversalMode, lockPosition, experienceId, positionCalculated, calculateWaterPosition]);

  // Create simple pond shape for water mask
  const createSimplePondShape = useCallback(() => {
    const radius = 15; // 15 meter radius pond
    const segments = 16;
    const points: { x: number; z: number }[] = [];
    
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      points.push({
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius
      });
    }
    
    return points;
  }, []);

  // Point-in-polygon test
  const pointInPolygon = useCallback((x: number, z: number, polygon: { x: number; z: number }[]) => {
    let inside = false;
    
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x, zi = polygon[i].z;
      const xj = polygon[j].x, zj = polygon[j].z;
      
      if (((zi > z) !== (zj > z)) && (x < (xj - xi) * (z - zi) / (zj - zi) + xi)) {
        inside = !inside;
      }
    }
    
    return inside;
  }, []);

  // Enhanced water particles animation with tidal expansion
const updateWaterParticles = useCallback((time: number) => {
  if (!waterParticlesRef.current || !waterParticleIndicesRef.current.length) return;

  const positions = waterParticlesRef.current.geometry.attributes.position.array as Float32Array;
  
  // Calculate current flood progress (0 = 2030, 1 = 2100)
  const floodProgress = floodLevel / waterParamsRef.current.maxFloodRise;
  
  // ✅ NEW: Tidal expansion - pond grows with flood level
  const baseRadius = 1.0; // Base pond size
  const maxExpansion = 1.8; // Pond can grow to 1.8x original size by 2100
  const currentExpansion = baseRadius + (floodProgress * (maxExpansion - baseRadius));
  
  // Current flood elevation
  const currentFloodElevation = waterParamsRef.current.baseWaterElevation + 
                               (floodProgress * waterParamsRef.current.maxFloodRise);
  
  // ✅ FIXED: Use the global pond shape constant
  const expandedPolygon = KENILWORTH_POND_SHAPE.map(point => ({
    x: point.x * currentExpansion, // Scale X coordinate
    z: point.z * currentExpansion  // Scale Z coordinate  
  }));
  
  for (let i = 0; i < waterParticleIndicesRef.current.length; i++) {
    const particleIndex = waterParticleIndicesRef.current[i];
    const vertexIndex = particleIndex * 3;
    
    const x = positions[vertexIndex];
    const z = positions[vertexIndex + 2];
    
    // ✅ NEW: Check if particle is within expanded boundary
    const isInExpandedBoundary = pointInPolygon(x, z, expandedPolygon);
    
    if (isInExpandedBoundary) {
      // Wave animation for particles within flood boundary
      const waveHeight = Math.sin(x * 0.1 + time * 2) * Math.cos(z * 0.1 + time * 2) * waterParamsRef.current.waveAmplitude;
      
      // Particles rise with flood level
      positions[vertexIndex + 1] = currentFloodElevation + waveHeight;
    } else {
      // ✅ NEW: Particles outside boundary sink below ground (hidden)
      positions[vertexIndex + 1] = currentFloodElevation - 5; // 5m below flood level
    }
  }
  
  // Mark attributes for update
  waterParticlesRef.current.geometry.attributes.position.needsUpdate = true;
  
  // Update material properties based on flood level
  if (materialRef.current) {
    const depthFactor = floodLevel / waterParamsRef.current.maxFloodRise;
    
    // Deeper water = darker blue
    const blueIntensity = 0.8 + (depthFactor * 0.2);
    materialRef.current.color.setRGB(0.1, 0.4, blueIntensity);
    
    // Particles get slightly bigger with more flood
    const floodSizeMultiplier = 1 + (depthFactor * 0.5);
    materialRef.current.size = waterParamsRef.current.baseParticleSize * 4 * floodSizeMultiplier;
  }
  
  // ✅ NEW: Debug logging (remove after testing)
  if (Math.random() < 0.01) { // Log occasionally to avoid spam
    console.log(`🌊 Flood update: Level ${floodLevel.toFixed(2)}, Expansion ${currentExpansion.toFixed(2)}x, Elevation ${currentFloodElevation.toFixed(2)}m`);
  }
  
}, [floodLevel, pointInPolygon, scale]); // ✅ FIXED: Added scale dependency

 const createWaterParticleSystem = useCallback(async () => {
  // Prevent double initialization
  if (initializationRef.current) {
    return;
  }
  initializationRef.current = true;
  
  try {
    if (onProgress) onProgress(10);
    
    // ✅ Calculate position using singleton BEFORE creating system
    if (!positionCalculated) {
      const success = calculateWaterPosition();
      if (!success) {
        throw new Error(`Failed to calculate position for ${experienceId}`);
      }
    }
    
    // Create main group
    const waterGroup = new THREE.Group();
    waterGroup.name = `WaterParticleSystem-${experienceId}`;
    waterSystemRef.current = waterGroup;
    
    if (onProgress) onProgress(30);
    
    // ✅ TRACED POND SHAPE: Use the global constant
    console.log('🏞️ Using traced Kenilworth pond shape from satellite image');
    
    // ✅ FIXED: Use the global constant instead of local variable
    const pondPolygon = KENILWORTH_POND_SHAPE;
    
    console.log(`🏞️ Traced pond with ${pondPolygon.length} boundary points`);
    console.log(`🏞️ Pond dimensions: ~60m × ~80m`);
    
    if (onProgress) onProgress(50);
    
    // Calculate pond bounding box for grid sizing
    const bounds = pondPolygon.reduce(
      (acc, point) => ({
        minX: Math.min(acc.minX, point.x),
        maxX: Math.max(acc.maxX, point.x),
        minZ: Math.min(acc.minZ, point.z),
        maxZ: Math.max(acc.maxZ, point.z)
      }),
      { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity }
    );
    
    const pondWidth = bounds.maxX - bounds.minX;
    const pondHeight = bounds.maxZ - bounds.minZ;
    
    console.log(`🏞️ Calculated bounds: ${pondWidth.toFixed(1)}m × ${pondHeight.toFixed(1)}m`);
    
    const particleSpacing = 0.5; // ← Control particle density here (1.0=dense, 2.0=sparse)
    const waterPositions: number[] = [];
    const waterSizes: number[] = [];
    const waterColors: number[] = [];
    const waterParticleIndices: number[] = [];
    
    let particleIndex = 0;
    
    // Create grid covering the traced pond bounds
    const gridStepsX = Math.ceil(pondWidth / particleSpacing);
    const gridStepsZ = Math.ceil(pondHeight / particleSpacing);
    
    console.log(`🏞️ Creating ${gridStepsX}×${gridStepsZ} particle grid with ${particleSpacing}m spacing`);
    
    for (let i = 0; i <= gridStepsX; i++) {
      for (let j = 0; j <= gridStepsZ; j++) {
        const x = bounds.minX + (i * particleSpacing);
        const z = bounds.minZ + (j * particleSpacing);
        
        // ✅ Only create particles inside the traced pond shape
        if (pointInPolygon(x, z, pondPolygon)) {
          waterPositions.push(x, waterParamsRef.current.baseWaterElevation, z);
          waterSizes.push(waterParamsRef.current.baseParticleSize * 2);
          
          // Color variation based on distance from center (red circle = anchor)
          const distanceFromAnchor = Math.sqrt(x * x + z * z);
          const maxDistance = Math.max(pondWidth, pondHeight) / 2;
          const depthFactor = 1 - Math.min(distanceFromAnchor / maxDistance, 1);
          
          // Deeper areas near anchor = darker blue
          const blueVariation = 0.8 + depthFactor * 0.4;
          waterColors.push(
            0.1 * (0.5 + depthFactor * 0.5),  // R
            0.4 * (0.7 + depthFactor * 0.3),  // G  
            1.0 * blueVariation               // B
          );
          
          waterParticleIndices.push(particleIndex);
          particleIndex++;
        }
      }
    }
    
    waterParticleIndicesRef.current = waterParticleIndices;
    
    console.log(`🏞️ Created ${particleIndex} particles filling traced Kenilworth pond shape`);
    
    if (onProgress) onProgress(70);
    
    // Create geometry with only water particles
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(waterPositions);
    const sizes = new Float32Array(waterSizes);
    const colors = new Float32Array(waterColors);
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    
    if (onProgress) onProgress(80);
    
    // Create material
    const material = new THREE.PointsMaterial({
      size: waterParamsRef.current.baseParticleSize * 4,
      sizeAttenuation: true,
      transparent: true,
      alphaTest: 0.5,
      vertexColors: true,
      opacity: opacity
    });
    materialRef.current = material;
    
    // Create particle system
    const particleSystem = new THREE.Points(geometry, material);
    waterParticlesRef.current = particleSystem;
    waterGroup.add(particleSystem);
    
    // ✅ Apply singleton-calculated position
    waterGroup.position.copy(waterPosition);
    
    // ✅ Apply initial rotation and scale
    waterGroup.rotation.copy(rotation);
    waterGroup.scale.setScalar(scale);
    console.log(`🌊 Applied initial scale ${scale} and rotation to water system`);
   
    // Add to scene
    scene.add(waterGroup);
    
    if (onProgress) onProgress(100);
    
    console.log(`✅ WaterParticleEngine: ${experienceId} traced pond particle system created successfully`);
    
    if (onReady) onReady();
    
  } catch (error) {
    console.error(`❌ WaterParticleEngine: ${experienceId} creation failed:`, error);
    if (onError) onError(`Failed to create water particle system for ${experienceId}: ${error}`);
  }
}, [
  scene,
  onProgress,
  onReady,
  onError,
  experienceId,
  waterPosition,
  positionCalculated,
  calculateWaterPosition,
  opacity,
  pointInPolygon,
  scale,
  rotation
]);

  // Animation loop (following engine pattern)
  const animate = useCallback(() => {
    if (!animationStateRef.current.isAnimating) return;

    const deltaTime = clockRef.current.getDelta();
    animationStateRef.current.time += deltaTime;
    
    updateWaterParticles(animationStateRef.current.time);
    
    if (animationStateRef.current.isAnimating) {
      animationIdRef.current = requestAnimationFrame(animate);
    }
  }, [updateWaterParticles]);

  // Start/stop animation
  const startAnimation = useCallback(() => {
    if (animationStateRef.current.isAnimating) return;
    
    animationStateRef.current.isAnimating = true;
    clockRef.current.start();
    animate();
  }, [animate]);

  const stopAnimation = useCallback(() => {
    animationStateRef.current.isAnimating = false;
    if (animationIdRef.current) {
      cancelAnimationFrame(animationIdRef.current);
      animationIdRef.current = null;
    }
    clockRef.current.stop();
  }, []);

  // Cleanup function
  const cleanup = useCallback(() => {
    stopAnimation();
    
    // Reset initialization flag
    initializationRef.current = false;
    
    // Reset animation state
    animationStateRef.current = { time: 0, isAnimating: false };
    
    // Reset positioning state
    setPositionCalculated(false);
    positionLockedRef.current = false;
    
    // Clear particle indices
    waterParticleIndicesRef.current = [];
    
    // Dispose material
    if (materialRef.current) {
      materialRef.current.dispose();
      materialRef.current = null;
    }
    
    // Remove from scene and dispose geometry
    if (waterSystemRef.current) {
      scene.remove(waterSystemRef.current);
      
      waterSystemRef.current.traverse((child) => {
        if (child instanceof THREE.Points) {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(mat => mat.dispose());
            } else {
              child.material.dispose();
            }
          }
        }
      });
      
      waterSystemRef.current.clear();
      waterSystemRef.current = null;
    }
    
    waterParticlesRef.current = null;
    
    console.log(`✅ WaterParticleEngine: ${experienceId} cleanup completed`);
  }, [scene, stopAnimation, experienceId]);

  // Main initialization effect - STABLE
  useEffect(() => {
    let isMounted = true;
    
    const initialize = async () => {
      if (!isMounted) return;
      
      try {
        await createWaterParticleSystem();
        
        if (enabled && isMounted) {
          startAnimation();
        }
      } catch (error) {
        console.error(`❌ WaterParticleEngine: Failed to initialize ${experienceId}:`, error);
        if (onError) onError(`Water particle initialization failed for ${experienceId}: ${error}`);
      }
    };
    
    initialize();
    
    return () => {
      isMounted = false;
      cleanup();
    };
  }, []); // EMPTY DEPENDENCY ARRAY - initialize once only

  // Handle enabled state changes
  useEffect(() => {
    if (!waterSystemRef.current) return;
    
    if (enabled) {
      startAnimation();
      waterSystemRef.current.visible = true;
    } else {
      stopAnimation();
      waterSystemRef.current.visible = false;
    }
  }, [enabled, startAnimation, stopAnimation]);

  // ✅ NEW: Handle position changes when water system is ready
  useEffect(() => {
    if (waterSystemRef.current && positionCalculated) {
      waterSystemRef.current.position.copy(waterPosition);
    }
  }, [waterPosition, positionCalculated, experienceId]);

  return null; // Engine component renders nothing directly
};

export default WaterParticleEngine;