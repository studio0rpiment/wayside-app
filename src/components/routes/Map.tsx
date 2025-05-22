// Map.tsx
import React, { useState, useCallback, useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import { useNavigate } from 'react-router-dom';
import 'mapbox-gl/dist/mapbox-gl.css';
import VerticalSection from '../sections/vertical/VerticalSection';
import PermissionsStatus from '../common/PermissionsStatus';
import { routePointsData, getIconPath } from '../../data/mapRouteData';
import { usePermissions } from '../../context/PermissionsContext';
import UserLocationTracker from '../common/UserLocationTracker';
import GeofenceDebugger from '../debug/GeofenceDebugger';
import ExperienceModal from '../common/ExperienceModal';
import MapWrapper from './MapWrapper';
import { useGeofenceContext } from '../../context/GeofenceContext'; 
import { testCoordinateConversion } from '../../utils/geoArUtils'

// Interface for the modal state
interface ModalState {
  isOpen: boolean;
  pointData: any | null;
}

// Set the Mapbox token - IMPORTANT: Must be set before using MapboxGL
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

const Map: React.FC = () => {
  // Use refs for values that shouldn't trigger re-renders
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  
  // Use the centralized geofence manager
  // const geofenceManager = useGeofenceManager(routePointsData, {
  //   debugMode: true, // Enable debugging
  //   autoStart: true  // Start automatically
  // });
    const [userPosition, setUserPosition] = useState<[number, number] | null>(null);


 const {
  activeGeofences,
  isTracking,
  startTracking,
  stopTracking,
  userPosition: geofenceUserPosition, 
  isInsideGeofence,
  getDistanceTo,
  getDistanceToPoint, // Add this new function
  getCurrentRadius
} = useGeofenceContext();;
  
  // State that should trigger UI updates
  const [mapLoaded, setMapLoaded] = useState(false);
  const [modalState, setModalState] = useState<ModalState>({
    isOpen: false,
    pointData: null
  });
  const [notificationRadius, setNotificationRadius] = useState(3);
  
  const { permissionsState } = usePermissions();
  const navigate = useNavigate();
  
  // Stable marker creation function
  const createMarkers = useCallback((map: mapboxgl.Map) => {
    // Clean up any existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];
    
    // Create new markers
    routePointsData.features.forEach(point => {
      const { iconName } = point.properties;
      
      // Create marker element
      const el = document.createElement('div');
      el.className = 'map-icon';
      el.style.backgroundImage = `url(${getIconPath(iconName)})`;
      el.style.width = '30px';
      el.style.height = '30px';
      el.style.backgroundSize = 'cover';
      el.style.cursor = 'pointer';
      
      // Create marker with click handler
      const marker = new mapboxgl.Marker(el)
        .setLngLat(point.geometry.coordinates)
        .addTo(map);
      
      // Add click listener to the element
      el.addEventListener('click', () => {
        setModalState({
          isOpen: true,
          pointData: point.properties
        });
      });
      
      markersRef.current.push(marker);
    });
  }, []);
  
  // Stable callbacks with no dependencies that could change
  const handleMapLoaded = useCallback((map: mapboxgl.Map) => {
    console.log('Map loaded successfully');
    mapRef.current = map;
    createMarkers(map);
    setMapLoaded(true);
  }, [createMarkers]);
  
  const handleMapRemoved = useCallback(() => {
    console.log('Map removed');
    
    // Clean up markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];
    
    mapRef.current = null;
    setMapLoaded(false);
  }, []);
  
  const closeModal = useCallback(() => {
    setModalState({
      isOpen: false,
      pointData: null
    });
  }, []);
  
  // Helper functions to get geofence info for the current modal point
  const getModalGeofenceInfo = useCallback(() => {
    if (!modalState.pointData || !modalState.pointData.iconName) {
      return {
        isInside: false,
        distance: null,
        direction: null
      };
    }
    
    const pointId = modalState.pointData.iconName;
    const isInside = isInsideGeofence(pointId);

    let distance = getDistanceTo(pointId);
    if (distance === null) {
    // If not in active geofences, calculate distance directly
    distance = getDistanceToPoint(pointId);
  }
    
    // Calculate direction if we have user position and point coordinates
    let direction = null;
    if (userPosition) {
      // Find the point's coordinates
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
    
    return {
      isInside,
      distance,
      direction
    };
  }, [modalState.pointData, isInsideGeofence, getDistanceTo,getDistanceToPoint, userPosition]);
  
  // Check for URL parameters on mount - only run once
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const experienceId = params.get('showExperience');
    
    if (experienceId) {
      const pointFeature = routePointsData.features.find(
        feature => feature.properties.iconName === experienceId
      );
      
      if (pointFeature) {
        setModalState({
          isOpen: true,
          pointData: pointFeature.properties
        });
        
        // Clear the URL parameter to prevent reopening on refresh
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
      }
    }
  }, []); // Empty dependency array - only run once

  useEffect(() => {
  // Test the coordinate conversion
  testCoordinateConversion();
 
}, []); // Run once when component mounts

useEffect(() => {
  if (geofenceUserPosition) {
    setUserPosition(geofenceUserPosition);
  }
}, [geofenceUserPosition]);
  
  // Get modal geofence info
  const modalGeofenceInfo = getModalGeofenceInfo();
  
  return (
    <div className="map-route">
      <VerticalSection 
        id="mapSection" 
        title="Map"
        color="transparent"
        height="100vh"
        fullHeight={true}
      >
        {/* Map wrapper */}
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}>
          <MapWrapper
            center={[-76.945116, 38.912637]}
            zoom={16.04}
            bearing={-90.05}
            onMapLoaded={handleMapLoaded}
            onMapRemoved={handleMapRemoved}
          />
        </div>
        
        {/* User location tracker - now only handles visual representation */}
        {mapLoaded && mapRef.current && (
          <UserLocationTracker 
            map={mapRef.current} 
            userPosition={geofenceUserPosition}
            // heading={heading} // Add this when we have heading from the hook
            // accuracy={accuracy} // Add this when we have accuracy from the hook
          />
        )}
        
        {/* Permission status indicators */}
        <div style={{ position: 'absolute', bottom: '20px', left: '20px', zIndex: 10 }}>
          <PermissionsStatus compact={true} />
        </div>
        
        {/* Geofence debugger */}
        <GeofenceDebugger  />
        
        {/* Experience modal with centralized geofence data */}
        <ExperienceModal
          isOpen={modalState.isOpen}
          pointData={modalState.pointData}
          onClose={closeModal}
          isInsideGeofence={modalGeofenceInfo.isInside}
          distanceToGeofence={modalGeofenceInfo.distance}
          directionToGeofence={modalGeofenceInfo.direction}
          currentRadius={getCurrentRadius()}
        />
      </VerticalSection>
    </div>
  );
};

export default Map;