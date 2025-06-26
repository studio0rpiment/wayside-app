// src/utils/coordinate-system/WorldCoordinateSystem.ts
import * as THREE from 'three';
import { kenilworthPolygonCoordinates } from '../../data/kenilworth_aquatic_gardens';


// Calculate ONCE at module level
let CACHED_CENTROID: [number, number] | null = null;


// Earth radius in meters (WGS84)
const EARTH_RADIUS = 6378137;

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

function toDegrees(radians: number): number {
  return radians * (180 / Math.PI);
}

/**
 * Calculate the centroid of the Kenilworth polygon for precise origin
 */
function calculateKenilworthCentroid(): [number, number] {
  if (CACHED_CENTROID) {
    console.log(`📍 Using cached Kenilworth centroid: [${CACHED_CENTROID[0]}, ${CACHED_CENTROID[1]}]`);
    return CACHED_CENTROID;
  }

  const coordinates = kenilworthPolygonCoordinates.features[0].geometry.coordinates[0];
  
  let totalLon = 0;
  let totalLat = 0;
  const pointCount = coordinates.length - 1; // Exclude duplicate closing point
  
  for (let i = 0; i < pointCount; i++) {
    totalLon += coordinates[i][0];
    totalLat += coordinates[i][1];
  }
  
  const centroidLon = totalLon / pointCount;
  const centroidLat = totalLat / pointCount;
  
  CACHED_CENTROID = [centroidLon, centroidLat]; // ← Add semicolon here

  console.log(`📍 Calculated and cached Kenilworth centroid: [${centroidLon}, ${centroidLat}]`);
  return CACHED_CENTROID;
}

/**
 * Enhanced world coordinate system using precise Kenilworth boundaries
 */
export class WorldCoordinateSystem {
  private origin: [number, number];
  private originElevation: number;
  private kenilworthBounds: {
    minLon: number;
    maxLon: number;
    minLat: number;
    maxLat: number;
  };

  constructor(originElevation: number = 0, useCalculatedCentroid: boolean = true) {
    if (useCalculatedCentroid) {
      this.origin = calculateKenilworthCentroid();
    } else {
      // Fallback to your original center point
      this.origin = [-76.943, 38.9125];
    }
    
    this.originElevation = originElevation;
    this.kenilworthBounds = this.calculateBounds();
    
    console.log(`🌍 Kenilworth world coordinate system established:`);
    console.log(`   Origin: [${this.origin[0]}, ${this.origin[1]}]`);
    console.log(`   Elevation: ${originElevation}m`);
    console.log(`   Bounds:`, this.kenilworthBounds);
  }

  private calculateBounds() {
    const coordinates = kenilworthPolygonCoordinates.features[0].geometry.coordinates[0];
    
    let minLon = Infinity, maxLon = -Infinity;
    let minLat = Infinity, maxLat = -Infinity;
    
    coordinates.forEach(([lon, lat]) => {
      minLon = Math.min(minLon, lon);
      maxLon = Math.max(maxLon, lon);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    });
    
    return { minLon, maxLon, minLat, maxLat };
  }

  /**
   * Convert GPS coordinates to persistent world coordinates
   */
  gpsToWorld(gps: [number, number], elevation: number = 0): THREE.Vector3 {
    const [originLon, originLat] = this.origin;
    const [targetLon, targetLat] = gps;
    
    // Convert to radians
    const originLatRad = toRadians(originLat);
    const dLat = toRadians(targetLat - originLat);
    const dLon = toRadians(targetLon - originLon);
    
    // Convert to meters using local approximation
    const cosLat = Math.cos(originLatRad);
    
    const x = dLon * EARTH_RADIUS * cosLat;
    const z = -dLat * EARTH_RADIUS; 
    const y = elevation - this.originElevation;
    
    return new THREE.Vector3(x, y, z);
  }

  /**
   * Convert world coordinates back to GPS
   */
  worldToGPS(worldPos: THREE.Vector3): [number, number, number] {
    const [originLon, originLat] = this.origin;
    
    const cosLat = Math.cos(toRadians(originLat));
    const deltaLon = worldPos.x / (EARTH_RADIUS * cosLat);
    const deltaLat = -worldPos.z / EARTH_RADIUS;
    
    const gpsLon = originLon + toDegrees(deltaLon);
    const gpsLat = originLat + toDegrees(deltaLat);
    const gpsElevation = this.originElevation + worldPos.y;
    
    return [gpsLon, gpsLat, gpsElevation];
  }

  /**
   * Check if GPS coordinates are within Kenilworth boundaries
   */
  isWithinKenilworth(gps: [number, number]): boolean {
    const [lon, lat] = gps;
    return (
      lon >= this.kenilworthBounds.minLon &&
      lon <= this.kenilworthBounds.maxLon &&
      lat >= this.kenilworthBounds.minLat &&
      lat <= this.kenilworthBounds.maxLat
    );
  }

  /**
   * Get the precise Kenilworth polygon coordinates in world space
   */
  getKenilworthWorldPolygon(): THREE.Vector3[] {
    const coordinates = kenilworthPolygonCoordinates.features[0].geometry.coordinates[0];
    return coordinates.slice(0, -1).map(([lon, lat]) => 
      this.gpsToWorld([lon, lat], 0)
    );
  }

  getOrigin(): [number, number] {
    return [...this.origin];
  }

  getOriginElevation(): number {
    return this.originElevation;
  }
}