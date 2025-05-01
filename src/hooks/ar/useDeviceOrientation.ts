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
