// src/components/map/SynchronizedMiniMap.tsx
import React, { useRef, useEffect, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import { routePointsData, getIconPath, getArAnchorForPoint } from '../../data/mapRouteData';
import { useGeofenceContext } from '../../context/GeofenceContext';
import UserLocationTracker from '../common/UserLocationTracker';

interface SynchronizedMiniMapProps {
  experienceId: string;
  userPosition: [number, number] | null;
  mainMapRef: React.RefObject<mapboxgl.Map>;
  width?: string;
  height?: string;
  className?: string;
  style?: React.CSSProperties;
  zoomOffset?: number; // How many zoom levels lower than main map
  showAnchors?: boolean; // Whether to show AR anchor markers
}

const SynchronizedMiniMap: React.FC<SynchronizedMiniMapProps> = ({
  experienceId,
  userPosition,
  mainMapRef,
  width = '100%',
  height = '200px',
  className,
  style,
  zoomOffset = -3,
  showAnchors = true
}) => {
  // Refs and state
  const miniMapRef = useRef<HTMLDivElement>(null);
  const miniMapInstance = useRef<mapboxgl.Map | null>(null);
  const miniMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const miniAnchorMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const resizeTimeoutRef = useRef<number | null>(null);

  // Get context data (same as main map)
  const { 
    currentAccuracy, 
    isPositionStable,
    getDistanceToPoint,
    isInsideGeofence,
    getCurrentRadius,
    positionQuality 
  } = useGeofenceContext();

  // Enhanced geofence info interface (simplified for minimap)
  interface EnhancedGeofenceInfo {
    isInside: boolean;
    distance: number | null;
    distanceFeet: number | null;
    radius: number;
    radiusFeet: number;
    positionQuality: any; // Import the enum type if needed
    positionAccuracy: number | null;
    isPositionStable: boolean;
  }

  // Calculate enhanced geofence info for distance display
  const enhancedGeofenceInfo = React.useMemo((): EnhancedGeofenceInfo => {
    if (!experienceId || !userPosition) {
      return {
        isInside: false,
        distance: null,
        distanceFeet: null,
        radius: 15,
        radiusFeet: 49,
        positionQuality: positionQuality,
        positionAccuracy: currentAccuracy,
        isPositionStable: isPositionStable || false
      };
    }
    
    // Try context distance first
    let distance = getDistanceToPoint(experienceId);
    
    // Fallback to manual calculation if context returns null
    if (distance === null) {
      const pointFeature = routePointsData.features.find(
        feature => feature.properties.iconName === experienceId
      );
      if (pointFeature && userPosition) {
        const pointCoords = pointFeature.geometry.coordinates;
        // Manual distance calculation in meters
        const dx = (pointCoords[0] - userPosition[0]) * 111320 * Math.cos(userPosition[1] * Math.PI / 180);
        const dy = (pointCoords[1] - userPosition[1]) * 110540;
        distance = Math.sqrt(dx * dx + dy * dy);
        console.log('🗺️ MiniMap: Using manual distance calculation:', distance);
      }
    }
    
    const distanceFeet = distance ? Math.round(distance * 3.28084) : null;
    const radius = getCurrentRadius();
    
    return {
      isInside: isInsideGeofence(experienceId),
      distance,
      distanceFeet,
      radius,
      radiusFeet: Math.round(radius * 3.28084),
      positionQuality: positionQuality,
      positionAccuracy: currentAccuracy,
      isPositionStable: isPositionStable || false
    };
  }, [experienceId, userPosition, getDistanceToPoint, isInsideGeofence, getCurrentRadius, positionQuality, currentAccuracy, isPositionStable]);

  // Handle container resize
  const handleResize = useCallback(() => {
    if (miniMapInstance.current && isLoaded) {
      // Clear any pending resize
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
      
      // Debounce resize calls
      resizeTimeoutRef.current = window.setTimeout(() => {
        if (miniMapInstance.current) {
          console.log('🗺️ SynchronizedMiniMap: Triggering resize');
          miniMapInstance.current.resize();
        }
      }, 100);
    }
  }, [isLoaded]);

  // Create inverted icon path (same logic as main map) - STABLE
  const getInvertedIconPath = useCallback((iconName: string): string => {
    return getIconPath(iconName).replace('.svg', '_inv.svg');
  }, []); // No dependencies to prevent re-creation

  // Create minimap markers (only current experience) - STABLE  
  const createMiniMarkers = useCallback((map: mapboxgl.Map) => {
    // Clean up existing markers
    miniMarkersRef.current.forEach(marker => marker.remove());
    miniMarkersRef.current = [];
    
    // Find only the current experience point
    const currentExperiencePoint = routePointsData.features.find(
      point => point.properties.iconName === experienceId
    );
    
    if (!currentExperiencePoint) {
      console.warn(`🗺️ SynchronizedMiniMap: No point found for experienceId: ${experienceId}`);
      return;
    }
    
    // Create marker for current experience only
    const { iconName } = currentExperiencePoint.properties;
    
    // Create marker element with same styling as main map
    const el = document.createElement('div');
    el.className = 'map-icon minimap-icon';
    el.style.backgroundImage = `url(${getIconPath(iconName)})`;
    el.style.width = '20px'; // Slightly smaller for minimap
    el.style.height = '20px';
    el.style.backgroundSize = 'cover';
    el.style.cursor = 'pointer';
    
    const marker = new mapboxgl.Marker(el)
      .setLngLat(currentExperiencePoint.geometry.coordinates)
      .addTo(map);
    
    miniMarkersRef.current.push(marker);

    console.log(`✅ Created minimap marker for experience: ${experienceId}`);
  }, [experienceId]); // Only depend on experienceId

  // Create anchor markers for minimap (only current experience) - STABLE
  const createMiniAnchorMarkers = useCallback((map: mapboxgl.Map) => {
    if (!showAnchors) return;
    
    // Clean up existing anchor markers
    miniAnchorMarkersRef.current.forEach(marker => marker.remove());
    miniAnchorMarkersRef.current = [];
    
    // Find only the current experience point
    const currentExperiencePoint = routePointsData.features.find(
      point => point.properties.iconName === experienceId
    );
    
    if (!currentExperiencePoint) return;
    
    const { iconName } = currentExperiencePoint.properties;
    
    // Create inverted marker element (smaller for minimap)
    const el = document.createElement('div');
    el.className = 'map-anchor-icon minimap-anchor-icon';
    el.style.backgroundImage = `url(${getInvertedIconPath(iconName)})`;
    el.style.width = '10px'; // Even smaller for minimap
    el.style.height = '10px';
    el.style.backgroundSize = 'cover';
    el.style.opacity = '0.6';
    
    // Get anchor position for this experience
    const anchorData = getArAnchorForPoint(iconName, currentExperiencePoint.geometry.coordinates);
    
    if (anchorData && anchorData.position) {
      const anchorMarker = new mapboxgl.Marker(el)
        .setLngLat(anchorData.position)
        .addTo(map);
      
      miniAnchorMarkersRef.current.push(anchorMarker);
      console.log(`✅ Created minimap anchor marker for experience: ${experienceId}`);
    }
  }, [showAnchors, getInvertedIconPath, experienceId]); // Depend on experienceId

  // Calculate bounds to fit user and experience with padding
  const calculateFitBounds = useCallback(() => {
    if (!userPosition) return null;
    
    // Find the current experience location
    const pointFeature = routePointsData.features.find(
      feature => feature.properties.iconName === experienceId
    );
    const experienceLocation = pointFeature ? 
      pointFeature.geometry.coordinates as [number, number] : null;

    if (!experienceLocation) return null;

    // Create bounds that include both user and experience
    const bounds = new mapboxgl.LngLatBounds()
      .extend(userPosition)
      .extend(experienceLocation);

    // Also include anchor if it exists
    const anchorData = getArAnchorForPoint(experienceId, experienceLocation);
    if (anchorData && anchorData.position) {
      bounds.extend(anchorData.position);
    }

    return bounds;
  }, [userPosition, experienceId]);

  // Calculate center point for minimap view - MEMOIZED (fallback only)
  const centerPoint = React.useMemo((): [number, number] => {
    // This is now just a fallback - we prefer fitBounds approach
    const pointFeature = routePointsData.features.find(
      feature => feature.properties.iconName === experienceId
    );
    const experienceLocation = pointFeature ? 
      pointFeature.geometry.coordinates as [number, number] : null;

    return experienceLocation || userPosition || [-76.943, 38.9125];
  }, [experienceId, userPosition]);

  // Get appropriate zoom level for minimap - MEMOIZED
  const minimapZoom = React.useMemo((): number => {
    if (!mainMapRef.current) return 15;
    
    const mainZoom = mainMapRef.current.getZoom();
    return Math.max(10, mainZoom + zoomOffset);
  }, [mainMapRef.current?.getZoom(), zoomOffset]);

  // Initialize minimap - STABLE effect
  useEffect(() => {
    if (!miniMapRef.current || !mainMapRef.current) return;

    console.log('🗺️ SynchronizedMiniMap: Initializing...');

    const mainMap = mainMapRef.current;
    
    try {
      // Create minimap with same style as main map
      const miniMap = new mapboxgl.Map({
        container: miniMapRef.current,
        style: mainMap.getStyle(),
        center: centerPoint,
        zoom: minimapZoom,
        interactive: true, // Allow interaction for better UX
        attributionControl: false,
        logoPosition: 'bottom-left'
      });

      miniMap.on('load', () => {
        console.log('🗺️ SynchronizedMiniMap: Map loaded');
        
        // Create markers after map loads
        createMiniMarkers(miniMap);
        createMiniAnchorMarkers(miniMap);
        
        // Trigger initial resize to ensure proper sizing
        setTimeout(() => {
          if (miniMap) {
            miniMap.resize();
          }
        }, 100);
        
        setIsLoaded(true);
      });

      // Sync with main map style changes
      const handleMainMapStyleChange = () => {
        if (miniMap && mainMap) {
          miniMap.setStyle(mainMap.getStyle());
        }
      };

      mainMap.on('styledata', handleMainMapStyleChange);

      miniMapInstance.current = miniMap;

      return () => {
        console.log('🗺️ SynchronizedMiniMap: Cleaning up');
        mainMap.off('styledata', handleMainMapStyleChange);
        
        // Clear resize timeout
        if (resizeTimeoutRef.current) {
          clearTimeout(resizeTimeoutRef.current);
        }
        
        if (miniMapInstance.current) {
          miniMapInstance.current.remove();
          miniMapInstance.current = null;
        }
      };
    } catch (error) {
      console.error('🗺️ SynchronizedMiniMap: Error initializing:', error);
    }
  }, [experienceId]); // Only re-initialize when experience changes

  // Update view when positions change - AUTO FIT TO BOUNDS
  useEffect(() => {
    if (!miniMapInstance.current || !isLoaded) return;

    const bounds = calculateFitBounds();
    
    if (bounds) {
      // Fit bounds to show user, experience, and anchor with padding
      miniMapInstance.current.fitBounds(bounds, {
        padding: 60, // More generous padding for better view
        duration: 500,
        maxZoom: 19, // Limit max zoom to maintain context
        minZoom: 16  // Ensure minimum zoom for detail
      });
    } else {
      // Fallback to center view if no bounds available
      miniMapInstance.current.easeTo({
        center: centerPoint,
        zoom: 17, // Default zoom when no user position
        duration: 500
      });
    }

  }, [userPosition, experienceId, isLoaded, calculateFitBounds, centerPoint]);

  // Sync zoom with main map (disabled - we use fitBounds instead)
  // We no longer sync zoom because we want to auto-fit to user + experience
  /*
  useEffect(() => {
    if (!miniMapInstance.current || !mainMapRef.current || !isLoaded) return;

    const handleMainMapZoom = () => {
      if (miniMapInstance.current && mainMapRef.current) {
        const mainZoom = mainMapRef.current.getZoom();
        const newZoom = Math.max(10, mainZoom + zoomOffset);
        miniMapInstance.current.setZoom(newZoom);
      }
    };

    mainMapRef.current.on('zoom', handleMainMapZoom);

    return () => {
      mainMapRef.current?.off('zoom', handleMainMapZoom);
    };
  }, [mainMapRef, isLoaded, zoomOffset]); // Stable dependencies
  */

  // Handle container size changes
  useEffect(() => {
    handleResize();
  }, [width, height, isVisible, handleResize]);

  // Set up resize observer for responsive behavior
  useEffect(() => {
    if (!miniMapRef.current || !isLoaded) return;

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });

    resizeObserver.observe(miniMapRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [isLoaded, handleResize]);

  // Toggle visibility
  const toggleVisibility = useCallback(() => {
    setIsVisible(!isVisible);
  }, [isVisible]);

  if (!isVisible) {
    return (
      <div style={{ marginBottom: '15px' }}>
        <button
          onClick={toggleVisibility}
          style={{
            width: '100%',
            height: '40px',
            backgroundColor: 'rgba(0,0,0,0.8)',
            color: 'white',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          🗺️ Show Mini Map
        </button>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: '15px' }}>

      {/* Mini Map Container */}
      <div style={{ position: 'relative', overflow: 'hidden', borderRadius: '8px' }}>
        <div 
          ref={miniMapRef}
          className={className}
          style={{
            width: width === 'auto' ? '100%' : width,
            height: height === 'auto' ? '200px' : height, // Default height when auto
            minHeight: '150px', // Ensure minimum height
            borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.2)',
            position: 'relative',
            overflow: 'hidden',
            ...style
          }}
        />

        {/* User Location Tracker - Same as main map */}
        {isLoaded && miniMapInstance.current && userPosition && (
          <UserLocationTracker
            map={miniMapInstance.current}
            userPosition={userPosition}
            showDirectionBeam={true}
            debugId="MINIMAP"
            beamLength={20} // Shorter beam for minimap
            minimalMode={true}
          />
        )}

        {/* Distance Display Overlay */}
        {isLoaded && enhancedGeofenceInfo.distanceFeet !== null && (
          <div style={{
            position: 'absolute',
            bottom: '10px',
            left: '1px',
            fontSize: '18px',
            fontWeight: 'bold',
            width: '100%',
            backgroundColor: 'rgba(0,0,0,0)',
            color: 'var(--color-dark)',
            padding: '0px 8px',
            borderRadius: '0px 0px 6px 6px',
            border: '1px solid rgba(255,255,255,0.2)',
            backdropFilter: 'blur(3px)',
            textAlign: 'center',
            zIndex: '1000'
          }}>
            {enhancedGeofenceInfo.distanceFeet !== null 
              ? `${enhancedGeofenceInfo.distanceFeet}ft FROM EXPERIENCE` 
              : 'Distance unknown'
            }
          </div>
        )}

        {/* Loading indicator */}
        {!isLoaded && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'rgba(0,0,0,0.8)',
            color: 'white',
            padding: '8px 12px',
            borderRadius: '4px',
            fontSize: '12px'
          }}>
            Loading map...
          </div>
        )}

        {/* GPS Status Indicator */}
        {isLoaded && (
          <div style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            fontSize: '10px',
            backgroundColor: 'rgba(0,0,0,0.7)',
            color: currentAccuracy && currentAccuracy <= 10 ? '#00ff00' : '#ffaa00',
            padding: '2px 6px',
            borderRadius: '4px'
          }}>
            {currentAccuracy ? `±${currentAccuracy.toFixed(0)}m` : 'GPS'}
          </div>
        )}
      </div>
    </div>
  );
};

export default SynchronizedMiniMap;