import React, { useEffect, useState, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { getAssetPath } from '../../utils/assetPaths';

const SHOW_DEBUG_PANEL = false;

interface Experience1968Props {
  onClose: () => void;
  onNext?: () => void;
  arPosition?: THREE.Vector3;
  arScene?: THREE.Scene;
  arCamera?: THREE.PerspectiveCamera;
  coordinateScale?: number;
  onModelRotate?: (handler: (deltaX: number, deltaY: number) => void) => void;
  onModelScale?: (handler: (scaleFactor: number) => void) => void;
  onModelReset?: (handler: () => void) => void;
  onSwipeUp?: (handler: () => void) => void;
  onSwipeDown?: (handler: () => void) => void;
  onExperienceReady?: () => void;
}

const Experience1968: React.FC<Experience1968Props> = ({ 
  onClose, 
  onNext,
  arPosition,
  arScene,
  arCamera,
  coordinateScale = 1.0,
  onModelRotate,
  onModelScale,
  onModelReset,
  onSwipeUp,
  onSwipeDown,
  onExperienceReady, 
}) => {
  console.log('🔥 Experience1968: Creating 1968 smoke experience');

  // Refs for Three.js objects (following Lily pattern)
  const smokeSystemRef = useRef<THREE.Group | null>(null);
  const particleSystemRef = useRef<THREE.Points | null>(null);
  const chimneyRef = useRef<THREE.Mesh | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const initialScaleRef = useRef<number>(1);
  const clockRef = useRef(new THREE.Clock());

  // Refs for animation state (no re-renders during animation)
  const emissionStateRef = useRef({
    activeParticles: 0,
    nextEmissionTime: 0,
    time: 0
  });

  // Refs for particle system parameters (avoid re-renders)
  const smokeParamsRef = useRef({
    particleCount: 1,
    maxParticleCount: 5000, // Reduced for mobile AR
    emissionRate: 100,
    particleLifetime: 10.0,
    windSpeed: 5.0,
    windDirection: new THREE.Vector3(1, 0.1, 0),
    turbulenceStrength: 4.0,
    smokeRiseSpeed: 8.0,
    smokeSpread: 5.0,
    baseColor: new THREE.Color(0.7, 0.7, 0.7),
     emissionWidth: 50.0, 
     emissionHeight: 3.0,
     emissionDepth: 6.0,
  });

  // Store initial camera position for reset
  const initialCameraPos = useRef(new THREE.Vector3(0, 0, 5));

  // State to track override status (following Lily pattern)
  const [arTestingOverride, setArTestingOverride] = useState(() => {  
    return (window as any).arTestingOverride ?? true;
  });

  // State for UI updates only
  const [hasSmokeSystem, setHasSmokeSystem] = useState(false);
  const [activeParticleCount, setActiveParticleCount] = useState(0);
  const [loadingProgress, setLoadingProgress] = useState(0);

  // Define isArMode at the component level
  const isArMode = !!(arScene && arCamera && arPosition);

  // Effect 1: Override status polling (following Lily pattern)
  useEffect(() => {
    const checkOverride = () => {
      const currentOverride = (window as any).arTestingOverride ?? true;
      if (currentOverride !== arTestingOverride) {
        setArTestingOverride(currentOverride);
        console.log('🔥 Experience1968 override changed:', currentOverride);
        
        if (smokeSystemRef.current && isArMode && arPosition) {
          if (currentOverride) {
            console.log('🎯 Setting smoke system override position (0, 0, -50)');
            smokeSystemRef.current.position.set(0, 0, -50);
          } else {
            console.log('🎯 Setting smoke system anchor position:', arPosition);
            smokeSystemRef.current.position.copy(arPosition);
          }
          
          // Force visual update
          smokeSystemRef.current.visible = false;
          setTimeout(() => {
            if (smokeSystemRef.current) {
              smokeSystemRef.current.visible = true;
            }
          }, 50);
          
          console.log('🎯 Smoke system position after change:', smokeSystemRef.current.position);
        }
      }
    };
    
    const interval = setInterval(checkOverride, 100);
    return () => clearInterval(interval);
  }, [arTestingOverride]);

  // Effect 2: AR position changes (following Lily pattern)
  useEffect(() => {
    if (smokeSystemRef.current && isArMode && arPosition) {
      const currentOverride = (window as any).arTestingOverride ?? true;
      
      if (currentOverride) {
        smokeSystemRef.current.position.set(0, 0, -50);
      } else {
        smokeSystemRef.current.position.copy(arPosition);
      }
      
      console.log('🎯 Smoke position updated due to AR change:', smokeSystemRef.current.position);
    }
  }, [isArMode, arPosition]);

  // Effect 3: Register gesture handlers (following Mac pattern)
  useEffect(() => {
    // Register rotation handler - operates on the smoke GROUP
    if (onModelRotate) {
      onModelRotate((deltaX: number, deltaY: number, deltaZ: number = 0) => {
        if (smokeSystemRef.current) {
          // Store current position to prevent drift
          const currentPosition = smokeSystemRef.current.position.clone();

          // Apply rotation
          smokeSystemRef.current.rotation.y += deltaX;
          smokeSystemRef.current.rotation.x += deltaY;
          if (deltaZ !== 0) {
            smokeSystemRef.current.rotation.z += deltaZ;
          }

          // Restore position to prevent drift
          smokeSystemRef.current.position.copy(currentPosition);
        }
      });
    }

    // Register scale handler - scales the entire smoke system
    if (onModelScale) {
      onModelScale((scaleFactor: number) => {
        if (smokeSystemRef.current) {
          const currentScale = smokeSystemRef.current.scale.x;
          const newScale = Math.max(0.1, Math.min(10, currentScale * scaleFactor));
          console.log('🔥 Smoke scale handler called:', {
            scaleFactor,
            currentScale: currentScale.toFixed(3),
            newScale: newScale.toFixed(3)
          });
          smokeSystemRef.current.scale.setScalar(newScale);
        }
      });
    }

    // Register reset handler - resets the entire smoke system
    if (onModelReset) {
      onModelReset(() => {
        console.log('🔄 Smoke RESET HANDLER CALLED');
        if (smokeSystemRef.current) {
          // Reset rotation and scale
          smokeSystemRef.current.rotation.set(0, 0, 0);
          const initialScale = initialScaleRef.current;
          smokeSystemRef.current.scale.set(initialScale, initialScale, initialScale);
          
          // Reset position based on current mode
          if (isArMode && arPosition) {
            const currentOverride = (window as any).arTestingOverride ?? true;
            
            if (currentOverride) {
              smokeSystemRef.current.position.set(0, 0, -50);
              console.log('🔄 Reset: Smoke positioned at override location (distant)');
            } else {
              smokeSystemRef.current.position.copy(arPosition);
              console.log('🔄 Reset: Smoke positioned at AR anchor location');
            }
          } else {
            smokeSystemRef.current.position.set(0, 0, -30);
            console.log('🔄 Reset: Smoke positioned at standalone location');
          }
          
          console.log('🔄 Smoke reset completed');
        }
      });
    }

    // Register swipe handlers
    if (onSwipeUp) {
      onSwipeUp(() => {
        console.log('👆 Swipe up detected on smoke - could increase emission rate');
        smokeParamsRef.current.emissionRate = Math.min(200, smokeParamsRef.current.emissionRate + 25);
      });
    }

    if (onSwipeDown) {
      onSwipeDown(() => {
        console.log('👇 Swipe down detected on smoke - could decrease emission rate');
        smokeParamsRef.current.emissionRate = Math.max(10, smokeParamsRef.current.emissionRate - 25);
      });
    }
  }, []); // Empty dependency array - register once only

  // Particle emission function (adapted from your CodePen)
  const emitParticles = useCallback((currentTime: number, deltaTime: number) => {
    if (!particleSystemRef.current) return;
    
    const emitCount = Math.floor(smokeParamsRef.current.emissionRate * deltaTime);
    if (emitCount <= 0) return;
    
    // Get attribute buffers
    const positions = particleSystemRef.current.geometry.attributes.position.array;
    const velocities = particleSystemRef.current.geometry.attributes.velocity.array;
    const lifetimes = particleSystemRef.current.geometry.attributes.lifetime.array;
    const startTimes = particleSystemRef.current.geometry.attributes.startTime.array;
    const sizes = particleSystemRef.current.geometry.attributes.size.array;
    const colorSeeds = particleSystemRef.current.geometry.attributes.colorSeed.array;
    const windFactors = particleSystemRef.current.geometry.attributes.windFactor.array;
    const active = particleSystemRef.current.geometry.attributes.isActive.array; // FIXED: use renamed attribute
    
    let emitted = 0;
    
    // Look for inactive particles to activate
    for (let i = 0; i < smokeParamsRef.current.maxParticleCount && emitted < emitCount; i++) {
      if (active[i] < 0.5) { // If inactive
        // Activate this particle
        active[i] = 1.0;
        
        const i3 = i * 3;
        
//*********************  */ Position at emitter with small random offset (emitter is at origin of the group)
        positions[i3] = (Math.random() - 0.2) * 125;
        positions[i3 + 1] = (Math.random() - 0.2) * 20;
        positions[i3 + 2] = (Math.random() - 0.2) * 20;
        
//*********************  */ Random velocity
        velocities[i3] = (Math.random() * (smokeParamsRef.current.smokeSpread *2.0))
        velocities[i3 + 1] = (Math.random() * 3.0 )+ (smokeParamsRef.current.smokeRiseSpeed * 2.5)
        velocities[i3 + 2] = (Math.random() - 0.5) * (smokeParamsRef.current.smokeSpread * 0.5);
        
//*********************  */ Particle properties 
        lifetimes[i] = smokeParamsRef.current.particleLifetime + Math.random() * smokeParamsRef.current.particleLifetime * 2.5;
        startTimes[i] = currentTime;
        sizes[i] = 1.3 + Math.random() * 0.4;
        colorSeeds[i] = Math.random();
        windFactors[i] = 0.5 + Math.random() * 0.5
//*********************  */ Particle properties 
        
        emitted++;
        emissionStateRef.current.activeParticles++;
      }
    }
    
    // Update buffers
    particleSystemRef.current.geometry.attributes.position.needsUpdate = true;
    particleSystemRef.current.geometry.attributes.velocity.needsUpdate = true;
    particleSystemRef.current.geometry.attributes.lifetime.needsUpdate = true;
    particleSystemRef.current.geometry.attributes.startTime.needsUpdate = true;
    particleSystemRef.current.geometry.attributes.size.needsUpdate = true;
    particleSystemRef.current.geometry.attributes.colorSeed.needsUpdate = true;
    particleSystemRef.current.geometry.attributes.windFactor.needsUpdate = true;
    particleSystemRef.current.geometry.attributes.isActive.needsUpdate = true; // FIXED: use renamed attribute
  }, []);

  // Particle lifecycle management (adapted from your CodePen)
  const updateParticleLifecycle = useCallback((currentTime: number) => {
    if (!particleSystemRef.current) return;
    
    const lifetimes = particleSystemRef.current.geometry.attributes.lifetime.array;
    const startTimes = particleSystemRef.current.geometry.attributes.startTime.array;
    const active = particleSystemRef.current.geometry.attributes.isActive.array; // FIXED: use renamed attribute
    
    let deactivated = 0;
    
    // Check for particles that have exceeded their lifetime
    for (let i = 0; i < smokeParamsRef.current.maxParticleCount; i++) {
      if (active[i] > 0.5) { // If active
        const age = currentTime - startTimes[i];
        if (age > lifetimes[i]) {
          // Deactivate this particle
          active[i] = 0.0;
          deactivated++;
        }
      }
    }
    
    // Update the active particle count
    emissionStateRef.current.activeParticles -= deactivated;
    
    // Update buffer only if there were deactivations
    if (deactivated > 0) {
      particleSystemRef.current.geometry.attributes.isActive.needsUpdate = true; // FIXED: use renamed attribute
    }
  }, []);

  // Create particle system (adapted from your CodePen)
  const createSmokeParticleSystem = useCallback((scene: THREE.Scene) => {
    console.log('🔥 Creating smoke particle system...');
    
    // Create main group to hold smoke system and chimney
    const smokeGroup = new THREE.Group();
    smokeSystemRef.current = smokeGroup;
    
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
    
    // Assign attributes to geometry
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("velocity", new THREE.BufferAttribute(velocities, 3));
    geometry.setAttribute("lifetime", new THREE.BufferAttribute(lifetimes, 1));
    geometry.setAttribute("startTime", new THREE.BufferAttribute(startTimes, 1));
    geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute("colorSeed", new THREE.BufferAttribute(colorSeeds, 1));
    geometry.setAttribute("windFactor", new THREE.BufferAttribute(windFactors, 1));
    geometry.setAttribute("isActive", new THREE.BufferAttribute(active, 1)); // FIXED: renamed attribute
    
    // Load textures
    const textureLoader = new THREE.TextureLoader();
    
    // Create shader material with DEBUGGING (your sophisticated shader from CodePen)
    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0.0 },
        pointTexture: { value: null }, // Will be loaded
        noiseTexture: { value: null }, // Will be loaded
        baseColor: { value: smokeParamsRef.current.baseColor },
        sizeMultiplier: { value: isArMode ? 2.0 : 1.0 }, // REDUCED: Much smaller particles
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
        attribute float isActive; // FIXED: renamed from reserved word 'active'
        
        varying float vAge;
        varying float vNormalizedAge;
        varying float vColorSeed;
        varying float vFadeOpacity;
        varying vec2 vUv;
        
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
          
          // Simplified expansion
          float expansionFactor = normalizedAge * 0.6;
          pos.xz *= (1.0 + expansionFactor);
          
          // Transform to camera space
          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          
          // FIXED: Reasonable point size calculation
          float baseSize = size * sizeMultiplier;
          float sizeScale = sin(normalizedAge * PI) + 0.5;
          
          // Distance-based scaling with reasonable minimum size
          float distanceScale = 300.0 / max(-mvPosition.z, 1.0);
          gl_PointSize = max(baseSize * sizeScale * distanceScale, 2.0); // Minimum 2 pixels
          
          // Pass noise coordinate to fragment shader
          vUv = vec2(pos.x * 0.01 + time * 0.05, pos.y * 0.01);
        }
      `,
      fragmentShader: `
        uniform vec3 baseColor;
        uniform sampler2D pointTexture;
        uniform sampler2D noiseTexture;
        uniform float colorVariation;
        uniform float turbulenceStrength;
        
        varying float vAge;
        varying float vNormalizedAge;
        varying float vColorSeed;
        varying float vFadeOpacity;
        varying vec2 vUv;
        
        void main() {
            // DEBUGGING: Start with solid color to ensure particles are visible
            vec3 debugColor = vec3(1.0, 1.0, 1.0); 
            
            // Simple circular fade from center
            vec2 center = gl_PointCoord - 0.5;
            float dist = length(center);
            
            // Create circular particle shape
            if (dist > 0.5) {
              discard;
            }
            
            // FIXED: Simplified noise sampling without textureSize
            float noise = 1.0;
            // Always try to sample noise texture, will be black if not loaded
            noise = texture2D(noiseTexture, vUv).r;
            
            // Simplified color mixing
            float fireAmount = smoothstep(0.7, 1.0, vColorSeed * noise * colorVariation);
            vec3 smokeColor = mix(vec3(0.2, 0.2, 0.2), baseColor, vColorSeed * 0.7);
            vec3 finalColor = mix(smokeColor, debugColor, fireAmount);
            
            // Simple fade based on distance from center and age
            float centerFade = 1.0 - (dist * 2.0);
            float finalAlpha = vFadeOpacity * centerFade * 0.8;
            
            gl_FragColor = vec4(finalColor, finalAlpha);
          }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    // Load textures asynchronously (but don't block particle creation)
    Promise.all([
      new Promise((resolve, reject) => {
        textureLoader.load(
          getAssetPath('textures/smoke.png'),
          resolve,
          undefined,
          reject
        );
      }),
      new Promise((resolve, reject) => {
        textureLoader.load(
           getAssetPath('textures/noise.png'),
          resolve,
          undefined,
          reject
        );
      })
    ]).then(([smokeTexture, noiseTexture]) => {
      material.uniforms.pointTexture.value = smokeTexture;
      material.uniforms.noiseTexture.value = noiseTexture;
      console.log('✅ Smoke textures loaded successfully');
    }).catch((error) => {
      console.warn('⚠️ Failed to load smoke textures, using fallback:', error);
      // Particles will still work without textures
    });
    
    // Create particle system IMMEDIATELY (don't wait for textures)
    const particleSystem = new THREE.Points(geometry, material);
    particleSystemRef.current = particleSystem;
    smokeGroup.add(particleSystem);
    
    // DEBUG: Log particle system creation
    console.log('🔥 Particle system created:', {
      geometry: {
        attributes: Object.keys(geometry.attributes),
        vertexCount: geometry.attributes.position.count
      },
      material: {
        type: material.type,
        uniforms: Object.keys(material.uniforms)
      }
    });
    
    // Force emission of some particles immediately for testing
    console.log('🔥 Force-emitting initial particles for debugging...');
    for (let i = 0; i < Math.min(10, smokeParamsRef.current.maxParticleCount); i++) {
      const i3 = i * 3;
      active[i] = 1.0;
      
//*********************  */ Position at origin
      positions[i3] = (Math.random() - 0.2) * 125;
      positions[i3 + 1] = (Math.random() - 0.2) * 20;
      positions[i3 + 2] = (Math.random() - 0.2) * 20;
      
//*********************  */  velocity for movement
      velocities[i3] = (Math.random() - 0.5) * 2.0; // Some horizontal spread
      velocities[i3 + 1] = 2.0 + Math.random() * 3.0; // Upward movement (2-5 units/sec)
      velocities[i3 + 2] = (Math.random() - 0.5) * 1.0; // Some depth movement
      
      // Set other properties
      lifetimes[i] = 20.0; // Reasonable lifetime for testing
      startTimes[i] = 0; // Start immediately
      sizes[i] = 1.0; // Normal size for visibility (was 5.0)
      colorSeeds[i] = 0.5;
      windFactors[i] = 1.0;
      
      emissionStateRef.current.activeParticles++;
    }
    
    // Force update geometry
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.velocity.needsUpdate = true;
    geometry.attributes.lifetime.needsUpdate = true;
    geometry.attributes.startTime.needsUpdate = true;
    geometry.attributes.size.needsUpdate = true;
    geometry.attributes.colorSeed.needsUpdate = true;
    geometry.attributes.windFactor.needsUpdate = true;
    geometry.attributes.isActive.needsUpdate = true; // FIXED: use renamed attribute
    
    console.log('🔥 Initial particles set up, active count:', emissionStateRef.current.activeParticles);
    
    chimneyRef.current = null;
    
    // Position the entire group
    if (isArMode && arPosition) {
      const currentOverride = (window as any).arTestingOverride ?? true;
      if (currentOverride) {
        smokeGroup.position.set(0, 0, -50); // Far distance for development
      } else {
        smokeGroup.position.copy(arPosition); // At AR anchor
      }
    } else {
      smokeGroup.position.set(0, 0, -30); // Standalone mode
    }
    
    // Set initial scale
    const scale = isArMode ? 0.1 : 1.0; // Much smaller for AR
    initialScaleRef.current = scale;
    smokeGroup.scale.setScalar(scale);
    
    // Add to scene
    scene.add(smokeGroup);
    
    setHasSmokeSystem(true);
    onExperienceReady?.();
    
    console.log('✅ Smoke particle system created successfully');
    return smokeGroup;
  }, [isArMode, arPosition, onExperienceReady]);

  // Main effect for scene setup (following Lily pattern)
  useEffect(() => {
    let isMounted = true;
    
    console.log('🔥 Experience1968 mode:', isArMode ? 'AR' : 'Standalone');
    
    // Create container for standalone mode
    const container = document.createElement('div');
    container.id = 'threejs-container';
    container.style.position = 'fixed';
    container.style.top = '0';
    container.style.left = '0';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.zIndex = '1020';
    
    if (!isArMode) {
      document.body.appendChild(container);
    }

    // Create instructions
    const instructions = document.createElement('div');
    instructions.style.position = 'absolute';
    instructions.style.bottom = '20px';
    instructions.style.left = '50%';
    instructions.style.transform = 'translateX(-50%)';
    instructions.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    instructions.style.color = 'white';
    instructions.style.padding = '12px 20px';
    instructions.style.borderRadius = '8px';
    instructions.style.textAlign = 'center';
    instructions.style.fontFamily = 'var(--font-rigby)';
    instructions.style.fontWeight = '400';
    instructions.style.zIndex = '1020';
    instructions.innerHTML = 'Experience the smoke from the 1968 Kenilworth dump fire. Tap continue when ready.';
    container.appendChild(instructions);


    // Initialize Three.js components
    let scene: THREE.Scene;
    let camera: THREE.PerspectiveCamera;
    let renderer: THREE.WebGLRenderer | null = null;
    let controls: OrbitControls | null = null;

    if (isArMode) {
      // AR Mode: Use provided scene and camera
      scene = arScene!;
      camera = arCamera!;
      sceneRef.current = scene;
      cameraRef.current = camera;
      console.log('🔥 Experience1968 using AR scene and camera');
    } else {
      // Standalone Mode: Create own scene/camera/renderer
      scene = new THREE.Scene();
      scene.background = new THREE.Color(0x87ceeb); // Sky blue background
      scene.fog = new THREE.FogExp2(0x87ceeb, 0.002); // Atmospheric fog
      sceneRef.current = scene;
      
      camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 1000);
      camera.position.copy(initialCameraPos.current);
      camera.lookAt(0, 10, -100); // Look toward distance like CodePen
      cameraRef.current = camera;
      
      renderer = new THREE.WebGLRenderer({ 
        antialias: true, 
        alpha: isArMode, // Only transparent in AR mode
        premultipliedAlpha: false
      });
      
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setClearColor(isArMode ? 0x000000 : 0x87ceeb, isArMode ? 0 : 1);
      container.appendChild(renderer.domElement);

      // Add OrbitControls only in standalone mode
      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.25;
      controls.screenSpacePanning = false;
      controls.minDistance = 5;
      controls.maxDistance = 200;
      controls.maxPolarAngle = Math.PI / 1.5;
      controls.target.set(0, 10, -50);
      controlsRef.current = controls;
      
      // Add lighting only in standalone mode
      const ambientLight = new THREE.AmbientLight(0x606060);
      scene.add(ambientLight);

      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
      directionalLight.position.set(50, 200, 100);
      scene.add(directionalLight);

      // Add ground plane in standalone mode
      const groundGeometry = new THREE.PlaneGeometry(1000, 1000);
      const groundMaterial = new THREE.MeshLambertMaterial({ 
        color: 0x704214, // Dirt brown
        side: THREE.DoubleSide 
      });
      const ground = new THREE.Mesh(groundGeometry, groundMaterial);
      ground.rotation.x = Math.PI / 2;
      ground.position.y = -5;
      scene.add(ground);
    }

    // Create smoke particle system
    createSmokeParticleSystem(scene);

    // Handle window resize
    const handleResize = () => {
      if (isMounted && camera && renderer) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      }
    };
    
    window.addEventListener('resize', handleResize);
    
    // Animation loop
    const animate = function () {
      if (!isMounted) return;
      
      requestAnimationFrame(animate);
      const deltaTime = clockRef.current.getDelta();
      emissionStateRef.current.time += deltaTime;
      
      if (particleSystemRef.current) {
        // IMPORTANT: Update the time uniform to drive particle movement
        (particleSystemRef.current.material as THREE.ShaderMaterial).uniforms.time.value = emissionStateRef.current.time;
        
        // Emit new particles and manage lifecycle
        emitParticles(emissionStateRef.current.time, deltaTime);
        updateParticleLifecycle(emissionStateRef.current.time);
        
        // Update UI state occasionally (not every frame to avoid re-renders)
        if (Math.random() < 0.05) { // 5% chance per frame
          setActiveParticleCount(emissionStateRef.current.activeParticles);
        }
        
        // DEBUG: Log time occasionally to ensure it's updating
        if (emissionStateRef.current.time % 5 < deltaTime) { // Every ~5 seconds
          console.log('🔥 Animation time:', emissionStateRef.current.time.toFixed(2), 'Active particles:', emissionStateRef.current.activeParticles);
        }
      }
      
      if (controls) {
        controls.update();
      }
      
      if (renderer && scene && camera) {
        renderer.render(scene, camera);
      }
    };
    
    animate();
    
    // Cleanup function
    return () => {
      isMounted = false;
      
      window.removeEventListener('resize', handleResize);
      
      if (controls) {
        controls.dispose();
      }
      
      if (renderer) {
        renderer.dispose();
      }
      
      // Clean up particle system
      if (particleSystemRef.current) {
        if (particleSystemRef.current.geometry) {
          particleSystemRef.current.geometry.dispose();
        }
        if (particleSystemRef.current.material) {
          if (Array.isArray(particleSystemRef.current.material)) {
            particleSystemRef.current.material.forEach(material => material.dispose());
          } else {
            particleSystemRef.current.material.dispose();
          }
        }
      }
      
    
      
      if (document.body.contains(container)) {
        document.body.removeChild(container);
      }
    };
  }, [isArMode, createSmokeParticleSystem]);

  return (
    <>
      {/* Loading indicator */}
      {!hasSmokeSystem && sceneRef.current && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          width: '80%',
          height: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          color: 'white',
          fontFamily: 'var(--font-rigby)',
        }}>
          {/* Loading spinner */}
          <div style={{
            width: '60px',
            height: '60px',
            border: '3px solid rgba(120, 60, 30, 0.3)',
            borderTop: '3px solid #8B4513',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            marginBottom: '20px'
          }} />
      
          {/* Loading text */}
          <h2 style={{
            margin: '0 0 10px 0',
            fontSize: '24px',
            fontWeight: '400',
            color: '#D2691E'
          }}>
            🔥 Preparing 1968 Experience
          </h2>
          
          <p style={{
            margin: '0',
            fontSize: '16px',
            opacity: 0.8,
            textAlign: 'center',
            maxWidth: '300px'
          }}>
            Setting up
          </p>
          
          {/* Progress bar if loading progress is available */}
          {loadingProgress > 0 && (
            <div style={{
              marginTop: '20px',
              width: '200px',
              height: '4px',
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              borderRadius: '2px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${loadingProgress}%`,
                height: '100%',
                backgroundColor: '#8B4513',
                transition: 'width 0.3s ease',
                borderRadius: '2px'
              }} />
            </div>
          )}
      
          {loadingProgress > 0 && (
            <p style={{
              margin: '10px 0 0 0',
              fontSize: '14px',
              opacity: 0.7
            }}>
              {loadingProgress.toFixed(0)}% loaded
            </p>
          )}
          
          {/* CSS animation for spinner */}
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      )}


      {/* Debug Panel for Smoke Experience */}
      {SHOW_DEBUG_PANEL && (
        <div style={{
          position: 'absolute',
          bottom: '10px',
          right: '10px',
          backgroundColor: 'rgba(0, 0, 0, 0)',
          color: 'white',
          padding: '10px',
          borderRadius: '4px',
          fontSize: '12px',
          zIndex: 1020,
          pointerEvents: 'auto',
          fontFamily: 'monospace'
        }}>
          <div style={{ color: 'orange' }}>🔥 SMOKE SYSTEM DEBUG</div>
          <div>Mode: {isArMode ? 'AR Portal' : 'Standalone'}</div>
          {arPosition && (
            <div>AR Anchor: [{arPosition.x.toFixed(3)}, {arPosition.y.toFixed(3)}, {arPosition.z.toFixed(3)}]</div>
          )}
          {smokeSystemRef.current && (
            <div style={{ color: 'cyan' }}>
              Smoke Pos: [{smokeSystemRef.current.position.x.toFixed(3)}, {smokeSystemRef.current.position.y.toFixed(3)}, {smokeSystemRef.current.position.z.toFixed(3)}]
            </div>
          )}
          <div>Scale: {coordinateScale}x</div>
          <div style={{ color: hasSmokeSystem ? 'lightgreen' : 'orange' }}>
            System: {hasSmokeSystem ? '✅ Active' : '❌ Loading'}
          </div>
          <div style={{ color: 'lightblue', fontSize: '10px' }}>
            Active Particles: {activeParticleCount}/{smokeParamsRef.current.maxParticleCount}
          </div>
          <div style={{ color: 'lightblue', fontSize: '10px' }}>
            Emission: {smokeParamsRef.current.emissionRate}/sec
          </div>
          <div style={{ color: 'lightblue', fontSize: '10px' }}>
            Wind: {smokeParamsRef.current.windSpeed} | Rise: {smokeParamsRef.current.smokeRiseSpeed}
          </div>
          <div style={{ color: 'lightgreen', fontSize: '10px' }}>
            Shader-based particles with wind physics
          </div>
          
          <div 
            onClick={() => {
              const newValue = !arTestingOverride;
              (window as any).arTestingOverride = newValue;
              setArTestingOverride(newValue);
              console.log('🎯 AR Override toggled:', newValue ? 'ON' : 'OFF');
              
              // Immediately update smoke position if we have the system
              if (smokeSystemRef.current && isArMode && arPosition) {
                if (newValue) {
                  console.log('🎯 Immediately setting smoke override position (0, 0, -50)');
                  smokeSystemRef.current.position.set(0, 0, -50);
                } else {
                  console.log('🎯 Immediately setting smoke anchor position:', arPosition);
                  smokeSystemRef.current.position.copy(arPosition);
                }
                console.log('🎯 Smoke position updated to:', smokeSystemRef.current.position);
              }
            }}
            style={{ 
              cursor: 'pointer', 
              userSelect: 'none', 
              marginTop: '5px',
              padding: '2px 4px',
              backgroundColor: arTestingOverride ? 'rgba(0, 255, 0, 0.2)' : 'rgba(255, 0, 0, 0.2)',
              borderRadius: '2px'
            }}
          >
            Override: {arTestingOverride ? '✅ (0,0,-50)' : '❌ (AR Anchor)'}
          </div>
        </div>
      )}
    </>
  );
};

export default Experience1968;