// StaticPointCloudEngine.tsx - Engine for static PLY point cloud models with global caching
import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import { getAssetPath } from '../../utils/assetPaths';
import { getDeviceCapabilities } from '../../utils/deviceOptimization';

export interface StaticPointCloudConfig {
  modelName: 'mac' | 'volunteers' | 'helen_s' | '2200_bc';
  
  // Model-specific settings (all required - no defaults in engine)
  knownMaxDim: number;          // Largest dimension for scaling
  knownCenter: THREE.Vector3;   // Model center for centering
  targetScale: number;          // Final scale multiplier
  
  // Point cloud settings
  pointSize: number;
  pointDensity: number;         // 0-1, sampling density
  fallbackColor: number;        // Hex color if no vertex colors
  
  // Coordinate system corrections
  rotationCorrection: THREE.Euler;  // Model-specific rotation fixes
  centerModel: boolean;         // Whether to center the geometry
  
  // Performance settings
  maxVertices?: number;          // Override device max vertices
}

interface StaticPointCloudEngineProps {
  config: StaticPointCloudConfig;
  scene: THREE.Scene;
  
  // Positioning (handled externally by experience)
  position?: THREE.Vector3;
  rotation?: THREE.Euler;
  scale?: number;
  
  // State management
  enabled?: boolean;
  
  // Callbacks
  onModelLoaded?: (pointCloud: THREE.Points) => void;
  onLoadingProgress?: (progress: number) => void;
  onError?: (error: string) => void;
  onReady?: () => void;
}

// =================================================================
// GLOBAL MODEL CACHE - Singleton pattern for model management
// =================================================================

interface CachedModel {
  pointCloud: THREE.Points;
  material: THREE.PointsMaterial;
  geometry: THREE.BufferGeometry;
  refCount: number; // Track how many components are using this model
}

class StaticModelCache {
  private cache = new Map<string, CachedModel>();
  private loadingPromises = new Map<string, Promise<CachedModel>>();
  
  /**
   * Get or load a model - returns existing cached model or starts loading
   */
  async getModel(config: StaticPointCloudConfig, onProgress?: (progress: number) => void): Promise<CachedModel> {
    const modelKey = config.modelName;
    
    // Return cached model if available
    const cached = this.cache.get(modelKey);
    if (cached) {
      cached.refCount++;
      console.log(`♻️ ${modelKey}: Using cached model (refCount: ${cached.refCount})`);
      return cached;
    }
    
    // Return existing loading promise if already loading
    const existingPromise = this.loadingPromises.get(modelKey);
    if (existingPromise) {
      console.log(`⏳ ${modelKey}: Already loading, waiting for completion...`);
      const model = await existingPromise;
      model.refCount++;
      return model;
    }
    
    // Start new loading process
    console.log(`🚀 ${modelKey}: Starting fresh load...`);
    const loadPromise = this.loadModel(config, onProgress);
    this.loadingPromises.set(modelKey, loadPromise);
    
    try {
      const model = await loadPromise;
      model.refCount = 1; // First reference
      this.cache.set(modelKey, model);
      this.loadingPromises.delete(modelKey);
      console.log(`✅ ${modelKey}: Loaded and cached successfully`);
      return model;
    } catch (error) {
      this.loadingPromises.delete(modelKey);
      throw error;
    }
  }
  
  /**
   * Release a model reference - dispose when no longer used
   */
  releaseModel(modelName: string): void {
    const cached = this.cache.get(modelName);
    if (!cached) {
      console.warn(`⚠️ ${modelName}: Attempted to release non-cached model`);
      return;
    }
    
    cached.refCount--;
    console.log(`📤 ${modelName}: Released reference (refCount: ${cached.refCount})`);
    
    // Dispose when no more references
    if (cached.refCount <= 0) {
      console.log(`🗑️ ${modelName}: Disposing model (no more references)`);
      
      // Dispose Three.js resources
      cached.geometry.dispose();
      cached.material.dispose();
      
      // Remove from cache
      this.cache.delete(modelName);
      console.log(`✅ ${modelName}: Model disposed and removed from cache`);
    }
  }
  
  /**
   * Get cache statistics for debugging
   */
  getStats(): { totalCached: number; models: Array<{ name: string; refCount: number }> } {
    return {
      totalCached: this.cache.size,
      models: Array.from(this.cache.entries()).map(([name, model]) => ({
        name,
        refCount: model.refCount
      }))
    };
  }
  
  /**
   * Force clear all cached models (emergency cleanup)
   */
  clearAll(): void {
    console.log('🧹 Clearing all cached models...');
    this.cache.forEach((model, name) => {
      model.geometry.dispose();
      model.material.dispose();
      console.log(`🗑️ Disposed ${name}`);
    });
    this.cache.clear();
    this.loadingPromises.clear();
    console.log('✅ All models cleared from cache');
  }
  
  /**
   * Internal model loading logic
   */
  private async loadModel(config: StaticPointCloudConfig, onProgress?: (progress: number) => void): Promise<CachedModel> {
    // Get device capabilities
    let deviceCaps;
    try {
      deviceCaps = getDeviceCapabilities();
    } catch (error) {
      console.warn(`⚠️ ${config.modelName}: Device capabilities failed, using fallback`);
      deviceCaps = {
        quality: 'low' as const,
        isMobile: true,
        isLowEnd: true,
        maxVertices: 25000,
        shouldReduceFrameRate: true,
        maxPixelRatio: 1.5,
        rendererSettings: {
          antialias: false,
          powerPreference: 'low-power' as const,
          precision: 'mediump' as const
        }
      };
    }

    if (onProgress) onProgress(10);

    // Load PLY file
    const modelPath = getAssetPath(`models/${config.modelName}.ply`);
    console.log(`📥 Loading ${config.modelName}.ply from:`, modelPath);
    const loader = new PLYLoader();
    
    const geometry = await new Promise<THREE.BufferGeometry>((resolve, reject) => {
      loader.load(
        modelPath,
        (loadedGeometry) => {
          console.log(`✅ ${config.modelName}.ply file loaded successfully!`);

   


          resolve(loadedGeometry);
        },
        (xhr) => {
          if (onProgress && xhr.total > 0) {
            const progress = 10 + ((xhr.loaded / xhr.total) * 60);
            onProgress(progress);
          }
        },
        (error) => {
          console.error(`❌ Error loading ${config.modelName}.ply:`, error);
          reject(error);
        }
      );
    });

    if (onProgress) onProgress(70);

    // Process geometry
    const originalVertexCount = geometry.attributes.position.count;
    let processedGeometry = geometry;
    
    // Apply vertex reduction if needed
    const maxVertices = config.maxVertices ?? deviceCaps.maxVertices;

    if (originalVertexCount > maxVertices) {
      console.log(`🔧 ${config.modelName}: Reducing vertices: ${originalVertexCount} → ${maxVertices}`);
      processedGeometry = sampleGeometry(geometry, 1.0, maxVertices);
    } else if (config.pointDensity < 1.0) {
      console.log(`🔧 ${config.modelName}: Applying density sampling: ${config.pointDensity}`);
      processedGeometry = sampleGeometry(geometry, config.pointDensity);
    }

    // Apply scaling
    

    if (onProgress) onProgress(80);

    // Create material
    const material = new THREE.PointsMaterial({
      size: config.pointSize,
      sizeAttenuation: false,
      vertexColors: !!processedGeometry.attributes.color
    });

    if (!processedGeometry.attributes.color) {
      material.color.setHex(config.fallbackColor);
      console.log(`⚠️ ${config.modelName}: No vertex colors, using fallback color`);
    } else {
      console.log(`✅ ${config.modelName}: Using embedded vertex colors`);
    }

    // Create point cloud
    const pointCloud = new THREE.Points(processedGeometry, material);
    pointCloud.name = `${config.modelName}-point-cloud`;


// Compute bounding box for normalization
processedGeometry.computeBoundingBox();
const boundingBox = processedGeometry.boundingBox!;

// Calculate actual max dimension
const size = new THREE.Vector3();
boundingBox.getSize(size);
const actualMaxDim = Math.max(size.x, size.y, size.z);

console.log(`📐 ${config.modelName}: Actual max dimension: ${actualMaxDim.toFixed(3)}`);
console.log(`📐 ${config.modelName}: Known max dimension: ${config.knownMaxDim}`);
console.log(`📐 ${config.modelName}: Target scale: ${config.targetScale}`);

// Apply normalization scaling based on actual vs known dimensions
const normalizationScale = config.knownMaxDim / actualMaxDim;
const finalScale = config.targetScale * normalizationScale;

// pointCloud.scale.setScalar(finalScale);
// console.log(`📏 ${config.modelName}: Applied normalization scale: ${finalScale.toFixed(4)}`);
processedGeometry.scale(finalScale, finalScale, finalScale);

    // Apply model-specific transforms
    if (config.centerModel && config.knownCenter.length() > 0) {
      pointCloud.position.set(-config.knownCenter.x, -config.knownCenter.y, -config.knownCenter.z);
    }
    // pointCloud.scale.set(config.targetScale, config.targetScale, config.targetScale);
    pointCloud.rotation.set(config.rotationCorrection.x, config.rotationCorrection.y, config.rotationCorrection.z);

    if (onProgress) onProgress(100);

    console.log(`✅ ${config.modelName} processed successfully:`, {
      vertices: processedGeometry.attributes.position.count,
      hasColors: !!processedGeometry.attributes.color,
      finalScale: config.targetScale
    });

    console.log(`🔍 HELEN Original PLY data:`, {
  originalVertices: geometry.attributes.position.count,
  beforeSampling: !!geometry.attributes.position
});

    return {
      pointCloud,
      material,
      geometry: processedGeometry,
      refCount: 0 // Will be set to 1 by caller
    };
  }
}

// Global singleton instance
const globalModelCache = new StaticModelCache();

// Expose cache for debugging
(window as any).staticModelCache = globalModelCache;

// =================================================================
// COMPONENT IMPLEMENTATION
// =================================================================

// Move sampleGeometry outside component to avoid React stability issues
function sampleGeometry(geometry: THREE.BufferGeometry, density: number, targetVertexCount?: number): THREE.BufferGeometry {
  const positions = geometry.attributes.position;
  const colors = geometry.attributes.color;
  const normals = geometry.attributes.normal;
  const totalPoints = positions.count;
  
  let sampleCount;
  if (targetVertexCount) {
    sampleCount = Math.min(targetVertexCount, totalPoints);
  } else {
    const clampedDensity = Math.min(Math.max(density, 0), 1.0);
    sampleCount = Math.floor(totalPoints * clampedDensity);
  }
  
  if (sampleCount >= totalPoints) {
    return geometry.clone();
  }
  
  const sampledGeometry = new THREE.BufferGeometry();
  const sampledPositions = new Float32Array(sampleCount * 3);
  const sampledColors = colors ? new Float32Array(sampleCount * 3) : null;
  const sampledNormals = normals ? new Float32Array(sampleCount * 3) : null;
  
  // Sequential sampling for consistency
  const step = totalPoints / sampleCount;
  
  for (let i = 0; i < sampleCount; i++) {
    const idx = Math.floor(i * step);
    
    // Positions
    sampledPositions[i * 3] = positions.getX(idx);
    sampledPositions[i * 3 + 1] = positions.getY(idx);
    sampledPositions[i * 3 + 2] = positions.getZ(idx);
    
    // Colors
    if (colors && sampledColors) {
      sampledColors[i * 3] = colors.getX(idx);
      sampledColors[i * 3 + 1] = colors.getY(idx);
      sampledColors[i * 3 + 2] = colors.getZ(idx);
    }
    
    // Normals
    if (normals && sampledNormals) {
      sampledNormals[i * 3] = normals.getX(idx);
      sampledNormals[i * 3 + 1] = normals.getY(idx);
      sampledNormals[i * 3 + 2] = normals.getZ(idx);
    }
  }
  
  sampledGeometry.setAttribute('position', new THREE.BufferAttribute(sampledPositions, 3));
  if (sampledColors) {
    sampledGeometry.setAttribute('color', new THREE.BufferAttribute(sampledColors, 3));
  }
  if (sampledNormals) {
    sampledGeometry.setAttribute('normal', new THREE.BufferAttribute(sampledNormals, 3));
  }
  
  return sampledGeometry;
}

const StaticPointCloudEngine: React.FC<StaticPointCloudEngineProps> = ({
  config,
  scene,
  position = new THREE.Vector3(0, 0, 0),
  rotation = new THREE.Euler(0, 0, 0),
  scale = 1,
  enabled = true,
  onModelLoaded,
  onLoadingProgress,
  onError,
  onReady
}) => {
  // Component-level refs
  const modelRef = useRef<THREE.Points | null>(null);
  const initializationStartedRef = useRef(false);
  const componentIdRef = useRef(Math.random().toString(36).substr(2, 9)); // Unique component ID

  console.log(`🎯 StaticPointCloudEngine: Component created for ${config.modelName} (ID: ${componentIdRef.current})`);

  // Model loading effect - runs once per component lifecycle
  useEffect(() => {
    // Prevent double initialization within same component
    if (initializationStartedRef.current) {
      console.log(`⏭️ ${config.modelName}: Already initialized in this component instance`);
      return;
    }
    initializationStartedRef.current = true;

    let isMounted = true;

    const loadModel = async () => {
      try {
        console.log(`🚀 ${config.modelName}: Starting model acquisition (Component ID: ${componentIdRef.current})`);
        
        // Get model from global cache (or load if not cached)
        const cachedModel = await globalModelCache.getModel(config, onLoadingProgress);
        
        if (!isMounted) {
          // Component was unmounted during loading - release the model
          console.log(`🚫 ${config.modelName}: Component unmounted during load, releasing model`);
          globalModelCache.releaseModel(config.modelName);
          return;
        }

        // Store reference and add to scene
        modelRef.current = cachedModel.pointCloud;
        scene.add(cachedModel.pointCloud);

        console.log(`✅ ${config.modelName}: Model ready in scene (Component ID: ${componentIdRef.current})`);

        // Notify callbacks
        if (onModelLoaded) onModelLoaded(cachedModel.pointCloud);
        if (onReady) onReady();

      } catch (error) {
        console.error(`❌ ${config.modelName}: Failed to load model:`, error);
        if (onError) onError(`Failed to load ${config.modelName}: ${error}`);
      }
    };

    loadModel();

    // Cleanup function - runs when component unmounts
    return () => {
      console.log(`🧹 ${config.modelName}: Component cleanup (ID: ${componentIdRef.current})`);
      isMounted = false;
      
      // Remove from scene
      if (modelRef.current) {
        scene.remove(modelRef.current);
        console.log(`📤 ${config.modelName}: Removed from scene`);
      }
      
      // Release model reference (will dispose if no more references)
      globalModelCache.releaseModel(config.modelName);
      
      modelRef.current = null;
    };
  }, []); // No dependencies - run once per component lifecycle

  // Handle enabled state changes
  useEffect(() => {
    if (modelRef.current) {
      modelRef.current.visible = enabled;
    }
  }, [enabled]);

  return null;
};

export default StaticPointCloudEngine;

// Export cache for external access (debugging, stats, etc.)
export { globalModelCache };