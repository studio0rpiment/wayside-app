import React from 'react';
import { Box, Typography } from '@mui/material';

interface Location {
  lat: number;
  lon: number;
}

interface Orientation {
  alpha: number;
  beta: number;
  gamma: number;
}

interface SensorOverlayProps {
  location: Location | null;
  relativePosition: Location | null;
  orientation: Orientation | null;
  locationStatus: 'waiting' | 'available' | 'unavailable';
  error?: string | null;
}

const SensorOverlay: React.FC<SensorOverlayProps> = ({
  location,
  relativePosition,
  orientation,
  locationStatus,
  error
}) => {
  return (
    <Box
      sx={{
        padding: '0.5rem',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        color: 'white',
        fontSize: '0.8rem',
        fontFamily: 'monospace',
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 10
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
      
      {relativePosition && (
        <Typography variant="body2">
          Relative: {`${relativePosition.lat.toFixed(6)}, ${relativePosition.lon.toFixed(6)}`}
        </Typography>
      )}
      
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
  );
};

export default SensorOverlay;
