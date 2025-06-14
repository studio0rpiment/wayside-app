// src/utils/pondUtils.ts
import { 
 TERRAIN_CONFIG, 
 getPixelElevation, 
 gpsToStatePlane, 
 statePlaneToPixel,
 getHeightmapImageData,
 getElevationAtGPS 
} from './terrainUtils';

export interface PondPixel {
 x: number;
 y: number;
 elevation: number;
 longitude?: number;
 latitude?: number;
}

export interface PondInfo {
 id: string;
 center: { x: number; y: number; longitude: number; latitude: number };
 waterPixels: PondPixel[];
 averageWaterElevation: number;
 boundingBox: { 
   minX: number; maxX: number; minY: number; maxY: number;
   minLon: number; maxLon: number; minLat: number; maxLat: number;
 };
 area: number; // in square meters
 pixelCount: number;
}

export interface PondDetectionConfig {
 waterThreshold: number;        // Elevation threshold for "water"
 minPondSize: number;          // Minimum pixels to be considered a pond
 maxConnectedDistance: number; // Maximum pixel distance for connectivity
 samplingStep: number;         // Sample every N pixels (for performance)
 includeGPSCoords: boolean;    // Whether to calculate GPS for each pixel
}

// Default configuration optimized for Kenilworth
const DEFAULT_CONFIG: PondDetectionConfig = {
 waterThreshold: 0.5,          // 0.5m below sea level
 minPondSize: 50,              // At least 50 pixels (~50m²)
 maxConnectedDistance: 8,      // 8-pixel connectivity
 samplingStep: 2,              // Sample every 2 pixels for performance
 includeGPSCoords: true        // Include GPS for water system
};

// Global cache
let detectedPonds: PondInfo[] | null = null;
let detectionConfig: PondDetectionConfig | null = null;

/**
* Main pond detection function
*/
export async function detectPonds(config: Partial<PondDetectionConfig> = {}): Promise<PondInfo[]> {
 // Check if heightmap is loaded
 const heightmapImageData = getHeightmapImageData();
 if (!heightmapImageData) {
   throw new Error('Heightmap not loaded. Call loadHeightmap() first before pond detection.');
 }
 
 const finalConfig = { ...DEFAULT_CONFIG, ...config };
 
 console.log('🏞️ Starting comprehensive pond detection...');
 console.log('📊 Config:', finalConfig);
 
 const waterPixels = await sampleWaterPixels(finalConfig);
 const ponds = clusterWaterPixels(waterPixels, finalConfig);
 const enhancedPonds = await enhancePondData(ponds, finalConfig);
 
 // Cache results
 detectedPonds = enhancedPonds;
 detectionConfig = finalConfig;
 
 logPondSummary(enhancedPonds);
 return enhancedPonds;
}

/**
* Sample all water pixels from heightmap
*/
async function sampleWaterPixels(config: PondDetectionConfig): Promise<PondPixel[]> {
 const heightmapImageData = getHeightmapImageData();
 
 if (!heightmapImageData) {
   throw new Error('Heightmap not loaded. Call loadHeightmap() first.');
 }
 
 console.log('💧 Sampling water pixels...');
 const waterPixels: PondPixel[] = [];
 let totalSampled = 0;
 
 for (let y = 0; y < TERRAIN_CONFIG.height; y += config.samplingStep) {
   for (let x = 0; x < TERRAIN_CONFIG.width; x += config.samplingStep) {
     totalSampled++;
     
     const elevation = getPixelElevation(x, y, 3); // Small radius for speed
     
     if (elevation !== null && elevation <= config.waterThreshold) {
       const pixel: PondPixel = { x, y, elevation };
       
       // Add GPS coordinates if requested
       if (config.includeGPSCoords) {
         const gpsCoords = pixelToGPS(x, y);
         pixel.longitude = gpsCoords.longitude;
         pixel.latitude = gpsCoords.latitude;
       }
       
       waterPixels.push(pixel);
     }
   }
 }
 
 console.log(`💧 Found ${waterPixels.length} water pixels from ${totalSampled} samples`);
 return waterPixels;
}

/**
* Cluster water pixels into separate ponds
*/
function clusterWaterPixels(waterPixels: PondPixel[], config: PondDetectionConfig): PondInfo[] {
 console.log('🔗 Clustering water pixels into ponds...');
 
 const ponds: PondInfo[] = [];
 const visited = new Set<string>();
 
 // Create spatial index for faster neighbor lookup
 const spatialIndex = createSpatialIndex(waterPixels);
 
 for (const pixel of waterPixels) {
   const key = `${pixel.x},${pixel.y}`;
   if (visited.has(key)) continue;
   
   const clusterPixels = floodFillCluster(pixel, spatialIndex, visited, config);
   
   if (clusterPixels.length >= config.minPondSize) {
     const pond = createPondFromCluster(clusterPixels, ponds.length);
     ponds.push(pond);
   }
 }
 
 // Sort by size (largest first)
 ponds.sort((a, b) => b.pixelCount - a.pixelCount);
 
 return ponds;
}

/**
* Create spatial index for faster neighbor lookup
*/
function createSpatialIndex(pixels: PondPixel[]): Map<string, PondPixel[]> {
 const index = new Map<string, PondPixel[]>();
 const cellSize = 20; // 20-pixel grid cells
 
 for (const pixel of pixels) {
   const cellX = Math.floor(pixel.x / cellSize);
   const cellY = Math.floor(pixel.y / cellSize);
   const cellKey = `${cellX},${cellY}`;
   
   if (!index.has(cellKey)) {
     index.set(cellKey, []);
   }
   index.get(cellKey)!.push(pixel);
 }
 
 console.log(`🗺️ Created spatial index with ${index.size} grid cells`);
 return index;
}

/**
* Optimized flood fill algorithm using spatial index
*/
function floodFillCluster(
 startPixel: PondPixel,
 spatialIndex: Map<string, PondPixel[]>,
 visited: Set<string>,
 config: PondDetectionConfig
): PondPixel[] {
 const result: PondPixel[] = [];
 const queue = [startPixel];
 const cellSize = 20;
 
 while (queue.length > 0) {
   const current = queue.shift()!;
   const key = `${current.x},${current.y}`;
   
   if (visited.has(key)) continue;
   visited.add(key);
   result.push(current);
   
   // Get nearby cells to search
   const cellX = Math.floor(current.x / cellSize);
   const cellY = Math.floor(current.y / cellSize);
   
   for (let dx = -1; dx <= 1; dx++) {
     for (let dy = -1; dy <= 1; dy++) {
       const neighborCellKey = `${cellX + dx},${cellY + dy}`;
       const cellPixels = spatialIndex.get(neighborCellKey);
       
       if (!cellPixels) continue;
       
       for (const waterPixel of cellPixels) {
         const waterKey = `${waterPixel.x},${waterPixel.y}`;
         if (visited.has(waterKey)) continue;
         
         const distance = Math.sqrt(
           Math.pow(waterPixel.x - current.x, 2) + 
           Math.pow(waterPixel.y - current.y, 2)
         );
         
         if (distance <= config.maxConnectedDistance) {
           queue.push(waterPixel);
         }
       }
     }
   }
 }
 
 return result;
}

/**
* Create pond info from clustered pixels
*/
function createPondFromCluster(pixels: PondPixel[], pondIndex: number): PondInfo {
 const elevations = pixels.map(p => p.elevation);
 const avgElevation = elevations.reduce((sum, e) => sum + e, 0) / elevations.length;
 
 // Calculate center in pixel coordinates
 const centerX = pixels.reduce((sum, p) => sum + p.x, 0) / pixels.length;
 const centerY = pixels.reduce((sum, p) => sum + p.y, 0) / pixels.length;
 
 // Convert center to GPS
 const centerGPS = pixelToGPS(centerX, centerY);
 
 // Calculate bounding boxes
 const xs = pixels.map(p => p.x);
 const ys = pixels.map(p => p.y);
 const lons = pixels.filter(p => p.longitude).map(p => p.longitude!);
 const lats = pixels.filter(p => p.latitude).map(p => p.latitude!);
 
 // Calculate area (approximate)
 const pixelArea = TERRAIN_CONFIG.pixelSizeMeters * TERRAIN_CONFIG.pixelSizeMeters;
 const area = pixels.length * pixelArea;
 
 return {
   id: `pond_${pondIndex + 1}`,
   center: {
     x: centerX,
     y: centerY,
     longitude: centerGPS.longitude,
     latitude: centerGPS.latitude
   },
   waterPixels: pixels,
   averageWaterElevation: avgElevation,
   boundingBox: {
     minX: Math.min(...xs),
     maxX: Math.max(...xs),
     minY: Math.min(...ys),
     maxY: Math.max(...ys),
     minLon: lons.length > 0 ? Math.min(...lons) : 0,
     maxLon: lons.length > 0 ? Math.max(...lons) : 0,
     minLat: lats.length > 0 ? Math.min(...lats) : 0,
     maxLat: lats.length > 0 ? Math.max(...lats) : 0
   },
   area,
   pixelCount: pixels.length
 };
}

/**
* Enhance pond data with additional calculations
*/
async function enhancePondData(ponds: PondInfo[], config: PondDetectionConfig): Promise<PondInfo[]> {
 console.log('📈 Enhancing pond data...');
 
 // Could add additional analysis here:
 // - Shape analysis (circularity, elongation)
 // - Connection analysis between ponds
 // - Seasonal variation detection
 // - Depth profile estimation
 
 return ponds;
}

/**
* Convert pixel coordinates to GPS
*/
function pixelToGPS(pixelX: number, pixelY: number): { longitude: number; latitude: number } {
 const { extentMeters } = TERRAIN_CONFIG;
 
 // Convert pixel to normalized coordinates
 const normalizedX = pixelX / TERRAIN_CONFIG.width;
 const normalizedY = (TERRAIN_CONFIG.height - pixelY) / TERRAIN_CONFIG.height; // Flip Y
 
 // Convert to state plane coordinates
 const x = extentMeters.minX + normalizedX * (extentMeters.maxX - extentMeters.minX);
 const y = extentMeters.minY + normalizedY * (extentMeters.maxY - extentMeters.minY);
 
 // Convert state plane to GPS (inverse of your existing function)
 const centerLon = -76.9456;
 const centerLat = 38.9124;
 const centerX = 404716.5;
 const centerY = 138247.0;
 const lonToX = 82000;
 const latToY = 111000;
 
 const longitude = centerLon + (x - centerX) / lonToX;
 const latitude = centerLat + (y - centerY) / latToY;
 
 return { longitude, latitude };
}

/**
* Get all detected ponds (cached)
*/
export function getPonds(): PondInfo[] {
 if (!detectedPonds) {
   console.warn('⚠️ Ponds not detected yet. Call detectPonds() first.');
   return [];
 }
 return detectedPonds;
}

/**
* Find pond containing GPS coordinates
*/
export function findPondAtGPS(longitude: number, latitude: number): PondInfo | null {
 const ponds = getPonds();
 
 for (const pond of ponds) {
   const inBounds = longitude >= pond.boundingBox.minLon && 
                   longitude <= pond.boundingBox.maxLon &&
                   latitude >= pond.boundingBox.minLat && 
                   latitude <= pond.boundingBox.maxLat;
   
   if (inBounds) {
     // Check if actually in pond water area
     const { x, y } = gpsToStatePlane(longitude, latitude);
     const { pixelX, pixelY } = statePlaneToPixel(x, y);
     
     const isInPond = pond.waterPixels.some(pixel => 
       Math.abs(pixel.x - pixelX) <= 3 && Math.abs(pixel.y - pixelY) <= 3
     );
     
     if (isInPond) {
       return pond;
     }
   }
 }
 
 return null;
}

/**
* Check if terrain at GPS coordinates should be flooded
*/
export function isLocationFlooded(
 longitude: number, 
 latitude: number, 
 floodElevation: number
): { isFlooded: boolean; terrainElevation: number | null; floodDepth: number; inPond: boolean } {
 const terrainElevation = getElevationAtGPS(longitude, latitude);
 
 if (terrainElevation === null) {
   return { isFlooded: false, terrainElevation: null, floodDepth: 0, inPond: false };
 }
 
 const isFlooded = terrainElevation < floodElevation;
 const floodDepth = isFlooded ? Math.max(0, floodElevation - terrainElevation) : 0;
 const inPond = findPondAtGPS(longitude, latitude) !== null;
 
 return { isFlooded, terrainElevation, floodDepth, inPond };
}

/**
* Get the largest pond (main pond for water experience)
*/
export function getMainPond(): PondInfo | null {
 const ponds = getPonds();
 return ponds.length > 0 ? ponds[0] : null; // Largest pond is first after sorting
}

/**
* Get pond at specific anchor coordinates
*/
export function getPondAtAnchor(anchorGPS: [number, number]): PondInfo | null {
 return findPondAtGPS(anchorGPS[0], anchorGPS[1]);
}

/**
* Log pond detection summary
*/
function logPondSummary(ponds: PondInfo[]): void {
 console.log('🏞️ POND DETECTION SUMMARY');
 console.log('═'.repeat(50));
 console.log(`Total ponds detected: ${ponds.length}`);
 
 ponds.forEach((pond, i) => {
   console.log(`\n📍 ${pond.id}:`);
   console.log(`  Size: ${pond.pixelCount} pixels (${(pond.area / 10000).toFixed(2)} hectares)`);
   console.log(`  Center: (${pond.center.longitude.toFixed(6)}, ${pond.center.latitude.toFixed(6)})`);
   console.log(`  Elevation: ${pond.averageWaterElevation.toFixed(2)}m`);
   console.log(`  Bounding box: ${pond.boundingBox.maxX - pond.boundingBox.minX}×${pond.boundingBox.maxY - pond.boundingBox.minY} pixels`);
 });
 
 const totalArea = ponds.reduce((sum, pond) => sum + pond.area, 0);
 console.log(`\n💧 Total water area: ${(totalArea / 10000).toFixed(2)} hectares`);
}

/**
* Export pond data to JSON for debugging
*/
export function exportPondData(): string {
 const ponds = getPonds();
 return JSON.stringify({
   detectionConfig,
   ponds: ponds.map(pond => ({
     ...pond,
     // Exclude raw pixel data for smaller export
     waterPixels: `${pond.waterPixels.length} pixels (excluded for size)`
   }))
 }, null, 2);
}

