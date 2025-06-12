// scripts/preprocessAnimatedModels.ts
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import fs from 'fs/promises';
import path from 'path';
import process from 'process';
import { Buffer } from 'buffer';

(global as any).self = global;
(global as any).window = global;
(global as any).document = { createElement: () => ({}), createElementNS: () => ({}) };
(global as any).HTMLCanvasElement = class {};
(global as any).HTMLImageElement = class {};
(global as any).ImageData = class {};

interface QualityLevel {
  vertices: number;
  size: number;
  name: string;
  outputName: string;
}

// Same quality levels as your existing preprocessor
const QUALITY_LEVELS: QualityLevel[] = [
  { name: 'high', vertices: 40000, size: 1.0, outputName: 'high' },
  { name: 'low',  vertices: 25000, size: 1.5, outputName: 'low' }
];

// Animation configuration
const ANIMATION_CONFIG = {
  totalFrames: 24,           // 1 second at 24fps
  animationDuration: 1.0,    // 1 second total duration
  modelName: 'bc2200' ,       // Output prefix
  inputFile: 'models/raw/BC2200.glb'
};

class AnimatedModelPreprocessor {
  private gltfLoader = new GLTFLoader();
  private globalMaxDimension = 0;
  private animationFrames: THREE.BufferGeometry[] = [];

  // Use same fixed header size as your existing preprocessor
  private static readonly FIXED_HEADER_SIZE = 128;

  async preprocessAnimatedModel(inputPath: string) {
    console.log('🚀 Starting animated model preprocessing...');

      const actualInputPath = inputPath || ANIMATION_CONFIG.inputFile;

    
    // Resolve the input path
    const resolvedInputPath = path.isAbsolute(inputPath) 
      ? inputPath 
      : path.resolve(process.cwd(), 'public', inputPath.replace(/^\//, ''));
    
    console.log(`📁 Input GLB: ${resolvedInputPath}`);
    
    try {
      // Step 1: Load GLB and extract animation frames
      await this.loadGLBAndExtractFrames(resolvedInputPath);
      
      // Step 2: Find global max dimension across all frames
      await this.findGlobalMaxDimension();
      
      // Step 3: Process all frames at all quality levels
      await this.processAllFrames();
      
      // Step 4: Generate metadata
      await this.generateMetadata();
      
      console.log('✅ Animated model preprocessing complete!');
      
    } catch (error) {
      console.error('❌ Preprocessing failed:', error);
      throw error;
    }
  }

    private async loadGLBAndExtractFrames(inputPath: string) {
    console.log('📥 Loading GLB file...');
    
    return new Promise<void>(async (resolve, reject) => {
    try {
        // Read the file as buffer first
        const fileBuffer = await fs.readFile(inputPath);
        console.log(`📄 File read successfully: ${fileBuffer.length} bytes`);
        
        // Parse the buffer directly using GLTFLoader.parse()
        this.gltfLoader.parse(
        fileBuffer.buffer,
        '', // base path (empty for buffer parsing)
        (gltf) => {
            console.log('✅ GLB loaded successfully');
            
            // Extract the scene and animations
            const scene = gltf.scene;
            const animations = gltf.animations;
            
            if (animations.length === 0) {
            reject(new Error('No animations found in GLB file'));
            return;
            }
            
            console.log(`🎬 Found ${animations.length} animation(s)`);
            
            // Use the first animation (paddling animation)
            const animation = animations[0];
            console.log(`🎬 Using animation: "${animation.name}" (duration: ${animation.duration}s)`);
            
            // Create animation mixer
            const mixer = new THREE.AnimationMixer(scene);
            const action = mixer.clipAction(animation);
            
            // Set up for frame extraction
            action.play();
            action.paused = true;
            
            console.log(`🎞️ Extracting ${ANIMATION_CONFIG.totalFrames} frames...`);
            
            // Extract frames at regular intervals
            for (let frame = 0; frame < ANIMATION_CONFIG.totalFrames; frame++) {
            // Calculate time for this frame (ensure we get a complete loop)
            const normalizedTime = frame / ANIMATION_CONFIG.totalFrames;
            const animationTime = normalizedTime * animation.duration;
            
            // Set mixer to specific time
            mixer.setTime(animationTime);
            
            // Extract geometry from the animated scene
            const frameGeometry = this.extractGeometryFromScene(scene, frame);
            
            if (frameGeometry) {
                this.animationFrames.push(frameGeometry);
                console.log(`  📑 Frame ${frame + 1}/${ANIMATION_CONFIG.totalFrames}: ${frameGeometry.attributes.position.count} vertices`);
            } else {
                console.warn(`⚠️ Failed to extract geometry for frame ${frame}`);
            }
            }
            
            console.log(`✅ Extracted ${this.animationFrames.length} animation frames`);
            resolve();
        },
        (error) => {
            console.error('❌ Error parsing GLB:', error);
            reject(error);
        }
        );
    } catch (error) {
        console.error('❌ Error reading GLB file:', error);
        reject(error);
    }
    });
    }

  private extractGeometryFromScene(scene: THREE.Object3D, frameIndex: number): THREE.BufferGeometry | null {
    const geometries: THREE.BufferGeometry[] = [];
    
    // Traverse the scene and collect all mesh geometries
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry) {
        // Clone the geometry to capture the current animated state
        const geometry = child.geometry.clone();
        
        // Apply the current world matrix to get the final transformed positions
        child.updateMatrixWorld(true);
        geometry.applyMatrix4(child.matrixWorld);
        
        geometries.push(geometry);
      }
    });
    
    if (geometries.length === 0) {
      console.warn(`⚠️ No geometries found in scene for frame ${frameIndex}`);
      return null;
    }
    
    // If multiple geometries, merge them into one
    if (geometries.length === 1) {
      return geometries[0];
    } else {
      console.log(`🔗 Merging ${geometries.length} geometries for frame ${frameIndex}`);
      return this.mergeGeometries(geometries);
    }
  }

  private mergeGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
    // Simple geometry merging - combine all vertices into one buffer
    let totalVertices = 0;
    let hasColors = true;
    
    // Count total vertices and check if all have colors
    for (const geom of geometries) {
      totalVertices += geom.attributes.position.count;
      if (!geom.attributes.color) {
        hasColors = false;
      }
    }
    
    // Create merged arrays
    const mergedPositions = new Float32Array(totalVertices * 3);
    const mergedColors = hasColors ? new Float32Array(totalVertices * 3) : null;
    
    let offset = 0;
    for (const geom of geometries) {
      const positions = geom.attributes.position.array as Float32Array;
      const colors = geom.attributes.color?.array as Float32Array;
      
      // Copy positions
      mergedPositions.set(positions, offset * 3);
      
      // Copy colors if available
      if (colors && mergedColors) {
        mergedColors.set(colors, offset * 3);
      } else if (mergedColors) {
        // Fill with default color if this geometry has no colors
        for (let i = 0; i < geom.attributes.position.count; i++) {
          const idx = (offset + i) * 3;
          mergedColors[idx] = 0.5;     // R
          mergedColors[idx + 1] = 0.3; // G  
          mergedColors[idx + 2] = 0.2; // B (brownish default)
        }
      }
      
      offset += geom.attributes.position.count;
    }
    
    // Create merged geometry
    const mergedGeometry = new THREE.BufferGeometry();
    mergedGeometry.setAttribute('position', new THREE.BufferAttribute(mergedPositions, 3));
    
    if (mergedColors) {
      mergedGeometry.setAttribute('color', new THREE.BufferAttribute(mergedColors, 3));
    }
    
    // Clean up input geometries
    geometries.forEach(geom => geom.dispose());
    
    return mergedGeometry;
  }

  private async findGlobalMaxDimension() {
    console.log('📏 Finding global maximum dimension across all frames...');
    this.globalMaxDimension = 0;
    
    for (let frameIndex = 0; frameIndex < this.animationFrames.length; frameIndex++) {
      const geometry = this.animationFrames[frameIndex];
      
      geometry.computeBoundingBox();
      
      if (!geometry.boundingBox) {
        console.warn(`⚠️ No bounding box for frame ${frameIndex}`);
        continue;
      }
      
      const box = geometry.boundingBox;
      const dimensions = {
        x: box.max.x - box.min.x,
        y: box.max.y - box.min.y,
        z: box.max.z - box.min.z
      };
      
      const maxDim = Math.max(dimensions.x, dimensions.y, dimensions.z);
      
      if (isNaN(maxDim) || !isFinite(maxDim) || maxDim <= 0) {
        console.error(`❌ Invalid maxDim for frame ${frameIndex}: ${maxDim}`);
        continue;
      }
      
      this.globalMaxDimension = Math.max(this.globalMaxDimension, maxDim);
    }
    
    console.log(`📐 Final globalMaxDimension: ${this.globalMaxDimension.toFixed(3)} units`);
    
    if (this.globalMaxDimension === 0 || isNaN(this.globalMaxDimension)) {
      console.error('❌ globalMaxDimension is invalid! Using fallback.');
      this.globalMaxDimension = 50; // Reasonable fallback
    }
  }

  private async processAllFrames() {
    console.log('🔄 Processing all animation frames...');
    
    for (let frameIndex = 0; frameIndex < this.animationFrames.length; frameIndex++) {
      await this.processFrame(frameIndex);
    }
  }

  private async processFrame(frameIndex: number) {
    const geometry = this.animationFrames[frameIndex];
    const frameNumber = String(frameIndex + 1).padStart(3, '0'); // 001, 002, etc.
    
    console.log(`🔄 Processing frame ${frameNumber}...`);
    
    try {
      // Apply base transformations (same approach as your existing preprocessor)
      const normalizedGeometry = this.normalizeGeometry(geometry);
      
      console.log(`📊 Frame ${frameNumber} - After normalization:`);
      this.checkGeometryForNaN(normalizedGeometry, `Frame ${frameNumber}`);
      
      // Generate quality variants
      const processedOutputs = new Set<string>();
      
      for (const quality of QUALITY_LEVELS) {
        const optimizedGeometry = this.createQualityVariant(normalizedGeometry, quality);
        
        const outputKey = `${ANIMATION_CONFIG.modelName}_frame_${frameNumber}_${quality.outputName}`;
        if (!processedOutputs.has(outputKey)) {
          await this.saveOptimizedGeometry(optimizedGeometry, frameNumber, quality.outputName);
          processedOutputs.add(outputKey);
          console.log(`  💾 Generated ${outputKey}.bin`);
        }
        
        optimizedGeometry.dispose();
      }
      
      normalizedGeometry.dispose();
      
    } catch (error) {
      console.error(`❌ Failed to process frame ${frameNumber}:`, error);
    }
  }

  // Use EXACT same normalization approach as your existing preprocessor
  private normalizeGeometry(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
    const normalized = geometry.clone();
    
    // 1. Center at origin
    normalized.center();
    
    // 2. Apply unified scaling
    const targetSize = 1; // Standard size for all models
    const scale = targetSize / this.globalMaxDimension;
    
    console.log(`📊 Applying scale: ${scale} (targetSize: ${targetSize}, globalMaxDim: ${this.globalMaxDimension})`);
    
    if (this.globalMaxDimension === 0 || isNaN(this.globalMaxDimension)) {
      console.error(`❌ Invalid globalMaxDimension: ${this.globalMaxDimension}`);
      return normalized;
    }
    
    normalized.scale(scale, scale, scale);
    
    // 3. Coordinate system conversion (Blender Z-up to Three.js Y-up)
    normalized.rotateX(-Math.PI / 2);
    
    // 4. Handle colors (same approach as existing preprocessor)
    const colors = normalized.attributes.color;
    if (colors) {
      console.log('🎨 Processing colors...');
      
      let invalidCount = 0;
      
      for (let i = 0; i < colors.count; i++) {
        let r = colors.getX(i);
        let g = colors.getY(i);
        let b = colors.getZ(i);
        
        // Handle invalid values only
        if (isNaN(r) || isNaN(g) || isNaN(b)) {
          colors.setXYZ(i, 0, 0, 0); // Default to black
          invalidCount++;
        }
      }
      
      if (invalidCount > 0) {
        colors.needsUpdate = true;
        console.log(`✅ Fixed ${invalidCount} invalid colors`);
      }
    }
    
    return normalized;
  }

  // Use EXACT same quality variant creation as your existing preprocessor
  private createQualityVariant(geometry: THREE.BufferGeometry, quality: QualityLevel): THREE.BufferGeometry {
    const positions = geometry.attributes.position;
    const currentVertexCount = positions.count;
    
    if (currentVertexCount <= quality.vertices) {
      return geometry.clone();
    }
    
    const samplingRatio = quality.vertices / currentVertexCount;
    const sampledGeometry = this.smartSampleGeometry(geometry, samplingRatio);
    
    const sizeScale = quality.size / 2.0;
    sampledGeometry.scale(sizeScale, sizeScale, sizeScale);
    
    return sampledGeometry;
  }

  // Use EXACT same smart sampling as your existing preprocessor
  private smartSampleGeometry(geometry: THREE.BufferGeometry, ratio: number): THREE.BufferGeometry {
    const positions = geometry.attributes.position;
    const colors = geometry.attributes.color;
    const currentCount = positions.count;
    const targetCount = Math.floor(currentCount * ratio);
    
    const sampledGeometry = new THREE.BufferGeometry();
    const sampledPositions = new Float32Array(targetCount * 3);
    const sampledColors = colors ? new Float32Array(targetCount * 3) : null;
    
    const step = currentCount / targetCount;
    
    for (let i = 0; i < targetCount; i++) {
      const sourceIndex = Math.floor(i * step);
      
      sampledPositions[i * 3] = positions.getX(sourceIndex);
      sampledPositions[i * 3 + 1] = positions.getY(sourceIndex);
      sampledPositions[i * 3 + 2] = positions.getZ(sourceIndex);
      
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

  // Use EXACT same binary format as your existing preprocessor
  private async saveOptimizedGeometry(optimizedGeometry: THREE.BufferGeometry<THREE.NormalBufferAttributes>, frameNumber: string, quality: string) {
    const outputDir = path.resolve(process.cwd(), 'public/models/processed');
    await fs.mkdir(outputDir, { recursive: true });
    
    const filename = `${ANIMATION_CONFIG.modelName}_frame_${frameNumber}_${quality}.bin`;
    const filepath = path.join(outputDir, filename);
    
    // Get the geometry for this frame and quality
    const frameIndex = parseInt(frameNumber) - 1;
    const geometry = this.animationFrames[frameIndex];
    
    if (!geometry) {
      throw new Error(`No geometry found for frame ${frameNumber}`);
    }
    
    // Convert geometry to binary format using EXACT same approach
    const binaryData = this.geometryToBinary(geometry);
    await fs.writeFile(filepath, binaryData);
    
    const vertexCount = geometry.attributes.position.count;
    const fileSizeKB = (binaryData.length / 1024).toFixed(1);
    
    console.log(`  💾 Saved ${filename}: ${vertexCount} vertices, ${fileSizeKB}KB`);
  }

  // Use EXACT same binary format as your existing preprocessor
  private geometryToBinary(geometry: THREE.BufferGeometry): Buffer {
    const positions = geometry.attributes.position;
    const colors = geometry.attributes.color;
    
    const vertexCount = positions.count;
    const hasColors = !!colors;
    
    // Create compact header (same format as existing preprocessor)
    const headerData = {
      vertexCount,
      hasColors,
      version: 1,
      frameData: true // Additional flag to indicate this is frame data
    };
    
    const headerJSON = JSON.stringify(headerData);
    const headerBytes = Buffer.from(headerJSON, 'utf8');
    
    // Validate header fits in fixed size
    if (headerBytes.length > AnimatedModelPreprocessor.FIXED_HEADER_SIZE - 4) {
      throw new Error(`Header too large: ${headerBytes.length} bytes`);
    }
    
    // Create fixed-size header buffer (guaranteed 4-byte aligned)
    const fixedHeaderBuffer = Buffer.alloc(AnimatedModelPreprocessor.FIXED_HEADER_SIZE);
    
    // First 4 bytes: actual JSON length
    fixedHeaderBuffer.writeUInt32LE(headerBytes.length, 0);
    
    // Remaining bytes: JSON + zero padding
    headerBytes.copy(fixedHeaderBuffer, 4);
    
    // Create geometry data buffers
    const positionsArray = positions.array as Float32Array;
    const positionsBuffer = Buffer.from(positionsArray.buffer, positionsArray.byteOffset, positionsArray.byteLength);
    
    let colorsBuffer = Buffer.alloc(0);
    if (colors) {
      const colorsArray = colors.array as Float32Array;
      colorsBuffer = Buffer.from(colorsArray.buffer, colorsArray.byteOffset, colorsArray.byteLength);
    }
    
    // Concatenate: [64-byte header][positions][colors]
    const totalBuffer = Buffer.concat([
      fixedHeaderBuffer,
      positionsBuffer,
      colorsBuffer
    ]);
    
    return totalBuffer;
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
        return;
      } else {
        console.log(`   ✅ ${step}: Vertex ${i}: (${x.toFixed(3)}, ${y.toFixed(3)}, ${z.toFixed(3)})`);
      }
    }
  }

  private async generateMetadata() {
    const metadata = {
      generated: new Date().toISOString(),
      modelType: 'animated',
      modelName: ANIMATION_CONFIG.modelName,
      globalMaxDimension: this.globalMaxDimension,
      animation: {
        totalFrames: ANIMATION_CONFIG.totalFrames,
        duration: ANIMATION_CONFIG.animationDuration,
        fps: ANIMATION_CONFIG.totalFrames / ANIMATION_CONFIG.animationDuration
      },
      qualityLevels: [
        { name: 'high', vertices: 40000, description: 'High quality for desktop/tablet' },
        { name: 'low', vertices: 25000, description: 'Low quality for mobile/low-end' }
      ],
      frameCount: this.animationFrames.length,
      version: '2.0'
    };
    
    const metadataPath = path.resolve(process.cwd(), 'public/models/processed/bc2200_metadata.json');
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
    
    console.log('📄 Generated bc2200_metadata.json');
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  
 if (args.length === 0) {
  console.log('Using default GLB file from config...');
  const preprocessor = new AnimatedModelPreprocessor();
  await preprocessor.preprocessAnimatedModel(ANIMATION_CONFIG.inputFile); // Pass default input file
} else {
  
  const inputPath = args[0];
  
  // For file system operations, we need the actual file path
  const actualFilePath = path.isAbsolute(inputPath) 
    ? inputPath 
    : path.resolve(process.cwd(), 'public', inputPath.replace(/^\//, ''));
  
  // Check if file exists
  try {
    await fs.access(actualFilePath);
    console.log(`✅ Found GLB file: ${actualFilePath}`);
  } catch {
    console.error(`❌ File not found: ${actualFilePath}`);
    console.log('Make sure the file exists in the public/ folder');
    process.exit(1);
  }
  
  const preprocessor = new AnimatedModelPreprocessor();
  
  try {
    await preprocessor.preprocessAnimatedModel(actualFilePath);
    console.log('🎉 Success! Animated model preprocessing completed.');
    console.log('📁 Generated files in: public/models/processed/');
    process.exit(0);
  } catch (error) {
    console.error('❌ Preprocessing failed:', error);
    process.exit(1);
  }
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default AnimatedModelPreprocessor;