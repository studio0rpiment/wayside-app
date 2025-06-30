// ExperienceManager.tsx - Updated to be the single source of position truth
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import * as THREE from '../../node_modules/@types/three';
import ArCameraComponent from './ar/ArCameraComponent';
import { useSystemOptimization } from '../utils/systemOptimization';
import { useGeofenceContext, PositionQuality } from '../context/GeofenceContext';
import { useARPositioning } from '../hooks/useARPositioning';

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

import MapOutlined from '@mui/icons-material/MapOutlined';

// Define experience types
export type ExperienceType = 'cube' | 'waterRise' | 'lotus' | 'mac' | '2030-2105' | '1968' | '2200_bc' | 'volunteers' | 'helen_s' | 'lily' | 'cattail';

interface ExperienceManagerProps {
  // Modal/overlay props
  isOpen: boolean;
  onClose: () => void;
  
  // Experience data (passed from ExperienceModal)
  experienceType: ExperienceType;
  userPosition?: [number, number]; // Optional manual override for testing
  anchorPosition: [number, number]; // Legacy - only for debug display
  anchorElevation?: number; // Legacy - not used for positioning
  geofenceId?: string;
  coordinateScale?: number; // Legacy - not used for positioning
  isUniversalMode?: boolean; // Optional override - auto-detected if not provided
}

/**
 * Enhanced position hook with FROZEN position capture
 * Captures position ONCE when experience starts and freezes it for the session
 */
function useEnhancedUserPosition(propUserPosition?: [number, number]) {
  const {
    userPosition: rawUserPosition,
    averagedPosition: preciseUserPosition,
    currentAccuracy,
    positionQuality,
    isPositionStable
  } = useGeofenceContext();

  // 🔒 Freeze user position when experience starts
  const frozenUserPositionRef = useRef<[number, number] | null>(null);

  const getBestUserPosition = useCallback((): [number, number] | null => {
    // 🔒 Priority 1: Use frozen position if available
    if (frozenUserPositionRef.current) {
      return frozenUserPositionRef.current;
    }

    // Priority 2: Use prop if provided (manual override for testing)
    if (propUserPosition) {
      return propUserPosition;
    }
    
    // Priority 3: Use averaged position if available (preferred)
    if (preciseUserPosition) {
      return preciseUserPosition;
    }
    
    // Priority 4: Fall back to raw GPS
    if (rawUserPosition) {
      return rawUserPosition;
    }
    
    return null;
  }, [propUserPosition, preciseUserPosition, rawUserPosition]);

  // 🔒 Capture and freeze position when experience starts
  const captureAndFreezePosition = useCallback(() => {
    const currentBestPosition = getBestUserPosition();
    if (currentBestPosition && !frozenUserPositionRef.current) {
      frozenUserPositionRef.current = currentBestPosition;
      console.log('🔒 ExperienceManager: Frozen user position captured:', currentBestPosition);
      return currentBestPosition;
    }
    return frozenUserPositionRef.current;
  }, [getBestUserPosition]);

  // 🔒 Reset frozen position (when experience closes)
  const resetFrozenPosition = useCallback(() => {
    if (frozenUserPositionRef.current) {
      console.log('🔓 ExperienceManager: Resetting frozen position');
      frozenUserPositionRef.current = null;
    }
  }, []);

  return {
    getBestUserPosition,
    currentUserPosition: getBestUserPosition(),
    
    // 🔒 Frozen position management
    captureAndFreezePosition,
    resetFrozenPosition,
    frozenPosition: frozenUserPositionRef.current,
    isFrozen: !!frozenUserPositionRef.current,
    
    // Precision data for debugging
    rawUserPosition,
    preciseUserPosition,
    currentAccuracy,
    positionQuality,
    isPositionStable
  };
}

const ExperienceManager: React.FC<ExperienceManagerProps> = ({
  isOpen,
  onClose,
  experienceType,
  userPosition: propUserPosition,
  anchorPosition,
  anchorElevation = 2.0,
  geofenceId,
  coordinateScale = 1.0,
  isUniversalMode: propIsUniversalMode
}) => {

  const { startArExperience, endArExperience } = useSystemOptimization();
  
  // Enhanced positioning with frozen position capture
  const {
    getBestUserPosition,
    currentUserPosition,
    captureAndFreezePosition,
    resetFrozenPosition,
    frozenPosition,
    isFrozen,
    currentAccuracy,
    positionQuality,
    isPositionStable,
    rawUserPosition,
    preciseUserPosition
  } = useEnhancedUserPosition(propUserPosition);

  // 🆕 Shared AR positioning system - THE SINGLE SOURCE
  const sharedARPositioning = useARPositioning();
const { isReady: positioningReady } = sharedARPositioning || {};


  // 🆕 Universal Mode Detection (auto-detect if not provided)
  const isUniversalMode = useMemo(() => {
    // Use prop override if provided
    if (propIsUniversalMode !== undefined) {
      return propIsUniversalMode;
    }
    
    // Auto-detect Universal Mode conditions
    return (
      process.env.NODE_ENV === 'development' || 
      (window as any).arTestingOverride ||
      !('geolocation' in navigator) ||
      positionQuality === PositionQuality.UNACCEPTABLE ||
      !isFrozen
    );
  }, [propIsUniversalMode, positionQuality, isFrozen]);

  // State management
  const [arInitialized, setArInitialized] = useState(false);
  const [arObjectPosition, setArObjectPosition] = useState<THREE.Vector3 | null>(null); // 🆕 SINGLE SOURCE POSITION
  const [experienceReady, setExperienceReady] = useState(false);
  const [arScene, setArScene] = useState<THREE.Scene | null>(null);
  const [arCamera, setArCamera] = useState<THREE.PerspectiveCamera | null>(null);

  // 🆕 Position calculation state
  const [positionCalculated, setPositionCalculated] = useState(false);

  // Track experience engagement time for completion criteria
  const [experienceStartTime, setExperienceStartTime] = useState<number | null>(null);
  const [hasMetMinimumTime, setHasMetMinimumTime] = useState(false);

  // Use refs to store the current gesture handlers
  const gestureHandlersRef = useRef<{
    rotate?: (deltaX: number, deltaY: number, deltaZ: number) => void;  
    scale?: (scaleFactor: number) => void;
    reset?: () => void;
    swipeUp?: () => void;
    swipeDown?: () => void;
  }>({});

  // Elevation change handler ref
  const elevationChangeHandlerRef = useRef<(() => void) | null>(null);

  // 🔒 Capture position when experience opens
  useEffect(() => {
    if (isOpen && !isFrozen) {
      console.log('🚀 ExperienceManager: Experience opening, capturing position...');
      const capturedPosition = captureAndFreezePosition();
      
      if (capturedPosition) {
        console.log('✅ ExperienceManager: Position captured and frozen for experience session');
      } else {
        console.warn('⚠️ ExperienceManager: No position available to freeze');
      }
    }
  }, [isOpen, isFrozen, captureAndFreezePosition]);

  // 🔒 Reset frozen position when experience closes
  useEffect(() => {
    if (!isOpen && isFrozen) {
      console.log('🔓 ExperienceManager: Experience closing, resetting frozen position');
      resetFrozenPosition();
    }
  }, [isOpen, isFrozen, resetFrozenPosition]);

  // 🆕 Calculate model position ONCE when positioning system and frozen position are ready
  useEffect(() => {
    if (isOpen && frozenPosition && positioningReady && !positionCalculated) {
      console.log('🎯 ExperienceManager: Calculating SINGLE SOURCE model position...');
      
      try {
        // Create user input for positioning system
        const userInput = {
          gpsPosition: frozenPosition,
          isUniversalMode: isUniversalMode
        };
        
        // Get position from positioning system
        const result = sharedARPositioning.getPosition(experienceType);
        
        if (result) {
          const finalModelPosition = result.relativeToUser.clone();
          setArObjectPosition(finalModelPosition); // 🎯 SINGLE SOURCE SET HERE
          setPositionCalculated(true);
          
          console.log('✅ SINGLE SOURCE: Model position calculated and frozen at:', finalModelPosition.toArray());
          console.log('🔒 Position source:', isUniversalMode ? 'UNIVERSAL_MODE' : 'GPS_BASED');
        } else {
          console.error('❌ Failed to get position from positioning system');
        }
      } catch (error) {
        console.error('❌ Error calculating model position:', error);
      }
    }
  }, [isOpen, frozenPosition, positioningReady, positionCalculated, experienceType, isUniversalMode, sharedARPositioning]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setArInitialized(false);
      setArObjectPosition(null); // Reset single source position
      setExperienceReady(false);
      setPositionCalculated(false); // Reset calculation state
      setExperienceStartTime(null);
      setHasMetMinimumTime(false);
      gestureHandlersRef.current = {}; // Clear handlers
      elevationChangeHandlerRef.current = null; // Clear elevation handler
    }
  }, [isOpen]);

  // System optimization
  useEffect(() => {
    if (isOpen) {
      console.log('🎯 Starting AR experience with system optimization');
      startArExperience(experienceType);
    }
  }, [isOpen]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      console.log('🏁 ExperienceManager unmounting, ending system optimization');
      endArExperience();
    };
  }, []);

  // 🆕 NEW: Handle AR scene ready (ArCameraComponent no longer calculates position)
  const handleArSceneReady = useCallback((scene: THREE.Scene, camera: THREE.PerspectiveCamera) => {
    console.log('📡 ExperienceManager: AR scene ready');
    setArScene(scene);
    setArCamera(camera);
    setArInitialized(true);
    
    // If we already calculated the position, we're ready to show experience
    if (arObjectPosition) {
      setExperienceReady(true);
    }
  }, [arObjectPosition]);

  // 🆕 NEW: When both scene and position are ready, enable experience
  useEffect(() => {
    if (arInitialized && arObjectPosition && !experienceReady) {
      console.log('✅ ExperienceManager: Both AR scene and position ready');
      setExperienceReady(true);
    }
  }, [arInitialized, arObjectPosition, experienceReady]);

  // Handler for orientation updates (for debugging)
  const handleOrientationUpdate = useCallback((orientation: { alpha: number; beta: number; gamma: number }) => {
    if (process.env.NODE_ENV === 'development') {
      if (Math.random() < 0.01) { // 1% chance to reduce spam
        console.log('📱 Device orientation:', orientation);
      }
    }
  }, []);

  const handleExperienceReady = useCallback(() => {
  setExperienceStartTime(prevStartTime => {
    if (prevStartTime === null) {
      console.log('⏱️ Experience ready timer started');
      
      setTimeout(() => {
        setHasMetMinimumTime(true);
      }, 5000);
      
      return Date.now();
    }
    return prevStartTime;
  });
}, []); 

  // *** Stable gesture handlers using useCallback ***
  const handleModelRotate = useCallback((deltaX: number, deltaY: number, deltaZ: number = 0) => {
    if (gestureHandlersRef.current.rotate) {
      gestureHandlersRef.current.rotate(deltaX, deltaY, deltaZ);
    }
  }, []);

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

  // Handle elevation changes from ArCameraComponent debug panel
  const handleElevationChanged = useCallback(() => {
    console.log('🧪 ExperienceManager: Elevation changed, triggering experience re-positioning');
    if (elevationChangeHandlerRef.current) {
      elevationChangeHandlerRef.current();
    } else {
      console.warn('🧪 ExperienceManager: No experience handler registered!');
    }
  }, []);

  // *** Registration functions that don't cause re-renders ***
  const registerRotateHandler = useCallback((handler: (deltaX: number, deltaY: number, deltaZ: number) => void) => {
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

  // Register elevation change handler
  const registerElevationChangeHandler = useCallback((handler: () => void) => {
    console.log('🧪 ExperienceManager: Registering elevation change handler');
    elevationChangeHandlerRef.current = handler;
  }, []);
      
  // Handle experience completion
  const handleExperienceComplete = useCallback(() => {
    const engagementTime = experienceStartTime ? Date.now() - experienceStartTime : 0;
    
    console.log(`⏱️ Experience completion requested. Engagement time: ${engagementTime}ms (${(engagementTime/1000).toFixed(1)}s)`);
    
    // Mark as complete if minimum time was met
    if (hasMetMinimumTime && geofenceId) {
      console.log(`✅ Experience "${geofenceId}" completed with sufficient engagement time`);
      document.dispatchEvent(new CustomEvent('experience-completed', {
        detail: { experienceId: geofenceId }
      }));
    } else {
      console.log(`⚠️ Experience closed without meeting minimum engagement time`);
    }
    
    // Always close the experience
    setTimeout(() => {
      onClose();
    }, 50);
  }, [experienceStartTime, hasMetMinimumTime, geofenceId, onClose]);

  // 🆕 Experience props with SINGLE SOURCE position
  const experienceProps = useMemo(() => {
    const baseProps = {
      onClose: handleExperienceComplete,
      onNext: handleExperienceComplete,
      onModelRotate: registerRotateHandler,
      onModelScale: registerScaleHandler,
      onModelReset: registerResetHandler,
      onSwipeUp: registerSwipeUpHandler,
      onSwipeDown: registerSwipeDownHandler,
      onExperienceReady: handleExperienceReady,
      onElevationChanged: registerElevationChangeHandler,
      isUniversalMode: isUniversalMode,
    };

    // 🎯 Only include AR props if we have the SINGLE SOURCE position
    if (arObjectPosition && arScene && arCamera) {
      return {
        ...baseProps,
        arPosition: arObjectPosition, // 🎯 SINGLE SOURCE: Position calculated once in ExperienceManager
        arScene: arScene,
        arCamera: arCamera,
      };
    }

    return baseProps;
  }, [
    arObjectPosition, // 🎯 SINGLE SOURCE
    arScene, 
    arCamera, 
    handleExperienceComplete,
    handleExperienceReady, 
    registerRotateHandler,
    registerScaleHandler,
    registerResetHandler,
    registerSwipeUpHandler,
    registerSwipeDownHandler,
    registerElevationChangeHandler,
    isUniversalMode
  ]);

  // Render the appropriate 3D experience
  const renderExperience = useCallback(() => {
    // Only render experience if we have the SINGLE SOURCE position and AR is ready
    if (!experienceReady || !arObjectPosition || !arScene || !arCamera) {
      return null;
    }
    
    // Ensure we have the required AR props before rendering
    const arProps = {
      ...experienceProps,
      arPosition: arObjectPosition, // 🎯 SINGLE SOURCE
      arScene: arScene,
      arCamera: arCamera,
    };
    
    // Use stable props - no new object creation on each render
    switch (experienceType) {
      case 'cube':
        return <CubeExperience key="cube-experience" {...arProps} />;
      case '2030-2105':
        return <WaterRiseExperience key="water-rise-experience" {...arProps} />;
      case '1968':
        return <Experience1968 key="1968-experience" {...arProps} />
      case '2200_bc':
        return <BC2200Experience key="2200bc-experience" {...arProps} />
      case 'helen_s':  
        return <HelenSExperience key="helen-experience" {...arProps} />;
      case 'volunteers':
        return <VolunteersExperience key="volunteers-experience" {...arProps} />;
      case 'mac':
        return <MacExperience key="mac-experience" {...arProps} />
      case 'lily':
         return <LilyExperience key="lily-experience" {...arProps} />
      case 'cattail':
        return <CattailExperience key="cattail-experience" {...arProps} />
      case 'lotus':
        return <LotusExperience key="lotus-experience" {...arProps} />
      default:
        console.warn(`Unknown experience type: ${experienceType}, defaulting to cube`);
        return <CubeExperience key="default-cube-experience" {...arProps} />;
    }
  }, [experienceType, experienceReady, arObjectPosition, arScene, arCamera, experienceProps]);

  // Don't render anything if not open
  if (!isOpen) {
    return null;
  }

  // Check if we have frozen position OR are in universal mode
  const canStartAr = frozenPosition !== null || isUniversalMode;
  
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

      {/* Show loading state when no position available and not in universal mode */}
      {!canStartAr && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          color: 'white',
          padding: '30px',
          borderRadius: '12px',
          textAlign: 'center',
          zIndex: 2010,
          maxWidth: '80%'
        }}>
          <div style={{ fontSize: '18px', marginBottom: '15px' }}>🎯 Getting GPS position...</div>
          
          <div style={{ fontSize: '14px', marginBottom: '15px' }}>
            Please wait while we locate your device
          </div>
          
          <div style={{ fontSize: '12px', opacity: 0.8 }}>
            Make sure you're outdoors with a clear view of the sky
          </div>
        </div>
      )}

      {/* 🆕 ArCameraComponent - NO LONGER CALCULATES POSITION */}
      {canStartAr && positioningReady && (
        <ArCameraComponent
          userPosition={frozenPosition || undefined} // Pass frozen position for reference
          anchorPosition={anchorPosition} // Legacy - only for debug display
          anchorElevation={anchorElevation} // Legacy
          coordinateScale={coordinateScale} // Legacy
          experienceType={experienceType}
          isUniversalMode={isUniversalMode} // 🆕 Pass universal mode
          // 🚫 REMOVED: onArObjectPlaced - ArCamera no longer calculates position
          onOrientationUpdate={handleOrientationUpdate}
          onSceneReady={handleArSceneReady} // 🆕 Just notifies when scene is ready
          onModelRotate={handleModelRotate}
          onModelScale={handleModelScale}
          onModelReset={handleModelReset}
          onSwipeUp={handleSwipeUp}
          onSwipeDown={handleSwipeDown}
          onElevationChanged={handleElevationChanged}
          sharedARPositioning={sharedARPositioning}//- ArCamera doesn't need it
        />
      )}
      
      {/* Experience Overlay - only render when AR is ready and position calculated */}
      {canStartAr && renderExperience()}
      
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
      
      {/* Loading/Status Overlay with frozen position awareness */}
      {canStartAr && !experienceReady && (
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
              <div>🎥 Starting AR camera...</div>
              {isFrozen && (
                <div style={{ fontSize: '11px', marginTop: '3px', opacity: 0.7, color: '#90EE90' }}>
                  🔒 Position locked to launch location
                </div>
              )}
            </>
          ) : !arObjectPosition ? (
            <>
              <div>🎯 Calculating model position...</div>
              <div style={{ fontSize: '12px', marginTop: '3px', opacity: 0.8 }}>
                {isUniversalMode ? 'Universal Mode' : 'GPS-based positioning'}
              </div>
            </>
          ) : (
            <>
              <div>✅ AR positioned! Starting experience...</div>
            </>
          )}
        </div>
      )}

      {/* Debug info */}
      {/* {process.env.NODE_ENV === 'development' && (
        <div style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          color: 'white',
          padding: '8px',
          borderRadius: '4px',
          fontSize: '10px',
          zIndex: 2010,
          fontFamily: 'monospace'
        }}>
          <div>🎯 ExperienceManager Debug</div>
          <div>Frozen Position: {frozenPosition ? `[${frozenPosition[0].toFixed(6)}, ${frozenPosition[1].toFixed(6)}]` : 'NULL'}</div>
          <div>Model Position: {arObjectPosition ? `[${arObjectPosition.x.toFixed(2)}, ${arObjectPosition.y.toFixed(2)}, ${arObjectPosition.z.toFixed(2)}]` : 'NULL'}</div>
          <div>Universal Mode: {isUniversalMode ? '✅' : '❌'}</div>
          <div>Positioning Ready: {positioningReady ? '✅' : '❌'}</div>
          <div>AR Scene Ready: {arInitialized ? '✅' : '❌'}</div>
          <div>Experience Ready: {experienceReady ? '✅' : '❌'}</div>
        </div>
      )} */}
    </div>
  );
};

export default ExperienceManager;