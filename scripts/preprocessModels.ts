// scripts/preprocessModels.ts
import * as THREE from 'three';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import fs from 'fs/promises';
import path from 'path';

interface QualityLevel {
  vertices: number;
  size: number;
  name: string;
}

const QUALITY_LEVELS: QualityLevel[] = [
  { name: 'desktop', vertices: 50000, size: 2.0 },
  { name: 'tablet',  vertices: 40000, size: 1.8 },
  { name: 'mobile',  vertices: 40000,  size: 1.5 },
  { name: 'lowEnd',  vertices: 30000,  size: 1.2 }
];

const EXPERIENCES = ['lily', 'lotus', 'cattail'];
const STAGES = [1, 2, 3, 4];

class ModelPreprocessor {
  private loader = new PLYLoader();
  private globalMaxDimension = 0;

  async preprocessAll() {
    console.log('🚀 Starting model preprocessing...');
    
    // Step 1: Find global maximum dimension
    await this.findGlobalMaxDimension();
    
    // Step 2: Process all models at all quality levels
    for (const experience of EXPERIENCES) {
      for (const stage of STAGES) {
        await this.processModel(experience, stage);
      }
    }
    
    // Step 3: Generate metadata
    await this.generateMetadata();
    
    console.log('✅ Preprocessing complete!');
  }

  private async findGlobalMaxDimension() {
  console.log('📏 Finding global maximum dimension...');
  this.globalMaxDimension = 0; // Reset to 0
  
  for (const experience of EXPERIENCES) {
    for (const stage of STAGES) {
      // Fix the path - remove 'assets' if it doesn't exist
      const inputPath = path.resolve(process.cwd(), `public/models/raw/${experience}_${stage}.ply`);
      
      try {
        console.log(`📏 Checking dimensions for ${experience}_${stage}...`);
        
        const geometry = await this.loadPLY(inputPath);
        geometry.computeBoundingBox();
        
        if (!geometry.boundingBox) {
          console.warn(`⚠️ No bounding box for ${experience}_${stage}`);
          continue;
        }
        
        const box = geometry.boundingBox;
        const dimensions = {
          x: box.max.x - box.min.x,
          y: box.max.y - box.min.y,
          z: box.max.z - box.min.z
        };
        
        const maxDim = Math.max(dimensions.x, dimensions.y, dimensions.z);
        
        console.log(`📐 ${experience}_${stage}: dimensions = (${dimensions.x.toFixed(2)}, ${dimensions.y.toFixed(2)}, ${dimensions.z.toFixed(2)}) → maxDim = ${maxDim.toFixed(2)}`);
        
        if (isNaN(maxDim) || !isFinite(maxDim) || maxDim <= 0) {
          console.error(`❌ Invalid maxDim for ${experience}_${stage}: ${maxDim}`);
          continue;
        }
        
        this.globalMaxDimension = Math.max(this.globalMaxDimension, maxDim);
        console.log(`📏 Updated globalMaxDimension: ${this.globalMaxDimension.toFixed(2)}`);
        
        // Clean up
        geometry.dispose();
        
      } catch (error) {
        const errorMsg = (error && typeof error === 'object' && 'message' in error) ? (error as any).message : String(error);
        console.warn(`⚠️ Could not process ${inputPath}:`, errorMsg);
      }
    }
  }
  
  console.log(`📐 Final globalMaxDimension: ${this.globalMaxDimension.toFixed(3)} units`);
  
  if (this.globalMaxDimension === 0 || isNaN(this.globalMaxDimension)) {
    console.error('❌ globalMaxDimension is invalid! Using fallback.');
    this.globalMaxDimension = 50; // Reasonable fallback based on your lily_4 coordinates
  }
}

  private async testPLYFile(filepath: string): Promise<void> {
  try {
    console.log(`🔍 Diagnosing PLY file: ${filepath}`);
    
    // Read first 1000 bytes to check header
    const buffer = await fs.readFile(filepath);
    const header = buffer.subarray(0, 1000).toString('utf8');
    
    console.log('📄 PLY Header (first 500 chars):');
    console.log(header.substring(0, 500));
    
    // Check if it's binary or ASCII
    const isBinary = header.includes('format binary_little_endian') || 
                     header.includes('format binary_big_endian');
    const isAscii = header.includes('format ascii');
    
    console.log(`📊 Format detection: Binary=${isBinary}, ASCII=${isAscii}`);
    console.log(`📊 File size: ${buffer.length} bytes`);
    
    // Try with browser PLYLoader directly
    const loader = new PLYLoader();
    const geometry = isBinary ? loader.parse(buffer.buffer) : loader.parse(buffer.toString('utf8'));
    
    console.log(`✅ Direct PLYLoader result: ${geometry.attributes.position.count} vertices`);
    
  } catch (error) {
    console.error(`❌ PLY diagnosis failed:`, error);
  }
}

  private async processModel(experience: string, stage: number) {
      const inputPath = path.resolve(process.cwd(), `public/models/raw/${experience}_${stage}.ply`);
    
    console.log(`🔄 Processing ${experience}_${stage}...`);
    
    try {
      const baseGeometry = await this.loadPLY(inputPath);
      
    console.log(`📊 STEP 1 - Original ${experience}_${stage}:`);
    this.checkGeometryForNaN(baseGeometry, 'Original PLY');
    
      
      
      // Apply base transformations (same for all quality levels)
      const normalizedGeometry = this.normalizeGeometry(baseGeometry);

      console.log(`📊 STEP 2 - After normalization:`);
    this.checkGeometryForNaN(normalizedGeometry, 'After normalize');
    

    const normalizedPositions = normalizedGeometry.attributes.position;
    let hasNaN = false;
    for (let i = 0; i < Math.min(10, normalizedPositions.count); i++) {
      const x = normalizedPositions.getX(i);
      const y = normalizedPositions.getY(i);
      const z = normalizedPositions.getZ(i);
      if (isNaN(x) || isNaN(y) || isNaN(z)) {
        hasNaN = true;
        console.error(`❌ NaN found after normalization at vertex ${i}:`, { x, y, z });
      }
    }
    
    if (!hasNaN) {
      console.log('✅ Normalized geometry data looks valid');
    }
      
      // Generate all quality variants
      for (const quality of QUALITY_LEVELS) {

      console.log(`📊 STEP 3 - Creating ${quality.name} variant:`);


        const optimizedGeometry = this.createQualityVariant(normalizedGeometry, quality);
        await this.saveOptimizedGeometry(optimizedGeometry, experience, stage, quality.name);
      }
      
      // Cleanup
      baseGeometry.dispose();
      normalizedGeometry.dispose();
      
    } catch (error) {
      console.error(`❌ Failed to process ${experience}_${stage}:`, error);
    }
  }

  private checkGeometryForNaN(geometry: THREE.BufferGeometry, step: string): void {
  const positions = geometry.attributes.position;
  
  if (!positions) {
    console.error(`❌ ${step}: No position attribute!`);
    return;
  }
  
  console.log(`   ${step}: ${positions.count} vertices`);
  
  // Check first few vertices
  for (let i = 0; i < Math.min(3, positions.count); i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = positions.getZ(i);
    
    if (isNaN(x) || isNaN(y) || isNaN(z)) {
      console.error(`❌ ${step}: NaN at vertex ${i}: (${x}, ${y}, ${z})`);
      return; // Stop checking after first NaN
    } else {
      console.log(`   ✅ ${step}: Vertex ${i}: (${x.toFixed(3)}, ${y.toFixed(3)}, ${z.toFixed(3)})`);
    }
  }
}

  private normalizeGeometry(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
    const normalized = geometry.clone();
    
    // 1. Center at origin (most expensive operation)
    normalized.center();

     console.log('📊 After center():');
  const positions = normalized.attributes.position;
  for (let i = 0; i < Math.min(3, positions.count); i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = positions.getZ(i);
    console.log(`  Vertex ${i}: (${x}, ${y}, ${z})`);
  }

    
    // 2. Apply unified scaling
    const targetSize = 2.0; // Standard size for all models
    const scale = targetSize / this.globalMaxDimension;

  console.log(`📊 Applying scale: ${scale} (targetSize: ${targetSize}, globalMaxDim: ${this.globalMaxDimension})`);
  
  // DEBUG: Check if globalMaxDimension is valid
  if (this.globalMaxDimension === 0 || isNaN(this.globalMaxDimension)) {
    console.error(`❌ Invalid globalMaxDimension: ${this.globalMaxDimension}`);
    return normalized; // Return without scaling
  }



    normalized.scale(scale, scale, scale);
    
    // 3. Coordinate system conversion (Blender Z-up to Three.js Y-up)
    normalized.rotateX(-Math.PI / 2);
    
    // 4. Optimize vertex order for GPU cache efficiency
    if (normalized.index) {
      // For indexed geometries, optimize vertex cache
      normalized.index = this.optimizeVertexCache(normalized.index);
    }
    
    return normalized;
  }

  private createQualityVariant(geometry: THREE.BufferGeometry, quality: QualityLevel): THREE.BufferGeometry {
    const positions = geometry.attributes.position;
    const colors = geometry.attributes.color;
    const currentVertexCount = positions.count;
    
    // If already at or below target vertex count, return as-is
    if (currentVertexCount <= quality.vertices) {
      return geometry.clone();
    }
    
    // Calculate sampling ratio
    const samplingRatio = quality.vertices / currentVertexCount;
    
    // Smart sampling (preserve important vertices)
    const sampledGeometry = this.smartSampleGeometry(geometry, samplingRatio);
    
    // Apply quality-specific size adjustment
    const sizeScale = quality.size / 2.0; // Relative to base size
    sampledGeometry.scale(sizeScale, sizeScale, sizeScale);
    
    return sampledGeometry;
  }

  private smartSampleGeometry(geometry: THREE.BufferGeometry, ratio: number): THREE.BufferGeometry {
    const positions = geometry.attributes.position;
    const colors = geometry.attributes.color;
    const currentCount = positions.count;
    const targetCount = Math.floor(currentCount * ratio);
    
    // Use uniform sampling for consistent results
    const sampledGeometry = new THREE.BufferGeometry();
    const sampledPositions = new Float32Array(targetCount * 3);
    const sampledColors = colors ? new Float32Array(targetCount * 3) : null;
    
    const step = currentCount / targetCount;
    
    for (let i = 0; i < targetCount; i++) {
      const sourceIndex = Math.floor(i * step);
      
      // Copy position
      sampledPositions[i * 3] = positions.getX(sourceIndex);
      sampledPositions[i * 3 + 1] = positions.getY(sourceIndex);
      sampledPositions[i * 3 + 2] = positions.getZ(sourceIndex);
      
      // Copy color if available
      if (colors && sampledColors) {
        sampledColors[i * 3] = colors.getX(sourceIndex);
        sampledColors[i * 3 + 1] = colors.getY(sourceIndex);
        sampledColors[i * 3 + 2] = colors.getZ(sourceIndex);
      }
    }
    
    sampledGeometry.setAttribute('position', new THREE.BufferAttribute(sampledPositions, 3));
    if (sampledColors) {
      sampledGeometry.setAttribute('color', new THREE.BufferAttribute(sampledColors, 3));
    }
    
    return sampledGeometry;
  }

  private optimizeVertexCache(indices: THREE.BufferAttribute): THREE.BufferAttribute {
    // Implement Forsyth vertex cache optimization algorithm
    // This improves GPU cache hit rates for better performance
    // For now, return as-is (can be implemented later for extra optimization)
    return indices;
  }

  private async saveOptimizedGeometry(
    geometry: THREE.BufferGeometry, 
    experience: string, 
    stage: number, 
    quality: string
  ) {
      const outputDir = path.resolve(process.cwd(), 'public/models/processed');

    await fs.mkdir(outputDir, { recursive: true });
    
    const filename = `${experience}_${stage}_${quality}.bin`;
    const filepath = path.join(outputDir, filename);
    
    // Convert geometry to binary format
    const binaryData = this.geometryToBinary(geometry);
    await fs.writeFile(filepath, binaryData);
    
    const vertexCount = geometry.attributes.position.count;
    const fileSizeKB = (binaryData.length / 1024).toFixed(1);
    
    console.log(`  💾 Saved ${filename}: ${vertexCount} vertices, ${fileSizeKB}KB`);
  }
// Use 64-byte fixed header (always 4-byte aligned)
private static readonly FIXED_HEADER_SIZE = 64; // Enough for any reasonable JSON header

private geometryToBinary(geometry: THREE.BufferGeometry): Buffer {
  const positions = geometry.attributes.position;
  const colors = geometry.attributes.color;

    console.log('📊 Pre-conversion check:');
  for (let i = 0; i < Math.min(5, positions.count); i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = positions.getZ(i);
    console.log(`  Vertex ${i}: (${x.toFixed(3)}, ${y.toFixed(3)}, ${z.toFixed(3)})`);
    
    if (isNaN(x) || isNaN(y) || isNaN(z)) {
      console.error(`❌ NaN detected before binary conversion at vertex ${i}`);
    }
  }
  
  const vertexCount = positions.count;
  const hasColors = !!colors;
  
  // Create compact header
  const headerData = {
    vertexCount,
    hasColors,
    version: 1
  };
  
  const headerJSON = JSON.stringify(headerData);
  const headerBytes = Buffer.from(headerJSON, 'utf8');
  
  // Validate header fits in fixed size
  if (headerBytes.length > ModelPreprocessor.FIXED_HEADER_SIZE - 4) {
    throw new Error(`Header too large: ${headerBytes.length} bytes (max: ${ModelPreprocessor.FIXED_HEADER_SIZE - 4})`);
  }
  
  // Create fixed-size header buffer (guaranteed 4-byte aligned)
  const fixedHeaderBuffer = Buffer.alloc(ModelPreprocessor.FIXED_HEADER_SIZE);
  
  // First 4 bytes: actual JSON length
  fixedHeaderBuffer.writeUInt32LE(headerBytes.length, 0);
  
  // Remaining bytes: JSON + zero padding
  headerBytes.copy(fixedHeaderBuffer, 4);
  // Rest is automatically zero-padded
  
  // Create geometry data buffers
  const positionsArray = positions.array as Float32Array;
  const positionsBuffer = Buffer.from(positionsArray.buffer, positionsArray.byteOffset, positionsArray.byteLength);
  
  let colorsBuffer = Buffer.alloc(0);
  if (colors) {
    const colorsArray = colors.array as Float32Array;
    colorsBuffer = Buffer.from(colorsArray.buffer, colorsArray.byteOffset, colorsArray.byteLength);
  }
  
  // Concatenate: [64-byte header][positions][colors]
  // Data section now always starts at byte 64 (4-byte aligned)
  const totalBuffer = Buffer.concat([
    fixedHeaderBuffer,  // Always 64 bytes
    positionsBuffer,    // Starts at byte 64 (aligned)
    colorsBuffer
  ]);
  
  console.log(`    📊 Fixed header format: ${vertexCount} vertices`);
  console.log(`    📊 Header: ${headerBytes.length}B (fixed to ${ModelPreprocessor.FIXED_HEADER_SIZE}B)`);
  console.log(`    📊 Positions: ${positionsBuffer.length}B (starts at byte ${ModelPreprocessor.FIXED_HEADER_SIZE})`);
  console.log(`    📊 Colors: ${colorsBuffer.length}B`);
  console.log(`    📊 Total: ${totalBuffer.length}B`);
  
  return totalBuffer;
}

  private async generateMetadata() {
    const metadata = {
      generated: new Date().toISOString(),
      globalMaxDimension: this.globalMaxDimension,
      qualityLevels: QUALITY_LEVELS,
      experiences: EXPERIENCES,
      stages: STAGES,
      version: '1.0'
    };
    
     const metadataPath = path.resolve(process.cwd(), 'public/models/processed/metadata.json');
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
    
    console.log('📄 Generated metadata.json');
  }

private async loadPLY(filepath: string): Promise<THREE.BufferGeometry> {
  return new Promise(async (resolve, reject) => {
    try {
      console.log(`📥 Loading PLY file: ${filepath}`);
      
      // Read the file as ArrayBuffer, not text
      const fileBuffer = await fs.readFile(filepath);
      
      // Create a PLYLoader
      const loader = new PLYLoader();
      
      // Parse the buffer directly - PLYLoader expects ArrayBuffer for binary files
      let geometry: THREE.BufferGeometry;
      
      try {
        // Try parsing as binary first
        geometry = loader.parse(fileBuffer.buffer);
        console.log(`✅ Loaded as binary PLY: ${geometry.attributes.position.count} vertices`);
      } catch (binaryError) {
        try {
          // Fallback: try as text
          const fileContent = fileBuffer.toString('utf8');
          geometry = loader.parse(fileContent);
          console.log(`✅ Loaded as ASCII PLY: ${geometry.attributes.position.count} vertices`);
        } catch (textError) {
          const binaryMsg = (binaryError && typeof binaryError === 'object' && 'message' in binaryError) ? (binaryError as any).message : String(binaryError);
          const textMsg = (textError && typeof textError === 'object' && 'message' in textError) ? (textError as any).message : String(textError);
          throw new Error(`Failed to parse PLY as binary or text: ${binaryMsg}, ${textMsg}`);
        }
      }
      
      // Validate the loaded geometry
      const positions = geometry.attributes.position;
      if (!positions || positions.count === 0) {
        throw new Error('PLY file contains no vertex positions');
      }
      
      // Check for NaN in loaded data
      let hasNaN = false;
      for (let i = 0; i < Math.min(10, positions.count) && !hasNaN; i++) {
        const x = positions.getX(i);
        const y = positions.getY(i);
        const z = positions.getZ(i);
        if (isNaN(x) || isNaN(y) || isNaN(z)) {
          hasNaN = true;
          console.error(`❌ NaN detected in loaded PLY at vertex ${i}: (${x}, ${y}, ${z})`);
        }
      }
      
      if (hasNaN) {
        throw new Error('PLY file contains NaN values in position data');
      }
      
      console.log(`✅ PLY validation passed: ${positions.count} vertices, ${geometry.attributes.color ? 'has colors' : 'no colors'}`);
      resolve(geometry);
      
    } catch (error) {
      console.error(`❌ Error loading PLY ${filepath}:`, error);
      reject(error);
    }
  });
}


}

// CLI interface
async function main(this: any) {
  const preprocessor = new ModelPreprocessor();
  
  try {
    await preprocessor.preprocessAll();

  console.log('🚀 Starting model preprocessing...');
  // await this.testPLYFile('public/models/raw/lily_1.ply');


    process.exit(0);
  } catch (error) {
    console.error('❌ Preprocessing failed:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default ModelPreprocessor;