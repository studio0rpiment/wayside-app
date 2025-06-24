// Enhanced UserLocationTracker.tsx - With direction beam and widget mode
import React, { useEffect, useRef, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import { useDeviceOrientation } from '../../hooks/useDeviceOrientation';

interface UserLocationTrackerProps {
  map?: mapboxgl.Map | null; // Made optional for widget mode
  userPosition: [number, number] | null;
  heading?: number | null; // Keep for backward compatibility, but now optional
  accuracy?: number | null;
  minimalMode?: boolean; // Enable minimal center ball mode
  
  // NEW: Widget mode props
  widgetMode?: boolean; // Don't add to map, just render as widget
  showDirectionBeam?: boolean; // Show direction beam pointing to target
  targetBearing?: number | null; // Bearing to target location
  size?: number; // Widget size in pixels (default 40)
  
  // NEW: Direction beam customization
  beamLength?: number; // How far the beam extends as multiplier of radius (default 2.5)
  beamAngle?: number;  // Beam width in degrees (default 30)
  beamGradient?: boolean; // Use gradient (default true)
}

const UserLocationTracker: React.FC<UserLocationTrackerProps> = ({ 
  map, 
  userPosition, 
  heading: propHeading, 
  accuracy,
  minimalMode = false,
  widgetMode = false,
  showDirectionBeam = true,
  targetBearing = null,
  size = 40,
  beamLength = 2.5,
  beamAngle = 30,
  beamGradient = true
}) => {
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const widgetRef = useRef<HTMLDivElement | null>(null);
  
  // Use the new device orientation hook
  const { 
    heading: deviceHeading, 
    isAvailable: orientationAvailable, 
    error: orientationError,
    accuracy: compassAccuracy 
  } = useDeviceOrientation({ 
    enableSmoothing: true, 
    fallbackHeading: 0, // Point north when no orientation
    debugMode: false
  });

  // Determine which heading to use (prop takes precedence for backward compatibility)
  const finalHeading = propHeading !== undefined ? propHeading : deviceHeading;
  
  // Create minimal center ball marker with subtle bearing triangle
  const createMinimalMarker = useCallback((bearing?: number): HTMLElement => {
    const el = document.createElement('div');
    el.className = 'user-location-marker-minimal';
    el.style.width = `${size / 2}px`;
    el.style.height = `${size / 2}px`;
    el.style.position = 'relative';
    el.style.pointerEvents = 'none';
    el.style.zIndex = '1';
    
    // Calculate final bearing accounting for map rotation (if map exists)
    const mapBearing = map?.getBearing() || 0;
    const finalBearing = bearing !== undefined ? bearing - mapBearing : 0;
    
    const viewBoxSize = size / 2;
    const center = viewBoxSize / 2;
    const radius = center - 2;
    
    const svgContent = `
      <svg width="${viewBoxSize}" height="${viewBoxSize}" viewBox="0 0 ${viewBoxSize} ${viewBoxSize}" xmlns="http://www.w3.org/2000/svg">
        <!-- Subtle bearing triangle (behind the circle) -->
        ${bearing !== undefined ? `
          <g transform="rotate(${finalBearing} ${center} ${center})">
            <polygon 
              points="${center},${center/3} ${center + radius/2},${center + radius/2} ${center - radius/2},${center + radius/2}" 
              fill="rgba(0, 0, 0, 0.2)" 
              stroke="rgba(0, 0, 0, 0.3)" 
              stroke-width="0.5"
            />
          </g>
        ` : ''}
        
        <!-- Center circle (on top) -->
        <circle 
          cx="${center}" 
          cy="${center}" 
          r="${radius}" 
          fill="white" 
          stroke="black" 
          stroke-width="2"
        />
      </svg>
    `;
    
    el.innerHTML = svgContent;
    return el;
  }, [map, size]);
  
  // Create full SVG location marker with compass bearing and direction beam
  const createSvgMarker = useCallback((rotation: number, showWarning: boolean, targetBearing?: number | null): HTMLElement => {
    const el = document.createElement('div');
    el.className = widgetMode ? 'user-location-widget' : 'user-location-marker';
    el.style.position = 'relative';
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.pointerEvents = 'none';
    
    // Calculate final rotation accounting for map rotation (if map exists)
    const mapBearing = map?.getBearing() || 0;
    const finalRotation = rotation - mapBearing;
    
    // Calculate target direction beam rotation - FIXED for widget mode
    let targetRotation = null;
    if (targetBearing !== null && targetBearing !== undefined) {
      if (widgetMode) {
        // Widget mode: rotate relative to device heading
        targetRotation = targetBearing - rotation;
      } else {
        // Map mode: account for map bearing
        targetRotation = targetBearing - mapBearing;
      }
    }
    
    const center = size / 2;
    const radius = center - 2;
    const beamRadius = radius * beamLength;
    
    // Calculate beam arc points using trigonometry
    const halfAngleRad = (beamAngle / 2) * (Math.PI / 180);
    const leftAngle = -halfAngleRad;
    const rightAngle = halfAngleRad;
    
    // Calculate outer arc points
    const leftX = center + beamRadius * Math.sin(leftAngle);
    const leftY = center - beamRadius * Math.cos(leftAngle);
    const rightX = center + beamRadius * Math.sin(rightAngle);
    const rightY = center - beamRadius * Math.cos(rightAngle);
    
    // Determine if we need a large arc (for angles > 180°)
    const largeArcFlag = beamAngle > 180 ? 1 : 0;
  
    
    // Define SVG for location marker with enhanced direction beam
    const svgContent = `
      <svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 ${size} ${size}">
        <defs>
          <style>
            .outer-circle {
              fill: white;
              stroke: black;
              stroke-width: 2;
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
          ${beamGradient ? `
            <radialGradient id="beamGradient${Date.now()}" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="rgba(0, 123, 255, 0.6)" />
              <stop offset="70%" stop-color="rgba(0, 123, 255, 0.3)" />
              <stop offset="100%" stop-color="rgba(0, 123, 255, 0.1)" />
            </radialGradient>
          ` : ''}
        </defs>
        
        <!-- Direction beam (if target bearing provided) - behind everything -->
        ${showDirectionBeam && targetRotation !== null ? `
          <g class="direction-beam-group" transform="rotate(${targetRotation}, ${center}, ${center})">
            <path 
              class="direction-beam"
              d="M ${center},${center} L ${leftX},${leftY} A ${beamRadius},${beamRadius} 0 ${largeArcFlag},1 ${rightX},${rightY} Z" 
              fill="${beamGradient ? `url(#beamGradient${Date.now()})` : 'rgba(0, 123, 255, 0.3)'}"
              stroke="none"
            />
          </g>
        ` : ''}
        
        <!-- Subtle bearing triangle (behind circles) -->
        <g class="bearing-indicator" transform="rotate(${finalRotation}, ${center}, ${center})">
          <polygon 
            class="bearing-triangle" 
            points="${center},${radius/3} ${center + radius/3},${center + radius/3} ${center - radius/3},${center + radius/3}" 
          />
        </g>
        
        <!-- Outer circle (location indicator) -->
        <circle class="outer-circle" cx="${center}" cy="${center}" r="${radius * 0.6}"/>
        
        <!-- Inner circle (bearing indicator) that rotates -->
        <g class="bearing-indicator" transform="rotate(${finalRotation}, ${center}, ${center})">
          <circle class="inner-circle" cx="${center}" cy="${center - radius/3}" r="${radius/4}"/>
        </g>
        
        <!-- Warning triangle (shown when no orientation available) -->
        ${showWarning ? `
          <g class="warning-indicator">
            <polygon class="warning-triangle" points="${center},${radius/3} ${center - radius/4},${center} ${center + radius/4},${center}" />
            <text x="${center}" y="${center - radius/6}" text-anchor="middle" font-size="${size/8}" fill="#000">!</text>
          </g>
        ` : ''}
      </svg>
    `;
    
    el.innerHTML = svgContent;
    return el;
  }, [map, size, widgetMode, showDirectionBeam, beamLength, beamAngle, beamGradient]);
  
  // Update marker position and appearance
  const updateUserMarker = useCallback((position: [number, number]) => {
    if (widgetMode) {
      // Widget mode - don't interact with map
      return;
    }
    
    if (!map) {
      console.log('❌ No map available for marker update');
      return;
    }
    
    // Choose marker type based on mode
    const newElement = minimalMode 
      ? createMinimalMarker(finalHeading || undefined)
      : createSvgMarker(
          finalHeading !== null ? finalHeading : 0,
          !orientationAvailable || finalHeading === null,
          showDirectionBeam ? targetBearing : null
        );
    
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
        showDirectionBeam,
        targetBearing
      });
    } catch (error) {
      console.error('Error creating user location marker:', error);
    }
  }, [map, createMinimalMarker, createSvgMarker, finalHeading, orientationAvailable, minimalMode, widgetMode, showDirectionBeam, targetBearing]);
  
  // Update widget appearance (for widget mode)
  const updateWidget = useCallback(() => {
    if (!widgetMode || !widgetRef.current) return;
    
    const newElement = minimalMode 
      ? createMinimalMarker(finalHeading || undefined)
      : createSvgMarker(
          finalHeading !== null ? finalHeading : 0,
          !orientationAvailable || finalHeading === null,
          showDirectionBeam ? targetBearing : null
        );
    
    // Replace widget content
    widgetRef.current.innerHTML = '';
    widgetRef.current.appendChild(newElement);
  }, [widgetMode, minimalMode, finalHeading, orientationAvailable, showDirectionBeam, targetBearing, createMinimalMarker, createSvgMarker]);
  
  // Update marker when position changes (map mode only)
  useEffect(() => {
    if (!widgetMode && userPosition && map) {
      updateUserMarker(userPosition);
    }
  }, [userPosition, updateUserMarker, widgetMode]);
  
  // Update when heading/bearing changes (both modes)
  useEffect(() => {
    if (widgetMode) {
      updateWidget();
    } else if (userMarkerRef.current && userPosition) {
      updateUserMarker(userPosition);
    }
  }, [finalHeading, orientationAvailable, targetBearing, updateWidget, updateUserMarker, widgetMode, userPosition]);
  
  // Update marker when mode changes
  useEffect(() => {
    if (!widgetMode && userMarkerRef.current && userPosition) {
      updateUserMarker(userPosition);
    }
  }, [minimalMode, userPosition, updateUserMarker, widgetMode]);
  
  // Update marker when map bearing changes (map mode only)
  useEffect(() => {
    if (!widgetMode && map) {
      const handleMapRotate = () => {
        if (userMarkerRef.current && userPosition) {
          updateUserMarker(userPosition);
        }
      };
      
      map.on('rotate', handleMapRotate);
      
      return () => {
        map.off('rotate', handleMapRotate);
      };
    }
  }, [map, userPosition, updateUserMarker, widgetMode]);
  
  // Log orientation status for debugging
  useEffect(() => {
    if (orientationError) {
      console.warn('🧭 Device orientation error:', orientationError);
    }
  }, [orientationError]);
  
  // Initialize widget mode
  useEffect(() => {
    if (widgetMode && widgetRef.current) {
      updateWidget();
    }
  }, [widgetMode, updateWidget]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }
    };
  }, []);
  
  // Render widget mode as JSX
  if (widgetMode) {
    return (
      <div 
        ref={widgetRef}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          display: 'inline-block',
          position: 'relative'
        }}
      />
    );
  }
  
  // Map mode - purely visual, no JSX
  return null;
};

export default UserLocationTracker;