#!/bin/bash

# Create directory structure if it doesn't exist
mkdir -p src/components/experiences

# Create ExperienceManager.tsx
cat > src/components/ExperienceManager.tsx << 'EOL'
import React, { useState } from 'react';
import MarkerDetector from './MarkerDetector';
import CubeExperience from './experiences/CubeExperience';

interface ExperienceManagerProps {
  experienceType: string;
  onClose: () => void;
  onNext?: () => void;
  markerUrl?: string;
}

const ExperienceManager: React.FC<ExperienceManagerProps> = ({
  experienceType,
  onClose,
  onNext,
  markerUrl = window.location.origin + '/wayside-app/marker-patterns/pattern-ar-marker-4.patt'
}) => {
  const [markerDetected, setMarkerDetected] = useState(false);

  // Handler for when marker is detected
  const handleMarkerDetected = () => {
    console.log('Marker detected! Switching to experience');
    setMarkerDetected(true);
  };

  // Render different experiences based on type
  const renderExperience = () => {
    switch (experienceType) {
      case 'cube':
        return <CubeExperience onClose={onClose} onNext={onNext} />;
      // Add more cases for other experiences here
      default:
        return <CubeExperience onClose={onClose} onNext={onNext} />;
    }
  };

  // If marker not detected yet, show detector
  if (!markerDetected) {
    return (
      <MarkerDetector 
        onMarkerDetected={handleMarkerDetected} 
        markerUrl={markerUrl} 
      />
    );
  }

  // Show the appropriate experience based on type
  return renderExperience();
};

export default ExperienceManager;
EOL

# Create MarkerDetector.tsx
cat > src/components/MarkerDetector.tsx << 'EOL'
import React, { useEffect } from 'react';

interface MarkerDetectorProps {
  onMarkerDetected: () => void;
  markerUrl: string;
}

const MarkerDetector: React.FC<MarkerDetectorProps> = ({ 
  onMarkerDetected,
  markerUrl 
}) => {
  useEffect(() => {
    console.log("MarkerDetector mounted - creating AR container");
    
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
      
      // Create a complete HTML document with the correct AR.js imports
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
              .instructions {
                position: absolute;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
                padding: 10px 20px;
                background-color: rgba(0, 0, 0, 0.7);
                color: white;
                border-radius: 5px;
                text-align: center;
                z-index: 1001;
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
            
            <!-- Instructions -->
            <div class="instructions" id="instructions">
              Point your camera at the marker
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
                    
                    // Update instructions
                    document.getElementById('instructions').textContent = 'Marker detected!';
                    
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
        
        // Notify parent component
        onMarkerDetected();
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
  }, [markerUrl, onMarkerDetected]);
  
  // Component doesn't render anything directly
  return null;
};

export default MarkerDetector;
EOL

# Create CubeExperience.tsx
cat > src/components/experiences/CubeExperience.tsx << 'EOL'
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface CubeExperienceProps {
  onClose: () => void;
  onNext?: () => void;
}

const CubeExperience: React.FC<CubeExperienceProps> = ({ onClose, onNext }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  
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
    container.style.zIndex = '1000';
    document.body.appendChild(container);

    // Add close button
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

    // Initialize Three.js components
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0); // Transparent background
    container.appendChild(renderer.domElement);

    // Set up camera video background
    const video = document.createElement('video');
    videoRef.current = video;
    video.style.display = 'none';
    container.appendChild(video);
    
    // Access camera
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      const constraints = { video: { facingMode: 'environment' } };
      
      navigator.mediaDevices.getUserMedia(constraints)
        .then(function(stream) {
          // Apply the stream to the video element
          video.srcObject = stream;
          video.play();
          
          // Create video texture
          const videoTexture = new THREE.VideoTexture(video);
          
          // Create a plane for the video background
          const videoGeometry = new THREE.PlaneGeometry(2, 2);
          const videoMaterial = new THREE.MeshBasicMaterial({ 
            map: videoTexture,
            side: THREE.DoubleSide,
            depthTest: false,
            depthWrite: false
          });
          
          const videoMesh = new THREE.Mesh(videoGeometry, videoMaterial);
          videoMesh.position.z = -1;
          
          // Create a separate scene for background
          const bgScene = new THREE.Scene();
          const bgCamera = new THREE.Camera();
          bgScene.add(videoMesh);
          
          // Now create our interactive cube
          const geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
          const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
          const cube = new THREE.Mesh(geometry, material);
          cube.position.z = -2;
          scene.add(cube);
          
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
              
              // Call onNext if provided
              if (onNext) {
                onNext();
              }
            }
          };
          
          window.addEventListener('click', handleClick);
          
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
                
                // Call onNext if provided
                if (onNext) {
                  onNext();
                }
              }
            }
          };
          
          window.addEventListener('touchstart', handleTouch);
          
          // Animation loop
          const animate = function () {
            if (!isMounted) return;
            
            requestAnimationFrame(animate);
            
            // Rotate cube
            cube.rotation.x += 0.01;
            cube.rotation.y += 0.01;
            
            // Render background first
            renderer.autoClear = true;
            renderer.render(bgScene, bgCamera);
            
            // Then render scene without clearing
            renderer.autoClear = false;
            renderer.render(scene, camera);
          };
          
          animate();
          
          // Cleanup function (extended)
          return () => {
            window.removeEventListener('click', handleClick);
            window.removeEventListener('touchstart', handleTouch);
            
            // Stop video stream
            if (video.srcObject) {
              (video.srcObject as MediaStream).getTracks().forEach(track => {
                track.stop();
              });
            }
          };
        })
        .catch(function(error) {
          console.error('Unable to access the camera/webcam: ', error);
        });
    }
    
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
    
    // Cleanup function when component unmounts
    return () => {
      isMounted = false;
      
      // Remove event listener
      window.removeEventListener('resize', handleResize);
      
      // Stop video stream if it exists
      if (videoRef.current && videoRef.current.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => {
          track.stop();
        });
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

export default CubeExperience;
EOL

# Create a simple integration file to replace DemoExperience.tsx
cat > src/components/DemoExperience.tsx << 'EOL'
import React from 'react';
import ExperienceManager from './ExperienceManager';

interface DemoExperienceProps {
  onClose: () => void;
  markerUrl?: string;
  onNext?: () => void;
}

// This is a wrapper component for backward compatibility
const DemoExperience: React.FC<DemoExperienceProps> = ({ 
  onClose,
  markerUrl,
  onNext
}) => {
  return (
    <ExperienceManager
      experienceType="cube"
      onClose={onClose}
      onNext={onNext}
      markerUrl={markerUrl}
    />
  );
};

export default DemoExperience;
EOL

echo "Created the following files:"
echo "- src/components/ExperienceManager.tsx"
echo "- src/components/MarkerDetector.tsx"
echo "- src/components/experiences/CubeExperience.tsx"
echo "- src/components/DemoExperience.tsx (wrapper for backward compatibility)"
echo ""
echo "Don't forget to install Three.js with:"
echo "npm install three@0.164.0 @types/three"