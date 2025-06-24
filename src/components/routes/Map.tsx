// Map.tsx - Integration points for precision improvements
import React, { useState, useCallback, useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import { useNavigate } from 'react-router-dom';
import 'mapbox-gl/dist/mapbox-gl.css';
import VerticalSection from '../sections/vertical/VerticalSection';
import PermissionsStatus from '../common/PermissionsStatus';
import { routePointsData, getIconPath, GEOFENCE_CONFIG } from '../../data/mapRouteData';
import { usePermissions } from '../../context/PermissionsContext';
import UserLocationTracker from '../common/UserLocationTracker';
import GeofenceDebugger from '../debug/GeofenceDebugger';
import PrecisionDebugger from '../debug/PrecisionDebugger'; // NEW: Import precision debugger
import ExperienceModal from '../common/ExperienceModal';
import MapWrapper from './MapWrapper';
import { useGeofenceContext, useGeofencePrecision } from '../../context/GeofenceContext'; // UPDATED: Import precision hook
import { testKenilworthExperiences } from '../../utils/geoArUtils'
import ExperienceProgressTracker, { ExperienceProgressTrackerRef } from '../common/ExperienceProgressTracker';
import { SystemOptimizationManager } from '../../utils/systemOptimization';
import GeofenceNotificationSystem from '../common/GeofenceNotificationSystem';

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
  
  // State that should trigger UI updates
  const [mapLoaded, setMapLoaded] = useState(false);
  
  const [modalState, setModalState] = useState<ModalState>({
    isOpen: false,
    pointData: null
  });

  const [compassCalibration, setCompassCalibration] = useState(0);

  // Context hooks - ENHANCED with precision data
  const {
    userPosition: geofenceUserPosition, 
    isInsideGeofence,
    getDistanceTo,
    getDistanceToPoint,
    getCurrentRadius,
    updateGlobalRadius,    // ADD THIS
  
    // NEW: Enhanced precision properties
    currentAccuracy,
    positionQuality, 
    isPositionStable,
    averagedPosition,
    positionHistory,
    isTracking,
    startTracking,
    stopTracking,
    getPositionStats
  } = useGeofenceContext();
  
  // Alternative: Use the precision-specific hook if you prefer
  // const precisionData = useGeofencePrecision();
  
  const { permissionsState } = usePermissions();
  const navigate = useNavigate();

  //JUST TO SEE THE ZOOM LEVELS REMOVE WHEN DONE
    // useEffect(() => {
    //   if (!mapRef.current) return;
      
    //   const handleZoom = () => {
    //     const currentZoom = mapRef.current?.getZoom();
    //     console.log(`🔍 Map Zoom: ${currentZoom?.toFixed(2)}`);
    //   };
      
    //   mapRef.current.on('zoom', handleZoom);
      
    //   return () => {
    //     mapRef.current?.off('zoom', handleZoom);
    //   };
    // }, [mapLoaded]);



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

  // finding the locationtracker
  console.log('🗺️ Debug UserLocationTracker props:', {
  map: mapRef.current,
  mapLoaded: mapRef.current?.loaded(),
  userPosition: averagedPosition,
  widgetMode: false,
  showDirectionBeam: true
});

console.log('🗺️ Rendering UserLocationTracker with:', {
  map: mapRef.current,
  
  mapIsNull: mapRef.current === null,
  
});
  
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

  // NEW: Log precision improvements to console for monitoring
  useEffect(() => {
    if (currentAccuracy !== null) {
      console.log('🎯 GPS Precision Update:', {
        accuracy: `${currentAccuracy.toFixed(1)}m`,
        quality: positionQuality,
        stable: isPositionStable,
        position: geofenceUserPosition ? 
          `${geofenceUserPosition[1].toFixed(8)}, ${geofenceUserPosition[0].toFixed(8)}` : 'none',
        averaged: averagedPosition ? 
          `${averagedPosition[1].toFixed(8)}, ${averagedPosition[0].toFixed(8)}` : 'none',
        historyLength: positionHistory.length
      });
    }
  }, [currentAccuracy, positionQuality, isPositionStable, geofenceUserPosition, averagedPosition, positionHistory.length]);
  
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
        
        {/* User location tracker and mapref to geofenceNotificaiton */}
          {mapLoaded && mapRef.current && (
          <>
        <UserLocationTracker
            map={mapRef.current}
            userPosition={averagedPosition}  // Use context position
            showDirectionBeam={true}
             debugId="MAP"

            />
            {/* NEW: Pass map reference to GeofenceNotificationSystem */}
            <GeofenceNotificationSystem 
              map={mapRef.current}
            />
          </>
        )}

        {/* Permission status indicators */}
        <div style={{ position: 'absolute', bottom: '10px', left: '20px', zIndex: 10 }}>
          <PermissionsStatus compact={true} />
        </div>
        
        {/* EXISTING: Geofence debugger */}
        {/* <GeofenceDebugger /> */}

        {/* NEW: GPS Precision debugger - positioned to not overlap */}
        <PrecisionDebugger
          currentAccuracy={currentAccuracy}
          positionQuality={positionQuality}
          isPositionStable={isPositionStable}
          averagedPosition={averagedPosition}
          positionHistory={positionHistory}
          userPosition={geofenceUserPosition}
          isTracking={isTracking}
          startTracking={startTracking}
          stopTracking={stopTracking}
          getPositionStats={getPositionStats}
          currentRadius={GEOFENCE_CONFIG.DEFAULT_RADIUS}
        />

        {/* Compass calibration Debugger
        <div style={{
          position: 'absolute',
          bottom: '10px',
          right: '10px',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          color: 'white',
          padding: '6px',
          borderRadius: '4px',
          fontSize: '8px',
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
        </div> */}

       {/* Experience modal and geofence notifications with map zoom */}
       
        
              {/* Experience modal */}
              <ExperienceModal
                isOpen={modalState.isOpen}
                pointData={modalState.pointData}
                onClose={closeModal}
                currentRadius={currentRadius}
              />
     
        
       
      </VerticalSection>
    </div>
  );
};

export default Map;