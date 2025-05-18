// src/utils/geoUtils.ts
import { Feature, Point } from 'geojson';

interface GeofenceResult {
  id: string;
  title: string;
  distance: number;
  properties: any;
  experienceType?: string;
}

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

export function checkGeofences(
  userPosition: [number, number],
  geofenceFeatures: Feature[],
  radius: number
): {
  insideGeofences: GeofenceResult[];
  outsideGeofences: GeofenceResult[];
} {
  const insideGeofences: GeofenceResult[] = [];
  const outsideGeofences: GeofenceResult[] = [];

  geofenceFeatures.forEach(feature => {
    // Ensure feature is a point
    if (feature.geometry.type !== 'Point') return;

    const coordinates = feature.geometry.coordinates as [number, number];
    const distance = calculateDistance(userPosition, coordinates);

    const result: GeofenceResult = {
      id: feature.properties?.iconName || feature.id || `geofence-${Math.random()}`,
      title: feature.properties?.title || 'Unnamed Location',
      distance,
      properties: feature.properties || {},
      experienceType: feature.properties?.experienceType
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