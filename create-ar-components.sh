#!/bin/bash

# Create AR component files in the src/components/ar directory

# Create ARScene.tsx
cat > src/components/ar/ARScene.tsx << 'EOF'
import React, { useCallback } from 'react';
import { Box } from '@mui/material';
import { useARScene } from '../../hooks/ar/useARScene';

interface ARSceneProps {
  markerId: number;
  onMarkerFound?: (id: number) => void;
  onMarkerLost?: () => void;
  children?: React.ReactNode;
}

const ARScene: React.FC<ARSceneProps> = ({
  markerId,
  onMarkerFound,
  onMarkerLost,
  children
}) => {
  const handleMarkerFound = useCallback((id: number) => {
    if (onMarkerFound) onMarkerFound(id);
  }, [onMarkerFound]);
  
  const handleMarkerLost = useCallback(() => {
    if (onMarkerLost) onMarkerLost();
  }, [onMarkerLost]);

  const sceneRef = useARScene({
    markerId,
    onMarkerFound: handleMarkerFound,
    onMarkerLost: handleMarkerLost
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
      {/* This div will become the container for the A-Frame scene */}
      {/* Children will be A-Frame entities for the specific experience */}
      {children}
    </Box>
  );
};

export default ARScene;
EOF

# Create SensorOverlay.tsx
cat > src/components/ar/SensorOverlay.tsx << 'EOF'
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
EOF

# Create ARExperience.tsx
cat > src/components/ar/ARExperience.tsx << 'EOF'
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
  instructions?: string;
  children?: React.ReactNode;
  showDebugInfo?: boolean;
}

const ARExperience: React.FC<ARExperienceProps> = ({
  experienceId,
  markerId,
  instructions = 'Point your camera at a marker',
  children,
  showDebugInfo = true
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
        onMarkerFound={handleMarkerFound}
        onMarkerLost={handleMarkerLost}
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
EOF

# Create a sample AR experience component template
mkdir -p src/components/experiences

cat > src/components/experiences/DemoExperience.tsx << 'EOF'
import React from 'react';
import ARExperience from '../ar/ARExperience';

/**
 * Demo AR Experience component
 * 
 * This is a template for creating AR experiences that use the
 * ARExperience base component.
 */
const DemoExperience: React.FC = () => {
  return (
    <ARExperience
      experienceId="demo"
      markerId={5}
      instructions="Point your camera at Marker #5 to test AR functionality"
    >
      {/* Define A-Frame entities for this specific experience */}
      {/* 
        Once A-Frame is initialized, these will be added to the scene.
        For example:
        
        <a-box position="0 0.5 0" color="red"></a-box>
        <a-text value="Hello AR!" position="0 1.5 0" align="center"></a-text>
      */}
    </ARExperience>
  );
};

export default DemoExperience;
EOF

echo "AR component files created successfully!"
echo ""
echo "Created components:"
echo "- src/components/ar/ARScene.tsx"
echo "- src/components/ar/SensorOverlay.tsx"
echo "- src/components/ar/ARExperience.tsx"
echo "- src/components/experiences/DemoExperience.tsx (example template)"
echo ""
echo "Next steps:"
echo "1. Install AR.js and A-Frame in your project"
echo "2. Add integration code to useARScene.ts to initialize A-Frame"
echo "3. Create additional experience components based on DemoExperience.tsx template"