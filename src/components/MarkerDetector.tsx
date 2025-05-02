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
                    
                    // IMPORTANT: We don't remove anything here, just notify the parent
                    document.getElementById('instructions').style.display = 'none';
                    
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
        
        // KEEP THE CAMERA RUNNING - Don't remove the container!
        // Just notify the parent component
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