import React, { useEffect, useState, useRef } from 'react';
import * as THREE from 'three';
import { getAssetPath } from '../../utils/assetPaths';

// Import these separately to avoid the Vite optimization issue
import { GLTFLoader as GLTFLoaderModule } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

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
  onSwipeDown
}) => {
  // Use refs instead of state for better handling in event listeners
  const currentModelIndexRef = useRef(0);
  const modelsRef = useRef<THREE.Group[]>([]);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const instructionsRef = useRef<HTMLDivElement | null>(null);
  
  // Store initial camera position for reset
  const initialCameraPos = useRef(new THREE.Vector3(0, 0, 5));
  const initialModelRotation = useRef(new THREE.Euler(0, 0, 0));
  
  // Define lily stage names (different from lotus)
  const stageNames = ["New Growth", "Bud", "Lily Pad", "Full Bloom"];

  // State to track when models are loaded and current model for React rendering
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [currentModelIndex, setCurrentModelIndex] = useState(0);

  // Add state to track override status
  const [arTestingOverride, setArTestingOverride] = useState(() => {  
    return (window as any).arTestingOverride ?? true;
  });

  // Define isArMode at the component level
  const isArMode = !!(arScene && arCamera && arPosition);

  // Function to change models
  const switchToModel = (index: number) => {
    console.log(`🌸 Switching to lily model index: ${index} (${stageNames[index]})`);
    
    currentModelIndexRef.current = index;
    setCurrentModelIndex(index); // Update React state for button rendering
    
    // Remove all models from the scene
    if (sceneRef.current) {
      modelsRef.current.forEach(model => {
        if (model && sceneRef.current) {
          sceneRef.current.remove(model);
        }
      });
      
      // Add only the current model
      if (modelsRef.current[index]) {
        modelsRef.current[index].rotation.copy(initialModelRotation.current);
        sceneRef.current.add(modelsRef.current[index]);
        
        // Update stage label
        if (instructionsRef.current) {
          instructionsRef.current.innerHTML = `Lily Plant: ${stageNames[index]} (Stage ${index + 1} of 4)`;
        }
        
        console.log(`✅ Now showing: ${stageNames[index]}`);
      }
    }
  };

  // *** FIXED: Register handlers immediately on mount - don't wait for models ***
  useEffect(() => {
    console.log('🔗 Registering lily gesture handlers on mount');
    
    // Rotation handler
    if (onModelRotate) {
      onModelRotate((deltaX: number, deltaY: number) => {
        // console.log('🔄 Rotate called, models available:', modelsRef.current.length);
        const currentModel = modelsRef.current[currentModelIndexRef.current];
        if (currentModel) {
          currentModel.rotation.y += deltaX;
          currentModel.rotation.x += deltaY;
          // console.log('🔄 Model rotated:', currentModel.rotation.x, currentModel.rotation.y);
        } else {
          // console.warn('🔄 No model available to rotate');
        }
      });
      // console.log('✅ Rotation handler registered');
    }

    // Scale handler
    if (onModelScale) {
      onModelScale((scaleFactor: number) => {
        console.log('📏 Scale called, models available:', modelsRef.current.length);
        const currentModel = modelsRef.current[currentModelIndexRef.current];
        if (currentModel) {
          const currentScale = currentModel.scale.x;
          const newScale = Math.max(0.5, Math.min(5.0, currentScale * scaleFactor));
          currentModel.scale.set(newScale, newScale, newScale);
          console.log('📏 Model scaled:', newScale);
        } else {
          console.warn('📏 No model available to scale');
        }
      });
      console.log('✅ Scale handler registered');
    }

    // Reset handler
    if (onModelReset) {
      onModelReset(() => {
        console.log('🔄 Reset called, models available:', modelsRef.current.length);
        const currentModel = modelsRef.current[currentModelIndexRef.current];
        if (currentModel) {
          currentModel.rotation.copy(initialModelRotation.current);
          currentModel.scale.set(2, 2, 2);
          console.log('🔄 Model reset');
        } else {
          console.warn('🔄 No model available to reset');
        }
      });
      console.log('✅ Reset handler registered');
    }

    // Next model handler (swipe up)
    if (onSwipeUp) {
      onSwipeUp(() => {
        console.log('➡️ Lily: Next model called via swipe, models available:', modelsRef.current.length);
        if (modelsRef.current.length > 0) {
          const nextIndex = currentModelIndexRef.current < 3 ? currentModelIndexRef.current + 1 : 0;
          switchToModel(nextIndex);
        } else {
          console.warn('➡️ No models available for switching');
        }
      });
      console.log('✅ Next model handler registered (swipe up)');
    }

    // Previous model handler (swipe down)
    if (onSwipeDown) {
      onSwipeDown(() => {
        console.log('⬅️ Lily: Previous model called via swipe, models available:', modelsRef.current.length);
        if (modelsRef.current.length > 0) {
          const prevIndex = currentModelIndexRef.current > 0 ? currentModelIndexRef.current - 1 : 3;
          switchToModel(prevIndex);
        } else {
          console.warn('⬅️ No models available for switching');
        }
      });
      console.log('✅ Previous model handler registered (swipe down)');
    }
  }, []); // *** FIXED: Empty dependency array - register once on mount

  // Listen for override changes
  useEffect(() => {
    const checkOverride = () => {
      const currentOverride = (window as any).arTestingOverride ?? true;
      if (currentOverride !== arTestingOverride) {
        setArTestingOverride(currentOverride);
        console.log('🎯 LilyExperience override changed:', currentOverride);
        
        const currentModel = modelsRef.current[currentModelIndexRef.current];
        console.log('🎯 Current model:', currentModel);
        console.log('🎯 Is AR mode:', isArMode);
        console.log('🎯 AR position:', arPosition);
        
        if (currentModel && isArMode && arPosition) {
          if (currentOverride) {
            console.log('🎯 Setting override position (0, 0, -5)');
            currentModel.position.set(0, 0, -5);
          } else {
            console.log('🎯 Setting anchor position:', arPosition);
            currentModel.position.copy(arPosition);
          }
          
          // Force visual update
          currentModel.visible = false;
          setTimeout(() => {
            if (currentModel) {
              currentModel.visible = true;
            }
          }, 50);
          
          console.log('🎯 Model position after change:', currentModel.position);
        }
      }
    };
    
    const interval = setInterval(checkOverride, 100);
    return () => clearInterval(interval);
  }, [arTestingOverride, isArMode, arPosition]);

  // Main effect for model loading and scene setup
  useEffect(() => {
    let isMounted = true;
    
    console.log('🎯 LilyExperience mode:', isArMode ? 'AR' : 'Standalone');
    
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
    instructions.style.bottom = '80px'; // Move up to make room for stage buttons
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
    instructions.innerHTML = 'Lily Plant: Loading...';
    container.appendChild(instructions);
    instructionsRef.current = instructions;

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
      console.log('🎯 Using AR scene and camera');
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

    // Define lily model URLs (using the correct file names from your document)
    const lilyModels = [
      getAssetPath('models/Lily_New.glb'),
      getAssetPath('models/Lily_Bud.glb'),
      getAssetPath('models/Lily_Pad.glb'),
      getAssetPath('models/Lily_Bloom.glb')
    ];

    // Create loader
    const loader = new GLTFLoaderModule();
    
    let modelsLoadedCount = 0;
    const totalModels = lilyModels.length;
    
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
    loadingDiv.innerHTML = 'Loading lily models... 0%';
    container.appendChild(loadingDiv);

    // Load all models
    lilyModels.forEach((modelUrl, index) => {
      loader.load(
        modelUrl,
        (gltf) => {
          if (!isMounted) return;

          const model = gltf.scene;
          
          // Center the model
          const box = new THREE.Box3().setFromObject(model);
          const center = box.getCenter(new THREE.Vector3());
          model.position.x = -center.x;
          model.position.y = -center.y;
          model.position.z = -center.z;
          
          // Scale model appropriately for lily - make them bigger
          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          if (maxDim > 0) {
            const scale = (isArMode ? 3 : 10) / maxDim; // *** INCREASED SCALE for lily
            model.scale.set(scale, scale, scale);
          }
          
          // Position based on mode
          if (isArMode && arPosition) {
            const currentOverride = (window as any).arTestingOverride ?? true;
            
            if (currentOverride) {
              model.position.set(0, 0, -5);
              console.log('🎯 Model positioned at TESTING override location:', model.position);
            } else {
              model.position.copy(arPosition);
              console.log('🎯 Model positioned at AR anchor location:', arPosition);
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
          
          // Add to the array of models
          modelsRef.current[index] = model;
          
          // Store the initial rotation
          initialModelRotation.current = model.rotation.clone();
          
          // Update loading progress
          modelsLoadedCount++;
          const percentage = Math.round((modelsLoadedCount / totalModels) * 100);
          loadingDiv.innerHTML = `Loading lily models... ${percentage}%`;
          
          // If all models are loaded, remove the loading div and show first model
          if (modelsLoadedCount === totalModels) {
            container.removeChild(loadingDiv);
            
            // Switch to first model
            switchToModel(0);
            
            setModelsLoaded(true);
            console.log('🎯 All lily models loaded successfully');
          }
          
          console.log(`Loaded lily model ${index}: ${modelUrl}`);
        },
        (xhr) => {
          console.log(`${modelUrl} ${(xhr.loaded / xhr.total) * 100}% loaded`);
        },
        (error) => {
          console.error(`Error loading model ${modelUrl}:`, error);
          modelsLoadedCount++;
          const percentage = Math.round((modelsLoadedCount / totalModels) * 100);
          loadingDiv.innerHTML = `Loading models... ${percentage}%<br>Error loading ${modelUrl.split('/').pop()}`;
        }
      );
    });

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
  }, [isArMode]); // *** FIXED: Only depend on isArMode

  return (
    <>
      {/* Stage Selection Buttons - React JSX */}
      {modelsLoaded && (
        <div style={{
          position: 'absolute',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: '8px',
          zIndex: 1005,
          pointerEvents: 'auto',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          padding: '10px',
          borderRadius: '8px'
        }}>
          {stageNames.map((stageName, index) => (
            <button
              key={index}
              onClick={() => {
                console.log(`🌸 Stage button ${index} clicked: ${stageName}`);
                switchToModel(index);
              }}
              onTouchStart={(e) => {
                e.preventDefault();
                console.log(`🌸 Stage button ${index} touched: ${stageName}`);
                switchToModel(index);
              }}
              style={{
                backgroundColor: index === currentModelIndex 
                  ? 'rgba(255, 105, 180, 0.8)'  // Pink for lily (different from lotus green)
                  : 'rgba(0, 0, 0, 0.7)',
                color: 'white',
                padding: '8px 12px',
                borderRadius: '6px',
                border: index === currentModelIndex 
                  ? '2px solid rgba(255, 182, 193, 0.8)'  // Light pink border
                  : '1px solid rgba(255, 255, 255, 0.3)',
                fontSize: '12px',
                fontFamily: 'var(--font-rigby)',
                cursor: 'pointer',
                minWidth: '60px',
                textAlign: 'center'
              }}
            >
              {/* Stage {index + 1}<br/> */}
              <small>{stageName}</small>
            </button>
          ))}
        </div>
      )}

      {/* Debug Panel for Lily Experience */}
      {/* {SHOW_DEBUG_PANEL &&  (
        <div style={{
          position: 'absolute',
          top: '180px',
          left: '10px',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          color: 'white',
          padding: '10px',
          borderRadius: '4px',
          fontSize: '12px',
          zIndex: 1003,
          pointerEvents: 'auto',
          fontFamily: 'monospace'
        }}>
         
          <div>Mode: {isArMode ? 'AR' : 'Standalone'}</div>
          <div>Models: {modelsRef.current.length}/4 loaded</div>
          <div>Current: {stageNames[currentModelIndex]} (Stage {currentModelIndex + 1})</div>
          
        </div>
      )} */}
    </>
  );
};

export default LilyExperience;