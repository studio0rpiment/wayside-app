import React, { useEffect, useState, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { getAssetPath } from '../../utils/assetPaths';

const SHOW_DEBUG_PANEL = false;

interface WaterRiseExperienceProps {
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

const WaterRiseExperience: React.FC<WaterRiseExperienceProps> = ({ 
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
  console.log('🌊 WaterRiseExperience: Creating water level rise experience');

  //Consts first
  // Store initial camera position for reset
  const initialCameraPos = useRef(new THREE.Vector3(0, 30, 100));
  // State to track override status
  const [arTestingOverride, setArTestingOverride] = useState(() => {  
    return (window as any).arTestingOverride ?? true;
  });

  // State for UI updates only (minimal)
  const [hasWaterSystem, setHasWaterSystem] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  // Define isArMode at the component level
  const isArMode = !!(arScene && arCamera && arPosition);
  // Helper math
  const degreesToRadians = (degrees: number) => degrees * (Math.PI / 180);

  // Refs for Three.js objects ()
  const waterSystemRef = useRef<THREE.Group | null>(null);
  const waterParticlesRef = useRef<THREE.Points | null>(null);
  // ✅ NEW: Underwater particles ref
  const underwaterParticlesRef = useRef<THREE.Points | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const initialScaleRef = useRef<number>(1);
  const clockRef = useRef(new THREE.Clock());

  // ✅ NEW: Refs for DOM elements to avoid React state
  const yearDisplayRef = useRef<HTMLDivElement | null>(null);
  const sliderRef = useRef<HTMLInputElement | null>(null);
  const sliderTrackRef = useRef<HTMLDivElement | null>(null);
  const sliderThumbRef = useRef<HTMLDivElement | null>(null);

  //Caustics
  const causticsPlaneRef = useRef<THREE.Mesh | null>(null);
  const causticsTexturesRef = useRef<THREE.Texture[]>([]);
  const causticsStateRef = useRef({
    currentTextureIndex: 0,
    frameCount: 0,
    time: 0,
    isVisible: false
  });

  // Refs for water state (no re-renders during animation)
  const waterStateRef = useRef({
    currentWaterLevel: 0,
    targetWaterLevel: 0,
    time: 0,
    sliderValue: 0
  });

  // Refs for water system parameters (avoid re-renders)
  const waterParamsRef = useRef({
    maxWaterRise: 2,
    startYear: 2030,
    endYear: 2100,
    gridResolution: 80,
    waterSize: 80,
    particleCount: 5000,
    particleColor: new THREE.Color().setHSL(210/360, 0.8, 0.7),
    waveSpeed: 0.001,
    waveAmplitude: 1.0,

    // NEW: Underwater particles parameters
   underwater: {
    particleCount: isArMode ? 2000 : 3000,
    volumeSize: 60,
    layerCount: 10,
    baseOpacity: 0.1, // ← Change from 0.1 to 0.5
    maxOpacity: 0.1,  // ← Change from 0.4 to 0.8
    particleSize: 1, // ← Change from 0.15 to 2.0
    driftSpeed: 0.0005,
    color: {
      hue: 0,    // Blue hue
      saturation: 0,   // Full saturation
      lightness: 0.0  // Very dark
    }
  },

    caustics: {
      textureUrls: [
        getAssetPath('textures/c1.bmp'),
        getAssetPath('textures/c2.bmp'),
        getAssetPath('textures/c3.bmp'),
        getAssetPath('textures/c4.bmp'),
        getAssetPath('textures/c5.bmp')
      ],
      planeSize: 20, // Smaller for AR performance
      animationSpeed: 5, // Change texture every 5 frames
      opacity: 0.3,
      color: 0xffffff,
      moveSpeed: 0.1
    }
  });

  // ✅ NEW: Load caustics textures function
  const loadCausticsTextures = useCallback(() => {
    console.log('🌊 Loading caustics textures...');
    const textureLoader = new THREE.TextureLoader();
    const causticUrls = waterParamsRef.current.caustics.textureUrls;
    
    let loadedCount = 0;
    const textures: THREE.Texture[] = [];
    
    causticUrls.forEach((url, index) => {
      textureLoader.load(
        url,
        (texture) => {
          // Configure texture for better performance
          texture.wrapS = THREE.RepeatWrapping;
          texture.wrapT = THREE.RepeatWrapping;
          texture.repeat.set(4, 4); // Tile the texture
          texture.minFilter = THREE.LinearFilter; // Faster than MipMap
          texture.magFilter = THREE.LinearFilter;
          
          textures[index] = texture;
          loadedCount++;
          
          console.log(`✅ Caustic texture ${loadedCount}/${causticUrls.length} loaded`);
          
          if (loadedCount === causticUrls.length) {
            causticsTexturesRef.current = textures;
            console.log('🌊 All caustics textures loaded successfully');
          }
        },
        undefined,
        (error) => {
          console.warn(`⚠️ Failed to load caustic texture ${index}:`, error);
        }
      );
    });
  }, [isArMode]);

  // ✅ NEW: Create caustics plane function
  const createCausticsPlane = useCallback((scene: THREE.Scene) => {
    console.log('🌊 Creating caustics plane...');
    
    const causticsParams = waterParamsRef.current.caustics;
    const geometry = new THREE.PlaneGeometry(causticsParams.planeSize, causticsParams.planeSize);
    
    // Create material with first texture (or fallback)
    const material = new THREE.MeshBasicMaterial({
      map: causticsTexturesRef.current[0] || null,
      transparent: true,
      opacity: causticsParams.opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      color: causticsParams.color,
      side: THREE.DoubleSide
    });
    
    const causticsPlane = new THREE.Mesh(geometry, material);
    
    // Position caustics plane slightly above ground
    causticsPlane.rotation.y = degreesToRadians(0); // Horizontal
    causticsPlane.position.z =  40; 
    causticsPlane.position.y = -200 ; 
    causticsPlane.visible = true; // Start hidden
    
    causticsPlaneRef.current = causticsPlane;
    
    // Add to water system group (not directly to scene)
    if (waterSystemRef.current) {
      waterSystemRef.current.add(causticsPlane);
      console.log('✅ Caustics plane added to water system');
    } else {
      scene.add(causticsPlane);
      console.log('✅ Caustics plane added to scene');
    }
    
    return causticsPlane;
  }, []);

  // ✅ NEW: Create underwater particles function
  const createUnderwaterParticles = useCallback(() => {
    console.log('🌊 Creating underwater particle volume...');
    
    const underwaterParams = waterParamsRef.current.underwater;
    const count = underwaterParams.particleCount;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const opacityFactors = new Float32Array(count); // For depth-based opacity
    const driftOffsets = new Float32Array(count * 3); // For subtle movement
    
    const volumeSize = underwaterParams.volumeSize;
    const maxWaterRise = waterParamsRef.current.maxWaterRise;

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    
    // ✅ Simple, direct sizing:
    positions[i3] = (Math.random() - 0.5) * 200;     // x: wide spread
    positions[i3 + 1] = (Math.random() - 0.5) * 500; // y: tall spread
    positions[i3 + 2] = -5; // z: fixed depth
    
    // Simple opacity based on Y position
    const normalizedHeight = (positions[i3 + 1] + 75) / 150; // Normalize to 0-1
    opacityFactors[i] = Math.pow(1 - normalizedHeight, 0.5); // Lower = more opaque
    
    // Drift offsets
    driftOffsets[i3] = Math.random() * Math.PI * 2;
    driftOffsets[i3 + 1] = Math.random() * Math.PI * 2;  
    driftOffsets[i3 + 2] = Math.random() * Math.PI * 2;
  }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('opacityFactor', new THREE.BufferAttribute(opacityFactors, 1));
    geometry.setAttribute('driftOffset', new THREE.BufferAttribute(driftOffsets, 3));
    
    // Create material for underwater particles
    const material = new THREE.PointsMaterial({
      size: underwaterParams.particleSize,
      transparent: true,
      opacity: underwaterParams.baseOpacity,
      blending: THREE.NormalBlending,
      depthWrite: false,
        color: new THREE.Color().setHSL(
          underwaterParams.color.hue,
          underwaterParams.color.saturation, 
          underwaterParams.color.lightness
        ), // Deeper blue than surface
      vertexColors: false
    });
    
    const underwaterParticles = new THREE.Points(geometry, material);
    underwaterParticles.visible = false; // Start hidden
    underwaterParticlesRef.current = underwaterParticles;
    
    // Add to water system group
    if (waterSystemRef.current) {
      waterSystemRef.current.add(underwaterParticles);
      console.log('✅ Underwater particles added to water system');
    }
    
    console.log(`🌊 Underwater particle volume created: ${count} particles`);
    return underwaterParticles;
  }, []);

  // ✅ NEW: Update underwater particles function
 // In updateUnderwaterParticles(), replace the complex per-particle logic:
const updateUnderwaterParticles = useCallback((time: number) => {
  if (!underwaterParticlesRef.current) return;
  
  const underwaterParams = waterParamsRef.current.underwater;
  const currentWaterLevel = waterStateRef.current.currentWaterLevel -7;
  
  // Always keep particles visible
  underwaterParticlesRef.current.visible = true;
  
  // Global fade logic 
  const targetGlobalOpacity = currentWaterLevel < 0.2 ? 
    underwaterParams.maxOpacity : 0.0;
  
  const currentMaterial = underwaterParticlesRef.current.material as THREE.PointsMaterial;
  const currentGlobalOpacity = currentMaterial.opacity;
  const fadeSpeed = 0.02;
  
  if (Math.abs(currentGlobalOpacity - targetGlobalOpacity) > 0.01) {
    const newOpacity = currentGlobalOpacity + (targetGlobalOpacity - currentGlobalOpacity) * fadeSpeed;
    currentMaterial.opacity = newOpacity;
  }
  
  // ✅ REMOVE any camera dimension calculations here
  // ✅ Simple particle animation with fixed boundaries:
  const positions = underwaterParticlesRef.current.geometry.attributes.position.array as Float32Array;
  const driftOffsets = underwaterParticlesRef.current.geometry.attributes.driftOffset.array as Float32Array;
  const particleCount = underwaterParams.particleCount;
  
  const driftAmount = underwaterParams.driftSpeed * time;
  
  for (let i = 0; i < particleCount; i++) {
    const i3 = i * 3;
    
    // ✅ Simple drift animation:
    positions[i3] += Math.sin(driftOffsets[i3] + driftAmount) * 0.01;     // x drift
    positions[i3 + 1] += Math.cos(driftOffsets[i3 + 1] + driftAmount) * 0.005; // y drift
    
    // ✅ Keep particles within your simple fixed bounds:
    const maxX = 100; // Half of your 200 spread
    const maxY = 75;  // Half of your 150 spread
    
    // Wrap particles that drift too far
    if (Math.abs(positions[i3]) > maxX) {
      positions[i3] = (Math.random() - 0.5) * 200; // Reset to random position in range
    }
    if (Math.abs(positions[i3 + 1]) > maxY) {
      positions[i3 + 1] = (Math.random() - 0.5) * 150; // Reset to random position in range
    }
    
    // Optional: Keep particles below water level
    if (positions[i3 + 1] > currentWaterLevel + 2) {
      positions[i3 + 1] = currentWaterLevel - Math.random() * 3;
    }
  }
  
  underwaterParticlesRef.current.geometry.attributes.position.needsUpdate = true;
}, []);

  // ✅ NEW: Update caustics function
  const updateCaustics = useCallback(() => {
    if (!causticsPlaneRef.current || causticsTexturesRef.current.length === 0) return;
    
    const plane = causticsPlaneRef.current;
    const material = plane.material as THREE.MeshBasicMaterial;
    const state = causticsStateRef.current;
    const params = waterParamsRef.current.caustics;
    
    // Update time
    state.time += 0.016; // Approximately 60fps delta
    state.frameCount++;
    
    // Show/hide caustics based on water level
    const shouldShow = waterStateRef.current.currentWaterLevel > -5;
    if (shouldShow !== state.isVisible) {
      plane.visible = shouldShow;
      state.isVisible = shouldShow;
    }
    
    if (!plane.visible) return;
    
    // Animate texture switching (every N frames for performance)
    if (state.frameCount % params.animationSpeed === 0) {
      state.currentTextureIndex = (state.currentTextureIndex + 1) % causticsTexturesRef.current.length;
      material.map = causticsTexturesRef.current[state.currentTextureIndex];
      material.needsUpdate = true;
    }
    
    // Animate texture offset for flowing effect
    if (material.map) {
      const speed = params.moveSpeed;
      material.map.offset.x = Math.cos(state.time * 0.5) * speed;
      material.map.offset.y = Math.sin(state.time * 0.3) * speed;
    }
    
    // Adjust opacity based on water depth
    const waterDepth = waterStateRef.current.currentWaterLevel;
    const maxDepth = waterParamsRef.current.maxWaterRise;
    const depthFactor = Math.min(waterDepth / maxDepth, 1.0);
    
    // Fade in caustics as water level rises
    material.opacity = params.opacity * depthFactor;
    
    // Optional: Move caustics plane with water level for better effect
    if (isArMode) {
      plane.position.y = waterStateRef.current.currentWaterLevel - 5; // Below water surface
    }
  }, [isArMode]);

 //************FOR SLIDER UPDATE */
    const updateYearDisplay = useCallback((sliderValue: number) => {
      if (yearDisplayRef.current) {
        const percentage = (sliderValue / waterParamsRef.current.maxWaterRise) * 100;
        const year = Math.floor(
          waterParamsRef.current.startYear + 
          (percentage / 100) * (waterParamsRef.current.endYear - waterParamsRef.current.startYear)
        );
        yearDisplayRef.current.textContent = `Year: ${year}`;
      }
    }, []);

    // ✅ NEW: Helper function to update slider visual without React state
    const updateSliderVisual = useCallback((sliderValue: number) => {
      if (sliderTrackRef.current && sliderThumbRef.current) {
    const percentage = (sliderValue / waterParamsRef.current.maxWaterRise) * 100.1;
    sliderTrackRef.current.style.width = `${percentage.toFixed(1)}%`;
    sliderThumbRef.current.style.left = `${percentage.toFixed(1)}%`;
      }
    }, []);
    
  // Effect 1: Override status polling
  useEffect(() => {
    const checkOverride = () => {
      const currentOverride = (window as any).arTestingOverride ?? true;
      if (currentOverride !== arTestingOverride) {
        setArTestingOverride(currentOverride);
        console.log('🌊 WaterRiseExperience override changed:', currentOverride);
        
        if (waterSystemRef.current && isArMode && arPosition) {
          if (currentOverride) {
            console.log('🎯 Setting water system override position (0, 0, -5)');
            waterSystemRef.current.position.set(0, 0, -5);
          } else {
            console.log('🎯 Setting water system anchor position:', arPosition);
            waterSystemRef.current.position.copy(arPosition);
          }
          
          // Force visual update
          waterSystemRef.current.visible = false;
          setTimeout(() => {
            if (waterSystemRef.current) {
              waterSystemRef.current.visible = true;
            }
          }, 50);
          
          console.log('🎯 Water system position after change:', waterSystemRef.current.position);
        }
      }
    };
    
    const interval = setInterval(checkOverride, 100);
    return () => clearInterval(interval);
  }, [arTestingOverride, isArMode, arPosition]);

  // Effect 2: AR position changes 
  useEffect(() => {
    if (waterSystemRef.current && isArMode && arPosition) {
      const currentOverride = (window as any).arTestingOverride ?? true;
      
      if (currentOverride) {
        waterSystemRef.current.position.set(0, 0, -5);
      } else {
        waterSystemRef.current.position.copy(arPosition);
      }
      
      console.log('🎯 Water position updated due to AR change:', waterSystemRef.current.position);
    }
  }, [isArMode, arPosition]);

  // Effect 3: Register gesture handlers 
  useEffect(() => {
    // Register rotation handler - operates on the water GROUP
    if (onModelRotate) {
      onModelRotate((deltaX: number, deltaY: number) => {
        if (waterSystemRef.current) {
          // Store current position to prevent drift
          const currentPosition = waterSystemRef.current.position.clone();

          // Apply rotation
          waterSystemRef.current.rotation.y += deltaX;
          waterSystemRef.current.rotation.x += deltaY;

          // Restore position to prevent drift
          waterSystemRef.current.position.copy(currentPosition);
        }
      });
    }

    // Register scale handler - scales the entire water system
    if (onModelScale) {
      onModelScale((scaleFactor: number) => {
        if (waterSystemRef.current) {
          const currentScale = waterSystemRef.current.scale.x;
          const newScale = Math.max(0.1, Math.min(10, currentScale * scaleFactor));
          console.log('🌊 Water scale handler called:', {
            scaleFactor,
            currentScale: currentScale.toFixed(3),
            newScale: newScale.toFixed(3)
          });
          waterSystemRef.current.scale.setScalar(newScale);
        }
      });
    }

    // Register reset handler - resets the entire water system
    if (onModelReset) {
      onModelReset(() => {
        console.log('🔄 Water RESET HANDLER CALLED');
        if (waterSystemRef.current) {
          // Reset rotation and scale
          waterSystemRef.current.rotation.set(0, 0, 0);
          const initialScale = initialScaleRef.current;
          waterSystemRef.current.scale.set(initialScale, initialScale, initialScale);
          
          // Reset position based on current mode
          if (isArMode && arPosition) {
            const currentOverride = (window as any).arTestingOverride ?? true;
            
            if (currentOverride) {
              waterSystemRef.current.position.set(0, 0, -5);
              console.log('🔄 Reset: Water positioned at override location (distant)');
            } else {
              waterSystemRef.current.position.copy(arPosition);
              console.log('🔄 Reset: Water positioned at AR anchor location');
            }
          } else {
            waterSystemRef.current.position.set(0, 0, -30);
            console.log('🔄 Reset: Water positioned at standalone location');
          }
          
          // Reset water level
          waterStateRef.current.currentWaterLevel = 0;
          waterStateRef.current.targetWaterLevel = 0;
          waterStateRef.current.sliderValue = 0;
          
          // ✅ NEW: Update UI through DOM manipulation
          updateYearDisplay(0);
          updateSliderVisual(0);
          if (sliderRef.current) {
            sliderRef.current.value = '0';
          }
          
          console.log('🔄 Water reset completed');
        }
      });
    }

    // Register swipe handlers
    if (onSwipeUp) {
      onSwipeUp(() => {
        console.log('👆 Swipe up detected on water - increase water level');
        const newSliderValue = Math.min(100, waterStateRef.current.sliderValue + 10);
        waterStateRef.current.sliderValue = newSliderValue;
        waterStateRef.current.targetWaterLevel = (newSliderValue / 100) * waterParamsRef.current.maxWaterRise;
        
        // ✅ NEW: Update UI through DOM manipulation
        updateYearDisplay(newSliderValue);
        updateSliderVisual(newSliderValue);
        if (sliderRef.current) {
          sliderRef.current.value = newSliderValue.toString();
        }

        // Optional: Increase caustics animation speed
        if (waterParamsRef.current.caustics.animationSpeed > 2) {
          waterParamsRef.current.caustics.animationSpeed -= 1;
        }
      });
    }

    if (onSwipeDown) {
      onSwipeDown(() => {
        console.log('👇 Swipe down detected on water - decrease water level');
        const newSliderValue = Math.max(0, waterStateRef.current.sliderValue - 10);
        waterStateRef.current.sliderValue = newSliderValue;
        waterStateRef.current.targetWaterLevel = (newSliderValue / 100) * waterParamsRef.current.maxWaterRise;
        
        // ✅ NEW: Update UI through DOM manipulation
        updateYearDisplay(newSliderValue);
        updateSliderVisual(newSliderValue);
        if (sliderRef.current) {
          sliderRef.current.value = newSliderValue.toString();
        }

        // Optional: Decrease caustics animation speed  
        if (waterParamsRef.current.caustics.animationSpeed < 10) {
          waterParamsRef.current.caustics.animationSpeed += 1;
        }
      });
    }
  }, [isArMode, arPosition, updateYearDisplay, updateSliderVisual]); // Dependencies for gesture handlers

  // Water particle animation function
  const updateWaterParticles = useCallback((time: number) => {
    if (!waterParticlesRef.current) return;

    const positions = waterParticlesRef.current.geometry.attributes.position.array as Float32Array;
    const gridResolution = waterParamsRef.current.gridResolution;
    
    // Move the entire water system up/down
    if (waterSystemRef.current) {
      waterSystemRef.current.position.y = waterStateRef.current.currentWaterLevel;
    }

    // Only update wave animation occasionally, not every frame
    // if (Math.floor(time * 10) % 2 === 0) { // Update waves every ~0.2 seconds
      for (let i = 0; i < gridResolution; i++) {
        for (let j = 0; j < gridResolution; j++) {
          const index = 3 * (i * gridResolution + j);
          const x = positions[index];
          const z = positions[index + 2];
          
          const y = Math.sin(x * 0.01 + time * waterParamsRef.current.waveSpeed * 1000) * waterParamsRef.current.waveAmplitude + 
                    Math.cos(z * 0.01 + time * waterParamsRef.current.waveSpeed * 1000) * waterParamsRef.current.waveAmplitude;
          positions[index + 1] = y;
        }
      }
      
      waterParticlesRef.current.geometry.attributes.position.needsUpdate = true;
    // }
    
    // Update water color based on depth
    if (waterParticlesRef.current.material instanceof THREE.PointsMaterial) {
      const depthFactor = waterStateRef.current.currentWaterLevel / waterParamsRef.current.maxWaterRise;
      const blueValue = 1 - depthFactor * 0.3;
      waterParticlesRef.current.material.color.setRGB(0, 0.05 * (1 - depthFactor), blueValue);
    }
  }, []);

  // Create water particle system (adapted from original but integrated)
  const createWaterParticleSystem = useCallback((scene: THREE.Scene) => {
    console.log('🌊 Creating water particle system...');
    
    // Create main group to hold water system
    const waterGroup = new THREE.Group();
    waterSystemRef.current = waterGroup;
    
    // Create particle geometry
    const gridResolution = waterParamsRef.current.gridResolution;
    const count = gridResolution * gridResolution;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const size = waterParamsRef.current.waterSize;
    
    let index = 0;
    for (let i = 0; i < gridResolution; i++) {
      for (let j = 0; j < gridResolution; j++) {
        // Evenly space out points across the grid
        const x = (i / (gridResolution - 1) - 0.5) * size * Math.random();
        const z = (j / (gridResolution - 1) - 0.5) * size * Math.random();
        positions[index++] = x;
        positions[index++] = 0; // initial y; will be updated to simulate waves
        positions[index++] = z;
      }
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    // Add rotation to make water lay on ground at slight angle
    waterSystemRef.current.rotation.x = degreesToRadians(15);
    waterSystemRef.current.rotation.z = degreesToRadians(0);
    
    // Load texture and create material
    const textureLoader = new THREE.TextureLoader();
    
    const createMaterial = (texture?: THREE.Texture) => {
      return new THREE.PointsMaterial({
        size: 0.3, // Smaller particles for AR
        map: texture,
        transparent: true,
        alphaTest: 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        color: waterParamsRef.current.particleColor
      });
    };
    
    // Try to load texture, but don't block particle creation
    textureLoader.load(
      getAssetPath('textures/circle2.png'),
      (texture) => {
        if (waterParticlesRef.current) {
          waterParticlesRef.current.material = createMaterial(texture);
          console.log('✅ Water texture loaded successfully');
        }
      },
      undefined,
      (error) => {
        console.warn('⚠️ Failed to load water texture, using fallback:', error);
        // Particles will still work without texture
      }
    );
    
    // Create particle system immediately
    const material = createMaterial();
    const particleSystem = new THREE.Points(geometry, material);
    waterParticlesRef.current = particleSystem;
    waterGroup.add(particleSystem);
    
    console.log('🌊 Water particle system created:', {
      particleCount: count,
      gridResolution,
      size: waterParamsRef.current.waterSize
    });

    // ✅ NEW: Create underwater particles
    createUnderwaterParticles();

    // ✅ NEW: Load and create caustics system
    loadCausticsTextures();

    // Create caustics plane after a short delay to ensure textures are loading
    setTimeout(() => {
      createCausticsPlane(scene);
    }, 100);
    
    // Position the entire group
    if (isArMode && arPosition) {
      const currentOverride = (window as any).arTestingOverride ?? true;
      if (currentOverride) {
        waterGroup.position.set(0, 0, -10); // Far distance for development
      } else {
        waterGroup.position.copy(arPosition); // At AR anchor
      }
    } else {
      waterGroup.position.set(0, 0, -30); // Standalone mode
    }
    
    // Set initial scale
    const scale = isArMode ? 0.1 : 1.0; // Much smaller for AR
    initialScaleRef.current = scale;
    waterGroup.scale.setScalar(scale);
    
    // Add to scene
    scene.add(waterGroup);
    
    setHasWaterSystem(true);
    onExperienceReady?.();
    
    console.log('✅ Water particle system created successfully');
    return waterGroup;
  }, [isArMode, arPosition, onExperienceReady, loadCausticsTextures, createCausticsPlane, createUnderwaterParticles]);

  // Main effect for scene setup 
  useEffect(() => {
    let isMounted = true;
    
    console.log('🌊 WaterRiseExperience mode:', isArMode ? 'AR' : 'Standalone');
    
    // Create container for standalone mode
    const container = document.createElement('div');
    container.id = 'threejs-container';
    container.style.position = 'fixed';
    container.style.top = '0';
    container.style.left = '0';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.zIndex = '1020';
    
if (!isArMode){
    document.body.appendChild(container);
    }

    // ✅ NEW: Create control panel using DOM manipulation 
    const controlPanel = document.createElement('div');
    controlPanel.style.position = 'absolute';
    controlPanel.style.bottom = '80px';
    controlPanel.style.left = '50%';
    controlPanel.style.transform = 'translateX(-50%)';
    controlPanel.style.width = '300px';
    controlPanel.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    controlPanel.style.color = 'white';
    controlPanel.style.padding = '15px';
    controlPanel.style.borderRadius = '8px';
    controlPanel.style.textAlign = 'center';
    controlPanel.style.fontFamily = 'var(--font-rigby)';
    controlPanel.style.fontWeight = '400';
    controlPanel.style.zIndex = '1030';
    controlPanel.style.pointerEvents = 'auto';
    document.body.appendChild(controlPanel);

    // ✅ NEW: Create year display using DOM
    const yearDisplay = document.createElement('div');
    yearDisplay.textContent = 'Year: 2030';
    yearDisplay.style.marginBottom = '10px';
    yearDisplay.style.fontSize = '18px';
    yearDisplay.style.fontWeight = '600';
    controlPanel.appendChild(yearDisplay);
    yearDisplayRef.current = yearDisplay;

    // ✅ NEW: Create custom slider using DOM (following your original pattern)
    const sliderContainer = document.createElement('div');
    sliderContainer.style.position = 'relative';
    sliderContainer.style.height = '4px';
    sliderContainer.style.width = '100%';
    sliderContainer.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
    sliderContainer.style.borderRadius = '2px';
    sliderContainer.style.margin = '16px 0';
    
    const sliderTrack = document.createElement('div');
    sliderTrack.style.position = 'absolute';
    sliderTrack.style.height = '100%';
    sliderTrack.style.width = '0%';
    sliderTrack.style.backgroundColor = '#0066cc';
    sliderTrack.style.borderRadius = '2px';
    sliderTrack.style.transition = 'width 0.1s';
    sliderContainer.appendChild(sliderTrack);
    sliderTrackRef.current = sliderTrack;
    
    const sliderThumb = document.createElement('div');
    sliderThumb.style.position = 'absolute';
    sliderThumb.style.top = '50%';
    sliderThumb.style.transform = 'translate(-50%, -50%)';
    sliderThumb.style.width = '16px';
    sliderThumb.style.height = '16px';
    sliderThumb.style.backgroundColor = '#0066cc';
    sliderThumb.style.borderRadius = '50%';
    sliderThumb.style.boxShadow = '0 1px 3px rgba(0,0,0,0.3)';
    sliderThumb.style.cursor = 'pointer';
    sliderThumb.style.left = '0%';
    sliderContainer.appendChild(sliderThumb);
    sliderThumbRef.current = sliderThumb;
    
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = waterParamsRef.current.maxWaterRise.toString();;
    slider.step = '0.01';
    slider.value = '0';
    slider.style.width = '100%';
    slider.style.position = 'absolute';
    slider.style.top = '0';
    slider.style.left = '0';
    slider.style.margin = '0';
    slider.style.opacity = '0';
    slider.style.height = '100%';
    slider.style.cursor = 'pointer';
    sliderContainer.appendChild(slider);
    sliderRef.current = slider;
    
    controlPanel.appendChild(sliderContainer);

    // Create slider labels
    const sliderLabels = document.createElement('div');
    sliderLabels.style.display = 'flex';
    sliderLabels.style.justifyContent = 'space-between';
    sliderLabels.style.fontSize = '12px';
    sliderLabels.innerHTML = '<span>2030</span><span>2100</span>';
    controlPanel.appendChild(sliderLabels);

    // ✅ NEW: Setup slider event listener WITHOUT React state
    slider.addEventListener('input', function(event: Event) {
      const target = event.target as HTMLInputElement;
      const sliderValue = parseFloat(target.value)
      
      // Update visual slider through DOM manipulation
      updateSliderVisual(sliderValue);
      
      // Update water state through refs (no re-render)
      waterStateRef.current.sliderValue = sliderValue;
      waterStateRef.current.targetWaterLevel = sliderValue
      
      // Update year display through DOM manipulation
      updateYearDisplay(sliderValue);
      
      // console.log('🌊 Slider changed:', { sliderValue, targetLevel: waterStateRef.current.targetWaterLevel });
    });

    // Instructions
    const instructions = document.createElement('div');
    instructions.style.marginTop = '15px';
    instructions.style.fontSize = '14px';
    instructions.style.opacity = '0.8';
    instructions.innerHTML = 'Experience rising water levels from 2030-2100. Use the slider or gestures to control time.';
    controlPanel.appendChild(instructions);

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
      console.log('🌊 WaterRiseExperience using AR scene and camera');
    } else {
      // Standalone Mode: Create own scene/camera/renderer
      scene = new THREE.Scene();
      scene.background = new THREE.Color(0x87ceeb); // Sky blue background
      scene.fog = new THREE.FogExp2(0x87ceeb, 0.002); // Atmospheric fog
      sceneRef.current = scene;
      
      camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
      camera.position.copy(initialCameraPos.current);
      camera.lookAt(0, 10, 0);
      cameraRef.current = camera;
      
      renderer = new THREE.WebGLRenderer({ 
        antialias: true, 
        alpha: isArMode,
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
      controls.target.set(0, 0, 0);
      controlsRef.current = controls;
      
      // Add lighting only in standalone mode
      const ambientLight = new THREE.AmbientLight(0x606060);
      scene.add(ambientLight);

      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
      directionalLight.position.set(50, 200, 100);
      scene.add(directionalLight);

      // // Add ground plane in standalone mode
      // const groundGeometry = new THREE.PlaneGeometry(1000, 1000);
      // const groundMaterial = new THREE.MeshLambertMaterial({ 
      //   color: 0x654321, // Brown earth
      //   side: THREE.DoubleSide 
      // });
      // const ground = new THREE.Mesh(groundGeometry, groundMaterial);
      // ground.rotation.x = Math.PI / 2;
      // ground.position.y = -5;
      // scene.add(ground);
    }

    // Create water particle system
    createWaterParticleSystem(scene);

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
      waterStateRef.current.time += deltaTime;
      
      // Smoothly interpolate water level
      waterStateRef.current.currentWaterLevel += (waterStateRef.current.targetWaterLevel - waterStateRef.current.currentWaterLevel) * 0.02;
      
      // Update water particles
      updateWaterParticles(waterStateRef.current.time);
      
      // ✅ NEW: Update underwater particles
      updateUnderwaterParticles(waterStateRef.current.time);
      
      // ✅ NEW: Update caustics animation
      updateCaustics();
      
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
      
      // ✅ NEW: Clean up caustics system
      if (causticsPlaneRef.current) {
        if (causticsPlaneRef.current.material instanceof THREE.MeshBasicMaterial) {
          if (causticsPlaneRef.current.material.map) {
            causticsPlaneRef.current.material.map.dispose();
          }
          causticsPlaneRef.current.material.dispose();
        }
        if (causticsPlaneRef.current.geometry) {
          causticsPlaneRef.current.geometry.dispose();
        }
      }

      // Dispose caustics textures
      causticsTexturesRef.current.forEach(texture => {
        if (texture) texture.dispose();
      });
      causticsTexturesRef.current = [];
      causticsPlaneRef.current = null;
      
      // Clean up water system first
      if (waterSystemRef.current) {
        // Remove from scene
        if (sceneRef.current) {
          sceneRef.current.remove(waterSystemRef.current);
        }
        
        // Clean up each child in the group
        waterSystemRef.current.children.forEach(child => {
          if (child instanceof THREE.Points) {
            // Dispose geometry attributes
            if (child.geometry) {
              const geometry = child.geometry;
              geometry.dispose();
            }
            
            // Dispose material
            if (child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach(material => {
                  if ('map' in material && (material as any).map) (material as any).map.dispose();
                  material.dispose();
                });
              } else {
                if ('map' in child.material && (child.material as any).map) (child.material as any).map.dispose();
                child.material.dispose();
              }
            }
          }
        });
        
        // Clear the group
        waterSystemRef.current.clear();
        waterSystemRef.current = null;
      }
      
      // ✅ NEW: Clean up underwater particles
      if (underwaterParticlesRef.current) {
        if (underwaterParticlesRef.current.geometry) {
          const geometry = underwaterParticlesRef.current.geometry;
          geometry.dispose();
        }
        
        if (underwaterParticlesRef.current.material) {
          if (Array.isArray(underwaterParticlesRef.current.material)) {
            underwaterParticlesRef.current.material.forEach(material => {
              if ('map' in material && (material as any).map) (material as any).map.dispose();
              material.dispose();
            });
          } else {
            if ('map' in underwaterParticlesRef.current.material && (underwaterParticlesRef.current.material as any).map) {
              (underwaterParticlesRef.current.material as any).map.dispose();
            }
            underwaterParticlesRef.current.material.dispose();
          }
        }
      }
      underwaterParticlesRef.current = null;
      
      // Clean up particle system ref
      waterParticlesRef.current = null;
      
      // Clean up controls
      if (controls) {
        controls.dispose();
      }
      
      // Clean up renderer
      if (renderer) {
        renderer.forceContextLoss();
        renderer.dispose();
      }
      
      // ✅ NEW: Clear DOM refs
      yearDisplayRef.current = null;
      sliderRef.current = null;
      sliderTrackRef.current = null;
      sliderThumbRef.current = null;
      
      // Remove container
      if (document.body.contains(container)) {
        document.body.removeChild(container);
      }
      if (document.body.contains(controlPanel)) {
        document.body.removeChild(controlPanel);
      }
      
      // Clear refs
      sceneRef.current = null;
      cameraRef.current = null;
      controlsRef.current = null;
    };
  }, [isArMode, createWaterParticleSystem, updateWaterParticles, updateUnderwaterParticles, updateYearDisplay, updateSliderVisual, updateCaustics]);

  return (
    <>
      {/* Loading indicator */}
      {!hasWaterSystem && sceneRef.current && (
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
            border: '3px solid rgba(0, 100, 200, 0.3)',
            borderTop: '3px solid #0066cc',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            marginBottom: '20px'
          }} />
      
          {/* Loading text */}
          <h2 style={{
            margin: '0 0 10px 0',
            fontSize: '24px',
            fontWeight: '400',
            color: '#0099cc'
          }}>
            🌊 Preparing Water Rise Experience
          </h2>
          
          <p style={{
            margin: '0',
            fontSize: '16px',
            opacity: 0.8,
            textAlign: 'center',
            maxWidth: '300px'
          }}>
            Loading water simulation for years 2030-2100
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
                backgroundColor: '#0066cc',
                transition: 'width 0.3s ease',
                borderRadius: '2px'
              }} />
            </div>
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

      {/* Debug Panel for Water Experience */}
      {SHOW_DEBUG_PANEL && (
        <div style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          color: 'white',
          padding: '10px',
          borderRadius: '4px',
          fontSize: '12px',
          zIndex: 1020,
          pointerEvents: 'auto',
          fontFamily: 'monospace'
        }}>
          <div style={{ color: 'cyan' }}>🌊 WATER SYSTEM DEBUG</div>
          <div>Mode: {isArMode ? 'AR Portal' : 'Standalone'}</div>
          {arPosition && (
            <div>AR Anchor: [{arPosition.x.toFixed(3)}, {arPosition.y.toFixed(3)}, {arPosition.z.toFixed(3)}]</div>
          )}
          {waterSystemRef.current && (
            <div style={{ color: 'lightblue' }}>
              Water Pos: [{waterSystemRef.current.position.x.toFixed(3)}, {waterSystemRef.current.position.y.toFixed(3)}, {waterSystemRef.current.position.z.toFixed(3)}]
            </div>
          )}
          <div>Scale: {coordinateScale}x</div>
          <div style={{ color: hasWaterSystem ? 'lightgreen' : 'orange' }}>
            System: {hasWaterSystem ? '✅ Active' : '❌ Loading'}
          </div>
          <div style={{ color: 'lightblue', fontSize: '10px' }}>
            Current Level: {waterStateRef.current.currentWaterLevel.toFixed(1)}/{waterParamsRef.current.maxWaterRise}
          </div>
          <div style={{ color: 'lightblue', fontSize: '10px' }}>
            Slider: {waterStateRef.current.sliderValue}%
          </div>
          <div style={{ color: 'lightblue', fontSize: '10px' }}>
            Surface Particles: {waterParamsRef.current.particleCount}
          </div>
          <div style={{ color: 'lightblue', fontSize: '10px' }}>
            Underwater Particles: {waterParamsRef.current.underwater.particleCount}
          </div>
          <div style={{ color: 'lightblue', fontSize: '10px' }}>
            Caustics: {causticsTexturesRef.current.length}/5 loaded, Frame: {causticsStateRef.current.currentTextureIndex}
          </div>
          <div style={{ color: 'lightgreen', fontSize: '10px' }}>
            Caustics visible: {causticsStateRef.current.isVisible ? '✅' : '❌'}
          </div>
          <div style={{ color: 'lightgreen', fontSize: '10px' }}>
            Underwater visible: {underwaterParticlesRef.current?.visible ? '✅' : '❌'}
          </div>
          <div style={{ color: 'lightgreen', fontSize: '10px' }}>
            Multi-layer water system with caustics + underwater volume
          </div>
          
          <div 
            onClick={() => {
              const newValue = !arTestingOverride;
              (window as any).arTestingOverride = newValue;
              setArTestingOverride(newValue);
              console.log('🎯 AR Override toggled:', newValue ? 'ON' : 'OFF');
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
            Override: {arTestingOverride ? '✅ (0,0,-5)' : '❌ (AR Anchor)'}
          </div>
        </div>
      )}
    </>
  );
};

export default WaterRiseExperience;