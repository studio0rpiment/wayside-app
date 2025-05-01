import React, { useEffect, useRef, useState } from 'react';
import { Box, Typography } from '@mui/material';

interface ARDemoComponentProps {
  markerPatternUrl: string;
}

const ARDemoComponent: React.FC<ARDemoComponentProps> = ({ markerPatternUrl }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [orientation, setOrientation] = useState<{ alpha: number; beta: number; gamma: number } | null>(null);
  const [markerDetected, setMarkerDetected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locationStatus, setLocationStatus] = useState<'waiting'|'available'|'unavailable'>('waiting');

  // Initialize camera
  useEffect(() => {
    if (!videoRef.current) return;

    const initCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          
          // Clear any previous camera errors when we successfully get a stream
          if (error && error.includes('Camera access failed')) {
            setError(null);
          }
        }
      } catch (err) {
        console.error('Error accessing camera:', err);
        setError('Camera access failed. Please check your permissions.');
      }
    };

    initCamera();

    // Cleanup function
    return () => {
      const stream = videoRef.current?.srcObject as MediaStream | null;
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [error]);

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

  // Simulate marker detection (in a real app, this would use AR.js)
  useEffect(() => {
    let detectionInterval: number;
    
    const simulateMarkerDetection = () => {
      // This is a placeholder for real marker detection
      // In a complete implementation, this would use AR.js marker detection
      const randomDetection = Math.random() > 0.7;
      setMarkerDetected(randomDetection);
    };

    detectionInterval = window.setInterval(simulateMarkerDetection, 2000);

    return () => {
      window.clearInterval(detectionInterval);
    };
  }, [markerPatternUrl]);

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
      {/* Camera feed */}
      <Box sx={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
        <video 
          ref={videoRef}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: 'scaleX(-1)'  // Mirror the camera
          }}
          playsInline
          muted
        />
        
        {/* Canvas overlay for AR (would be used with AR.js) */}
        <canvas 
          ref={canvasRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none'
          }}
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
              textAlign: 'center'
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