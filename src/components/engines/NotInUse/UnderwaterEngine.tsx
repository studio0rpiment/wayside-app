// engines/UnderwaterEngine.tsx
import React, { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';

interface UnderwaterEngineProps {
  scene: THREE.Scene;
 
  enabled: boolean;
  waterLevel: number;
  terrainY?: number; // For terrain-aware positioning
  
  // Positioning controls (simplified - relative to water/terrain, not camera)
  underwaterDepth?: number;     // How deep below water surface
  curtainWidth?: number;        // Width of particle area
  curtainHeight?: number;       // Height of particle area
  
  // Particle controls
  particleCount?: number;
  particleSize?: number;
  particleColor?: THREE.Color;
  baseOpacity?: number;
  maxOpacity?: number;
  blendMode?: THREE.Blending;
  
  // Animation controls
  driftSpeed?: number;         // How fast particles drift
  verticalFlow?: number;       // Upward/downward flow
  turbulence?: number;         // Random movement intensity
  fadeSpeed?: number;          // How fast opacity changes
  
  // Depth layering
  layerCount?: number;         // Number of depth layers
  layerSpacing?: number;       // Distance between layers
  depthFade?: boolean;         // Fade particles by depth
  
  // Performance options
  isArMode?: boolean;
  
  // Callbacks
  onReady?: () => void;
  onError?: (error: string) => void;
}

const UnderwaterEngine: React.FC<UnderwaterEngineProps> = ({
  scene, 
  enabled,
  waterLevel,
  terrainY = 0,
  
  underwaterDepth = 2,
  curtainWidth = 8,
  curtainHeight = 6,
  
  particleCount = 1000, // Reduced for better performance
  particleSize = 2.0,
  particleColor = new THREE.Color(0x004466),
  baseOpacity = 0.15,
  maxOpacity = 0.4,
  blendMode = THREE.AdditiveBlending, // Better for underwater particles
  
  driftSpeed = 0.001,
  verticalFlow = 0.0005,
  turbulence = 1.0,
  fadeSpeed = 0.03,
  
  layerCount = 3, // Simplified
  layerSpacing = 1.0,
  depthFade = true,
  
  isArMode = false,
  
  onReady,
  onError
}) => {
  console.log('🫧 UnderwaterEngine: Initializing underwater particle system');

  // Refs following CausticsEngine pattern
  const underwaterGroupRef = useRef<THREE.Group | null>(null);
  const particleSystemsRef = useRef<THREE.Points[]>([]);
  const animationIdRef = useRef<number | null>(null);
  const clockRef = useRef(new THREE.Clock());
  
  // Animation state (ref-based to avoid re-renders) - following CausticsEngine
  const animationStateRef = useRef({
    time: 0,
    isAnimating: false,
    currentOpacity: 0,
    targetOpacity: 0
  });

  // Particle animation data stored in refs for performance
  const particleDataRef = useRef<{
    positions: Float32Array[];
    driftOffsets: Float32Array[];
    originalPositions: Float32Array[];
    layerOpacities: number[];
  }>({
    positions: [],
    driftOffsets: [],
    originalPositions: [],
    layerOpacities: []
  });

  // Create underwater particle system - following CausticsEngine pattern
  const createUnderwaterParticles = useCallback(async () => {
    console.log('🫧 Creating underwater particle system...');
    
    // Create main group
    const underwaterGroup = new THREE.Group();
    underwaterGroupRef.current = underwaterGroup;
    
    const particleSystems: THREE.Points[] = [];
    const positions: Float32Array[] = [];
    const driftOffsets: Float32Array[] = [];
    const originalPositions: Float32Array[] = [];
    const layerOpacities: number[] = [];
    
    // Create multiple depth layers for underwater effect
    for (let layer = 0; layer < layerCount; layer++) {
      const particlesPerLayer = Math.floor(particleCount / layerCount);
      const geometry = new THREE.BufferGeometry();
      
      // Calculate layer position (deeper layers have more particles for density)
      const layerDepthOffset = layer * layerSpacing;
      const layerOpacity = depthFade ? 
        baseOpacity * (1 - (layer / layerCount) * 0.4) : // Gentle fade with depth
        baseOpacity;
      
      layerOpacities.push(layerOpacity);
      
      // Create particle positions for this layer
      const layerPositions = new Float32Array(particlesPerLayer * 3);
      const layerDriftOffsets = new Float32Array(particlesPerLayer * 3);
      const layerOriginalPositions = new Float32Array(particlesPerLayer * 3);
      
      for (let i = 0; i < particlesPerLayer; i++) {
        const i3 = i * 3;
        
        // Position particles in underwater volume
        // Distribute across width and height, with depth layering
        const x = (Math.random() - 0.5) * curtainWidth;
        const y = (Math.random() - 0.5) * curtainHeight;
        const z = -layerDepthOffset + (Math.random() - 0.5) * layerSpacing * 0.5;
        
        layerPositions[i3] = x;
        layerPositions[i3 + 1] = y;
        layerPositions[i3 + 2] = z;
        
        // Store original positions for drift calculation
        layerOriginalPositions[i3] = x;
        layerOriginalPositions[i3 + 1] = y;
        layerOriginalPositions[i3 + 2] = z;
        
        // Random drift offsets for organic movement
        layerDriftOffsets[i3] = Math.random() * Math.PI * 2;
        layerDriftOffsets[i3 + 1] = Math.random() * Math.PI * 2;
        layerDriftOffsets[i3 + 2] = Math.random() * Math.PI * 2;
      }
      
      geometry.setAttribute('position', new THREE.BufferAttribute(layerPositions, 3));
      
      // Create material for this layer - following your smoke system approach
      const material = new THREE.PointsMaterial({
        size: particleSize * (isArMode ? 0.8 : 1.0), // Larger for visibility
        transparent: true,
        opacity: layerOpacity,
        blending: blendMode, // AdditiveBlending works better for underwater
        depthWrite: false,
        color: particleColor.clone(),
        vertexColors: false,
        sizeAttenuation: false, // Keep consistent size for underwater effect
        alphaTest: 0.1 // Help with transparency issues
      });
      
      // Adjust color for depth layers (darker = deeper)
      if (depthFade && layer > 0) {
        const depthFactor = layer / layerCount;
        material.color.multiplyScalar(1 - depthFactor * 0.2);
      }
      
      const particleSystem = new THREE.Points(geometry, material);
      particleSystems.push(particleSystem);
      underwaterGroup.add(particleSystem);
      
      // Store animation data
      positions.push(layerPositions);
      driftOffsets.push(layerDriftOffsets);
      originalPositions.push(layerOriginalPositions);
      
      console.log(`🫧 Layer ${layer + 1}/${layerCount}: ${particlesPerLayer} particles`);
    }
    
    // Store refs for animation
    particleSystemsRef.current = particleSystems;
    particleDataRef.current = {
      positions,
      driftOffsets,
      originalPositions,
      layerOpacities
    };
    
    // Position group based on water level and terrain (not camera)
    updateUnderwaterPosition();
    
    // Add to scene
    scene.add(underwaterGroup);
    
    console.log(`✅ Underwater system created: ${layerCount} layers, ${particleCount} total particles`);
    if (onReady) onReady();
    
    return underwaterGroup;
    
  }, []); // Empty dependency array like CausticsEngine

  // Update underwater position based on water level and terrain - following CausticsEngine pattern
  const updateUnderwaterPosition = useCallback(() => {
    const underwaterGroup = underwaterGroupRef.current;
    if (!underwaterGroup) return;
    
    // Position underwater particles below water surface, above terrain
    const underwaterY = Math.max(
      terrainY + 0.5,              // Just above terrain
      waterLevel - underwaterDepth // Below water surface  
    );
    
    underwaterGroup.position.y = underwaterY;
    
    // Adjust visibility based on water depth - following CausticsEngine logic
    const waterDepth = waterLevel - terrainY;
    const shouldShow = waterDepth > 0.8; // Only show if significant water depth
    
    underwaterGroup.visible = enabled && shouldShow;
    
    // Update target opacity based on water depth
    if (shouldShow) {
      const depthFactor = Math.min(waterDepth / 3.0, 1.0);
      animationStateRef.current.targetOpacity = maxOpacity * depthFactor;
    } else {
      animationStateRef.current.targetOpacity = 0;
    }
    
  }, [enabled, waterLevel, terrainY, underwaterDepth, maxOpacity]);

  // Underwater particle animation - following CausticsEngine pattern
  const animateUnderwaterParticles = useCallback(() => {
    if (!animationStateRef.current.isAnimating || particleSystemsRef.current.length === 0) {
      return;
    }

    const deltaTime = clockRef.current.getDelta();
    const state = animationStateRef.current;
    const data = particleDataRef.current;
    
    state.time += deltaTime;
    
    // Smooth opacity transition - following CausticsEngine
    const opacityDiff = state.targetOpacity - state.currentOpacity;
    if (Math.abs(opacityDiff) > 0.01) {
      state.currentOpacity += opacityDiff * fadeSpeed;
    }
    
    // Update each particle layer
    particleSystemsRef.current.forEach((particleSystem, layerIndex) => {
      const material = particleSystem.material as THREE.PointsMaterial;
      const positions = data.positions[layerIndex];
      const driftOffsets = data.driftOffsets[layerIndex];
      const originalPositions = data.originalPositions[layerIndex];
      const particlesPerLayer = positions.length / 3;
      
      // Update layer opacity
      const layerOpacity = data.layerOpacities[layerIndex] * state.currentOpacity;
      material.opacity = layerOpacity;
      
      // Update particle positions with drift and flow
      for (let i = 0; i < particlesPerLayer; i++) {
        const i3 = i * 3;
        
        // Original position
        const origX = originalPositions[i3];
        const origY = originalPositions[i3 + 1];
        const origZ = originalPositions[i3 + 2];
        
        // Drift animation with different speeds per axis
        const driftTime = state.time * driftSpeed;
        const driftX = Math.sin(driftOffsets[i3] + driftTime) * turbulence;
        const driftY = Math.cos(driftOffsets[i3 + 1] + driftTime * 0.7) * turbulence * 0.5;
        const driftZ = Math.sin(driftOffsets[i3 + 2] + driftTime * 0.3) * turbulence * 0.3;
        
        // Vertical flow (particles slowly rise/fall)
        const flowY = verticalFlow * state.time * (0.5 + Math.sin(driftOffsets[i3 + 1]) * 0.5);
        
        // Apply movement
        positions[i3] = origX + driftX;
        positions[i3 + 1] = origY + driftY + flowY;
        positions[i3 + 2] = origZ + driftZ;
        
        // Wrap particles that drift too far from area (keep them contained)
        if (Math.abs(positions[i3] - origX) > curtainWidth * 0.6) {
          positions[i3] = origX;
        }
        if (Math.abs(positions[i3 + 1] - origY) > curtainHeight * 0.6) {
          positions[i3 + 1] = origY;
        }
      }
      
      particleSystem.geometry.attributes.position.needsUpdate = true;
    });
    
    // Update position based on water level changes - following CausticsEngine
    updateUnderwaterPosition();
    
    if (animationStateRef.current.isAnimating) {
      animationIdRef.current = requestAnimationFrame(animateUnderwaterParticles);
    }
  }, [driftSpeed, turbulence, verticalFlow, fadeSpeed, curtainWidth, curtainHeight, updateUnderwaterPosition]);

  // Start/stop animation - following CausticsEngine pattern
  const startAnimation = useCallback(() => {
    if (animationStateRef.current.isAnimating) return;
    
    animationStateRef.current.isAnimating = true;
    clockRef.current.start();
    animateUnderwaterParticles();
    console.log('🫧 Underwater animation started');
  }, [animateUnderwaterParticles]);

  const stopAnimation = useCallback(() => {
    animationStateRef.current.isAnimating = false;
    if (animationIdRef.current) {
      cancelAnimationFrame(animationIdRef.current);
      animationIdRef.current = null;
    }
    clockRef.current.stop();
    console.log('🫧 Underwater animation stopped');
  }, []);

  // Complete cleanup - following CausticsEngine pattern
  const cleanup = useCallback(() => {
    console.log('🧹 Cleaning up underwater system');
    
    stopAnimation();
    
    // Clean up particle systems
    particleSystemsRef.current.forEach(particleSystem => {
      if (particleSystem.geometry) {
        particleSystem.geometry.dispose();
      }
      if (particleSystem.material) {
        if (Array.isArray(particleSystem.material)) {
          particleSystem.material.forEach(mat => mat.dispose());
        } else {
          particleSystem.material.dispose();
        }
      }
    });
    particleSystemsRef.current = [];
    
    // Remove from scene
    if (underwaterGroupRef.current) {
      scene.remove(underwaterGroupRef.current);
      underwaterGroupRef.current.clear();
      underwaterGroupRef.current = null;
    }
    
    // Clear animation data
    particleDataRef.current = {
      positions: [],
      driftOffsets: [],
      originalPositions: [],
      layerOpacities: []
    };
    
    console.log('✅ Underwater cleanup completed');
  }, [scene, stopAnimation]);

  // Main initialization effect - following CausticsEngine pattern
  useEffect(() => {
    let isMounted = true;
    
    const initialize = async () => {
      if (!isMounted) return;
      
      try {
        await createUnderwaterParticles();
        
        if (enabled && isMounted) {
          startAnimation();
        }
      } catch (error) {
        console.error('❌ Failed to initialize underwater particles:', error);
        if (onError) onError(`Underwater initialization failed: ${error}`);
      }
    };
    
    initialize();
    
    return () => {
      isMounted = false;
      cleanup();
    };
  }, []); // Initialize once - following CausticsEngine

  // Handle enabled state changes - following CausticsEngine pattern
// The enabled check should look at current water level, not just the enabled prop
useEffect(() => {
  if (!underwaterGroupRef.current) return;
  
  // ✅ FIX: Check actual conditions for showing particles
  const shouldAnimate = enabled && waterLevel > 0.3;
  
  if (shouldAnimate) {
    startAnimation();
    updateUnderwaterPosition();
  } else {
    // ✅ FIX: Don't stop immediately on first render
    if (animationStateRef.current.isAnimating) {
      stopAnimation();
    }
    if (underwaterGroupRef.current) {
      underwaterGroupRef.current.visible = false;
    }
  }
}, [enabled, waterLevel, startAnimation, stopAnimation, updateUnderwaterPosition]);

  // Handle visual property changes - following CausticsEngine pattern
  useEffect(() => {
    particleSystemsRef.current.forEach((particleSystem, layerIndex) => {
      const material = particleSystem.material as THREE.PointsMaterial;
      if (material) {
        material.color.copy(particleColor);
        material.blending = blendMode;
        material.needsUpdate = true;
      }
    });
  }, [particleColor, blendMode]);

  return null; // Engine component renders nothing directly
};

export default UnderwaterEngine;