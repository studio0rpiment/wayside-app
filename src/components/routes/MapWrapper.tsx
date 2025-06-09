// MapWrapper.tsx - Additional stability improvements
import React, { useRef, useEffect, useState, memo } from 'react';
import mapboxgl from 'mapbox-gl';
import BrowserInfo from '../../utils/browserDetection';

interface MapWrapperProps {
  center: [number, number];
  zoom: number;
  bearing?: number;
  style?: string;
  onMapLoaded?: (map: mapboxgl.Map) => void;
  onMapRemoved?: () => void;
}

// Use memo to prevent unnecessary re-renders
const MapWrapper: React.FC<MapWrapperProps> = memo(({
  center,
  zoom,
  bearing = 0,
  style = 'mapbox://styles/mapbox/cj3kbeqzo00022smj7akz3o1e',
  onMapLoaded,
  onMapRemoved
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const eventHandlersRef = useRef<{ [key: string]: any }>({});
  const initializedRef = useRef<boolean>(false);
  
  // Use browser detection
  const isFirefox = BrowserInfo.isFirefox;
  const isArc = BrowserInfo.isArc;
  
  // Firefox zoom limiting functionality
  const [isFirefoxZoomLimited, setIsFirefoxZoomLimited] = useState(true);
  
  // Initialize map only once
  useEffect(() => {
    // Prevent double initialization
    if (initializedRef.current || !mapContainerRef.current || mapRef.current) return;
    initializedRef.current = true;
    
    // Apply minimal telemetry blocking
    try {
      if (mapboxgl.config && typeof (mapboxgl as any).setTelemetryEnabled === 'function') {
        (mapboxgl as any).setTelemetryEnabled(false);
      }
    } catch (e) {
      // Silent fail
    }
    
    // Create map options
    const effectiveZoom = isFirefox && isFirefoxZoomLimited ? Math.min(zoom, 15.95) : zoom;
    const mapOptions: mapboxgl.MapOptions = {
      container: mapContainerRef.current,
      style,
      center,
      zoom: effectiveZoom,
      bearing,
      bearingSnap: 0,
      preserveDrawingBuffer: isFirefox,
      fadeDuration: isFirefox ? 0 : 300,
      collectResourceTiming: false,
      attributionControl: false,
    };
    
    // Arc-specific options
    if (isArc) {
      Object.assign(mapOptions, {
        refreshExpiredTiles: false,
        fadeDuration: 0,
        cooperativeGestures: true,
      });
    }
    
    // Create the map
    const map = new mapboxgl.Map(mapOptions);
    mapRef.current = map;
    
    // Add minimal attribution
    map.addControl(new mapboxgl.AttributionControl({
      compact: true,
      customAttribution: ''
    }), 'bottom-right');
    
    // Minimal logo styling
    const logoStyleElement = document.createElement('style');
    logoStyleElement.innerHTML = '.mapboxgl-ctrl-logo{opacity:0.3}.mapboxgl-ctrl-attrib-inner{opacity:0.3;font-size:9px}';
    document.head.appendChild(logoStyleElement);
    
    // Store the style element reference for cleanup
    eventHandlersRef.current.styleElement = logoStyleElement;
    
    // Set up map load handler
    map.once('load', () => {
      // Firefox-specific adjustments
      if (isFirefox) {
        if (map.setFog) map.setFog(null);
        if (map.setTerrain) map.setTerrain(null);
        
        // Handle Firefox zoom limiting
        if (isFirefoxZoomLimited) {
          const handleZoom = () => {
            if (!mapRef.current) return;
            const currentZoom = mapRef.current.getZoom();
            if (currentZoom > 15.95) {
              mapRef.current.setZoom(15.95);
            }
          };
          
          map.on('zoom', handleZoom);
          eventHandlersRef.current.zoomHandler = handleZoom;
        }
      }
      
      // Minimal event suppression for telemetry
      if (map.fire) {
        const originalFire = map.fire;
        map.fire = function(event: any, ...args: any[]) {
          const eventName = typeof event === 'string' ? event : event?.type;
          if (typeof eventName === 'string' && eventName.startsWith('mapbox.')) {
            return map;
          }
          return (originalFire as any).apply(this, [event, ...args]);
        };
        
        // Store original method for cleanup
        eventHandlersRef.current.originalFire = originalFire;
      }
      
      // Disable rotation
      map.dragRotate.disable();
      map.touchZoomRotate.disableRotation();
      
      // Notify parent component that map is ready
      if (onMapLoaded) {
        onMapLoaded(map);
      }
    });
    
    // Firefox 'f' key handler for zoom limit toggle
    if (isFirefox) {
      const handleFirefoxKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'f') {
          setIsFirefoxZoomLimited(prev => !prev);
        }
      };
      
      document.addEventListener('keydown', handleFirefoxKeyDown);
      eventHandlersRef.current.firefoxKeyHandler = handleFirefoxKeyDown;
    }
    
    // Cleanup function
    return () => {
      initializedRef.current = false;
      
      // Clean up all event handlers
      if (mapRef.current) {
        // Clean up Firefox zoom handler
        if (eventHandlersRef.current.zoomHandler) {
          mapRef.current.off('zoom', eventHandlersRef.current.zoomHandler);
        }
        
        // Restore original fire method if we replaced it
        if (eventHandlersRef.current.originalFire) {
          mapRef.current.fire = eventHandlersRef.current.originalFire;
        }
        
        // Remove the map
        mapRef.current.remove();
        mapRef.current = null;
      }
      
      // Remove Firefox key handler
      if (eventHandlersRef.current.firefoxKeyHandler) {
        document.removeEventListener('keydown', eventHandlersRef.current.firefoxKeyHandler);
      }
      
      // Remove style element
      if (eventHandlersRef.current.styleElement && document.head.contains(eventHandlersRef.current.styleElement)) {
        document.head.removeChild(eventHandlersRef.current.styleElement);
      }
      
      // Clear references
      eventHandlersRef.current = {};
      
      // Notify parent component
      if (onMapRemoved) {
        onMapRemoved();
      }
    };
  }, []); // Empty dependency array - only run once
  
  // Firefox zoom limit handling - update only when isFirefoxZoomLimited changes
  useEffect(() => {
    if (!mapRef.current || !isFirefox) return;
    
    // Update zoom limit behavior without recreating the map
    if (isFirefoxZoomLimited) {
      // Add zoom handler if not already present
      if (!eventHandlersRef.current.zoomHandler) {
        const handleZoom = () => {
          if (!mapRef.current) return;
          const currentZoom = mapRef.current.getZoom();
          if (currentZoom > 15.95) {
            mapRef.current.setZoom(15.95);
          }
        };
        
        mapRef.current.on('zoom', handleZoom);
        eventHandlersRef.current.zoomHandler = handleZoom;
      }
      
      // Apply limit immediately if needed
      if (mapRef.current.getZoom() > 15.95) {
        mapRef.current.setZoom(15.95);
      }
    } else {
      // Remove zoom handler if present
      if (eventHandlersRef.current.zoomHandler) {
        mapRef.current.off('zoom', eventHandlersRef.current.zoomHandler);
        delete eventHandlersRef.current.zoomHandler;
      }
    }
  }, [isFirefox, isFirefoxZoomLimited]);
  
  return (
    <div 
      ref={mapContainerRef} 
      style={{ 
        width: '100%', 
        height: '100%',
        ...(isFirefox && {
          transform: 'translateZ(0)',
          backfaceVisibility: 'hidden'
        })
      }}
    >
      {/* Firefox warning display */}
      {isFirefox && (
        <div style={{ 
          position: 'absolute', 
          top: '10px', 
          left: '10px', 
          backgroundColor: 'rgba(0,0,0,0.7)', 
          color: 'white', 
          padding: '5px 10px', 
          borderRadius: '4px',
          fontSize: '12px',
          zIndex: 10
        }}>
          Firefox compatibility mode active. Press 'f' to {isFirefoxZoomLimited ? 'disable' : 'enable'} zoom limits.
        </div>
      )}
      
      {/* Arc browser warning */}
      {isArc && (
        <div style={{ 
          position: 'absolute', 
          top: '10px', 
          left: '10px', 
          backgroundColor: 'rgba(0,0,0,0.7)', 
          color: 'white', 
          padding: '5px 10px', 
          borderRadius: '4px',
          fontSize: '12px',
          zIndex: 10
        }}>
          Arc browser detected - telemetry blocking active.
        </div>
      )}
    </div>
  );
});

export default MapWrapper;