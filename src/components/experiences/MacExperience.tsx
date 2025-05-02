import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

// Import these separately to avoid the Vite optimization issue
import { GLTFLoader as GLTFLoaderModule } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

interface McDowneyEraExperienceProps {
  onClose: () => void;
  onNext?: () => void;
}

const MacExperience: React.FC<McDowneyEraExperienceProps> = ({ onClose, onNext }) => {
  // Use refs for better handling in event listeners
  const modelRef = useRef<THREE.Group | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const instructionsRef = useRef<HTMLDivElement | null>(null);
  
  // Touch and double-tap handling refs
  const lastTapTime = useRef(0);
  const doubleTapDelay = 300; // Max milliseconds between taps for a double-tap
  
  // Store initial camera position for reset
  const initialCameraPos = useRef(new THREE.Vector3(0, 0, 2));
  const initialModelRotation = useRef(new THREE.Euler(0, 0, 0));
  
  // Function to reset camera and controls
  const resetView = () => {
    if (cameraRef.current && controlsRef.current) {
      // Reset camera position
      cameraRef.current.position.copy(initialCameraPos.current);
      cameraRef.current.lookAt(0, 0, 0);
      
      // Reset controls
      controlsRef.current.reset();
      
      // Reset model rotation
      if (modelRef.current) {
        modelRef.current.rotation.copy(initialModelRotation.current);
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
    instructions.innerHTML = 'Drag to rotate model. Pinch to zoom. Double-tap to reset view.';
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

    // Define model URL with correct path
    const modelUrl = window.location.origin + '/wayside-app/models/mcdowneyera1.glb';

    // Create loader instance manually to avoid Vite optimization issues
    const loader = new GLTFLoaderModule();
    
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
    loadingDiv.innerHTML = 'Loading model...';
    container.appendChild(loadingDiv);

    // Load the model
    loader.load(
      modelUrl,
      (gltf) => {
        if (!isMounted) return;

        const model = gltf.scene;
        
        // Center the model
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        model.position.x = -center.x - 0.5 ;
        model.position.y = -center.y;
        model.position.z = -center.z;
        
        // Scale model to a reasonable size (scale of 2 as requested)
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
        
        // Store the model reference
        modelRef.current = model;
        
        // Store the initial rotation
        initialModelRotation.current = model.rotation.clone();
        
        // Add model to scene
        scene.add(model);
        
        // Remove loading indicator
        container.removeChild(loadingDiv);
        
        console.log(`Loaded model: ${modelUrl}`);
      },
      (xhr) => {
        console.log(`${modelUrl} ${(xhr.loaded / xhr.total) * 100}% loaded`);
      },
      (error) => {
        console.error(`Error loading model ${modelUrl}:`, error);
        loadingDiv.innerHTML = `Error loading model.<br>Please try again.`;
      }
    );

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
    
    // Handle touch start events for double-tap detection
    const handleTouchStart = (event: TouchEvent) => {
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
    
    // Add event listeners
    window.addEventListener('touchstart', handleTouchStart, { passive: false });
    
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

export default MacExperience;