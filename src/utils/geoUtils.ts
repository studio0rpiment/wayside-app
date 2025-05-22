// src/utils/geoUtils.ts
import { Feature, Point } from 'geojson';
import { 
  RoutePointFeature, 
  RoutePointProperties, 
  ModalContent,
  ArAnchorPoint
} from '../data/mapRouteData';


// Enhanced interfaces for geofencing
export interface GeofenceResult {
  id: string;
  title: string;
  distance: number;
  coordinates: [number, number];
  properties: RoutePointProperties;
  experienceType?: string;
}

export interface GeofenceState {
  insideGeofences: GeofenceResult[];
  outsideGeofences: GeofenceResult[];
}

export interface GeofenceEntry {
  id: string;
  title: string;
  iconName: string;
  coordinates: [number, number];
  distance: number;
  direction: number | null;
  isActive: boolean;
  isNearby: boolean;
  lastEntered: Date | null;
  lastExited: Date | null;
  modalContent: ModalContent;
  iconScale: number;
}

/**
 * Calculate distance between two geographic points using the Haversine formula
 * @param point1 [longitude, latitude] of first point
 * @param point2 [longitude, latitude] of second point
 * @returns Distance in meters
 */
export function calculateDistance(
  point1: [number, number],
  point2: [number, number]
): number {
  // Implementation of haversine formula to calculate distance between two points
  const R = 6371000; // Earth radius in meters
  const φ1 = (point1[1] * Math.PI) / 180;
  const φ2 = (point2[1] * Math.PI) / 180;
  const Δφ = ((point2[1] - point1[1]) * Math.PI) / 180;
  const Δλ = ((point2[0] - point1[0]) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance;
}

/**
 * Check if user is within any geofences
 * @param userPosition User's [longitude, latitude]
 * @param geofenceFeatures Array of geofence features from mapRouteData
 * @param radius Detection radius in meters
 * @returns Object containing inside and outside geofences sorted by distance
 */
export function checkGeofences(
  userPosition: [number, number],
  geofenceFeatures: Feature[] | RoutePointFeature[],
  radius: number
): GeofenceState {
  const insideGeofences: GeofenceResult[] = [];
  const outsideGeofences: GeofenceResult[] = [];

  geofenceFeatures.forEach(feature => {
    // Ensure feature is a point
    if (feature.geometry.type !== 'Point') return;

    const coordinates = feature.geometry.coordinates as [number, number];
    const distance = calculateDistance(userPosition, coordinates);

    // Create the result matching our internal format
    const result: GeofenceResult = {
      id: feature.properties?.iconName || (feature as any).id || `geofence-${Math.random()}`,
      title: feature.properties?.title || 'Unnamed Location',
      distance,
      coordinates,
      properties: feature.properties as RoutePointProperties ?? {
        iconName: 'unknown',
        iconScale: 1,
        title: 'Unnamed Location',
        modalContent: {
          title: 'Unknown',
          description: '',
          experienceRoute: '',
          buttonText: 'OK'
        }
      },
      experienceType: (feature.properties as any)?.experienceType
    };

    // Check if user is within radius
    if (distance <= radius) {
      insideGeofences.push(result);
    } else {
      outsideGeofences.push(result);
    }
  });

  // Sort by distance, closest first
  insideGeofences.sort((a, b) => a.distance - b.distance);
  outsideGeofences.sort((a, b) => a.distance - b.distance);

  return { insideGeofences, outsideGeofences };
}

/**
 * Calculate direction (bearing) between two points
 * @param from Starting point [longitude, latitude]
 * @param to Destination point [longitude, latitude]
 * @returns Direction in degrees (0-360, where 0 is North)
 */
export function calculateDirection(
  from: [number, number],
  to: [number, number]
): number {
  const startLat = from[1] * Math.PI / 180;
  const startLng = from[0] * Math.PI / 180;
  const destLat = to[1] * Math.PI / 180;
  const destLng = to[0] * Math.PI / 180;

  const y = Math.sin(destLng - startLng) * Math.cos(destLat);
  const x = Math.cos(startLat) * Math.sin(destLat) -
            Math.sin(startLat) * Math.cos(destLat) * Math.cos(destLng - startLng);
  let brng = Math.atan2(y, x) * 180 / Math.PI;
  
  // Normalize to 0-360
  brng = (brng + 360) % 360;
  
  return brng;
}

/**
 * Check for geofences within two different radiuses
 * Used to identify both active and nearby geofences
 * @param userPosition User's [longitude, latitude]
 * @param geofenceFeatures Array of geofence features from mapRouteData
 * @param primaryRadius Inner radius for active geofences (meters)
 * @param extendedRadius Outer radius for nearby geofences (meters)
 */
export function checkExtendedGeofences(
  userPosition: [number, number],
  geofenceFeatures: RoutePointFeature[],
  primaryRadius: number,
  extendedRadius: number
): {
  activeGeofences: GeofenceEntry[];
  nearbyGeofences: GeofenceEntry[];
} {
  // First check active geofences (inside primary radius)
  const primaryResults = checkGeofences(userPosition, geofenceFeatures, primaryRadius);
  
  // Then check extended radius
  const extendedResults = checkGeofences(userPosition, geofenceFeatures, extendedRadius);
  
  // Convert to GeofenceEntry format and calculate directions
  const activeGeofences = primaryResults.insideGeofences.map(geofence => ({
    id: geofence.id,
    title: geofence.title,
    iconName: geofence.properties.iconName,
    coordinates: geofence.coordinates,
    distance: geofence.distance,
    direction: null, // Direction not meaningful when inside
    isActive: true,
    isNearby: false,
    lastEntered: new Date(),
    lastExited: null,
    modalContent: geofence.properties.modalContent,
    iconScale: geofence.properties.iconScale
  }));
  
  // Get IDs of active geofences to exclude from nearby
  const activeIds = activeGeofences.map(g => g.id);
  
  // Find geofences that are in extended radius but not in primary radius
  const nearbyGeofences = extendedResults.insideGeofences
    .filter(geofence => !activeIds.includes(geofence.id))
    .map(geofence => {
      // Calculate direction to geofence
      const direction = calculateDirection(userPosition, geofence.coordinates);
      
      return {
        id: geofence.id,
        title: geofence.title,
        iconName: geofence.properties.iconName,
        coordinates: geofence.coordinates,
        distance: geofence.distance,
        direction,
        isActive: false,
        isNearby: true,
        lastEntered: null,
        lastExited: null,
        modalContent: geofence.properties.modalContent,
        iconScale: geofence.properties.iconScale
      };
    });
  
  return { activeGeofences, nearbyGeofences };
}

/**
 * Helper to find geofence changes between two sets
 * @param currentIds Array of current geofence IDs
 * @param previousIds Array of previous geofence IDs
 */
export function findGeofenceChanges(
  currentIds: string[],
  previousIds: string[]
): {
  entered: string[];
  exited: string[];
} {
  const entered = currentIds.filter(id => !previousIds.includes(id));
  const exited = previousIds.filter(id => !currentIds.includes(id));
  
  return { entered, exited };
}

/**
 * Convert GPS/WGS84 coordinates to local coordinates for AR
 * @param originPosition Origin point [longitude, latitude] to use as (0,0)
 * @param targetPosition Target point [longitude, latitude] to convert
 * @param scale Scale factor to apply (meters per unit)
 * @returns [x, y, z] Local coordinates in meters from origin
 */
export function gpsToLocalCoordinates(
  originPosition: [number, number],
  targetPosition: [number, number],
  scale: number = 1.0
): [number, number, number] {
  // Calculate distance
  const distance = calculateDistance(originPosition, targetPosition);
  
  // Calculate direction
  const bearing = calculateDirection(originPosition, targetPosition);
  
  // Convert to radians
  const bearingRad = bearing * Math.PI / 180;
  
  // Calculate x and z (using z as north in Three.js convention)
  // In Three.js: x = east, y = up, z = south (negative = north)
  const x = Math.sin(bearingRad) * distance * scale;
  const z = -Math.cos(bearingRad) * distance * scale; // Negative because z is south in Three.js
  
  // y would represent altitude difference, default to 0
  const y = 0;
  
  return [x, y, z];
}

/**
 * Get relative orientation between user heading and geofence direction
 * @param userHeading User's compass heading in degrees
 * @param geofenceDirection Direction to geofence in degrees
 * @returns Relative angle in degrees (-180 to 180)
 */
export function getRelativeOrientation(
  userHeading: number,
  geofenceDirection: number
): number {
  // Calculate the difference
  let relativeBearing = geofenceDirection - userHeading;
  
  // Normalize to -180 to 180
  while (relativeBearing > 180) relativeBearing -= 360;
  while (relativeBearing < -180) relativeBearing += 360;
  
  return relativeBearing;
}

/**
 * Find a geofence feature by ID
 * @param geofenceFeatures Array of geofence features from mapRouteData
 * @param geofenceId ID of the geofence to find
 */
export function findGeofenceById(
  geofenceFeatures: RoutePointFeature[],
  geofenceId: string
): RoutePointFeature | undefined {
  return geofenceFeatures.find(
    feature => 
      feature.properties.iconName === geofenceId || 
      feature.properties.title === geofenceId
  );
}

/**
 * Check if two positions are close enough to be considered at the same location
 * @param positionA First position [longitude, latitude]
 * @param positionB Second position [longitude, latitude]
 * @param tolerance Maximum distance in meters to be considered same location
 */
export function isSameLocation(
  positionA: [number, number] | null,
  positionB: [number, number] | null,
  tolerance: number = 5
): boolean {
  if (!positionA || !positionB) return false;
  
  const distance = calculateDistance(positionA, positionB);
  return distance <= tolerance;
}

/**
 * Filter out jitter in GPS readings
 * @param positions Array of recent position readings
 * @param maxJitter Maximum distance that could be considered jitter
 * @returns Filtered position (usually the average of stable positions)
 */
export function filterPositionJitter(
  positions: [number, number][],
  maxJitter: number = 10
): [number, number] | null {
  if (positions.length === 0) return null;
  if (positions.length === 1) return positions[0];
  
  // Simple approach: return the most recent position if it's not too far from previous
  const latest = positions[positions.length - 1];
  const previous = positions[positions.length - 2];
  
  if (calculateDistance(latest, previous) <= maxJitter) {
    return latest;
  }
  
  // If there's significant movement, we average the last 3 positions
  // This helps smooth out jumps while still allowing real movement
  const recentPositions = positions.slice(-3);
  const avgLng = recentPositions.reduce((sum, pos) => sum + pos[0], 0) / recentPositions.length;
  const avgLat = recentPositions.reduce((sum, pos) => sum + pos[1], 0) / recentPositions.length;
  
  return [avgLng, avgLat];
}

/**
 * Convert GPS coordinates to AR anchor points for experiences
 * This is a specialized function for translating geofence points into AR anchor points
 * @param userPosition Current user position as [longitude, latitude]
 * @param geofencePoint The geofence point to convert
 * @param userHeading User's current heading in degrees (if available)
 */
export function createArAnchorPoint(
  userPosition: [number, number],
  geofencePoint: RoutePointFeature,
  userHeading: number | null = null
): {
  position: [number, number, number]; // Local coordinates [x, y, z]
  rotation: [number, number, number]; // Euler angles [x, y, z] in radians
  scale: [number, number, number]; // Scale factors [x, y, z]
} {
  // Convert GPS coordinates to local position
  const position = gpsToLocalCoordinates(
    userPosition,
    geofencePoint.geometry.coordinates
  );
  
  // Default rotation based on direction to point
  let rotation: [number, number, number] = [0, 0, 0];
  
  // If we have user heading, calculate proper orientation
  if (userHeading !== null) {
    const direction = calculateDirection(
      userPosition,
      geofencePoint.geometry.coordinates
    );
    
    // Calculate the y-rotation (heading) in radians
    // In Three.js, rotation around y-axis controls horizontal orientation
    const relativeDirection = getRelativeOrientation(userHeading, direction);
    rotation = [0, relativeDirection * Math.PI / 180, 0];
  }
  
  // Default scale based on iconScale property
  const scale: [number, number, number] = [
    geofencePoint.properties.iconScale,
    geofencePoint.properties.iconScale,
    geofencePoint.properties.iconScale
  ];
  
  return { position, rotation, scale };
}