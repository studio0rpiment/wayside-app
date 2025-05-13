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

// Access the Mapbox token from environment variables
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

// Most reliable Firefox detection function
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

// Interface for the modal state
interface ModalState {
  isOpen: boolean;
  pointData: any | null;
}

const Map: React.FC = () => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<mapboxgl.Map | null>(null);
  const [modalState, setModalState] = useState<ModalState>({
    isOpen: false,
    pointData: null
  });
  const [isFirefoxZoomLimited, setIsFirefoxZoomLimited] = useState(true);
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const [userPosition, setUserPosition] = useState<[number, number] | null>(null);
  const { permissionsState } = usePermissions();
  const navigate = useNavigate();
  
  // Detect Firefox browser
  const isFirefox = isFirefoxBrowser();
  
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
  
  // Function to create a pulsing dot element for user location
  const createPulsingDot = () => {
    const el = document.createElement('div');
    el.className = 'user-location-dot';
    
    // Create inner dot
    const innerDot = document.createElement('div');
    innerDot.className = 'inner-dot';
    innerDot.style.width = '10px';
    innerDot.style.height = '10px';
    innerDot.style.borderRadius = '50%';
    innerDot.style.backgroundColor = 'var(--color-light)';
    innerDot.style.boxShadow = '0 0 2px rgba(0, 0, 0, 0.5)';
    innerDot.style.position = 'absolute';
    innerDot.style.top = '50%';
    innerDot.style.left = '50%';
    innerDot.style.transform = 'translate(-50%, -50%)';
    
    // Create pulse effect
    const pulseRing = document.createElement('div');
    pulseRing.className = 'pulse-ring';
    pulseRing.style.width = '100%';
    pulseRing.style.height = '100%';
    pulseRing.style.borderRadius = '50%';
    pulseRing.style.animation = 'pulse 2s infinite';
    pulseRing.style.position = 'absolute';
    pulseRing.style.top = '0';
    pulseRing.style.left = '0';
    
    // Create container for the dot
    const container = document.createElement('div');
    container.style.width = '30px';
    container.style.height = '30px';
    container.style.position = 'relative';
    
    // Add elements to DOM
    container.appendChild(pulseRing);
    container.appendChild(innerDot);
    el.appendChild(container);
    
    // Add keyframes for pulse animation if it doesn't exist yet
    if (!document.querySelector('#pulse-animation')) {
      const style = document.createElement('style');
      style.id = 'pulse-animation';
      style.innerHTML = `
        @keyframes pulse {
          0% {
            transform: scale(0.5);
            background-color: rgba(255, 255, 240, 0.8);
            opacity: 1;
          }
          70% {
            background-color: rgba(255, 255, 240, 0.2);
            opacity: 0.5;
            transform: scale(1.5);
          }
          100% {
            background-color: rgba(255, 255, 240, 0);
            opacity: 0;
            transform: scale(2);
          }
        }
      `;
      document.head.appendChild(style);
    }
    
    return el;
  };
  
  // Effect for initializing the map
  useEffect(() => {
    // Initialize the map only once when the component mounts
    if (mapContainerRef.current && !map) {
      console.log('User Agent:', navigator.userAgent);
      console.log('Is Firefox browser:', isFirefox);

      // Exact zoom for non-Firefox, safe zoom for Firefox
      const zoomLevel = isFirefox && isFirefoxZoomLimited ? 15.95 : 16.04;
      console.log(`Using zoom level: ${zoomLevel}`);
      
      // Create the map with browser-specific settings
      const newMap = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: 'mapbox://styles/mapbox/dark-v11',
        center: [-76.945116, 38.912637], // Center on the specified coordinates
        zoom: zoomLevel,
        bearing: -90.05, // Rotate the map by -90 degrees
        bearingSnap: 0, // Disable auto-snap to north
        preserveDrawingBuffer: isFirefox, // Help with Firefox WebGL rendering
        fadeDuration: isFirefox ? 0 : 300, // Reduce animations in Firefox
        attributionControl: false // Remove attribution
      });

      // Add minimal attribution in bottom-right
      newMap.addControl(new mapboxgl.AttributionControl({
        compact: true,
        customAttribution: ''
      }), 'bottom-right');

      // Add navigation controls (optional)
      newMap.addControl(new mapboxgl.NavigationControl(), 'top-right');

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
        
        // Remove the user marker if it exists
        if (userMarkerRef.current) {
          userMarkerRef.current.remove();
          userMarkerRef.current = null;
        }
        
        // Remove event listeners
        document.removeEventListener('keydown', () => {});
        
        // Remove any added style elements
        const pulseStyle = document.getElementById('pulse-animation');
        if (pulseStyle) {
          document.head.removeChild(pulseStyle);
        }
      };
    }
  }, [mapContainerRef, navigate, isFirefoxZoomLimited, isFirefox]);

  // Effect for watching user location when permission is granted
  useEffect(() => {
    // Only proceed if map is loaded and location permission is granted
    const hasLocationPermission = permissionsState?.results[PermissionType.LOCATION] === PermissionStatus.GRANTED;
    
    if (map && hasLocationPermission) {
      console.log('Location permission granted, watching position');
      
      // Start watching the user's position
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          const newPosition: [number, number] = [position.coords.longitude, position.coords.latitude];
          setUserPosition(newPosition);
          console.log('User position updated:', newPosition);
        },
        (error) => {
          console.error('Error getting location:', error);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 10000, // Accept positions up to 10 seconds old
          timeout: 5000     // Wait up to 5 seconds for a position
        }
      );
      
      // Clean up the watcher when the component unmounts or permissions change
      return () => {
        navigator.geolocation.clearWatch(watchId);
      };
    }
  }, [map, permissionsState]);

  // Effect for updating the user marker when position changes
  useEffect(() => {
    if (map && userPosition) {
      // If we already have a marker, just update its position
      if (userMarkerRef.current) {
        userMarkerRef.current.setLngLat(userPosition);
      } else {
        // Create a new marker with the pulsing dot
        const el = createPulsingDot();
        const marker = new mapboxgl.Marker({
          element: el,
          anchor: 'center'
        })
          .setLngLat(userPosition)
          .addTo(map);
        
        userMarkerRef.current = marker;
      }
    }
  }, [map, userPosition]);

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
          
        {/* Minimal permission status indicators */}
        <div style={{ position: 'absolute', bottom: '20px', left: '20px', zIndex: 10 }}>
          <PermissionsStatus compact={true} />
        </div>
        
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



//**************************
        // BELOW IS THE CODE FOR TRYING TO MANUALLY OVERLAY THE MAP IMAGE ONTO THE ACTUAL MAP --GOES IN THE  newMap.on('load',() => {}
// ***********************/
     
        // const updateOverlayToViewport = (): void => {
        //   // Get current viewport bounds
        //   const bounds = newMap.getBounds();
        //   if (!bounds) return; // Exit if bounds are null
          
        //   // Extract the corner coordinates
        //   const sw: mapboxgl.LngLat = bounds.getSouthWest(); // Bottom left
        //   const se: mapboxgl.LngLat = bounds.getSouthEast(); // Bottom right
        //   const ne: mapboxgl.LngLat = bounds.getNorthEast(); // Top right 
        //   const nw: mapboxgl.LngLat = bounds.getNorthWest(); // Top left
          
        //   // Define overlay coordinates to match the viewport
        //   const overlayCoordinates: [[number, number], [number, number], [number, number], [number, number]] = [
        //     [nw.lng, nw.lat], // Northwest (top left)
        //     [ne.lng, ne.lat], // Northeast (top right)
        //     [se.lng, se.lat], // Southeast (bottom right)
        //     [sw.lng, sw.lat]  // Southwest (bottom left)
        //   ];
          
        //   // Log the viewport-based coordinates
        //   console.log('Viewport-based overlay coordinates:', 
        //     JSON.stringify(overlayCoordinates.map(coord => 
        //       [parseFloat(coord[0].toFixed(6)), parseFloat(coord[1].toFixed(6))]
        //   )));
          
        //   // If overlay source already exists, update it
        //   if (newMap.getSource('overlay-image')) {
        //     const source = newMap.getSource('overlay-image') as mapboxgl.ImageSource;
        //     source.setCoordinates(overlayCoordinates);
        //   } else {
        //     // Initialize overlay for the first time
        //     newMap.addSource('overlay-image', {
        //       'type': 'image',
        //       'url': getAssetPath('img/MapOverlay.jpg'),
        //       'coordinates': overlayCoordinates as [[number, number], [number, number], [number, number], [number, number]]
        //     });
        //     document.addEventListener('keydown', (e) => {
        //       if (e.key === 'p') {
        //         newMap.addLayer({
        //           'id': 'overlay-layer',
        //           'type': 'raster',
        //           'source': 'overlay-image',
        //           'paint': {
        //             'raster-opacity': 0.3,
        //             'raster-fade-duration': 0 
        //           }
        //         });
        //       }})
          
        //   }
        // };
        
        // Initial setup of overlay based on current viewport
        // updateOverlayToViewport();
        
        // Add a button to reset the overlay to match the current viewport
        // const resetButton = document.createElement('button');
        // resetButton.textContent = 'Fit Overlay to Viewport';
        // resetButton.style.position = 'absolute';
        // resetButton.style.zIndex = '10';
        // resetButton.style.top = '70px';
        // resetButton.style.right = '10px';
        // resetButton.style.padding = '8px 12px';
        // resetButton.style.backgroundColor = '#3b88c3';
        // resetButton.style.color = 'white';
        // resetButton.style.border = 'none';
        // resetButton.style.borderRadius = '4px';
        // resetButton.style.cursor = 'pointer';
        // resetButton.onclick = updateOverlayToViewport;
        
        // if (mapContainerRef.current) {
        //   mapContainerRef.current.appendChild(resetButton);
        // }
        
        // Update overlay when map is moved
        // Comment out the next line if you only want manual updates via the button
        // newMap.on('moveend', updateOverlayToViewport);
//**************************
        // END 
// ***********************/