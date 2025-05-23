import React, { useEffect, useState, useRef } from 'react';
import * as THREE from 'three';
import { getAssetPath } from '../../utils/assetPaths';

// Import these separately to avoid the Vite optimization issue
import { GLTFLoader as GLTFLoaderModule } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';


interface SingleModelExperienceProps {
  onClose: () => void;
  onNext?: () => void;
  arPosition?: THREE.Vector3;
  arScene?: THREE.Scene;
  arCamera?: THREE.PerspectiveCamera;
  coordinateScale?: number;
  // Keep gesture handlers for ExperienceManager compatibility - just don't use them
  onModelRotate?: (handler: (deltaX: number, deltaY: number) => void) => void;
  onModelScale?: (handler: (scaleFactor: number) => void) => void;
  onModelReset?: (handler: () => void) => void;
  onSwipeUp?: (handler: () => void) => void;
  onSwipeDown?: (handler: () => void) => void;
  
  // Configuration props
  modelPath: string;
  experienceName: string;
  instructions?: string;
}

const SingleModelExperience: React.FC<SingleModelExperienceProps> = ({ 
  onClose, 
  onNext,
  arPosition,
  arScene,
  arCamera,
  coordinateScale = 1.0,
  modelPath,
  experienceName,
  instructions = "Explore the 3D model. Tap continue when ready.",
  // Accept gesture props for compatibility but don't use them
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
  const instructionsRef = useRef<HTMLDivElement | null>(null);
  
  // Store initial camera position for reset
  const initialCameraPos = useRef(new THREE.Vector3(0, 0, 5));
  const initialModelRotation = useRef(new THREE.Euler(0, 0, 0));
  
  // State to track override status
  const [arTestingOverride, setArTestingOverride] = useState(() => {  
    return (window as any).arTestingOverride ?? true;
  });

  // State to track when model is loaded
  const [modelLoaded, setModelLoaded] = useState(false);

  // Define isArMode at the component level
  const isArMode = !!(arScene && arCamera && arPosition);

  // Gesture handlers commented out for now - will add back when gesture system is fixed
  /*
  const handleRotateModel = (deltaX: number, deltaY: number) => {
    if (modelRef.current) {
      modelRef.current.rotation.y += deltaX;
      modelRef.current.rotation.x += deltaY;
      console.log('🔄 Model rotated:', modelRef.current.rotation.x, modelRef.current.rotation.y);
    }
  };

  const handleScaleModel = (scaleFactor: number) => {
    if (modelRef.current) {
      const newScale = Math.max(0.5, Math.min(5.0, scaleFactor));
      modelRef.current.scale.set(newScale, newScale, newScale);
      console.log('📏 Model scaled:', newScale);
    }
  };

  const handleResetModel = () => {
    if (modelRef.current) {
      modelRef.current.rotation.copy(initialModelRotation.current);
      modelRef.current.scale.set(1, 1, 1);
      console.log('🔄 Model reset');
    }
  };
  */

  // Listen for override changes
  useEffect(() => {
    const checkOverride = () => {
      const currentOverride = (window as any).arTestingOverride ?? true;
      if (currentOverride !== arTestingOverride) {
        setArTestingOverride(currentOverride);
        console.log(`🎯 ${experienceName} override changed:`, currentOverride);
        
        if (modelRef.current && isArMode && arPosition) {
          if (currentOverride) {
            console.log('🎯 Setting override position (0, 0, -5)');
            modelRef.current.position.set(0, 0, -5);
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
  }, [arTestingOverride, isArMode, arPosition, experienceName]);

  // Main effect for model loading and scene setup
  useEffect(() => {
    let isMounted = true;
    
    console.log(`🎯 ${experienceName} mode:`, isArMode ? 'AR' : 'Standalone');
    
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
    const instructionsDiv = document.createElement('div');
    instructionsDiv.style.position = 'absolute';
    instructionsDiv.style.bottom = '20px';
    instructionsDiv.style.left = '50%';
    instructionsDiv.style.transform = 'translateX(-50%)';
    instructionsDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    instructionsDiv.style.color = 'white';
    instructionsDiv.style.padding = '12px 20px';
    instructionsDiv.style.borderRadius = '8px';
    instructionsDiv.style.textAlign = 'center';
    instructionsDiv.style.fontFamily = 'var(--font-rigby)';
    instructionsDiv.style.fontWeight = '400';
    instructionsDiv.style.zIndex = '1002';
    instructionsDiv.innerHTML = instructions;
    container.appendChild(instructionsDiv);
    instructionsRef.current = instructionsDiv;

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
      console.log(`🎯 ${experienceName} using AR scene and camera`);
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
    loadingDiv.innerHTML = `Loading ${experienceName}...`;
    container.appendChild(loadingDiv);

    // Load the model
    const fullModelPath = getAssetPath(modelPath);
    console.log(`🎯 Loading model: ${fullModelPath}`);

    loader.load(
      fullModelPath,
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
            model.position.set(0, 0, -5);
            console.log(`🎯 ${experienceName} positioned at TESTING override location:`, model.position);
          } else {
            model.position.copy(arPosition);
            console.log(`🎯 ${experienceName} positioned at AR anchor location:`, arPosition);
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
        
        // Store the initial rotation
        initialModelRotation.current = model.rotation.clone();
        
        // Add model to scene
        scene.add(model);
        
        // Remove loading indicator
        container.removeChild(loadingDiv);
        
        // Set model loaded state
        setModelLoaded(true);
        
        console.log(`✅ ${experienceName} model loaded successfully`);
      },
      (xhr) => {
        console.log(`${fullModelPath} ${(xhr.loaded / xhr.total) * 100}% loaded`);
      },
      (error) => {
        console.error(`❌ Error loading ${experienceName} model:`, error);
        if (container.contains(loadingDiv)) {
          loadingDiv.innerHTML = `Error loading ${experienceName}<br>Model file may be missing`;
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
    
    // Animation loop
    const animate = function () {
      if (!isMounted) return;
      
      requestAnimationFrame(animate);
      
      if (controls) {
        controls.update();
      }
      
      if (renderer) {
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
      
      setModelLoaded(false);
    };
  }, [isArMode]); // Only depend on isArMode

  return null;
};

export default SingleModelExperience;