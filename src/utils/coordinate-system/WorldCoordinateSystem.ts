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

/* ==============================
 * Calculate the centroid of the Kenilworth polygon for precise origin
 ================================ */
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
  
  CACHED_CENTROID = [centroidLon, centroidLat];

  console.log(`📍 Calculated and cached Kenilworth centroid: [${centroidLon}, ${centroidLat}]`);
  return CACHED_CENTROID;
}

/**
 * Enhanced world coordinate system using precise Kenilworth boundaries
 * Now includes configurable coordinate transformations for GPS calibration
 */
export class WorldCoordinateSystem {
  private origin: [number, number];
  private originElevation: number;
  
  // Kenilworth bounds functionality
  private kenilworthBounds: {
    minLon: number;
    maxLon: number;
    minLat: number;
    maxLat: number;
  };

   /***************
   * Coordinate transformation parameters 
   *****************/
  private horizontalRotation: number = 0; 
  private coordinateScale: number = 1.0;   // Scale factor for X-Z coordinates (1.0 = no scaling)
  private translationOffset: THREE.Vector2 = new THREE.Vector2(0, 0); // X-Z translation (meters)

   /***************
   * CConstructor
   *****************/
  constructor(originElevation: number = 0, useCalculatedCentroid: boolean = true) {
    // ✅ Keep existing origin calculation
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
    console.log(`   Transformations: rotation=${this.horizontalRotation}°, scale=${this.coordinateScale}, translation=[${this.translationOffset.x}, ${this.translationOffset.y}]`);
  }

   /***************
   * BOUNDS 
   *****************/
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
   *   includes coordinate transformations while preserving existing behavior
   */
  gpsToWorld(gps: [number, number], elevation: number = 0): THREE.Vector3 {
    const [originLon, originLat] = this.origin;
    const [targetLon, targetLat] = gps;
    
    // Convert to radians OLD METHOS
    // const originLatRad = toRadians(originLat);
    // const dLat = toRadians(targetLat - originLat);
    // const dLon = toRadians(targetLon - originLon);
    
    // // Convert to meters using local approximation
    // const cosLat = Math.cos(originLatRad);
    
    // const x_original = dLon * EARTH_RADIUS * cosLat;
    // const z_original = -dLat * EARTH_RADIUS; 
    // const y = elevation - this.originElevation;

    // ✅ Apply coordinate transformations in sequence:
    // 1. Scale (affects distances uniformly)

    //*************** */ More accurate local projection
    const dLat_degrees = targetLat - originLat;
    const dLon_degrees = targetLon - originLon;

    // Constants for Kenilworth's latitude
    const metersPerDegreeLat = 110540; // relatively constant globally
    const metersPerDegreeLon = 111320 * Math.cos(originLat * Math.PI / 180); // ~86,900 at Kenilworth

    const x_original = dLon_degrees * metersPerDegreeLon;
    const z_original = -dLat_degrees * metersPerDegreeLat; // negative for Three.js coordinates
    const y = elevation - this.originElevation;

    const x_scaled = x_original * this.coordinateScale;
    const z_scaled = z_original * this.coordinateScale;

    // 2. Rotate in horizontal plane (X-Z rotation)
    const rotationRadians = this.horizontalRotation * (Math.PI / 180);
    const x_rotated = x_scaled * Math.cos(rotationRadians) - z_scaled * Math.sin(rotationRadians);
    const z_rotated = x_scaled * Math.sin(rotationRadians) + z_scaled * Math.cos(rotationRadians);
    
    // 3. Translate (shift origin)
    const x_final = x_rotated + this.translationOffset.x;
    const z_final = z_rotated + this.translationOffset.y; // Vector2.y = world Z
    
    return new THREE.Vector3(x_final, y, z_final);
  }

  /**
   * Convert world coordinates back to GPS
   * UPDATE: Reverse transformations to maintain coordinate system consistency
   */
  worldToGPS(worldPos: THREE.Vector3): [number, number, number] {
    // Reverse the transformations in opposite order:
    // 1. Reverse translation
    const x_untranslated = worldPos.x - this.translationOffset.x;
    const z_untranslated = worldPos.z - this.translationOffset.y;

    const [originLon, originLat] = this.origin;

    // Constants for Kenilworth's latitude
    const metersPerDegreeLat = 110540; // relatively constant globally
    const metersPerDegreeLon = 111320 * Math.cos(originLat * Math.PI / 180); // ~86,900 at Kenilworth
    
    // 2. Reverse rotation
    const rotationRadians = -this.horizontalRotation * (Math.PI / 180); // Negative for reverse
    const x_unrotated = x_untranslated * Math.cos(rotationRadians) - z_untranslated * Math.sin(rotationRadians);
    const z_unrotated = x_untranslated * Math.sin(rotationRadians) + z_untranslated * Math.cos(rotationRadians);
    
    // 3. Reverse scale
    const x_unscaled = x_unrotated / this.coordinateScale;
    const z_unscaled = z_unrotated / this.coordinateScale;
    
    // Convert back to GPS
   
    const cosLat = Math.cos(toRadians(originLat));
    const deltaLon_degrees = x_unscaled / metersPerDegreeLon;
    const deltaLat_degrees = -z_unscaled / metersPerDegreeLat;

    const gpsLon = originLon + deltaLon_degrees;
    const gpsLat = originLat + deltaLat_degrees;
    const gpsElevation = this.originElevation + worldPos.y;
    
    return [gpsLon, gpsLat, gpsElevation];
  }

  //  Kenilworth validation methods
  isWithinKenilworth(gps: [number, number]): boolean {
    const [lon, lat] = gps;
    return (
      lon >= this.kenilworthBounds.minLon &&
      lon <= this.kenilworthBounds.maxLon &&
      lat >= this.kenilworthBounds.minLat &&
      lat <= this.kenilworthBounds.maxLat
    );
  }

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

  // ===================================================================
  //  Horizontal Rotation Controls (X-Z plane)
  // ===================================================================

  setHorizontalRotation(degrees: number): void {
    this.horizontalRotation = degrees;
    console.log(`🌍 Horizontal rotation set to ${degrees}° (X-Z plane)`);
  }

  getHorizontalRotation(): number {
    return this.horizontalRotation;
  }

  adjustHorizontalRotation(deltaDegrees: number): void {
    this.horizontalRotation += deltaDegrees;
    console.log(`🌍 Horizontal rotation adjusted to ${this.horizontalRotation}° (X-Z plane)`);
  }

  resetHorizontalRotation(): void {
    this.horizontalRotation = 0; // Your original test value
    console.log(`🌍 Horizontal rotation reset to 0° (original test value)`);
  }

  // ===================================================================
  //  Coordinate Scale Controls (X-Z plane)
  // ===================================================================

  setCoordinateScale(scale: number): void {
    // Validation: reasonable scale factors
    if (scale <= 0) {
      console.warn(`🌍 Invalid scale factor ${scale}, must be > 0. Using 1.0`);
      scale = 1.0;
    }
    if (scale < 0.1 || scale > 10.0) {
      console.warn(`🌍 Extreme scale factor ${scale}, consider values between 0.1 and 10.0`);
    }
    
    this.coordinateScale = scale;
    console.log(`🌍 Coordinate scale set to ${scale} (X-Z plane)`);
  }

  getCoordinateScale(): number {
    return this.coordinateScale;
  }

  adjustCoordinateScale(delta: number): void {
    const newScale = this.coordinateScale + delta;
    this.setCoordinateScale(newScale); // Use setter for validation
  }

  resetCoordinateScale(): void {
    this.coordinateScale = 1.0;
    console.log(`🌍 Coordinate scale reset to 1.0 (no scaling)`);
  }

  // ===================================================================
  // Translation Controls (X-Z plane)
  // ===================================================================

  setTranslation(deltaX: number, deltaZ: number): void {
    // Validation: reasonable translation values (within 1km of origin)
    if (Math.abs(deltaX) > 1000 || Math.abs(deltaZ) > 1000) {
      console.warn(`🌍 Large translation [${deltaX}, ${deltaZ}]m - consider smaller adjustments`);
    }
    
    this.translationOffset.set(deltaX, deltaZ);
    console.log(`🌍 Translation set to [${deltaX.toFixed(2)}, ${deltaZ.toFixed(2)}]m (X-Z plane)`);
  }

  getTranslation(): { x: number; z: number } {
    return { x: this.translationOffset.x, z: this.translationOffset.y };
  }

  adjustTranslation(deltaX: number, deltaZ: number): void {
    this.translationOffset.x += deltaX;
    this.translationOffset.y += deltaZ;
    console.log(`🌍 Translation adjusted to [${this.translationOffset.x.toFixed(2)}, ${this.translationOffset.y.toFixed(2)}]m (X-Z plane)`);
  }

  resetTranslation(): void {
    this.translationOffset.set(0, 0);
    console.log(`🌍 Translation reset to origin [0, 0]m (X-Z plane)`);
  }

  // ===================================================================
  // Combined Reset and Utility Methods
  // ===================================================================

  resetAllTransformations(): void {
    this.resetHorizontalRotation();
    this.resetCoordinateScale();
    this.resetTranslation();
    console.log(`🌍 All coordinate transformations reset to defaults`);
  }

  getTransformationSummary(): {
    rotation: number;
    scale: number;
    translation: { x: number; z: number };
    isDefault: boolean;
  } {
    const isDefault = (
      this.horizontalRotation === 45 && // Your original test value
      this.coordinateScale === 1.0 &&
      this.translationOffset.x === 0 &&
      this.translationOffset.y === 0
    );

    return {
      rotation: this.horizontalRotation,
      scale: this.coordinateScale,
      translation: { x: this.translationOffset.x, z: this.translationOffset.y },
      isDefault
    };
  }

  // ===================================================================
  // Validation and Testing Methods
  // ===================================================================

  validateCoordinateSystem(): {
    valid: boolean;
    warnings: string[];
    origin: [number, number];
    bounds: {
      minLon: number;
      maxLon: number;
      minLat: number;
      maxLat: number;
    };
    transformations: {
      rotation: number;
      scale: number;
      translation: { x: number; z: number };
      isDefault: boolean;
    };
  } {
    const warnings: string[] = [];

    // Check origin is within reasonable bounds
    const [lon, lat] = this.origin;
    if (lon < -180 || lon > 180) warnings.push(`Origin longitude ${lon} outside valid range [-180, 180]`);
    if (lat < -90 || lat > 90) warnings.push(`Origin latitude ${lat} outside valid range [-90, 90]`);

    // Check transformations are reasonable
    if (this.coordinateScale < 0.1 || this.coordinateScale > 10.0) {
      warnings.push(`Extreme coordinate scale ${this.coordinateScale}`);
    }
    if (Math.abs(this.translationOffset.x) > 1000 || Math.abs(this.translationOffset.y) > 1000) {
      warnings.push(`Large translation offset [${this.translationOffset.x}, ${this.translationOffset.y}]m`);
    }

    return {
      valid: warnings.length === 0,
      warnings,
      origin: this.origin,
      bounds: this.kenilworthBounds,
      transformations: this.getTransformationSummary()
    };
  }

  testCoordinateTransformation(testGps: [number, number]): {
    originalGps: [number, number];
    worldCoordinates: THREE.Vector3;
    backToGps: [number, number, number];
    roundTripError: number;
    withinKenilworth: boolean;
  } {
    // Test round-trip conversion
    const worldPos = this.gpsToWorld(testGps, 0);
    const [backLon, backLat, backElevation] = this.worldToGPS(worldPos);
    
    // Calculate round-trip error in meters
    const errorLon = (backLon - testGps[0]) * 111320 * Math.cos(testGps[1] * Math.PI / 180);
    const errorLat = (backLat - testGps[1]) * 110540;
    const roundTripError = Math.sqrt(errorLon * errorLon + errorLat * errorLat);

    return {
      originalGps: testGps,
      worldCoordinates: worldPos,
      backToGps: [backLon, backLat, backElevation],
      roundTripError,
      withinKenilworth: this.isWithinKenilworth(testGps)
    };
  }
}