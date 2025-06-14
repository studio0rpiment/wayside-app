//******* THIS WAS AN ATTEMPT TO USE MODULARIZE THE WATEREFFECT, BUT IT WAS TOO COMPLICATED FOR NEEDS. IT DIDNT REALLY WORK AS IS. WOULD NEED MANY MORE HOURS OF WORK. COOL IDEA OF COURSE */



import React, { useEffect, useState, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import WaterParticleEngine from '../engines/WaterParticleEngine';
import ElasticSlider from '../common/ElasticSlider';

const SHOW_DEBUG_PANEL = true;

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
  console.log('🌊 WaterRiseExperience: Creating experience with WaterParticleEngine');

  // Store initial camera position for reset
  const initialCameraPos = useRef(new THREE.Vector3(0, 30, 100));
  
  // State to track override status
  const [arTestingOverride, setArTestingOverride] = useState(() => {  
    return (window as any).arTestingOverride ?? true;
  });

  // State for UI updates
  const [waterEngineReady, setWaterEngineReady] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [sliderValue, setSliderValue] = useState(0);
  
  // Define isArMode at the component level
  const isArMode = !!(arScene && arCamera && arPosition);
  
  // Refs for Three.js objects (simplified - engine handles water system)
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  
  // Stable position and scale values that don't cause re-renders
  const [stablePosition, setStablePosition] = useState(new THREE.Vector3(0, 0, -10));
  const [stableScale, setStableScale] = useState(isArMode ? 0.1 : 1.0);

  // Known anchor GPS for pond detection (from your mapRouteData)
  const anchorGPS: [number, number] = [-76.942076, 38.912485];

  // Handle slider changes - MEMOIZED to prevent re-renders
  const handleSliderChange = useCallback((value: number) => {
    console.log('🎛️ Slider changed to:', value);
    setSliderValue(value);
  }, []); // Empty deps - this function never changes

  // Format slider value to year
  const formatSliderValue = useCallback((value: number) => {
    const percentage = value / 100;
    const year = Math.floor(2030 + percentage * (2100 - 2030));
    return `Year: ${year}`;
  }, []);

  // Water engine callbacks - MEMOIZED to prevent re-renders
  const handleWaterEngineReady = useCallback(() => {
    console.log('✅ Water particle engine ready');
    setWaterEngineReady(true);
    onExperienceReady?.();
  }, [onExperienceReady]);

  const handleWaterEngineProgress = useCallback((progress: number) => {
    setLoadingProgress(progress);
  }, []);

  const handleWaterEngineError = useCallback((error: string) => {
    console.error('❌ Water engine error:', error);
    setLoadingProgress(0);
  }, []);

  // Calculate water engine position based on AR mode and override
  const getWaterEnginePosition = useCallback(() => {
    if (isArMode && arPosition) {
      const currentOverride = (window as any).arTestingOverride ?? true;
      return currentOverride ? new THREE.Vector3(0, 0, -10) : arPosition.clone();
    } else {
      return new THREE.Vector3(0, 0, -30);
    }
  }, [isArMode, arPosition]);

  // Update stable position when needed
  const updatePosition = useCallback(() => {
    const newPosition = getWaterEnginePosition();
    setStablePosition(newPosition);
  }, [getWaterEnginePosition]);

  // Update stable scale when needed  
  const updateScale = useCallback((newScale: number) => {
    setStableScale(newScale);
  }, []);

  // Effect 1: Override status polling (following LilyExperience pattern)
  useEffect(() => {
    const checkOverride = () => {
      const currentOverride = (window as any).arTestingOverride ?? true;
      if (currentOverride !== arTestingOverride) {
        setArTestingOverride(currentOverride);
        console.log('🌊 WaterRiseExperience override changed:', currentOverride);
        
        // Update position using the update function
        updatePosition();
        
        console.log('🎯 Water engine position updated');
      }
    };
    
    const interval = setInterval(checkOverride, 100);
    return () => clearInterval(interval);
  }, [arTestingOverride, updatePosition]);

  // Effect 2: Update water engine position when AR position changes
  useEffect(() => {
    updatePosition();
  }, [updatePosition]);

  // Effect 3: Register gesture handlers
  useEffect(() => {
    // Register rotation handler - will need to be implemented in the engine
    if (onModelRotate) {
      onModelRotate((deltaX: number, deltaY: number) => {
        console.log('🔄 Water rotation gesture:', { deltaX, deltaY });
        // TODO: Implement rotation in WaterParticleEngine
      });
    }

    // Register scale handler
    if (onModelScale) {
      onModelScale((scaleFactor: number) => {
        const currentScale = stableScale;
        const newScale = Math.max(0.1, Math.min(10, currentScale * scaleFactor));
        console.log('🌊 Water scale handler called:', {
          scaleFactor,
          currentScale: currentScale.toFixed(3),
          newScale: newScale.toFixed(3)
        });
        updateScale(newScale);
      });
    }

    // Register reset handler
    if (onModelReset) {
      onModelReset(() => {
        console.log('🔄 Water RESET HANDLER CALLED');
        
        // Reset position and scale
        updatePosition();
        updateScale(isArMode ? 0.1 : 1.0);
        
        // Reset slider
        setSliderValue(0);
        
        console.log('🔄 Water reset completed');
      });
    }

    // Register swipe handlers
    if (onSwipeUp) {
      onSwipeUp(() => {
        console.log('👆 Swipe up detected - increase flood level');
        const newSliderValue = Math.min(100, sliderValue + 10);
        setSliderValue(newSliderValue);
      });
    }

    if (onSwipeDown) {
      onSwipeDown(() => {
        console.log('👇 Swipe down detected - decrease flood level');
        const newSliderValue = Math.max(0, sliderValue - 10);
        setSliderValue(newSliderValue);
      });
    }
  }, [isArMode, sliderValue, updatePosition, updateScale, onModelRotate, onModelScale, onModelReset, onSwipeUp, onSwipeDown]);

  // Main effect for scene setup - simplified since engine handles water system
  useEffect(() => {
    let isMounted = true;
    
    // Prevent double initialization
    if (waterEngineReady) {
      console.log('🌊 Water engine already ready, skipping scene setup...');
      return;
    }
    
    console.log('🌊 WaterRiseExperience mode:', isArMode ? 'AR' : 'Standalone');
    
    // Initialize Three.js components
    let scene: THREE.Scene;
    let camera: THREE.PerspectiveCamera;
    let renderer: THREE.WebGLRenderer | null = null;
    let controls: OrbitControls | null = null;

    if (isArMode) {
      scene = arScene!;
      camera = arCamera!;
      sceneRef.current = scene;
      cameraRef.current = camera;
      console.log('🌊 WaterRiseExperience using AR scene and camera');
    } else {
      // Create container for standalone mode only
      const container = document.createElement('div');
      container.id = 'threejs-container';
      container.style.position = 'fixed';
      container.style.top = '0';
      container.style.left = '0';
      container.style.width = '100%';
      container.style.height = '100%';
      container.style.zIndex = '1020';
      document.body.appendChild(container);

      scene = new THREE.Scene();
      scene.background = new THREE.Color(0x87ceeb);
      scene.fog = new THREE.FogExp2(0x87ceeb, 0.002);
      sceneRef.current = scene;
      
      camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
      camera.position.copy(initialCameraPos.current);
      camera.lookAt(0, 10, 0);
      cameraRef.current = camera;
      
      renderer = new THREE.WebGLRenderer({ 
        antialias: true, 
        alpha: false,
        premultipliedAlpha: false
      });
      
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setClearColor(0x87ceeb, 1);
      container.appendChild(renderer.domElement);

      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.25;
      controls.screenSpacePanning = false;
      controls.minDistance = 5;
      controls.maxDistance = 200;
      controls.maxPolarAngle = Math.PI / 1.5;
      controls.target.set(0, 0, 0);
      controlsRef.current = controls;
      
      const ambientLight = new THREE.AmbientLight(0x606060);
      scene.add(ambientLight);

      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
      directionalLight.position.set(50, 200, 100);
      scene.add(directionalLight);
    }

    // Handle window resize for standalone mode
    const handleResize = () => {
      if (isMounted && camera && renderer) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      }
    };
    
    if (!isArMode) {
      window.addEventListener('resize', handleResize);
    }
    
    // Animation loop (simplified since engine handles water particles)
    const animate = function () {
      if (!isMounted) return;
      
      requestAnimationFrame(animate);
      
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
      
      if (!isArMode) {
        window.removeEventListener('resize', handleResize);
      }
      
      if (controls) {
        controls.dispose();
      }
      
      if (renderer) {
        renderer.forceContextLoss();
        renderer.dispose();
      }
      
      // Remove container for standalone mode
      if (!isArMode) {
        const container = document.getElementById('threejs-container');
        if (container && document.body.contains(container)) {
          document.body.removeChild(container);
        }
      }
      
      // Clear refs
      sceneRef.current = null;
      cameraRef.current = null;
      controlsRef.current = null;
    };
  }, [isArMode, waterEngineReady]);

  return (
    <>
      {/* Water Particle Engine - Use debug version */}
      {sceneRef.current && (
        <WaterParticleEngine
          key="water-engine-singleton" // Stable key to prevent re-mounting
          scene={sceneRef.current}
          enabled={true}
          floodLevel={sliderValue}
          position={stablePosition}
          scale={stableScale}
          isArMode={isArMode}
          gridResolution={isArMode ? 60 : 100}
          waterSize={isArMode ? 40 : 80}
          anchorGPS={anchorGPS}
          onReady={handleWaterEngineReady}
          onProgress={handleWaterEngineProgress}
          onError={handleWaterEngineError}
        />
      )}

      {/* Loading indicator */}
      {!waterEngineReady && (
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
            🌊 Preparing Climate Flood Experience
          </h2>
          
          <p style={{
            margin: '0',
            fontSize: '16px',
            opacity: 0.8,
            textAlign: 'center',
            maxWidth: '300px'
          }}>
            {loadingProgress < 30 ? 'Loading terrain data...' :
             loadingProgress < 50 ? 'Detecting pond shapes...' :
             loadingProgress < 80 ? 'Analyzing flood patterns...' :
             'Creating water simulation...'}
          </p>
          
          {/* Progress bar */}
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

      {/* Climate Flood Control Panel */}
      {waterEngineReady && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '320px',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(10px)',
          borderRadius: '16px',
          padding: '20px',
          zIndex: 9999,
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
        }}>
          <ElasticSlider
            min={0}
            max={100}
            value={sliderValue}
            step={1}
            onChange={handleSliderChange}
            formatValue={formatSliderValue}
            leftLabel="2030"
            rightLabel="2100"
          />
          
          <div style={{
            marginTop: '15px',
            fontSize: '14px',
            color: 'rgba(255, 255, 255, 0.8)',
            textAlign: 'center',
            lineHeight: '1.4'
          }}>
            Experience climate-driven flooding from 2030-2100.<br/>
            Use slider or gestures to control time.
          </div>
        </div>
      )}

      {/* Debug Panel */}
      {SHOW_DEBUG_PANEL && (
        <div style={{
          position: 'fixed',
          top: '10px',
          left: '10px',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          color: 'white',
          padding: '10px',
          borderRadius: '4px',
          fontSize: '12px',
          zIndex: 1020,
          pointerEvents: 'auto',
          fontFamily: 'monospace',
          maxWidth: '300px'
        }}>
          <div style={{ color: 'cyan', marginBottom: '5px' }}>🌊 WATER DEBUG</div>
          <div>Mode: {isArMode ? 'AR' : 'Standalone'}</div>
          <div>Engine: {waterEngineReady ? '✅ Ready' : '❌ Loading'}</div>
          <div>Slider: {sliderValue}% (Year: {Math.floor(2030 + (sliderValue / 100) * (2100 - 2030))})</div>
          <div>Position: ({stablePosition.x.toFixed(1)}, {stablePosition.y.toFixed(1)}, {stablePosition.z.toFixed(1)})</div>
          <div>Scale: {stableScale.toFixed(2)}</div>
          
          <div 
            onClick={() => {
              const newValue = !arTestingOverride;
              (window as any).arTestingOverride = newValue;
              setArTestingOverride(newValue);
              console.log('🎯 AR Override toggled:', newValue ? 'ON' : 'OFF');
              
              // Immediately update water engine position
              updatePosition();
              console.log('🎯 Water engine position updated');
            }}
            style={{ 
              cursor: 'pointer', 
              userSelect: 'none', 
              marginTop: '5px',
              padding: '2px 4px',
              backgroundColor: arTestingOverride ? 'rgba(0, 255, 0, 0.2)' : 'rgba(255, 0, 0, 0.2)',
              borderRadius: '2px',
              fontSize: '10px'
            }}
          >
            Override: {arTestingOverride ? '✅ (0,0,-10)' : '❌ (AR Anchor)'}
          </div>
        </div>
      )}
    </>
  );
};

export default WaterRiseExperience;