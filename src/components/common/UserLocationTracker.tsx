// Modified UserLocationTracker.tsx to fix the infinite loop
import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import { usePermissions } from '../../context/PermissionsContext';
import { PermissionType, PermissionStatus } from '../../utils/permissions';

interface UserLocationTrackerProps {
  map: mapboxgl.Map | null;
  onPositionUpdate?: (position: [number, number]) => void;
}

const UserLocationTracker: React.FC<UserLocationTrackerProps> = ({ map, onPositionUpdate }) => {
  const [userPosition, setUserPosition] = useState<[number, number] | null>(null);
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const checkTimerRef = useRef<number | null>(null);
  const { permissionsState } = usePermissions();
  
  // Create pulsing dot function - memoize to prevent recreating on each render
  const createPulsingDot = useCallback((): HTMLElement => {
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
  }, []);
  
  // Handle marker updates in a separate, memoized function
  const updateMarker = useCallback((position: [number, number]) => {
    if (!map) return;
    
    if (userMarkerRef.current) {
      userMarkerRef.current.setLngLat(position);
    } else {
      try {
        const el = createPulsingDot();
        const marker = new mapboxgl.Marker({
          element: el,
          anchor: 'center'
        })
          .setLngLat(position)
          .addTo(map);
        
        userMarkerRef.current = marker;
      } catch (error) {
        console.error('Error creating pulsing dot marker:', error);
      }
    }
  }, [map, createPulsingDot]);
  
  // Check if the marker needs to be recreated
  const checkMarkerVisibility = useCallback(() => {
    if (!userPosition || !userMarkerRef.current) return;
    
    const el = userMarkerRef.current.getElement();
    const pulseRing = el.querySelector('.pulse-ring');
    
    if (!pulseRing || getComputedStyle(pulseRing).animation === 'none') {
      // Cleanup old marker first
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
      
      // Create a new marker - use the existing updateMarker function
      updateMarker(userPosition);
    }
  }, [userPosition, updateMarker]);
  
  // Effect for watching user location when permission is granted
  useEffect(() => {
    const hasLocationPermission = permissionsState?.results[PermissionType.LOCATION] === PermissionStatus.GRANTED;
    
    if (map && hasLocationPermission) {
      // Clear previous watch if it exists
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          const newPosition: [number, number] = [position.coords.longitude, position.coords.latitude];
          setUserPosition(newPosition);
          
          if (onPositionUpdate) {
            onPositionUpdate(newPosition);
          }
        },
        (error) => {
          console.error('Error getting location:', error);
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const newPosition: [number, number] = [position.coords.longitude, position.coords.latitude];
              setUserPosition(newPosition);
              if (onPositionUpdate) onPositionUpdate(newPosition);
            },
            (fallbackError) => console.error('Fallback location error:', fallbackError),
            { enableHighAccuracy: true, timeout: 10000 }
          );
        },
        {
          enableHighAccuracy: true,
          maximumAge: 5000,
          timeout: 10000
        }
      );
      
      watchIdRef.current = watchId;
      
      return () => {
        if (watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = null;
        }
        
        if (userMarkerRef.current) {
          userMarkerRef.current.remove();
          userMarkerRef.current = null;
        }
      };
    }
  }, [map, permissionsState, onPositionUpdate]);
  
  // Effect for updating the user marker when position changes
  useEffect(() => {
    if (!map || !userPosition) return;
    
    // Update the marker position
    updateMarker(userPosition);
    
    // Set up a periodic check for marker visibility
    if (checkTimerRef.current) {
      window.clearTimeout(checkTimerRef.current);
    }
    
    // Schedule a single check after 1 second
    checkTimerRef.current = window.setTimeout(() => {
      checkMarkerVisibility();
      checkTimerRef.current = null;
    }, 1000);
    
    return () => {
      if (checkTimerRef.current) {
        window.clearTimeout(checkTimerRef.current);
        checkTimerRef.current = null;
      }
    };
  }, [map, userPosition, updateMarker, checkMarkerVisibility]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => { 
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }

      const pulseStyle = document.getElementById('pulse-animation');
      if (pulseStyle) {
        document.head.removeChild(pulseStyle);
      }
      
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      
      if (checkTimerRef.current) {
        window.clearTimeout(checkTimerRef.current);
        checkTimerRef.current = null;
      }
    };
  }, []);
  
  return null;
};

export default UserLocationTracker;