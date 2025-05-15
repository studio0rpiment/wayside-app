// GeofenceManager.tsx
import React, { useEffect, useState } from 'react';
import { routePointsData } from '../../data/mapRouteData';
import { calculateDistance } from '../../utils/geoUtils'

// Define props interface
interface GeofenceManagerProps {
  userPosition: [number, number] | null;
  radius: number; // Radius in meters
  onEnterGeofence?: (pointData: any) => void;
  onExitGeofence?: (pointData: any) => void;
  children?: React.ReactNode;
}

// Define the GeofenceManager component
const GeofenceManager: React.FC<GeofenceManagerProps> = ({
  userPosition,
  radius,
  onEnterGeofence,
  onExitGeofence,
  children
}) => {
  // Store the active points (points within the geofence radius)
  const [activePoints, setActivePoints] = useState<string[]>([]);
  
  // Check if user is within any geofence when their position changes
  useEffect(() => {
    if (!userPosition) return;
    
    // Track newly active points
    const newActivePoints: string[] = [];
    
    // Check each point in the route data
    routePointsData.features.forEach(feature => {
      const pointCoords = feature.geometry.coordinates;
      const distance = calculateDistance(userPosition, pointCoords);
      
      // Check if user is within the specified radius
      if (distance <= radius) {
        const pointId = feature.properties.iconName;
        newActivePoints.push(pointId);
        
        // If this is a new entry into a geofence, call the callback
        if (!activePoints.includes(pointId) && onEnterGeofence) {
          onEnterGeofence(feature.properties);
        }
      } else if (activePoints.includes(feature.properties.iconName) && onExitGeofence) {
        // If user has exited a previously active geofence
        onExitGeofence(feature.properties);
      }
    });
    
    // Update active points
    setActivePoints(newActivePoints);
  }, [userPosition, radius, onEnterGeofence, onExitGeofence, activePoints]);
  
  // Pass the activePoints to children if needed
  return (
    <>
      {children}
      {/* You can add visual indicators or debugging information here if needed */}
    </>
  );
};

export default GeofenceManager;