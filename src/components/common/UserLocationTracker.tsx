// Updated UserLocationTracker.tsx - Now with device orientation support
import React, { useEffect, useRef, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import { useDeviceOrientation } from '../../hooks/useDeviceOrientation';

interface UserLocationTrackerProps {
  map: mapboxgl.Map;
  userPosition: [number, number] | null;
  heading?: number | null; // Keep for backward compatibility, but now optional
  accuracy?: number | null;
}

const UserLocationTracker: React.FC<UserLocationTrackerProps> = ({ 
  map, 
  userPosition, 
  heading: propHeading, // Rename to avoid confusion with hook heading
  accuracy 
}) => {
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
  
  // Use the new device orientation hook
  const { 
    heading: deviceHeading, 
    isAvailable: orientationAvailable, 
    error: orientationError,
    accuracy: compassAccuracy 
  } = useDeviceOrientation({ 
    enableSmoothing: true, 
    fallbackHeading: 0, // Point north when no orientation
    debugMode: false // Set to true for debugging
  });

  // Determine which heading to use (prop takes precedence for backward compatibility)
  const finalHeading = propHeading !== undefined ? propHeading : deviceHeading;
  
  // Create SVG location marker with compass bearing
  const createSvgMarker = useCallback((rotation: number, showWarning: boolean): HTMLElement => {
    const el = document.createElement('div');
    el.className = 'user-location-marker';
    el.style.position = 'relative';
    el.style.width = '40px';
    el.style.height = '40px';
    
    // Calculate final rotation accounting for map rotation
    const mapBearing = map.getBearing();
    const finalRotation = rotation - mapBearing;
    
    // Define SVG for location marker
    const svgContent = `
      <svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 84.24 84.24">
        <defs>
          <style>
            .outer-circle {
              fill: #FFFFF0;
              stroke: #282C35;
              stroke-width: 4;
              transition: all 0.3s ease-out;
            }
            .inner-circle {
              fill: #282C35;
              transition: transform 0.3s ease-out;
            }
            .warning-triangle {
              fill: #FFD700;
              stroke: #FFA500;
              stroke-width: 1;
              display: ${showWarning ? 'block' : 'none'};
            }
          </style>
        </defs>
        
        <!-- Outer circle (location indicator) -->
        <circle class="outer-circle" cx="42.12" cy="42.12" r="19"/>
        
        <!-- Inner circle (bearing indicator) that rotates -->
        <g class="bearing-indicator" transform="rotate(${finalRotation}, 42.12, 42.12)">
          <circle class="inner-circle" cx="42.12" cy="32.12" r="7"/>
        </g>
        
        <!-- Warning triangle (shown when no orientation available) -->
        ${showWarning ? `
          <g class="warning-indicator">
            <polygon class="warning-triangle" points="42.12,15 37.12,25 47.12,25" />
            <text x="42.12" y="22" text-anchor="middle" font-size="8" fill="#000">!</text>
          </g>
        ` : ''}
      </svg>
    `;
    
    el.innerHTML = svgContent;
    return el;
  }, [map]);
  
  // Update marker position and appearance
  const updateUserMarker = useCallback((position: [number, number]) => {
    if (!map) return;
    
    const heading = finalHeading !== null ? finalHeading : 0;
    const showWarning = !orientationAvailable || finalHeading === null;
    
    // Update existing marker
    if (userMarkerRef.current) {
      userMarkerRef.current.setLngLat(position);
      
      // Recreate the marker element with new rotation
      // This is more reliable than trying to update SVG transform
      const newElement = createSvgMarker(heading, showWarning);
      const oldElement = userMarkerRef.current.getElement();
      
      // Replace the element
      if (oldElement.parentNode) {
        oldElement.parentNode.replaceChild(newElement, oldElement);
        // Update the marker's internal reference
        (userMarkerRef.current as any)._element = newElement;
      }
      return;
    }
    
    // Create new marker if needed
    try {
      const el = createSvgMarker(heading, showWarning);
      const marker = new mapboxgl.Marker({
        element: el,
        anchor: 'center'
      })
        .setLngLat(position)
        .addTo(map);
      
      userMarkerRef.current = marker;
      
      // console.log('🧭 User location marker created', {
      //   position,
      //   heading,
      //   orientationAvailable,
      //   showWarning
      // });
    } catch (error) {
      console.error('Error creating user location marker:', error);
    }
  }, [map, createSvgMarker, finalHeading, orientationAvailable]);
  
  // Update marker when position changes
  useEffect(() => {
    if (userPosition && map) {
      updateUserMarker(userPosition);
    }
  }, [userPosition, updateUserMarker]);
  
  // Update marker when heading changes (including map rotation)
  useEffect(() => {
    if (userMarkerRef.current && userPosition) {
      updateUserMarker(userPosition);
    }
  }, [finalHeading, orientationAvailable, userPosition, updateUserMarker]);
  
  // Update marker when map bearing changes
  useEffect(() => {
    const handleMapRotate = () => {
      if (userMarkerRef.current && userPosition) {
        updateUserMarker(userPosition);
      }
    };
    
    map.on('rotate', handleMapRotate);
    
    return () => {
      map.off('rotate', handleMapRotate);
    };
  }, [map, userPosition, updateUserMarker]);
  
  // Log orientation status for debugging
  useEffect(() => {
    if (orientationError) {
      console.warn('🧭 Device orientation error:', orientationError);
    }
  }, [orientationError]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }
    };
  }, []);
  
  // This component is purely visual, so it doesn't render any JSX
  return null;
};

export default UserLocationTracker;