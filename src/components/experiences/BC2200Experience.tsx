import React, { useEffect, useState, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import AnimatedPointCloudEngine from '../common/AnimatedPointCloudEngine';


const SHOW_DEBUG_PANEL = true;

interface BC2200ExperienceProps {
  onClose: () => void;
  arPosition?: THREE.Vector3;
  arScene?: THREE.Scene;
  arCamera?: THREE.PerspectiveCamera;
  coordinateScale?: number;
  userPosition?: [number, number];
  onModelRotate?: (handler: (deltaX: number, deltaY: number) => void) => void;
  onModelScale?: (handler: (scaleFactor: number) => void) => void;
  onModelReset?: (handler: () => void) => void;
  onSwipeUp?: (handler: () => void) => void;
  onSwipeDown?: (handler: () => void) => void;
  onExperienceReady?: () => void;
}

const BC2200Experience: React.FC<BC2200ExperienceProps> = ({
  onClose,
  arPosition,
  arScene,
  arCamera,
  coordinateScale = 1.0,
  userPosition,
  onModelRotate,
  onModelScale,
  onModelReset,
  onSwipeUp,
  onSwipeDown,
  onExperienceReady
}) => {
  // Refs for Three.js objects
  const animatedPointCloudRef = useRef<THREE.Points | null>(null);
  const animatedGroupRef = useRef<THREE.Group | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const initialScaleRef = useRef<number>(1);

  
 
  
  // Store initial camera position for reset
  const initialCameraPos = useRef(new THREE.Vector3(0, 0, 5));
  //Destination lonlat
  const BC2200_DESTINATION: [number, number] = [-76.94867670536043, 38.91237400212842];

  // State to track override status
  const [arTestingOverride, setArTestingOverride] = useState(() => {  
    return (window as any).arTestingOverride ?? true;
  });

  // Animation state
  const [hasPointCloud, setHasPointCloud] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [animationProgress, setAnimationProgress] = useState(0);

  // Define isArMode at the component level
  const isArMode = !!(arScene && arCamera && arPosition);


const destinationPosition = BC2200_DESTINATION;
  


  // Listen for override changes (same pattern as other experiences)
  useEffect(() => {
    const checkOverride = () => {
      const currentOverride = (window as any).arTestingOverride ?? true;
      if (currentOverride !== arTestingOverride) {
        setArTestingOverride(currentOverride);
        console.log('🛶 BC2200Experience override changed:', currentOverride);
        
        if (animatedGroupRef.current && isArMode && arPosition) {
          if (currentOverride) {
            console.log('🎯 Setting group override position (0, 0, -5)');
            animatedGroupRef.current.position.set(0, 0, -5);
          } else {
            console.log('🎯 Setting group anchor position:', arPosition);
            animatedGroupRef.current.position.copy(arPosition);
          }
          
          // Force visual update
          animatedGroupRef.current.visible = false;
          setTimeout(() => {
            if (animatedGroupRef.current) {
              animatedGroupRef.current.visible = true;
            }
          }, 50);
          
          console.log('🎯 Group position after change:', animatedGroupRef.current.position);
        }
      }
    };
    
    const interval = setInterval(checkOverride, 100);
    return () => clearInterval(interval);
  }, [arTestingOverride]);

  // Separate effect for position updates when AR data changes
  useEffect(() => {
    if (animatedGroupRef.current && isArMode && arPosition) {
      const currentOverride = (window as any).arTestingOverride ?? true;
      
      if (currentOverride) {
        animatedGroupRef.current.position.set(0, 0, -5);
      } else {
        animatedGroupRef.current.position.copy(arPosition);
      }
      
      console.log('🎯 Position updated due to AR change:', animatedGroupRef.current.position);
    }
  }, [isArMode, arPosition]);

  // Register gesture handlers on mount
  useEffect(() => {
    // Register rotation handler
    if (onModelRotate) {
      onModelRotate((deltaX: number, deltaY: number) => {
        if (animatedGroupRef.current) {
          const currentPosition = animatedGroupRef.current.position.clone();
          animatedGroupRef.current.rotation.y += deltaX;
          animatedGroupRef.current.rotation.x += deltaY;
          animatedGroupRef.current.position.copy(currentPosition);
        }
      });
    }

    // Register scale handler
    if (onModelScale) {
      onModelScale((scaleFactor: number) => {
        if (animatedGroupRef.current) {
          const currentScale = animatedGroupRef.current.scale.x;
          const newScale = Math.max(0.1, Math.min(10, currentScale * scaleFactor));
          console.log('🛶 BC2200 Scale handler called:', {
            scaleFactor,
            currentScale: currentScale.toFixed(3),
            newScale: newScale.toFixed(3)
          });
          animatedGroupRef.current.scale.setScalar(newScale);
        }
      });
    }

    // Register reset handler
    if (onModelReset) {
      onModelReset(() => {
        console.log('🔄 BC2200 RESET HANDLER CALLED');
        if (animatedGroupRef.current) {
          animatedGroupRef.current.rotation.set(0, 0, 0);
          const initialScale = initialScaleRef.current;
          animatedGroupRef.current.scale.set(initialScale, initialScale, initialScale);
          
          // Reset position based on current mode
          if (isArMode && arPosition) {
            const currentOverride = (window as any).arTestingOverride ?? true;
            
            if (currentOverride) {
              animatedGroupRef.current.position.set(0, 0, -5);
              console.log('🔄 Reset: BC2200 positioned at override location');
            } else {
              animatedGroupRef.current.position.copy(arPosition);
              console.log('🔄 Reset: BC2200 positioned at AR anchor location');
            }
          } else {
            animatedGroupRef.current.position.set(0, 0, -3);
            console.log('🔄 Reset: BC2200 positioned at standalone location');
          }
          
          console.log('🔄 BC2200 reset completed');
        }
      });
    }

    // Register swipe handlers
    if (onSwipeUp) {
      onSwipeUp(() => {
        console.log('👆 Swipe up detected on BC2200 (animation playing)');
      });
    }

    if (onSwipeDown) {
      onSwipeDown(() => {
        console.log('👇 Swipe down detected on BC2200 (animation playing)');
      });
    }
  }, []);

  // Callback functions for AnimatedPointCloudEngine
  const handleModelLoaded = (pointCloud: THREE.Points) => {
    animatedPointCloudRef.current = pointCloud;
    
    // Get the group reference from the point cloud's parent
    if (pointCloud.parent && pointCloud.parent instanceof THREE.Group) {
      animatedGroupRef.current = pointCloud.parent;
      initialScaleRef.current = animatedGroupRef.current.scale.x;
    }
    
    setHasPointCloud(true);
    onExperienceReady?.();
    console.log('✅ BC2200 animated point cloud loaded successfully');
  };

  const handleLoadingProgress = (progress: number) => {
    setLoadingProgress(progress);
  };

  const handleError = (error: string) => {
    console.error('❌ BC2200 loading error:', error);
  };

 

  const handleAnimationLoop = (frameIndex: number, progress: number) => {
    setCurrentFrame(frameIndex);
    setAnimationProgress(progress);
  };

  // Main effect for scene setup (following pattern from other experiences)
  useEffect(() => {
    let isMounted = true;
    
    console.log('🛶 BC2200Experience mode:', isArMode ? 'AR' : 'Standalone');
    
    // Create container for standalone mode
    const container = document.createElement('div');
    container.id = 'threejs-container';
    container.style.position = 'fixed';
    container.style.top = '0';
    container.style.left = '0';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.zIndex = '1001';
    
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
    instructions.style.zIndex = '1002';
    instructions.innerHTML = 'The ancient Anacostia River (2200 BC).';
    container.appendChild(instructions);

  
    // Initialize Three.js components (same pattern as other experiences)
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
      console.log('🛶 BC2200Experience using AR scene and camera');
    } else {
      // Standalone Mode: Create own scene/camera/renderer
      scene = new THREE.Scene();
      sceneRef.current = scene;
      
      camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
      camera.position.copy(initialCameraPos.current);
      cameraRef.current = camera;
      
      renderer = new THREE.WebGLRenderer({ 
        antialias: true, 
        alpha: true,
        premultipliedAlpha: false
      });
      
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setClearColor(0x000000, 0);
      container.appendChild(renderer.domElement);

      // Add OrbitControls only in standalone mode
      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.25;
      controls.screenSpacePanning = false;
      controls.minDistance = 0.5;
      controls.maxDistance = 10;
      controls.maxPolarAngle = Math.PI / 1.5;
      controls.target.set(0, 0, 0);
      controlsRef.current = controls;
      
      // Add lighting only in standalone mode
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
      scene.add(ambientLight);

      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
      directionalLight.position.set(1, 1, 1).normalize();
      scene.add(directionalLight);
    }

    // Handle window resize
    const handleResize = () => {
      if (isMounted && camera && renderer) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      }
    };
    
    window.addEventListener('resize', handleResize);
    
    // Animation loop (no model animations needed - AnimatedPointCloudEngine handles it)
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
      
      window.removeEventListener('resize', handleResize);
      
      if (controls) {
        controls.dispose();
      }
      
      if (renderer) {
        renderer.dispose();
      }
      
      if (document.body.contains(container)) {
        document.body.removeChild(container);
      }
    };
  }, [isArMode]);

  return (
    <>
      {/* Animated Point Cloud Engine */}
      {sceneRef.current && (
        <AnimatedPointCloudEngine
          modelName="bc2200"
          scene={isArMode ? arScene! : sceneRef.current!}
          isArMode={isArMode}
          arPosition={arPosition}
          userPosition={userPosition}
          destinationPosition={destinationPosition}
          coordinateScale={coordinateScale}
          onModelLoaded={handleModelLoaded}
          onLoadingProgress={handleLoadingProgress}
          onError={handleError}
          onAnimationLoop={handleAnimationLoop}
        />
      )}

      {/* Loading Screen */}
      {!hasPointCloud && sceneRef.current && (
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
            border: '3px solid rgba(139, 69, 19, 0.3)',
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
            color: '#DEB887'
          }}>
            🛶 Preparing BC2200 Experience
          </h2>
          
          <p style={{
            margin: '0',
            fontSize: '16px',
            opacity: 0.8,
            textAlign: 'center',
            maxWidth: '300px'
          }}>
            Loading animated canoe model with {loadingProgress > 0 ? '24 animation frames' : 'paddling animation'}...
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

      {/* Debug Panel for BC2200 Experience */}
      {SHOW_DEBUG_PANEL && (
        <div style={{
          position: 'absolute',
          bottom: '10px',
          right: '10px',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          color: 'white',
          padding: '10px',
          borderRadius: '4px',
          fontSize: '12px',
          zIndex: 1003,
          pointerEvents: 'auto',
          fontFamily: 'monospace'
        }}>
          <div style={{ color: '#DEB887' }}>🛶 BC2200 ANIMATION DEBUG</div>
          <div>Mode: {isArMode ? 'AR Portal' : 'Standalone'}</div>
          
          {arPosition && (
            <div>AR Anchor: [{arPosition.x.toFixed(3)}, {arPosition.y.toFixed(3)}, {arPosition.z.toFixed(3)}]</div>
          )}
          
          {destinationPosition && (
            <div>Destination: [{destinationPosition[0].toFixed(6)}, {destinationPosition[1].toFixed(6)}]</div>
          )}
          
          {animatedGroupRef.current && (
            <div style={{ color: 'cyan' }}>
              Group Pos: [{animatedGroupRef.current.position.x.toFixed(3)}, {animatedGroupRef.current.position.y.toFixed(3)}, {animatedGroupRef.current.position.z.toFixed(3)}]
            </div>
          )}
          
          <div>Scale: {coordinateScale}x</div>
          
          <div style={{ color: hasPointCloud ? 'lightgreen' : 'orange' }}>
            Animation: {hasPointCloud ? '✅ Playing' : `❌ Loading ${loadingProgress.toFixed(0)}%`}
          </div>
          
          {hasPointCloud && (
            <>
              <div style={{ color: 'lightblue', fontSize: '10px' }}>
                Frame: {currentFrame + 1}/24 ({(animationProgress * 100).toFixed(1)}%)
              </div>
              <div style={{ color: 'lightblue', fontSize: '10px' }}>
                24fps paddling animation + spatial movement
              </div>
            </>
          )}
          
          <div style={{ color: 'lightgreen', fontSize: '10px' }}>
            Binary format: Fast frame switching
          </div>
          
          <div style={{ color: 'yellow', fontSize: '10px' }}>
            Spatial: Anchor → Destination over animation cycle
          </div>
          
          <div 
            onClick={() => {
              const newValue = !arTestingOverride;
              (window as any).arTestingOverride = newValue;
              setArTestingOverride(newValue);
              console.log('🎯 AR Override toggled:', newValue ? 'ON' : 'OFF');
              
              // Immediately update group position if we have the group
              if (animatedGroupRef.current && isArMode && arPosition) {
                if (newValue) {
                  console.log('🎯 Immediately setting group override position (0, 0, -5)');
                  animatedGroupRef.current.position.set(0, 0, -5);
                } else {
                  console.log('🎯 Immediately setting group anchor position:', arPosition);
                  animatedGroupRef.current.position.copy(arPosition);
                }
                console.log('🎯 Group position updated to:', animatedGroupRef.current.position);
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
            Override: {arTestingOverride ? '✅ (0,0,-5)' : '❌ (AR Anchor)'}
          </div>
        </div>
      )}
    </>
  );
};

export default BC2200Experience;