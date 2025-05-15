// geoUtils.ts

/**
 * Calculate the distance between two points on Earth using the Haversine formula
 * @param point1 First point as [longitude, latitude]
 * @param point2 Second point as [longitude, latitude]
 * @returns Distance in meters
 */
export const calculateDistance = (
  point1: [number, number], 
  point2: [number, number]
): number => {
  const [lon1, lat1] = point1;
  const [lon2, lat2] = point2;
  
  // Convert latitude and longitude from degrees to radians
  const radLat1 = (lat1 * Math.PI) / 180;
  const radLat2 = (lat2 * Math.PI) / 180;
  const radLon1 = (lon1 * Math.PI) / 180;
  const radLon2 = (lon2 * Math.PI) / 180;
  
  // Differences in coordinates
  const dLat = radLat2 - radLat1;
  const dLon = radLon2 - radLon1;
  
  // Haversine formula
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(radLat1) * Math.cos(radLat2) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  // Earth's radius in meters
  const R = 6371000;
  
  // Distance in meters
  return R * c;
};

/**
 * Check if a position is inside any of the geofences
 * @param userPosition User's position as [longitude, latitude]
 * @param geofencePoints Array of geofence points
 * @param radius Radius in meters
 * @returns An object with information about which geofences the user is inside
 */
export const checkGeofences = (
  userPosition: [number, number],
  geofencePoints: typeof import('../data/mapRouteData').routePointsData.features,
  radius: number = 3
): {
  isInsideAny: boolean;
  insideGeofences: Array<{
    id: string;
    title: string;
    distance: number;
  }>
} => {
  if (!userPosition) {
    return { isInsideAny: false, insideGeofences: [] };
  }
  
  const insideGeofences = geofencePoints
    .map(point => {
      const distance = calculateDistance(userPosition, point.geometry.coordinates);
      return {
        id: point.properties.iconName,
        title: point.properties.title,
        distance,
        isInside: distance <= radius
      };
    })
    .filter(point => point.isInside)
    .map(({ id, title, distance }) => ({ id, title, distance }));
  
  return {
    isInsideAny: insideGeofences.length > 0,
    insideGeofences
  };
};