// src/components/map/OptimizedSynchronizedMiniMap.tsx
import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
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
  zoomOffset?: number;
  showAnchors?: boolean;
}

// Enhanced geofence info interface (simplified for minimap)
interface EnhancedGeofenceInfo {
  isInside: boolean;
  distance: number | null;
  distanceFeet: number | null;
  radius: number;
  radiusFeet: number;
  positionQuality: any;
  positionAccuracy: number | null;
  isPositionStable: boolean;
}

// Debounce utility function
function debounce<T extends (...args: any[]) => void>(func: T, wait: number): T {
  let timeout: NodeJS.Timeout;
  return ((...args: any[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  }) as T;
}

// Main component implementation
const SynchronizedMiniMapComponent: React.FC<SynchronizedMiniMapProps> = ({
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
  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initializationRef = useRef(false);

  // Get context data
  const { 
    currentAccuracy, 
    isPositionStable,
    getDistanceToPoint,
    isInsideGeofence,
    getCurrentRadius,
    positionQuality 
  } = useGeofenceContext();

  // OPTIMIZATION 1: Debounced and rounded user position to reduce micro-movements
  const debouncedUserPosition = useMemo(() => {
    if (!userPosition) return null;
    // Round to 4 decimal places (~11m precision) to reduce micro-movements
    return [
      Math.round(userPosition[0] * 10000) / 10000,
      Math.round(userPosition[1] * 10000) / 10000
    ] as [number, number];
  }, [userPosition]);

  // OPTIMIZATION 2: Stable experience location (only changes when experienceId changes)
  const experienceLocation = useMemo(() => {
    const pointFeature = routePointsData.features.find(
      feature => feature.properties.iconName === experienceId
    );
    return pointFeature ? 
      pointFeature.geometry.coordinates as [number, number] : null;
  }, [experienceId]);

  // OPTIMIZATION 3: Stable geofence calculations with memoization
  const stableGeofenceInfo = useMemo((): EnhancedGeofenceInfo => {
    if (!experienceId || !debouncedUserPosition) {
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
    if (distance === null && experienceLocation) {
      // Manual distance calculation in meters
      const dx = (experienceLocation[0] - debouncedUserPosition[0]) * 111320 * Math.cos(debouncedUserPosition[1] * Math.PI / 180);
      const dy = (experienceLocation[1] - debouncedUserPosition[1]) * 110540;
      distance = Math.sqrt(dx * dx + dy * dy);
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
  }, [experienceId, debouncedUserPosition, experienceLocation, getDistanceToPoint, isInsideGeofence, getCurrentRadius, positionQuality, currentAccuracy, isPositionStable]);

  // OPTIMIZATION 4: Stable callback functions
  const getInvertedIconPath = useCallback((iconName: string): string => {
    return getIconPath(iconName).replace('.svg', '_inv.svg');
  }, []);

  // OPTIMIZATION 5: Calculate initial bounds once (for setup only)
  const calculateInitialBounds = useCallback(() => {
    const userPos = debouncedUserPosition || userPosition;
    if (!userPos || !experienceLocation) return null;

    const bounds = new mapboxgl.LngLatBounds()
      .extend(userPos)
      .extend(experienceLocation);

    // Include anchor if it exists
    const anchorData = getArAnchorForPoint(experienceId, experienceLocation);
    if (anchorData?.position) {
      bounds.extend(anchorData.position);
    }

    return bounds;
  }, [debouncedUserPosition, userPosition, experienceLocation, experienceId]);

  // OPTIMIZATION 6: Debounced resize handler only
  const debouncedResize = useMemo(() =>
    debounce(() => {
      if (miniMapInstance.current && isLoaded) {
        miniMapInstance.current.resize();
      }
    }, 100),
  [isLoaded]);

  // Stable marker creation functions (called only once during initialization)
  const createStaticMiniMarkers = useCallback((map: mapboxgl.Map) => {
    // Clean up any existing markers
    miniMarkersRef.current.forEach(marker => marker.remove());
    miniMarkersRef.current = [];
    
    if (!experienceLocation) {
      console.warn('🗺️ OptimizedMiniMap: No experience location for marker creation');
      return;
    }
    
    // Create experience marker element
    const el = document.createElement('div');
    el.className = 'map-icon minimap-icon';
    el.style.backgroundImage = `url(${getIconPath(experienceId)})`;
    el.style.width = '20px';
    el.style.height = '20px';
    el.style.backgroundSize = 'cover';
    el.style.cursor = 'pointer';
    
    const marker = new mapboxgl.Marker(el)
      .setLngLat(experienceLocation)
      .addTo(map);
    
    miniMarkersRef.current.push(marker);
    console.log('🗺️ OptimizedMiniMap: Created static experience marker');
  }, [experienceId, experienceLocation]); // Only depend on values that are stable per modal opening

  const createStaticAnchorMarkers = useCallback((map: mapboxgl.Map) => {
    if (!showAnchors || !experienceLocation) return;
    
    // Clean up any existing anchor markers
    miniAnchorMarkersRef.current.forEach(marker => marker.remove());
    miniAnchorMarkersRef.current = [];
    
    // Create inverted anchor marker element
    const el = document.createElement('div');
    el.className = 'map-anchor-icon minimap-anchor-icon';
    el.style.backgroundImage = `url(${getInvertedIconPath(experienceId)})`;
    el.style.width = '10px';
    el.style.height = '10px';
    el.style.backgroundSize = 'cover';
    el.style.opacity = '0.6';
    
    // Get anchor position (this is static per experience)
    const anchorData = getArAnchorForPoint(experienceId, experienceLocation);
    
    if (anchorData?.position) {
      const anchorMarker = new mapboxgl.Marker(el)
        .setLngLat(anchorData.position)
        .addTo(map);
      
      miniAnchorMarkersRef.current.push(anchorMarker);
      console.log('🗺️ OptimizedMiniMap: Created static anchor marker');
    }
  }, [showAnchors, experienceId, experienceLocation, getInvertedIconPath]); // Only depend on static values

  // OPTIMIZATION 7: Single initialization effect with one-time fitBounds
  useEffect(() => {
    if (!miniMapRef.current || !mainMapRef.current || initializationRef.current) return;

    console.log('🗺️ OptimizedMiniMap: Initializing for', experienceId);
    initializationRef.current = true;

    const mainMap = mainMapRef.current;
    
    try {
      // Create minimap
      const miniMap = new mapboxgl.Map({
        container: miniMapRef.current,
        style: mainMap.getStyle(),
        center: experienceLocation || debouncedUserPosition || [-76.943, 38.9125],
        zoom: 17,
        interactive: true,
        attributionControl: false,
        logoPosition: 'bottom-left'
      });

      miniMap.on('load', () => {
        console.log('🗺️ OptimizedMiniMap: Map loaded');
        
        // Create static markers ONCE - inline to avoid function dependencies
        // Clean up any existing markers
        miniMarkersRef.current.forEach(marker => marker.remove());
        miniMarkersRef.current = [];
        miniAnchorMarkersRef.current.forEach(marker => marker.remove());
        miniAnchorMarkersRef.current = [];
        
        // Create experience marker if location exists
        if (experienceLocation) {
          const el = document.createElement('div');
          el.className = 'map-icon minimap-icon';
          el.style.backgroundImage = `url(${getIconPath(experienceId)})`;
          el.style.width = '20px';
          el.style.height = '20px';
          el.style.backgroundSize = 'cover';
          el.style.cursor = 'pointer';
          
          const marker = new mapboxgl.Marker(el)
            .setLngLat(experienceLocation)
            .addTo(miniMap);
          
          miniMarkersRef.current.push(marker);
          console.log('🗺️ OptimizedMiniMap: Created static experience marker');
        }
        
        // Create anchor marker if enabled and location exists
        if (showAnchors && experienceLocation) {
          const anchorData = getArAnchorForPoint(experienceId, experienceLocation);
          
          if (anchorData?.position) {
            const el = document.createElement('div');
            el.className = 'map-anchor-icon minimap-anchor-icon';
            el.style.backgroundImage = `url(${getInvertedIconPath(experienceId)})`;
            el.style.width = '10px';
            el.style.height = '10px';
            el.style.backgroundSize = 'cover';
            el.style.opacity = '0.6';
            
            const anchorMarker = new mapboxgl.Marker(el)
              .setLngLat(anchorData.position)
              .addTo(miniMap);
            
            miniAnchorMarkersRef.current.push(anchorMarker);
            console.log('🗺️ OptimizedMiniMap: Created static anchor marker');
          }
        }
        
        // SINGLE fitBounds call - only when modal opens and map loads
        const userPos = debouncedUserPosition || userPosition;
        if (userPos && experienceLocation) {
          const bounds = new mapboxgl.LngLatBounds()
            .extend(userPos)
            .extend(experienceLocation);

          // Include anchor if it exists
          const anchorData = getArAnchorForPoint(experienceId, experienceLocation);
          if (anchorData?.position) {
            bounds.extend(anchorData.position);
          }

          console.log('🗺️ OptimizedMiniMap: Setting initial bounds (one-time only)');
          miniMap.fitBounds(bounds, {
            padding: 60,
            duration: 500,
            maxZoom: 19,
            minZoom: 16
          });
        }
        
        // Trigger initial resize
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
        console.log('🗺️ OptimizedMiniMap: Cleaning up');
        mainMap.off('styledata', handleMainMapStyleChange);
        
        if (resizeTimeoutRef.current) {
          clearTimeout(resizeTimeoutRef.current);
        }
        
        if (miniMapInstance.current) {
          miniMapInstance.current.remove();
          miniMapInstance.current = null;
        }
        
        initializationRef.current = false;
      };
    } catch (error) {
      console.error('🗺️ OptimizedMiniMap: Error initializing:', error);
      initializationRef.current = false;
    }
  }, [experienceId]); // ONLY experienceId dependency - no functions!

  // OPTIMIZATION 8: Resize handling only (no more bounds updates)
  useEffect(() => {
    if (!isLoaded) return;

    const resizeObserver = new ResizeObserver(debouncedResize);
    
    if (miniMapRef.current) {
      resizeObserver.observe(miniMapRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [isLoaded, debouncedResize]);

  // Toggle visibility handler
  const toggleVisibility = useCallback(() => {
    setIsVisible(prev => !prev);
  }, []);

  // Early return for hidden state
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
            height: height === 'auto' ? '200px' : height,
            minHeight: '150px',
            borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.2)',
            position: 'relative',
            overflow: 'hidden',
            ...style
          }}
        />

        {/* User Location Tracker */}
        {isLoaded && miniMapInstance.current && debouncedUserPosition && (
          <UserLocationTracker
            map={miniMapInstance.current}
            userPosition={debouncedUserPosition}
            showDirectionBeam={true}
            debugId="MINIMAP"
            beamLength={3}
            minimalMode={true}
          />
        )}

        {/* Distance Display Overlay */}
        {isLoaded && stableGeofenceInfo.distanceFeet !== null && (
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
            {stableGeofenceInfo.distanceFeet}ft FROM EXPERIENCE
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

// OPTIMIZATION 9: React.memo with deep comparison for props
const OptimizedSynchronizedMiniMap = React.memo(SynchronizedMiniMapComponent, (prevProps, nextProps) => {
  // Deep comparison for user position
  const positionEqual = 
    (prevProps.userPosition?.[0] === nextProps.userPosition?.[0] && 
     prevProps.userPosition?.[1] === nextProps.userPosition?.[1]) ||
    (!prevProps.userPosition && !nextProps.userPosition);
  
  // Check other critical props
  const propsEqual = positionEqual && 
         prevProps.experienceId === nextProps.experienceId &&
         prevProps.zoomOffset === nextProps.zoomOffset &&
         prevProps.showAnchors === nextProps.showAnchors &&
         prevProps.width === nextProps.width &&
         prevProps.height === nextProps.height;

  // Log memoization decisions in development
  if (process.env.NODE_ENV === 'development') {
    if (propsEqual) {
      console.log('🗺️ OptimizedMiniMap: Props equal, skipping render');
    } else {
      console.log('🗺️ OptimizedMiniMap: Props changed, allowing render', {
        positionEqual,
        experienceIdEqual: prevProps.experienceId === nextProps.experienceId,
        zoomOffsetEqual: prevProps.zoomOffset === nextProps.zoomOffset,
        showAnchorsEqual: prevProps.showAnchors === nextProps.showAnchors
      });
    }
  }

  return propsEqual;
});

OptimizedSynchronizedMiniMap.displayName = 'OptimizedSynchronizedMiniMap';

export default OptimizedSynchronizedMiniMap;