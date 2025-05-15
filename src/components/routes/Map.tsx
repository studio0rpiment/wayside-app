import React, { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { useNavigate } from 'react-router-dom';
import 'mapbox-gl/dist/mapbox-gl.css';
import VerticalSection from '../sections/vertical/VerticalSection';
import PermissionsStatus from '../common/PermissionsStatus';
import { getAssetPath } from '../../utils/assetPaths';
import { routePointsData, getIconPath } from '../../data/mapRouteData';
import { usePermissions } from '../../context/PermissionsContext';
import { PermissionType, PermissionStatus } from '../../utils/permissions';
import UserLocationTracker from '../common/UserLocationTracker';
import GeofenceDebugger from '../debug/GeofenceDebugger'

// Browser detection utilities
const isFirefoxBrowser = (): boolean => {
  // Check if window and navigator exist (for SSR safety)
  if (typeof window === 'undefined' || !window.navigator) {
    return false;
  }
  
  // Check using multiple methods for reliable detection
  const ua = navigator.userAgent;
  
  // Check for common Firefox identifier
  if (ua.indexOf('Firefox') !== -1) {
    return true;
  }
  
  // Check for Gecko engine (all Firefox browsers)
  if (ua.indexOf('Gecko/') !== -1 && ua.indexOf('Firefox') !== -1) {
    return true;
  }
  
  // Feature detection - check for Firefox-specific window property
  // @ts-ignore: Property doesn't exist on Window & GlobalThis
  if (typeof InstallTrigger !== 'undefined') {
    return true;
  }
  
  // Return false if none of the checks match
  return false;
};

const isArcBrowser = (): boolean => {
  if (typeof window === 'undefined' || !window.navigator) {
    return false;
  }
  
  const ua = navigator.userAgent;
  
  // Arc browser detection
  return ua.indexOf('Arc/') !== -1;
};

// Interface for the modal state
interface ModalState {
  isOpen: boolean;
  pointData: any | null;
}

// Access the Mapbox token from environment variables
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

// Attempt to disable telemetry using official methods
try {
  // This property should exist in newer versions
  if (typeof mapboxgl.config === 'object' && mapboxgl.config !== null) {
    console.log('Attempting to disable Mapbox telemetry via official methods');
    
    // For newer versions that might have this method
    if (typeof (mapboxgl as any).setTelemetryEnabled === 'function') {
      (mapboxgl as any).setTelemetryEnabled(false);
      console.log('Telemetry disabled via setTelemetryEnabled');
    }
  }
} catch (e) {
  console.warn('Could not disable Mapbox telemetry directly:', e);
}

// Arc-specific telemetry blocking
if (isArcBrowser()) {
  console.log('Arc browser detected - applying special telemetry blocking');
  
  // Intercept fetch for Arc
  const originalFetch = window.fetch;
  window.fetch = function(input, init) {
    if (input && typeof input === 'string' && 
        (input.includes('events.mapbox.com') || 
         input.includes('api.mapbox.com/events'))) {
      console.log('Arc: Blocked Mapbox telemetry fetch request:', input);
      return Promise.resolve(new Response('{}', { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' } 
      }));
    }
     return originalFetch.call(this, input, init);
  };
  
  // Override XHR for Arc
  const originalXHROpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (
    method: string,
    url: string | URL,
    async?: boolean,
    username?: string | null,
    password?: string | null
  ): void {
    const urlStr = typeof url === 'string' ? url : url.toString();
    if (
      urlStr &&
      (urlStr.includes('events.mapbox.com') ||
        urlStr.includes('api.mapbox.com/events'))
    ) {
      console.log('Arc: Blocked Mapbox telemetry XHR request:', urlStr);
      // Store the original URL for later checking in send()
      (this as any)._url = urlStr;
      return originalXHROpen.call(this, method, 'about:blank', typeof async === 'boolean' ? async : true, username, password);
    }
    return originalXHROpen.call(this, method, url, typeof async === 'boolean' ? async : true, username, password);
  };
  
  // Also intercept WebSocket connections for Arc
  if (typeof WebSocket !== 'undefined') {
    const OriginalWebSocket = window.WebSocket;
    window.WebSocket = function(url: string, protocols?: string | string[]) {
      if (url && typeof url === 'string' && 
          (url.includes('events.mapbox.com') || 
           url.includes('api.mapbox.com'))) {
        console.log('Arc: Blocked Mapbox telemetry WebSocket:', url);
        // Create a dummy WebSocket that never connects
        const fakeWS = {} as WebSocket;
        setTimeout(() => {
          if (typeof fakeWS.onclose === 'function') {
            fakeWS.onclose(new CloseEvent('close'));
          }
        }, 50);
        return fakeWS;
      }
      return new OriginalWebSocket(url, protocols);
    } as any;
  }
}

const Map: React.FC = () => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<mapboxgl.Map | null>(null);
  const [modalState, setModalState] = useState<ModalState>({
    isOpen: false,
    pointData: null
  });
  const [isFirefoxZoomLimited, setIsFirefoxZoomLimited] = useState(true);
  const [userPosition, setUserPosition] = useState<[number, number] | null>(null);
  const { permissionsState } = usePermissions();
  const navigate = useNavigate();
  
  // Browser detection
  const isFirefox = isFirefoxBrowser();
  const isArc = isArcBrowser();
  
  // Handle user position updates from the UserLocationTracker
  const handleUserPositionUpdate = (position: [number, number]) => {
    setUserPosition(position);
    // Optionally do something with the position if needed
  };
  
  // Close modal function
  const closeModal = () => {
    setModalState({
      isOpen: false,
      pointData: null
    });
  };
  
  // Navigate to experience function
  const navigateToExperience = (route: string) => {
    navigate(route);
  };
  
  // Effect for initializing the map
  useEffect(() => {
    // Initialize the map only once when the component mounts
    if (mapContainerRef.current && !map) {
      console.log('User Agent:', navigator.userAgent);
      console.log('Is Firefox browser:', isFirefox);
      console.log('Is Arc browser:', isArc);

      // Exact zoom for non-Firefox, safe zoom for Firefox
      const zoomLevel = isFirefox && isFirefoxZoomLimited ? 15.95 : 16.04;
      console.log(`Using zoom level: ${zoomLevel}`);
      
      // Create map options object
      const mapOptions: mapboxgl.MapOptions = {
        container: mapContainerRef.current,
        style: 'mapbox://styles/mapbox/dark-v11',
        center: [-76.945116, 38.912637], // Center on the specified coordinates
        zoom: zoomLevel,
        bearing: -90.05, // Rotate the map by -90 degrees
        bearingSnap: 0, // Disable auto-snap to north
        preserveDrawingBuffer: isFirefox, // Help with Firefox WebGL rendering
        fadeDuration: isFirefox ? 0 : 300, // Reduce animations in Firefox
        collectResourceTiming: false, // Disable performance data collection
        attributionControl: false, // Remove attribution
      };
      
      // Arc-specific options
      if (isArc) {
        console.log('Using Arc-specific map options');
        Object.assign(mapOptions, {
          // Disable features that might trigger network requests
          refreshExpiredTiles: false,
          fadeDuration: 0,
          cooperativeGestures: true, // Enable cooperative gestures which might help
        });
      }
      
      // Create the map
      const newMap = new mapboxgl.Map(mapOptions);

      // Add minimal attribution in bottom-right
      newMap.addControl(new mapboxgl.AttributionControl({
        compact: true,
        customAttribution: ''
      }), 'bottom-right');

      // Add navigation controls (optional)
      // newMap.addControl(new mapboxgl.NavigationControl(), 'top-right');

      // Save the map instance to state
      setMap(newMap);
      
      // Load the map overlay once the map is loaded
      newMap.on('load', () => {
        // Firefox specific adjustments
        if (isFirefox) {
          console.log('Applying Firefox compatibility features');
          
          // Disable 3D features in Firefox
          if (newMap.setFog) {
            console.log('Disabling fog for Firefox compatibility');
            newMap.setFog(null);
          }
          
          if (newMap.setTerrain) {
            console.log('Disabling terrain for Firefox compatibility');
            newMap.setTerrain(null);
          }
          
          // Monitor zoom to prevent going above safe level in Firefox
          if (isFirefoxZoomLimited) {
            newMap.on('zoom', () => {
              const currentZoom = newMap.getZoom();
              if (currentZoom > 15.95) {
                console.log('Firefox zoom limit exceeded, resetting to safe level');
                newMap.setZoom(15.95);
              }
            });
          }
        }
        
        // Arc-specific adjustments
        if (isArc) {
          console.log('Setting up Arc-specific event handling');
          
          // Intercept any fire/event emission that might trigger telemetry
          if (newMap.fire) {
            const originalFire = newMap.fire;
            newMap.fire = function(event: any, ...args: any[]) {
              // Suppress events that look like telemetry
              const eventName = typeof event === 'string' ? event : event?.type;
              if (typeof eventName === 'string' && 
                  (eventName.startsWith('mapbox.') || 
                   eventName.includes('telemetry') || 
                   eventName.includes('event'))) {
                console.log('Suppressed Mapbox event:', eventName);
                return newMap;
              }
              return originalFire.apply(this, arguments as any);
            };
          }
          
          // Block network requests during user interaction in Arc
          ['mousedown', 'touchstart', 'wheel', 'keydown'].forEach(event => {
            newMap.on(event, () => {
              // Create a temporary stronger block during user interaction
              const originalSend = XMLHttpRequest.prototype.send;
                XMLHttpRequest.prototype.send = function(body?: Document | XMLHttpRequestBodyInit | null): void {
                  if ((this as any)._url && 
                      ((this as any)._url.includes('events.mapbox.com') || 
                      (this as any)._url.includes('api.mapbox.com/events'))) {
                    console.log('Arc: Blocked reactive XHR during user interaction');
                    return;
                  }
                  return originalSend.call(this, body);
                };
              
              // Restore after a short delay
              setTimeout(() => {
                XMLHttpRequest.prototype.send = originalSend;
              }, 100);
            });
          });
        }

        // General telemetry blocking for all browsers
        if (newMap.fire) {
          const originalFire = newMap.fire;
          newMap.fire = function(event: any, ...args: any[]) {
            // Suppress events that look like telemetry
            const eventName = typeof event === 'string' ? event : event?.type;
            if (typeof eventName === 'string' && 
                (eventName.startsWith('mapbox.') || 
                 eventName.includes('telemetry'))) {
              console.log('Suppressed Mapbox event:', eventName);
              return newMap;
            }
            return originalFire.apply(this, arguments as any);
          };
        }

        // Add markers for points of interest
        routePointsData.features.forEach(point => {
          const { iconName } = point.properties;
          
          // Create an HTML element for the custom marker
          const el = document.createElement('div');
          el.className = 'map-icon';
          el.style.backgroundImage = `url(${getIconPath(iconName)})`;
          el.style.width = '30px';
          el.style.height = '30px';
          el.style.backgroundSize = 'cover';
          el.style.cursor = 'pointer';
          
          // Add click event listener to show the modal
          el.addEventListener('click', () => {
            setModalState({
              isOpen: true,
              pointData: point.properties
            });
          });
          
          // Add markers to the map
          new mapboxgl.Marker(el)
            .setLngLat(point.geometry.coordinates)
            .addTo(newMap);
        });

        // Disable rotation
        newMap.dragRotate.disable();
        newMap.touchZoomRotate.disableRotation();
        
        // Add event listener for 'f' key press to toggle Firefox zoom limitation (for testing)
        if (isFirefox) {
          document.addEventListener('keydown', (e) => {
            if (e.key === 'f') {
              setIsFirefoxZoomLimited(!isFirefoxZoomLimited);
              console.log(`Firefox zoom limitation ${isFirefoxZoomLimited ? 'disabled' : 'enabled'}`);
              
              if (!isFirefoxZoomLimited) {
                console.log('Allowing Firefox to zoom freely (may cause rendering issues)');
              } else {
                console.log('Limiting Firefox zoom to safe level (15.95)');
                if (newMap.getZoom() > 15.95) {
                  newMap.setZoom(15.95);
                }
              }
            }
          });
        }
        
        // Add CSS to minimize Mapbox branding
        const style = document.createElement('style');
        style.innerHTML = `
          .mapboxgl-ctrl-logo {
            opacity: 0.3 !important;
            transform: scale(0.8) !important;
          }
          .mapboxgl-ctrl-attrib-inner {
            opacity: 0.3 !important;
            font-size: 9px !important;
          }
        `;
        document.head.appendChild(style);
      });

      // Clean up on unmount
      return () => {
        newMap.remove();
        setMap(null);
        
        // Remove event listeners
        document.removeEventListener('keydown', () => {});
        
        // Remove any added style elements
        const pulseStyle = document.getElementById('pulse-animation');
        if (pulseStyle) {
          document.head.removeChild(pulseStyle);
        }
      };
    }
  }, [mapContainerRef, navigate, isFirefoxZoomLimited, isFirefox, isArc]);

  return (
    <div className="map-route">
      <VerticalSection 
        id="mapSection" 
        title="Map"
        color="transparent"
        height="100vh"  // This sets the height to 100% of the viewport height
        fullHeight={true}
      >
        {/* Map container div */}
        <div 
          ref={mapContainerRef} 
          style={{ 
            position: 'absolute', 
            top: 0, 
            bottom: 0, 
            left: 0, 
            right: 0,
            ...(isFirefox && {
              transform: 'translateZ(0)',
              backfaceVisibility: 'hidden'
            })
          }} 
        />

        {/* User location tracker component */}
        <UserLocationTracker 
          map={map} 
          onPositionUpdate={handleUserPositionUpdate} 
        />
                  
        {/* Minimal permission status indicators */}
        <div style={{ position: 'absolute', bottom: '20px', left: '20px', zIndex: 10 }}>
        
          <PermissionsStatus compact={true} />
          
        </div>
          <GeofenceDebugger userPosition={userPosition} radius={3} />


       
        
        {/* Firefox warning (only shown in Firefox) */}
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
        
        {/* Modal/Popup for AR Experience Entry */}
        {modalState.isOpen && modalState.pointData && (
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
              boxShadow: '0 4px 8px rgba(0, 0, 0, 0.5)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h2 style={{ margin: 0, fontSize: '24px' }}>{modalState.pointData.title}</h2>
              <button 
                onClick={closeModal}
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
            
            {modalState.pointData.modalContent.imageUrl && (
              <div style={{ marginBottom: '15px' }}>
                <img 
                  src={modalState.pointData.modalContent.imageUrl} 
                  alt={modalState.pointData.title}
                  style={{ width: '100%', borderRadius: '8px' }}
                />
              </div>
            )}
            
            <div style={{ marginBottom: '15px' }}>
              <p>{modalState.pointData.modalContent.description}</p>
              
              {modalState.pointData.modalContent.year && (
                <p><strong>Time Period:</strong> {modalState.pointData.modalContent.year}</p>
              )}
              
              {modalState.pointData.modalContent.additionalInfo?.heading && (
                <p><strong>Heading:</strong> {modalState.pointData.modalContent.additionalInfo.heading}</p>
              )}
            </div>
            
            <button
              onClick={() => navigateToExperience(modalState.pointData.modalContent.experienceRoute)}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: 'var(--color-blue)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontFamily: 'var(--font-rigby)',
                fontWeight: '400',
                cursor: 'pointer',
                fontSize: '16px'
              }}
            >
              {modalState.pointData.modalContent.buttonText}
            </button>
          </div>
        )}
        
        {/* Optional overlay for modal background */}
        {modalState.isOpen && (
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
            onClick={closeModal}
          />
        )}
      </VerticalSection>
    </div>
  );
};

export default Map;