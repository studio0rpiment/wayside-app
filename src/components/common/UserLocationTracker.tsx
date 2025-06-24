// Enhanced UserLocationTracker.tsx - With subtle bearing indicators for both modes
import React, { useEffect, useRef, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import { useDeviceOrientation } from '../../hooks/useDeviceOrientation';

interface UserLocationTrackerProps {
  map: mapboxgl.Map;
  userPosition: [number, number] | null;
  heading?: number | null; // Keep for backward compatibility, but now optional
  accuracy?: number | null;
  minimalMode?: boolean; // NEW: Enable minimal center ball mode
}

const UserLocationTracker: React.FC<UserLocationTrackerProps> = ({ 
  map, 
  userPosition, 
  heading: propHeading, // Rename to avoid confusion with hook heading
  accuracy,
  minimalMode = false // NEW: Default to minimal mode for geofenced experiences
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
  
  // Create minimal center ball marker with subtle bearing triangle
  const createMinimalMarker = useCallback((bearing?: number): HTMLElement => {
    const el = document.createElement('div');
    el.className = 'user-location-marker-minimal';
    el.style.width = '20px';
    el.style.height = '20px';
    el.style.position = 'relative';
    el.style.pointerEvents = 'none';
    el.style.zIndex = '1';
    
    // Calculate final bearing accounting for map rotation
    const mapBearing = map.getBearing();
    const finalBearing = bearing !== undefined ? bearing - mapBearing : 0;
    
    const svgContent = `
      <svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
        <!-- Subtle bearing triangle (behind the circle) -->
        ${bearing !== undefined ? `
          <g transform="rotate(${finalBearing} 10 10)">
            <polygon 
              points="10,3 15,13 5,13" 
              fill="rgba(0, 0, 0, 0.2)" 
              stroke="rgba(0, 0, 0, 0.3)" 
              stroke-width="0.5"
            />
          </g>
        ` : ''}
        
        <!-- Center circle (on top) -->
        <circle 
          cx="10" 
          cy="10" 
          r="5" 
          fill="white" 
          stroke="black" 
          stroke-width="2"
        />
      </svg>
    `;
    
    el.innerHTML = svgContent;
    return el;
  }, [map]);
  
  // Create full SVG location marker with compass bearing and subtle triangle
  const createSvgMarker = useCallback((rotation: number, showWarning: boolean): HTMLElement => {
    const el = document.createElement('div');
    el.className = 'user-location-marker';
    el.style.position = 'relative';
    el.style.width = '40px';
    el.style.height = '40px';
    el.style.pointerEvents = 'none';
    
    // Calculate final rotation accounting for map rotation
    const mapBearing = map.getBearing();
    const finalRotation = rotation - mapBearing;
    
    // Define SVG for location marker with subtle bearing triangle
    const svgContent = `
      <svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 84.24 84.24">
        <defs>
          <style>
            .outer-circle {
              fill: white;
              stroke: black;
              stroke-width: 3;
              transition: all 0.3s ease-out;
            }
            .inner-circle {
              fill: black;
              transition: transform 0.3s ease-out;
            }
            .bearing-triangle {
              fill: rgba(0, 0, 0, 0.15);
              stroke: rgba(0, 0, 0, 0.25);
              stroke-width: 1;
            }
            .warning-triangle {
              fill: #FFD700;
              stroke: #FFA500;
              stroke-width: 1;
              display: ${showWarning ? 'block' : 'none'};
            }
          </style>
        </defs>
        
        <!-- Subtle bearing triangle (behind everything) -->
        <g class="bearing-indicator" transform="rotate(${finalRotation}, 42.12, 42.12)">
          <polygon 
            class="bearing-triangle" 
            points="42.12,10 52.12,32 32.12,32" 
          />
        </g>
        
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
     console.log('🧭 updateUserMarker called with:', {
    position,
    hasMap: !!map,
    mapReady: map?.loaded(),
    minimalMode
  });
  
  if (!map) {
    console.log('❌ No map available for marker update');
    return;
  }
  
  console.log('🧭 Creating marker element...');
  
  // Choose marker type based on mode
  const newElement = minimalMode 
    ? createMinimalMarker(finalHeading || undefined)
    : createSvgMarker(
        finalHeading !== null ? finalHeading : 0,
        !orientationAvailable || finalHeading === null
      );
      
  console.log('🧭 Marker element created:', newElement);
  
    
    // Update existing marker
    if (userMarkerRef.current) {
      userMarkerRef.current.setLngLat(position);
      
      // Replace the marker element
      const oldElement = userMarkerRef.current.getElement();
      if (oldElement.parentNode) {
        oldElement.parentNode.replaceChild(newElement, oldElement);
        // Update the marker's internal reference
        (userMarkerRef.current as any)._element = newElement;
      }
      return;
    }
    
    // Create new marker if needed
    try {
      const marker = new mapboxgl.Marker({
        element: newElement,
        anchor: 'center'
      })
        .setLngLat(position)
        .addTo(map);
      
      userMarkerRef.current = marker;
      
      console.log(`🧭 User location marker created (${minimalMode ? 'minimal' : 'full'} mode)`, {
        position,
        heading: finalHeading,
        orientationAvailable,
        clickThrough: true,
        bearingTriangle: finalHeading !== undefined && finalHeading !== null
      });
    } catch (error) {
      console.error('Error creating user location marker:', error);
    }
  }, [map, createMinimalMarker, createSvgMarker, finalHeading, orientationAvailable, minimalMode]);
  
  // Update marker when position changes
useEffect(() => {
  console.log('🧭 UserLocationTracker position effect triggered:', {
    userPosition,
    hasMap: !!map,
    willUpdate: !!(userPosition && map)
  });
  
  if (userPosition && map) {
    console.log('🧭 Calling updateUserMarker...');
    updateUserMarker(userPosition);
  } else {
    console.log('🧭 Not updating marker:', {
      hasPosition: !!userPosition,
      hasMap: !!map
    });
  }
}, [userPosition, updateUserMarker]);
  
  // Update marker when heading changes (both modes now use bearing)
  useEffect(() => {
    if (userMarkerRef.current && userPosition) {
      updateUserMarker(userPosition);
    }
  }, [finalHeading, orientationAvailable, userPosition, updateUserMarker]);
  
  // Update marker when mode changes
  useEffect(() => {
    if (userMarkerRef.current && userPosition) {
      updateUserMarker(userPosition);
    }
  }, [minimalMode, userPosition, updateUserMarker]);
  
  // Update marker when map bearing changes (both modes need this now)
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