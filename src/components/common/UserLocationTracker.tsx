// UserLocationTracker.tsx
import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { usePermissions } from '../../context/PermissionsContext';
import { PermissionType, PermissionStatus } from '../../utils/permissions';

// Props interface
interface UserLocationTrackerProps {
  map: mapboxgl.Map | null;
  onPositionUpdate?: (position: [number, number]) => void;
}

// Component
const UserLocationTracker: React.FC<UserLocationTrackerProps> = ({ map, onPositionUpdate }) => {
  // State and refs
  const [userPosition, setUserPosition] = useState<[number, number] | null>(null);
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const { permissionsState } = usePermissions();
  
  // Create pulsing dot function
  const createPulsingDot = (): HTMLElement => {
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
  
  // Effect for watching user location when permission is granted
  useEffect(() => {
    // Only proceed if map is loaded and location permission is granted
    const hasLocationPermission = permissionsState?.results[PermissionType.LOCATION] === PermissionStatus.GRANTED;
    
    if (map && hasLocationPermission) {
      // console.log('Location permission granted, watching position');
      
      

      // Start watching the user's position
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          const newPosition: [number, number] = [position.coords.longitude, position.coords.latitude];
          setUserPosition(newPosition);
          
          // Call the callback if it exists
          if (onPositionUpdate) {
            onPositionUpdate(newPosition);
          }
          
        //  console.log('User position updated:', newPosition);
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
        
        // Also remove the marker if it exists on permission change
        if (userMarkerRef.current) {
          userMarkerRef.current.remove();
          userMarkerRef.current = null;
        }
      };
    }
  }, [map, permissionsState, onPositionUpdate]);

  useEffect(() => {
  // Feature detection for WebSockets
  if (typeof WebSocket !== 'undefined') {
    const originalWebSocket = window.WebSocket;
    
    // Override WebSocket to add error handling
    window.WebSocket = function(url: string | URL, protocols?: string | string[]) {
      const socket = new originalWebSocket(url, protocols);
      
      socket.addEventListener('error', (error) => {
        console.warn('WebSocket connection error:', error);
        // Implement fallback behavior if needed
      });
      
      return socket;
    } as any;
    
    // Restore original WebSocket on cleanup
    return () => {
      window.WebSocket = originalWebSocket;
    };
  }
}, []);

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
  
  // Cleanup on unmount
  useEffect(() => {
    return () => { 
      // Remove the user marker if it exists
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }

      // Remove any added style elements
      const pulseStyle = document.getElementById('pulse-animation');
      if (pulseStyle) {
        document.head.removeChild(pulseStyle);
      }
    };
  }, []);
  
  // The component doesn't render anything visible directly
  return null;
};

export default UserLocationTracker;