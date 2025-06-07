// src/components/common/PointCloudMorphingEngine.tsx
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import { getAssetPath } from '../../utils/assetPaths';

interface PointCloudMorphingEngineProps {
 modelPrefix: 'lily' | 'lotus' | 'cattail';
 scene: THREE.Scene;
 boundingBoxData: any; // The seasons-boxdimensions.json data
 isArMode: boolean;
 arPosition?: THREE.Vector3;
 onModelLoaded?: (pointCloud: THREE.Points) => void;
 onLoadingProgress?: (progress: number) => void;
 onError?: (error: string) => void;
 onReadyForReset?: () => void; // New callback for when reset should be triggered
}

const PointCloudMorphingEngine: React.FC<PointCloudMorphingEngineProps> = ({
 modelPrefix,
 scene,
 boundingBoxData,
 isArMode,
 arPosition,
 onModelLoaded,
 onLoadingProgress,
 onError,
 onReadyForReset
}) => {

//  console.log('🔍 PointCloudMorphingEngine received modelPrefix:', modelPrefix);

 const morphingPointCloudRef = useRef<THREE.Points | null>(null);
 const morphingGroupRef = useRef<THREE.Group | null>(null);
 const geometriesRef = useRef<THREE.BufferGeometry[]>([]);
 const originalGeometriesRef = useRef<THREE.BufferGeometry[]>([]);
 const clockRef = useRef(new THREE.Clock());
 const animationIdRef = useRef<number | null>(null);

 // Animation settings (hardcoded as requested)
 const ANIMATION_SPEED = 0.5;
 const SMOOTHING_FACTOR = 1;
 const CYCLE_TIME = 20; // 20 seconds total cycle
 const POINT_DENSITY = 1.0; // Full density

 // Color fallbacks
 const FALLBACK_COLORS = {
   lily: 0xff69b4,    // Hot pink
   lotus: 0xffc0cb,   // Light pink
   cattail: 0x8b4513  // Saddle brown
 };

 // Smoothing function from HTML
 const smoothTransition = (t: number): number => {
   if (t <= 0) return 0;
   if (t >= 1) return 1;
   
   const smoothed = 0.5 * (1 - Math.cos(Math.PI * t));
   return t + (smoothed - t) * SMOOTHING_FACTOR;
 };

 // Sample geometry function
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
   
   // Sequential sampling for consistency
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

 // Calculate cross-experience normalization scale (same size across all experiences)
 const calculateCrossExperienceScale = () => {
   // Find the largest dimension across ALL experiences for consistent sizing
   let globalMaxDim = 0;
   
   const allExperiences = ['lily', 'lotus', 'cattail'];
   allExperiences.forEach(experience => {
     for (let i = 1; i <= 4; i++) {
       const stageKey = `${experience}_${i}`;
       const stageBoxData = boundingBoxData[stageKey];
       if (stageBoxData) {
         const stageDim = Math.max(
           Math.abs(stageBoxData.box_dimensions.X),
           Math.abs(stageBoxData.box_dimensions.Y),
           Math.abs(stageBoxData.box_dimensions.Z)
         );
         globalMaxDim = Math.max(globalMaxDim, stageDim);
       }
     }
   });
   
   return globalMaxDim > 0 ? (isArMode ? 4 : 6) / globalMaxDim : 1;
 };

 // Apply per-stage scaling and centering to normalize visual size within the experience
 const applyPerStageScaling = (geometry: THREE.BufferGeometry, stageIndex: number): THREE.BufferGeometry => {
   const stageKey = `${modelPrefix}_${stageIndex + 1}`;
   const stageBoxData = boundingBoxData[stageKey];
   
   if (!stageBoxData) return geometry;
   
   // Center the geometry first to fix rotation pivot
   const centeredGeometry = geometry.clone();
   centeredGeometry.center(); // This centers all vertices around (0,0,0)
//    console.log(`📐 ${modelPrefix}_${stageIndex + 1}: geometry centered around origin`);
   
   // Find this stage's dimension
   const stageDim = Math.max(
     Math.abs(stageBoxData.box_dimensions.X),
     Math.abs(stageBoxData.box_dimensions.Y),
     Math.abs(stageBoxData.box_dimensions.Z)
   );
   
   // Find the target dimension (largest stage in this experience)
   let targetDim = 0;
   for (let i = 1; i <= 4; i++) {
     const targetKey = `${modelPrefix}_${i}`;
     const targetBoxData = boundingBoxData[targetKey];
     if (targetBoxData) {
       const targetStageDim = Math.max(
         Math.abs(targetBoxData.box_dimensions.X),
         Math.abs(targetBoxData.box_dimensions.Y),
         Math.abs(targetBoxData.box_dimensions.Z)
       );
       targetDim = Math.max(targetDim, targetStageDim);
     }
   }
   
   if (stageDim <= 0 || targetDim <= 0) return centeredGeometry; // Return centered geometry
   
   // Scale this stage to match the target size
   const stageScale = targetDim / stageDim;
   
   if (Math.abs(stageScale - 1.0) < 0.001) return centeredGeometry; // No scaling needed
   
//    console.log(`📏 ${modelPrefix}_${stageIndex + 1}: scaling centered geometry by ${stageScale.toFixed(3)} (${stageDim.toFixed(2)} → ${targetDim.toFixed(2)})`);
   
   // Apply scaling to the already-centered geometry
   const positions = centeredGeometry.attributes.position;
   
//    console.log(`📐 ${modelPrefix}_${stageIndex + 1}: applying scaling only (${stageScale.toFixed(3)}x)`);
   
   for (let i = 0; i < positions.count; i++) {
     // Apply ONLY scaling - models are already well-aligned and now centered
     const scaledX = positions.getX(i) * stageScale;
     const scaledY = positions.getY(i) * stageScale;
     const scaledZ = positions.getZ(i) * stageScale;
     
     positions.setXYZ(i, scaledX, scaledY, scaledZ);
   }
   
   positions.needsUpdate = true;
   return centeredGeometry; // Return the centered and scaled geometry
 };

 // Get stage from progress (copied from HTML)
 const getStageFromProgress = (progress: number) => {
   progress = Math.max(0, Math.min(1, progress));
   
   const thresholds = [0, 0.25, 0.5, 0.75, 1.0];
   
   // Handle wrap-around transition (stage 4 → 1)
   if (progress >= 0.75) {
     const rawProgress = (progress - 0.75) / 0.25;
     const smoothedProgress = smoothTransition(rawProgress);
     return {
       currentStage: 3,
       nextStage: 0,
       blendFactor: smoothedProgress
     };
   }
   
   // Handle stages 1→2, 2→3, 3→4 transitions
   for (let i = 0; i < 3; i++) {
     if (progress >= thresholds[i] && progress < thresholds[i + 1]) {
       const rawProgress = (progress - thresholds[i]) / (thresholds[i + 1] - thresholds[i]);
       const smoothedProgress = smoothTransition(rawProgress);
       return {
         currentStage: i,
         nextStage: i + 1,
         blendFactor: smoothedProgress
       };
     }
   }
   
   return { currentStage: 0, nextStage: 1, blendFactor: 0 };
 };

 // Bezier flow transition (adapted for variable vertex counts)
 const applyBezierFlow = (currentStageIndex: number, nextStageIndex: number, blendFactor: number) => {
   const currentGeometry = geometriesRef.current[currentStageIndex];
   const nextGeometry = geometriesRef.current[nextStageIndex];
   
   if (!currentGeometry || !nextGeometry || !morphingPointCloudRef.current) return;
   
   const morphedGeometry = morphingPointCloudRef.current.geometry;
   const positions = morphedGeometry.attributes.position;
   const colors = morphedGeometry.attributes.color;
   
   const currentPositions = currentGeometry.attributes.position;
   const nextPositions = nextGeometry.attributes.position;
   const currentColors = currentGeometry.attributes.color;
   const nextColors = nextGeometry.attributes.color;
   
   // Use the minimum vertex count for safe morphing
   const vertexCount = Math.min(currentPositions.count, nextPositions.count, positions.count);
   
   for (let i = 0; i < vertexCount; i++) {
     const currentX = currentPositions.getX(i);
     const currentY = currentPositions.getY(i);
     const currentZ = currentPositions.getZ(i);
     
     const nextX = nextPositions.getX(i);
     const nextY = nextPositions.getY(i);
     const nextZ = nextPositions.getZ(i);
     
     // Control point calculation
     const controlX = (currentX + nextX) / 2;
     const controlY = Math.max(currentY, nextY) + 2;
     const controlZ = (currentZ + nextZ) / 2;
     
     // Particle phase offset for wave progression
     const currentHeight = currentY;
     const heightNormalized = Math.max(0, Math.min(1, (currentHeight + 5) / 10));
     const particlePhase = heightNormalized * 0.4;
     
     const rawParticleBlend = Math.max(0, Math.min(1, blendFactor + particlePhase - 0.2));
     const particleBlendFactor = smoothTransition(rawParticleBlend);
     
     // Cubic Bezier interpolation
     const t = particleBlendFactor;
     const t2 = t * t;
     const t3 = t2 * t;
     const mt = 1 - t;
     const mt2 = mt * mt;
     const mt3 = mt2 * mt;
     
     const morphedX = mt3 * currentX + 3 * mt2 * t * controlX + 3 * mt * t2 * controlX + t3 * nextX;
     const morphedY = mt3 * currentY + 3 * mt2 * t * controlY + 3 * mt * t2 * controlY + t3 * nextY;
     const morphedZ = mt3 * currentZ + 3 * mt2 * t * controlZ + 3 * mt * t2 * controlZ + t3 * nextZ;
     
     positions.setXYZ(i, morphedX, morphedY, morphedZ);
     
     // Color interpolation
     if (colors && currentColors && nextColors) {
       const currentR = currentColors.getX(i);
       const currentG = currentColors.getY(i);
       const currentB = currentColors.getZ(i);
       
       const nextR = nextColors.getX(i);
       const nextG = nextColors.getY(i);
       const nextB = nextColors.getZ(i);
       
       const morphedR = currentR + (nextR - currentR) * particleBlendFactor;
       const morphedG = currentG + (nextG - currentG) * particleBlendFactor;
       const morphedB = currentB + (nextB - currentB) * particleBlendFactor;
       
       colors.setXYZ(i, morphedR, morphedG, morphedB);
     }
   }
   
   positions.needsUpdate = true;
   if (colors) colors.needsUpdate = true;
 };

 // Create morphing point cloud with THREE.Group container
 const createMorphingPointCloud = () => {
//    console.log(`🏗️ Creating morphing point cloud for ${modelPrefix}`);
   
   if (geometriesRef.current.length === 0 || !geometriesRef.current[0]) {
     console.error('❌ No geometries loaded for morphing point cloud');
     return;
   }
   
//    console.log(`✅ ${geometriesRef.current.length} geometries available for ${modelPrefix}`);
   
   // Create a THREE.Group to contain the morphing point cloud
   const morphingGroup = new THREE.Group();
   morphingGroupRef.current = morphingGroup;
   
   const baseGeometry = geometriesRef.current[0].clone();
   
   const material = new THREE.PointsMaterial({
     size: 1.0,
     sizeAttenuation: false,
     vertexColors: baseGeometry.attributes.color ? true : false
   });

   if (!baseGeometry.attributes.color) {
     material.color.setHex(FALLBACK_COLORS[modelPrefix]);
   }

   const pointCloud = new THREE.Points(baseGeometry, material);
   morphingPointCloudRef.current = pointCloud;
   
   // Apply coordinate system rotation (Blender Z-up to Three.js Y-up) to the point cloud
   pointCloud.rotation.x = -Math.PI / 2;

   // Add point cloud to the group (at group origin - no individual positioning)
   morphingGroup.add(pointCloud);
   
   // Apply cross-experience scaling to the GROUP
   const crossExperienceScale = calculateCrossExperienceScale();
   
   // Experience-specific scale multipliers
   const experienceScaleMultipliers: Record<string, number> = {
     'lily': 1.4,     // Base size
     'lotus': 0.8,    // 20% smaller
     'cattail': 2.5   // 20% larger
   };
   
   const experienceScale = experienceScaleMultipliers[modelPrefix] || 1.0;
   const finalScale = crossExperienceScale * experienceScale;
   
   morphingGroup.scale.set(finalScale, finalScale, finalScale);
//    console.log(`🎯 ${modelPrefix} final scale: ${crossExperienceScale.toFixed(3)} × ${experienceScale} = ${finalScale.toFixed(3)}`);
   
   // Position the GROUP based on mode (not individual point cloud)
   if (isArMode && arPosition) {
     const currentOverride = (window as any).arTestingOverride ?? true;
     
     if (currentOverride) {
       morphingGroup.position.set(0, 0, -5);
    //    console.log(`🎯 ${modelPrefix} group positioned at override location`);
     } else {
       morphingGroup.position.copy(arPosition);
    //    console.log(`🎯 ${modelPrefix} group positioned at AR anchor location`);
     }
   } else {
     morphingGroup.position.set(0, 0, -3);
    //  console.log(`🎯 ${modelPrefix} group positioned at standalone location`);
   }
   
   // Add group to scene
   scene.add(morphingGroup);
   
   if (onModelLoaded) {
     onModelLoaded(pointCloud); // Still pass the point cloud for external access
   }
   
//    console.log(`✅ ${modelPrefix} morphing point cloud created in THREE.Group`);
   
   // Trigger reset callback after a small delay to ensure parent handlers are registered
   setTimeout(() => {
     if (onReadyForReset) {
    //    console.log(`🔄 Triggering ready-for-reset callback for ${modelPrefix}`);
       onReadyForReset();
     }
   }, 200);
 };

 // Animation loop
 const animate = () => {
   if (!morphingPointCloudRef.current) return;
   
   const elapsedTime = clockRef.current.getElapsedTime();
   const progress = (elapsedTime % CYCLE_TIME) / CYCLE_TIME;
   
   const stageInfo = getStageFromProgress(progress);
   
   applyBezierFlow(stageInfo.currentStage, stageInfo.nextStage, stageInfo.blendFactor);
   
   animationIdRef.current = requestAnimationFrame(animate);
 };

 // Load all PLY models
 useEffect(() => {
//    console.log(`🚀 PointCloudMorphingEngine starting for ${modelPrefix}`);
//    console.log(`📦 Scene available:`, !!scene);
//    console.log(`📦 BoundingBox data available:`, !!boundingBoxData);
   
   const loader = new PLYLoader();
   let loadedCount = 0;
   const totalModels = 4;
   
   // Load 4 models
   for (let i = 1; i <= 4; i++) {
     const modelPath = getAssetPath(`models/${modelPrefix}_${i}.ply`);
    //  console.log(`📥 Loading ${modelPrefix}_${i}.ply from:`, modelPath);
     
     loader.load(
       modelPath,
       (geometry) => {
        //  console.log(`✅ ${modelPrefix}_${i}.ply loaded successfully!`);
         const index = i - 1;
         
         // Store original geometry
         originalGeometriesRef.current[index] = geometry.clone();
         
         // Apply density sampling and per-stage size normalization
         const sampledGeometry = sampleGeometry(geometry, POINT_DENSITY);
        //  console.log(`📊 ${modelPrefix}_${i}: ${geometry.attributes.position.count} → ${sampledGeometry.attributes.position.count} vertices`);
         
         const normalizedGeometry = applyPerStageScaling(sampledGeometry, index);
         geometriesRef.current[index] = normalizedGeometry;
         
         loadedCount++;
         const progress = (loadedCount / totalModels) * 100;
         
         if (onLoadingProgress) {
           onLoadingProgress(progress);
         }
         
        //  console.log(`📥 ${modelPrefix}_${i}.ply loaded (${progress.toFixed(0)}%) - ${sampledGeometry.attributes.position.count} vertices`);
         
         // When all models are loaded
         if (loadedCount === totalModels) {
        //    console.log(`🎯 All ${modelPrefix} models loaded! Creating morphing point cloud...`);
           // Skip vertex normalization - keep native vertex counts
           createMorphingPointCloud();
           
           // Start animation
           clockRef.current.start();
        //    console.log(`🎬 Starting ${modelPrefix} animation loop`);
           animate();
         }
       },
       (xhr) => {
         const percent = (xhr.loaded / xhr.total) * 100;
        //  console.log(`📥 ${modelPrefix}_${i}.ply loading: ${percent.toFixed(1)}%`);
       },
       (error) => {
         console.error(`❌ Error loading ${modelPrefix}_${i}.ply:`, error);
         console.error(`❌ Path attempted:`, modelPath);
         if (onError) {
           onError(`Failed to load ${modelPrefix}_${i}.ply`);
         }
       }
     );
   }
   
   // Cleanup
   return () => {
     if (animationIdRef.current) {
       cancelAnimationFrame(animationIdRef.current);
     }
     
     // Dispose geometries
     geometriesRef.current.forEach(geometry => geometry?.dispose());
     originalGeometriesRef.current.forEach(geometry => geometry?.dispose());
     
     // Remove from scene
     if (morphingGroupRef.current && scene) {
       scene.remove(morphingGroupRef.current);
       
       if (morphingPointCloudRef.current && morphingPointCloudRef.current.material) {
         if (Array.isArray(morphingPointCloudRef.current.material)) {
           morphingPointCloudRef.current.material.forEach(material => material.dispose());
         } else {
           morphingPointCloudRef.current.material.dispose();
         }
       }
     }
   };
 }, [modelPrefix, scene, boundingBoxData, isArMode, arPosition]);

 return null; // This component doesn't render anything itself
};

export default PointCloudMorphingEngine;