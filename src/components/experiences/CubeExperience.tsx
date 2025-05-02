import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface CubeExperienceProps {
  onClose: () => void;
  onNext?: () => void;
}

const CubeExperience: React.FC<CubeExperienceProps> = ({ onClose, onNext }) => {
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
    instructions.innerHTML = 'Tap the red cube to continue';
    container.appendChild(instructions);

    // Initialize Three.js components with transparency
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: true,
      premultipliedAlpha: false
    });
    
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0); // Transparent background
    container.appendChild(renderer.domElement);

    // Create our interactive cube (directly in the scene, no video texture plane)
    const geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const cube = new THREE.Mesh(geometry, material);
    cube.position.z = -2;
    scene.add(cube);
    
    // Handle window resize
    const handleResize = () => {
      if (isMounted) {
        // Update camera aspect ratio
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        
        // Update renderer size
        renderer.setSize(window.innerWidth, window.innerHeight);
      }
    };
    
    window.addEventListener('resize', handleResize);
    
    // Set up raycaster for click detection
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    
    // Handle click events
    const handleClick = (event: MouseEvent) => {
      // Calculate mouse position in normalized device coordinates
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
      
      // Update the picking ray with the camera and mouse position
      raycaster.setFromCamera(mouse, camera);
      
      // Calculate objects intersecting the picking ray
      const intersects = raycaster.intersectObject(cube);
      
      if (intersects.length > 0) {
        console.log('Cube clicked!');
        // Change color to green
        (cube.material as THREE.MeshBasicMaterial).color.set(0x00ff00);
        setTimeout(() => {
          if (onNext) {
            onNext(); // This will trigger the navigation
          }
        }, 300);
      }
    };
    
    window.addEventListener('click', handleClick,{ passive: false });
    
    // Handle touch events for mobile
    const handleTouch = (event: TouchEvent) => {
      if (event.touches.length > 0) {
        // Prevent default behavior to avoid scrolling
        event.preventDefault();
        
        // Get touch position
        const touch = event.touches[0];
        
        // Convert touch position to normalized device coordinates
        mouse.x = (touch.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1;
        
        // Update the picking ray
        raycaster.setFromCamera(mouse, camera);
        
        // Check for intersections
        const intersects = raycaster.intersectObject(cube);
        
        if (intersects.length > 0) {
          console.log('Cube touched!');
          // Change color to green
          (cube.material as THREE.MeshBasicMaterial).color.set(0x00ff00);

         

          setTimeout(() => {

            window.location.href = window.location.origin + '/wayside-app/#/map';

            if (onNext) {

              // {getAssetPath('#/map')}

              onNext(); // This will trigger the navigation
            }
          }, 300);
        }
      }
    };
    
    window.addEventListener('touchstart', handleTouch, { passive: false });
    
    // Animation loop
    const animate = function () {
      if (!isMounted) return;
      
      requestAnimationFrame(animate);
      
      // Rotate cube
      cube.rotation.x += 0.01;
      cube.rotation.y += 0.01;
      
      // Render scene
      renderer.render(scene, camera);
    };
    
    animate();
    
    // Cleanup function when component unmounts
    return () => {
      isMounted = false;
      
      // Remove event listeners
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('click', handleClick );
      window.removeEventListener('touchstart', handleTouch );
      
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

export default CubeExperience;