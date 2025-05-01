import React, { useEffect, useState } from 'react';

interface DemoExperienceProps {
  onClose: () => void;
  markerUrl?: string; // Optional, for custom marker URL
}

const DemoExperience: React.FC<DemoExperienceProps> = ({ 
  onClose, 
  markerUrl = window.location.origin + '/wayside-app/marker-patterns/pattern-ar-marker-4.patt'
}) => {
  useEffect(() => {
    console.log("DemoExperience mounted - creating AR container");
    console.log("Using marker URL:", markerUrl);
    
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
              .close-button {
                position: absolute;
                top: 20px;
                right: 20px;
                z-index: 1001;
                padding: 12px 20px;
                background: rgba(255, 255, 255, 0.8);
                border: none;
                border-radius: 5px;
                font-size: 16px;
                cursor: pointer;
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
              <div>Initializing camera...</div>
            </div>
            
            <!-- A-Frame scene -->
            <a-scene 
              embedded 
              arjs="sourceType: webcam; debugUIEnabled: false;"
              vr-mode-ui="enabled: false"
              renderer="logarithmicDepthBuffer: true; precision: medium;"
            >
              <!-- Using dual markers - both Hiro and your custom marker -->
              <a-marker preset="hiro">
                <a-box position="0 0.5 0" color="red" scale="0.5 0.5 0.5">
                  <a-animation attribute="rotation" to="0 360 0" dur="2000" repeat="indefinite" easing="linear"></a-animation>
                </a-box>
                <a-text value="Hiro Marker" position="0 1.25 0" align="center" color="white" scale="0.8 0.8 0.8"></a-text>
              </a-marker>
              
              <a-marker type="pattern" url="${markerUrl}">
                <a-box position="0 0.5 0" color="blue" scale="0.5 0.5 0.5">
                  <a-animation attribute="rotation" to="0 360 0" dur="2000" repeat="indefinite" easing="linear"></a-animation>
                </a-box>
                <a-text value="Custom Marker" position="0 1.25 0" align="center" color="white" scale="0.8 0.8 0.8"></a-text>
              </a-marker>
              
              <a-entity camera></a-entity>
            </a-scene>
            
            <!-- Close button -->
            <button class="close-button" id="close-button">Close</button>
            
            <!-- Instructions -->
            <div class="instructions">
              Point your camera at either marker to see AR content
            </div>
            
            <script>
              // Handle close button click
              document.getElementById('close-button').addEventListener('click', function() {
                window.parent.postMessage('close-ar', '*');
              });
              
              // Remove loading screen when camera is ready
              document.addEventListener('DOMContentLoaded', function() {
                // Get the scene and loading element
                const scene = document.querySelector('a-scene');
                const loading = document.getElementById('loading');
                
                if (scene && loading) {
                  // Listen for camera setup
                  scene.addEventListener('camera-set-active', function() {
                    console.log('Camera is active');
                    loading.style.display = 'none';
                  });
                  
                  // Fallback: Remove loading after a timeout (5 seconds)
                  setTimeout(function() {
                    if (loading.style.display !== 'none') {
                      console.log('Timeout: removing loading screen');
                      loading.style.display = 'none';
                    }
                  }, 5000);
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
      if (event.data === 'close-ar') {
        if (document.body.contains(container)) {
          document.body.removeChild(container);
        }
        onClose();
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
  }, [onClose, markerUrl]);
  
  // This component doesn't render anything in the React tree
  return null;
};

export default DemoExperience;