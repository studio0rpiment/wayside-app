// engines/WaterParticleEngine.tsx - Reformed to avoid re-rendering issues
import React, { useRef, useEffect, useCallback, useState } from 'react';
import * as THREE from 'three';
import { getAssetPath } from '../../utils/assetPaths';
import { PositioningSystemSingleton } from '../../utils/coordinate-system/PositioningSystemSingleton';
import { useGeofenceBasics } from '../../context/GeofenceContext';
import { debugModeManager } from '../../utils/DebugModeManager';
import { debugLogger } from '../debug/WaterSliderDebug';
import { loadShader } from '../../utils/shaderLoader';

// Pond polygon shape
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
  
  // Positioning via singleton
  experienceId: string;
  isUniversalMode?: boolean;
  lockPosition?: boolean;
  
  // ✅ NEW: Ref-based props to avoid re-renders
  scaleRef?: React.MutableRefObject<number>;
  rotationRef?: React.MutableRefObject<THREE.Euler>;
  floodLevelRef?: React.MutableRefObject<number>;
  
  // ✅ DEPRECATED: These cause re-renders, replaced by refs above
  scale?: number;
  rotation?: THREE.Euler;
  floodLevel?: number;
  
  // Water-specific controls (static)
  particleColor?: THREE.Color;
  particleSize?: number;
  opacity?: number;
  particleSpacing?: number;
  
  // Animation controls (static)
  waveSpeed?: number;
  waveAmplitude?: number;
  
  // Performance options (static)
  gridResolution?: number;
  waterSize?: number;
  
  // Water system parameters (static)
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
  
  // Positioning props
  experienceId,
  isUniversalMode = false,
  lockPosition = true,
  
  // ✅ NEW: Ref-based props (no re-renders)
  scaleRef,
  rotationRef,
  floodLevelRef,
  
  // ✅ FALLBACK: Legacy props for backward compatibility
  scale = 1.0,
  rotation = new THREE.Euler(0, 0, 0),
  floodLevel = 0,
  
  // Static water controls
  particleColor,
  particleSize = 0.3,
  opacity = 1.0,
  particleSpacing = 1.0,
  
  // Static animation controls
  waveSpeed = 0.001,
  waveAmplitude = 1.0,
  
  // Static performance options
  gridResolution = 50,
  waterSize = 40,
  
  // Static water system parameters
  maxWaterRise = 2,
  startYear = 2030,
  endYear = 2100,
  floodExpansionFactor = 3.0,
  particleSizeMultiplier = 2.0,
  
  onReady,
  onError,
  onProgress
}) => {
  const componentIdRef = useRef(Math.random().toString(36).substr(2, 9));
  console.log(`🌊 WaterParticleEngine: Initializing ${experienceId} (ID: ${componentIdRef.current})`);

  // =================================================================
  // CAPTURED VALUES - Set once, never change
  // =================================================================
  
  const capturedUniversalModeRef = useRef<boolean | null>(null);
  const capturedUserPositionRef = useRef<[number, number] | null>(null);
  const positionLockedRef = useRef(false);

  // Get geofence context for initial values ONLY
  const { userPosition, isUniversalMode: contextUniversalMode } = useGeofenceBasics();
  
  // ✅ Capture values ONCE on first render
  if (capturedUniversalModeRef.current === null) {
    capturedUniversalModeRef.current = isUniversalMode || contextUniversalMode;
    capturedUserPositionRef.current = userPosition;
  }

  // =================================================================
  // INTERNAL REFS - Never cause re-renders
  // =================================================================
  
  // Create internal refs if not provided by parent
  const internalScaleRef = useRef(scale);
  const internalRotationRef = useRef(rotation.clone());
  const internalFloodLevelRef = useRef(floodLevel);
  
  // ✅ Use provided refs or fallback to internal refs
  const currentScaleRef = scaleRef || internalScaleRef;
  const currentRotationRef = rotationRef || internalRotationRef;
  const currentFloodLevelRef = floodLevelRef || internalFloodLevelRef;
  
  // Update internal refs from props (for backward compatibility)
  useEffect(() => {
    if (!scaleRef) internalScaleRef.current = scale;
    if (!rotationRef) internalRotationRef.current = rotation.clone();
    if (!floodLevelRef) internalFloodLevelRef.current = floodLevel;
  }, [scale, rotation, floodLevel, scaleRef, rotationRef, floodLevelRef]);

  // Debug mode state
  const [debugMode, setDebugMode] = useState(false);

  // 3D object refs - NO STATE!
  const waterSystemRef = useRef<THREE.Group | null>(null);
  const waterParticlesRef = useRef<THREE.Points | null>(null);
  const waterParticleIndicesRef = useRef<number[]>([]);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const animationIdRef = useRef<number | null>(null);
  const clockRef = useRef(new THREE.Clock());
  const initializationRef = useRef<boolean>(false);
  
  // ✅ Positioning state - minimal, UI-only
  const [waterPosition, setWaterPosition] = useState<THREE.Vector3>(new THREE.Vector3(0, 0, -5));
  const [positionCalculated, setPositionCalculated] = useState(false);

  // Animation state ref (no React state to avoid re-renders)
  const animationStateRef = useRef({
    time: 0,
    isAnimating: false
  });

  // ✅ Static water parameters ref
  const waterParamsRef = useRef({
    minCoverageRadius: 12,
    maxCoverageRadius: 28,
    startYear,
    endYear,
    baseWaterElevation: 1.5,
    maxFloodRise: maxWaterRise,
    baseParticleSize: particleSize,
    maxParticleSize: particleSize * particleSizeMultiplier,
    particleColor: particleColor,
    gridResolution,
    waterSize,
    waveSpeed,
    waveAmplitude,
    floodExpansionFactor
  });

  // =================================================================
  // DEBUG LOGGING FOR DEBUG WINDOW
  // =================================================================
  
  useEffect(() => {
    const currentFloodLevel = currentFloodLevelRef.current;
    const currentScale = currentScaleRef.current;
    
    console.log(`🔍 Engine useEffect triggered: floodLevel = ${currentFloodLevel}, scale = ${currentScale}`);
    
    debugLogger.log('Engine Flood Level Ref', currentFloodLevel.toFixed(3));
    debugLogger.log('Engine Scale Ref', currentScale.toFixed(3));
    
    const floodProgress = currentFloodLevel / waterParamsRef.current.maxFloodRise;
    debugLogger.log('Engine Flood Progress', `${(floodProgress * 100).toFixed(1)}%`);
    
    const baseRadius = 1.0;
    const maxExpansion = 1.8;
    const currentExpansion = baseRadius + (floodProgress * (maxExpansion - baseRadius));
    debugLogger.log('Engine Water Expansion', `${currentExpansion.toFixed(3)}x`);
    
    const totalScale = currentScale * currentExpansion;
    debugLogger.log('Engine Total Scale', `${currentScale.toFixed(3)} × ${currentExpansion.toFixed(3)} = ${totalScale.toFixed(3)}`);
  }, []); // ✅ EMPTY DEPS - only log on mount

  // =================================================================
  // POSITIONING SYSTEM
  // =================================================================

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
      
      if (lockPosition) {
        positionLockedRef.current = true;
      }

      return {
        success: true,
        position: freshPosition,
        result: positionResult
      };
    } else {
      return {
        success: false,
        position: null,
        result: null
      };
    }
  }, [experienceId, lockPosition]);

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
        useDebugOverride: currentDebugMode
      }
    );

    if (positionResult && waterSystemRef.current) {
      const newPosition = positionResult.relativeToUser.clone();
      setWaterPosition(newPosition);
      waterSystemRef.current.position.copy(newPosition);
    }
  }, [experienceId]);

  // ✅ Apply transforms from refs in animation loop, not React effects
  // This prevents re-renders while keeping transforms updated

  // Debug mode change handler
  useEffect(() => {
    debugModeManager.initialize();
    
    const handleDebugModeChange = (event: CustomEvent) => {
      const newDebugMode = event.detail.enabled;
      const previousDebugMode = debugMode;
      
      setDebugMode(newDebugMode);
      
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

  // Position update effect - STABLE
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
  }, []); // ✅ EMPTY DEPS - calculate once only

  // =================================================================
  // WATER PARTICLE UTILITIES
  // =================================================================

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

  // ✅ Enhanced water particles animation with ref-based updates
  const updateWaterParticles = useCallback((time: number) => {
    if (!waterParticlesRef.current || !waterParticleIndicesRef.current.length) return;

    const positions = waterParticlesRef.current.geometry.attributes.position.array as Float32Array;
    
    // ✅ Read from refs - always gets current values without re-renders
    const currentFloodLevel = currentFloodLevelRef.current;
    const currentScale = currentScaleRef.current;
    const currentRotation = currentRotationRef.current;
    
    // Apply transforms to water system
    if (waterSystemRef.current) {
      // Calculate flood-based expansion
      const floodProgress = currentFloodLevel / waterParamsRef.current.maxFloodRise;
      const baseRadius = 1.0;
      const maxExpansion = 1.8;
      const currentExpansion = baseRadius + (floodProgress * (maxExpansion - baseRadius));
      
      // Apply combined scale
      const totalScale = currentScale * currentExpansion;
      waterSystemRef.current.scale.setScalar(totalScale);
      
  const originalRotation = currentRotationRef.current.clone();
  
  // Reduce X rotation as scale increases to maintain visual appearance
  const rotationCompensation = (1- totalScale) * 0.1; // Adjust this multiplier as needed
  originalRotation.x += rotationCompensation;
  
  waterSystemRef.current.rotation.copy(originalRotation);
    }

    if (materialRef.current) {
  materialRef.current.uniforms.time.value = time;
  
  const floodProgress = currentFloodLevel / waterParamsRef.current.maxFloodRise;
  
  // Update size based on flood
  const baseSize = waterParamsRef.current.baseParticleSize * 4;
  const floodSizeMultiplier = baseSize * (1 + floodProgress * 2);
  materialRef.current.uniforms.sizeMultiplier.value = floodSizeMultiplier;
  
  // Update color based on flood
  const waterColor = new THREE.Color(0.2, 0.6, 0.9);
  waterColor.multiplyScalar(1.0 - floodProgress * 0.3);
  materialRef.current.uniforms.baseColor.value = waterColor;
}
    
    // Current flood elevation
    const floodProgress = currentFloodLevel / waterParamsRef.current.maxFloodRise;
    const currentFloodElevation = waterParamsRef.current.baseWaterElevation + 
                                 (floodProgress * waterParamsRef.current.maxFloodRise);
    
    // Tidal expansion - pond grows with flood level
    const baseRadius = 1.0;
    const maxExpansion = 1.8;
    const currentExpansion = baseRadius + (floodProgress * (maxExpansion - baseRadius));
    
    // Use the global pond shape constant
    const expandedPolygon = KENILWORTH_POND_SHAPE.map(point => ({
      x: point.x * currentExpansion,
      z: point.z * currentExpansion  
    }));
    
    for (let i = 0; i < waterParticleIndicesRef.current.length; i++) {
      const particleIndex = waterParticleIndicesRef.current[i];
      const vertexIndex = particleIndex * 3;
      
      const x = positions[vertexIndex];
      const z = positions[vertexIndex + 2];
      
      // Check if particle is within expanded boundary
      const isInExpandedBoundary = pointInPolygon(x, z, expandedPolygon);
      
      if (isInExpandedBoundary) {
        // Wave animation for particles within flood boundary
        const waveHeight = Math.sin(x * 0.1 + time * 2) * Math.cos(z * 0.1 + time * 2) * waterParamsRef.current.waveAmplitude;
        
        // Particles rise with flood level
        positions[vertexIndex + 1] = currentFloodElevation + waveHeight;
      } else {
        // Particles outside boundary sink below ground (hidden)
        positions[vertexIndex + 1] = currentFloodElevation - 5;
      }
    }
    
    // Mark attributes for update
    waterParticlesRef.current.geometry.attributes.position.needsUpdate = true;
    
    // Update material properties based on flood level
   if (materialRef.current) {
  const depthFactor = currentFloodLevel / waterParamsRef.current.maxFloodRise;
  
  // Keep it muddy - darker/murkier as flood level increases
      const baseMuddy = 0.2;
      const floodEffect = depthFactor * 0.08; // Gets murkier with more flood
      
    materialRef.current.uniforms.baseColor.value.setRGB(
  baseMuddy + floodEffect,           // R: Brown component
  (baseMuddy + 0.08) + floodEffect, // G: Green component  
  (baseMuddy + 0.2) + floodEffect   // B: Blue component (muddy blue)
);
      
      // Particles get slightly bigger with more flood
      const floodSizeMultiplier = 1 + (depthFactor * 0.5);
      materialRef.current.uniforms.sizeMultiplier.value = waterParamsRef.current.baseParticleSize * 4 * floodSizeMultiplier;
    }
  }, [pointInPolygon]);

  // =================================================================
  // WATER PARTICLE SYSTEM CREATION
  // =================================================================

  const createWaterParticleSystem = useCallback(async () => {
    // Prevent double initialization
    if (initializationRef.current) {
      return;
    }
    initializationRef.current = true;
    
    try {
      if (onProgress) onProgress(10);
      
      // Calculate position using singleton BEFORE creating system
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
      
      const pondPolygon = KENILWORTH_POND_SHAPE;
      
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
      
      const particleSpacing = 0.5;
      const waterPositions: number[] = [];
      const waterSizes: number[] = [];
      const waterColors: number[] = [];
      const waterParticleIndices: number[] = [];
      
      let particleIndex = 0;
      
      // Create grid covering the traced pond bounds
    const gridStepsX = Math.ceil(pondWidth / particleSpacing);
const gridStepsZ = Math.ceil(pondHeight / particleSpacing);

for (let i = 0; i <= gridStepsX; i++) {
  for (let j = 0; j <= gridStepsZ; j++) {
    const x = bounds.minX + (i * particleSpacing);
    const z = bounds.minZ + (j * particleSpacing);
    
    // Only create particles inside the traced pond shape
    if (pointInPolygon(x, z, pondPolygon)) {
      // ✅ Add random variation to break up grid lines
      const randomOffsetX = (Math.random() - 0.5) * 0.8; // ±0.15 units
      const randomOffsetY = (Math.random() - 0.5) * 0.8; // ±0.05 units  
      const randomOffsetZ = (Math.random() - 0.5) * 0.8; // ±0.15 units
      
      waterPositions.push(
        x + randomOffsetX, 
        waterParamsRef.current.baseWaterElevation + randomOffsetY, 
        z + randomOffsetZ
      );
      
      const baseSizeMultiplier = 2; // Your current multiplier
      const sizeVariation = (Math.random() - 0.5) * 1.2; // ±0.4 variation
      const finalSize = waterParamsRef.current.baseParticleSize * (baseSizeMultiplier + sizeVariation);
      
      waterSizes.push(Math.max(0.1, finalSize)); 
            
            // Color variation based on distance from center
            const distanceFromAnchor = Math.sqrt(x * x + z * z);
            const maxDistance = Math.max(pondWidth, pondHeight) / 2;
            const depthFactor = 1 - Math.min(distanceFromAnchor / maxDistance, 1);
            
            // Deeper areas near anchor = darker blue
          const muddyBase = 0.15; // Base muddy tone
          const depthDarkening = depthFactor * 0.1; // How much darker the middle gets

          waterColors.push(
            muddyBase + depthDarkening,           // R: Brown component (0.15 to 0.25)
            (muddyBase - 0.05) + depthDarkening, // G: Slightly green-ish (0.12 to 0.22)  
            (muddyBase - 0.15) + depthDarkening * 0.5  // B: Much less blue (0.08 to 0.13)
          );
            
            waterParticleIndices.push(particleIndex);
            particleIndex++;
          }
        }
      }
      
      waterParticleIndicesRef.current = waterParticleIndices;
      
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

    const vertexShader = await loadShader('/src/shaders/water.vert');
    const fragmentShader = await loadShader('/src/shaders/water.frag');
      
      // Create material
 // ✅ Simple shader material that matches your working geometry
const material = new THREE.ShaderMaterial({
  uniforms: {
    time: { value: 0.0 },
    sizeMultiplier: { value: 4.0 }, // Match your original size * 4
    opacity: { value: 1 },
    baseColor: { value: new THREE.Color().setHSL(0.08, 0.6, 0) }
  },
  vertexShader,
  fragmentShader,
  transparent: true,
  depthWrite: false,
  vertexColors: true, 
  blending: THREE.NormalBlending // Better for water effects
});
    
    materialRef.current = material;

    setTimeout(() => {
  if (materialRef.current) {
    console.log('🎨 All shader uniforms:', Object.keys(materialRef.current.uniforms));
    console.log('🎨 Full uniform values:', materialRef.current.uniforms);
  }
}, 1000);

      
      // Create particle system
      const particleSystem = new THREE.Points(geometry, material);
      waterParticlesRef.current = particleSystem;
      waterGroup.add(particleSystem);
      
      // Apply singleton-calculated position
      waterGroup.position.copy(waterPosition);
      
      // ✅ Apply initial transforms from refs
      waterGroup.rotation.copy(currentRotationRef.current);
      waterGroup.scale.setScalar(currentScaleRef.current);
     
      // Add to scene
      scene.add(waterGroup);
      
      if (onProgress) onProgress(100);
      
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
    pointInPolygon
  ]);

  // =================================================================
  // ANIMATION LOOP
  // =================================================================

  const animate = useCallback(() => {
    if (!animationStateRef.current.isAnimating) return;

    const deltaTime = clockRef.current.getDelta();
    animationStateRef.current.time += deltaTime;
    
    updateWaterParticles(animationStateRef.current.time);
    
    if (animationStateRef.current.isAnimating) {
      animationIdRef.current = requestAnimationFrame(animate);
    }
  }, [updateWaterParticles]);

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

  // =================================================================
  // CLEANUP
  // =================================================================

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
  }, [scene, stopAnimation, experienceId]);

  // =================================================================
  // EFFECTS - MINIMAL AND STABLE
  // =================================================================

  // ✅ Main initialization effect - STABLE (empty deps)
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
  }, []); // ✅ EMPTY DEPENDENCY ARRAY - initialize once only

  // ✅ Handle enabled state changes - STABLE
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

  // ✅ Handle position changes when water system is ready - STABLE
  useEffect(() => {
    if (waterSystemRef.current && positionCalculated) {
      waterSystemRef.current.position.copy(waterPosition);
    }
  }, [waterPosition, positionCalculated]);

  return null; // Engine component renders nothing directly
};

export default React.memo(WaterParticleEngine);