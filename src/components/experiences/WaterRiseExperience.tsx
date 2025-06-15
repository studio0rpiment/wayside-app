import React, { useEffect, useState, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { getAssetPath } from '../../utils/assetPaths';
import ElasticSlider from '../common/ElasticSlider';

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

//********REFS REFS REFS */
  // Refs for Three.js objects ()
  const waterSystemRef = useRef<THREE.Group | null>(null);
  const waterParticlesRef = useRef<THREE.Points | null>(null);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const clockRef = useRef(new THREE.Clock());

  const initialCameraPos = useRef(new THREE.Vector3(0, 30, 100));
  const initialScaleRef = useRef<number>(1);

  // ✅ UPDATED: Refs for debouncing
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
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
    floodExpansionFactor: 3.0,  
    particleBaseSize: 0.3,        // ADD THIS
    particleSizeMultiplier: 2.0
  });

//***** STATE STATE STATE */
  const [arTestingOverride, setArTestingOverride] = useState(() => {  
    return (window as any).arTestingOverride ?? true;
  });

  // ✅ NEW: State for ElasticSlider (minimal state for UI only)
  const [sliderValue, setSliderValue] = useState(0);
  const [currentYear, setCurrentYear] = useState(2030);

  // State for UI updates only (minimal)
  const [hasWaterSystem, setHasWaterSystem] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);

  //******* CONST, UTILITIES */
  // Helper math
  const degreesToRadians = (degrees: number) => degrees * (Math.PI / 180);
  //flodd estimation

const progress = waterStateRef.current.currentWaterLevel / waterParamsRef.current.maxWaterRise;
const curvedProgress = Math.pow(progress, 1.5); // Slight acceleration
const floodScale = 1 + curvedProgress * waterParamsRef.current.floodExpansionFactor;

  // Define isArMode at the component level
  const isArMode = !!(arScene && arCamera && arPosition);

  const scale = 0.1;
  initialScaleRef.current = scale; 
  const initialScale = initialScaleRef.current;

  //************ SLIDER UTILITIES */
  
  // ✅ NEW: Debounced water level update function
  const debouncedUpdateWaterLevel = useCallback((newSliderValue: number) => {
    // Clear existing timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Set new timeout for smooth animation updates
    debounceTimeoutRef.current = setTimeout(() => {
      // Update water state through refs (no re-render)
      waterStateRef.current.sliderValue = newSliderValue;
      waterStateRef.current.targetWaterLevel = newSliderValue;
      
      console.log('🌊 Debounced water level update:', {
        sliderValue: newSliderValue,
        targetLevel: waterStateRef.current.targetWaterLevel
      });
    }, 16); // 16ms = ~60fps for smooth animation
  }, []);

  // ✅ NEW: Calculate year from slider value
  const calculateYear = useCallback((value: number): number => {
    const percentage = (value / waterParamsRef.current.maxWaterRise) * 100;
    return Math.floor(
      waterParamsRef.current.startYear + 
      (percentage / 100) * (waterParamsRef.current.endYear - waterParamsRef.current.startYear)
    );
  }, []);

  // ✅ NEW: Immediate slider change handler (for visual feedback)
  const handleSliderChange = useCallback((newValue: number) => {
    // Immediate UI updates (React state for visual feedback)
    setSliderValue(newValue);
    setCurrentYear(calculateYear(newValue));
    
    // Debounced animation updates (refs for performance)
    debouncedUpdateWaterLevel(newValue);
  }, [calculateYear, debouncedUpdateWaterLevel]);

  // ✅ NEW: Format value for slider display
  const formatSliderValue = useCallback((value: number): string => {
    const year = calculateYear(value);
    return `${year}`;
  }, [calculateYear]);

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
      onModelRotate((deltaX: number, deltaY: number, deltaZ: number = 0) => {
        if (waterSystemRef.current) {
          // Store current position to prevent drift
          const currentPosition = waterSystemRef.current.position.clone();

          // Apply rotation
          waterSystemRef.current.rotation.y += deltaX;
          waterSystemRef.current.rotation.x += deltaY;
           if (deltaZ !== 0) {
            waterSystemRef.current.rotation.z += deltaZ;
          }

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
          waterSystemRef.current.rotation.set(degreesToRadians(25), 0, 0);
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
          
          // Reset water level (both refs and React state)
          waterStateRef.current.currentWaterLevel = 0;
          waterStateRef.current.targetWaterLevel = 0;
          waterStateRef.current.sliderValue = 0;
          
          // ✅ UPDATED: Reset React state for UI
          setSliderValue(0);
          setCurrentYear(waterParamsRef.current.startYear);
          
          console.log('🔄 Water reset completed');
        }
      });
    }

    // Register swipe handlers
    if (onSwipeUp) {
      onSwipeUp(() => {
        // console.log('👆 Swipe up detected on water - increase water level');
        // const newSliderValue = Math.min(waterParamsRef.current.maxWaterRise, sliderValue + 0.2);
        // handleSliderChange(newSliderValue);
      });
    }

    if (onSwipeDown) {
      onSwipeDown(() => {
        // console.log('👇 Swipe down detected on water - decrease water level');
        // const newSliderValue = Math.max(0, sliderValue - 0.2);
        // handleSliderChange(newSliderValue);
      });
    }
  }, [isArMode, arPosition, onModelRotate, onModelScale, onModelReset, onSwipeUp, onSwipeDown, sliderValue, handleSliderChange]);

  // Water particle animation function
  const updateWaterParticles = useCallback((time: number) => {
    if (!waterParticlesRef.current) return;

    const positions = waterParticlesRef.current.geometry.attributes.position.array as Float32Array;
    const gridResolution = waterParamsRef.current.gridResolution;
    
    // Move the entire water system up/down
    if (waterSystemRef.current) {
    const progress = waterStateRef.current.currentWaterLevel / waterParamsRef.current.maxWaterRise;
    const curvedProgress = Math.pow(progress, 1.5); // Matches research acceleration
    const floodScale = 1 + curvedProgress * waterParamsRef.current.floodExpansionFactor;
    waterSystemRef.current.scale.setScalar(initialScaleRef.current * floodScale);

    if (waterParticlesRef.current?.material instanceof THREE.PointsMaterial) {
    const newSize = waterParamsRef.current.particleBaseSize * 
    (1 + curvedProgress * waterParamsRef.current.particleSizeMultiplier);
    waterParticlesRef.current.material.size = newSize;
  }

  }

    // Wave animation
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
    waterSystemRef.current.rotation.x = degreesToRadians(25);
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
    
    // Position the entire group
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
      waterGroup.position.set(0, 0, -30); // Standalone mode
    }
    
    waterGroup.scale.setScalar(initialScaleRef.current);
    
    // Add to scene
    scene.add(waterGroup);
    
    setHasWaterSystem(true);
    onExperienceReady?.();
    
    console.log('✅ Water particle system created successfully');
    return waterGroup;
  }, [isArMode, arPosition, onExperienceReady]);

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
    
    if (!isArMode) {
      document.body.appendChild(container);
    }

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
      
      // ✅ UPDATED: Clear debounce timeout
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      
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
      
      // Remove container
      if (document.body.contains(container)) {
        document.body.removeChild(container);
      }
      
      // Clear refs
      sceneRef.current = null;
      cameraRef.current = null;
      controlsRef.current = null;
    };
  }, [isArMode, createWaterParticleSystem, updateWaterParticles]);

  return (
    <>
      {/* ✅ NEW: ElasticSlider Control Panel */}
      {hasWaterSystem && (
        <div style={{
          position: 'fixed',
          bottom: '0.5svh',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '95vw',
          backgroundColor: 'rgba(0, 0, 0, 0)',
          color: '',
          padding: '0px',
          borderRadius: '2rem',
          fontFamily: 'var(--font-rigby)',
          fontWeight: '400',
          zIndex: 1030,
          pointerEvents: 'auto',
          // backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0)',
          // boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
        }}>
          {/* ElasticSlider */}
          <ElasticSlider
            min={0}
            max={waterParamsRef.current.maxWaterRise}
            value={sliderValue}
            step={0.001}
            onChange={handleSliderChange}
            leftLabel="2030"
            rightLabel="2150"
            labelPosition="top"
            labelColor="var(--color-light)"
            labelFontWeight="bold"     // or 400, "normal", "bold"
            valueFontWeight="700" 
            trackFillColor="var(--color-dark)"
            trackBorderRadius={10}
            labelGap={12}
            trackHeight={15}     
            labelFontSize={20}     
            showValueDisplay={false} // this is the literal slider value not 
            className="water-rise-slider"
          />
        </div>
      )}

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
            🌊 Preparing Experience
          </h2>
          
          <p style={{
            margin: '0',
            fontSize: '16px',
            opacity: 0.8,
            textAlign: 'center',
            maxWidth: '300px'
          }}>
            ... Loading ...
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
            Slider: {sliderValue.toFixed(2)} | Year: {currentYear}
          </div>
          <div style={{ color: 'lightblue', fontSize: '10px' }}>
            Target Level: {waterStateRef.current.targetWaterLevel.toFixed(2)}
          </div>
          <div style={{ color: 'lightblue', fontSize: '10px' }}>
            Surface Particles: {waterParamsRef.current.particleCount}
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