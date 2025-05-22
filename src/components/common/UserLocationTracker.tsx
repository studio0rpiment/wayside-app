// Updated UserLocationTracker.tsx - Visual representation only
import React, { useEffect, useRef, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';



interface UserLocationTrackerProps {
  map: mapboxgl.Map;
  userPosition: [number, number] | null;
  heading?: number | null;
  accuracy?: number | null;
}


const UserLocationTracker: React.FC<UserLocationTrackerProps> = ({ 
  map, 
  userPosition, 
  heading,
  accuracy 
}) => {
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
  
  // Create SVG location marker with arrow
  const createSvgMarker = useCallback((): HTMLElement => {
    const el = document.createElement('div');
    el.className = 'user-location-marker';
    el.style.position = 'relative';
    el.style.width = '40px';
    el.style.height = '40px';
    
    // Define SVG for location marker (using your existing design)
    const svgContent = `
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
          <!-- Outer circle (location indicator) -->
          <circle class="outer-circle" cx="42.12" cy="42.12" r="19"/>
          
          <!-- Inner circle (bearing indicator) that will rotate -->
          <g class="bearing-indicator" transform="rotate(${heading || 0}, 42.12, 42.12)">
            <circle class="inner-circle" cx="42.12" cy="35.12" r="8"/>
          </g>
        </g>
      </svg>
    `;
    
    el.innerHTML = svgContent;
    return el;
  }, [heading]);
  
  // Update marker position and appearance
  const updateUserMarker = useCallback((position: [number, number]) => {
    if (!map) return;
    
    // Update existing marker position
    if (userMarkerRef.current) {
      userMarkerRef.current.setLngLat(position);
      
      // Update the marker's SVG if heading changed
      const element = userMarkerRef.current.getElement();
      const bearingGroup = element.querySelector('.bearing-indicator');
      if (bearingGroup && heading !== null) {
        bearingGroup.setAttribute('transform', `rotate(${heading}, 42.12, 42.12)`);
      }
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
      console.error('Error creating user location marker:', error);
    }
  }, [map, createSvgMarker, heading]);
  
  // Update marker when position changes
  useEffect(() => {
    if (userPosition && map) {
      updateUserMarker(userPosition);
    }
  }, [userPosition, updateUserMarker]);
  
  // Update marker rotation when heading changes
  useEffect(() => {
    if (userMarkerRef.current && heading !== null) {
      const element = userMarkerRef.current.getElement();
      const bearingGroup = element.querySelector('.bearing-indicator');
      if (bearingGroup) {
        bearingGroup.setAttribute('transform', `rotate(${heading}, 42.12, 42.12)`);
      }
    }
  }, [heading]);
  
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