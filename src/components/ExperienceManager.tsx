import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import * as THREE from 'three';
import ArCameraComponent from '../components/ar/ArCameraComponent';
import { useSystemOptimization } from '../utils/systemOptimization';
import { MapOutlined } from '@mui/icons-material';

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
   const { startArExperience, endArExperience } = useSystemOptimization();

  const [arInitialized, setArInitialized] = useState(false);
  const [arObjectPosition, setArObjectPosition] = useState<THREE.Vector3 | null>(null);
  const [experienceReady, setExperienceReady] = useState(true);

  const [arScene, setArScene] = useState<THREE.Scene | null>(null);
  const [arCamera, setArCamera] = useState<THREE.PerspectiveCamera | null>(null);

    // Track experience engagement time for completion criteria
  const [experienceStartTime, setExperienceStartTime] = useState<number | null>(null);
  const [hasMetMinimumTime, setHasMetMinimumTime] = useState(false);

  console.log("ExperienceReady Init" , experienceReady)
  
  // Use refs to store the current gesture handlers - this prevents recreation
  const gestureHandlersRef = useRef<{
    rotate?: (deltaX: number, deltaY: number) => void;
    scale?: (scaleFactor: number) => void;
    reset?: () => void;
    swipeUp?: () => void;
    swipeDown?: () => void;
  }>({});

  useEffect(() => {
  console.log('🔄 ExperienceManager effect - checking what changed:', {
    isOpen,
    experienceType,
    userPosition: userPosition?.slice(0, 2),
    anchorPosition: anchorPosition?.slice(0, 2),
    anchorElevation,
    geofenceId
  });
}, [isOpen, experienceType, userPosition, anchorPosition, anchorElevation, geofenceId]);

// ✅ Reset state when modal opens/closes - keep this unchanged
useEffect(() => {
  if (isOpen) {
    setArInitialized(false);
    setArObjectPosition(null);
    setExperienceReady(false);
     setExperienceStartTime(null);
      setHasMetMinimumTime(false);
    gestureHandlersRef.current = {}; // Clear handlers
  }
}, [isOpen]);

// ✅ FIXED: System optimization - prevent the endless loop
useEffect(() => {
  if (isOpen) {
    console.log('🎯 Starting AR experience with system optimization');
    startArExperience(experienceType);
  }
  // ❌ REMOVED: Don't call endArExperience here when isOpen is false
  // This was causing premature cleanup
}, [isOpen]); // ✅ FIXED: Only depend on isOpen, not experienceType

// ✅ NEW: Separate cleanup effect - only runs on component unmount
useEffect(() => {
  return () => {
    console.log('🏁 ExperienceManager unmounting, ending system optimization');
    endArExperience();
  };
}, []); // ✅ No dependencies - only cleanup when component truly unmounts


  // // Start timer when experience becomes ready
  // useEffect(() => {
  //   if (experienceReady && !experienceStartTime) {
  //     const startTime = Date.now();
  //     setExperienceStartTime(startTime);
  //     console.log('⏱️ Experience engagement timer started');
      
  //     // Set minimum time flag after 5 seconds
  //     const timer = setTimeout(() => {
  //       setHasMetMinimumTime(true);
  //       console.log('✅ Minimum engagement time (5s) reached');
  //     }, 5000);
      
  //     return () => clearTimeout(timer);
  //   }
  // }, [experienceReady, experienceStartTime]);
  
  const handleArObjectPlaced = useCallback((position: THREE.Vector3) => {
    console.log('🎯 AR object placed at:', position);
    
    setArObjectPosition(position);
    setArInitialized(true);
    setExperienceReady(true);

    console.log('✅ setExperienceReady(true) called');
  }, []);
  
//  const handleArObjectPlaced = useCallback((position: THREE.Vector3) => {
//   console.log('🎯 AR object placed at:', position);
  
//   // ✅ SIMPLIFIED: Only prevent duplicate calls if position is exactly the same
//   // if (arObjectPosition && arObjectPosition.equals(position)) {
//   //   console.log('🔄 AR object position exactly the same, skipping update');
//   //   return;
//   // }
  
//   // ✅ ALWAYS allow the first position to be set
//   setArObjectPosition(position);
//   setArInitialized(true);
//   setExperienceReady(true);
  
//   // // Auto-start experience after AR is positioned
//   // setTimeout(() => {
//   //   setExperienceReady(true);
//   // }, 1000);
// }, [arObjectPosition]);
  
  // Handler for orientation updates (for debugging)
  const handleOrientationUpdate = useCallback((orientation: { alpha: number; beta: number; gamma: number }) => {
    // Could be used for experience-specific orientation handling
    if (process.env.NODE_ENV === 'development') {
      // Only log occasionally to reduce spam
      if (Math.random() < 0.01) { // 1% chance
        console.log('📱 Device orientation:', orientation);
      }
    }
  }, []);

  const handleExperienceReady = useCallback(() => {
  if (!experienceStartTime) {
    const startTime = Date.now();
    setExperienceStartTime(startTime);
    console.log('⏱️ Experience ready timer started');
  }

     const timer = setTimeout(() => {
      setHasMetMinimumTime(true);
      console.log('✅ Minimum engagement time (5s) reached');
    }, 5000);
}, [experienceStartTime]);

  const handleArSceneReady = useCallback((scene: THREE.Scene, camera: THREE.PerspectiveCamera) => {
    console.log('🎯 AR scene received in ExperienceManager');
    
    // Prevent duplicate calls
    if (arScene === scene && arCamera === camera) {
      console.log('🔄 AR scene unchanged, skipping update');
      return;
    }
    
    setArScene(scene);
    setArCamera(camera);
  }, [arScene, arCamera]);

  // *** FIXED: Stable gesture handlers using useCallback ***
  const handleModelRotate = useCallback((deltaX: number, deltaY: number) => {
    if (gestureHandlersRef.current.rotate) {
      gestureHandlersRef.current.rotate(deltaX, deltaY);
    }
  }, []); // No dependencies - uses ref

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
      
  // Handle experience completion -- checks minimum engagement time
const handleExperienceComplete = useCallback(() => {
  const engagementTime = experienceStartTime ? Date.now() - experienceStartTime : 0;
  
  console.log(`⏱️ Experience completion requested. Engagement time: ${engagementTime}ms (${(engagementTime/1000).toFixed(1)}s)`);
  console.log(`⏱️ hasMetMinimumTime: ${hasMetMinimumTime}, geofenceId: ${geofenceId}`);
  
  // Only mark as complete if minimum time was met
  if (hasMetMinimumTime && geofenceId) {
    console.log(`✅ Experience "${geofenceId}" completed with sufficient engagement time`);
    console.log(`🎯 Calling onExperienceComplete callback`); // ADD THIS LOG


    if (onExperienceComplete) {
      onExperienceComplete();
    }
  } else {
    console.log(`⚠️ Experience closed without meeting minimum engagement time`);
  }
  
  // Always close the experience regardless of completion status
  setTimeout(() => {
    onClose();
  }, 50);
}, [experienceStartTime, hasMetMinimumTime, geofenceId, onExperienceComplete, onClose]);


  //memoizing to prevent reloads
          const experienceProps = useMemo(() => ({
            onClose: handleExperienceComplete,
            onNext: handleExperienceComplete,
            
            arPosition: arObjectPosition ?? undefined, 
            arScene: arScene ?? undefined,          
            arCamera: arCamera ?? undefined, 
            coordinateScale,
            onModelRotate: registerRotateHandler,
            onModelScale: registerScaleHandler,
            onModelReset: registerResetHandler,
            onSwipeUp: registerSwipeUpHandler,
            onSwipeDown: registerSwipeDownHandler,
            onExperienceReady: handleExperienceReady,
          }), [
            arObjectPosition, 
            arScene, 
            arCamera, 
            coordinateScale,
            handleExperienceComplete,
            handleExperienceReady, 
            registerRotateHandler,
            registerScaleHandler,
            registerResetHandler,
            registerSwipeUpHandler,
            registerSwipeDownHandler
          ]);

  
  // Render the appropriate 3D experience
const renderExperience = useCallback(() => {
    // Only render experience if AR is ready and we have a position
    if (!experienceReady || !arObjectPosition) {
      return null;
    }
    
    // Use stable props - no new object creation on each render
    switch (experienceType) {
      case 'cube':
        return <CubeExperience key="cube-experience" {...experienceProps} />;

      case '2030-2105':
        return <WaterRiseExperience key="water-rise-experience" {...experienceProps} />;
      case '1968':
        return <Experience1968 key="1968-experience" {...experienceProps} />
      case '2200_bc':
        return <BC2200Experience key="2200bc-experience" {...experienceProps} />
        
      case 'helen_s':  
        return <HelenSExperience key="helen-experience" {...experienceProps} />;
      case 'volunteers':
        return <VolunteersExperience key="volunteers-experience" {...experienceProps} />;
      case 'mac':
        return <MacExperience key="mac-experience" {...experienceProps} />

      case 'lily':
         return <LilyExperience key="lily-experience" {...experienceProps} />
      case 'cattail':
        return <CattailExperience key="cattail-experience" {...experienceProps} />
      case 'lotus':
        return <LotusExperience key="lotus-experience" {...experienceProps} />
        
      default:
        console.warn(`Unknown experience type: ${experienceType}, defaulting to cube`);
        return <CubeExperience key="default-cube-experience" {...experienceProps} />;
    }
  }, [experienceType, experienceReady, arObjectPosition, experienceProps]);

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
      zIndex: 500, // Above map and modals
      backgroundColor: 'transparent'
    }}>


      {/* AR Camera Component */}
      <ArCameraComponent
        userPosition={userPosition}
        anchorPosition={anchorPosition}
        anchorElevation={anchorElevation}
        coordinateScale={coordinateScale}
        experienceType={experienceType}
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
        onClick={handleExperienceComplete}
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
          zIndex: 2010,
          display: 'flex',
          alignItems: 'center',
          backgroundImage: '',
          justifyContent: 'center'
        }}
      >
           <MapOutlined 
      sx={{ 
        fontSize: '28px', 
        color: 'white', 
        opacity: 0.8 
      }} 
    />
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
          zIndex: 2010,
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

       {/* Engagement Time Indicator (Development Only) */}
      {process.env.NODE_ENV === 'development' && experienceReady && (
        <div style={{
          position: 'absolute',
          bottom: '80px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          color: 'white',
          padding: '8px 12px',
          borderRadius: '4px',
          fontSize: '12px',
          zIndex: 2001,
          fontFamily: 'monospace'
        }}>
          <div>Timer: {experienceStartTime ? `${((Date.now() - experienceStartTime) / 1000).toFixed(1)}s` : 'Not started'}</div>
          <div style={{ color: hasMetMinimumTime ? '#90EE90' : '#FFB6C1' }}>
            Min time: {hasMetMinimumTime ? '✅ Met' : '⏳ 5.0s required'}
          </div>
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