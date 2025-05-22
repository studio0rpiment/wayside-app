// src/utils/geoArUtils.ts
import * as THREE from 'three';

/**
 * Utilities for converting GPS coordinates to AR 3D space
 * Based on Spherical Mercator projection with local origin
 */

// Earth radius in meters (WGS84)
const EARTH_RADIUS = 6378137;

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Convert radians to degrees
 */
function toDegrees(radians: number): number {
  return radians * (180 / Math.PI);
}

/**
 * Calculate distance between two GPS points using Haversine formula
 * Returns distance in meters
 */
export function calculateGpsDistance(
  point1: [number, number], 
  point2: [number, number]
): number {
  const [lon1, lat1] = point1;
  const [lon2, lat2] = point2;
  
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS * c;
}

/**
 * Calculate bearing (direction) from point1 to point2
 * Returns bearing in degrees (0 = North, 90 = East)
 */
export function calculateBearing(
  from: [number, number], 
  to: [number, number]
): number {
  const [lon1, lat1] = from;
  const [lon2, lat2] = to;
  
  const dLon = toRadians(lon2 - lon1);
  const lat1Rad = toRadians(lat1);
  const lat2Rad = toRadians(lat2);
  
  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
  
  const bearing = toDegrees(Math.atan2(y, x));
  return (bearing + 360) % 360; // Normalize to 0-360
}

/**
 * Convert GPS coordinates to local Cartesian coordinates
 * Uses the user's position as the origin (0,0,0)
 * Returns [x, y, z] where:
 * - x: East-West (positive = East)
 * - y: Up-Down (elevation)
 * - z: North-South (positive = North, negative = South)
 */
export function gpsToLocalCoordinates(
  userGps: [number, number],
  targetGps: [number, number],
  targetElevation: number = 0,
  userElevation: number = 0
): [number, number, number] {
  const [userLon, userLat] = userGps;
  const [targetLon, targetLat] = targetGps;
  
  // Convert to radians
  const userLatRad = toRadians(userLat);
  const userLonRad = toRadians(userLon);
  const targetLatRad = toRadians(targetLat);
  const targetLonRad = toRadians(targetLon);
  
  // Calculate differences
  const dLat = targetLatRad - userLatRad;
  const dLon = targetLonRad - userLonRad;
  
  // Convert to meters using local approximation
  // For small distances, this is more accurate than full projection
  const cosLat = Math.cos(userLatRad);
  
  // X: East-West distance (longitude difference)
  const x = dLon * EARTH_RADIUS * cosLat;
  
  // Z: North-South distance (latitude difference) 
  // Note: Negative because in Three.js, negative Z is "into the screen"
  const z = -dLat * EARTH_RADIUS;
  
  // Y: Elevation difference
  const y = targetElevation - userElevation;
  
  return [x, y, z];
}

/**
 * Convert GPS coordinates to Three.js world position
 * This is the main function for AR positioning
 */
export function gpsToThreeJsPosition(
  userGps: [number, number],
  anchorGps: [number, number],
  anchorElevation: number = 2.0,
  coordinateScale: number = 1.0 // Scale factor for fine-tuning AR positioning
): THREE.Vector3 {
  const [x, y, z] = gpsToLocalCoordinates(
    userGps, 
    anchorGps, 
    anchorElevation, 
    0 // Assume user is at ground level
  );
  
  // Apply coordinate scaling for AR fine-tuning
  return new THREE.Vector3(x * coordinateScale, y, z * coordinateScale);
}

/**
 * Check if a target position is within a reasonable AR viewing distance
 * Returns true if the target should be rendered
 */
export function isWithinArRange(
  userGps: [number, number],
  targetGps: [number, number],
  maxDistance: number = 200 // Increased from 100m to 200m for your route
): boolean {
  const distance = calculateGpsDistance(userGps, targetGps);
  return distance <= maxDistance;
}

/**
 * Get visibility level for AR objects based on distance
 * Returns: 'close' | 'medium' | 'far' | 'too-far'
 */
export function getArVisibilityLevel(
  userGps: [number, number],
  targetGps: [number, number]
): 'close' | 'medium' | 'far' | 'too-far' {
  const distance = calculateGpsDistance(userGps, targetGps);
  
  if (distance <= 50) return 'close';
  if (distance <= 150) return 'medium';
  if (distance <= 300) return 'far';
  return 'too-far';
}

/**
 * Calculate the appropriate scale for an AR object based on distance
 * Objects farther away should appear smaller to maintain realism
 */
export function getDistanceBasedScale(
  userGps: [number, number],
  targetGps: [number, number],
  baseScale: number = 1.0,
  minScale: number = 0.1,
  maxScale: number = 2.0
): number {
  const distance = calculateGpsDistance(userGps, targetGps);
  
  // Scale inversely with distance, but clamp to reasonable values
  const scaleMultiplier = Math.max(0.1, 50 / distance); // 50m = 1x scale
  const finalScale = baseScale * scaleMultiplier;
  
  return Math.max(minScale, Math.min(maxScale, finalScale));
}

/**
 * Test function to validate coordinate conversion with your route data
 * Simulates being inside the Lotus geofence
 */
export function testCoordinateConversion() {
  // Simulate user inside Lotus geofence (slightly offset from exact anchor)
  const userPosition: [number, number] = [-76.94285995597841, 38.912281301501985]; // Near Lotus
  const anchorPosition: [number, number] = [-76.94290995597841, 38.912261301501985]; // Lotus anchor
  
  return testSingleExperience(userPosition, anchorPosition, 'Lotus Experience', 1.0);
}

/**
 * Test different coordinate scales to see the effect
 */
export function testCoordinateScaling() {
  const userPosition: [number, number] = [-76.94285995597841, 38.912281301501985];
  const anchorPosition: [number, number] = [-76.94290995597841, 38.912261301501985];
  
  console.group('🔧 Coordinate Scaling Test');
  console.log('Testing different scale factors for AR positioning:');
  
  [0.5, 1.0, 1.5, 2.0].forEach(scale => {
    console.log(`\n--- Scale: ${scale}x ---`);
    testSingleExperience(userPosition, anchorPosition, `Lotus (${scale}x)`, scale);
  });
  
  console.groupEnd();
}

/**
 * Helper function to get cardinal direction from bearing
 */
function getBearingDirection(bearing: number): string {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(bearing / 45) % 8;
  return directions[index];
}

/**
 * Test a single geofence experience (simulates being inside a geofence)
 */
export function testSingleExperience(
  userPosition: [number, number],
  anchorPosition: [number, number],
  experienceName: string = 'Test Experience',
  coordinateScale: number = 1.0
) {
  console.group(`🎯 Single Experience Test: ${experienceName}`);
  
  const distance = calculateGpsDistance(userPosition, anchorPosition);
  console.log(`Distance to anchor: ${distance.toFixed(2)}m`);
  
  const bearing = calculateBearing(userPosition, anchorPosition);
  console.log(`Bearing: ${bearing.toFixed(1)}° (${getBearingDirection(bearing)})`);
  
  const threeJsPos = gpsToThreeJsPosition(userPosition, anchorPosition, 2.0, coordinateScale);
  console.log(`AR Position: (${threeJsPos.x.toFixed(2)}, ${threeJsPos.y.toFixed(2)}, ${threeJsPos.z.toFixed(2)})`);
  
  if (coordinateScale !== 1.0) {
    console.log(`Coordinate scale applied: ${coordinateScale}x`);
  }
  
  const visibilityLevel = getArVisibilityLevel(userPosition, anchorPosition);
  console.log(`Visibility level: ${visibilityLevel}`);
  
  const scale = getDistanceBasedScale(userPosition, anchorPosition);
  console.log(`Recommended scale: ${scale.toFixed(2)}`);
  
  console.groupEnd();
  
  return {
    distance,
    bearing,
    position: threeJsPos,
    visibilityLevel,
    scale
  };
}