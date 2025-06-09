import React, { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
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

  // ✅ CRITICAL FIX: Get device capabilities once and store in ref (not state)
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
      const currentPos = currentGeom.attributes.position.array as Float32Array;
      const nextPos = nextGeom.attributes.position.array as Float32Array;
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
        const controlY = (currentY + nextY) * 0.5; // ← Keep Y flat
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
      }

      morphedGeom.attributes.position.needsUpdate = true;
    }

    if (mountedRef.current) {
      animationIdRef.current = requestAnimationFrame(animate);
    }
  }, []);

  // ✅ SINGLE EFFECT - Load once, cleanup once
  useEffect(() => {
    if (loadedRef.current) {
      console.log(`⏭️ ${modelPrefix} already loading, skipping duplicate`);
      return;
    }
    
    loadedRef.current = true;
    mountedRef.current = true;

    const loadModels = async () => {
      console.log(`🚀 Loading ${modelPrefix} models...`);

      try {
        const deviceCaps = getDeviceCaps();
        const geometries: THREE.BufferGeometry[] = [];

     // ✅ Define scaling separately
const visualScales = { 
  lily: 10.0,   // Visual size multiplier
  lotus: 10.0,   
  cattail: 10.0 
};

const excursionScales = {
  lily: 1.0,     // Normal animation distance
  lotus: 0.8,    // Smaller movements
  cattail: 1.5   // Larger movements
};

// Load and process 4 stages
for (let stage = 1; stage <= 4; stage++) {
  if (!mountedRef.current) return;

  // Load raw geometry
  const geometry = await loaderRef.current.loadGeometry(modelPrefix, stage, 'high');
  
// Check what the original max values are:
// After loading each stage, check for pink:
const colors = geometry.attributes.color;
if (colors) {
  let maxR = 0, maxG = 0, maxB = 0;
  let foundPink = false;
  
  for (let i = 0; i < colors.count; i++) {
    const r = colors.getX(i);
    const g = colors.getY(i);
    const b = colors.getZ(i);
    
    maxR = Math.max(maxR, r);
    maxG = Math.max(maxG, g);
    maxB = Math.max(maxB, b);
    
    // Look for pink colors (red > green and red > blue)
    if (r > 0.5 && r > g && r > b) {
      console.log(`🌸 Stage ${stage} PINK found: RGB(${r.toFixed(3)}, ${g.toFixed(3)}, ${b.toFixed(3)})`);
      foundPink = true;
      break;
    }
  }
  
  console.log(`🎨 Stage ${stage} color ranges: R(0-${maxR.toFixed(3)}), G(0-${maxG.toFixed(3)}), B(0-${maxB.toFixed(3)})`);
  if (!foundPink) {
    console.log(`❌ Stage ${stage}: No pink colors found`);
  }
}
  
  // Vertex reduction if needed
  const vertexCount = geometry.attributes.position.count;
  if (vertexCount > deviceCaps.maxVertices) {
    console.log(`Reducing vertices: ${vertexCount} → ${deviceCaps.maxVertices}`);
    
    const step = Math.ceil(vertexCount / deviceCaps.maxVertices);
    const oldPos = geometry.attributes.position.array as Float32Array;
    const newPos = new Float32Array(deviceCaps.maxVertices * 3);
    
    for (let i = 0, j = 0; i < vertexCount && j < deviceCaps.maxVertices; i += step, j++) {
      newPos[j * 3] = oldPos[i * 3];
      newPos[j * 3 + 1] = oldPos[i * 3 + 1];
      newPos[j * 3 + 2] = oldPos[i * 3 + 2];
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(newPos, 3));
  }
  
  // ✅ Apply visual scaling to geometry (affects model size only)
  const visualScale = visualScales[modelPrefix] || 100.0;
  geometry.scale(visualScale, visualScale, visualScale);
  
  // Debug scaled size (only for stage 1)
  if (stage === 1) {
    geometry.computeBoundingBox();
    const scaledBox = geometry.boundingBox!;
    console.log(`After ${visualScale}x visual scaling:`, {
      size: {
        x: (scaledBox.max.x - scaledBox.min.x).toFixed(3),
        y: (scaledBox.max.y - scaledBox.min.y).toFixed(3), 
        z: (scaledBox.max.z - scaledBox.min.z).toFixed(3)
      }
    });
  }
  
  geometries.push(geometry);
  
  if (onLoadingProgress) {
    onLoadingProgress((stage / 4) * 100);
  }
}

        if (!mountedRef.current) return;

        geometriesRef.current = geometries;

        // Create group
        const group = new THREE.Group();
        groupRef.current = group;

        // Create point cloud
        const material = new THREE.PointsMaterial({
          size: 1.0,
          sizeAttenuation: false,
           vertexColors: !!geometries[0].attributes.color, // Use vertex colors if available
          transparent: true,
          opacity: 0.8
        });



        if (!geometries[0].attributes.color) {
                const colors = { lily: 0xff69b4, lotus: 0xffc0cb, cattail: 0x8b4513 };
                material.color.setHex(colors[modelPrefix]);
            }

        console.log('🎨 Using vertex colors:', material.vertexColors);
        console.log('🎨 Material color:', material.color.getHex());

        const pointCloud = new THREE.Points(geometries[0].clone(), material);
        pointCloudRef.current = pointCloud;
        group.add(pointCloud);

        // Scale
        // const scales = { lily: 20, lotus: 1, cattail: 1 };//seems to apply to the excursion of the bezier, not size of model
        // group.scale.setScalar(scales[modelPrefix] || 1.0);

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

        console.log(`✅ ${modelPrefix} loaded and animating`);

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
  }, [modelPrefix, scene]); // Only change when these change

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