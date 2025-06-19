// src/components/common/ExperienceModal.tsx - Enhanced with precision positioning
import React, { useState, useCallback, useRef, useEffect } from 'react';
import CompassArrow from './CompassArrow';
import ExperienceManager from '../ExperienceManager'
import { 
  getArAnchorForPoint, 
  checkGeofenceWithDirection,
  getPointByName 
} from '../../data/mapRouteData';
import { useGeofenceContext, PositionQuality } from '../../context/GeofenceContext';
import { ExperienceProgressTrackerRef } from './ExperienceProgressTracker';

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
  userPosition?: [number, number];
  isOpen: boolean;
  pointData: PointData | null;
  onClose: () => void;
  isNotification?: boolean;

  // ✅ REMOVED: Legacy geofence props - now handled by enhanced context
  isInsideGeofence?: boolean;
  distanceToGeofence?: number | null;
  directionToGeofence?: number | null;
  currentRadius?: number;
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
  // ✅ NEW: Position quality info
  positionQuality: PositionQuality;
  positionAccuracy: number | null;
  isPositionStable: boolean;
}

/**
 * Enhanced user position hook that leverages the GeofenceContext
 * More permissive than the manager for navigation purposes
 */
function useEnhancedUserPosition() {
  const {
    userPosition: rawUserPosition,
    averagedPosition: preciseUserPosition,
    currentAccuracy,
    positionQuality,
    isPositionStable,
    positionHistory,
    // ADD THESE:
    getCurrentRadius,
    currentRadius,
    updateGlobalRadius,
    resetGlobalRadius
  } = useGeofenceContext();

 const getBestUserPosition = useCallback((): [number, number] | null => {
    // Priority 1: Use averaged position if stable and accurate (≤10m)
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
    
    return null;
  }, [preciseUserPosition, rawUserPosition, currentAccuracy, isPositionStable, positionHistory]);


  // Separate function for AR-ready position (stricter requirements)
  const getArReadyPosition = useCallback((): [number, number] | null => {
    // Only return position if good enough for AR
    if (preciseUserPosition && isPositionStable && 
        currentAccuracy && currentAccuracy <= 10) {
      return preciseUserPosition;
    }
    
    if (preciseUserPosition && currentAccuracy && currentAccuracy <= 15) {
      return preciseUserPosition;
    }
    
    return null;
  }, [preciseUserPosition, currentAccuracy, isPositionStable]);


    return {
    getBestUserPosition,
    getArReadyPosition,
    currentUserPosition: getBestUserPosition(),
    arReadyPosition: getArReadyPosition(),
    
    // Expose precision data
    currentAccuracy,
    positionQuality,
    isPositionStable,
    rawUserPosition,
    preciseUserPosition,
    
    // ADD THESE - Radius functions from context:
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
  isNotification = false,
}) => {
  
  const [showArExperience, setShowArExperience] = useState(false);
  
  // ✅ ENHANCED: Use enhanced positioning and geofence context
const {
  getBestUserPosition,
  getArReadyPosition,
  currentUserPosition,
  arReadyPosition,
  currentAccuracy,
  positionQuality,
  isPositionStable,
  getCurrentRadius,
  currentRadius,  // Direct access to current radius value
  updateGlobalRadius,
  resetGlobalRadius
} = useEnhancedUserPosition();
  
  const { 
    isInsideGeofence,
    getDistanceToPoint,
    isTracking
  } = useGeofenceContext();
  
  // Track previous position for hexagonal entry direction detection
  const [previousPosition, setPreviousPosition] = useState<[number, number] | null>(null);
  
  // Update previous position when best position changes
  useEffect(() => {
    if (currentUserPosition) {
      setPreviousPosition(prev => prev || currentUserPosition); // Only set if not already set
      
      // Update previous position after a delay to track movement
      const timeout = setTimeout(() => {
        setPreviousPosition(currentUserPosition);
      }, 2000); // Update every 2 seconds
      
      return () => clearTimeout(timeout);
    }
  }, [currentUserPosition]);

  // ✅ ENHANCED: Calculate geofence info using enhanced context and precision data
  const enhancedGeofenceInfo = React.useMemo((): EnhancedGeofenceInfo => {
    if (!pointData || !pointData.iconName || !currentUserPosition) {
      console.log('❌ Missing required data for ExperienceModal:', { 
        hasPointData: !!pointData, 
        pointId: pointData?.iconName, 
        hasPosition: !!currentUserPosition,
        isTracking,
        currentAccuracy,
        positionQuality,
        isPositionStable
      });
      
      return {
        isInside: false,
        distance: null,
        direction: null,
        radius: 15, // Default radius
        radiusFeet: 49,
        distanceFeet: null,
        shape: 'circle',
        positionQuality: positionQuality || PositionQuality.UNACCEPTABLE,
        positionAccuracy: currentAccuracy,
        isPositionStable: isPositionStable || false
      };
    }
    
    const pointId = pointData.iconName;
    
    // Debug logging
    console.log('🔍 ExperienceModal Enhanced Debug:', {
      pointId,
      currentUserPosition,
      previousPosition,
      isTracking,
      currentAccuracy,
      positionQuality,
      isPositionStable
    });
    
    // ✅ ENHANCED: Use enhanced geofence checking with hexagonal support
    const geofenceResult = checkGeofenceWithDirection(
      currentUserPosition,
      pointId,
      previousPosition || undefined, // For directional entry detection
      
    );
    
    console.log('🔍 Enhanced Geofence Result:', geofenceResult);
    
    // ✅ Get the actual radius and anchor data for this experience
    const anchorData = getArAnchorForPoint(pointId, currentUserPosition);
    const radiusMeters = currentRadius || 15;
    const radiusFeet = Math.round(radiusMeters * 3.28084);
    
    console.log('🔍 Anchor Data:', anchorData);
    
    // FALLBACK: If geofenceResult is null, use context functions
    let fallbackDistance = null;
    let fallbackDistanceFeet = null;
    let fallbackIsInside = false;
    
    // Try context functions first (these use your enhanced geofence manager)
    const contextDistance = getDistanceToPoint(pointId);
    const contextInside = isInsideGeofence(pointId);
    
    if (contextDistance !== null) {
      fallbackDistance = contextDistance;
      fallbackDistanceFeet = Math.round(contextDistance * 3.28084);
      fallbackIsInside = contextInside;
      console.log('🔍 Using Enhanced Context Distance:', {
        contextDistance,
        contextInside,
        fallbackDistanceFeet
      });
    } else {
      // Manual calculation as last resort
      const pointFeature = getPointByName(pointId);
      if (pointFeature && currentUserPosition) {
        const pointCoords = pointFeature.geometry.coordinates;
        // Simple distance calculation in meters
        const dx = (pointCoords[0] - currentUserPosition[0]) * 111320 * Math.cos(currentUserPosition[1] * Math.PI / 180);
        const dy = (pointCoords[1] - currentUserPosition[1]) * 110540;
        fallbackDistance = Math.sqrt(dx * dx + dy * dy);
        fallbackDistanceFeet = Math.round(fallbackDistance * 3.28084);
        fallbackIsInside = fallbackDistance <= radiusMeters;
        
        console.log('🔍 Manual Distance Calculation:', {
          pointCoords,
          currentUserPosition,
          fallbackDistance,
          fallbackDistanceFeet,
          fallbackIsInside
        });
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
    
    // Calculate direction to the point (for compass arrow)
    let direction = null;
    const pointFeature = getPointByName(pointId);
    if (pointFeature && currentUserPosition) {
      const pointCoords = pointFeature.geometry.coordinates;
      const dx = pointCoords[0] - currentUserPosition[0];
      const dy = pointCoords[1] - currentUserPosition[1];
      direction = Math.atan2(dy, dx) * (180 / Math.PI);
      // Normalize to 0-360
      direction = (direction + 360) % 360;
    }
    
    // Use geofenceResult distance, but fallback to manual calculation if null
    const finalDistance = geofenceResult.distance !== null ? geofenceResult.distance : fallbackDistance;
    const distanceFeet = finalDistance ? Math.round(finalDistance * 3.28084) : fallbackDistanceFeet;
    
    console.log('🔍 Final Enhanced Distance:', {
      geofenceDistance: geofenceResult.distance,
      fallbackDistance,
      finalDistance,
      distanceFeet
    });
    
    return {
      isInside: geofenceResult.isInside || false,
      distance: finalDistance,
      direction,
      radius: radiusMeters,
      radiusFeet,
      distanceFeet,
      shape: geofenceResult.shape || 'circle',
      entryDirection: geofenceResult.entryDirection,
      entryMessage: geofenceResult.entryMessage,
      // ✅ NEW: Include position quality info
      positionQuality: positionQuality || PositionQuality.UNACCEPTABLE,
      positionAccuracy: currentAccuracy,
      isPositionStable: isPositionStable || false
    };
  }, [pointData?.iconName, currentUserPosition, previousPosition, positionQuality, currentAccuracy, isPositionStable, isInsideGeofence, getDistanceToPoint, currentRadius]);

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
    if (!pointData || !currentUserPosition) return null;
    
    const anchorData = getArAnchorForPoint(pointData.iconName, currentUserPosition);
    if (!anchorData) {
      return {
        position: [currentUserPosition[0] + 0.00001, currentUserPosition[1] + 0.00001] as [number, number],
        elevation: 2.0,
        orientation: 0,
        scale: 1.0
      };
    }
    
    return anchorData;
  }, [pointData, currentUserPosition]);

  // Map experience route to experience type
  const getExperienceType = useCallback((experienceRoute: string) => {
    const routeMap: Record<string, string> = {
      '/2030-2105': '2030-2105',
      '/mac': 'mac',
      '/lotus': 'lotus', 
      '/volunteers': 'volunteers',
      '/helen_s': 'helen_s',
      '/lily': 'lily',
      '/1968': '1968',
      '/cattail': 'cattail',
      '/2200_bc': '2200_bc'
    };
    
    return routeMap[experienceRoute] || 'cube';
  }, []);

  // Don't render if not open or no point data
  if (!isOpen || !pointData) return null;

  const anchorData = getAnchorData();

  // Show AR Experience Manager if active
  if (showArExperience && arReadyPosition && anchorData) {
    return (
      <ExperienceManager
        isOpen={showArExperience}
        onClose={handleArExperienceClose}
        experienceType={getExperienceType(pointData.modalContent.experienceRoute) as any}
        userPosition={arReadyPosition} // ✅ Use AR-ready position
        anchorPosition={anchorData.position}
        anchorElevation={anchorData.elevation}
        geofenceId={pointData.iconName}
        coordinateScale={1.0}
      />
    );
  }

  // ✅ ENHANCED: Check if position quality is good enough for AR
  const isPositionGoodEnoughForAr = arReadyPosition !== null && 
                                   currentAccuracy !== null && 
                                   currentAccuracy <= 20 &&
                                   positionQuality !== PositionQuality.UNACCEPTABLE;

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
          zIndex: 100,
          boxShadow: '0 4px 8px rgba(0, 0, 0, 0.5)',
          ...(isNotification && {
            borderLeft: '4px solid var(--color-blue)',
          })
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h2 style={{ margin: 0, fontSize: '24px' }}>
            {isNotification ? '🔔 ' : ''}{pointData.title}
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
        
        {/* ✅ ENHANCED: Position Quality Warning - only show if we have some position */}
        {currentUserPosition && !isPositionGoodEnoughForAr && (
          <div style={{
            backgroundColor: 'rgba(255, 165, 0, 0.1)',
            border: '1px solid rgba(255, 165, 0, 0.3)',
            borderRadius: '8px',
            padding: '10px',
            marginBottom: '15px'
          }}>
            <div style={{ fontSize: '14px', color: '#FFA500', marginBottom: '5px' }}>
              ⚠️ GPS Precision Notice
            </div>
            <div style={{ fontSize: '12px', opacity: 0.9 }}>
              GPS accuracy: {currentAccuracy?.toFixed(1)}m ({positionQuality})
            </div>
            <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '5px' }}>
              For best AR experience, move to an area with clearer sky view
            </div>
          </div>
        )}
        
        {/* ✅ ENHANCED: Geofence status with position quality */}
        {enhancedGeofenceInfo.isInside ? (
          <div>
            {/* Inside geofence - enhanced success state */}
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
                {/* Compass arrow pointing to experience center */}
                {enhancedGeofenceInfo.direction !== null && (
                  <CompassArrow 
                    direction={enhancedGeofenceInfo.direction} 
                    size={28}
                  />
                )}
                
                {/* Distance and status info */}
                <div style={{ fontSize: '14px', marginBottom: '8px' }}>
                  <strong style={{ color: '#90EE90' }}>✓ In Range</strong>
                  {enhancedGeofenceInfo.distanceFeet !== null && (
                    <div style={{ opacity: 0.9, marginTop: '4px' }}>
                      {enhancedGeofenceInfo.distanceFeet}ft from center
                    </div>
                  )}
                </div>
                
                {/* Enhanced geofence info */}
                <div style={{ fontSize: '12px', opacity: 0.7 }}>
                  {enhancedGeofenceInfo.shape === 'hexagon' ? '⬡' : '⭕'} {enhancedGeofenceInfo.radiusFeet}ft {enhancedGeofenceInfo.shape}
                  {enhancedGeofenceInfo.entryDirection && (
                    <div style={{ marginTop: '2px', fontStyle: 'italic' }}>
                      Entered from {enhancedGeofenceInfo.entryDirection}
                    </div>
                  )}
                </div>
                
                {/* Position quality indicator */}
                <div style={{ 
                  fontSize: '11px', 
                  marginTop: '4px',
                  padding: '2px 6px',
                  backgroundColor: positionQuality === PositionQuality.EXCELLENT || 
                                   positionQuality === PositionQuality.GOOD ? 
                                   'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                  borderRadius: '4px',
                  color: positionQuality === PositionQuality.EXCELLENT || 
                         positionQuality === PositionQuality.GOOD ? 
                         '#10B981' : '#F59E0B'
                }}>
                  GPS: {currentAccuracy?.toFixed(1)}m ({positionQuality})
                  {isPositionStable && ' • Stable'}
                </div>
                
                {/* Custom entry message for hexagonal geofences */}
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
            
            {/* Start button - enhanced with position quality check */}
            <button
              onClick={handleExperienceStart}
              disabled={!isPositionGoodEnoughForAr}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: isPositionGoodEnoughForAr ? 'var(--color-blue)' : 'rgba(128, 128, 128, 0.5)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontFamily: 'var(--font-rigby)',
                fontWeight: '400',
                cursor: isPositionGoodEnoughForAr ? 'pointer' : 'not-allowed',
                fontSize: '16px',
                opacity: isPositionGoodEnoughForAr ? 1 : 0.6
              }}
            >
              {isPositionGoodEnoughForAr 
                ? (pointData.modalContent.buttonText || `Launch ${pointData.title}`)
                : '⚠️ Waiting for better GPS accuracy'
              }
            </button>
            
            {/* GPS improvement tip */}
            {!isPositionGoodEnoughForAr && (
              <div style={{ 
                fontSize: '12px', 
                textAlign: 'center', 
                marginTop: '8px', 
                opacity: 0.8,
                color: '#FFA500'
              }}>
                Tip: Move to an area with clearer sky view for better GPS accuracy
              </div>
            )}
          </div>
        ) : (
          // ✅ ENHANCED: Outside geofence - show direction and distance with enhanced info
          <div style={{ 
            textAlign: 'center', 
            padding: '15px',
            backgroundColor: 'rgba(0, 0, 0, 0.2)',
            borderRadius: '8px' 
          }}>
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column',
              alignItems: 'center', 
              justifyContent: 'center', 
              marginBottom: '12px' 
            }}>
              {/* Compass arrow pointing toward experience */}
              {enhancedGeofenceInfo.direction !== null && (
                <CompassArrow 
                  direction={enhancedGeofenceInfo.direction} 
                  size={40}
                />
              )}
              
              {/* Distance and navigation info */}
              <div style={{ marginBottom: '8px' }}>
                <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '4px' }}>
                  {enhancedGeofenceInfo.distanceFeet !== null 
                    ? `${enhancedGeofenceInfo.distanceFeet}ft away` 
                    : 'Distance unknown'
                  }
                </div>
                <div style={{ fontSize: '14px', opacity: 0.8 }}>
                  {enhancedGeofenceInfo.shape === 'hexagon' ? '⬡' : '⭕'} Need to be within {enhancedGeofenceInfo.radiusFeet}ft
                </div>
              </div>
              
              {/* Position quality info for navigation */}
              <div style={{ 
                fontSize: '11px', 
                padding: '4px 8px',
                backgroundColor: positionQuality === PositionQuality.EXCELLENT || 
                                 positionQuality === PositionQuality.GOOD ? 
                                 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                borderRadius: '4px',
                marginBottom: '8px',
                color: positionQuality === PositionQuality.EXCELLENT || 
                       positionQuality === PositionQuality.GOOD ? 
                       '#10B981' : '#F59E0B'
              }}>
                Navigation GPS: {currentAccuracy?.toFixed(1)}m accuracy
                {isPositionStable && ' • Stable'}
              </div>
              
              {/* Navigation instruction */}
              <div style={{ 
                fontSize: '12px', 
                opacity: 0.7,
                padding: '6px 10px',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                borderRadius: '6px',
                marginTop: '4px'
              }}>
                Follow the compass arrow to find the experience
              </div>
            </div>
            
            <p style={{ 
              margin: '0', 
              color: 'var(--color-light)', 
              opacity: 0.8,
              fontSize: '14px' 
            }}>
              You need to be at the location to start this experience
            </p>
          </div>
        )}
        
        {/* Enhanced Debug info (development only) */}
        {process.env.NODE_ENV === 'development' && (
          <div style={{
            marginTop: '15px',
            padding: '8px',
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '4px',
            fontSize: '10px',
            fontFamily: 'monospace'
          }}>
            <div><strong>🔧 Enhanced Debug Info:</strong></div>
            <div>Shape: {enhancedGeofenceInfo.shape || 'undefined'}</div>
            <div>Radius: {enhancedGeofenceInfo.radius || 'undefined'}m ({enhancedGeofenceInfo.radiusFeet || 'undefined'}ft)</div>
            <div>Distance: {enhancedGeofenceInfo.distance?.toFixed(1) || 'undefined'}m ({enhancedGeofenceInfo.distanceFeet || 'undefined'}ft)</div>
            <div>Direction: {enhancedGeofenceInfo.direction?.toFixed(1) || 'undefined'}°</div>
            <div>Entry Dir: {enhancedGeofenceInfo.entryDirection || 'None'}</div>
            <div>Inside: {enhancedGeofenceInfo.isInside ? 'Yes' : 'No'}</div>
            
            {/* Enhanced position debug */}
            <div style={{ marginTop: '5px', paddingTop: '5px', borderTop: '1px solid rgba(255,255,255,0.2)' }}>
              <div><strong>Position Debug:</strong></div>
              <div>Current: {currentUserPosition ? `${currentUserPosition[0].toFixed(6)}, ${currentUserPosition[1].toFixed(6)}` : 'undefined'}</div>
              <div>Accuracy: {enhancedGeofenceInfo.positionAccuracy?.toFixed(1) || 'unknown'}m</div>
              <div>Quality: {enhancedGeofenceInfo.positionQuality || 'unknown'}</div>
              <div>Stable: {enhancedGeofenceInfo.isPositionStable ? 'Yes' : 'No'}</div>
              <div>Point ID: {pointData?.iconName || 'undefined'}</div>
              <div>Is Tracking: {isTracking ? 'Yes' : 'No'}</div>
              <div>AR Ready: {isPositionGoodEnoughForAr ? 'Yes' : 'No'}</div>
            </div>
          </div>
        )}
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