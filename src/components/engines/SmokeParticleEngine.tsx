// engines/SmokeParticleEngine.tsx - Updated to use PositioningSystemSingleton pattern
import React, { useRef, useEffect, useCallback, useState } from 'react';
import * as THREE from 'three'
import { getAssetPath } from '../../utils/assetPaths';
import { PositioningSystemSingleton } from '../../utils/coordinate-system/PositioningSystemSingleton';
import { useGeofenceBasics } from '../../context/GeofenceContext';
import { debugModeManager } from '../../utils/DebugModeManager';
import { loadShader } from '../../utils/shaderLoader';


interface SmokeParticleEngineProps {
  scene: THREE.Scene;
  enabled: boolean;
  
  // ✅ NEW: Positioning via singleton (like StaticPointCloudEngine)
  experienceId: string;           // Which experience this smoke belongs to
  isUniversalMode?: boolean;      // Universal mode override
  lockPosition?: boolean;         // Lock position after first render (default: true)
  
  // ❌ REMOVED: position?, rotation?, scale? - now handled by singleton
  
  // Visual controls (unchanged)
  particleColor?: THREE.Color;
  particleSize?: number;
  opacity?: number;
  
  // Smoke animation controls (unchanged)
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
  
  // Performance options (unchanged)
  maxParticleCount?: number;
  
  // Callbacks (unchanged)
  onReady?: () => void;
  onError?: (error: string) => void;
  onProgress?: (progress: number) => void;
}

const SmokeParticleEngine: React.FC<SmokeParticleEngineProps> = ({
  scene,
  enabled,
  
  // ✅ NEW: Positioning props
  experienceId,
  isUniversalMode = false,
  lockPosition = true,
  
  // Visual controls
  particleColor = new THREE.Color(0.7, 0.7, 0.7),
  particleSize = 1,
  opacity = 0.25,
  
  // Smoke animation controls
  emissionRate = 200,
  particleLifetime = 1.0,
  windSpeed = 1.0,
  windDirection = new THREE.Vector3(1, 0.1, 0),
  smokeRiseSpeed = 2.0,
  smokeSpread = 2.0,
  turbulenceStrength = 1.0,
  emissionWidth = 0.1,
  emissionHeight = 0.1,
  emissionDepth = 0.1,
  
  maxParticleCount = 2000,
  
  onReady,
  onError,
  onProgress
}) => {
  const componentIdRef = useRef(Math.random().toString(36).substr(2, 9));
  console.log(`🔥 SmokeParticleEngine: Initializing ${experienceId} with singleton positioning (ID: ${componentIdRef.current})`);

  // ✅ NEW: Capture universal mode and user position ONCE (like StaticPointCloudEngine)
  const capturedUniversalModeRef = useRef<boolean | null>(null);
  const capturedUserPositionRef = useRef<[number, number] | null>(null);
  const positionLockedRef = useRef(false);

  // Get geofence context for initial values
  const { userPosition, isUniversalMode: contextUniversalMode } = useGeofenceBasics();
  
  // ✅ NEW: Capture values ONCE on first render (like StaticPointCloudEngine)
  if (capturedUniversalModeRef.current === null) {
    capturedUniversalModeRef.current = isUniversalMode || contextUniversalMode;
    capturedUserPositionRef.current = userPosition;
    // console.log(`📸 ${experienceId}: Captured initial state:`, {
    //   universalMode: capturedUniversalModeRef.current,
    //   userPosition: capturedUserPositionRef.current
    // });
  }

  // ✅ NEW: Debug mode state
  const [debugMode, setDebugMode] = useState(false);

  // Refs following WaterParticleEngine pattern - NO STATE!
  const smokeSystemRef = useRef<THREE.Group | null>(null);
  const particleSystemRef = useRef<THREE.Points | null>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const animationIdRef = useRef<number | null>(null);
  const clockRef = useRef(new THREE.Clock());
  const initializationRef = useRef<boolean>(false);
  
  // ✅ NEW: Positioning state
  const [smokePosition, setSmokePosition] = useState<THREE.Vector3>(new THREE.Vector3(0, 0, -5));
  const [positionCalculated, setPositionCalculated] = useState(false);

  // Animation state ref (no React state to avoid re-renders)
  const animationStateRef = useRef({
    time: 0,
    isAnimating: false,
    activeParticles: 0
  });

  // Emission state ref
  const emissionStateRef = useRef({
    nextEmissionTime: 0,
    emissionInterval: 1 / emissionRate
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
    emissionWidth: emissionWidth ,
    emissionHeight: emissionHeight ,
    emissionDepth: emissionDepth ,
  });

  // ✅ NEW: Calculate position using singleton (like StaticPointCloudEngine)
const calculateSmokePosition = useCallback(() => {
  // console.log(`🎯 ${experienceId}: Calculating smoke position using singleton...`);
  
  const finalUniversalMode = capturedUniversalModeRef.current;
  const finalUserPosition = capturedUserPositionRef.current;
  
  // console.log(`🎯 Captured values:`, {
  //   universalMode: finalUniversalMode,
  //   userPosition: finalUserPosition,
  //   experienceId
  // });

  const positionResult = PositioningSystemSingleton.getExperiencePosition(
    experienceId,
    {
      gpsPosition: finalUserPosition,
      isUniversalMode: finalUniversalMode
    }
  );

  console.log(`🎯 Singleton returned:`, positionResult);

  if (positionResult) {
    // console.log(`✅ Position result details:`, {
    //   relativeToUser: positionResult.relativeToUser.toArray(),
    //   isUsingDebugMode: positionResult.isUsingDebugMode,
    //   distanceFromUser: positionResult.distanceFromUser
    // });

    const freshPosition = positionResult.relativeToUser.clone();
    // console.log(`🎯 Fresh position calculated:`, freshPosition.toArray());

    // Still update state for other uses, but don't rely on it for immediate use
    setSmokePosition(freshPosition);
    setPositionCalculated(true);
    
    // Lock position after successful positioning
    if (lockPosition) {
      positionLockedRef.current = true;
      // console.log(`🔒 ${experienceId}: Position locked after calculation`);
    }

    // console.log(`✅ ${experienceId}: Smoke position calculated and set:`, {
    //   freshPosition: freshPosition.toArray(),
    //   rotation: [positionResult.rotation.x, positionResult.rotation.y, positionResult.rotation.z],
    //   scale: positionResult.scale,
    //   universalMode: positionResult.isUsingDebugMode,
    //   distance: positionResult.distanceFromUser?.toFixed(1) + 'm'
    // });

    // ✅ RETURN THE FRESH POSITION DIRECTLY
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
}, [experienceId, lockPosition, smokePosition]);

  // ✅ NEW: Force reposition function (like StaticPointCloudEngine)
  const forceReposition = useCallback((currentDebugMode: boolean) => {
    if (!smokeSystemRef.current) {
      // console.log(`⏭️ ${experienceId}: Smoke system not ready for forced reposition`);
      return;
    }
    
    const finalUniversalMode = capturedUniversalModeRef.current;
    const finalUserPosition = capturedUserPositionRef.current;
    
    // console.log(`🎯 ${experienceId}: Forcing smoke reposition (debug: ${currentDebugMode})`);
    
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

    if (positionResult && smokeSystemRef.current) {
      const newPosition = positionResult.relativeToUser.clone();
      setSmokePosition(newPosition);
      
      // Update the group position directly
      smokeSystemRef.current.position.copy(newPosition);

      // console.log(`✅ ${experienceId}: Forced smoke reposition complete (debug: ${currentDebugMode})`);
    } else {
      console.warn(`⚠️ ${experienceId}: No position result for forced reposition`);
    }
  }, [experienceId]);

  // ✅ NEW: Debug mode change handler (like StaticPointCloudEngine)
  useEffect(() => {
    debugModeManager.initialize();
    
    const handleDebugModeChange = (event: CustomEvent) => {
      const newDebugMode = event.detail.enabled;
      const previousDebugMode = debugMode;
      
      setDebugMode(newDebugMode);
      
      // Force reposition if debug mode actually changed and smoke is ready
      if (previousDebugMode !== newDebugMode && smokeSystemRef.current) {
        // console.log(`🐛 ${experienceId}: Debug mode changed ${previousDebugMode} → ${newDebugMode}, forcing reposition`);
        
        // Force repositioning regardless of lock status
        forceReposition(newDebugMode);
      }
    };
    
    debugModeManager.addEventListener('debugModeChanged', handleDebugModeChange as EventListener);
    setDebugMode(debugModeManager.debugMode); // Initialize
    
    return () => {
      debugModeManager.removeEventListener('debugModeChanged', handleDebugModeChange as EventListener);
    };
  }, [debugMode, experienceId, forceReposition]);

  // ✅ NEW: Position update effect (only if not locked)
  useEffect(() => {
    // Skip if position is locked or already calculated
    if (lockPosition && positionLockedRef.current) {
      // console.log(`🔒 ${experienceId}: Position locked, ignoring updates`);
      return;
    }

    if (positionCalculated) {
      // console.log(`⏭️ ${experienceId}: Position already calculated, ignoring updates`);
      return;
    }

    // Calculate position using singleton
    if (!lockPosition) {
      // console.log(`🔄 ${experienceId}: Updating position (lock disabled)`);
      calculateSmokePosition();
    }
  }, [userPosition, isUniversalMode, contextUniversalMode, lockPosition, experienceId, positionCalculated, calculateSmokePosition]);

  // Update smoke parameters when props change
  useEffect(() => {
    smokeParamsRef.current = {
      maxParticleCount,
      particleSize: 1.0,
      emissionRate,
      particleLifetime,
      windSpeed,
      opacity,
      windDirection: windDirection.clone(),
      turbulenceStrength,
      smokeRiseSpeed,
      smokeSpread,
      baseColor: particleColor.clone(),
      emissionWidth: emissionWidth,
      emissionHeight: emissionHeight,
      emissionDepth: emissionDepth,
    };

    // console.log(smokeParamsRef.current)
    
    emissionStateRef.current.emissionInterval = 1 / emissionRate;
    
    // Update material uniforms if they exist
    if (materialRef.current) {
      materialRef.current.uniforms.baseColor.value = particleColor;
      materialRef.current.uniforms.windSpeed.value = windSpeed;
      materialRef.current.uniforms.windDirection.value = windDirection;
      materialRef.current.uniforms.turbulenceStrength.value = turbulenceStrength;
    }
  }, [emissionRate, particleLifetime, windSpeed, windDirection, smokeRiseSpeed, smokeSpread, turbulenceStrength, particleColor, maxParticleCount, emissionWidth, emissionHeight, emissionDepth, opacity]);

  // Particle emission function (unchanged)
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
        lifetimes[i] = 3.0 + Math.random() * 2.0; 
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


    
  }, []);

  // Particle lifecycle management (unchanged)
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
    // console.log(`🔥 SmokeParticleEngine: Creating particle system for ${experienceId}...`);
    
    // Prevent double initialization
    if (initializationRef.current) {
      // console.log(`🔥 SmokeParticleEngine: Already initialized, skipping...`);
      return;
    }
    initializationRef.current = true;
    
    try {
      if (onProgress) onProgress(10);
      
      // ✅ NEW: Calculate position using singleton BEFORE creating system
      if (!positionCalculated) {
        const success = calculateSmokePosition();
        if (!success) {
          throw new Error(`Failed to calculate position for ${experienceId}`);
        }
      }
      
      // Create main group
      const smokeGroup = new THREE.Group();
      smokeGroup.name = `SmokeParticleSystem-${experienceId}`;
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

      const vertexShader = await loadShader('/src/shaders/smoke.vert');
      const fragmentShader = await loadShader('/src/shaders/smoke.frag');

      
      // Create simplified shader material (no texture loading for now)
      // Create SIMPLIFIED DEBUG shader material
// Create SIMPLIFIED DEBUG shader material with required uniforms
const material = new THREE.ShaderMaterial({
 
 uniforms: {
    time: { value: 0.0 },
    baseColor: { value: smokeParamsRef.current.baseColor },
    opacity: { value: smokeParamsRef.current.opacity },
    sizeMultiplier: { value: 1.0 },
    windDirection: { value: smokeParamsRef.current.windDirection },
    windSpeed: { value: smokeParamsRef.current.windSpeed},
    turbulenceStrength: { value: smokeParamsRef.current.turbulenceStrength },
    colorVariation: { value: 0.5 } 


  },
          vertexShader,
          fragmentShader,
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
      
      // ✅ NEW: Apply singleton-calculated position
//       console.log(`🎯 Applying calculated position to smoke group:`, smokePosition.toArray());
//       console.log(`🎯 smokePosition state value:`, smokePosition.toArray());
// console.log(`🎯 smokePosition object:`, smokePosition);   

      smokeGroup.position.copy(smokePosition);
      // No rotation or scale applied here - they come from user transforms in Experience1968
      // console.log(`🎯 Smoke group position after copy:`, smokeGroup.position.toArray());

      // Add to scene
      scene.add(smokeGroup);
      
      if (onProgress) onProgress(100);
      
      // console.log(`✅ SmokeParticleEngine: ${experienceId} particle system created successfully`);
      // console.log(`✅ Max particles: ${maxParticles}, Group position: (${smokeGroup.position.x}, ${smokeGroup.position.y}, ${smokeGroup.position.z})`);
      
      if (onReady) onReady();
      
    } catch (error) {
      console.error(`❌ SmokeParticleEngine: ${experienceId} creation failed:`, error);
      if (onError) onError(`Failed to create smoke particle system for ${experienceId}: ${error}`);
    }
  }, [
    scene,
    onProgress,
    onReady,
    onError,
    experienceId,
    smokePosition,
    positionCalculated,
    calculateSmokePosition,
    particleSize,
    opacity
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
      // console.log(`🔥 ${experienceId}: Active particles: ${animationStateRef.current.activeParticles}/${smokeParamsRef.current.maxParticleCount}`);
    }
  }, [emitParticles, updateParticleLifecycle, experienceId]);

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
    // console.log(`🔥 SmokeParticleEngine: ${experienceId} animation started`);
  }, [animate, experienceId]);

  const stopAnimation = useCallback(() => {
    animationStateRef.current.isAnimating = false;
    if (animationIdRef.current) {
      cancelAnimationFrame(animationIdRef.current);
      animationIdRef.current = null;
    }
    clockRef.current.stop();
    // console.log(`🔥 SmokeParticleEngine: ${experienceId} animation stopped`);
  }, [experienceId]);

  // Cleanup function (following WaterParticleEngine pattern)
  const cleanup = useCallback(() => {
    // console.log(`🧹 SmokeParticleEngine: Cleaning up ${experienceId}...`);
    
    stopAnimation();
    
    // Reset initialization flag
    initializationRef.current = false;
    
    // Reset animation state
    animationStateRef.current = { time: 0, isAnimating: false, activeParticles: 0 };
    
    // Reset positioning state
    setPositionCalculated(false);
    positionLockedRef.current = false;
    
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
    
    // console.log(`✅ SmokeParticleEngine: ${experienceId} cleanup completed`);
  }, [scene, stopAnimation, experienceId]);

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
        console.error(`❌ SmokeParticleEngine: Failed to initialize ${experienceId}:`, error);
        if (onError) onError(`Smoke particle initialization failed for ${experienceId}: ${error}`);
      }
    };
    
    // console.log(`🔥 SmokeParticleEngine: Starting initialization for ${experienceId}...`);
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

  // ✅ NEW: Handle position changes when smoke system is ready
  useEffect(() => {
    if (smokeSystemRef.current && positionCalculated) {
      smokeSystemRef.current.position.copy(smokePosition);
      // console.log(`🎯 SmokeParticleEngine: ${experienceId} position updated to (${smokePosition.x}, ${smokePosition.y}, ${smokePosition.z})`);
    }
  }, [smokePosition, positionCalculated, experienceId]);

  return null; // Engine component renders nothing directly
};

export default SmokeParticleEngine;