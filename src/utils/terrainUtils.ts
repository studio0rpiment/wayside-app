// src/utils/terrainUtils.ts
import * as THREE from 'three';
import { getAssetPath } from './assetPaths.ts';


// src/utils/terrainUtils.ts
/**
 * Terrain elevation lookup system using LiDAR heightmap data
 * Provides ground plane detection for precise AR model anchoring
 */

// Terrain configuration based on your QGIS heightmap
export const TERRAIN_CONFIG = {
  // Heightmap bounds in Maryland State Plane (EPSG:26985) - from your QGIS data
  extentMeters: {
    minX: 404350.0,
    maxX: 405083.0,
    minY: 138041.0,
    maxY: 138453.0
  },
  
  // Heightmap dimensions - from your QGIS data
  width: 733,
  height: 412,
  
  // Elevation range (from QGIS statistics)
  elevationRange: {
    min: -5.0,      // Black pixels (lowest elevation)
    max: 26.124     // White pixels (highest elevation)
  },
  
  // Pixel resolution
  pixelSizeMeters: 1.0,
  
  // Heightmap image path (you'll need to add this to your assets)
  heightmapPath: getAssetPath('/textures/terrainHeightmap.png')
};

// Cache for heightmap data
let heightmapImageData: ImageData | null = null;
let heightmapCanvas: HTMLCanvasElement | null = null;

/**
 * Load and cache the heightmap image data
 */
export async function loadHeightmap(): Promise<boolean> {
  try {
    // console.log('🗺️ Loading heightmap data...');
    
    // Create image element
    const img = new Image();
    img.crossOrigin = 'anonymous'; // Needed for canvas access
    
    return new Promise((resolve, reject) => {
      img.onload = () => {
        try {
          // Create canvas to extract image data
          heightmapCanvas = document.createElement('canvas');
          heightmapCanvas.width = TERRAIN_CONFIG.width;
          heightmapCanvas.height = TERRAIN_CONFIG.height;
          
          const ctx = heightmapCanvas.getContext('2d');
          if (!ctx) {
            throw new Error('Could not get canvas context');
          }
          
          // Draw image to canvas
          ctx.drawImage(img, 0, 0, TERRAIN_CONFIG.width, TERRAIN_CONFIG.height);
          
          // Extract image data
          heightmapImageData = ctx.getImageData(0, 0, TERRAIN_CONFIG.width, TERRAIN_CONFIG.height);
          
          // console.log('✅ Heightmap loaded successfully');
          // console.log(`📊 Heightmap dimensions: ${TERRAIN_CONFIG.width}x${TERRAIN_CONFIG.height}`);
          // console.log(`📏 Elevation range: ${TERRAIN_CONFIG.elevationRange.min}m to ${TERRAIN_CONFIG.elevationRange.max}m`);
          
          resolve(true);
        } catch (error) {
          console.error('❌ Error processing heightmap:', error);
          reject(error);
        }
      };
      
      img.onerror = (error) => {
        console.error('❌ Error loading heightmap image:', error);
        reject(error);
      };
      
      // Load the heightmap image
      img.src = TERRAIN_CONFIG.heightmapPath;
    });
    
  } catch (error) {
    console.error('❌ Error in loadHeightmap:', error);
    return false;
  }
}

/**
 * Convert GPS coordinates (WGS84) to Maryland State Plane (EPSG:26985)
 * This is a simplified conversion suitable for the Kenilworth area
 * For production, consider using proj4js for exact conversion
 */
function gpsToStatePlane(longitude: number, latitude: number): { x: number; y: number } {
  // Approximate conversion factors for Maryland/DC area
  // These are calibrated for your specific heightmap area
  const centerLon = -76.9456; // Center of your polygon area
  const centerLat = 38.9124;  // Center of your polygon area
  const centerX = 404716.5;   // Center X of your heightmap extent
  const centerY = 138247.0;   // Center Y of your heightmap extent
  
  // Conversion factors (approximate for this specific area)
  const lonToX = 82000; // meters per degree longitude at this latitude
  const latToY = 111000; // meters per degree latitude
  
  const x = centerX + (longitude - centerLon) * lonToX;
  const y = centerY + (latitude - centerLat) * latToY;
  
  return { x, y };
}

/**
 * Convert state plane coordinates to heightmap pixel coordinates
 */
function statePlaneToPixel(x: number, y: number): { pixelX: number; pixelY: number } {
  const { extentMeters, width, height } = TERRAIN_CONFIG;
  
  // Convert to normalized coordinates (0-1)
  const normalizedX = (x - extentMeters.minX) / (extentMeters.maxX - extentMeters.minX);
  const normalizedY = (extentMeters.maxY - y) / (extentMeters.maxY - extentMeters.minY); // Flip Y
  
  // Convert to pixel coordinates
  const pixelX = Math.floor(normalizedX * width);
  const pixelY = Math.floor(normalizedY * height);
  
  return { pixelX, pixelY };
}

/**
 * Get pixel brightness and convert to elevation
 */
// Replace the getPixelElevation function in terrainUtils.ts with this area-sampling version:
// Replace the getPixelElevation function with this optimized version:
function getPixelElevation(pixelX: number, pixelY: number, sampleRadius: number = 25): number | null {
  if (!heightmapImageData) {
    console.warn('⚠️ Heightmap not loaded');
    return null;
  }
  
  // Validate center pixel coordinates
  if (pixelX < 0 || pixelX >= TERRAIN_CONFIG.width || 
      pixelY < 0 || pixelY >= TERRAIN_CONFIG.height) {
    return null;
  }
  
  const elevations: number[] = [];
  const step = Math.max(1, Math.floor(sampleRadius / 10)); // Sample every few pixels for performance
  
  // console.log(`🗺️ Sampling ${sampleRadius*2+1}x${sampleRadius*2+1} area around (${pixelX}, ${pixelY}) with step=${step}`);
  
  // Sample area around the center pixel
  for (let dy = -sampleRadius; dy <= sampleRadius; dy += step) {
    for (let dx = -sampleRadius; dx <= sampleRadius; dx += step) {
      const testX = pixelX + dx;
      const testY = pixelY + dy;
      
      // Check bounds
      if (testX >= 0 && testX < TERRAIN_CONFIG.width && 
          testY >= 0 && testY < TERRAIN_CONFIG.height) {
        
        const index = (testY * TERRAIN_CONFIG.width + testX) * 4;
        const red = heightmapImageData.data[index];
        const green = heightmapImageData.data[index + 1];
        const blue = heightmapImageData.data[index + 2];
        const alpha = heightmapImageData.data[index + 3];
        
        // Skip transparent pixels
        if (alpha === 0) continue;
        
        // Use red channel for grayscale
        let brightness = red;
        if (Math.abs(red - green) > 1 || Math.abs(red - blue) > 1) {
          brightness = 0.299 * red + 0.587 * green + 0.114 * blue;
        }
        
        // Convert to elevation
        const normalizedBrightness = brightness / 255;
        const { min, max } = TERRAIN_CONFIG.elevationRange;
        const elevation = min + normalizedBrightness * (max - min);
        
        elevations.push(elevation);
      }
    }
  }
  
  if (elevations.length === 0) {
    console.warn(`⚠️ No valid pixels found around (${pixelX}, ${pixelY})`);
    return null;
  }
  
  // Calculate statistics
  elevations.sort((a, b) => a - b);
  const average = elevations.reduce((sum, elev) => sum + elev, 0) / elevations.length;
  const median = elevations[Math.floor(elevations.length / 2)];
  const min = elevations[0];
  const max = elevations[elevations.length - 1];
  
  // Count extreme values
  const waterPixels = elevations.filter(e => e < -3).length; // Very low (water)
  const landPixels = elevations.filter(e => e > 20).length;  // Very high (land)
  const midRangePixels = elevations.filter(e => e >= -3 && e <= 20).length;
  
  // console.log(`📊 Sampled ${elevations.length} pixels:`);
  // console.log(`   Range: ${min.toFixed(2)}m to ${max.toFixed(2)}m`);
  // console.log(`   Average: ${average.toFixed(2)}m`);
  // console.log(`   Median: ${median.toFixed(2)}m`);
  // console.log(`   Water pixels (<-3m): ${waterPixels}, Land pixels (>20m): ${landPixels}, Mid-range: ${midRangePixels}`);
  
  // Smart elevation selection
  let finalElevation: number;
  
  if (midRangePixels > elevations.length * 0.3) {
    // If we have significant mid-range values, filter out extremes and use average
    const filteredElevations = elevations.filter(e => e >= -3 && e <= 20);
    finalElevation = filteredElevations.reduce((sum, e) => sum + e, 0) / filteredElevations.length;
    // console.log(`   Using filtered average (${filteredElevations.length} pixels): ${finalElevation.toFixed(2)}m`);
  } else if (average > 2 && average < 15) {
    // If average is in a reasonable range, use it instead of median
    finalElevation = average;
    // console.log(`   Using average instead of median: ${finalElevation.toFixed(2)}m`);
  } else {
    // Fall back to median
    finalElevation = median;
    // console.log(`   Using median: ${finalElevation.toFixed(2)}m`);
  }
  
  return finalElevation;
}
/**
 * Get terrain elevation at GPS coordinates
 * Returns elevation in meters above sea level, or null if outside bounds
 */
export function getElevationAtGPS(longitude: number, latitude: number): number | null {
  if (!heightmapImageData) {
    console.warn('⚠️ Heightmap not loaded. Call loadHeightmap() first.');
    return null;
  }
  
  try {
    // Convert GPS to state plane
    const { x, y } = gpsToStatePlane(longitude, latitude);
    
    // Check if coordinates are within heightmap bounds
    const { extentMeters } = TERRAIN_CONFIG;
    if (x < extentMeters.minX || x > extentMeters.maxX || 
        y < extentMeters.minY || y > extentMeters.maxY) {
      console.warn(`📍 Coordinates outside heightmap bounds: ${longitude}, ${latitude}`);
      return null;
    }
    
    

    // Convert to pixel coordinates
    const { pixelX, pixelY } = statePlaneToPixel(x, y);
    
    // Get elevation from pixel
    const elevation = getPixelElevation(pixelX, pixelY);
    
    if (elevation !== null) {
      // console.log(`🗺️ GPS (${longitude.toFixed(6)}, ${latitude.toFixed(6)}) -> Elevation: ${elevation.toFixed(2)}m`);
    }
    
    return elevation;
    
  } catch (error) {
    console.error('❌ Error getting elevation:', error);
    return null;
  }
}

/**
 * Enhanced version of gpsToThreeJsPosition that uses terrain elevation
 * Replaces the fixed anchorElevation with dynamic terrain lookup
 */
export function gpsToThreeJsPositionWithTerrain(
  userGps: [number, number],
  anchorGps: [number, number],
  elevationOffset: number = 2.0, // Height above terrain (not absolute elevation)
  coordinateScale: number = 1.0
): { position: THREE.Vector3; terrainElevation: number | null; userElevation: number | null; usedTerrain: boolean } {
  
  // Get terrain elevation at BOTH user and anchor positions
  const userTerrainElevation = getElevationAtGPS(userGps[0], userGps[1]);
  const anchorTerrainElevation = getElevationAtGPS(anchorGps[0], anchorGps[1]);
  
  // Calculate final elevations
  const userFinalElevation = userTerrainElevation !== null ? userTerrainElevation : 0;
  const anchorFinalElevation = anchorTerrainElevation !== null 
    ? anchorTerrainElevation + elevationOffset 
    : elevationOffset; // Fallback to offset if no terrain data
  
  // Use existing coordinate conversion
  const [x, y, z] = gpsToLocalCoordinates(userGps, anchorGps, anchorFinalElevation, userFinalElevation);
  
  // console.log(`🏃 User elevation: ${userFinalElevation.toFixed(2)}m`);
  // console.log(`🎯 Anchor elevation: ${anchorFinalElevation.toFixed(2)}m`);
  // console.log(`📏 Relative height: ${(anchorFinalElevation - userFinalElevation).toFixed(2)}m`);
  
  return {
    position: new THREE.Vector3(x * coordinateScale, y, z * coordinateScale),
    terrainElevation: anchorTerrainElevation,
    userElevation: userTerrainElevation,
    usedTerrain: anchorTerrainElevation !== null && userTerrainElevation !== null
  };
}

/**
 * Enhanced version of gpsToThreeJsPosition that uses terrain elevation
 * Replaces the fixed anchorElevation with dynamic terrain lookup
 */
// In your enhanced gpsToThreeJsPositionTerrain function:
export function gpsToThreeJsPositionTerrain(
  userGps: [number, number],
  anchorGps: [number, number],
  elevationOffset: number = 2.0,
  coordinateScale: number = 1.0,
  fallbackElevation: number = 2.0
): {
  position: THREE.Vector3;
  terrainElevation: number | null;
  userElevation: number | null;
  usedTerrain: boolean;
} {
  // Get terrain elevation at BOTH user and anchor positions
  const userTerrainElevation = getElevationAtGPS(userGps[0], userGps[1]);
  const anchorTerrainElevation = getElevationAtGPS(anchorGps[0], anchorGps[1]);
  
  // Calculate final elevations
  const userFinalElevation = userTerrainElevation !== null ? userTerrainElevation : 0;
  const anchorFinalElevation = anchorTerrainElevation !== null 
    ? anchorTerrainElevation + elevationOffset 
    : fallbackElevation;
  
  // Use terrain-aware coordinate conversion
  const [x, y, z] = gpsToLocalCoordinates(
    userGps, 
    anchorGps, 
    anchorFinalElevation, 
    userFinalElevation  // Now using actual user elevation
  );
  
  // console.log(`🏃 User elevation: ${userFinalElevation.toFixed(2)}m`);
  // console.log(`🎯 Anchor elevation: ${anchorFinalElevation.toFixed(2)}m`);
  // console.log(`📏 Relative height: ${(anchorFinalElevation - userFinalElevation).toFixed(2)}m`);
  
  return {
    position: new THREE.Vector3(x * coordinateScale, y, z * coordinateScale),
    terrainElevation: anchorTerrainElevation,
    userElevation: userTerrainElevation,
    usedTerrain: anchorTerrainElevation !== null && userTerrainElevation !== null
  };
}

/**
 * Your existing GPS to local coordinates function (copied from geoArUtils)
 * This maintains compatibility with your current system
 */
function gpsToLocalCoordinates(
  userGps: [number, number],
  targetGps: [number, number],
  targetElevation: number = 0,
  userElevation: number = 0
): [number, number, number] {
  const EARTH_RADIUS = 6378137;
  
  const [userLon, userLat] = userGps;
  const [targetLon, targetLat] = targetGps;
  
  // Convert to radians
  const userLatRad = userLat * (Math.PI / 180);
  const userLonRad = userLon * (Math.PI / 180);
  const targetLatRad = targetLat * (Math.PI / 180);
  const targetLonRad = targetLon * (Math.PI / 180);
  
  // Calculate differences
  const dLat = targetLatRad - userLatRad;
  const dLon = targetLonRad - userLonRad;
  
  // Convert to meters using local approximation
  const cosLat = Math.cos(userLatRad);
  
  // X: East-West distance
  const x = dLon * EARTH_RADIUS * cosLat;
  
  // Z: North-South distance (negative for Three.js convention)
  const z = -dLat * EARTH_RADIUS;
  
  // Y: Elevation difference
  const y = targetElevation - userElevation;
  
  return [x, y, z];
}

/**
 * Validate that anchor positions are within the heightmap coverage
 */
export function validateAnchorCoverage(anchors: Array<{ name: string; coordinates: [number, number] }>): void {
  // console.log('🔍 Validating anchor coverage...');
  
  let insideBounds = 0;
  let outsideBounds = 0;
  
  anchors.forEach(anchor => {
    const [lon, lat] = anchor.coordinates;
    const { x, y } = gpsToStatePlane(lon, lat);
    const { extentMeters } = TERRAIN_CONFIG;
    
    const isInside = x >= extentMeters.minX && x <= extentMeters.maxX && 
                     y >= extentMeters.minY && y <= extentMeters.maxY;
    
    if (isInside) {
      insideBounds++;
      // console.log(`✅ ${anchor.name}: Inside heightmap bounds`);
    } else {
      outsideBounds++;
      // console.log(`❌ ${anchor.name}: Outside heightmap bounds`);
    }
  });
  
  // console.log(`📊 Coverage: ${insideBounds} inside, ${outsideBounds} outside bounds`);
}

/**
 * Test terrain lookup with your anchor positions
 */
export function testTerrainLookup(): void {
  const testAnchors = [
    { name: "mac", coordinates: [-76.942076, 38.912485] as [number, number] },
    { name: "lotus", coordinates: [-76.942954, 38.912327] as [number, number] },
    { name: "volunteers", coordinates: [-76.944148, 38.9125] as [number, number] },
    { name: "helen_s", coordinates: [-76.943534, 38.913195] as [number, number] },
    { name: "lily", coordinates: [-76.944643, 38.913399] as [number, number] },
    { name: "cattail", coordinates: [-76.947519, 38.911934] as [number, number] }
  ];
  
  // console.log('🧪 Testing terrain lookup for all anchors...');
  
  testAnchors.forEach(anchor => {
    const elevation = getElevationAtGPS(anchor.coordinates[0], anchor.coordinates[1]);
    // console.log(`${anchor.name}: ${elevation !== null ? elevation.toFixed(2) + 'm' : 'No data'}`);
  });
}

// Add these three functions to the end of your terrainUtils.ts file:

/**
 * Sample random pixels to see the elevation distribution
 */
export function sampleHeightmapDistribution(): void {
  if (!heightmapImageData) {
    console.warn('⚠️ Heightmap not loaded');
    return;
  }
  
  // console.log('📊 HEIGHTMAP DISTRIBUTION SAMPLE');
  // console.log('═'.repeat(50));
  
  const samples = [];
  const sampleCount = 100;
  
  for (let i = 0; i < sampleCount; i++) {
    const pixelX = Math.floor(Math.random() * TERRAIN_CONFIG.width);
    const pixelY = Math.floor(Math.random() * TERRAIN_CONFIG.height);
    const elevation = getPixelElevation(pixelX, pixelY);
    
    if (elevation !== null) {
      samples.push(elevation);
    }
  }
  
  samples.sort((a, b) => a - b);
  
  // console.log(`📈 Sample statistics from ${samples.length} random pixels:`);
  // console.log(`  Min: ${samples[0]?.toFixed(2)}m`);
  // console.log(`  Max: ${samples[samples.length - 1]?.toFixed(2)}m`);
  // console.log(`  Median: ${samples[Math.floor(samples.length / 2)]?.toFixed(2)}m`);
  // console.log(`  25th percentile: ${samples[Math.floor(samples.length * 0.25)]?.toFixed(2)}m`);
  // console.log(`  75th percentile: ${samples[Math.floor(samples.length * 0.75)]?.toFixed(2)}m`);
  
  // Show distribution
  const buckets = new Array(10).fill(0);
  samples.forEach(elev => {
    const bucket = Math.floor((elev - TERRAIN_CONFIG.elevationRange.min) / 
                             (TERRAIN_CONFIG.elevationRange.max - TERRAIN_CONFIG.elevationRange.min) * 9.99);
    buckets[Math.max(0, Math.min(9, bucket))]++;
  });
  
  // console.log(`📊 Distribution (10 buckets):`);
  buckets.forEach((count, i) => {
    const minElev = TERRAIN_CONFIG.elevationRange.min + 
                   (TERRAIN_CONFIG.elevationRange.max - TERRAIN_CONFIG.elevationRange.min) * i / 10;
    const maxElev = TERRAIN_CONFIG.elevationRange.min + 
                   (TERRAIN_CONFIG.elevationRange.max - TERRAIN_CONFIG.elevationRange.min) * (i + 1) / 10;
    const bar = '█'.repeat(Math.floor(count / sampleCount * 50));
    // console.log(`  ${minElev.toFixed(1)}-${maxElev.toFixed(1)}m: ${bar} (${count})`);
  });
}

/**
 * Debug function to examine raw pixel data around anchor points
 */
export function debugPixelData(): void {
  if (!heightmapImageData) {
    console.warn('⚠️ Heightmap not loaded');
    return;
  }
  
  // console.log('🔍 RAW PIXEL DATA ANALYSIS');
  // console.log('═'.repeat(50));
  
  const testPoints = [
    { name: "mac", lon: -76.942076, lat: 38.912485 },
    { name: "lotus", lon: -76.942954, lat: 38.912327 },
    { name: "volunteers", lon: -76.944148, lat: 38.9125 }
  ];
  
  testPoints.forEach(point => {
    // console.log(`\n📍 ${point.name}:`);
    
    const { x, y } = gpsToStatePlane(point.lon, point.lat);
    const { pixelX, pixelY } = statePlaneToPixel(x, y);
    
    // console.log(`  Pixel: (${pixelX}, ${pixelY})`);
    
    // Examine 3x3 area around the pixel
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const testX = pixelX + dx;
        const testY = pixelY + dy;
        
        if (testX >= 0 && testX < TERRAIN_CONFIG.width && 
            testY >= 0 && testY < TERRAIN_CONFIG.height && 
            heightmapImageData) {
          
          const index = (testY * TERRAIN_CONFIG.width + testX) * 4;
          const red = heightmapImageData.data[index];
          const green = heightmapImageData.data[index + 1];
          const blue = heightmapImageData.data[index + 2];
          const alpha = heightmapImageData.data[index + 3];
          
          const brightness = red; // Try using just red channel
          const elevation = TERRAIN_CONFIG.elevationRange.min + 
                           (brightness / 255) * (TERRAIN_CONFIG.elevationRange.max - TERRAIN_CONFIG.elevationRange.min);
          
          if (dx === 0 && dy === 0) {
            // console.log(`    CENTER (${testX}, ${testY}): RGB(${red}, ${green}, ${blue}, ${alpha}) -> ${elevation.toFixed(2)}m`);
          } else if (Math.abs(elevation - (-5.0)) > 0.1 && Math.abs(elevation - 26.12) > 0.1) {
            // console.log(`    (${testX}, ${testY}): RGB(${red}, ${green}, ${blue}) -> ${elevation.toFixed(2)}m`);
          }
        }
      }
    }
  });
}

/**
 * Test different ways of interpreting the pixel data
 */
export function testPixelInterpretation(): void {
  if (!heightmapImageData) {
    console.warn('⚠️ Heightmap not loaded');
    return;
  }
  
  // console.log('🧪 PIXEL INTERPRETATION TEST');
  // console.log('═'.repeat(50));
  
  // Test a pixel that should have intermediate elevation
  const testX = 366; // From your center_estimate
  const testY = 206;
  
  const index = (testY * TERRAIN_CONFIG.width + testX) * 4;
  const red = heightmapImageData.data[index];
  const green = heightmapImageData.data[index + 1];
  const blue = heightmapImageData.data[index + 2];
  const alpha = heightmapImageData.data[index + 3];
  
  // console.log(`Testing pixel (${testX}, ${testY}):`);
  // console.log(`Raw RGBA: (${red}, ${green}, ${blue}, ${alpha})`);
  
  // Test different interpretation methods
  const methods = [
    { name: "Red channel", value: red },
    { name: "Green channel", value: green },
    { name: "Blue channel", value: blue },
    { name: "Average RGB", value: (red + green + blue) / 3 },
    { name: "Luminance", value: 0.299 * red + 0.587 * green + 0.114 * blue },
    { name: "Max RGB", value: Math.max(red, green, blue) },
    { name: "Min RGB", value: Math.min(red, green, blue) }
  ];
  
  methods.forEach(method => {
    const normalizedBrightness = method.value / 255;
    const elevation = TERRAIN_CONFIG.elevationRange.min + 
                     normalizedBrightness * (TERRAIN_CONFIG.elevationRange.max - TERRAIN_CONFIG.elevationRange.min);
    // console.log(`  ${method.name}: ${method.value} -> ${elevation.toFixed(2)}m`);
  });
  
  // Sample some nearby pixels that showed variation
  // console.log('\nNearby pixels with variation:');
  const nearbyTests = [
    { x: 364, y: 205 }, { x: 364, y: 206 }, { x: 365, y: 206 }, { x: 367, y: 208 }
  ];
  
  nearbyTests.forEach(pos => {
    const idx = (pos.y * TERRAIN_CONFIG.width + pos.x) * 4;
    if (heightmapImageData) {
      const r = heightmapImageData.data[idx];
      const g = heightmapImageData.data[idx + 1];
      const b = heightmapImageData.data[idx + 2];
      // console.log(`  (${pos.x}, ${pos.y}): RGB(${r}, ${g}, ${b})`);
    } else {
      console.warn('⚠️ Heightmap not loaded');
    }
  });
}
/**
 * Debug function to test coordinate conversion and pixel sampling
 */
export function debugCoordinateConversion(): void {
  // console.log('🔧 COORDINATE CONVERSION DEBUG');
  // console.log('═'.repeat(50));
  
  const testPoints = [
    { name: "mac", lon: -76.942076, lat: 38.912485 },
    { name: "lotus", lon: -76.942954, lat: 38.912327 },
    { name: "volunteers", lon: -76.944148, lat: 38.9125 },
    { name: "center_estimate", lon: -76.9456, lat: 38.9124 }
  ];
  
  testPoints.forEach(point => {
    // console.log(`\n📍 ${point.name}:`);
    
    // Test coordinate conversion
    const { x, y } = gpsToStatePlane(point.lon, point.lat);
    const { pixelX, pixelY } = statePlaneToPixel(x, y);
    
    // console.log(`  GPS: (${point.lon}, ${point.lat})`);
    // console.log(`  State Plane: (${x.toFixed(1)}, ${y.toFixed(1)})`);
    // console.log(`  Pixel: (${pixelX}, ${pixelY})`);
    
    // Check if pixel is in bounds
    const inBounds = pixelX >= 0 && pixelX < TERRAIN_CONFIG.width && 
                    pixelY >= 0 && pixelY < TERRAIN_CONFIG.height;
    // console.log(`  In bounds: ${inBounds ? '✅' : '❌'}`);
    
    if (inBounds) {
      const elevation = getPixelElevation(pixelX, pixelY);
      // console.log(`  Elevation: ${elevation?.toFixed(2)}m`);
      
      // Sample nearby pixels to see variation
      // console.log(`  Nearby pixels:`);
      for (let dx = -2; dx <= 2; dx++) {
        for (let dy = -2; dy <= 2; dy++) {
          const testX = pixelX + dx;
          const testY = pixelY + dy;
          if (testX >= 0 && testX < TERRAIN_CONFIG.width && 
              testY >= 0 && testY < TERRAIN_CONFIG.height) {
            const nearbyElev = getPixelElevation(testX, testY);
            if (nearbyElev !== null && Math.abs(nearbyElev - (elevation || 0)) > 0.1) {
              console.log(`    Pixel (${testX}, ${testY}): ${nearbyElev.toFixed(2)}m`);
            }
          }
        }
      }
    }
  });
}
// Add this function to terrainUtils.ts to sample a wider area:
export function debugPixelArea(centerX: number, centerY: number, radius: number = 10): void {
  if (!heightmapImageData) {
    console.warn('⚠️ Heightmap not loaded');
    return;
  }
  
  // console.log(`🔍 SAMPLING ${radius*2+1}x${radius*2+1} AREA AROUND PIXEL (${centerX}, ${centerY})`);
  // console.log('═'.repeat(60));
  
  const samples: Array<{x: number, y: number, brightness: number, elevation: number}> = [];
  
  for (let dy = -radius; dy <= radius; dy += 2) { // Sample every 2 pixels to reduce output
    for (let dx = -radius; dx <= radius; dx += 2) {
      const testX = centerX + dx;
      const testY = centerY + dy;
      
      if (testX >= 0 && testX < TERRAIN_CONFIG.width && 
          testY >= 0 && testY < TERRAIN_CONFIG.height) {
        
        const index = (testY * TERRAIN_CONFIG.width + testX) * 4;
        const red = heightmapImageData.data[index];
        const brightness = red; // Assuming grayscale
        const elevation = TERRAIN_CONFIG.elevationRange.min + 
                         (brightness / 255) * (TERRAIN_CONFIG.elevationRange.max - TERRAIN_CONFIG.elevationRange.min);
        
        samples.push({ x: testX, y: testY, brightness, elevation });
        
        // Only log non-extreme values to reduce noise
        if (brightness > 10 && brightness < 245) {
          // console.log(`  (${testX}, ${testY}): brightness=${brightness} -> ${elevation.toFixed(2)}m`);
        }
      }
    }
  }
  
  // Show statistics
  const brightnesses = samples.map(s => s.brightness);
  brightnesses.sort((a, b) => a - b);
  
  // console.log(`\n📊 Sample statistics:`);
  // console.log(`  Total pixels: ${samples.length}`);
  // console.log(`  Brightness range: ${brightnesses[0]} to ${brightnesses[brightnesses.length - 1]}`);
  // console.log(`  Black pixels (0): ${samples.filter(s => s.brightness === 0).length}`);
  // console.log(`  White pixels (255): ${samples.filter(s => s.brightness === 255).length}`);
  // console.log(`  Gray pixels (1-254): ${samples.filter(s => s.brightness > 0 && s.brightness < 255).length}`);
  
  // Show some middle values
  const middleValues = samples.filter(s => s.brightness > 50 && s.brightness < 200);
  if (middleValues.length > 0) {
    // console.log(`\n🎯 Found intermediate values:`);
    middleValues.slice(0, 5).forEach(s => {
      // console.log(`  (${s.x}, ${s.y}): ${s.brightness} -> ${s.elevation.toFixed(2)}m`);
    });
  }
}
// Test the updated getPixelElevation with area sampling
export function testAreaSampling(): void {
  // console.log('🧪 TESTING AREA SAMPLING FOR ANCHORS');
  // console.log('═'.repeat(50));
  
  const testAnchors = [
    { name: "mac", coordinates: [-76.942076, 38.912485] as [number, number] },
    { name: "lotus", coordinates: [-76.942954, 38.912327] as [number, number] },
    { name: "volunteers", coordinates: [-76.944148, 38.9125] as [number, number] }
  ];
  
  testAnchors.forEach(anchor => {
    // console.log(`\n📍 ${anchor.name}:`);
    
    // Get the pixel coordinates
    const { x, y } = gpsToStatePlane(anchor.coordinates[0], anchor.coordinates[1]);
    const { pixelX, pixelY } = statePlaneToPixel(x, y);
    
    // console.log(`  GPS: ${anchor.coordinates[0]}, ${anchor.coordinates[1]}`);
    // console.log(`  Pixel: (${pixelX}, ${pixelY})`);
    
    // Test with area sampling
    const elevation = getPixelElevation(pixelX, pixelY, 25);
    // console.log(`  Area-sampled elevation: ${elevation?.toFixed(2)}m`);
    
    // Test the full getElevationAtGPS function
    const gpsElevation = getElevationAtGPS(anchor.coordinates[0], anchor.coordinates[1]);
    // console.log(`  GPS elevation lookup: ${gpsElevation?.toFixed(2)}m`);
  });
}