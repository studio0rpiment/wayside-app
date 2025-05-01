import React, { useCallback } from 'react';
import { Box, CircularProgress } from '@mui/material';
import { useARScene } from '../../hooks/ar/useARScene';

interface ARSceneProps {
  markerId: number;
  onMarkerFound?: (id: number) => void;
  onMarkerLost?: () => void;
  patternUrl?: string;
  debugMode?: boolean;
  children?: React.ReactNode;
}

const ARScene: React.FC<ARSceneProps> = ({
  markerId,
  onMarkerFound,
  onMarkerLost,
  patternUrl,
  debugMode = false,
  children
}) => {
  const handleMarkerFound = useCallback((id: number) => {
    if (onMarkerFound) onMarkerFound(id);
    console.log(`Marker ${id} found!`);
  }, [onMarkerFound]);
  
  const handleMarkerLost = useCallback(() => {
    if (onMarkerLost) onMarkerLost();
    console.log(`Marker lost`);
  }, [onMarkerLost]);

  // Fix: Match the property names from the useARScene hook
  const { sceneRef, isInitialized, error } = useARScene({
    markerId,
    onMarkerFound: handleMarkerFound,
    onMarkerLost: handleMarkerLost,
    patternUrl,
    debugMode
    // Remove children from being passed to useARScene if it doesn't accept them
  });

  return (
    <Box 
      ref={sceneRef}
      sx={{ 
        position: 'relative',
        width: '100%', 
        height: '100%',
        overflow: 'hidden'
      }}
    >
      {/* A-Frame scene will be injected here by useARScene */}
      
      {/* Loading indicator while scene initializes */}
      {!isInitialized && (
        <Box 
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 10
          }}
        >
          <CircularProgress color="primary" />
        </Box>
      )}
      
      {/* Display any error messages */}
      {error && (
        <Box 
          sx={{
            position: 'absolute',
            bottom: 10,
            left: 10,
            right: 10,
            padding: '0.5rem',
            backgroundColor: 'rgba(255, 0, 0, 0.7)',
            color: 'white',
            borderRadius: '0.5rem',
            zIndex: 10
          }}
        >
          Error: {error}
        </Box>
      )}
    </Box>
  );
};

export default ARScene;