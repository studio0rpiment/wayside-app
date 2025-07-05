// src/components/common/ExperienceModal.tsx - Cleaned up version
import React, { useState, useCallback, useRef, useEffect } from 'react';
import mapboxgl from 'mapbox-gl';
import CompassArrow from './CompassArrow';
import ExperienceManager from '../ExperienceManager'
import { 
  getArAnchorForPoint, 
  checkGeofenceWithDirection,
  getPointByName 
} from '../../data/mapRouteData';
import { useGeofenceContext, PositionQuality } from '../../context/GeofenceContext';
import UserLocationTracker from './UserLocationTracker';

import SynchronizedMiniMap from './SynchronizedMiniMap';
import { universalModeManager } from '../../utils/UniversalModeManager';

interface ModalContent {
  title: string;
  description: string;
  imageUrl?: string;
  experienceRoute: string;
  buttonText: string;
  year?: string;
  additionalInfo?: Record<string, string | number | boolean>;
}

interface PointData {
  title: string;
  iconName: string;
  modalContent: ModalContent;
  [key: string]: any;
}

interface ExperienceModalProps {
  isOpen: boolean;
  pointData: PointData | null;
  onClose: () => void;
  mapRef?: React.RefObject<mapboxgl.Map>
}

// Enhanced geofence info interface
interface EnhancedGeofenceInfo {
  isInside: boolean;
  distance: number | null;
  direction: number | null;
  radius: number;
  radiusFeet: number;
  distanceFeet: number | null;
  shape: 'circle' | 'hexagon';
  entryDirection?: string;
  entryMessage?: string;
  positionQuality: PositionQuality;
  positionAccuracy: number | null;
  isPositionStable: boolean;
}

// Debug flag to see outside geofence state
const FORCE_OUTSIDE_GEOFENCE_FOR_DEBUG = false;

/**
 * Enhanced user position hook that leverages the GeofenceContext
 */
function useEnhancedUserPosition() {
  const {
    userPosition: rawUserPosition,
    averagedPosition: preciseUserPosition,
    currentAccuracy,
    positionQuality,
    isPositionStable,
    positionHistory,
    getCurrentRadius,
    currentRadius,
    updateGlobalRadius,
    resetGlobalRadius,
    isUniversalMode: contextUniversalMode 
  } = useGeofenceContext();

// console.log('🧪 GeofenceContext Universal Mode:', {
//   contextUniversalMode,
//   managerValue: universalModeManager.isUniversal,
//   managerReasons: universalModeManager.reasons
// });

  const isUniversalMode = FORCE_OUTSIDE_GEOFENCE_FOR_DEBUG ? false : (
    contextUniversalMode || 
    (typeof window !== 'undefined' && !('geolocation' in navigator))
  );

  const getBestUserPosition = useCallback((): [number, number] | null => {
    if (isUniversalMode) {
      return [-76.943, 38.9125]; // Kenilworth center fallback
    }

    if (FORCE_OUTSIDE_GEOFENCE_FOR_DEBUG) {
      return [-76.940, 38.910]; // Position outside Kenilworth for testing
    }

    // Use averaged position if stable and accurate (≤10m)
    if (preciseUserPosition && isPositionStable && 
        currentAccuracy && currentAccuracy <= 10) {
      return preciseUserPosition;
    }
    
    // Priority 2: Use averaged position if accuracy is acceptable (≤15m)
    if (preciseUserPosition && currentAccuracy && currentAccuracy <= 15) {
      return preciseUserPosition;
    }
    
    // Priority 3: Use averaged position even if not stable (for navigation)
    if (preciseUserPosition && currentAccuracy && currentAccuracy <= 25) {
      return preciseUserPosition;
    }
    
    // Priority 4: Fall back to raw GPS even if poor (for basic navigation)
    if (rawUserPosition) {
      return rawUserPosition;
    }
    
    // Priority 5: Use the latest position from history even if filtered out
    if (positionHistory && positionHistory.length > 0) {
      const latest = positionHistory[positionHistory.length - 1];
      return latest.coordinates;
    }

    console.warn('❌ No position available - GPS failed and not in Universal Mode');
    return null;
  }, [isUniversalMode, preciseUserPosition, rawUserPosition, currentAccuracy, isPositionStable, positionHistory]);

  const getArReadyPosition = useCallback((): [number, number] | null => {
    if (isUniversalMode) {
      return [-76.943, 38.9125]; // Kenilworth center fallback
    }

    if (FORCE_OUTSIDE_GEOFENCE_FOR_DEBUG) {
      return [-76.940, 38.910];
    }

    if (preciseUserPosition && isPositionStable && 
        currentAccuracy && currentAccuracy <= 10) {
      return preciseUserPosition;
    }
    
    if (preciseUserPosition && currentAccuracy && currentAccuracy <= 40) {
      return preciseUserPosition;
    }
    
    return null;
  }, [isUniversalMode, preciseUserPosition, currentAccuracy, isPositionStable]);

  return {
    getBestUserPosition,
    getArReadyPosition,
    averagedPosition: getBestUserPosition(),
    arReadyPosition: getArReadyPosition(),
    
    // Expose precision data
    currentAccuracy: isUniversalMode ? 1.0 : currentAccuracy,
    positionQuality: isUniversalMode ? PositionQuality.EXCELLENT : positionQuality,
    isPositionStable: isUniversalMode ? true : isPositionStable,
    
    rawUserPosition,
    isUniversalMode,
    
    // Radius functions from context:
    getCurrentRadius,
    currentRadius,
    updateGlobalRadius,
    resetGlobalRadius
  };
}

const ExperienceModal: React.FC<ExperienceModalProps> = ({
  isOpen,
  pointData,
  onClose,
  mapRef
}) => {
  
  const [showArExperience, setShowArExperience] = useState(false);
  
  // ✅ ALL HOOKS CALLED FIRST - ALWAYS
  const {
    getBestUserPosition,
    getArReadyPosition,
    averagedPosition,
    arReadyPosition,
    currentAccuracy,
    positionQuality,
    isPositionStable,
    getCurrentRadius,
    currentRadius,
    updateGlobalRadius,
    resetGlobalRadius,
    isUniversalMode
  } = useEnhancedUserPosition();
  
  const { 
    isInsideGeofence,
    getDistanceToPoint,
    isTracking,
  } = useGeofenceContext();
  
  const [previousPosition, setPreviousPosition] = useState<[number, number] | null>(null);
  
  // Update previous position when best position changes
  useEffect(() => {
    if (averagedPosition) {
      setPreviousPosition(prev => prev || averagedPosition);
      
      const timeout = setTimeout(() => {
        setPreviousPosition(averagedPosition);
      }, 2000);
      
      return () => clearTimeout(timeout);
    }
  }, [averagedPosition]);

  // Calculate geofence info using enhanced context and precision data
  const enhancedGeofenceInfo = React.useMemo((): EnhancedGeofenceInfo => {
    if (isUniversalMode) {
      return {
        isInside: true, // Always "inside" in Universal Mode
        distance: 0,
        direction: null,
        radius: 15,
        radiusFeet: 49,
        distanceFeet: 0,
        shape: 'circle',
        positionQuality: positionQuality || PositionQuality.EXCELLENT,
        positionAccuracy: 1,
        isPositionStable: true
      };
    }

    if (!pointData || !pointData.iconName || !averagedPosition) {
      return {
        isInside: false,
        distance: null,
        direction: null,
        radius: 15,
        radiusFeet: 49,
        distanceFeet: null,
        shape: 'circle',
        positionQuality: positionQuality || PositionQuality.UNACCEPTABLE,
        positionAccuracy: currentAccuracy,
        isPositionStable: isPositionStable || false
      };
    }
    
    const pointId = pointData.iconName;
    
    // Use enhanced geofence checking with hexagonal support
    const geofenceResult = checkGeofenceWithDirection(
      averagedPosition,
      pointId,
      previousPosition || undefined,
    );
    
    // Get the actual radius and anchor data for this experience
    const radiusMeters = currentRadius || 15;
    const radiusFeet = Math.round(radiusMeters * 3.28084);
    
    // FALLBACK: If geofenceResult is null, use context functions
    let fallbackDistance = null;
    let fallbackDistanceFeet = null;
    let fallbackIsInside = false;
    
    // Try context functions first
    const contextDistance = getDistanceToPoint(pointId);
    const contextInside = isInsideGeofence(pointId);
    
    if (contextDistance !== null) {
      fallbackDistance = contextDistance;
      fallbackDistanceFeet = Math.round(contextDistance * 3.28084);
      fallbackIsInside = contextInside;
    } else {
      // Manual calculation as last resort
      const pointFeature = getPointByName(pointId);
      if (pointFeature && averagedPosition) {
        const pointCoords = pointFeature.geometry.coordinates;
        const dx = (pointCoords[0] - averagedPosition[0]) * 111320 * Math.cos(averagedPosition[1] * Math.PI / 180);
        const dy = (pointCoords[1] - averagedPosition[1]) * 110540;
        fallbackDistance = Math.sqrt(dx * dx + dy * dy);
        fallbackDistanceFeet = Math.round(fallbackDistance * 3.28084);
        fallbackIsInside = fallbackDistance <= radiusMeters;
      }
    }
    
    if (!geofenceResult) {
      return {
        isInside: fallbackIsInside,
        distance: fallbackDistance,
        direction: null,
        radius: radiusMeters,
        radiusFeet,
        distanceFeet: fallbackDistanceFeet,
        shape: 'circle',
        positionQuality: positionQuality || PositionQuality.UNACCEPTABLE,
        positionAccuracy: currentAccuracy,
        isPositionStable: isPositionStable || false
      };
    }

    // Use geofenceResult distance, but fallback to manual calculation if null
    const finalDistance = geofenceResult.distance !== null ? geofenceResult.distance : fallbackDistance;
    const distanceFeet = finalDistance ? Math.round(finalDistance * 3.28084) : fallbackDistanceFeet;
    
    return {
      isInside: FORCE_OUTSIDE_GEOFENCE_FOR_DEBUG ? false : (geofenceResult.isInside || false),
      distance: finalDistance,
      radius: radiusMeters,
      direction: null,
      radiusFeet,
      distanceFeet,
      shape: geofenceResult.shape || 'circle',
      entryDirection: geofenceResult.entryDirection,
      entryMessage: geofenceResult.entryMessage,
      positionQuality: positionQuality || PositionQuality.UNACCEPTABLE,
      positionAccuracy: currentAccuracy,
      isPositionStable: isPositionStable || false
    };
  }, [pointData?.iconName, averagedPosition, previousPosition, positionQuality, currentAccuracy, isPositionStable, isInsideGeofence, getDistanceToPoint, currentRadius, isUniversalMode]);

  // Handle experience start
  const handleExperienceStart = useCallback(() => {
    if (pointData && pointData.modalContent) {
      setShowArExperience(true);
    }
  }, [pointData]);

  // Handle AR experience close
  const handleArExperienceClose = useCallback(() => {
    setShowArExperience(false);
    onClose();
  }, [onClose]);

  // Get AR anchor data for the experience
  const getAnchorData = useCallback(() => {
    if (!pointData || !averagedPosition) return null;
    
    const anchorData = getArAnchorForPoint(pointData.iconName, averagedPosition);
    if (!anchorData) {
      return {
        position: [averagedPosition[0] + 0.00001, averagedPosition[1] + 0.00001] as [number, number],
        elevation: 2.0,
        orientation: 0,
        scale: 1.0
      };
    }
    
    return anchorData;
  }, [pointData, averagedPosition]);

  // Map experience iconName to experience type
  const getExperienceType = useCallback((iconName: string) => {
    const typeMap: Record<string, string> = {
      'mac': 'mac',
      'lotus': 'lotus', 
      'volunteers': 'volunteers',
      'helen_s': 'helen_s',
      'lily': 'lily',
      'cattail': 'cattail',
      '2030-2105': '2030-2105',
      '1968': '1968',
      '2200_bc': '2200_bc'
    };
    
    return typeMap[iconName] || 'cube';
  }, []);

  // Memoize minimap style to prevent re-renders
  const miniMapStyle = React.useMemo(() => ({ 
    marginBottom: '10px' 
  }), []);

  const shouldShowMiniMap = averagedPosition && mapRef?.current;

  const stableMiniMapProps = React.useMemo(() => {
    if (!shouldShowMiniMap || !mapRef || !pointData) return null;
    
    return {
      experienceId: pointData.iconName,
      userPosition: averagedPosition,
      mainMapRef: mapRef,
      width: "auto" as const,
      height: "150px" as const,
      className: "mini-map",
      style: miniMapStyle,
      zoomOffset: -3,
      showAnchors: true
    };
  }, [pointData?.iconName, averagedPosition, mapRef, miniMapStyle, shouldShowMiniMap]);

  // ✅ NOW SAFE TO DO EARLY RETURNS - ALL HOOKS CALLED ABOVE
  if (!isOpen || !pointData) return null;

  const anchorData = getAnchorData();

  // Show AR Experience Manager if active
  if (showArExperience && (averagedPosition || isUniversalMode) && anchorData) {
    const positionToUse = averagedPosition || [-76.943, 38.9125];

    return (
      <ExperienceManager
        isOpen={showArExperience}
        onClose={handleArExperienceClose}
        experienceType={getExperienceType(pointData.iconName) as any}
        userPosition={positionToUse} 
        anchorPosition={anchorData.position}
        anchorElevation={anchorData.elevation}
        geofenceId={pointData.iconName}
        coordinateScale={1.0}
        isUniversalMode={isUniversalMode} 
      />
    );
  }

  // Show regular modal
  return (
    <>
      {/* Modal component */}
      <div 
        className="experience-modal"
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: 'var(--color-dark)',
          color: 'var(--color-light)',
          padding: '20px',
          borderRadius: '12px',
          width: '80%',
          maxWidth: '400px',
          zIndex: 1050,
          boxShadow: '0 4px 8px rgba(0, 0, 0, 0.5)'
        }}
      >
        {/* Universal Mode Banner */}
        {isUniversalMode && (
          <div style={{
            backgroundColor: 'var(--color-green)',
            color: 'var(--color-light)',
            padding: '8px 12px',
            margin: '-20px -20px 15px -20px',
            borderRadius: '12px 12px 0 0',
            textAlign: 'center',
            fontSize: '12px',
            fontWeight: 'bold',
            letterSpacing: '0.5px',
            textTransform: 'uppercase'
          }}>
            Universal Access
          </div>
        )}

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h2 style={{ margin: 0, fontSize: '24px' }}>
            {pointData.title}
          </h2>
          <button 
            onClick={onClose}
            style={{ 
              background: 'none', 
              border: 'none', 
              color: 'var(--color-light)', 
              fontSize: '24px',
              cursor: 'pointer' 
            }}
          >
            ×
          </button>
        </div>
        
        {/* Image */}
        {pointData.modalContent.imageUrl && (
          <div style={{ marginBottom: '15px' }}>
            <img 
              src={pointData.modalContent.imageUrl} 
              alt={pointData.title}
              style={{ width: '50%', borderRadius: '8px' }}
            />
          </div>
        )}
        
        {/* Description */}
        <div style={{ marginBottom: '15px' }}>
          <p style={{ fontWeight: 'bold', color: 'var(--color-blue)' }}>
            {pointData.modalContent.description}
          </p>
        </div>
        
        {/* Conditional sections based on Universal Mode */}
        {!isUniversalMode && (
          <>
            {/* Mini-map - show whenever not in Universal Mode */}
            {stableMiniMapProps && (
              <SynchronizedMiniMap {...stableMiniMapProps} />
            )}
            
            {/* Geofence Status */}
            {enhancedGeofenceInfo.isInside ? (
              <div style={{ 
                textAlign: 'center', 
                padding: '12px',
                backgroundColor: 'rgba(0, 255, 0, 0.1)',
                borderRadius: '8px',
                marginBottom: '15px',
                border: '1px solid rgba(0, 255, 0, 0.3)'
              }}>
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column',
                  alignItems: 'center', 
                  justifyContent: 'center' 
                }}>
                  <div style={{ fontSize: '14px', marginBottom: '8px' }}>
                    <strong style={{ color: '#90EE90' }}>✓ In Range</strong>
                    {enhancedGeofenceInfo.distanceFeet !== null && (
                      <div style={{ opacity: 0.9, marginTop: '4px' }}>
                        {enhancedGeofenceInfo.distanceFeet}ft from center
                      </div>
                    )}
                  </div>
                  
                  <div style={{ fontSize: '12px', opacity: 0.7 }}>
                    {enhancedGeofenceInfo.radiusFeet}ft range
                  </div>
                  
                  {enhancedGeofenceInfo.entryMessage && (
                    <div style={{ 
                      fontSize: '11px', 
                      opacity: 0.8, 
                      marginTop: '6px',
                      padding: '4px 8px',
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: '4px',
                      fontStyle: 'italic'
                    }}>
                      {enhancedGeofenceInfo.entryMessage}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ 
                textAlign: 'center', 
                padding: '15px',
                backgroundColor: 'rgba(0, 0, 0, 0.2)',
                borderRadius: '8px' 
              }}>
                <p style={{ 
                  margin: '0', 
                  color: 'var(--color-light)', 
                  opacity: 0.8,
                  fontSize: '14px' 
                }}>
                  You need to be closer to the location to start this experience
                </p>
              </div>
            )}
          </>
        )}
        
        {/* Experience Launch Button */}
        <button
          onClick={handleExperienceStart}
          disabled={!isUniversalMode && !enhancedGeofenceInfo.isInside}
          style={{
            width: '100%',
            padding: '12px',
            backgroundColor: (isUniversalMode || enhancedGeofenceInfo.isInside) 
              ? 'var(--color-blue)' 
              : 'rgba(128, 128, 128, 0.5)',
            color: 'var(--color-light)',
            border: 'none',
            borderRadius: '8px',
            fontFamily: 'var(--font-rigby)',
            fontWeight: '700',
            cursor: (isUniversalMode || enhancedGeofenceInfo.isInside) ? 'pointer' : 'not-allowed',
            fontSize: '1.5rem',
            opacity: (isUniversalMode || enhancedGeofenceInfo.isInside) ? 1 : 0.6
          }}
        >
          {isUniversalMode 
            ? `Launch ${pointData.title}`
            : enhancedGeofenceInfo.isInside 
              ? (pointData.modalContent.buttonText || `Launch ${pointData.title}`)
              : '📍 Move closer to launch experience'
          }
        </button>
      </div>

      {/* Backdrop overlay */}
      <div 
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 90
        }}
        onClick={onClose}
      />
    </>
  );
};

export default ExperienceModal;