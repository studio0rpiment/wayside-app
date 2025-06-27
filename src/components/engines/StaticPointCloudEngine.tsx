
import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import { getAssetPath } from '../../utils/assetPaths';
import { getDeviceCapabilities } from '../../utils/deviceOptimization';
import { PositioningSystemSingleton } from '../../utils/coordinate-system/PositioningSystemSingleton';
import { useGeofenceBasics } from '../../context/GeofenceContext';
import { debugModeManager } from '../../utils/DebugModeManager';


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
  experienceId: string;         // Which experience this model belongs to
  isUniversalMode?: boolean;    // Universal mode override
  lockPosition?: boolean;       // NEW: Lock position after first render
  
  // State management
  enabled?: boolean;
  
  // Callbacks
  onModelLoaded?: (pointCloud: THREE.Points) => void;
  onLoadingProgress?: (progress: number) => void;
  onError?: (error: string) => void;
  onReady?: () => void;
}


// =================================================================
// GLOBAL MODEL CACHE - Clean models without positioning
// =================================================================

interface CachedModel {
  geometry: THREE.BufferGeometry;
  material: THREE.PointsMaterial;
  refCount: number;
  
  // Model-specific corrections for instances to apply
  modelCorrections: {
    centerOffset: THREE.Vector3;
    rotationCorrection: THREE.Euler;
    finalScale: number;
  };
}

class StaticModelCache {
  private cache = new Map<string, CachedModel>();
  private loadingPromises = new Map<string, Promise<CachedModel>>();
  
  /**
   * Get or load a model - returns CLEAN geometry/material for instancing
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
   * Get model corrections for external use
   */
  getModelCorrections(modelName: string): {
    centerOffset: THREE.Vector3;
    rotationCorrection: THREE.Euler;
    finalScale: number;
  } | null {
    const cached = this.cache.get(modelName);
    return cached?.modelCorrections || null;
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
   * Internal model loading logic - creates CLEAN models
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

    if (onProgress) onProgress(80);

    // Apply scaling and centering to GEOMETRY
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

    // Apply normalization scaling to geometry
    const normalizationScale = config.knownMaxDim / actualMaxDim;
    const finalScale = config.targetScale * normalizationScale;
    processedGeometry.scale(finalScale, finalScale, finalScale);

    // Calculate center offset for instances to apply
    const centerOffset = new THREE.Vector3();
    if (config.centerModel && config.knownCenter.length() > 0) {
      centerOffset.copy(config.knownCenter).multiplyScalar(-finalScale);
    }

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

    if (onProgress) onProgress(100);

    console.log(`✅ ${config.modelName} processed successfully:`, {
      vertices: processedGeometry.attributes.position.count,
      hasColors: !!processedGeometry.attributes.color,
      finalScale: finalScale
    });

    // Return clean model data + correction info
    return {
      geometry: processedGeometry,
      material,
      refCount: 0, // Will be set to 1 by caller
      modelCorrections: {
        centerOffset,
        rotationCorrection: config.rotationCorrection,
        finalScale
      }
    };
  }
}

// Global singleton instance
const globalModelCache = new StaticModelCache();

// Expose cache for debugging
(window as any).staticModelCache = globalModelCache;



// =================================================================
// GEOMETRY SAMPLING UTILITY
// =================================================================

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

// =================================================================
// MAIN ENGINE COMPONENT - Direct positioning integration
// =================================================================

const StaticPointCloudEngine: React.FC<StaticPointCloudEngineProps> = ({
  config,
  scene,
  experienceId,
  isUniversalMode = false,
  lockPosition = true,          // NEW: Default to locking position
  enabled = true,
  onModelLoaded,
  onLoadingProgress,
  onError,
  onReady
}) => {
  // Component-level refs
  const pointCloudRef = useRef<THREE.Points | null>(null);
  const initializationStartedRef = useRef(false);
  const componentIdRef = useRef(Math.random().toString(36).substr(2, 9));
  const positionLockedRef = useRef(false);  // Track if position is locked

  //*** STATE STAET STATE */
const [debugMode, setDebugMode] = useState(false);
  
  // NEW: Capture universal mode ONCE on first render
  const capturedUniversalModeRef = useRef<boolean | null>(null);
  const capturedUserPositionRef = useRef<[number, number] | null>(null);

  // Get geofence context for user position and universal mode detection
  const { userPosition, isUniversalMode: contextUniversalMode } = useGeofenceBasics();
  
  // Capture values ONCE on first render
  if (capturedUniversalModeRef.current === null) {
    capturedUniversalModeRef.current = isUniversalMode || contextUniversalMode;
    capturedUserPositionRef.current = userPosition;
    console.log(`📸 ${config.modelName}: Captured initial state:`, {
      universalMode: capturedUniversalModeRef.current,
      userPosition: capturedUserPositionRef.current
    });
  }

  console.log(`🎯 StaticPointCloudEngine: Component created for ${config.modelName} (ID: ${componentIdRef.current})`);

  // Model loading effect - loads model and applies positioning directly
  useEffect(() => {
    if (initializationStartedRef.current) {
      console.log(`⏭️ ${config.modelName}: Already initialized in this component instance`);
      return;
    }
    initializationStartedRef.current = true;

    let isMounted = true;

    const loadModel = async () => {
      try {
        console.log(`🚀 ${config.modelName}: Starting model acquisition with direct positioning (Component ID: ${componentIdRef.current})`);
        
        // Get CLEAN model from global cache
        const cachedModel = await globalModelCache.getModel(config, onLoadingProgress);
        
        if (!isMounted) {
          console.log(`🚫 ${config.modelName}: Component unmounted during load, releasing model`);
          globalModelCache.releaseModel(config.modelName);
          return;
        }

        // Create NEW point cloud instance from cached geometry/material
        const pointCloud = new THREE.Points(cachedModel.geometry, cachedModel.material);
        pointCloud.name = `${config.modelName}-point-cloud-instance`;

        // Apply model-specific corrections first
        const corrections = cachedModel.modelCorrections;
        pointCloud.position.copy(corrections.centerOffset);
        pointCloud.rotation.copy(corrections.rotationCorrection);

        console.log(`🔧 Applied model corrections:`, {
          centerOffset: corrections.centerOffset.toArray(),
          rotationCorrection: [corrections.rotationCorrection.x, corrections.rotationCorrection.y, corrections.rotationCorrection.z]
        });

        // DIRECT POSITIONING: Get position from positioning system using CAPTURED values
        const finalUniversalMode = capturedUniversalModeRef.current;
        const finalUserPosition = capturedUserPositionRef.current;
        
        console.log(`🎯 Getting position for ${experienceId} using CAPTURED values:`, {
          universalMode: finalUniversalMode,
          userPosition: finalUserPosition
        });

        const positionResult = PositioningSystemSingleton.getExperiencePosition(
          experienceId,
          {
            gpsPosition: finalUserPosition,
            isUniversalMode: finalUniversalMode
          }
        );

        if (positionResult) {
          // Apply final positioning
          pointCloud.position.add(positionResult.relativeToUser);
          
          // Apply rotation adjustments (add to existing rotation)
          pointCloud.rotation.x += positionResult.rotation.x;
          pointCloud.rotation.y += positionResult.rotation.y;
          pointCloud.rotation.z += positionResult.rotation.z;
          
          // Apply scale
          pointCloud.scale.setScalar(positionResult.scale);

          console.log(`✅ ${config.modelName}: Direct positioning applied:`, {
            relativePosition: positionResult.relativeToUser.toArray(),
            rotation: [positionResult.rotation.x, positionResult.rotation.y, positionResult.rotation.z],
            scale: positionResult.scale,
            universalMode: positionResult.isUsingDebugMode,
            distance: positionResult.distanceFromUser?.toFixed(1) + 'm'
          });
        } else {
          console.warn(`⚠️ ${config.modelName}: No position result from positioning system`);
        }

        // Store reference and add to scene
        pointCloudRef.current = pointCloud;
        scene.add(pointCloud);

        // NEW: Lock position after successful positioning
        if (lockPosition) {
          positionLockedRef.current = true;
          console.log(`🔒 ${config.modelName}: Position locked after initial render`);
        }

        console.log(`✅ ${config.modelName}: Instance ready in scene with direct positioning (Component ID: ${componentIdRef.current})`);

        // Notify callbacks
        if (onModelLoaded) onModelLoaded(pointCloud);
        if (onReady) onReady();

      } catch (error) {
        console.error(`❌ ${config.modelName}: Failed to load model:`, error);
        if (onError) onError(`Failed to load ${config.modelName}: ${error}`);
      }
    };

    loadModel();


    // Cleanup function
    return () => {
      console.log(`🧹 ${config.modelName}: Component cleanup (ID: ${componentIdRef.current})`);
      isMounted = false;
      
      // Remove from scene
      if (pointCloudRef.current) {
        scene.remove(pointCloudRef.current);
        console.log(`📤 ${config.modelName}: Removed from scene`);
      }
      
      // Release model reference
      globalModelCache.releaseModel(config.modelName);
      pointCloudRef.current = null;
    };
  }, []); // No dependencies - run once per component lifecycle

  // Add this function inside the component:
const forceReposition = useCallback((currentDebugMode: boolean) => {
  if (!pointCloudRef.current) {
    console.log(`⏭️ ${config.modelName}: Model not ready for forced reposition`);
    return;
  }
  
  const finalUniversalMode = capturedUniversalModeRef.current;
  const finalUserPosition = capturedUserPositionRef.current;
  
  console.log(`🎯 ${config.modelName}: Forcing reposition (debug: ${currentDebugMode})`);
  
  const positionResult = PositioningSystemSingleton.getExperiencePosition(
    experienceId,
    {
      gpsPosition: finalUserPosition,
      isUniversalMode: finalUniversalMode
    },
    {
      useDebugOverride: currentDebugMode // Force debug override
    }
  );

  if (positionResult && pointCloudRef.current) {
    // Reset to model corrections first
    const corrections = globalModelCache.getModelCorrections(config.modelName);
    if (corrections) {
      pointCloudRef.current.position.copy(corrections.centerOffset);
      pointCloudRef.current.rotation.copy(corrections.rotationCorrection);
    }

    // Apply new positioning
    pointCloudRef.current.position.add(positionResult.relativeToUser);
    pointCloudRef.current.rotation.x += positionResult.rotation.x;
    pointCloudRef.current.rotation.y += positionResult.rotation.y;
    pointCloudRef.current.rotation.z += positionResult.rotation.z;
    pointCloudRef.current.scale.setScalar(positionResult.scale);

    console.log(`✅ ${config.modelName}: Forced reposition complete (debug: ${currentDebugMode})`);
  } else {
    console.warn(`⚠️ ${config.modelName}: No position result for forced reposition`);
  }
}, [experienceId, config.modelName]);

  // Add this useEffect after the main loading effect:
useEffect(() => {
  debugModeManager.initialize();
  
  const handleDebugModeChange = (event: CustomEvent) => {
    const newDebugMode = event.detail.enabled;
    const previousDebugMode = debugMode;
    
    setDebugMode(newDebugMode);
    
    // Force reposition if debug mode actually changed and model is ready
    if (previousDebugMode !== newDebugMode && pointCloudRef.current) {
      console.log(`🐛 ${config.modelName}: Debug mode changed ${previousDebugMode} → ${newDebugMode}, forcing reposition`);
      
      // Force repositioning regardless of lock status
      forceReposition(newDebugMode);
    }
  };
  
  debugModeManager.addEventListener('debugModeChanged', handleDebugModeChange as EventListener);
  setDebugMode(debugModeManager.debugMode); // Initialize
  
  return () => {
    debugModeManager.removeEventListener('debugModeChanged', handleDebugModeChange as EventListener);
  };
}, [debugMode, config.modelName]); // Include debugMode in deps to detect changes

  // NEW: Effect to handle position updates (only if not locked)
  useEffect(() => {
    // Skip if position is locked or model not ready
    if (lockPosition && positionLockedRef.current) {
      console.log(`🔒 ${config.modelName}: Position locked, ignoring updates`);
      return;
    }

    if (!pointCloudRef.current) {
      console.log(`⏭️ ${config.modelName}: Model not ready for position updates`);
      return;
    }

    // Only reposition if explicitly allowed
    if (!lockPosition) {
      console.log(`🔄 ${config.modelName}: Updating position (lock disabled)`);
      
      const finalUniversalMode = capturedUniversalModeRef.current || capturedUserPositionRef.current;
      const positionResult = PositioningSystemSingleton.getExperiencePosition(
        experienceId,
        {
          gpsPosition: userPosition,
          isUniversalMode: finalUniversalMode
        }
      );

      if (positionResult && pointCloudRef.current) {
        // Reset to model corrections first
        const corrections = globalModelCache.getModelCorrections(config.modelName);
        if (corrections) {
          pointCloudRef.current.position.copy(corrections.centerOffset);
          pointCloudRef.current.rotation.copy(corrections.rotationCorrection);
        }

        // Apply new positioning
        pointCloudRef.current.position.add(positionResult.relativeToUser);
        pointCloudRef.current.rotation.x += positionResult.rotation.x;
        pointCloudRef.current.rotation.y += positionResult.rotation.y;
        pointCloudRef.current.rotation.z += positionResult.rotation.z;
        pointCloudRef.current.scale.setScalar(positionResult.scale);

        console.log(`🔄 ${config.modelName}: Position updated`);
      }
    }
  }, [userPosition, isUniversalMode, contextUniversalMode, lockPosition, experienceId, config.modelName]);

  // Handle enabled state changes
  useEffect(() => {
    if (pointCloudRef.current) {
      pointCloudRef.current.visible = enabled;
    }
  }, [enabled]);

  return null;
};



export default StaticPointCloudEngine;
export { globalModelCache };