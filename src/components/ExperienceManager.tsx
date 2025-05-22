import React, { useState, useEffect } from 'react';
import * as THREE from 'three';
import ArCameraComponent from '../components/ar/ArCameraComponent';

// Import all experience components
import CubeExperience from './experiences/CubeExperience';
import WaterRiseExperience from './experiences/WaterRiseExperience';
import LotusExperience from './experiences/LotusExperience';
import MacExperience from './experiences/MacExperience';

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
  
  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setArInitialized(false);
      setArObjectPosition(null);
      setExperienceReady(false);
    }
  }, [isOpen]);
  
  // Handler for when AR object is positioned
  const handleArObjectPlaced = (position: THREE.Vector3) => {
    console.log('🎯 AR object placed at:', position);
    setArObjectPosition(position);
    setArInitialized(true);
    
    // Auto-start experience after AR is positioned
    setTimeout(() => {
      setExperienceReady(true);
    }, 1000); // Small delay for smooth transition
  };
  
  // Handler for orientation updates (for debugging)
  const handleOrientationUpdate = (orientation: { alpha: number; beta: number; gamma: number }) => {
    // Could be used for experience-specific orientation handling
    if (process.env.NODE_ENV === 'development') {
      console.log('📱 Device orientation:', orientation);
    }
  };

  const handleArSceneReady = (scene: THREE.Scene, camera: THREE.PerspectiveCamera) => {
  console.log('🎯 AR scene received in ExperienceManager');
  setArScene(scene);
  setArCamera(camera);
};

    // Update the handlers in ExperienceManager to call the lotus handlers
    const handleModelRotate = (deltaX: number, deltaY: number) => {
      if ((window as any).lotusHandleRotate) {
        (window as any).lotusHandleRotate(deltaX, deltaY);
      }
    };

    const handleModelScale = (scaleFactor: number) => {
      if ((window as any).lotusHandleScale) {
        (window as any).lotusHandleScale(scaleFactor);
      }
    };

    const handleModelReset = () => {
      if ((window as any).lotusHandleReset) {
        (window as any).lotusHandleReset();
      }
    };

    const handleSwipeUp = () => {
      if ((window as any).lotusHandleSwipeUp) {
        (window as any).lotusHandleSwipeUp();
      }
    };

    const handleSwipeDown = () => {
      if ((window as any).lotusHandleSwipeDown) {
        (window as any).lotusHandleSwipeDown();
      }
    };
      
  // Handle experience completion
  const handleExperienceComplete = () => {
    if (onExperienceComplete) {
      onExperienceComplete();
    }
    // Small delay before closing to allow for completion animations
    setTimeout(() => {
      onClose();
    }, 500);
  };
  
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
      onModelRotate: handleModelRotate,
      onModelScale: handleModelScale,
      onModelReset: handleModelReset,
      onSwipeUp: handleSwipeUp,
      onSwipeDown: handleSwipeDown
    };
    
    switch (experienceType) {
      case 'cube':
        return <CubeExperience {...experienceProps} />;

      case 'waterRise':
      case '2030-2105':
        return <WaterRiseExperience {...experienceProps} />;
        
      case 'lotus':
        return <LotusExperience {...experienceProps} />;
   


      case 'mac':
        return <MacExperience {...experienceProps} />;
        
      // Add mappings for your other experience types
      case '1968':
        return <CubeExperience {...experienceProps} />; // Placeholder
        
      case '2200_bc':
        return <CubeExperience {...experienceProps} />; // Placeholder
        
      case 'volunteers':
      case 'helen_s':
      case 'lily':
      case 'cattail':
        return <CubeExperience {...experienceProps} />; // Placeholder
        
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