import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
// Import A-Frame and AR.js
import 'aframe';
import 'aframe-ar';

interface DemoExperienceProps {
  onClose: () => void;
}

const DemoExperience: React.FC<DemoExperienceProps> = ({ onClose }) => {
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
  
  // Create iframe to isolate A-Frame
  useEffect(() => {
    // Create a container outside the React DOM tree
    const container = document.createElement('div');
    container.id = 'ar-portal-container';
    container.style.position = 'fixed';
    container.style.top = '0';
    container.style.left = '0';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.zIndex = '1000';
    document.body.appendChild(container);
    
    // Create an iframe to completely isolate A-Frame
    const iframe = document.createElement('iframe');
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    iframe.allow = 'camera; geolocation; accelerometer; gyroscope; magnetometer';
    container.appendChild(iframe);
    
    // Initialize iframe content after it's loaded
    iframe.onload = () => {
      const iframeDoc = iframe.contentDocument;
      if (!iframeDoc) return;
      
      // Create the A-Frame scene directly in the iframe's DOM
      iframeDoc.body.innerHTML = `
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
        </style>
        <a-scene embedded vr-mode-ui="enabled: false">
          <a-marker type="pattern" url="/marker-patterns/pattern-ar-marker-5.patt">
            <a-box position="0 0.5 0" color="red" scale="0.5 0.5 0.5"></a-box>
            <a-entity animation="property: rotation; to: 0 360 0; loop: true; dur: 2000"></a-entity>
            <a-text value="AR Demo" position="0 1 0" align="center" color="white" scale="0.5 0.5 0.5"></a-text>
          </a-marker>
          <a-entity camera></a-entity>
        </a-scene>
        <button class="close-button" id="close-button">Close AR Demo</button>
        <div class="instructions">Point your camera at Marker #5 to see the AR content</div>
      `;
      
      // Add event listener to close button
      const closeButton = iframeDoc.getElementById('close-button');
      if (closeButton) {
        closeButton.addEventListener('click', () => {
          // Remove the entire portal at once
          if (document.body.contains(container)) {
            document.body.removeChild(container);
          }
          onClose();
        });
      }
    };
    
    // Set the src to a blank page to initialize
    iframe.src = 'about:blank';
    
    setPortalContainer(container);
    
    // Cleanup function
    return () => {
      if (document.body.contains(container)) {
        document.body.removeChild(container);
      }
    };
  }, [onClose]);
  
  // This component doesn't render anything directly
  // All content is in the iframe that's created in the useEffect
  return null;
};

export default DemoExperience;