import React, { useEffect, useState, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import OptimizedPointCloudMorphingEngine from '../common/OptimizedPointCloudMorphingEngine';

// Import the bounding box data
// Import the bounding box data - USE THE COMPLETE DATA SET


const SHOW_DEBUG_PANEL = true;

interface LilyExperienceProps {
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

const LilyExperience: React.FC<LilyExperienceProps> = ({ 
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
    console.log('🪷 LilyExperience: modelPrefix will be "lily"'); // Add this line

  // Refs for Three.js objects
  const morphingPointCloudRef = useRef<THREE.Points | null>(null);
  const morphingGroupRef = useRef<THREE.Group | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const initialScaleRef = useRef<number>(1);
  
  // Store initial camera position for reset
  const initialCameraPos = useRef(new THREE.Vector3(0, 0, 5));

  const gestureHandlersRef = useRef<{
    rotate?: (deltaX: number, deltaY: number) => void;
    scale?: (scaleFactor: number) => void;
    reset?: () => void;
    swipeUp?: () => void;
    swipeDown?: () => void;
  }>({});
    
  // State to track override status
  const [arTestingOverride, setArTestingOverride] = useState(() => {  
    return (window as any).arTestingOverride ?? true;
  });

  // Point cloud state
  const [hasPointCloud, setHasPointCloud] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [currentStage, setCurrentStage] = useState('Lily Growth Cycle');

  // Define isArMode at the component level
  const isArMode = !!(arScene && arCamera && arPosition);

  // Listen for override changes
  // ✅ MINIMAL FIX: Just change the dependency array to break the loop

// Listen for override changes
useEffect(() => {
  const checkOverride = () => {
    const currentOverride = (window as any).arTestingOverride ?? true;
    if (currentOverride !== arTestingOverride) {
      setArTestingOverride(currentOverride);
      console.log('🪷 LilyExperience override changed:', currentOverride);
      
      if (morphingGroupRef.current && isArMode && arPosition) {
        if (currentOverride) {
          console.log('🎯 Setting group override position (0, 0, -5)');
          morphingGroupRef.current.position.set(0, 0, -5);
        } else {
          console.log('🎯 Setting group anchor position:', arPosition);
          morphingGroupRef.current.position.copy(arPosition);
        }
        
        // Force visual update
        morphingGroupRef.current.visible = false;
        setTimeout(() => {
          if (morphingGroupRef.current) {
            morphingGroupRef.current.visible = true;
          }
        }, 50);
        
        console.log('🎯 Group position after change:', morphingGroupRef.current.position);
      }
    }
  };
  
  const interval = setInterval(checkOverride, 100);
  return () => clearInterval(interval);
}, [arTestingOverride]); // ✅ FIXED: Only depend on arTestingOverride

// ✅ NEW: Separate effect for position updates when AR data changes
useEffect(() => {
  if (morphingGroupRef.current && isArMode && arPosition) {
    const currentOverride = (window as any).arTestingOverride ?? true;
    
    if (currentOverride) {
      morphingGroupRef.current.position.set(0, 0, -5);
    } else {
      morphingGroupRef.current.position.copy(arPosition);
    }
    
    console.log('🎯 Position updated due to AR change:', morphingGroupRef.current.position);
  }
}, [isArMode, arPosition]); // ✅ Separate effect for AR position changes

  // Register gesture handlers on mount
  useEffect(() => {
    // Register rotation handler - now operates on the GROUP
    if (onModelRotate) {
      onModelRotate((deltaX: number, deltaY: number) => {
        if (morphingGroupRef.current) {
          // Store current position
          const currentPosition = morphingGroupRef.current.position.clone();

          // Apply rotation
          morphingGroupRef.current.rotation.y += deltaX;
          morphingGroupRef.current.rotation.x += deltaY;

          // Restore position to prevent drift
          morphingGroupRef.current.position.copy(currentPosition);
        }
      });
    }

    // Register scale handler - now operates on the GROUP
    if (onModelScale) {
      onModelScale((scaleFactor: number) => {
        if (morphingGroupRef.current) {
          const currentScale = morphingGroupRef.current.scale.x;
          const newScale = Math.max(0.1, Math.min(10, currentScale * scaleFactor));
          console.log('🪷 Scale handler called:', {
            scaleFactor,
            currentScale: currentScale.toFixed(3),
            newScale: newScale.toFixed(3)
          });
          morphingGroupRef.current.scale.setScalar(newScale);
        }
      });
    }

    // Register reset handler - now operates on the GROUP
    if (onModelReset) {
      onModelReset(() => {
        console.log('🔄 Lily RESET HANDLER CALLED');
        if (morphingGroupRef.current) {
          // Reset rotation and scale on the GROUP
          morphingGroupRef.current.rotation.set(0, 0, 0);
          const initialScale = initialScaleRef.current;
          morphingGroupRef.current.scale.set(initialScale, initialScale, initialScale);
          
          // Reset position based on current mode
          if (isArMode && arPosition) {
            const currentOverride = (window as any).arTestingOverride ?? true;
            
            if (currentOverride) {
              morphingGroupRef.current.position.set(0, 0, -5);
              console.log('🔄 Reset: Lily group positioned at override location');
            } else {
              morphingGroupRef.current.position.copy(arPosition);
              console.log('🔄 Reset: Lily group positioned at AR anchor location');
            }
          } else {
            morphingGroupRef.current.position.set(0, 0, -3);
            console.log('🔄 Reset: Lily group positioned at standalone location');
          }
          
          console.log('🔄 Lily reset completed');
        }
      });
    }

    // Register swipe handlers (no action needed - auto-morphing)
    if (onSwipeUp) {
      onSwipeUp(() => {
        console.log('👆 Swipe up detected on Lily (auto-morphing)');
      });
    }

    if (onSwipeDown) {
      onSwipeDown(() => {
        console.log('👇 Swipe down detected on Lily (auto-morphing)');
      });
    }
  }, []);

      const registerResetHandler = useCallback((handler: () => void) => {
      gestureHandlersRef.current.reset = handler;
    }, []);

  // Declare callback functions
  const handleModelLoaded = (pointCloud: THREE.Points) => {
    morphingPointCloudRef.current = pointCloud;
    
    // Get the group reference from the point cloud's parent
    if (pointCloud.parent && pointCloud.parent instanceof THREE.Group) {
      morphingGroupRef.current = pointCloud.parent;
      
      // Store initial scale from the GROUP
      initialScaleRef.current = morphingGroupRef.current.scale.x;
    }
    
    setHasPointCloud(true);
    onExperienceReady?.();
    
    console.log('✅ Lily morphing point cloud loaded successfully');
  };

  // Handle ready for reset callback - triggers auto-reset when models ready
const handleReadyForReset = () => {
  console.log('🔄 Lily ready for reset - auto-triggering reset for correct positioning');
   
  
  if (morphingGroupRef.current) {
    // Store initial scale from the GROUP
    initialScaleRef.current = morphingGroupRef.current.scale.x;
    
    // Trigger the reset handler automatically to position correctly
    // This calls the same logic that works when user manually resets
    setTimeout(() => {
      if (gestureHandlersRef.current.reset) {
        console.log('🔄 Auto-calling onModelReset for correct positioning');
        gestureHandlersRef.current.reset();
      }
    }, 100); // Small delay to ensure handlers are registered
  }
};

  // Handle loading progress
  const handleLoadingProgress = (progress: number) => {
    setLoadingProgress(progress);
  };

  // Handle errors
  const handleError = (error: string) => {
    console.error('❌ Lily loading error:', error);
  };

  // Main effect for scene setup
  useEffect(() => {
    let isMounted = true;
    
    console.log('🪷 LilyExperience mode:', isArMode ? 'AR' : 'Standalone');
    
    // Create container for standalone mode
    const container = document.createElement('div');
    container.id = 'threejs-container';
    container.style.position = 'fixed';
    container.style.top = '0';
    container.style.left = '0';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.zIndex = '1010';
   
    
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
    instructions.innerHTML = 'Watch the Lily seasonal growth cycle unfold. Tap continue when ready.';
    container.appendChild(instructions);

    // Create continue button
    const continueButton = document.createElement('button');
    continueButton.style.position = 'absolute';
    continueButton.style.bottom = '20px';
    continueButton.style.right = '20px';
    continueButton.style.backgroundColor = 'rgba(255, 192, 203, 0.7)'; // Light pink for Lily
    continueButton.style.color = 'white';
    continueButton.style.padding = '10px 15px';
    continueButton.style.borderRadius = '8px';
    continueButton.style.border = 'none';
    continueButton.style.zIndex = '1020';
    continueButton.innerHTML = 'Continue';

    continueButton.onclick = () => {
      if (onNext) {
        onNext();
      }
    };
    
    continueButton.addEventListener('touchstart', () => {
      if (onNext) {
        onNext();
      }
    }, { passive: false });

    container.appendChild(continueButton);

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
      console.log('🪷 LilyExperience using AR scene and camera');
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
    
    // Animation loop (no model animations needed - morphing engine handles it)
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
      {/* Morphing Engine Component */}


        {sceneRef.current && (
          <OptimizedPointCloudMorphingEngine
            modelPrefix="lily"
            scene={isArMode ? arScene! : sceneRef.current!}
            isArMode={isArMode}
            arPosition={arPosition}
            onModelLoaded={handleModelLoaded}
            onLoadingProgress={handleLoadingProgress}
            onError={handleError}
            onReadyForReset={handleReadyForReset}
            
          />
        )}

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
          border: '3px solid rgba(255, 192, 203, 0.3)',
          borderTop: '3px solid #ff69b4',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          marginBottom: '20px'
        }} />
    
        {/* Loading text */}
        <h2 style={{
          margin: '0 0 10px 0',
          fontSize: '24px',
          fontWeight: '400',
          color: '#ff69b4'
        }}>
          🪷 Preparing Lily Experience
        </h2>
        
        <p style={{
          margin: '0',
          fontSize: '16px',
          opacity: 0.8,
          textAlign: 'center',
          maxWidth: '300px'
        }}>
          Setting up AR scene and loading lily growth cycle models...
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
              backgroundColor: '#ff69b4',
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

        {/* Debug Panel for Lily Experience */}
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
            zIndex: 1030,
            pointerEvents: 'auto',
            fontFamily: 'monospace'
          }}>
          <div style={{ color: 'pink' }}>🪷 Lily MORPHING DEBUG</div>
          <div>Mode: {isArMode ? 'AR Portal' : 'Standalone'}</div>
          {arPosition && (
            <div>AR Anchor: [{arPosition.x.toFixed(3)}, {arPosition.y.toFixed(3)}, {arPosition.z.toFixed(3)}]</div>
          )}
          {morphingGroupRef.current && (
            <div style={{ color: 'cyan' }}>
              Group Pos: [{morphingGroupRef.current.position.x.toFixed(3)}, {morphingGroupRef.current.position.y.toFixed(3)}, {morphingGroupRef.current.position.z.toFixed(3)}]
            </div>
          )}
          <div>Scale: {coordinateScale}x</div>
          <div style={{ color: hasPointCloud ? 'lightgreen' : 'orange' }}>
            Morphing: {hasPointCloud ? '✅ Active' : `❌ Loading ${loadingProgress.toFixed(0)}%`}
          </div>
          <div style={{ color: 'lightblue', fontSize: '10px' }}>
            Auto-cycle: Bud → Opening → Bloom → Seed Pod
          </div>
          <div style={{ color: 'lightblue', fontSize: '10px' }}>
                Optimized: Loading device-appropriate quality
              </div>
              <div style={{ color: 'lightgreen', fontSize: '10px' }}>
                Binary format: Fast loading + reduced vertices
              </div>
          <div 
            onClick={() => {
              const newValue = !arTestingOverride;
              (window as any).arTestingOverride = newValue;
              setArTestingOverride(newValue);
              console.log('🎯 AR Override toggled:', newValue ? 'ON' : 'OFF');
              
              // Immediately update group position if we have the group
              if (morphingGroupRef.current && isArMode && arPosition) {
                if (newValue) {
                  console.log('🎯 Immediately setting group override position (0, 0, -5)');
                  morphingGroupRef.current.position.set(0, 0, -5);
                } else {
                  console.log('🎯 Immediately setting group anchor position:', arPosition);
                  morphingGroupRef.current.position.copy(arPosition);
                }
                console.log('🎯 Group position updated to:', morphingGroupRef.current.position);
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

export default LilyExperience;