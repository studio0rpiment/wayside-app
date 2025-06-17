// src/utils/geoArUtils.ts - Enhanced with terrain awareness
import * as THREE from 'three';
import { getElevationAtGPS, gpsToThreeJsPositionWithTerrain } from './terrainUtils';

/**
 * Enhanced utilities for converting GPS coordinates to AR 3D space
 * Now includes terrain-aware positioning using LiDAR heightmap data
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
  const cosLat = Math.cos(userLatRad);
  
  // X: East-West distance (longitude difference)
  const x = dLon * EARTH_RADIUS * cosLat;
  
  // Z: North-South distance (latitude difference) 
  // Note: Negative because in Three.js, negative Z is "into the screen"
  const z = dLat * EARTH_RADIUS;
  
  // Y: Elevation difference
  const y = targetElevation - userElevation;
  
  return [x, y, z];
}

/**
 * LEGACY: Convert GPS coordinates to Three.js world position (original method)
 * This maintains your existing implementation for compatibility
 */
export function gpsToThreeJsPosition(
  userGps: [number, number],
  anchorGps: [number, number],
  anchorElevation: number = 2.0,
  coordinateScale: number = 1.0
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
 * ENHANCED: Convert GPS coordinates to Three.js world position with terrain awareness
 * This is the new terrain-aware version that should replace gpsToThreeJsPosition
 */
export function gpsToThreeJsPositionTerrain(
  userGps: [number, number],
  anchorGps: [number, number],
  elevationOffset: number = 0,  // Height ABOVE ground level
  coordinateScale: number = 1.0,
  fallbackElevation: number = 0  // Used if no terrain data available
): {
  position: THREE.Vector3;
  terrainElevation: number | null;
  usedTerrain: boolean;
} {
  try {
    // Try to use terrain-aware positioning
    const result = gpsToThreeJsPositionWithTerrain(
      userGps, 
      anchorGps, 
      elevationOffset, 
      coordinateScale
    );
    
    return {
      position: result.position,
      terrainElevation: result.terrainElevation,
      usedTerrain: result.terrainElevation !== null
    };
    
  } catch (error) {
    console.warn('⚠️ Terrain lookup failed, using fallback:', error);
    
    // Fallback to original method
    const fallbackPosition = gpsToThreeJsPosition(
      userGps, 
      anchorGps, 
      fallbackElevation, 
      coordinateScale
    );
    
    return {
      position: fallbackPosition,
      terrainElevation: null,
      usedTerrain: false
    };
  }
}

/**
 * Check if a target position is within a reasonable AR viewing distance
 * Returns true if the target should be rendered
 */
export function isWithinArRange(
  userGps: [number, number],
  targetGps: [number, number],
  maxDistance: number = 200
): boolean {
  const distance = calculateGpsDistance(userGps, targetGps);
  return distance <= maxDistance;
}

/**
 * Get visibility level for AR objects based on distance
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
 * Enhanced anchor positioning with terrain awareness and experience-specific adjustments
 * This function replaces the manual elevation settings in your mapRouteData
 */
export function getEnhancedAnchorPosition(
  userGps: [number, number],
  anchorGps: [number, number],
  experienceType: string,
  coordinateScale: number = 1.0
): {
  position: THREE.Vector3;
  terrainElevation: number | null;
  usedTerrain: boolean;
  experienceOffset: number;
} {
  // Experience-specific elevation offsets (height above terrain)
  const experienceOffsets: Record<string, number> = {
    // Water-based experiences should be at or near water surface
    'lotus': 0,      // Slightly above water surface
    'lily': 0,       // Slightly above water surface
    'cattail': 0,    // Taller, emergent plant
    
    // Historical moments on paths/boardwalks
    'mac': 0,        // Human height on boardwalk
    'helen_s': 0,    // Human height on path
    'volunteers': 0, // Human height on ground
    
    // Environmental effects
    '2030-2105': 0.0,  // Water rise starts at current water level
    '1968': 0.0,      // Smoke rises high above horizon
    '2200_bc': 0,    // Canoe at water surface
    
    // Default for unknown experiences
    'default': 0.0
  };
  
  const elevationOffset = experienceOffsets[experienceType] || experienceOffsets['default'];
  
  // Get terrain-aware position
  const result = gpsToThreeJsPositionTerrain(
    userGps,
    anchorGps,
    elevationOffset,
    coordinateScale,
    elevationOffset // Use same value as fallback
  );
  
  // console.log(`🎯 ${experienceType} anchor: ${result.usedTerrain ? 'terrain-aware' : 'fallback'} positioning`);
  if (result.terrainElevation !== null) {
    // console.log(`   Terrain: ${result.terrainElevation.toFixed(2)}m + ${elevationOffset}m offset`);
  }
  
  return {
    ...result,
    experienceOffset: elevationOffset
  };
}

/**
 * Validate terrain data availability for your anchor positions
 */
export function validateTerrainCoverage(anchors: Array<{ name: string; coordinates: [number, number] }>): void {
  // console.log('🔍 Validating terrain coverage for anchors...');
  
  let terrainAvailable = 0;
  let noTerrain = 0;
  
  anchors.forEach(anchor => {
    const [lon, lat] = anchor.coordinates;
    const elevation = getElevationAtGPS(lon, lat);
    if (elevation !== null) {
      console.log(`✅ ${anchor.name}: ${elevation.toFixed(2)}m elevation`);
      terrainAvailable++;
      // console.log(`✅ ${anchor.name}: ${elevation.toFixed(2)}m elevation`);
    } else {
      console.log(`❌ ${anchor.name}: No terrain data`);
      noTerrain++;
      // console.log(`❌ ${anchor.name}: No terrain data`);
    }
  });
  
  // console.log(`📊 Terrain coverage: ${terrainAvailable}/${anchors.length} anchors have elevation data`);
}

/**
 * Test function for terrain-aware positioning with your specific anchors
 */
export function testTerrainPositioning(): void {
  const testUserPosition: [number, number] = [-76.943, 38.9125]; // Center of gardens
  
  const testAnchors = [
    { name: 'mac', coordinates: [-76.942076, 38.912485] as [number, number], experience: 'mac' },
    { name: 'lotus', coordinates: [-76.942954, 38.912327] as [number, number], experience: 'lotus' },
    { name: 'volunteers', coordinates: [-76.944148, 38.9125] as [number, number], experience: 'volunteers' },
    { name: 'cattail', coordinates: [-76.947519, 38.911934] as [number, number], experience: 'cattail' }
  ];
  
  // console.log('🧪 Testing terrain-aware positioning...');
  // console.log(`👤 User position: ${testUserPosition[0]}, ${testUserPosition[1]}`);
  
  testAnchors.forEach(anchor => {
    // console.log(`\n🎯 Testing ${anchor.name} (${anchor.experience}):`);
    
    // Test original method
    const originalPos = gpsToThreeJsPosition(
      testUserPosition,
      anchor.coordinates,
      2.0, // Fixed elevation
      1.0
    );
    
    // Test terrain-aware method
    const terrainPos = getEnhancedAnchorPosition(
      testUserPosition,
      anchor.coordinates,
      anchor.experience,
      1.0
    );
    
    // console.log(`   Original: (${originalPos.x.toFixed(2)}, ${originalPos.y.toFixed(2)}, ${originalPos.z.toFixed(2)})`);
    // console.log(`   Terrain:  (${terrainPos.position.x.toFixed(2)}, ${terrainPos.position.y.toFixed(2)}, ${terrainPos.position.z.toFixed(2)})`);
    // console.log(`   Method: ${terrainPos.usedTerrain ? 'LiDAR elevation' : 'Fallback'}`);
    
    if (terrainPos.terrainElevation !== null) {
      // console.log(`   Ground level: ${terrainPos.terrainElevation.toFixed(2)}m`);
      // console.log(`   Experience offset: +${terrainPos.experienceOffset}m`);
    }
  });
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
 * Test a single geofence experience with terrain awareness
 */
export function testSingleExperienceWithTerrain(
  userPosition: [number, number],
  anchorPosition: [number, number],
  experienceType: string,
  experienceName: string = 'Test Experience',
  coordinateScale: number = 1.0
) {
  // console.group(`🎯 Terrain Test: ${experienceName}`);
  
  const distance = calculateGpsDistance(userPosition, anchorPosition);
  // console.log(`Distance to anchor: ${distance.toFixed(2)}m`);
  
  const bearing = calculateBearing(userPosition, anchorPosition);
  // console.log(`Bearing: ${bearing.toFixed(1)}° (${getBearingDirection(bearing)})`);
  
  // Test terrain-aware positioning
  const result = getEnhancedAnchorPosition(
    userPosition,
    anchorPosition,
    experienceType,
    coordinateScale
  );
  
  // console.log(`AR Position: (${result.position.x.toFixed(2)}, ${result.position.y.toFixed(2)}, ${result.position.z.toFixed(2)})`);
  // console.log(`Positioning method: ${result.usedTerrain ? 'Terrain-aware' : 'Fallback'}`);
  
  if (result.terrainElevation !== null) {
    // console.log(`Terrain elevation: ${result.terrainElevation.toFixed(2)}m`);
    // console.log(`Experience offset: +${result.experienceOffset}m`);
    // console.log(`Final elevation: ${(result.terrainElevation + result.experienceOffset).toFixed(2)}m`);
  }
  
  const visibilityLevel = getArVisibilityLevel(userPosition, anchorPosition);
  // console.log(`Visibility level: ${visibilityLevel}`);
  
  const scale = getDistanceBasedScale(userPosition, anchorPosition);
  // console.log(`Recommended scale: ${scale.toFixed(2)}`);
  
  // console.groupEnd();
  
  return {
    distance,
    bearing,
    position: result.position,
    terrainElevation: result.terrainElevation,
    usedTerrain: result.usedTerrain,
    visibilityLevel,
    scale
  };
}

/**
 * Test terrain positioning for all your Kenilworth experiences
 */
export function testKenilworthExperiences(): void {
  // Simulate being at the visitor center area
  const userPosition: [number, number] = [-76.943, 38.9125];
  
  const experiences = [
    { anchor: [-76.942076, 38.912485] as [number, number], type: 'mac', name: 'Ranger Mac' },
    { anchor: [-76.942954, 38.912327] as [number, number], type: 'lotus', name: 'Lotus Experience' },
    { anchor: [-76.944148, 38.9125] as [number, number], type: 'volunteers', name: 'Volunteers' },
    { anchor: [-76.943534, 38.913195] as [number, number], type: 'helen_s', name: 'Helen Fowler' },
    { anchor: [-76.944643, 38.913399] as [number, number], type: 'lily', name: 'Water Lily' },
    { anchor: [-76.947519, 38.911934] as [number, number], type: 'cattail', name: 'Cattail Experience' }
  ];
  
  // console.log('🌊 Testing all Kenilworth AR experiences with terrain awareness');
  // console.log('═'.repeat(60));
  
  experiences.forEach(exp => {
    testSingleExperienceWithTerrain(
      userPosition,
      exp.anchor,
      exp.type,
      exp.name,
      1.0
    );
  });
}

// Export the terrain-enhanced positioning as the main function
export { gpsToThreeJsPositionTerrain as gpsToThreeJsPositionWithTerrain };