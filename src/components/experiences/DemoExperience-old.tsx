import React, { useEffect, useState } from 'react';
import * as THREE from 'three';  // Make sure Three.js is imported in your project

interface DemoExperienceProps {
  onClose: () => void;
  markerUrl?: string;
  onNext?: () => void;
}

// A separate component for our Three.js scene
const ThreeJSCube: React.FC<{ onClose: () => void, onNext?: () => void }> = ({ onClose, onNext }) => {
  useEffect(() => {
    // Create a container for the Three.js scene
    const container = document.createElement('div');
    container.id = 'threejs-container';
    container.style.position = 'fixed';
    container.style.top = '0';
    container.style.left = '0';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.zIndex = '1000';
    document.body.appendChild(container);

    // Initialize Three.js scene
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    // Create a red cube
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const cube = new THREE.Mesh(geometry, material);
    scene.add(cube);

    // Position camera
    camera.position.z = 5;

    // Add a close button
    const closeButton = document.createElement('button');
    closeButton.textContent = 'Close';
    closeButton.style.position = 'absolute';
    closeButton.style.top = '20px';
    closeButton.style.right = '20px';
    closeButton.style.padding = '12px 20px';
    closeButton.style.background = 'rgba(255, 255, 255, 0.8)';
    closeButton.style.border = 'none';
    closeButton.style.borderRadius = '5px';
    closeButton.style.fontSize = '16px';
    closeButton.style.cursor = 'pointer';
    closeButton.style.zIndex = '1001';
    
    closeButton.addEventListener('click', () => {
      onClose();
    });
    
    container.appendChild(closeButton);

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
      const intersects = raycaster.intersectObjects([cube]);
      
      if (intersects.length > 0) {
        console.log('Cube clicked!');
        // Change color to green
        (cube.material as THREE.MeshBasicMaterial).color.set(0x00ff00);
        
        // Call onNext if provided
        if (onNext) {
          onNext();
        }
      }
    };
    
    window.addEventListener('click', handleClick);

    // Animation loop
    const animate = function () {
      requestAnimationFrame(animate);
      
      // Rotate cube
      cube.rotation.x += 0.01;
      cube.rotation.y += 0.01;
      
      renderer.render(scene, camera);
    };
    
    animate();

    // Handle window resize
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('click', handleClick);
      window.removeEventListener('resize', handleResize);
      
      // Dispose of Three.js resources
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      
      // Remove container
      if (document.body.contains(container)) {
        document.body.removeChild(container);
      }
    };
  }, [onClose, onNext]);

  return null; // Component doesn't render anything, it manipulates DOM directly
};

// Main component that handles marker detection
const DemoExperience: React.FC<DemoExperienceProps> = ({ 
  onClose,
  markerUrl = window.location.origin + '/wayside-app/marker-patterns/pattern-ar-marker-4.patt',
  onNext
}) => {
  const [markerDetected, setMarkerDetected] = useState(false);

  useEffect(() => {
    if (markerDetected) {
      // We already detected the marker, no need to continue AR detection
      return;
    }

    console.log("DemoExperience mounted - creating AR container");
    
    // Create container for the AR experience
    const container = document.createElement('div');
    container.id = 'ar-container';
    container.style.position = 'fixed';
    container.style.top = '0';
    container.style.left = '0';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.zIndex = '1000';
    document.body.appendChild(container);
    
    // Create the AR content as an iframe to fully isolate it
    const iframe = document.createElement('iframe');
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    iframe.allow = 'camera; geolocation; accelerometer; gyroscope; magnetometer';
    container.appendChild(iframe);
    
    // Wait for the iframe to load
    iframe.onload = () => {
      const doc = iframe.contentDocument;
      if (!doc) return;
      
      // Create a simple HTML document with AR.js for marker detection only
      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <style>
              body { margin: 0; overflow: hidden; }
              .loading {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                background-color: rgba(0, 0, 0, 0.8);
                color: white;
                font-size: 18px;
                flex-direction: column;
                z-index: 9999;
              }
              .spinner {
                border: 5px solid rgba(255, 255, 255, 0.3);
                border-radius: 50%;
                border-top: 5px solid white;
                width: 40px;
                height: 40px;
                margin-bottom: 20px;
                animation: spin 1s linear infinite;
              }
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            </style>
            
            <!-- Loading A-Frame -->
            <script src="https://aframe.io/releases/1.3.0/aframe.min.js"></script>
            
            <!-- Loading AR.js -->
            <script src="https://raw.githack.com/AR-js-org/AR.js/master/aframe/build/aframe-ar.js"></script>
          </head>
          <body>
            <!-- Loading indicator -->
            <div class="loading" id="loading">
              <div class="spinner"></div>
              <div>Looking for marker...</div>
            </div>
            
            <!-- A-Frame scene - just for marker detection -->
            <a-scene 
              embedded 
              arjs="sourceType: webcam; debugUIEnabled: false;"
              vr-mode-ui="enabled: false"
              renderer="logarithmicDepthBuffer: true; precision: medium;"
            >
              <!-- Camera -->
              <a-entity camera look-controls></a-entity>
              
              <!-- Marker that will trigger our Three.js scene -->
              <a-marker 
                id="ar-marker" 
                type="pattern" 
                url="${markerUrl}"
                emitevents="true"
              ></a-marker>
            </a-scene>
            
            <script>
              // Remove loading screen when camera is ready
              document.addEventListener('DOMContentLoaded', function() {
                const scene = document.querySelector('a-scene');
                const loading = document.getElementById('loading');
                
                if (scene && loading) {
                  scene.addEventListener('loaded', function() {
                    console.log('Scene loaded');
                    loading.style.display = 'none';
                  });
                  
                  // Fallback timeout
                  setTimeout(function() {
                    if (loading.style.display !== 'none') {
                      console.log('Timeout: removing loading screen');
                      loading.style.display = 'none';
                    }
                  }, 2000);
                }
                
                // Setup marker detection - this is the key part
                const marker = document.getElementById('ar-marker');
                
                if (marker) {
                  marker.addEventListener('markerFound', function() {
                    console.log('Marker found!');
                    
                    // Send message to parent window that marker was found
                    window.parent.postMessage('marker-found', '*');
                  });
                }
              });
            </script>
          </body>
        </html>
      `);
      doc.close();
    };
    
    // Set iframe source to trigger load
    iframe.src = 'about:blank';
    
    // Listen for messages from the iframe
    const handleMessage = (event: MessageEvent) => {
      if (event.data === 'marker-found') {
        console.log('Marker found message received from iframe');
        
        // Clean up AR container
        if (document.body.contains(container)) {
          document.body.removeChild(container);
        }
        
        // Switch to Three.js scene
        setMarkerDetected(true);
      }
    };
    
    window.addEventListener('message', handleMessage);
    
    // Cleanup function
    return () => {
      window.removeEventListener('message', handleMessage);
      if (document.body.contains(container)) {
        document.body.removeChild(container);
      }
    };
  }, [markerUrl, markerDetected]);
  
  // Render Three.js scene if marker has been detected
  return markerDetected ? (
    <ThreeJSCube onClose={onClose} onNext={onNext} />
  ) : null;
};

export default DemoExperience;