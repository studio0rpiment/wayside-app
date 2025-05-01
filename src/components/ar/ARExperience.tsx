import React from 'react';
import { Box, Typography } from '@mui/material';
import ARScene from './ARScene';
import SensorOverlay from './SensorOverlay';
import { useMarkerDetection } from '../../hooks/ar/useMarkerDetection';
import { useLocationTracking } from '../../hooks/ar/useLocationTracking';
import { useDeviceOrientation } from '../../hooks/ar/useDeviceOrientation';

interface ARExperienceProps {
  experienceId: string;
  markerId: number;
  patternUrl?: string;
  instructions?: string;
  children?: React.ReactNode;
  showDebugInfo?: boolean;
  debugMode?: boolean;
}

const ARExperience: React.FC<ARExperienceProps> = ({
  experienceId,
  markerId,
  patternUrl,
  instructions = 'Point your camera at a marker',
  children,
  showDebugInfo = true,
  debugMode = false
}) => {
  const { 
    markerDetected, 
    detectedMarkerId, 
    handleMarkerFound, 
    handleMarkerLost 
  } = useMarkerDetection();
  
  const { location, relativePosition, locationStatus, error: locationError } = useLocationTracking();
  const { orientation, error: orientationError } = useDeviceOrientation();

  return (
    <Box 
      sx={{ 
        position: 'relative', 
        width: '100%', 
        height: '100%',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <ARScene 
        markerId={markerId}
        patternUrl={patternUrl}
        onMarkerFound={handleMarkerFound}
        onMarkerLost={handleMarkerLost}
        debugMode={debugMode}
      >
        {/* AR.js/A-Frame elements will be defined in each experience */}
        {children}
      </ARScene>
      
      {/* Instructions overlay */}
      <Box
        sx={{
          position: 'absolute',
          top: 10,
          left: 10,
          right: 10,
          padding: '0.5rem',
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          color: 'white',
          borderRadius: '0.5rem',
          zIndex: 10
        }}
      >
        <Typography variant="body2">{instructions}</Typography>
      </Box>
      
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
          {detectedMarkerId !== null && (
            <Typography variant="body2">Marker #{detectedMarkerId}</Typography>
          )}
        </Box>
      )}
      
      {/* Debug sensor information */}
      {showDebugInfo && (
        <SensorOverlay 
          location={location}
          relativePosition={relativePosition}
          orientation={orientation}
          locationStatus={locationStatus}
          error={locationError || orientationError}
        />
      )}
    </Box>
  );
};

export default ARExperience;
