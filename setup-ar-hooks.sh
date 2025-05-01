#!/bin/bash

# Create directory structure
mkdir -p src/hooks/ar

# Create useARScene.ts
cat > src/hooks/ar/useARScene.ts << 'EOF'
import { useEffect, useRef } from 'react';

interface UseARSceneProps {
  markerId: number;
  onMarkerFound?: (id: number) => void;
  onMarkerLost?: () => void;
}

export function useARScene({ markerId, onMarkerFound, onMarkerLost }: UseARSceneProps) {
  const sceneRef = useRef<HTMLDivElement | null>(null);
  
  useEffect(() => {
    if (!sceneRef.current) return;
    
    // Load AR.js and A-Frame if they're not already loaded
    // Note: You may want to handle this differently based on your project setup
    
    // Set up marker detection events once the scene is initialized
    const setupMarkerEvents = () => {
      const marker = document.querySelector(`#marker-${markerId}`);
      if (marker) {
        marker.addEventListener('markerFound', () => {
          if (onMarkerFound) onMarkerFound(markerId);
        });
        
        marker.addEventListener('markerLost', () => {
          if (onMarkerLost) onMarkerLost();
        });
      }
    };
    
    // Initialize AR scene
    // This would typically happen after A-Frame is loaded
    const initARScene = () => {
      // Scene initialization logic here
      setupMarkerEvents();
    };
    
    // Call initialization
    initARScene();
    
    return () => {
      // Clean up event listeners when component unmounts
      const marker = document.querySelector(`#marker-${markerId}`);
      if (marker) {
        marker.removeEventListener('markerFound', () => {
          if (onMarkerFound) onMarkerFound(markerId);
        });
        marker.removeEventListener('markerLost', () => {
          if (onMarkerLost) onMarkerLost();
        });
      }
    };
  }, [markerId, onMarkerFound, onMarkerLost]);
  
  return sceneRef;
}
EOF

# Create useMarkerDetection.ts
cat > src/hooks/ar/useMarkerDetection.ts << 'EOF'
import { useState, useCallback } from 'react';

interface UseMarkerDetectionResult {
  markerDetected: boolean;
  detectedMarkerId: number | null;
  handleMarkerFound: (id: number) => void;
  handleMarkerLost: () => void;
}

export function useMarkerDetection(): UseMarkerDetectionResult {
  const [markerDetected, setMarkerDetected] = useState(false);
  const [detectedMarkerId, setDetectedMarkerId] = useState<number | null>(null);
  
  const handleMarkerFound = useCallback((id: number) => {
    setMarkerDetected(true);
    setDetectedMarkerId(id);
  }, []);
  
  const handleMarkerLost = useCallback(() => {
    setMarkerDetected(false);
    setDetectedMarkerId(null);
  }, []);
  
  return {
    markerDetected,
    detectedMarkerId,
    handleMarkerFound,
    handleMarkerLost
  };
}
EOF

# Create useLocationTracking.ts
cat > src/hooks/ar/useLocationTracking.ts << 'EOF'
import { useState, useEffect, useMemo } from 'react';

interface Location {
  lat: number;
  lon: number;
}

interface UseLocationTrackingResult {
  location: Location | null;
  relativePosition: Location | null;
  locationStatus: 'waiting' | 'available' | 'unavailable';
  error: string | null;
}

export function useLocationTracking(): UseLocationTrackingResult {
  const [location, setLocation] = useState<Location | null>(null);
  const [initialLocation, setInitialLocation] = useState<Location | null>(null);
  const [locationStatus, setLocationStatus] = useState<'waiting' | 'available' | 'unavailable'>('waiting');
  const [error, setError] = useState<string | null>(null);

  // Get location data
  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      position => {
        const newLocation = {
          lat: position.coords.latitude,
          lon: position.coords.longitude
        };
        
        setLocation(newLocation);
        
        // Save initial location for relative positioning
        if (!initialLocation) {
          setInitialLocation(newLocation);
        }
        
        setLocationStatus('available');
        
        // Clear any previous location errors
        if (error && error.includes('Location access failed')) {
          setError(null);
        }
      },
      err => {
        console.error('Error getting location:', err);
        
        if (err.code === 2) { // POSITION_UNAVAILABLE
          setLocationStatus('unavailable');
        } else if (!location) {
          setError('Location access failed. Please check your permissions.');
        }
      },
      { enableHighAccuracy: true, maximumAge: 10000 }
    );

    // Cleanup function to remove the watch when component unmounts
    return () => navigator.geolocation.clearWatch(watchId);
  }, [location, initialLocation, error]);

  // Calculate relative position from initial location
  const relativePosition = useMemo(() => {
    if (!location || !initialLocation) return null;
    
    return {
      lat: location.lat - initialLocation.lat,
      lon: location.lon - initialLocation.lon
    };
  }, [location, initialLocation]);

  return { 
    location, 
    relativePosition, 
    locationStatus, 
    error 
  };
}
EOF

# Create useDeviceOrientation.ts
cat > src/hooks/ar/useDeviceOrientation.ts << 'EOF'
import { useState, useEffect } from 'react';

interface Orientation {
  alpha: number; // Z-axis rotation [0-360)
  beta: number;  // X-axis rotation [-180, 180]
  gamma: number; // Y-axis rotation [-90, 90]
}

interface UseDeviceOrientationResult {
  orientation: Orientation | null;
  error: string | null;
}

export function useDeviceOrientation(): UseDeviceOrientationResult {
  const [orientation, setOrientation] = useState<Orientation | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Function to handle orientation changes
    const handleOrientation = (event: DeviceOrientationEvent) => {
      setOrientation({
        alpha: event.alpha || 0,
        beta: event.beta || 0,
        gamma: event.gamma || 0
      });
    };

    // Request device orientation permission on iOS 13+
    const requestOrientationPermission = async () => {
      if (typeof DeviceOrientationEvent !== 'undefined' &&
          typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
        try {
          const permissionState = await (DeviceOrientationEvent as any).requestPermission();
          if (permissionState === 'granted') {
            window.addEventListener('deviceorientation', handleOrientation);
          } else {
            setError('Orientation permission denied. Some features may not work.');
          }
        } catch (err) {
          console.error('Error requesting orientation permission:', err);
          setError('Failed to request orientation permission.');
        }
      } else {
        // No permission needed for non-iOS or older iOS devices
        window.addEventListener('deviceorientation', handleOrientation);
      }
    };

    // Start requesting permissions and setting up listeners
    requestOrientationPermission();

    // Cleanup when component unmounts
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, []);

  return { orientation, error };
}
EOF

# Create basic component directories
mkdir -p src/components/ar

echo "AR hooks and directories created successfully!"
echo "Next steps:"
echo "1. Create your AR components in src/components/ar/"
echo "2. Set up your AR.js and A-Frame dependencies in your project"
echo "3. Create your experience components for each marker"