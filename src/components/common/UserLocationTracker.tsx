// Updated UserLocationTracker with SVG location marker
import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import { usePermissions } from '../../context/PermissionsContext';
import { PermissionType, PermissionStatus } from '../../utils/permissions';

interface UserLocationTrackerProps {
  map: mapboxgl.Map;
  onPositionUpdate?: (position: [number, number]) => void;
}

const UserLocationTracker: React.FC<UserLocationTrackerProps> = ({ map, onPositionUpdate }) => {
  const [userPosition, setUserPosition] = useState<[number, number] | null>(null);
  const [userBearing, setUserBearing] = useState<number>(0); 
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const { permissionsState } = usePermissions();
  
  // Create SVG location marker with arrow
  const createSvgMarker = useCallback((): HTMLElement => {
    // Create container div
    const el = document.createElement('div');
    el.className = 'user-location-marker';
    el.style.position = 'relative';
    el.style.width = '40px';
    el.style.height = '40px';
    
    // Define SVG for location marker
    const svgContent = `
      <?xml version="1.0" encoding="UTF-8"?>
<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 84.24 84.24">
  <defs>
    <style>
      .outer-circle {
        fill: none;
        stroke: #FFFFF0;
        stroke-width: 2.5;
      }
      .inner-circle {
        fill: #FFFFF0;
      }
     
    </style>
  </defs>
  <g id="location-marker">
    <!-- Outer circle (location indicator) - just the outline -->
    <circle class="outer-circle" cx="42.12" cy="42.12" r="19"/>

    <!-- Inner circle (bearing indicator) that will rotate -->
    <g class="bearing-indicator" transform="rotate(${userBearing}, 42.12, 42.12)">
      <!-- This circle is positioned at the edge of the outer circle -->
      <circle class="inner-circle" cx="42.12" cy="35.12" r="8"/>
    </g>
  </g>
</svg>
    `;
    
    // Set the SVG content
    el.innerHTML = svgContent;
    
    return el;
  }, [userBearing]);
  
  // Update marker rotation
  const updateMarkerRotation = useCallback((bearing: number) => {
    if (userMarkerRef.current) {
      const element = userMarkerRef.current.getElement();
      const arrowElement = element.querySelector('.compass-arrow');
      if (arrowElement) {
        arrowElement.setAttribute('style', `transform-origin: 42.12px 42.12px; transform: rotate(${bearing}deg);`);
      }
    }
  }, []);
  
  // Handle marker updates
  const updateUserMarker = useCallback((position: [number, number]) => {
    if (!map) return;
    
    // Update existing marker position
    if (userMarkerRef.current) {
      userMarkerRef.current.setLngLat(position);
      return;
    }
    
    // Create new marker if needed
    try {
      const el = createSvgMarker();
      const marker = new mapboxgl.Marker({
        element: el,
        anchor: 'center'
      })
        .setLngLat(position)
        .addTo(map);
      
      userMarkerRef.current = marker;
    } catch (error) {
      console.error('Error creating marker:', error);
    }
  }, [map, createSvgMarker]);
  
  // Handle device orientation events
  const handleOrientation = useCallback((event: DeviceOrientationEvent) => {
    // Check if we have compass data
    if (event.alpha !== null) {
      let bearing = event.alpha;
      
      // iOS-specific compass reading
      const webkitCompassHeading = (event as any).webkitCompassHeading;
      if (webkitCompassHeading !== undefined) {
        bearing = webkitCompassHeading;
      }
      
      setUserBearing(bearing);
      updateMarkerRotation(bearing);
    }
  }, [updateMarkerRotation]);
  
  // Setup location tracking
  useEffect(() => {
    // Only proceed if we have map and location permission
    const hasLocationPermission = permissionsState?.results[PermissionType.LOCATION] === PermissionStatus.GRANTED;
    if (!map || !hasLocationPermission) return;
    
    // Clear any existing watch
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    
    // Geolocation options
    const options = {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 10000
    };
    
    // Start watching position
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const newPosition: [number, number] = [
          position.coords.longitude, 
          position.coords.latitude
        ];
        
        // Update position
        setUserPosition(newPosition);
        if (onPositionUpdate) {
          onPositionUpdate(newPosition);
        }
        
        // Update marker
        updateUserMarker(newPosition);
        
        // Check for heading from GPS
        if (position.coords.heading !== null && position.coords.heading !== undefined) {
          setUserBearing(position.coords.heading);
          updateMarkerRotation(position.coords.heading);
        }
      },
      (error) => {
        console.error('Error getting location:', error);
      },
      options
    );
    
    watchIdRef.current = watchId;
    
    // Try to use device orientation for compass
    if ('DeviceOrientationEvent' in window) {
      if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
        // iOS requires permission
        const requestPermission = () => {
          (DeviceOrientationEvent as any).requestPermission()
            .then((response: string) => {
              if (response === 'granted') {
                window.addEventListener('deviceorientation', handleOrientation);
              }
            })
            .catch((error: any) => {
              console.error('Error requesting device orientation permission:', error);
            });
        };
        
        // Add a button to request permission
        const permButton = document.createElement('button');
        permButton.textContent = 'Enable Compass';
        permButton.style.position = 'fixed';
        permButton.style.bottom = '100px';
        permButton.style.left = '50%';
        permButton.style.transform = 'translateX(-50%)';
        permButton.style.padding = '10px 20px';
        permButton.style.backgroundColor = '#4889c8';
        permButton.style.color = 'white';
        permButton.style.border = 'none';
        permButton.style.borderRadius = '4px';
        permButton.style.zIndex = '1000';
        
        permButton.addEventListener('click', () => {
          requestPermission();
          document.body.removeChild(permButton);
        });
        
        document.body.appendChild(permButton);
        
        // Auto-remove button after 10 seconds
        setTimeout(() => {
          if (document.body.contains(permButton)) {
            document.body.removeChild(permButton);
          }
        }, 10000);
      } else {
        // Other browsers don't need permission
        window.addEventListener('deviceorientation', handleOrientation);
      }
    }
    
    // Cleanup function
    return () => {
      // Clear location watch
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      
      // Remove orientation listener
      window.removeEventListener('deviceorientation', handleOrientation);
      
      // Remove marker
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }
    };
  }, [map, permissionsState, onPositionUpdate, updateUserMarker, handleOrientation]);
  
  return null;
};

export default UserLocationTracker;