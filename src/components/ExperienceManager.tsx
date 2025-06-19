// ExperienceManager.tsx - Enhanced with precision positioning
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import * as THREE from 'three';
import ArCameraComponent from '../components/ar/ArCameraComponent';
import { useSystemOptimization } from '../utils/systemOptimization';
import { useGeofenceContext, useGeofencePrecision, PositionQuality } from '../context/GeofenceContext';

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

// Define experience types (same as before)
export type ExperienceType = 'cube' | 'waterRise' | 'lotus' | 'mac' | '2030-2105' | '1968' | '2200_bc' | 'volunteers' | 'helen_s' | 'lily' | 'cattail';

interface ExperienceManagerProps {
  // Modal/overlay props
  isOpen: boolean;
  onClose: () => void;
  
  // Experience data (passed from ExperienceModal)
  experienceType: ExperienceType;
  userPosition?: [number, number]; // ✅ NOW OPTIONAL - enhanced context provides better position
  anchorPosition: [number, number];
  anchorElevation?: number;
  geofenceId?: string;
  
  // Optional customization
  coordinateScale?: number;
}

/**
 * Enhanced position hook that leverages your useEnhancedGeofenceManager
 * Provides intelligent fallback and the same logic as ArCameraComponent
 */
function useEnhancedUserPosition(propUserPosition?: [number, number]) {
  const {
    userPosition: rawUserPosition,
    averagedPosition: preciseUserPosition,
    currentAccuracy,
    positionQuality,
    isPositionStable
  } = useGeofenceContext();

  const getBestUserPosition = useCallback((): [number, number] | null => {
    // Priority 1: Use prop if provided (manual override for testing)
    if (propUserPosition) {
      return propUserPosition;
    }
    
    // Priority 2: Use averaged position if stable and accurate (≤10m)
    if (preciseUserPosition && isPositionStable && 
        currentAccuracy && currentAccuracy <= 10) {
      return preciseUserPosition;
    }
    
    // Priority 3: Use averaged position if accuracy is acceptable (≤15m)
    if (preciseUserPosition && currentAccuracy && currentAccuracy <= 15) {
      return preciseUserPosition;
    }
    
    // Priority 4: Fall back to raw GPS (which is already filtered by enhanced manager)
    if (rawUserPosition) {
      return rawUserPosition;
    }
    
    return null;
  }, [propUserPosition, preciseUserPosition, rawUserPosition, currentAccuracy, isPositionStable]);

  return {
    getBestUserPosition,
    currentUserPosition: getBestUserPosition(),
    // Expose precision data for debugging
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
  userPosition: propUserPosition, // Keep as prop for manual override
  anchorPosition,
  anchorElevation = 2.0,
  geofenceId,
  coordinateScale = 1.0,
}) => {

  const { startArExperience, endArExperience } = useSystemOptimization();
  
  // ✅ NEW: Use enhanced positioning with your geofence context
  const {
    getBestUserPosition,
    currentUserPosition,
    currentAccuracy,
    positionQuality,
    isPositionStable,
    rawUserPosition,
    preciseUserPosition
  } = useEnhancedUserPosition(propUserPosition);

  // State management (unchanged)
  const [arInitialized, setArInitialized] = useState(false);
  const [arObjectPosition, setArObjectPosition] = useState<THREE.Vector3 | null>(null);
  const [experienceReady, setExperienceReady] = useState(true);
  const [arScene, setArScene] = useState<THREE.Scene | null>(null);
  const [arCamera, setArCamera] = useState<THREE.PerspectiveCamera | null>(null);

  // Track experience engagement time for completion criteria
  const [experienceStartTime, setExperienceStartTime] = useState<number | null>(null);
  const [hasMetMinimumTime, setHasMetMinimumTime] = useState(false);

  // Use refs to store the current gesture handlers - this prevents recreation
  const gestureHandlersRef = useRef<{
    rotate?: (deltaX: number, deltaY: number, deltaZ: number) => void;  
    scale?: (scaleFactor: number) => void;
    reset?: () => void;
    swipeUp?: () => void;
    swipeDown?: () => void;
  }>({});

  // ✅ Enhanced effect: Log when position source changes
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const source = propUserPosition ? 'PROP_OVERRIDE' : 
                    (preciseUserPosition && isPositionStable) ? 'ENHANCED_STABLE' :
                    preciseUserPosition ? 'ENHANCED_AVERAGED' :
                    rawUserPosition ? 'RAW_GPS' : 'NO_POSITION';
      
      console.log('🎯 ExperienceManager position source:', {
        source,
        position: currentUserPosition,
        accuracy: currentAccuracy?.toFixed(1) + 'm',
        quality: positionQuality,
        stable: isPositionStable
      });
    }
  }, [currentUserPosition, currentAccuracy, positionQuality, isPositionStable, propUserPosition, preciseUserPosition, rawUserPosition]);

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

  // ✅ System optimization - prevent the endless loop
  useEffect(() => {
    if (isOpen) {
      console.log('🎯 Starting AR experience with system optimization');
      startArExperience(experienceType);
    }
  }, [isOpen]); // ✅ Only depend on isOpen, not experienceType

  // ✅ Separate cleanup effect - only runs on component unmount
  useEffect(() => {
    return () => {
      console.log('🏁 ExperienceManager unmounting, ending system optimization');
      endArExperience();
    };
  }, []); // ✅ No dependencies - only cleanup when component truly unmounts

  const handleArObjectPlaced = useCallback((position: THREE.Vector3) => {
    console.log('🎯 AR object placed at:', position);
    setArObjectPosition(position);
    setArInitialized(true);
    setExperienceReady(true);
  }, []);
  
  // Handler for orientation updates (for debugging)
  const handleOrientationUpdate = useCallback((orientation: { alpha: number; beta: number; gamma: number }) => {
    if (process.env.NODE_ENV === 'development') {
      if (Math.random() < 0.01) { // 1% chance to reduce spam
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
    }, 5000);
  }, [experienceStartTime]);

  const handleArSceneReady = useCallback((scene: THREE.Scene, camera: THREE.PerspectiveCamera) => {
    // Prevent duplicate calls
    if (arScene === scene && arCamera === camera) {
      return;
    }
    
    setArScene(scene);
    setArCamera(camera);
  }, [arScene, arCamera]);

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
      
  // Handle experience completion -- checks minimum engagement time
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

  // ✅ Enhanced experience props with position quality info
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

  // ✅ Enhanced: Don't start AR until we have a reasonable position
  const canStartAr = currentUserPosition !== null;
  
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

      {/* Enhanced loading state - show position quality */}
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
          <div style={{ fontSize: '18px', marginBottom: '15px' }}>🎯 Improving GPS Precision...</div>
          
          {currentAccuracy && (
            <div style={{ fontSize: '14px', marginBottom: '10px' }}>
              Current Accuracy: {currentAccuracy.toFixed(1)}m
            </div>
          )}
          
          <div style={{ fontSize: '14px', marginBottom: '10px' }}>
            Quality: <span style={{ 
              color: positionQuality === PositionQuality.EXCELLENT || positionQuality === PositionQuality.GOOD ? '#10B981' : 
                    positionQuality === PositionQuality.FAIR ? '#F59E0B' : '#EF4444' 
            }}>
              {positionQuality?.toUpperCase() || 'UNKNOWN'}
            </span>
          </div>
          
          <div style={{ fontSize: '14px', marginBottom: '15px' }}>
            Stable: {isPositionStable ? '✅' : '⏳ Waiting...'}
          </div>
          
          <div style={{ fontSize: '12px', opacity: 0.8 }}>
            For best AR experience, we're waiting for GPS accuracy ≤ 15m
          </div>
        </div>
      )}

      {/* AR Camera Component - only render when we have position */}
      {canStartAr && (
        <ArCameraComponent
          userPosition={currentUserPosition} // ✅ Now uses enhanced position
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
      )}
      
      {/* Experience Overlay - only render when AR is ready */}
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
      
      {/* Enhanced Loading/Status Overlay */}
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
              <div>🎯 Positioning AR experience...</div>
              <div style={{ fontSize: '12px', marginTop: '5px', opacity: 0.8 }}>
                Point your camera at your surroundings
              </div>
              {currentAccuracy && (
                <div style={{ fontSize: '11px', marginTop: '3px', opacity: 0.6 }}>
                  GPS: {currentAccuracy.toFixed(1)}m accuracy
                </div>
              )}
            </>
          ) : (
            <>
              <div>✅ AR positioned! Starting experience...</div>
            </>
          )}
        </div>
      )}

      {/* Enhanced Debug Info (Development Only) */}
      {process.env.NODE_ENV === 'development' && canStartAr && (
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
          maxWidth: '250px'
        }}>
          <div><strong>🎯 Enhanced Position Debug:</strong></div>
          <div>Type: {experienceType}</div>
          <div>Geofence: {geofenceId || 'N/A'}</div>
          
          {/* Position info */}
          <div style={{ marginTop: '5px', paddingTop: '5px', borderTop: '1px solid rgba(255,255,255,0.3)' }}>
            <div><strong>Position:</strong></div>
            <div>Current: [{currentUserPosition?.[0].toFixed(6)}, {currentUserPosition?.[1].toFixed(6)}]</div>
            <div>Source: {
              propUserPosition ? 'PROP' :
              preciseUserPosition && isPositionStable ? 'ENHANCED_STABLE' :
              preciseUserPosition ? 'ENHANCED_AVG' :
              rawUserPosition ? 'RAW' : 'NONE'
            }</div>
            
            {/* Precision info */}
            <div>Accuracy: {currentAccuracy?.toFixed(1)}m</div>
            <div>Quality: <span style={{ 
              color: positionQuality === PositionQuality.EXCELLENT || positionQuality === PositionQuality.GOOD ? '#10B981' : 
                    positionQuality === PositionQuality.FAIR ? '#F59E0B' : '#EF4444' 
            }}>
              {positionQuality}
            </span></div>
            <div>Stable: {isPositionStable ? '✅' : '❌'}</div>
          </div>
          
          {/* AR info */}
          <div style={{ marginTop: '5px', paddingTop: '5px', borderTop: '1px solid rgba(255,255,255,0.3)' }}>
            <div>Anchor: [{anchorPosition[0].toFixed(6)}, {anchorPosition[1].toFixed(6)}]</div>
            <div>Elevation: {anchorElevation}m</div>
            <div>Scale: {coordinateScale}x</div>
            <div>AR Ready: {arInitialized ? '✅' : '⏳'}</div>
            <div>Experience: {experienceReady ? '✅' : '⏳'}</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExperienceManager;