import React, { useEffect, useRef, useState } from 'react';
import { Box, Typography } from '@mui/material';

interface ARDemoComponentProps {
  markerPatternUrl: string;
}

const ARDemoComponent: React.FC<ARDemoComponentProps> = ({ markerPatternUrl }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [orientation, setOrientation] = useState<{ alpha: number; beta: number; gamma: number } | null>(null);
  const [markerDetected, setMarkerDetected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locationStatus, setLocationStatus] = useState<'waiting'|'available'|'unavailable'>('waiting');

  // Listen for messages from the iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data === 'markerFound') {
        console.log('Marker found message received from iframe');
        setMarkerDetected(true);
      } else if (event.data === 'markerLost') {
        console.log('Marker lost message received from iframe');
        setMarkerDetected(false);
      }
    };

    window.addEventListener('message', handleMessage);
    
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  // Get location data
  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      position => {
        setLocation({
          lat: position.coords.latitude,
          lon: position.coords.longitude
        });
        setLocationStatus('available');
        // Clear any previous location errors once we get a successful position
        if (error && error.includes('Location access failed')) {
          setError(null);
        }
      },
      err => {
        console.error('Error getting location:', err);
        
        // Handle different geolocation error codes
        if (err.code === 2) { // POSITION_UNAVAILABLE
          // This is common when testing indoors or in simulators
          setLocationStatus('unavailable');
        } else if (!location) {
          // For other errors, only show if we don't have any location data yet
          setError('Location access failed. Please check your permissions.');
        }
      },
      { enableHighAccuracy: true, maximumAge: 10000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [location, error]);

  // Get device orientation
  useEffect(() => {
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
        }
      } else {
        // No permission needed for non-iOS or older iOS
        window.addEventListener('deviceorientation', handleOrientation);
      }
    };

    requestOrientationPermission();

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, []);

  return (
    <Box 
      ref={containerRef}
      sx={{ 
        position: 'relative', 
        width: '100%', 
        height: '100%',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {/* AR scene in an iframe */}
      <Box sx={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
        <iframe
          ref={iframeRef}
          src="/ar-scene.html"
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            overflow: 'hidden'
          }}
          allow="camera; geolocation; accelerometer; gyroscope; magnetometer"
          allowFullScreen
          title="AR Experience"
        />

        {/* Marker detection indicator */}
        {markerDetected && (
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              padding: '1rem',
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              color: 'white',
              borderRadius: '0.5rem',
              textAlign: 'center',
              pointerEvents: 'none',
              zIndex: 1000
            }}
          >
            <Typography variant="h6">Marker Detected!</Typography>
            <Typography variant="body2">AR.js Marker Pattern 5</Typography>
          </Box>
        )}
      </Box>

      {/* Sensor data display */}
      <Box
        sx={{
          padding: '0.5rem',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          color: 'white',
          fontSize: '0.8rem',
          fontFamily: 'monospace'
        }}
      >
        <Typography variant="body2">
          Location: {
            locationStatus === 'available' && location 
              ? `${location.lat.toFixed(6)}, ${location.lon.toFixed(6)}` 
              : locationStatus === 'unavailable' 
                ? "Unavailable indoors" 
                : "Waiting..."
          }
          {error && error.includes("Location") && (
            <Box component="span" sx={{ color: 'var(--color-pink)', ml: 1, fontSize: '0.7rem' }}>
              (Check permissions)
            </Box>
          )}
        </Typography>
        
        <Typography variant="body2">
          Orientation: {orientation 
            ? `α:${orientation.alpha.toFixed(1)}° β:${orientation.beta.toFixed(1)}° γ:${orientation.gamma.toFixed(1)}°` 
            : "Waiting..."}
          {error && error.includes("Orientation") && (
            <Box component="span" sx={{ color: 'var(--color-pink)', ml: 1, fontSize: '0.7rem' }}>
              (Check permissions)
            </Box>
          )}
        </Typography>
      </Box>

      {/* Instructions */}
      <Box
        sx={{
          position: 'absolute',
          top: 10,
          left: 10,
          right: 10,
          padding: '0.5rem',
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          color: 'white',
          borderRadius: '0.5rem'
        }}
      >
        <Typography variant="body2">
          Point your camera at Marker #5 to test AR functionality
        </Typography>
      </Box>
    </Box>
  );
};

export default ARDemoComponent;