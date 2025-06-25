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
  showDirectionBeam?: boolean; // Show direction beam extending from device heading
  size?: number; // Widget size in pixels (default 40)
  
  // NEW: Direction beam customization
  beamLength?: number; // How far the beam extends as multiplier of radius (default 2.5)
  beamAngle?: number;  // Beam width in degrees (default 30)
  beamGradient?: boolean; // Use gradient (default true)
  debugId?: string;
}

const UserLocationTracker: React.FC<UserLocationTrackerProps> = ({ 
  map, 
  userPosition, 
  heading: propHeading, 
  accuracy,
  minimalMode = false,
  widgetMode = false,
  showDirectionBeam = false,
  size = 30,
  beamLength = 10,
  beamAngle = 40,
  beamGradient = true,
  debugId = "MAIN"
}) => {

  console.log(`🧭 UserLocationTracker [${debugId}] props:`, {
    widgetMode,
    hasMap: !!map,
    userPosition,
    showDirectionBeam,
    beamLength
  });

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
  
  // Create minimal center ball marker with bearing dot - FIXED VIEWBOX (based on working version)
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
    
    // Base calculations (same as working version)
    const center = size / 4;
    const radius = center - 2;
    const beamRadius = radius * beamLength;
    
    // ✅ FIXED: Dynamic viewBox that accommodates beam size
    const baseViewBoxSize = size / 2;
    const requiredViewBoxSize = showDirectionBeam ? Math.max(baseViewBoxSize, beamRadius * 2.2) : baseViewBoxSize;
    
    // Use the larger viewBox but keep same center calculations
    const viewBoxSize = requiredViewBoxSize;
    const viewBoxCenter = viewBoxSize / 2;
    
    // ✅ Keep original coordinate system but scale for larger viewBox
    const scaleFactor = viewBoxSize / baseViewBoxSize;
    const scaledCenter = viewBoxCenter;
    const scaledRadius = radius * scaleFactor;
    const scaledBeamRadius = scaledRadius * beamLength;
    
    // ✅ Calculate bearing dot position (same as working version)
    const dotOffset = scaledRadius * 0.6;
    const dotRadius = scaledRadius * 0.3;

    
    // Calculate beam arc points using trigonometry
    const halfAngleRad = (beamAngle / 2) * (Math.PI / 180);
    const leftAngle = -halfAngleRad;
    const rightAngle = halfAngleRad;
    
    // Calculate outer arc points
    const leftX = scaledCenter + scaledBeamRadius * Math.sin(leftAngle);
    const leftY = scaledCenter - scaledBeamRadius * Math.cos(leftAngle);
    const rightX = scaledCenter + scaledBeamRadius * Math.sin(rightAngle);
    const rightY = scaledCenter - scaledBeamRadius * Math.cos(rightAngle);
    
    // Determine if we need a large arc (for angles > 180°)
    const largeArcFlag = beamAngle > 180 ? 1 : 0;
    
    // ✅ Unique gradient ID
    const gradientId = `beamGradientMinimal_${debugId}_${Date.now()}`;
    
    const svgContent = `
      <svg 
        width="${size / 2}" 
        height="${size / 2}" 
        viewBox="0 0 ${viewBoxSize} ${viewBoxSize}" 
        style="position: absolute; overflow: visible;"
        xmlns="http://www.w3.org/2000/svg"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <!-- Black to white linear gradient -->
          <linearGradient id="${gradientId}" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="black" stop-opacity="0.8" />
            <stop offset="50%" stop-color="gray" stop-opacity="0.6" />
            <stop offset="100%" stop-color="white" stop-opacity="0.4" />
          </linearGradient>
        </defs>
        
        <!-- Direction beam (extends from device heading) - behind everything -->
        ${showDirectionBeam && bearing !== undefined ? `
          <g class="direction-beam-group" transform="rotate(${finalBearing}, ${scaledCenter}, ${scaledCenter})">
            <path 
              class="direction-beam"
              d="M ${scaledCenter},${scaledCenter} L ${leftX},${leftY} A ${scaledBeamRadius},${scaledBeamRadius} 0 ${largeArcFlag},1 ${rightX},${rightY} Z" 
              fill="url(#${gradientId})"
              stroke="none"
            />
          </g>
        ` : ''}
        
        <!-- Main center circle (white with black border) -->
        <circle 
          cx="${scaledCenter}" 
          cy="${scaledCenter}" 
          r="${scaledRadius}" 
          fill="white" 
          stroke="black" 
          stroke-width="4"
        />
        
        <!-- Bearing indicator dot (always show, defaults to North) -->
        <g class="bearing-indicator" transform="rotate(${bearing !== undefined ? finalBearing : 0}, ${scaledCenter}, ${scaledCenter})">
          <circle 
            cx="${scaledCenter}" 
            cy="${scaledCenter - dotOffset}" 
            r="${dotRadius}" 
            fill="black"
          />
        </g>
      </svg>
    `;
    
    el.innerHTML = svgContent;
    return el;
  }, [map, size, showDirectionBeam, beamLength, beamAngle, beamGradient, debugId]);
  
  // Create full SVG location marker - FIXED VIEWBOX (based on working version)
  const createSvgMarker = useCallback((rotation: number, showWarning: boolean): HTMLElement => {
    const el = document.createElement('div');
    el.className = widgetMode ? 'user-location-widget' : 'user-location-marker';
    el.style.position = 'relative';
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.pointerEvents = 'none';
    
    // Calculate final rotation accounting for map rotation (if map exists)
    const mapBearing = map?.getBearing() || 0;
    const finalRotation = rotation - mapBearing;
    
    // Base calculations (same as working version)
    const center = size / 2;
    const radius = center - 2;
    const beamRadius = radius * beamLength;
    
    // ✅ FIXED: Dynamic viewBox that accommodates beam size
    const baseViewBoxSize = size;
    const requiredViewBoxSize = showDirectionBeam ? Math.max(baseViewBoxSize, beamRadius * 2.2) : baseViewBoxSize;
    
    // Use the larger viewBox
    const viewBoxSize = requiredViewBoxSize;
    const viewBoxCenter = viewBoxSize / 2;
    
    // ✅ Keep original coordinate system but scale for larger viewBox
    const scaleFactor = viewBoxSize / baseViewBoxSize;
    const scaledCenter = viewBoxCenter;
    const scaledRadius = radius * scaleFactor;
    const scaledBeamRadius = scaledRadius * beamLength;
    
    // Calculate beam arc points using trigonometry
    const halfAngleRad = (beamAngle / 2) * (Math.PI / 180);
    const leftAngle = -halfAngleRad;
    const rightAngle = halfAngleRad;
    
    // Calculate outer arc points
    const leftX = scaledCenter + scaledBeamRadius * Math.sin(leftAngle);
    const leftY = scaledCenter - scaledBeamRadius * Math.cos(leftAngle);
    const rightX = scaledCenter + scaledBeamRadius * Math.sin(rightAngle);
    const rightY = scaledCenter - scaledBeamRadius * Math.cos(rightAngle);
    
    // Determine if we need a large arc (for angles > 180°)
    const largeArcFlag = beamAngle > 180 ? 1 : 0;
    
    // ✅ Unique gradient ID
    const gradientId = `beamGradientFull_${debugId}_${Date.now()}`;
    
    const svgContent = `
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        version="1.1" 
        width="${size}"
        height="${size}"
        style="position: absolute; overflow: visible;"
        viewBox="0 0 ${viewBoxSize} ${viewBoxSize}"
      >
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
            .warning-triangle {
              fill: #FFD700;
              stroke: #FFA500;
              stroke-width: 1;
              display: ${showWarning ? 'block' : 'none'};
            }
          </style>
          <!-- Black to white linear gradient -->
          <linearGradient id="${gradientId}" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="black" stop-opacity="0.8" />
            <stop offset="50%" stop-color="gray" stop-opacity="0.6" />
            <stop offset="100%" stop-color="white" stop-opacity="0.4" />
          </linearGradient>
        </defs>
        
        <!-- Direction beam (extends from device heading) - behind everything -->
        ${showDirectionBeam ? `
          <g class="direction-beam-group" transform="rotate(${finalRotation}, ${scaledCenter}, ${scaledCenter})">
            <path 
              class="direction-beam"
              d="M ${scaledCenter},${scaledCenter} L ${leftX},${leftY} A ${scaledBeamRadius},${scaledBeamRadius} 0 ${largeArcFlag},1 ${rightX},${rightY} Z" 
              fill="url(#${gradientId})"
              stroke="none"
            />
          </g>
        ` : ''}
        
        <!-- Outer circle (location indicator) -->
        <circle class="outer-circle" cx="${scaledCenter}" cy="${scaledCenter}" r="${scaledRadius * 0.6}"/>
        
        <!-- Inner circle (bearing indicator) that rotates with SAME rotation as beam -->
        <g class="bearing-indicator" transform="rotate(${finalRotation}, ${scaledCenter}, ${scaledCenter})">
          <circle class="inner-circle" cx="${scaledCenter}" cy="${scaledCenter - scaledRadius/3}" r="${scaledRadius/4}"/>
        </g>
        
        <!-- Warning triangle (shown when no orientation available) -->
        ${showWarning ? `
          <g class="warning-indicator">
            <polygon class="warning-triangle" points="${scaledCenter},${scaledRadius/3} ${scaledCenter - scaledRadius/4},${scaledCenter} ${scaledCenter + scaledRadius/4},${scaledCenter}" />
            <text x="${scaledCenter}" y="${scaledCenter - scaledRadius/6}" text-anchor="middle" font-size="${viewBoxSize/8}" fill="#000">!</text>
          </g>
        ` : ''}
      </svg>
    `;
    
    el.innerHTML = svgContent;
    return el;
  }, [map, size, widgetMode, showDirectionBeam, beamLength, beamAngle, beamGradient, debugId]);
  
  // Update marker position and appearance
  const updateUserMarker = useCallback((position: [number, number]) => {
    // console.log('🧭 updateUserMarker called:', {
    //   position,
    //   hasMap: !!map,
    //   mapReady: map?.loaded(),
    //   widgetMode
    // });

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
          !orientationAvailable || finalHeading === null
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
        beamLength
      });
    } catch (error) {
      console.error('Error creating user location marker:', error);
    }
  }, [map, createMinimalMarker, createSvgMarker, finalHeading, orientationAvailable, minimalMode, widgetMode, showDirectionBeam]);
  
  // Update widget appearance (for widget mode)
  const updateWidget = useCallback(() => {
    if (!widgetMode || !widgetRef.current) return;
    
    const newElement = minimalMode 
      ? createMinimalMarker(finalHeading || undefined)
      : createSvgMarker(
          finalHeading !== null ? finalHeading : 0,
          !orientationAvailable || finalHeading === null
        );
    
    // Replace widget content
    widgetRef.current.innerHTML = '';
    widgetRef.current.appendChild(newElement);
  }, [widgetMode, minimalMode, finalHeading, orientationAvailable, showDirectionBeam, createMinimalMarker, createSvgMarker]);
  
  // Update marker when position changes (map mode only)
  useEffect(() => {
    console.log('🧭 useEffect triggered:', {
      widgetMode,
      userPosition: !!userPosition,
      hasMap: !!map,
      shouldCallUpdate: !widgetMode && !!userPosition && !!map
    });
    
    if (!widgetMode && userPosition && map) {
      console.log('🧭 Calling updateUserMarker from useEffect');
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
  }, [finalHeading, orientationAvailable, updateWidget, updateUserMarker, widgetMode, userPosition]);
  
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
    console.log('🧭 Widget mode rendering:', {
      userPosition,
      size,
      hasWidgetRef: !!widgetRef.current
    });
    
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