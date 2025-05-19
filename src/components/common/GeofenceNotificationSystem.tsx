// Modified GeofenceNotificationSystem.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ExperienceModal from './ExperienceModal';
import { usePermissions } from '../../context/PermissionsContext';
import { routePointsData } from '../../data/mapRouteData';
import { checkGeofences } from '../../utils/geoUtils';

// Define proper types for the modal state
interface ModalState {
  isOpen: boolean;
  pointData: any | null;
}

// Declare the global for TypeScript
declare global {
  interface Window {
    geofenceDebuggerRadius?: number;
  }
}

const GeofenceNotificationSystem: React.FC = () => {
  const navigate = useNavigate();
  const { permissionsState } = usePermissions();
  const [userPosition, setUserPosition] = useState<[number, number] | null>(null);
  const [previouslyDetectedGeofences, setPreviouslyDetectedGeofences] = useState<string[]>([]);
  const [modalState, setModalState] = useState<ModalState>({
    isOpen: false,
    pointData: null
  });
  
  // Initialize with debugger radius or default
  const defaultRadius = window.geofenceDebuggerRadius || 50;
  const [geofenceRadius, setGeofenceRadius] = useState(defaultRadius);
  
  // Poll for changes to the debugger radius
  useEffect(() => {
    // Check for radius updates
    const checkRadiusInterval = setInterval(() => {
      if (window.geofenceDebuggerRadius && window.geofenceDebuggerRadius !== geofenceRadius) {
        console.log(`Syncing notification radius with debugger: ${window.geofenceDebuggerRadius}m`);
        setGeofenceRadius(window.geofenceDebuggerRadius);
      }
    }, 1000); // Check every second
    
    // Cleanup
    return () => {
      clearInterval(checkRadiusInterval);
    };
  }, [geofenceRadius]);

  // Watch user location
  useEffect(() => {
    // Only watch location if permission is granted
    if (permissionsState?.results?.location === 'granted') {
      console.log('Setting up position watch in GeofenceNotificationSystem');
      
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          const newPosition: [number, number] = [
            position.coords.longitude,
            position.coords.latitude
          ];
          setUserPosition(newPosition);
        },
        (error) => {
          console.error('Geolocation error in GeofenceNotificationSystem:', error);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 5000,
          timeout: 10000
        }
      );
      
      // Clean up on unmount
      return () => {
        navigator.geolocation.clearWatch(watchId);
      };
    }
  }, [permissionsState]);

  // Check for geofences - now using the radius synced from debugger
  useEffect(() => {
    if (!userPosition) return;
    
    // Use the same geofence check with synced radius
    const results = checkGeofences(userPosition, routePointsData.features, geofenceRadius);
    
    // Get IDs of currently detected geofences
    const currentGeofenceIds = results.insideGeofences.map(fence => fence.id);
    
    // Find newly entered geofences (detected now but not previously)
    const newlyEnteredGeofences = currentGeofenceIds.filter(
      id => !previouslyDetectedGeofences.includes(id)
    );
    
    // If we entered any new geofences and no modal is already open
    if (newlyEnteredGeofences.length > 0 && !modalState.isOpen) {
      console.log('Newly entered geofences:', newlyEnteredGeofences);
      
      // Get the first new geofence to show
      const newGeofenceId = newlyEnteredGeofences[0];
      
      // Find the corresponding point data in route points
      const pointFeature = routePointsData.features.find(
        feature => feature.properties.iconName === newGeofenceId
      );
      
      if (pointFeature && pointFeature.properties) {
        // Show modal with notification styling
        setModalState({
          isOpen: true,
          pointData: pointFeature.properties
        });
        
        // Play sound and vibrate
        try {
          const sound = new Audio('/notification-sound.mp3');
          sound.play().catch(err => console.log('Audio play error:', err));
          
          // Vibrate if supported
          if ('vibrate' in navigator) {
            navigator.vibrate([200, 100, 200]);
          }
        } catch (err) {
          console.log('Media error:', err);
        }
      }
    }
    
    // Update previously detected geofences for next comparison
    setPreviouslyDetectedGeofences(currentGeofenceIds);
    
  }, [userPosition, modalState.isOpen, geofenceRadius]);

  // Handle closing the modal
  const handleCloseModal = () => {
    setModalState({
      isOpen: false,
      pointData: null
    });
  };

  return (
    <>
      <ExperienceModal
        isOpen={modalState.isOpen}
        pointData={modalState.pointData}
        onClose={handleCloseModal}
        isNotification={true}
        userPosition={userPosition}
      />
      
      {/* Optional: Small indicator showing that radius is synced */}
      <div style={{
        position: 'fixed',
        bottom: '10px',
        left: '10px',
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        color: 'white',
        padding: '4px 8px',
        borderRadius: '4px',
        fontSize: '10px',
        zIndex: 99,
        pointerEvents: 'none' // So it doesn't interfere with clicks
      }}>
        Notifications: {geofenceRadius}m
      </div>
    </>
  );
};

export default GeofenceNotificationSystem;