// engines/WaterParticleEngine.tsx - DEBUG VERSION
import React, { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { getAssetPath } from '../../utils/assetPaths';
import { loadHeightmap } from '../../utils/terrainUtils';
import { gpsToLocalCoordinates } from '../../utils/geoArUtils';

interface WaterParticleEngineProps {
  scene: THREE.Scene;
  enabled: boolean;
  floodLevel: number; // 0-100 representing 2030-2100 progression
  
  // Positioning controls
  position?: THREE.Vector3;
  rotation?: THREE.Euler;
  scale?: number;
  
  // Visual controls
  particleColor?: THREE.Color;
  particleSize?: number;
  opacity?: number;
  
  // Animation controls
  waveSpeed?: number;
  waveAmplitude?: number;
  
  // Performance options
  isArMode?: boolean;
  gridResolution?: number; // Particle density
  waterSize?: number; // Coverage area size
  
  // Pond configuration
  anchorGPS?: [number, number]; // GPS reference point for polygon
  
  // Callbacks
  onReady?: () => void;
  onError?: (error: string) => void;
  onProgress?: (progress: number) => void;
}

interface PondPolygonPoint {
  x: number;
  z: number;
}

const WaterParticleEngine: React.FC<WaterParticleEngineProps> = ({
  scene,
  enabled,
  floodLevel,
  
  position = new THREE.Vector3(0, 0, 0),
  rotation = new THREE.Euler(0, 0, 0),
  scale = 1,
  
  particleColor = new THREE.Color().setHSL(210/360, 0.8, 0.7),
  particleSize = 0.12,
  opacity = 1.0,
  
  waveSpeed = 0.0008,
  waveAmplitude = 0.25,
  
  isArMode = false,
  gridResolution = 50, // REDUCED for debugging
  waterSize = 40, // REDUCED for debugging
  
  anchorGPS = [-76.94269537925722, 38.912991765346206] as [number, number],
  
  onReady,
  onError,
  onProgress
}) => {
  console.log('🌊 WaterParticleEngine: DEBUG VERSION - Initializing');

  // Refs following your engine patterns
  const waterSystemRef = useRef<THREE.Group | null>(null);
  const waterParticlesRef = useRef<THREE.Points | null>(null);
  const waterParticleIndicesRef = useRef<number[]>([]);
  const materialRef = useRef<THREE.PointsMaterial | null>(null);
  const animationIdRef = useRef<number | null>(null);
  const clockRef = useRef(new THREE.Clock());
  const initializationRef = useRef<boolean>(false);
  
  // Configuration refs (no re-renders during animation)
  const waterParamsRef = useRef({
    minCoverageRadius: 12,        // Current pond radius
    maxCoverageRadius: 28,        // 2100 resilient marsh scenario
    startYear: 2030,
    endYear: 2100,
    baseWaterElevation: 1.5,      // Base water level
    maxFloodRise: 1.2,            // 1.2m rise by 2100
    baseParticleSize: particleSize,
    maxParticleSize: particleSize * 5,
    particleColor: particleColor.clone()
  });

  // Animation state ref
  const animationStateRef = useRef({
    time: 0,
    isAnimating: false
  });

  // DEBUG: Create simple circular pond for testing instead of complex polygon
  const createSimplePondShape = useCallback((): PondPolygonPoint[] => {
    console.log('🎯 DEBUG: Creating simple circular pond for testing');
    
    const radius = 15; // 15 meter radius pond
    const segments = 16;
    const points: PondPolygonPoint[] = [];
    
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      points.push({
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius
      });
    }
    
    console.log(`🎯 DEBUG: Created ${points.length} polygon points:`, points.slice(0, 3));
    return points;
  }, []);

  // Point-in-polygon test with debug logging
  const pointInPolygon = useCallback((x: number, z: number, polygon: PondPolygonPoint[]): boolean => {
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

  // Simplified water particle system creation for debugging
  const createWaterParticleSystem = useCallback(async () => {
    console.log('🌊 DEBUG: Creating simplified water particle system...');
    
    // Prevent double initialization
    if (initializationRef.current) {
      console.log('🌊 DEBUG: Already initialized, skipping...');
      return;
    }
    initializationRef.current = true;
    
    try {
      if (onProgress) onProgress(10);
      
      // Skip heightmap loading for now to debug faster
      console.log('🌊 DEBUG: Skipping heightmap for faster debugging...');
      if (onProgress) onProgress(30);
      
      // Create simple pond shape
      console.log('🎯 DEBUG: Creating simple pond shape...');
      const pondPolygon = createSimplePondShape();
      console.log(`🎯 DEBUG: Polygon created with ${pondPolygon.length} vertices`);
      if (onProgress) onProgress(50);
      
      // Create main group
      const waterGroup = new THREE.Group();
      waterSystemRef.current = waterGroup;
      
      // Create particle geometry with MUCH simpler grid
      const count = gridResolution * gridResolution;
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(count * 3);
      const sizes = new Float32Array(count);
      const colors = new Float32Array(count * 3); // Add colors for debugging
      
      // Pre-compute which particles are water vs land
      const waterParticleIndices: number[] = [];
      let index = 0;
      let waterCount = 0;
      let landCount = 0;
      
      console.log('🔍 DEBUG: Computing water mask...');
      console.log(`🔍 DEBUG: Grid: ${gridResolution}x${gridResolution} = ${count} particles`);
      console.log(`🔍 DEBUG: Water size: ${waterSize}`);
      
      for (let i = 0; i < gridResolution; i++) {
        for (let j = 0; j < gridResolution; j++) {
          // Create regular grid
          const x = (i / (gridResolution - 1) - 0.5) * waterSize;
          const z = (j / (gridResolution - 1) - 0.5) * waterSize;
          
          positions[index * 3] = x;
          positions[index * 3 + 2] = z;
          
          // Check if this particle is inside the pond polygon
          const isInPond = pointInPolygon(x, z, pondPolygon);
          
          if (isInPond) {
            // This is a water particle - position at water level
            positions[index * 3 + 1] = waterParamsRef.current.baseWaterElevation;
            waterParticleIndices.push(index);
            sizes[index] = waterParamsRef.current.baseParticleSize * 2; // Bigger for visibility
            
            // Blue color for water particles
            colors[index * 3] = 0.2;     // R
            colors[index * 3 + 1] = 0.6; // G  
            colors[index * 3 + 2] = 1.0; // B
            
            waterCount++;
          } else {
            // This is a land particle - position below ground but visible for debugging
            positions[index * 3 + 1] = -2; // Just below water level for debugging
            sizes[index] = waterParamsRef.current.baseParticleSize * 0.5;
            
            // Red color for land particles
            colors[index * 3] = 1.0;     // R
            colors[index * 3 + 1] = 0.2; // G
            colors[index * 3 + 2] = 0.2; // B
            
            landCount++;
          }
          
          index++;
        }
      }
      
      // Store water particle indices for efficient updates
      waterParticleIndicesRef.current = waterParticleIndices;
      
      console.log(`🌊 DEBUG: Water mask complete:`);
      console.log(`  - Total particles: ${count}`);
      console.log(`  - Water particles: ${waterCount}`);
      console.log(`  - Land particles: ${landCount}`);
      console.log(`  - Water percentage: ${((waterCount / count) * 100).toFixed(1)}%`);
      
      if (onProgress) onProgress(70);
      
      // Set up geometry attributes
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      if (onProgress) onProgress(80);
      
      // Create material with vertex colors for debugging
      const material = new THREE.PointsMaterial({
        size: waterParamsRef.current.baseParticleSize * 4, // Bigger for visibility
        sizeAttenuation: true,
        transparent: true,
        alphaTest: 0.5,
        vertexColors: true, // Use vertex colors for debugging
        opacity: opacity
      });
      materialRef.current = material;
      
      // Create particle system
      const particleSystem = new THREE.Points(geometry, material);
      waterParticlesRef.current = particleSystem;
      waterGroup.add(particleSystem);
      
      // Apply transforms
      waterGroup.position.copy(position);
      waterGroup.rotation.copy(rotation);
      waterGroup.scale.setScalar(scale);
      
      // Add to scene
      scene.add(waterGroup);
      
      if (onProgress) onProgress(100);
      console.log('✅ DEBUG: Water particle system created successfully');
      console.log(`✅ DEBUG: Group position: (${waterGroup.position.x}, ${waterGroup.position.y}, ${waterGroup.position.z})`);
      
      if (onReady) onReady();
      
    } catch (error) {
      console.error('❌ DEBUG: Water particle system creation failed:', error);
      if (onError) onError(`Failed to create water particle system: ${error}`);
    }
  }, [
    gridResolution, 
    waterSize, 
    createSimplePondShape, 
    pointInPolygon, 
    position, 
    rotation, 
    scale, 
    opacity, 
    scene, 
    onProgress, 
    onReady, 
    onError
  ]);

  // Simplified update function for debugging
  const updateWaterParticles = useCallback((time: number) => {
    if (!waterParticlesRef.current || !waterParticleIndicesRef.current.length) return;

    const positions = waterParticlesRef.current.geometry.attributes.position.array as Float32Array;
    
    // Calculate current flood elevation based on flood level (0-100)
    const floodProgress = floodLevel / 100;
    const currentFloodElevation = waterParamsRef.current.baseWaterElevation + 
                                 (floodProgress * waterParamsRef.current.maxFloodRise);
    
    // Simple wave animation for water particles only
    waterParticleIndicesRef.current.forEach(index => {
      const vertexIndex = index * 3;
      const x = positions[vertexIndex];
      const z = positions[vertexIndex + 2];
      
      // Simple wave animation
      const waveHeight = Math.sin(x * 0.1 + time * 2) * Math.cos(z * 0.1 + time * 2) * 0.2;
      
      // Position particle at flood level + wave
      positions[vertexIndex + 1] = currentFloodElevation + waveHeight;
    });
    
    // Mark attributes for update
    waterParticlesRef.current.geometry.attributes.position.needsUpdate = true;
    
    // Debug logging (throttled)
    if (Math.floor(time) % 2 === 0 && Math.floor(time * 10) % 10 === 0) {
      console.log(`💧 DEBUG: Animating ${waterParticleIndicesRef.current.length} water particles at flood level ${currentFloodElevation.toFixed(2)}m`);
    }
  }, [floodLevel]);

  // Animation loop
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
    console.log('🌊 DEBUG: Water particle animation started');
  }, [animate]);

  const stopAnimation = useCallback(() => {
    animationStateRef.current.isAnimating = false;
    if (animationIdRef.current) {
      cancelAnimationFrame(animationIdRef.current);
      animationIdRef.current = null;
    }
    clockRef.current.stop();
    console.log('🌊 DEBUG: Water particle animation stopped');
  }, []);

  // Cleanup function
  const cleanup = useCallback(() => {
    console.log('🧹 DEBUG: Cleaning up water particle system');
    
    stopAnimation();
    
    // Reset initialization flag
    initializationRef.current = false;
    
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
    
    console.log('✅ DEBUG: Water particle cleanup completed');
  }, [scene, stopAnimation]);

  // Main initialization effect - STABLE, no dependencies that change
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
        console.error('❌ DEBUG: Failed to initialize water particles:', error);
        if (onError) onError(`Water particle initialization failed: ${error}`);
      }
    };
    
    console.log('🌊 DEBUG: Starting initialization...');
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

  // Handle position changes without re-initialization
  useEffect(() => {
    if (waterSystemRef.current) {
      waterSystemRef.current.position.copy(position);
      console.log(`🎯 DEBUG: Position updated to (${position.x}, ${position.y}, ${position.z})`);
    }
  }, [position]);

  // Handle scale changes without re-initialization  
  useEffect(() => {
    if (waterSystemRef.current) {
      waterSystemRef.current.scale.setScalar(scale);
      console.log(`🎯 DEBUG: Scale updated to ${scale}`);
    }
  }, [scale]);

  // Handle flood level changes - just for animation, no re-initialization
  useEffect(() => {
    console.log(`🌊 DEBUG: Flood level changed to ${floodLevel}%`);
  }, [floodLevel]);

  return null; // Engine component renders nothing directly
};

export default WaterParticleEngine;