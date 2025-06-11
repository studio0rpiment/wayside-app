// Configuration flag at the top
const USE_PREPROCESSED_BINARY = true; // Set to true to use .bin files, false for original .ply

import React, { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import { getAssetPath } from '../../utils/assetPaths';
import { getDeviceCapabilities, OptimizedGeometryLoader } from '../../utils/deviceOptimization';

interface OptimizedPointCloudMorphingEngineProps {
  modelPrefix: 'lily' | 'lotus' | 'cattail';
  scene: THREE.Scene;
  isArMode: boolean;
  arPosition?: THREE.Vector3;
  onModelLoaded?: (pointCloud: THREE.Points) => void;
  onLoadingProgress?: (progress: number) => void;
  onError?: (error: string) => void;
  onReadyForReset?: () => void;
}

const OptimizedPointCloudMorphingEngine: React.FC<OptimizedPointCloudMorphingEngineProps> = ({
  modelPrefix,
  scene,
  isArMode,
  arPosition,
  onModelLoaded,
  onLoadingProgress,
  onError,
  onReadyForReset
}) => {
  // Simple refs - no complex state
  const mountedRef = useRef(true);
  const loadedRef = useRef(false);
  const groupRef = useRef<THREE.Group | null>(null);
  const pointCloudRef = useRef<THREE.Points | null>(null);
  const geometriesRef = useRef<THREE.BufferGeometry[]>([]);
  const animationIdRef = useRef<number | null>(null);
  const clockRef = useRef(new THREE.Clock());
  const loaderRef = useRef(new OptimizedGeometryLoader());

  // Get device capabilities once and store in ref
  const deviceCapsRef = useRef<ReturnType<typeof getDeviceCapabilities> | null>(null);
  
  const getDeviceCaps = () => {
    if (!deviceCapsRef.current) {
      try {
        deviceCapsRef.current = getDeviceCapabilities();
      } catch (error) {
        console.warn('Device capabilities failed, using fallback');
        deviceCapsRef.current = {
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
    }
    return deviceCapsRef.current;
  };

  // Sample geometry function (from PointCloudMorphingEngine)
  const sampleGeometry = (geometry: THREE.BufferGeometry, density: number, targetVertexCount?: number): THREE.BufferGeometry => {
    const positions = geometry.attributes.position;
    const colors = geometry.attributes.color;
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
    
    // Sequential sampling for consistency (like PointCloudMorphingEngine)
    const step = totalPoints / sampleCount;
    
    for (let i = 0; i < sampleCount; i++) {
      const idx = Math.floor(i * step);
      
      sampledPositions[i * 3] = positions.getX(idx);
      sampledPositions[i * 3 + 1] = positions.getY(idx);
      sampledPositions[i * 3 + 2] = positions.getZ(idx);
      
      if (colors && sampledColors) {
        sampledColors[i * 3] = colors.getX(idx);
        sampledColors[i * 3 + 1] = colors.getY(idx);
        sampledColors[i * 3 + 2] = colors.getZ(idx);
      }
    }
    
    sampledGeometry.setAttribute('position', new THREE.BufferAttribute(sampledPositions, 3));
    if (sampledColors) {
      sampledGeometry.setAttribute('color', new THREE.BufferAttribute(sampledColors, 3));
    }
    
    return sampledGeometry;
  };

  // Animation loop with Bezier morphing
  const animate = useCallback(() => {
    if (!mountedRef.current || !pointCloudRef.current || geometriesRef.current.length < 4) {
      return;
    }

    const elapsedTime = clockRef.current.getElapsedTime();
    const progress = (elapsedTime % 20) / 20; // 20 second cycle
    const stage = Math.floor(progress * 4);
    const nextStage = (stage + 1) % 4;
    const rawBlend = (progress * 4) - stage;
    
    // Smooth step for organic transitions
    const blend = 0.5 * (1 - Math.cos(Math.PI * rawBlend));

    // Bezier morphing with flowing curves
    const currentGeom = geometriesRef.current[stage];
    const nextGeom = geometriesRef.current[nextStage];
    const morphedGeom = pointCloudRef.current.geometry;

    // Define excursionScales here to access modelPrefix
    const excursionScales = {
      lily: 1.0,
      lotus: 0.8,
      cattail: 1.5
    };
    const excursionScale = excursionScales[modelPrefix] || 1.0;

    if (currentGeom && nextGeom) {
      const positions = morphedGeom.attributes.position.array as Float32Array;
      const colors = morphedGeom.attributes.color; // ✅ Get colors attribute
      const currentPos = currentGeom.attributes.position.array as Float32Array;
      const nextPos = nextGeom.attributes.position.array as Float32Array;
      const currentColors = currentGeom.attributes.color; // ✅ Get current colors
      const nextColors = nextGeom.attributes.color; // ✅ Get next colors
      const vertexCount = Math.min(positions.length / 3, currentPos.length / 3, nextPos.length / 3);

      // Bezier curve interpolation for flowing motion
      for (let i = 0; i < vertexCount; i++) {
        const i3 = i * 3;
        
        const currentX = currentPos[i3];
        const currentY = currentPos[i3 + 1];
        const currentZ = currentPos[i3 + 2];
        
        const nextX = nextPos[i3];
        const nextY = nextPos[i3 + 1];
        const nextZ = nextPos[i3 + 2];
        
        // Create flowing control points
        const controlX = (currentX + nextX) * 0.5;
        const controlY = (currentY + nextY) * 0.5; // Keep Y flat for efficiency
        const controlZ = Math.max(currentZ, nextZ) + (1.0 * excursionScale);
        
        // Particle-specific timing for more organic feel
        const particlePhase = Math.max(0, Math.min(1, (currentY + 5) * 0.02));
        const particleBlend = Math.max(0, Math.min(1, blend + particlePhase - 0.1));
        
        // Smooth particle blend
        const t = 0.5 * (1 - Math.cos(Math.PI * particleBlend));
        const t2 = t * t;
        const t3 = t2 * t;
        const mt = 1 - t;
        const mt2 = mt * mt;
        const mt3 = mt2 * mt;
        
        // Cubic Bezier interpolation for flowing curves
        const morphedX = mt3 * currentX + 3 * mt2 * t * controlX + 3 * mt * t2 * controlX + t3 * nextX;
        const morphedY = mt3 * currentY + 3 * mt2 * t * controlY + 3 * mt * t2 * controlY + t3 * nextY;
        const morphedZ = mt3 * currentZ + 3 * mt2 * t * controlZ + 3 * mt * t2 * controlZ + t3 * nextZ;
        
        positions[i3] = morphedX;
        positions[i3 + 1] = morphedY;
        positions[i3 + 2] = morphedZ;

        // ✅ ADD COLOR INTERPOLATION with proper error checking
        if (colors && currentColors && nextColors) {
          // Validate that all color attributes have the expected vertex count
          if (currentColors.count >= i + 1 && nextColors.count >= i + 1 && colors.count >= i + 1) {
            try {
              const currentR = currentColors.getX(i);
              const currentG = currentColors.getY(i);
              const currentB = currentColors.getZ(i);
              
              const nextR = nextColors.getX(i);
              const nextG = nextColors.getY(i);
              const nextB = nextColors.getZ(i);
              
              // Check for valid color values
              if (!isNaN(currentR) && !isNaN(currentG) && !isNaN(currentB) &&
                  !isNaN(nextR) && !isNaN(nextG) && !isNaN(nextB)) {
                
                const morphedR = currentR + (nextR - currentR) * t;
                const morphedG = currentG + (nextG - currentG) * t;
                const morphedB = currentB + (nextB - currentB) * t;
                
                colors.setXYZ(i, morphedR, morphedG, morphedB);
              }
            } catch (error) {
              // Silently skip this vertex if color interpolation fails
              if (i === 0) {
                console.warn(`⚠️ Color interpolation failed for ${modelPrefix}, vertex ${i}:`, error);
              }
            }
          }
        }
      }

      morphedGeom.attributes.position.needsUpdate = true;
      // ✅ ADD COLOR UPDATE with debugging
      if (colors) {
        colors.needsUpdate = true;
      } else if (USE_PREPROCESSED_BINARY) {
        // Only log once per animation cycle for binary files
        if (stage === 0 && Math.floor(elapsedTime) % 5 === 0) {
          console.warn(`⚠️ No colors available for morphing in binary mode for ${modelPrefix}`);
        }
      }
    }

    if (mountedRef.current) {
      animationIdRef.current = requestAnimationFrame(animate);
    }
  }, [modelPrefix]);

  // Color fallbacks (from PointCloudMorphingEngine)
  const FALLBACK_COLORS = {
    lily: 0xff69b4,    // Hot pink
    lotus: 0xffc0cb,   // Light pink
    cattail: 0x8b4513  // Saddle brown
  };

  // Main loading effect - USING EXACT PointCloudMorphingEngine APPROACH
  useEffect(() => {
    if (loadedRef.current) {
      console.log(`⏭️ ${modelPrefix} already loading, skipping duplicate`);
      return;
    }
    
    loadedRef.current = true;
    mountedRef.current = true;

    const loadModels = async () => {
      console.log(`🚀 Loading ${modelPrefix} models using PointCloudMorphingEngine approach...`);
      console.log(`📦 Using ${USE_PREPROCESSED_BINARY ? 'preprocessed binary' : 'original PLY'} files`);

      try {
        const deviceCaps = getDeviceCaps();
        console.log(`📱 Device capabilities:`, {
          quality: deviceCaps.quality,
          maxVertices: deviceCaps.maxVertices,
          isMobile: deviceCaps.isMobile
        });

        // Create PLYLoader (exact approach from PointCloudMorphingEngine)
        const loader = new PLYLoader();
        let loadedCount = 0;
        const totalModels = 4;
        const geometries: THREE.BufferGeometry[] = [];

        // Define scaling
        const binaryVisualScales = { 
          lily: 20.0,   // Binary file scales
          lotus: 30.0,   
          cattail: 50.0 
        };

        const plyVisualScales = { 
          lily: 0.5,   // PLY file scales
          lotus: 0.5,   
          cattail: 0.5 
        };

        // Load 4 models (EXACT loop structure from PointCloudMorphingEngine)
        for (let i = 1; i <= 4; i++) {
          if (!mountedRef.current) return;

          let geometry: THREE.BufferGeometry;

          if (USE_PREPROCESSED_BINARY) {
            // Use your optimized binary files
            console.log(`📦 Loading ${modelPrefix}_${i} from preprocessed binary`);
            try {
              geometry = await loaderRef.current.loadGeometry(modelPrefix, i, deviceCaps.quality);
              console.log(`✅ Binary loaded: ${geometry.attributes.position.count} vertices`);
            } catch (error) {
              console.warn(`⚠️ Binary loading failed, falling back to PLY:`, error);
              // Fallback to PLY loading
              const modelPath = getAssetPath(`models/raw/${modelPrefix}_${i}.ply`);
              console.log(`📥 Loading ${modelPrefix}_${i}.ply from:`, modelPath);
              
              geometry = await new Promise<THREE.BufferGeometry>((resolve, reject) => {
                loader.load(
                  modelPath,
                  (loadedGeometry) => {
                    console.log(`✅ ${modelPrefix}_${i}.ply loaded successfully!`);
                    resolve(loadedGeometry);
                  },
                  undefined,
                  (error) => {
                    console.error(`❌ Error loading ${modelPrefix}_${i}.ply:`, error);
                    reject(error);
                  }
                );
              });
            }
          } else {
            // Use original PLY files (EXACT approach from PointCloudMorphingEngine)
            const modelPath = getAssetPath(`models/raw/${modelPrefix}_${i}.ply`);
            console.log(`📥 Loading ${modelPrefix}_${i}.ply from:`, modelPath);
            
            geometry = await new Promise<THREE.BufferGeometry>((resolve, reject) => {
              loader.load(
                modelPath,
                (loadedGeometry) => {
                  console.log(`✅ ${modelPrefix}_${i}.ply loaded successfully!`);
                  resolve(loadedGeometry);
                },
                undefined,
                (error) => {
                  console.error(`❌ Error loading ${modelPrefix}_${i}.ply:`, error);
                  reject(error);
                }
              );
            });
          }

          // Apply device-specific optimizations (vertex reduction)
          const originalVertexCount = geometry.attributes.position.count;
          let processedGeometry = geometry;

          // Apply sampling if we have too many vertices
          if (originalVertexCount > deviceCaps.maxVertices) {
            console.log(`🔧 Reducing vertices: ${originalVertexCount} → ${deviceCaps.maxVertices}`);
            
            const density = deviceCaps.maxVertices / originalVertexCount;
            processedGeometry = sampleGeometry(geometry, density);
            
            console.log(`📊 ${modelPrefix}_${i}: ${originalVertexCount} → ${processedGeometry.attributes.position.count} vertices`);
          } else {
            console.log(`📊 ${modelPrefix}_${i}: ${originalVertexCount} vertices (no reduction needed)`);
          }

          // Apply coordinate system transformation if using original PLY
          if (!USE_PREPROCESSED_BINARY) {
            // Blender Z-up to Three.js Y-up conversion
            processedGeometry.rotateX(-Math.PI / 2);
            // Center the geometry
            processedGeometry.center();
          }

          // Apply visual scaling based on file type
          const visualScale = USE_PREPROCESSED_BINARY 
            ? binaryVisualScales[modelPrefix] || 100.0
            : plyVisualScales[modelPrefix] || 100.0;
            
          processedGeometry.scale(visualScale, visualScale, visualScale);

          // Store the processed geometry
          geometries[i - 1] = processedGeometry;
          
          loadedCount++;
          const progress = (loadedCount / totalModels) * 100;
          
          if (onLoadingProgress) {
            onLoadingProgress(progress);
          }
          
          console.log(`📥 ${modelPrefix}_${i}.ply loaded (${progress.toFixed(0)}%) - ${processedGeometry.attributes.position.count} vertices`);
        }

        if (!mountedRef.current) return;

        // When all models are loaded (EXACT approach from PointCloudMorphingEngine)
        console.log(`🎯 All ${modelPrefix} models loaded! Creating morphing point cloud...`);
        
        geometriesRef.current = geometries;

        // Create group
        const group = new THREE.Group();
        groupRef.current = group;

        // Create base geometry and material (EXACT approach from PointCloudMorphingEngine)
        const baseGeometry = geometries[0].clone();
        
        const material = new THREE.PointsMaterial({
          size: 1.0,
          sizeAttenuation: false,
          vertexColors: baseGeometry.attributes.color ? true : false
        });

        if (!baseGeometry.attributes.color) {
          material.color.setHex(FALLBACK_COLORS[modelPrefix]);
          console.log(`⚠️ No vertex colors found, using fallback color for ${modelPrefix}`);
        } else {
          console.log(`✅ Using embedded vertex colors from PLY for ${modelPrefix}`);
        }

        const pointCloud = new THREE.Points(baseGeometry, material);
        pointCloudRef.current = pointCloud;
        group.add(pointCloud);

        // Position
        if (isArMode && arPosition) {
          const useOverride = (window as any).arTestingOverride ?? true;
          group.position.copy(useOverride ? new THREE.Vector3(0, 0, -5) : arPosition);
        } else {
          group.position.set(0, 0, -3);
        }

        scene.add(group);

        // Start animation
        clockRef.current.start();
        animate();

        console.log(`✅ ${modelPrefix} loaded and animating with ${USE_PREPROCESSED_BINARY ? 'binary' : 'PLY'} files`);

        if (onModelLoaded) onModelLoaded(pointCloud);
        if (onReadyForReset) onReadyForReset();

      } catch (error) {
        console.error(`❌ Failed to load ${modelPrefix}:`, error);
        if (onError) onError(`Failed to load ${modelPrefix}: ${error}`);
      }
    };

    loadModels();

    return () => {
      console.log(`🧹 Cleaning up ${modelPrefix}`);
      
      mountedRef.current = false;
      loadedRef.current = false;
      
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
        animationIdRef.current = null;
      }

      geometriesRef.current.forEach(geom => geom.dispose());
      geometriesRef.current = [];

      if (groupRef.current && scene) {
        scene.remove(groupRef.current);
        groupRef.current.traverse((child) => {
          if (child instanceof THREE.Points) {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach(mat => mat.dispose());
              } else {
                child.material.dispose();
              }
            }
          }
        });
        groupRef.current = null;
      }

      loaderRef.current.clearCache();
      
      if ((window as any).gc) {
        (window as any).gc();
      }
    };
  }, [modelPrefix, scene]);

  // Separate effect for position updates
  useEffect(() => {
    if (groupRef.current && isArMode && arPosition) {
      const useOverride = (window as any).arTestingOverride ?? true;
      groupRef.current.position.copy(useOverride ? new THREE.Vector3(0, 0, -5) : arPosition);
    }
  }, [isArMode, arPosition]);

  return null;
};

export default OptimizedPointCloudMorphingEngine;