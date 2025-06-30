// engines/SmokeParticleEngine.tsx - Following WaterParticleEngine Pattern
import React, { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three'
import { getAssetPath } from '../../utils/assetPaths';

interface SmokeParticleEngineProps {
  scene: THREE.Scene;
  enabled: boolean;
  
  // Positioning controls
  position?: THREE.Vector3;
  rotation?: THREE.Euler;
  scale?: number;
  
  // Visual controls
  particleColor?: THREE.Color;
  particleSize?: number;
  opacity?: number;
  
  // Smoke animation controls
  emissionRate?: number;
  particleLifetime?: number;
  windSpeed?: number;
  windDirection?: THREE.Vector3;
  smokeRiseSpeed?: number;
  smokeSpread?: number;
  turbulenceStrength?: number;
  emissionWidth?: number;
  emissionHeight?: number; 
  emissionDepth?: number;
  
  // Performance options

  maxParticleCount?: number;
  
  // Callbacks
  onReady?: () => void;
  onError?: (error: string) => void;
  onProgress?: (progress: number) => void;
}

const SmokeParticleEngine: React.FC<SmokeParticleEngineProps> = ({
  scene,
  enabled,
  
  position = new THREE.Vector3(0, 0, 0),
  rotation = new THREE.Euler(0, 0, 0),
  scale = 1,
  
  particleColor = new THREE.Color(0.7, 0.7, 0.7),
  particleSize = 1,
  opacity = 0.25,
  
  emissionRate = 100,
  particleLifetime = 10.0,
  windSpeed = 5.0,
  windDirection = new THREE.Vector3(1, 0.1, 0),
  smokeRiseSpeed = 8.0,
  smokeSpread = 5.0,
  turbulenceStrength = 4.0,
  emissionWidth = 200.0,
  emissionHeight = 20.0,
  emissionDepth = 20.0,
  

  maxParticleCount = 2000, // Reduced for performance
  
  onReady,
  onError,
  onProgress
}) => {
  console.log('🔥 SmokeParticleEngine: Initializing with max particles:', maxParticleCount);

  // Refs following WaterParticleEngine pattern - NO STATE!
  const smokeSystemRef = useRef<THREE.Group | null>(null);
  const particleSystemRef = useRef<THREE.Points | null>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const animationIdRef = useRef<number | null>(null);
  const clockRef = useRef(new THREE.Clock());
  const initializationRef = useRef<boolean>(false);
  
  // Animation state ref (no React state to avoid re-renders)
  const animationStateRef = useRef({
    time: 0,
    isAnimating: false,
    activeParticles: 0
  });

  // Emission state ref
  const emissionStateRef = useRef({
    nextEmissionTime: 0,
    emissionInterval: 1 / emissionRate // seconds between emissions
  });

  // Configuration refs (no re-renders during animation)
  const smokeParamsRef = useRef({
    maxParticleCount,
    particleSize,
    emissionRate,
    particleLifetime,
    windSpeed,
    windDirection: windDirection.clone(),
    turbulenceStrength,
    smokeRiseSpeed,
    smokeSpread,
    baseColor: particleColor.clone(),
    opacity,
    emissionWidth: emissionWidth || 50.0,
    emissionHeight: emissionHeight || 3.0,
    emissionDepth: emissionDepth || 6.0,
  });

  // Update smoke parameters when props change
  useEffect(() => {
    smokeParamsRef.current = {
      maxParticleCount,
      particleSize,
      emissionRate,
      particleLifetime,
      windSpeed,
      opacity,
      windDirection: windDirection.clone(),
      turbulenceStrength,
      smokeRiseSpeed,
      smokeSpread,
      baseColor: particleColor.clone(),
      emissionWidth: 50.0,
      emissionHeight: 3.0,
      emissionDepth: 6.0,
    };
    
    emissionStateRef.current.emissionInterval = 1 / emissionRate;
    
    // Update material uniforms if they exist
    if (materialRef.current) {
      materialRef.current.uniforms.baseColor.value = particleColor;
      materialRef.current.uniforms.windSpeed.value = windSpeed;
      materialRef.current.uniforms.windDirection.value = windDirection;
      materialRef.current.uniforms.turbulenceStrength.value = turbulenceStrength;
    }
  }, [emissionRate, particleLifetime, windSpeed, windDirection, smokeRiseSpeed, smokeSpread, turbulenceStrength, particleColor, maxParticleCount]);

  // Particle emission function
  const emitParticles = useCallback((currentTime: number, deltaTime: number) => {
    if (!particleSystemRef.current || !smokeParamsRef.current) return;
    
    const emitCount = Math.floor(smokeParamsRef.current.emissionRate * deltaTime);
    if (emitCount <= 0) return;
    
    const positions = particleSystemRef.current.geometry.attributes.position.array as Float32Array;
    const velocities = particleSystemRef.current.geometry.attributes.velocity.array as Float32Array;
    const lifetimes = particleSystemRef.current.geometry.attributes.lifetime.array as Float32Array;
    const startTimes = particleSystemRef.current.geometry.attributes.startTime.array as Float32Array;
    const sizes = particleSystemRef.current.geometry.attributes.size.array as Float32Array;
    const colorSeeds = particleSystemRef.current.geometry.attributes.colorSeed.array as Float32Array;
    const windFactors = particleSystemRef.current.geometry.attributes.windFactor.array as Float32Array;
    const active = particleSystemRef.current.geometry.attributes.isActive.array as Float32Array;
    
    let emitted = 0;
    
    // Look for inactive particles to activate
    for (let i = 0; i < smokeParamsRef.current.maxParticleCount && emitted < emitCount; i++) {
      if (active[i] < 0.5) { // If inactive
        active[i] = 1.0;
        
        const i3 = i * 3;
        
        // Position at emitter with random offset
        positions[i3] = (Math.random() - 0.2) * smokeParamsRef.current.emissionWidth;
        positions[i3 + 1] = (Math.random() - 0.2) * smokeParamsRef.current.emissionHeight;
        positions[i3 + 2] = (Math.random() - 0.2) * smokeParamsRef.current.emissionDepth;
        
        // Random velocity
        velocities[i3] = (Math.random() - 0.5) * smokeParamsRef.current.smokeSpread;
        velocities[i3 + 1] = Math.random() * 3.0 + smokeParamsRef.current.smokeRiseSpeed;
        velocities[i3 + 2] = (Math.random() - 0.5) * smokeParamsRef.current.smokeSpread * 0.5;
        
        // Particle properties
        lifetimes[i] = smokeParamsRef.current.particleLifetime + Math.random() * smokeParamsRef.current.particleLifetime;
        startTimes[i] = currentTime;
        sizes[i] = smokeParamsRef.current.particleSize + Math.random() * 0.4;
        colorSeeds[i] = Math.random();
        windFactors[i] = 0.5 + Math.random() * 0.5;
        
        emitted++;
        animationStateRef.current.activeParticles++;
      }
    }
    
    // Update buffers if particles were emitted
    if (emitted > 0) {
      particleSystemRef.current.geometry.attributes.position.needsUpdate = true;
      particleSystemRef.current.geometry.attributes.velocity.needsUpdate = true;
      particleSystemRef.current.geometry.attributes.lifetime.needsUpdate = true;
      particleSystemRef.current.geometry.attributes.startTime.needsUpdate = true;
      particleSystemRef.current.geometry.attributes.size.needsUpdate = true;
      particleSystemRef.current.geometry.attributes.colorSeed.needsUpdate = true;
      particleSystemRef.current.geometry.attributes.windFactor.needsUpdate = true;
      particleSystemRef.current.geometry.attributes.isActive.needsUpdate = true;
    }
  }, [particleSize]);

  // Particle lifecycle management
  const updateParticleLifecycle = useCallback((currentTime: number) => {
    if (!particleSystemRef.current) return;
    
    const lifetimes = particleSystemRef.current.geometry.attributes.lifetime.array as Float32Array;
    const startTimes = particleSystemRef.current.geometry.attributes.startTime.array as Float32Array;
    const active = particleSystemRef.current.geometry.attributes.isActive.array as Float32Array;
    
    let deactivated = 0;
    
    // Check for particles that have exceeded their lifetime
    for (let i = 0; i < smokeParamsRef.current.maxParticleCount; i++) {
      if (active[i] > 0.5) { // If active
        const age = currentTime - startTimes[i];
        if (age > lifetimes[i]) {
          active[i] = 0.0;
          deactivated++;
        }
      }
    }
    
    // Update the active particle count
    animationStateRef.current.activeParticles -= deactivated;
    
    // Update buffer only if there were deactivations
    if (deactivated > 0) {
      particleSystemRef.current.geometry.attributes.isActive.needsUpdate = true;
    }
  }, []);

  // Create smoke particle system (following WaterParticleEngine pattern)
  const createSmokeParticleSystem = useCallback(async () => {
    console.log('🔥 SmokeParticleEngine: Creating particle system...');
    
    // Prevent double initialization
    if (initializationRef.current) {
      console.log('🔥 SmokeParticleEngine: Already initialized, skipping...');
      return;
    }
    initializationRef.current = true;
    
    try {
      if (onProgress) onProgress(10);
      
      // Create main group
      const smokeGroup = new THREE.Group();
      smokeGroup.name = 'SmokeParticleSystem';
      smokeSystemRef.current = smokeGroup;
      
      if (onProgress) onProgress(30);
      
      // Create particle geometry
      const geometry = new THREE.BufferGeometry();
      const maxParticles = smokeParamsRef.current.maxParticleCount;
      
      // Initialize all buffers
      const positions = new Float32Array(maxParticles * 3);
      const velocities = new Float32Array(maxParticles * 3);
      const lifetimes = new Float32Array(maxParticles);
      const startTimes = new Float32Array(maxParticles);
      const sizes = new Float32Array(maxParticles);
      const colorSeeds = new Float32Array(maxParticles);
      const windFactors = new Float32Array(maxParticles);
      const active = new Float32Array(maxParticles);
      
      // Set all particles as inactive initially
      for (let i = 0; i < maxParticles; i++) {
        active[i] = 0.0;
      }
      
      if (onProgress) onProgress(50);
      
      // Assign attributes to geometry
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute("velocity", new THREE.BufferAttribute(velocities, 3));
      geometry.setAttribute("lifetime", new THREE.BufferAttribute(lifetimes, 1));
      geometry.setAttribute("startTime", new THREE.BufferAttribute(startTimes, 1));
      geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
      geometry.setAttribute("colorSeed", new THREE.BufferAttribute(colorSeeds, 1));
      geometry.setAttribute("windFactor", new THREE.BufferAttribute(windFactors, 1));
      geometry.setAttribute("isActive", new THREE.BufferAttribute(active, 1));
      
      if (onProgress) onProgress(70);
      
      // Create simplified shader material (no texture loading for now)
      const material = new THREE.ShaderMaterial({
        uniforms: {
          time: { value: 0.0 },
          baseColor: { value: smokeParamsRef.current.baseColor },
          opacity: {value: opacity},
          sizeMultiplier: { value: particleSize },// Bigger for visibility
          colorVariation: { value: 0.3 },
          windDirection: { value: smokeParamsRef.current.windDirection },
          windSpeed: { value: smokeParamsRef.current.windSpeed },
          turbulenceStrength: { value: smokeParamsRef.current.turbulenceStrength }
        },
        vertexShader: `
          uniform float time;
          uniform vec3 windDirection;
          uniform float windSpeed;
          uniform float sizeMultiplier;
          
          attribute vec3 velocity;
          attribute float lifetime;
          attribute float startTime;
          attribute float size;
          attribute float colorSeed;
          attribute float windFactor;
          attribute float isActive;
          
          varying float vAge;
          varying float vNormalizedAge;
          varying float vColorSeed;
          varying float vFadeOpacity;
          
          const float PI = 3.14159265359;
          
          void main() {
            // Early discard for inactive particles
            if (isActive < 0.5) {
              gl_Position = vec4(0.0, 0.0, 10000.0, 1.0);
              gl_PointSize = 0.0;
              return;
            }
            
            // Calculate age of this particle
            float particleAge = time - startTime;
            float normalizedAge = particleAge / lifetime;
            
            // Early discard of dead particles
            if (normalizedAge <= 0.0 || normalizedAge >= 1.0) {
              gl_Position = vec4(0.0, 0.0, 10000.0, 1.0);
              gl_PointSize = 0.0;
              return;
            }
            
            // Pass values to fragment shader
            vAge = particleAge;
            vNormalizedAge = normalizedAge;
            vColorSeed = colorSeed;
            
            // Calculate fade opacity
            vFadeOpacity = sin(normalizedAge * PI);
            
            // Basic movement based on velocity
            vec3 pos = position + velocity * particleAge;
            
            // Apply wind effect (increases with height)
            pos += windDirection * windSpeed * particleAge * windFactor;
            
            // Expansion as particle ages
            float expansionFactor = normalizedAge * 0.6;
            pos.xz *= (1.0 + expansionFactor);
            
            // Transform to camera space
            vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
            gl_Position = projectionMatrix * mvPosition;
            
            // Point size calculation
            float baseSize = size * sizeMultiplier;
            float sizeScale = sin(normalizedAge * PI) + 0.5;
            
            // Distance-based scaling
            float distanceScale = 300.0 / max(-mvPosition.z, 1.0);
            gl_PointSize = max(baseSize * sizeScale * distanceScale, 5.0); // Minimum 5 pixels
          }
        `,
        fragmentShader: `
          uniform vec3 baseColor;
          uniform float colorVariation;
          uniform float opacity;
          
          varying float vAge;
          varying float vNormalizedAge;
          varying float vColorSeed;
          varying float vFadeOpacity;
          
          void main() {
              // Simple circular fade from center
              vec2 center = gl_PointCoord - 0.5;
              float dist = length(center);
              
              // Create circular particle shape
              if (dist > 0.5) {
                discard;
              }
              
              // Simple color variation
              vec3 smokeColor = mix(vec3(0.4, 0.4, 0.4), baseColor, vColorSeed * 0.7);
              
              // Simple fade based on distance from center and age
              float centerFade = 1.0 - (dist * 2.0);
              float finalAlpha = vFadeOpacity * centerFade * opacity;
              
              gl_FragColor = vec4(smokeColor, finalAlpha);
          }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });
      
      materialRef.current = material;
      
      if (onProgress) onProgress(80);
      
      // Create particle system
      const particleSystem = new THREE.Points(geometry, material);
      particleSystemRef.current = particleSystem;
      particleSystem.frustumCulled = false;
      smokeGroup.add(particleSystem);
      
      // Apply transforms
      smokeGroup.position.copy(position);
      smokeGroup.rotation.copy(rotation);
      smokeGroup.scale.setScalar(scale);
      
      // Add to scene
      scene.add(smokeGroup);
      
      if (onProgress) onProgress(100);
      
      console.log('✅ SmokeParticleEngine: Particle system created successfully');
      console.log(`✅ Max particles: ${maxParticles}, Group position: (${smokeGroup.position.x}, ${smokeGroup.position.y}, ${smokeGroup.position.z})`);
      
      if (onReady) onReady();
      
    } catch (error) {
      console.error('❌ SmokeParticleEngine: Creation failed:', error);
      if (onError) onError(`Failed to create smoke particle system: ${error}`);
    }
  }, [
    position,
    rotation, 
    scale,
    scene,
    onProgress,
    onReady,
    onError
  ]);

  // Update particles (no React state changes!)
  const updateSmokeParticles = useCallback((time: number, deltaTime: number) => {
    if (!particleSystemRef.current || !materialRef.current) return;
    
    // Update time uniform for shader
    materialRef.current.uniforms.time.value = time;
    
    // Emit new particles
    emitParticles(time, deltaTime);
    
    // Update particle lifecycle
    updateParticleLifecycle(time);
    
    // Debug logging (throttled)
    if (Math.floor(time) % 5 < deltaTime) { // Every ~5 seconds
    //   console.log(`🔥 SmokeEngine: Active particles: ${animationStateRef.current.activeParticles}/${smokeParamsRef.current.maxParticleCount}`);
    }
  }, [emitParticles, updateParticleLifecycle]);

  // Animation loop (following WaterParticleEngine pattern)
  const animate = useCallback(() => {
    if (!animationStateRef.current.isAnimating) return;

    const deltaTime = clockRef.current.getDelta();
    animationStateRef.current.time += deltaTime;
    
    updateSmokeParticles(animationStateRef.current.time, deltaTime);
    
    if (animationStateRef.current.isAnimating) {
      animationIdRef.current = requestAnimationFrame(animate);
    }
  }, [updateSmokeParticles]);

  // Start/stop animation (following WaterParticleEngine pattern)
  const startAnimation = useCallback(() => {
    if (animationStateRef.current.isAnimating) return;
    
    animationStateRef.current.isAnimating = true;
    clockRef.current.start();
    animate();
    console.log('🔥 SmokeParticleEngine: Animation started');
  }, [animate]);

  const stopAnimation = useCallback(() => {
    animationStateRef.current.isAnimating = false;
    if (animationIdRef.current) {
      cancelAnimationFrame(animationIdRef.current);
      animationIdRef.current = null;
    }
    clockRef.current.stop();
    console.log('🔥 SmokeParticleEngine: Animation stopped');
  }, []);

  // Cleanup function (following WaterParticleEngine pattern)
  const cleanup = useCallback(() => {
    console.log('🧹 SmokeParticleEngine: Cleaning up...');
    
    stopAnimation();
    
    // Reset initialization flag
    initializationRef.current = false;
    
    // Reset animation state
    animationStateRef.current = { time: 0, isAnimating: false, activeParticles: 0 };
    
    // Dispose material
    if (materialRef.current) {
      materialRef.current.dispose();
      materialRef.current = null;
    }
    
    // Remove from scene and dispose geometry
    if (smokeSystemRef.current) {
      scene.remove(smokeSystemRef.current);
      
      smokeSystemRef.current.traverse((child) => {
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
      
      smokeSystemRef.current.clear();
      smokeSystemRef.current = null;
    }
    
    particleSystemRef.current = null;
    
    console.log('✅ SmokeParticleEngine: Cleanup completed');
  }, [scene, stopAnimation]);

  // Main initialization effect - STABLE, following WaterParticleEngine pattern
  useEffect(() => {
    let isMounted = true;
    
    const initialize = async () => {
      if (!isMounted) return;
      
      try {
        await createSmokeParticleSystem();
        
        if (enabled && isMounted) {
          startAnimation();
        }
      } catch (error) {
        console.error('❌ SmokeParticleEngine: Failed to initialize:', error);
        if (onError) onError(`Smoke particle initialization failed: ${error}`);
      }
    };
    
    console.log('🔥 SmokeParticleEngine: Starting initialization...');
    initialize();
    
    return () => {
      isMounted = false;
      cleanup();
    };
  }, []); // EMPTY DEPENDENCY ARRAY - initialize once only

  // Handle enabled state changes (following WaterParticleEngine pattern)
  useEffect(() => {
    if (!smokeSystemRef.current) return;
    
    if (enabled) {
      startAnimation();
      smokeSystemRef.current.visible = true;
    } else {
      stopAnimation();
      smokeSystemRef.current.visible = false;
    }
  }, [enabled, startAnimation, stopAnimation]);

  // Handle position changes without re-initialization (following WaterParticleEngine pattern)
  useEffect(() => {
    if (smokeSystemRef.current) {
      smokeSystemRef.current.position.copy(position);
      console.log(`🎯 SmokeParticleEngine: Position updated to (${position.x}, ${position.y}, ${position.z})`);
    }
  }, [position]);

  // Handle scale changes without re-initialization (following WaterParticleEngine pattern)
  useEffect(() => {
    if (smokeSystemRef.current) {
      smokeSystemRef.current.scale.setScalar(scale);
      console.log(`🎯 SmokeParticleEngine: Scale updated to ${scale}`);
    }
  }, [scale]);

  // Handle rotation changes without re-initialization
  useEffect(() => {
    if (smokeSystemRef.current) {
      smokeSystemRef.current.rotation.copy(rotation);
      console.log(`🎯 SmokeParticleEngine: Rotation updated`);
    }
  }, [rotation]);

  return null; // Engine component renders nothing directly
};

export default SmokeParticleEngine;