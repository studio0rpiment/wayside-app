// GeofenceNotificationSystem.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import ExperienceModal from './ExperienceModal';
import { useGeofenceContext } from '../../context/GeofenceContext'; // Use context instead

import { routePointsData } from '../../data/mapRouteData';
import mapboxgl from 'mapbox-gl';

// Define proper types for the modal state
interface ModalState {
  isOpen: boolean;
  pointData: any | null;
}


interface GeofenceNotificationSystemProps {
  children?: React.ReactNode;
  map?: mapboxgl.Map;
}

const GeofenceNotificationSystem: React.FC<GeofenceNotificationSystemProps> = ({ children, map }) => {
  const navigate = useNavigate();

   const {
    userPosition,
    activeGeofences,
    isTracking,
    startTracking,    
    stopTracking, 
    getCurrentRadius
  } = useGeofenceContext();
  
  // Track which geofences we've already shown notifications for
  const [notifiedGeofences, setNotifiedGeofences] = useState<string[]>([]);
  const previousActiveGeofencesRef = useRef<string[]>([]);
  
  // Track zoom state
  const [isZoomedIn, setIsZoomedIn] = useState(false);
  const [originalMapState, setOriginalMapState] = useState<{
    center: [number, number];
    zoom: number;
    bearing: number;
  } | null>(null);
    
  
  // Track geofence entries and show notifications
 useEffect(() => {
    if (!activeGeofences || activeGeofences.length === 0) {
      return;
    }
    
    // Get current active geofence IDs
    const currentActiveIds = activeGeofences.map(g => g.id);
    const previousActiveIds = previousActiveGeofencesRef.current;
    
    // Find newly entered geofences
    const newlyEnteredIds = currentActiveIds.filter(
      id => !previousActiveIds.includes(id)
    );
    
    // Handle newly entered geofences
    if (newlyEnteredIds.length > 0) {
      // Get the first new geofence to show
      const newGeofenceId = newlyEnteredIds[0];
      
      // Only show notification if we haven't already notified for this geofence
      if (!notifiedGeofences.includes(newGeofenceId)) {
        
        // Find the corresponding point data
        const pointFeature = routePointsData.features.find(
          feature => feature.properties.iconName === newGeofenceId
        );
        
        if (pointFeature && pointFeature.properties) {
          // EXISTING: Handle map zoom BEFORE showing instruction
          if (map && !isZoomedIn) {
            // Store original map state for restoration later
            setOriginalMapState({
              center: [map.getCenter().lng, map.getCenter().lat],
              zoom: map.getZoom(),
              bearing: map.getBearing()
            });
            
            // Zoom to experience location - CENTER THE MARKER
            map.flyTo({
              center: pointFeature.geometry.coordinates, // Centers the marker
              zoom: 19, // Zoom level 19
              bearing: map.getBearing(), // Keep current bearing
              duration: 1500, // Smooth animation
              essential: true // Reduce motion for accessibility
            });
            
            setIsZoomedIn(true);
            console.log(`🔍 Zoomed to level 19, centered on: ${pointFeature.properties.title}`);
          }
          
          // NEW: Show instruction pointing to this icon
          if (map) {
            // Wait a moment for zoom to complete, then show instruction
            setTimeout(() => {
              const screenCoords = map.project(pointFeature.geometry.coordinates);
              
              // Create instruction element
              const instructionDiv = document.createElement('div');
              instructionDiv.innerHTML = `
                Tap icon to start experience
                <div style="position: absolute; top: 100%; left: 50%; transform: translateX(-50%); width: 0; height: 0; border-left: 8px solid transparent; border-right: 8px solid transparent; border-top: 8px solid var(--color-dark);"></div>
              `;
              instructionDiv.style.cssText = `
                position: absolute;
                top: ${screenCoords.y - 70}px;
                left: ${screenCoords.x}px;
                transform: translateX(-50%);
                background-color: transparent;
                backdrop-filter: blur(5px);
                color: var(--color-light);
                padding: 8px 16px;
                border-radius: 20px;
                font-size: 16px;
                font-weight: 700;
                z-index: 25;
                box-shadow: 8px rgba(0, 0, 0, 0.8);
                border: 0px solid var(--color-blue);
                pointer-events: none;
                animation: fadeIn 0.3s ease-in;
                white-space: nowrap;
              `;
              
              document.body.appendChild(instructionDiv);
              
              // Remove after 4 seconds
              setTimeout(() => {
                if (document.body.contains(instructionDiv)) {
                  document.body.removeChild(instructionDiv);
                }
              }, 4000);
            }, 1600); // Wait for zoom animation to finish (1500ms + 100ms buffer)
          }
          
          // EXISTING: Mark this geofence as notified
          setNotifiedGeofences(prev => [...prev, newGeofenceId]);
          
          // EXISTING: Play notification effects
          showNotificationEffects(pointFeature.properties.title);
        }
      }
    }
    
    // Update previous active geofences for next comparison
    previousActiveGeofencesRef.current = currentActiveIds;
    
  }, [activeGeofences, notifiedGeofences, map, isZoomedIn]); 


  //handle zooming out when leaving all geofences
useEffect(() => {
    if (activeGeofences.length === 0 && isZoomedIn && originalMapState && map) {
      console.log('🔍 Zooming back out - no active geofences');
      
      // Restore original map view
      map.flyTo({
        center: originalMapState.center,
        zoom: originalMapState.zoom,
        bearing: originalMapState.bearing,
        duration: 1500,
        essential: true
      });
      
      setIsZoomedIn(false);
      setOriginalMapState(null);
      
      // Clear notified geofences when user moves away from all geofences
      console.log('User left all geofences, clearing notification history');
      setNotifiedGeofences([]);
    }
  }, [activeGeofences.length, isZoomedIn, originalMapState, map]);

  
  // Show notification effects (sound, vibration, etc.)
  const showNotificationEffects = (title: string) => {
    try {
      // Play sound if available
      const sound = new Audio('/notification-sound.mp3');
      sound.play().catch(err => console.log('Audio play error:', err));
      
      // Vibrate if supported
      if ('vibrate' in navigator) {
        navigator.vibrate([200, 100, 200]);
      }
      
      // Show browser notification if permission granted
      if (Notification.permission === 'granted') {
        const notification = new Notification(`New Experience: ${title}`, {
          body: 'You\'ve entered a new experience area!',
          icon: '/icons/notification-icon.png',
          badge: '/icons/badge-icon.png'
        });
        
        // Auto-close notification after 5 seconds
        setTimeout(() => notification.close(), 5000);
      }
      
      console.log(`Notification effects triggered for: ${title}`);
    } catch (err) {
      console.log('Notification effects error:', err);
    }
  };
  
  // Clear notified geofences when user moves away from all geofences
  useEffect(() => {
    if (activeGeofences.length === 0 && notifiedGeofences.length > 0) {
      console.log('User left all geofences, clearing notification history');
      setNotifiedGeofences([]);
    }
  }, [activeGeofences.length, notifiedGeofences.length]);
  
  return (
    <>
      {/* Render the children directly - no prop passing */}
      {children}
      
      {/* Optional: Debug info for development */}
      {/* {process.env.NODE_ENV === 'development' && (
        <div style={{
          position: 'fixed',
          top: '10px',
          left: '10px',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          color: 'white',
          padding: '8px',
          borderRadius: '4px',
          fontSize: '10px',
          zIndex: 99,
          pointerEvents: 'auto'
        }}>
          <div 
            onClick={() => isTracking ? stopTracking() : startTracking()}
            style={{ cursor: 'pointer', userSelect: 'none' }}  
            >
            Tracking: {isTracking ? '✅' : '❌'}
          </div>
          <div>Active: {activeGeofences.length}</div>
          <div>Notified: {notifiedGeofences.length}</div>
          <div>Radius: {getCurrentRadius()}m</div>
        </div>
      )} */}
    </>
  );
};

export default GeofenceNotificationSystem;