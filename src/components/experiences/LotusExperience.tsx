import React, { useEffect, useState, useRef } from 'react';
import * as THREE from 'three';

// Import these separately to avoid the Vite optimization issue
import { GLTFLoader as GLTFLoaderModule } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

interface LotusExperienceProps {
  onClose: () => void;
  onNext?: () => void;
}

const LotusExperience: React.FC<LotusExperienceProps> = ({ onClose, onNext }) => {
  // Use refs instead of state for better handling in event listeners
  const currentModelIndexRef = useRef(0);
  const modelsRef = useRef<THREE.Group[]>([]);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const instructionsRef = useRef<HTMLDivElement | null>(null);
  
  // Touch and double-tap handling refs
  const touchStartY = useRef(0);
  const touchEndY = useRef(0);
  const lastTapTime = useRef(0);
  const minSwipeDistance = 50; // Minimum distance for a swipe in pixels
  const doubleTapDelay = 300; // Max milliseconds between taps for a double-tap
  
  // Store initial camera position for reset
  const initialCameraPos = useRef(new THREE.Vector3(0, 0, 2));
  const initialModelRotation = useRef(new THREE.Euler(0, 0, 0));
  
  // Define stage names
  const stageNames = ["Seed Pod", "New Pod", "Bloom", "Fully Grown"];
  
  // Function to change models - defined outside the main useEffect
  const switchToModel = (index: number) => {
    console.log(`Switching to model index: ${index}`);
    
    // Store the new index
    currentModelIndexRef.current = index;
    
    // Remove all models from the scene
    if (sceneRef.current) {
      modelsRef.current.forEach(model => {
        if (model && sceneRef.current) {
          sceneRef.current.remove(model);
        }
      });
      
      // Add only the current model
      if (modelsRef.current[index]) {
        // Reset model rotation when switching
        modelsRef.current[index].rotation.copy(initialModelRotation.current);
        sceneRef.current.add(modelsRef.current[index]);
        
        // Update stage label
        if (instructionsRef.current) {
          instructionsRef.current.innerHTML = `Lotus Plant: ${stageNames[index]}`;
        }
      }
    }
  };
  
  // Function to reset camera and controls
  const resetView = () => {
    if (cameraRef.current && controlsRef.current) {
      // Reset camera position
      cameraRef.current.position.copy(initialCameraPos.current);
      cameraRef.current.lookAt(0, 0, 0);
      
      // Reset controls
      controlsRef.current.reset();
      
      // Reset current model rotation
      const currentModel = modelsRef.current[currentModelIndexRef.current];
      if (currentModel) {
        currentModel.rotation.copy(initialModelRotation.current);
      }
      
      console.log("View reset to initial position");
    }
  };
  
  useEffect(() => {
    // Create reference to track if component is mounted
    let isMounted = true;
    
    // Create container for the Three.js scene
    const container = document.createElement('div');
    container.id = 'threejs-container';
    container.style.position = 'fixed';
    container.style.top = '0';
    container.style.left = '0';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.zIndex = '1001'; // Above the AR.js scene
    document.body.appendChild(container);

    // Create instructions div
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
    instructions.style.zIndex = '1002'; // Above the Three.js scene
    instructions.innerHTML = 'Swipe up for next stage, down for previous. Double-tap to reset view.';
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

        window.location.href = window.location.origin + '/wayside-app/#/map';


      if (onNext) {
        onNext();
      }
    };
    
    continueButton.addEventListener('touchstart', () => {
        if (onNext) {
          window.location.href = window.location.origin + '/wayside-app/#/map';
          onNext();
        }
      }, { passive: false });
    container.appendChild(continueButton);

    // Initialize Three.js components with transparency
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.copy(initialCameraPos.current);
    cameraRef.current = camera;
    
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: true,
      premultipliedAlpha: false
    });
    
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0); // Transparent background
    container.appendChild(renderer.domElement);

    // Add OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;
    controls.screenSpacePanning = false;
    controls.minDistance = 0.5;
    controls.maxDistance = 10;
    controls.maxPolarAngle = Math.PI / 1.5;
    controls.target.set(0, 0, 0);
    controlsRef.current = controls;

    // Add lighting to the scene
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 1).normalize();
    scene.add(directionalLight);

    // Define lotus model URLs with correct paths
    const lotusModels = [
      window.location.origin + '/wayside-app/models/Lotus_SeedPod.glb',
      window.location.origin + '/wayside-app/models/Lotus_NewPod.glb',
      window.location.origin + '/wayside-app/models/Lotus_Bloom.glb',
      window.location.origin + '/wayside-app/models/Lotus_Grown.glb'
    ];

    // Create loader instance manually to avoid Vite optimization issues
    const loader = new GLTFLoaderModule();
    
    // Track loading progress
    let modelsLoaded = 0;
    const totalModels = lotusModels.length;
    
    // Create a loading indicator
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
    loadingDiv.innerHTML = 'Loading models... 0%';
    container.appendChild(loadingDiv);

    // Load all models
    lotusModels.forEach((modelUrl, index) => {
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
          
          // Scale model to a reasonable size (changed to 2 as requested)
          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          if (maxDim > 0) {
            const scale = 2 / maxDim; // Initial scale of 2
            model.scale.set(scale, scale, scale);
          }
          
          // Initial position
          model.position.z = -0.5; // Moved closer to camera for better visibility
          
          // Make all materials transparent
          model.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              if (child.material) {
                // Handle array of materials
                if (Array.isArray(child.material)) {
                  child.material.forEach(material => {
                    material.transparent = true;
                    material.opacity = 1.0;
                    material.alphaTest = 0.5;
                    material.side = THREE.DoubleSide;
                  });
                } else {
                  // Handle single material
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
          modelsLoaded++;
          const percentage = Math.round((modelsLoaded / totalModels) * 100);
          loadingDiv.innerHTML = `Loading models... ${percentage}%`;
          
          // If all models are loaded, remove the loading div
          if (modelsLoaded === totalModels) {
            container.removeChild(loadingDiv);
            
            // Show the first model
            switchToModel(0);
          }
          
          console.log(`Loaded model ${index}: ${modelUrl}`);
        },
        (xhr) => {
          console.log(`${modelUrl} ${(xhr.loaded / xhr.total) * 100}% loaded`);
        },
        (error) => {
          console.error(`Error loading model ${modelUrl}:`, error);
          // Update loading indicator even on error
          modelsLoaded++;
          const percentage = Math.round((modelsLoaded / totalModels) * 100);
          loadingDiv.innerHTML = `Loading models... ${percentage}%<br>Error loading ${modelUrl.split('/').pop()}`;
        }
      );
    });

    // Handle window resize
    const handleResize = () => {
      if (isMounted && camera) {
        // Update camera aspect ratio
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        
        // Update renderer size
        renderer.setSize(window.innerWidth, window.innerHeight);
      }
    };
    
    window.addEventListener('resize', handleResize);
    
    // Handle touch start events
    const handleTouchStart = (event: TouchEvent) => {
      touchStartY.current = event.touches[0].clientY;
      
      // Check for double-tap
      const now = new Date().getTime();
      const timeSince = now - lastTapTime.current;
      
      if (timeSince < doubleTapDelay && timeSince > 0) {
        // Double tap detected
        resetView();
        event.preventDefault();
      }
      
      lastTapTime.current = now;
    };
    
    // Handle touch end events for swipe detection
    const handleTouchEnd = (event: TouchEvent) => {
      touchEndY.current = event.changedTouches[0].clientY;
      const deltaY = touchStartY.current - touchEndY.current;
      
      // Only handle swipe if it's a significant vertical swipe
      if (Math.abs(deltaY) > minSwipeDistance) {
        // Vertical swipe detected
        if (deltaY > 0) {
          // Swipe up - next model
          console.log('Swipe up detected!');
          const nextIndex = currentModelIndexRef.current < 3 ? currentModelIndexRef.current + 1 : 0;
          switchToModel(nextIndex);
          
          event.preventDefault();
        } else {
          // Swipe down - previous model
          console.log('Swipe down detected!');
          const prevIndex = currentModelIndexRef.current > 0 ? currentModelIndexRef.current - 1 : 3;
          switchToModel(prevIndex);
          
          event.preventDefault();
        }
      }
    };
    
    // Add event listeners
    window.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('touchend', handleTouchEnd, { passive: false });
    
    // Animation loop
    const animate = function () {
      if (!isMounted) return;
      
      requestAnimationFrame(animate);
      
      // Update controls
      if (controls) {
        controls.update();
      }
      
      // Render scene
      renderer.render(scene, camera);
    };
    
    animate();
    
    // Cleanup function when component unmounts
    return () => {
      isMounted = false;
      
      // Remove event listeners
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
      
      // Dispose of OrbitControls
      if (controls) {
        controls.dispose();
      }
      
      // Clean up Three.js resources
      renderer.dispose();
      
      // Remove container
      if (document.body.contains(container)) {
        document.body.removeChild(container);
      }
    };
  }, [onClose, onNext]);

  return null; // Component renders nothing directly
};

export default LotusExperience;