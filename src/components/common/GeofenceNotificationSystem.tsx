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
  
  // Modal state for notification popups
  const [modalState, setModalState] = useState<ModalState>({
    isOpen: false,
    pointData: null
  });

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
          // NEW: Handle map zoom BEFORE showing modal
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
          
          // EXISTING: Show modal with notification styling
          setModalState({
            isOpen: true,
            pointData: pointFeature.properties
          });
          
          // Mark this geofence as notified
          setNotifiedGeofences(prev => [...prev, newGeofenceId]);
          
          // Play notification effects
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
  
  // Handle closing the modal
  const handleCloseModal = () => {
    setModalState({
      isOpen: false,
      pointData: null
    });
  };
  
  // Clear notified geofences when user moves away from all geofences
  useEffect(() => {
    if (activeGeofences.length === 0 && notifiedGeofences.length > 0) {
      console.log('User left all geofences, clearing notification history');
      setNotifiedGeofences([]);
    }
  }, [activeGeofences.length, notifiedGeofences.length]);
  
  // Helper function to get geofence info for modal
  const getModalGeofenceInfo = () => {
    if (!modalState.pointData || !userPosition) {
      return { isInside: false, distance: null, direction: null };
    }
    
    const pointId = modalState.pointData.iconName;
    
    // Check if this geofence is currently active
    const activeGeofence = activeGeofences.find(g => g.id === pointId);
    const isInside = !!activeGeofence;
    const distance = activeGeofence?.distance || null;
    
    // Calculate direction if not inside
    let direction = null;
    if (userPosition && !isInside) {
      const pointFeature = routePointsData.features.find(
        feature => feature.properties.iconName === pointId
      );
      
      if (pointFeature) {
        const pointCoords = pointFeature.geometry.coordinates;
        const dx = pointCoords[0] - userPosition[0];
        const dy = pointCoords[1] - userPosition[1];
        direction = Math.atan2(dy, dx) * (180 / Math.PI);
      }
    }
    
    return { isInside, distance, direction };
  };
  
  const modalGeofenceInfo = getModalGeofenceInfo();
  
  return (
    <>
      {/* Render the children directly - no prop passing */}
      {children}
      
      {/* Experience Modal for notifications */}
      <ExperienceModal
        isOpen={modalState.isOpen}
        pointData={modalState.pointData}
        onClose={handleCloseModal}
        isNotification={true}
        isInsideGeofence={modalGeofenceInfo.isInside}
        distanceToGeofence={modalGeofenceInfo.distance}
        directionToGeofence={modalGeofenceInfo.direction}
        currentRadius={getCurrentRadius()}
        
      />
      
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