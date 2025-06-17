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
import { testKenilworthExperiences } from '../../utils/geoArUtils'
import ExperienceProgressTracker, { ExperienceProgressTrackerRef } from '../common/ExperienceProgressTracker';
import { SystemOptimizationManager } from '../../utils/systemOptimization';

// Interface for the modal state
interface ModalState {
  isOpen: boolean;
  pointData: any | null;
}

// Set the Mapbox token - IMPORTANT: Must be set before using MapboxGL
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

const Map: React.FC = () => {
  // Refs for values that shouldn't trigger re-renders
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const progressTrackerRef = useRef<ExperienceProgressTrackerRef>(null);
  
  // console.log('🗺️ Map created progressTrackerRef:', progressTrackerRef);

    useEffect(() => {
    // console.log('🗺️ Map progressTrackerRef.current changed:', progressTrackerRef.current);
  }, [progressTrackerRef.current]);

  // State that should trigger UI updates
  const [mapLoaded, setMapLoaded] = useState(false);
  const [userPosition, setUserPosition] = useState<[number, number] | null>(null);
  const [modalState, setModalState] = useState<ModalState>({
    isOpen: false,
    pointData: null
  });

  const [compassCalibration, setCompassCalibration] = useState(0);


  // Context hooks
  const {
    userPosition: geofenceUserPosition, 
    isInsideGeofence,
    getDistanceTo,
    getDistanceToPoint,
    getCurrentRadius
  } = useGeofenceContext();
  
  const { permissionsState } = usePermissions();
  const navigate = useNavigate();

  useEffect(() => {
  console.log('🗺️ Map component MOUNTED');
  return () => {
    console.log('🗺️ Map component UNMOUNTED');
  };
}, []);

  // Force reset system optimization on first load
  useEffect(() => {
    console.log('🗺️ Map component mounted - resetting system optimization');
    SystemOptimizationManager.getInstance().forceReset();
  }, []); // Empty deps = runs only once on mount
  
  // Create markers on the map - simplified without dots
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

      // No completion dot creation here - moved to ExperienceProgressTracker
      
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

    // Notify progress tracker about markers for dot management
    if (progressTrackerRef.current) {
      progressTrackerRef.current.updateMapDots(markersRef.current);
    }
  }, []); // No dependencies needed
  
  // Handle map loaded
  const handleMapLoaded = useCallback((map: mapboxgl.Map) => {
    mapRef.current = map;
    createMarkers(map);
    setMapLoaded(true);
  }, [createMarkers]);
  
  // Handle map removed
  const handleMapRemoved = useCallback(() => {
    // Clean up markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];
    
    mapRef.current = null;
    setMapLoaded(false);
  }, []);
  
  // Close modal
  const closeModal = useCallback(() => {
    setModalState({
      isOpen: false,
      pointData: null
    });
  }, []);

  const currentRadius = React.useMemo(() => {
  return modalState.isOpen ? getCurrentRadius() : 0;
}, [modalState.isOpen, getCurrentRadius]);

  
const modalGeofenceInfo = React.useMemo(() => {
  // Only calculate when modal is actually open
  if (!modalState.isOpen || !modalState.pointData || !modalState.pointData.iconName) {
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
    distance = getDistanceToPoint(pointId);
  }
  
  // Calculate direction if we have user position and point coordinates
  let direction = null;
  if (userPosition) {
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
}, [
  modalState.isOpen, // Only recalculate when modal opens/closes
  modalState.pointData?.iconName, // Only when the point changes
  geofenceUserPosition 
]);
  
  // Effects
  
  // Check for URL parameters on mount
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
  }, []);



  // Test coordinate conversion on mount
  useEffect(() => {
    testKenilworthExperiences();
  }, []);

  // Update user position when geofence position changes - REMOVED to prevent infinite loop
  // useEffect(() => {
  //   if (geofenceUserPosition) {
  //     setUserPosition(geofenceUserPosition);
  //   }
  // }, [geofenceUserPosition]);

  
  
  return (
    <div className="map-route">
      <VerticalSection 
        id="mapSection" 
        title="Map"
        color="transparent"
        height="100svh"
        fullHeight={true}
      >
        {/* Experience Progress Tracker - now handles completion dots */}
        <ExperienceProgressTracker
          ref={progressTrackerRef}
          
        />

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
        
        {/* User location tracker */}
        
        {mapLoaded && mapRef.current && (
          <UserLocationTracker 
            map={mapRef.current} 
            userPosition={geofenceUserPosition}
          />
        )}

        
        {/* Permission status indicators */}
        <div style={{ position: 'absolute', bottom: '10px', left: '20px', zIndex: 10 }}>
          <PermissionsStatus compact={true} />
        </div>
        
        {/* Geofence debugger */}
        <GeofenceDebugger />

       {/* Compass calibration Debugger */}
<div style={{
  position: 'absolute',
  bottom: '10px',
  right: '10px',
  backgroundColor: 'rgba(0, 0, 0, 0.7)',
  color: 'white',
  padding: '6px',
  borderRadius: '4px',
  fontSize: '8px',
  zIndex: 1030,
  pointerEvents: 'auto'
}}>
  <div style={{ color: 'yellow', fontSize: '10px' }}>
    COMPASS CALIBRATION: {compassCalibration}° offset
  </div>
  
  {(() => {
    const compassButtonStyle = {
      fontSize: '16px',
      padding: '4px 8px',
      backgroundColor: 'rgba(255,255,255,0.2)',
      border: 'none',
      borderRadius: '0.5rem',
      color: 'white',
      cursor: 'pointer'
    };
    
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '2px', margin: '0.5rem' }}>
        <button onClick={() => setCompassCalibration(prev => prev - 45)} style={compassButtonStyle}>-45°</button>
        <button onClick={() => setCompassCalibration(prev => prev - 5)} style={compassButtonStyle}>-5°</button>
        <button onClick={() => setCompassCalibration(0)} style={compassButtonStyle}>Reset</button>
        <button onClick={() => setCompassCalibration(prev => prev + 5)} style={compassButtonStyle}>+5°</button>
        <button onClick={() => setCompassCalibration(prev => prev + 45)} style={compassButtonStyle}>+45°</button>
      </div>
    );
  })()}
</div>
 

        {/* Experience modal */}
        <ExperienceModal
          isOpen={modalState.isOpen}
          pointData={modalState.pointData}
          onClose={closeModal}
          isInsideGeofence={modalGeofenceInfo.isInside}
          distanceToGeofence={modalGeofenceInfo.distance}
          directionToGeofence={modalGeofenceInfo.direction}
          currentRadius={currentRadius}
      
        />
       
      </VerticalSection>
    </div>
  );
};

export default Map;