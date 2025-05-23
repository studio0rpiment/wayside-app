import React, { useEffect, useState, useRef } from 'react';
import * as THREE from 'three';
import { getAssetPath } from '../../utils/assetPaths';

// Import these separately to avoid the Vite optimization issue
import { GLTFLoader as GLTFLoaderModule } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const SHOW_DEBUG_PANEL = true;

interface MacExperienceProps {
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

const MacExperience: React.FC<MacExperienceProps> = ({ 
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
  const modelRef = useRef<THREE.Group | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  
  // Animation-specific refs
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const clockRef = useRef<THREE.Clock>(new THREE.Clock());
  const actionsRef = useRef<THREE.AnimationAction[]>([]);
  
  // Store initial camera position for reset
  const initialCameraPos = useRef(new THREE.Vector3(0, 0, 5));
  
  // State to track override status
  const [arTestingOverride, setArTestingOverride] = useState(() => {  
    return (window as any).arTestingOverride ?? true;
  });

  // Animation state
  const [hasAnimations, setHasAnimations] = useState(false);

  // Define isArMode at the component level
  const isArMode = !!(arScene && arCamera && arPosition);

  // Listen for override changes - SAME AS ORIGINAL
  useEffect(() => {
    const checkOverride = () => {
      const currentOverride = (window as any).arTestingOverride ?? true;
      if (currentOverride !== arTestingOverride) {
        setArTestingOverride(currentOverride);
        console.log('🎯 MacExperience override changed:', currentOverride);
        
        if (modelRef.current && isArMode && arPosition) {
          if (currentOverride) {
            console.log('🎯 Setting override position (0.75, 0, -5)');
            modelRef.current.position.set(0.75, 0, -5);
          } else {
            console.log('🎯 Setting anchor position:', arPosition);
            modelRef.current.position.copy(arPosition);
          }
          
          // Force visual update
          modelRef.current.visible = false;
          setTimeout(() => {
            if (modelRef.current) {
              modelRef.current.visible = true;
            }
          }, 50);
          
          console.log('🎯 Model position after change:', modelRef.current.position);
        }
      }
    };
    
    const interval = setInterval(checkOverride, 100);
    return () => clearInterval(interval);
  }, [arTestingOverride, isArMode, arPosition]);

  // *** FIXED: Register gesture handlers on mount, not in render ***
  useEffect(() => {
    // Register rotation handler
    if (onModelRotate) {
      onModelRotate((deltaX: number, deltaY: number) => {
        if (modelRef.current) {
          modelRef.current.rotation.y += deltaX;
          modelRef.current.rotation.x += deltaY;
        }
      });
    }

    // Register scale handler
    if (onModelScale) {
      onModelScale((scaleFactor: number) => {
        if (modelRef.current) {
          const currentScale = modelRef.current.scale.x;
          const newScale = Math.max(0.1, Math.min(10, currentScale * scaleFactor));
          modelRef.current.scale.setScalar(newScale);
        }
      });
    }

    // Register reset handler
    if (onModelReset) {
      onModelReset(() => {
        if (modelRef.current) {
          modelRef.current.rotation.set(0, 0, 0);
          modelRef.current.scale.set(1, 1, 1);
          
          // Reset animations too
          if (hasAnimations && actionsRef.current.length > 0) {
            actionsRef.current.forEach(action => {
              action.reset();
              action.play();
            });
          }
        }
      });
    }

    // Register swipe handlers
    if (onSwipeUp) {
      onSwipeUp(() => {
        // For the portal concept, we don't want user controls
        // But keeping this for future flexibility
        console.log('👆 Swipe up detected on Mac');
      });
    }

    if (onSwipeDown) {
      onSwipeDown(() => {
        // For the portal concept, we don't want user controls
        // But keeping this for future flexibility  
        console.log('👇 Swipe down detected on Mac');
      });
    }
  }, []); // *** FIXED: Empty dependency array - register once on mount

  // Main effect for model loading and scene setup
  useEffect(() => {
    let isMounted = true;
    
    console.log('🎯 MacExperience mode:', isArMode ? 'AR' : 'Standalone');
    
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
    instructions.innerHTML = 'Explore the historic Macintosh computer. Tap continue when ready.';
    container.appendChild(instructions);

    // Create continue button
    const continueButton = document.createElement('button');
    continueButton.style.position = 'absolute';
    continueButton.style.bottom = '20px';
    continueButton.style.right = '20px';
    continueButton.style.backgroundColor = 'rgba(0, 120, 0, 0.7)';
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
      console.log('🎯 MacExperience using AR scene and camera');
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

    // Create loader
    const loader = new GLTFLoaderModule();
    
    // Create loading indicator
    const loadingDiv = document.createElement('div');
    loadingDiv.style.position = 'absolute';
    loadingDiv.style.top = '50%';
    loadingDiv.style.left = '50%';
    loadingDiv.style.transform = 'translate(-50%, -50%)';
    loadingDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    loadingDiv.style.color = 'white';
    loadingDiv.style.padding = '20px';
    loadingDiv.style.borderRadius = '10px';
    loadingDiv.style.zIndex = '1003';
    loadingDiv.innerHTML = 'Loading Mac Computer...';
    container.appendChild(loadingDiv);

    // Load the model
    const modelPath = getAssetPath('models/mac.glb');
    console.log('🎯 Loading Mac model:', modelPath);

    loader.load(
      modelPath,
      (gltf) => {
        if (!isMounted) return;

        const model = gltf.scene;
        modelRef.current = model;
        
        // Center the model
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        model.position.x = -center.x;
        model.position.y = -center.y;
        model.position.z = -center.z;
        
        // Scale model appropriately
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        if (maxDim > 0) {
          const scale = (isArMode ? 2 : 8) / maxDim;
          model.scale.set(scale, scale, scale);
        }
        
        // Position based on mode
        if (isArMode && arPosition) {
          const currentOverride = (window as any).arTestingOverride ?? true;
          
          if (currentOverride) {
            model.position.set(0.7, 0, -5);
            console.log('🎯 Mac positioned at TESTING override location:', model.position);
          } else {
            model.position.copy(arPosition);
            console.log('🎯 Mac positioned at AR anchor location:', arPosition);
          }
        } else {
          model.position.set(0, 0, -3);
        }
        
        // Make all materials transparent
        model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            if (child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach(material => {
                  material.transparent = true;
                  material.opacity = 1.0;
                  material.alphaTest = 0.5;
                  material.side = THREE.DoubleSide;
                });
              } else {
                child.material.transparent = true;
                child.material.opacity = 1.0;
                child.material.alphaTest = 0.5;
                child.material.side = THREE.DoubleSide;
              }
            }
          }
        });
        
        // Animation Setup - Auto-play for portal effect
        if (gltf.animations && gltf.animations.length > 0) {
          console.log('🎬 Found', gltf.animations.length, 'animation(s) in Mac model');
          
          // Create animation mixer
          const mixer = new THREE.AnimationMixer(model);
          mixerRef.current = mixer;
          
          // Create actions for each animation clip
          const actions: THREE.AnimationAction[] = [];
          gltf.animations.forEach((clip, index) => {
            console.log(`🎬 Setting up animation ${index}: "${clip.name}" (${clip.duration.toFixed(2)}s)`);
            
            const action = mixer.clipAction(clip);
            
            // Configure for portal effect - continuous looping
            action.setLoop(THREE.LoopRepeat, Infinity); 
            action.clampWhenFinished = true;
            
            // Start playing immediately - no user control needed
            action.play();
            
            actions.push(action);
          });
          
          actionsRef.current = actions;
          setHasAnimations(true);
          
          console.log('✅ Mac animations initialized and auto-playing for portal effect');
        } else {
          console.log('ℹ️ No animations found in Mac model');
          setHasAnimations(false);
        }
        
        // Add model to scene
        scene.add(model);
        
        // Remove loading indicator
        container.removeChild(loadingDiv);
        
        console.log('✅ Mac model loaded successfully');
      },
      (xhr) => {
        console.log(`Mac model ${(xhr.loaded / xhr.total) * 100}% loaded`);
      },
      (error) => {
        console.error('❌ Error loading Mac model:', error);
        if (container.contains(loadingDiv)) {
          loadingDiv.innerHTML = 'Error loading Mac Model file may be missing';
        }
      }
    );

    // Handle window resize
    const handleResize = () => {
      if (isMounted && camera && renderer) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      }
    };
    
    window.addEventListener('resize', handleResize);
    
    // Animation loop with mixer updates
    const animate = function () {
      if (!isMounted) return;
      
      requestAnimationFrame(animate);
      
      // Update animation mixer if it exists
      if (mixerRef.current) {
        const delta = clockRef.current.getDelta();
        mixerRef.current.update(delta);
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
      
      // Stop and cleanup animations
      if (mixerRef.current) {
        actionsRef.current.forEach(action => {
          action.stop();
        });
        mixerRef.current.stopAllAction();
        mixerRef.current = null;
      }
      
      actionsRef.current = [];
      
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
  }, [isArMode]); // *** FIXED: Only isArMode dependency

  return (
    <>
      {/* Debug Panel for Mac Experience */}
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
          <div style={{ color: 'yellow' }}>🖥️ MAC PORTAL DEBUG</div>
          <div>Mode: {isArMode ? 'AR Portal' : 'Standalone'}</div>
          {arPosition && (
            <div>AR Anchor: [{arPosition.x.toFixed(3)}, {arPosition.y.toFixed(3)}, {arPosition.z.toFixed(3)}]</div>
          )}
          {modelRef.current && (
            <div style={{ color: 'cyan' }}>
              Model Pos: [{modelRef.current.position.x.toFixed(3)}, {modelRef.current.position.y.toFixed(3)}, {modelRef.current.position.z.toFixed(3)}]
            </div>
          )}
          <div>Scale: {coordinateScale}x</div>
          <div style={{ color: hasAnimations ? 'lightgreen' : 'orange' }}>
            Animations: {hasAnimations ? `🎬 Auto-Playing (${actionsRef.current.length})` : '❌ None'}
          </div>
          
          <div 
            onClick={() => {
              const newValue = !arTestingOverride;
              (window as any).arTestingOverride = newValue;
              setArTestingOverride(newValue);
              console.log('🎯 AR Override toggled:', newValue ? 'ON' : 'OFF');
              
              // Immediately update model position if we have the model
              if (modelRef.current && isArMode && arPosition) {
                if (newValue) {
                  console.log('🎯 Immediately setting override position (0, 0, -5)');
                  modelRef.current.position.set(0.7, 0, -5);
                } else {
                  console.log('🎯 Immediately setting anchor position:', arPosition);
                  modelRef.current.position.copy(arPosition);
                }
                console.log('🎯 Model position updated to:', modelRef.current.position);
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
            Override: {arTestingOverride ? '✅ (0.75,0,-5)' : '❌ (AR Anchor)'}
          </div>
        </div>
      )}
    </>
  );
};

export default MacExperience;