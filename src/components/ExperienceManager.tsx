import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as THREE from 'three';
import ArCameraComponent from '../components/ar/ArCameraComponent';

// Import all experience components
import CubeExperience from './experiences/CubeExperience';
import WaterRiseExperience from './experiences/WaterRiseExperience';
import Experience1968 from './experiences/Experience1968';
import BC2200Experience from './experiences/BC2200Experience';
import HelenSExperience from './experiences/HelenSExperience';
import VolunteersExperience from './experiences/VolunteersExperience';
import MacExperience from './experiences/MacExperience';
import LilyExperience from './experiences/LilyExperience';
import CattailExperience from './experiences/CattailExperience';
import LotusExperience from './experiences/LotusExperience';

// Define experience types (same as before)
export type ExperienceType = 'cube' | 'waterRise' | 'lotus' | 'mac' | '2030-2105' | '1968' | '2200_bc' | 'volunteers' | 'helen_s' | 'lily' | 'cattail';

interface ExperienceManagerProps {
  // Modal/overlay props
  isOpen: boolean;
  onClose: () => void;
  
  // Experience data (passed from ExperienceModal)
  experienceType: ExperienceType;
  userPosition: [number, number];
  anchorPosition: [number, number];
  anchorElevation?: number;
  geofenceId?: string;
  
  // Optional customization
  coordinateScale?: number;
  onExperienceComplete?: () => void;
}

const ExperienceManager: React.FC<ExperienceManagerProps> = ({
  isOpen,
  onClose,
  experienceType,
  userPosition,
  anchorPosition,
  anchorElevation = 2.0,
  geofenceId,
  coordinateScale = 1.0,
  onExperienceComplete
}) => {
  const [arInitialized, setArInitialized] = useState(false);
  const [arObjectPosition, setArObjectPosition] = useState<THREE.Vector3 | null>(null);
  const [experienceReady, setExperienceReady] = useState(false);

  const [arScene, setArScene] = useState<THREE.Scene | null>(null);
  const [arCamera, setArCamera] = useState<THREE.PerspectiveCamera | null>(null);
  
  // Use refs to store the current gesture handlers - this prevents recreation
  const gestureHandlersRef = useRef<{
    rotate?: (deltaX: number, deltaY: number) => void;
    scale?: (scaleFactor: number) => void;
    reset?: () => void;
    swipeUp?: () => void;
    swipeDown?: () => void;
  }>({});
  
  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setArInitialized(false);
      setArObjectPosition(null);
      setExperienceReady(false);
      gestureHandlersRef.current = {}; // Clear handlers
    }
  }, [isOpen]);
  
  // Handler for when AR object is positioned
  const handleArObjectPlaced = useCallback((position: THREE.Vector3) => {
    console.log('🎯 AR object placed at:', position);
    setArObjectPosition(position);
    setArInitialized(true);
    
    // Auto-start experience after AR is positioned
    setTimeout(() => {
      setExperienceReady(true);
    }, 1000);
  }, []);
  
  // Handler for orientation updates (for debugging)
  const handleOrientationUpdate = useCallback((orientation: { alpha: number; beta: number; gamma: number }) => {
    // Could be used for experience-specific orientation handling
    if (process.env.NODE_ENV === 'development') {
      console.log('📱 Device orientation:', orientation);
    }
  }, []);

  const handleArSceneReady = useCallback((scene: THREE.Scene, camera: THREE.PerspectiveCamera) => {
    console.log('🎯 AR scene received in ExperienceManager');
    setArScene(scene);
    setArCamera(camera);
  }, []);

  // *** FIXED: Stable gesture handlers using useCallback ***
  const handleModelRotate = useCallback((deltaX: number, deltaY: number) => {
    if (gestureHandlersRef.current.rotate) {
      gestureHandlersRef.current.rotate(deltaX, deltaY);
    }
  }, []); // Empty deps - this function never changes

  const handleModelScale = useCallback((scaleFactor: number) => {
    if (gestureHandlersRef.current.scale) {
      gestureHandlersRef.current.scale(scaleFactor);
    }
  }, []);

  const handleModelReset = useCallback(() => {
    if (gestureHandlersRef.current.reset) {
      gestureHandlersRef.current.reset();
    }
  }, []);

  const handleSwipeUp = useCallback(() => {
    if (gestureHandlersRef.current.swipeUp) {
      gestureHandlersRef.current.swipeUp();
    }
  }, []);

  const handleSwipeDown = useCallback(() => {
    if (gestureHandlersRef.current.swipeDown) {
      gestureHandlersRef.current.swipeDown();
    }
  }, []);

  // *** FIXED: Registration functions that don't cause re-renders ***
  const registerRotateHandler = useCallback((handler: (deltaX: number, deltaY: number) => void) => {
    gestureHandlersRef.current.rotate = handler;
  }, []);

  const registerScaleHandler = useCallback((handler: (scaleFactor: number) => void) => {
    gestureHandlersRef.current.scale = handler;
  }, []);

  const registerResetHandler = useCallback((handler: () => void) => {
    gestureHandlersRef.current.reset = handler;
  }, []);

  const registerSwipeUpHandler = useCallback((handler: () => void) => {
    gestureHandlersRef.current.swipeUp = handler;
  }, []);

  const registerSwipeDownHandler = useCallback((handler: () => void) => {
    gestureHandlersRef.current.swipeDown = handler;
  }, []);
      
  // Handle experience completion
  const handleExperienceComplete = useCallback(() => {
    if (onExperienceComplete) {
      onExperienceComplete();
    }
    // Small delay before closing to allow for completion animations
    setTimeout(() => {
      onClose();
    }, 500);
  }, [onExperienceComplete, onClose]);
  
  // Render the appropriate 3D experience
  const renderExperience = () => {
    // Only render experience if AR is ready and we have a position
    if (!experienceReady || !arObjectPosition) {
      return null;
    }
    
    // Pass AR position to experiences that need it
    const experienceProps = {
      onClose: handleExperienceComplete,
      onNext: handleExperienceComplete,
      arPosition: arObjectPosition, 
      arScene: arScene ?? undefined,          
      arCamera: arCamera ?? undefined, 
      coordinateScale,
      onModelRotate: registerRotateHandler,
      onModelScale: registerScaleHandler,
      onModelReset: registerResetHandler,
      onSwipeUp: registerSwipeUpHandler,
      onSwipeDown: registerSwipeDownHandler
    };
    
    switch (experienceType) {
      case 'cube':
        return <CubeExperience {...experienceProps} />;

      case '2030-2105':
        return <WaterRiseExperience {...experienceProps} />;
      case '1968':
        return <Experience1968 {...experienceProps} />
      case '2200_bc':
        return <BC2200Experience {...experienceProps} />
        
      case 'helen_s':  
        return <HelenSExperience {...experienceProps} />;
      case 'volunteers':
        return <VolunteersExperience {...experienceProps} />;
      case 'mac':
        return <MacExperience {...experienceProps} />

      case 'lily':
         return <LilyExperience {...experienceProps} />
      case 'cattail':
        return <CattailExperience {...experienceProps} />
      case 'lotus':
        return <LotusExperience {...experienceProps} />
        
      default:
        console.warn(`Unknown experience type: ${experienceType}, defaulting to cube`);
        return <CubeExperience {...experienceProps} />;
    }
  };
  
  // Don't render anything if not open
  if (!isOpen) {
    return null;
  }
  
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      zIndex: 2000, // Above map and modals
      backgroundColor: 'transparent'
    }}>
      {/* AR Camera Component */}
      <ArCameraComponent
        userPosition={userPosition}
        anchorPosition={anchorPosition}
        anchorElevation={anchorElevation}
        coordinateScale={coordinateScale}
        onArObjectPlaced={handleArObjectPlaced}
        onOrientationUpdate={handleOrientationUpdate}
        onSceneReady={handleArSceneReady} 
        onModelRotate={handleModelRotate}
        onModelScale={handleModelScale}
        onModelReset={handleModelReset}
        onSwipeUp={handleSwipeUp}
        onSwipeDown={handleSwipeDown}
      />
      
      {/* Experience Overlay */}
      {renderExperience()}
      
      {/* Close Button */}
      <button
        onClick={onClose}
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          color: 'white',
          border: 'none',
          fontSize: '18px',
          cursor: 'pointer',
          zIndex: 2001,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        ×
      </button>
      
      {/* Loading/Status Overlay */}
      {!experienceReady && (
        <div style={{
          position: 'absolute',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          color: 'white',
          padding: '12px 20px',
          borderRadius: '8px',
          textAlign: 'center',
          zIndex: 2001,
          fontSize: '14px'
        }}>
          {!arInitialized ? (
            <>
              <div>🎯 Positioning AR experience...</div>
              <div style={{ fontSize: '12px', marginTop: '5px', opacity: 0.8 }}>
                Point your camera at your surroundings
              </div>
            </>
          ) : (
            <>
              <div>✅ AR positioned! Starting experience...</div>
            </>
          )}
        </div>
      )}
      
      {/* Debug Info (Development Only) */}
      {/* {process.env.NODE_ENV === 'development' && (
        <div style={{
          position: 'absolute',
          top: '70px',
          left: '10px',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          color: 'white',
          padding: '10px',
          borderRadius: '4px',
          fontSize: '11px',
          zIndex: 2001,
          fontFamily: 'monospace',
          maxWidth: '200px'
        }}>
          <div><strong>AR Debug:</strong></div>
          <div>Type: {experienceType}</div>
          <div>Geofence: {geofenceId || 'N/A'}</div>
          <div>User: [{userPosition[0].toFixed(6)}, {userPosition[1].toFixed(6)}]</div>
          <div>Anchor: [{anchorPosition[0].toFixed(6)}, {anchorPosition[1].toFixed(6)}]</div>
          <div>Elevation: {anchorElevation}m</div>
          <div>Scale: {coordinateScale}x</div>
          <div>AR Ready: {arInitialized ? '✅' : '⏳'}</div>
          <div>Experience: {experienceReady ? '✅' : '⏳'}</div>
        </div>
      )} */}
    </div>
  );
};

export default ExperienceManager;