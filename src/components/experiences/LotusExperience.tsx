import React, { useEffect, useState, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import PointCloudMorphingEngine from '../common/PointCloudMorphingEngine';

// Import the bounding box data
const seasonsBoxDimensions = {
  "cattail_1": {
    "box_dimensions": { "X": 7.0, "Y": 6.11391, "Z": -3.11109 },
    "shifted_box_center": { "X": 3.00282, "Y": 5.15699, "Z": -2.57107 },
    "global_box_center": { "X": 2.58592, "Y": 9.96978, "Z": 0.00309755 }
  },
  "cattail_2": {
    "box_dimensions": { "X": 7.0, "Y": 3.86938, "Z": -1.92645 },
    "shifted_box_center": { "X": 1.94294, "Y": 3.85586, "Z": -2.00759 },
    "global_box_center": { "X": 1.84827, "Y": 8.86985, "Z": 0.00205987 }
  },
  "cattail_3": {
    "box_dimensions": { "X": 7.0, "Y": 15.7519, "Z": -8.55881 },
    "shifted_box_center": { "X": 7.19311, "Y": 17.201, "Z": -9.11689 },
    "global_box_center": { "X": 8.08407, "Y": 9.67628, "Z": 0.0130204 }
  },
  "cattail_4": {
    "box_dimensions": { "X": 7.0, "Y": 9.78502, "Z": -5.48069 },
    "shifted_box_center": { "X": 4.30433, "Y": 10.1278, "Z": -5.07628 },
    "global_box_center": { "X": 5.0515, "Y": 27.3561, "Z": 0.013139 }
  },
  "lily_1": {
    "box_dimensions": { "X": 7.0, "Y": 26.1559, "Z": -13.091 },
    "shifted_box_center": { "X": 13.0649, "Y": 16.4241, "Z": -8.0769 },
    "global_box_center": { "X": 8.34724, "Y": 9.99417, "Z": 0.000821289 }
  },
  "lily_2": {
    "box_dimensions": { "X": 27.8148, "Y": -28.2008, "Z": -0.385963 },
    "shifted_box_center": { "X": 33.4941, "Y": -20.9138, "Z": 12.5803 },
    "global_box_center": { "X": 115.79, "Y": -1.77575, "Z": 14.0143 }
  },
  "lotus_1": {
    "box_dimensions": { "X": 4.74237, "Y": -2.18979, "Z": 2.55258 },
    "shifted_box_center": { "X": 9.99301, "Y": 0.000422351, "Z": 9.99343 },
    "global_box_center": { "X": 0.546762, "Y": 0.353696, "Z": 0.900457 }
  },
  "lotus_2": {
    "box_dimensions": { "X": 7.0, "Y": 12.172, "Z": -6.12077 },
    "shifted_box_center": { "X": 6.05123, "Y": 9.93416, "Z": 0.0378408 },
    "global_box_center": { "X": 9.972, "Y": 9.82072, "Z": -4.94933 }
  },
  "lily_3": {
    "box_dimensions": { "X": 7.0, "Y": 68.0109, "Z": -33.9307 },
    "shifted_box_center": { "X": 34.0801, "Y": 77.0403, "Z": -38.4627 },
    "global_box_center": { "X": 38.5777, "Y": 9.09365, "Z": 0.0833207 }
  },
  "lily_4": {
    "box_dimensions": { "X": 7.0, "Y": 60.9039, "Z": -30.8069 },
    "shifted_box_center": { "X": 30.097, "Y": 60.9249, "Z": -30.3065 },
    "global_box_center": { "X": 30.6184, "Y": 9.80548, "Z": 0.160642 }
  },
  "lotus_3": {
    "box_dimensions": { "X": 7.0, "Y": 23.8707, "Z": -11.8118 },
    "shifted_box_center": { "X": 12.0589, "Y": 9.99123, "Z": 0.00311597 },
    "global_box_center": { "X": 9.99435, "Y": 24.1301, "Z": -12.1061 }
  },
  "lotus_4": {
    "box_dimensions": { "X": 7.0, "Y": 34.1839, "Z": -17.1202 },
    "shifted_box_center": { "X": 17.0637, "Y": 9.99004, "Z": 0.00112372 },
    "global_box_center": { "X": 9.99117, "Y": 33.5477, "Z": -16.6561 }
  }
};

const SHOW_DEBUG_PANEL = true;

interface LotusExperienceProps {
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
}

const LotusExperience: React.FC<LotusExperienceProps> = ({ 
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
  onSwipeDown
}) => {
  // Refs for Three.js objects
  const morphingPointCloudRef = useRef<THREE.Points | null>(null);
  const morphingGroupRef = useRef<THREE.Group | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const initialScaleRef = useRef<number>(1);
  
  // Store initial camera position for reset
  const initialCameraPos = useRef(new THREE.Vector3(0, 0, 5));
  
  // State to track override status
  const [arTestingOverride, setArTestingOverride] = useState(() => {  
    return (window as any).arTestingOverride ?? true;
  });

  // Point cloud state
  const [hasPointCloud, setHasPointCloud] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [currentStage, setCurrentStage] = useState('Lotus Growth Cycle');

  // Define isArMode at the component level
  const isArMode = !!(arScene && arCamera && arPosition);

  // Listen for override changes
  useEffect(() => {
    const checkOverride = () => {
      const currentOverride = (window as any).arTestingOverride ?? true;
      if (currentOverride !== arTestingOverride) {
        setArTestingOverride(currentOverride);
        console.log('🪷 LotusExperience override changed:', currentOverride);
        
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
  }, [arTestingOverride, isArMode, arPosition]);

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
        console.log('🔄 LOTUS RESET HANDLER CALLED');
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
              console.log('🔄 Reset: Lotus group positioned at override location');
            } else {
              morphingGroupRef.current.position.copy(arPosition);
              console.log('🔄 Reset: Lotus group positioned at AR anchor location');
            }
          } else {
            morphingGroupRef.current.position.set(0, 0, -3);
            console.log('🔄 Reset: Lotus group positioned at standalone location');
          }
          
          console.log('🔄 Lotus reset completed');
        }
      });
    }

    // Register swipe handlers (no action needed - auto-morphing)
    if (onSwipeUp) {
      onSwipeUp(() => {
        console.log('👆 Swipe up detected on Lotus (auto-morphing)');
      });
    }

    if (onSwipeDown) {
      onSwipeDown(() => {
        console.log('👇 Swipe down detected on Lotus (auto-morphing)');
      });
    }
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
    
    console.log('✅ Lotus morphing point cloud loaded successfully');
  };

  // Handle ready for reset callback - triggers auto-reset when models ready
  const handleReadyForReset = () => {
    console.log('🔄 Lotus ready for reset - auto-triggering reset');
    // Directly call reset logic 
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
          console.log('🔄 Auto-reset: Lotus group positioned at override location');
        } else {
          morphingGroupRef.current.position.copy(arPosition);
          console.log('🔄 Auto-reset: Lotus group positioned at AR anchor location');
        }
      } else {
        morphingGroupRef.current.position.set(0, 0, -3);
        console.log('🔄 Auto-reset: Lotus group positioned at standalone location');
      }
      
      console.log('🔄 Lotus auto-reset completed');
    }
  };

  // Handle loading progress
  const handleLoadingProgress = (progress: number) => {
    setLoadingProgress(progress);
  };

  // Handle errors
  const handleError = (error: string) => {
    console.error('❌ Lotus loading error:', error);
  };

  // Main effect for scene setup
  useEffect(() => {
    let isMounted = true;
    
    console.log('🪷 LotusExperience mode:', isArMode ? 'AR' : 'Standalone');
    
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
    instructions.innerHTML = 'Watch the lotus seasonal growth cycle unfold. Tap continue when ready.';
    container.appendChild(instructions);

    // Create continue button
    const continueButton = document.createElement('button');
    continueButton.style.position = 'absolute';
    continueButton.style.bottom = '20px';
    continueButton.style.right = '20px';
    continueButton.style.backgroundColor = 'rgba(255, 192, 203, 0.7)'; // Light pink for lotus
    continueButton.style.color = 'white';
    continueButton.style.padding = '10px 15px';
    continueButton.style.borderRadius = '8px';
    continueButton.style.border = 'none';
    continueButton.style.zIndex = '1002';
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
      console.log('🪷 LotusExperience using AR scene and camera');
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
      {sceneRef.current ? (
        <PointCloudMorphingEngine
          modelPrefix="lotus"
          scene={sceneRef.current}
          boundingBoxData={seasonsBoxDimensions}
          isArMode={isArMode}
          arPosition={arPosition}
          onModelLoaded={handleModelLoaded}
          onLoadingProgress={handleLoadingProgress}
          onError={handleError}
          onReadyForReset={handleReadyForReset}
        />
      ) : (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          color: 'white',
          backgroundColor: 'rgba(255, 0, 0, 0.7)',
          padding: '10px',
          borderRadius: '5px',
          zIndex: 9999
        }}>
          ⚠️ Scene not ready for morphing engine
        </div>
      )}

      {/* Debug Panel for Lotus Experience */}
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
          <div style={{ color: 'pink' }}>🪷 LOTUS MORPHING DEBUG</div>
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

export default LotusExperience;