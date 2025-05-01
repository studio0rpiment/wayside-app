import { useEffect, useRef, useState } from 'react';

// Define types for A-Frame global
declare global {
  interface Window {
    AFRAME: any;
  }
}

interface UseARSceneProps {
  markerId: number;
  onMarkerFound?: (id: number) => void;
  onMarkerLost?: () => void;
  patternUrl?: string;
  debugMode?: boolean;
}

interface UseARSceneResult {
  sceneRef: React.RefObject<HTMLDivElement | null>;
  isInitialized: boolean;
  error: string | null;
}

export function useARScene({
  markerId,
  onMarkerFound,
  onMarkerLost,
  patternUrl,
  debugMode = false
}: UseARSceneProps): UseARSceneResult {
  const sceneRef = useRef<HTMLDivElement>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sceneRef.current) return;

    let cleanup: (() => void) | null = null;
    let marker: HTMLElement | null = null;
    let scene: HTMLElement | null = null;

    const initARScene = async () => {
      // Store the current ref in a variable for guaranteed non-null access within this scope
      const currentSceneRef = sceneRef.current;
      if (!currentSceneRef) return;

      try {
        // Check if A-Frame is available
        if (typeof window.AFRAME === 'undefined') {
          throw new Error('A-Frame not found. Make sure A-Frame and AR.js are imported.');
        }

        // Clear any existing content
        while (currentSceneRef.firstChild) {
          currentSceneRef.removeChild(currentSceneRef.firstChild);
        }

        // Create A-Frame scene
        scene = document.createElement('a-scene');
        scene.setAttribute('embedded', '');
        scene.setAttribute('vr-mode-ui', 'enabled: false');

        // Add AR.js configuration
        const arjsParams = [
          'sourceType: webcam',
          'videoTexture: true',
          `debugUIEnabled: ${debugMode}`,
          'detectionMode: mono_and_matrix',
          'matrixCodeType: 3x3',
          'patternRatio: 0.75'
        ].join('; ');
        
        scene.setAttribute('arjs', arjsParams);

        // Create marker
        marker = document.createElement('a-marker');
        marker.id = `marker-${markerId}`;

        // Set marker attributes
        if (patternUrl) {
          marker.setAttribute('type', 'pattern');
          marker.setAttribute('url', patternUrl);
          console.log(`Using custom pattern: ${patternUrl}`);
        } else {
          // Use marker by ID if no pattern provided
          marker.setAttribute('preset', 'hiro');
          console.log('Using default Hiro marker');
        }

        // Add a simple default entity inside marker
        const box = document.createElement('a-box');
        box.setAttribute('position', '0 0.5 0');
        box.setAttribute('material', 'color: blue');
        box.setAttribute('animation', 'property: rotation; to: 0 360 0; loop: true; dur: 3000');
        marker.appendChild(box);

        // Add label
        const text = document.createElement('a-text');
        text.setAttribute('value', `Marker #${markerId}`);
        text.setAttribute('position', '0 1.25 0');
        text.setAttribute('align', 'center');
        text.setAttribute('color', 'white');
        marker.appendChild(text);

        // Create camera entity
        const camera = document.createElement('a-entity');
        camera.setAttribute('camera', '');

        // Add components to the scene
        scene.appendChild(marker);
        scene.appendChild(camera);

        // Add scene to DOM
        currentSceneRef.appendChild(scene);

        // Set up event listeners for marker detection
        const handleMarkerFoundEvent = () => {
          console.log(`Marker #${markerId} found`);
          if (onMarkerFound) onMarkerFound(markerId);
        };

        const handleMarkerLostEvent = () => {
          console.log(`Marker #${markerId} lost`);
          if (onMarkerLost) onMarkerLost();
        };

        marker.addEventListener('markerFound', handleMarkerFoundEvent);
        marker.addEventListener('markerLost', handleMarkerLostEvent);

        // Define cleanup function
        cleanup = () => {
          if (marker) {
            marker.removeEventListener('markerFound', handleMarkerFoundEvent);
            marker.removeEventListener('markerLost', handleMarkerLostEvent);
          }
          
          // Use the stored ref variable for cleanup
          const currentRef = sceneRef.current;
          if (currentRef && scene && currentRef.contains(scene)) {
            currentRef.removeChild(scene);
          }
          
          console.log('AR scene cleaned up');
        };

        setIsInitialized(true);
        console.log('AR scene initialized successfully');
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error initializing AR scene';
        console.error('AR initialization error:', errorMessage);
        setError(errorMessage);
      }
    };

    // Start initialization
    initARScene();

    // Clean up on unmount
    return () => {
      if (cleanup) cleanup();
    };
  }, [markerId, patternUrl, debugMode, onMarkerFound, onMarkerLost]);

  return { sceneRef, isInitialized, error };
}