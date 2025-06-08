// src/components/common/OptimizedPointCloudMorphingEngine.tsx
import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { 
  getDeviceCapabilities, 
  PerformanceMonitor, 
  AdaptiveQualityManager,
  OptimizedGeometryLoader 
} from '../../utils/deviceOptimization';

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
  // Device capabilities and quality management
  const [deviceCaps, setDeviceCaps] = useState<any>(null);
  const [currentQuality, setCurrentQuality] = useState<string>('mobile');
  
  // Core references
  const morphingPointCloudRef = useRef<THREE.Points | null>(null);
  const morphingGroupRef = useRef<THREE.Group | null>(null);
  const geometriesRef = useRef<THREE.BufferGeometry[]>([]);
  const clockRef = useRef(new THREE.Clock());
  const animationIdRef = useRef<number | null>(null);
  const geometryLoaderRef = useRef(new OptimizedGeometryLoader());
  
  // Performance optimization
  const frameCountRef = useRef(0);
  const performanceMonitorRef = useRef<PerformanceMonitor | undefined>(undefined);
  const qualityManagerRef = useRef<AdaptiveQualityManager | undefined>(undefined);
  
  // Initialize device capabilities
  useEffect(() => {
    const initDeviceCaps = async () => {
      try {
        const caps = await getDeviceCapabilities();
        setDeviceCaps(caps);
        setCurrentQuality(caps.quality);
        console.log(`🎯 Device capabilities detected: ${caps.quality} (${caps.maxVertices} vertices)`);
      } catch (error) {
        console.warn('⚠️ Failed to get device capabilities, using fallback:', error);
        // Fallback device capabilities
        setDeviceCaps({
          quality: 'mobile',
          isMobile: true,
          isLowEnd: false,
          maxVertices: 8000,
          shouldReduceFrameRate: true,
          maxPixelRatio: 1.5
        });
        setCurrentQuality('mobile');
      }
    };
    
    initDeviceCaps();
  }, []);
  
  // Animation settings - adaptive based on device
  const CYCLE_TIME = 20;
  const getUpdateFrequency = () => {
    if (!deviceCaps) return 2;
    if (deviceCaps.shouldReduceFrameRate) {
      return currentQuality === 'lowEnd' ? 4 : 3; // Every 4th or 3rd frame
    }
    return 1; // Every frame
  };
  
  // Fallback colors
  const FALLBACK_COLORS = {
    lily: 0xff69b4,
    lotus: 0xffc0cb,
    cattail: 0x8b4513
  };

  // Optimized smoothing function
  const smoothTransition = (t: number): number => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return 0.5 * (1 - Math.cos(Math.PI * t));
  };

  // Stage progression logic
  const getStageFromProgress = (progress: number) => {
    progress = Math.max(0, Math.min(1, progress));
    const thresholds = [0, 0.25, 0.5, 0.75, 1.0];
    
    if (progress >= 0.75) {
      const rawProgress = (progress - 0.75) / 0.25;
      return {
        currentStage: 3,
        nextStage: 0,
        blendFactor: smoothTransition(rawProgress)
      };
    }
    
    for (let i = 0; i < 3; i++) {
      if (progress >= thresholds[i] && progress < thresholds[i + 1]) {
        const rawProgress = (progress - thresholds[i]) / (thresholds[i + 1] - thresholds[i]);
        return {
          currentStage: i,
          nextStage: i + 1,
          blendFactor: smoothTransition(rawProgress)
        };
      }
    }
    
    return { currentStage: 0, nextStage: 1, blendFactor: 0 };
  };

  // Highly optimized Bezier flow for mobile performance
  const applyOptimizedBezierFlow = (currentStage: number, nextStage: number, blendFactor: number) => {
    const currentGeometry = geometriesRef.current[currentStage];
    const nextGeometry = geometriesRef.current[nextStage];
    
    if (!currentGeometry || !nextGeometry || !morphingPointCloudRef.current) return;
    
    const morphedGeometry = morphingPointCloudRef.current.geometry;
    const positions = morphedGeometry.attributes.position;
    const colors = morphedGeometry.attributes.color;
    
    const currentPositions = currentGeometry.attributes.position;
    const nextPositions = nextGeometry.attributes.position;
    const currentColors = currentGeometry.attributes.color;
    const nextColors = nextGeometry.attributes.color;
    
    const vertexCount = Math.min(currentPositions.count, nextPositions.count, positions.count);
    
    // Pre-calculate common Bezier coefficients (major optimization)
    const t = smoothTransition(blendFactor);
    const t2 = t * t;
    const t3 = t2 * t;
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;
    
    // Use typed arrays for better performance
    const posArray = positions.array as Float32Array;
    const currentArray = currentPositions.array as Float32Array;
    const nextArray = nextPositions.array as Float32Array;
    
    // Vectorized loop with optimized calculations
    for (let i = 0; i < vertexCount; i++) {
      const i3 = i * 3;
      
      // Direct array access (faster than getX/Y/Z)
      const currentX = currentArray[i3];
      const currentY = currentArray[i3 + 1];
      const currentZ = currentArray[i3 + 2];
      
      const nextX = nextArray[i3];
      const nextY = nextArray[i3 + 1];
      const nextZ = nextArray[i3 + 2];
      
      // Simplified control points (reduced computation)
      const controlX = (currentX + nextX) * 0.5;
      const controlY = Math.max(currentY, nextY) + 1.0; // Reduced height for performance
      const controlZ = (currentZ + nextZ) * 0.5;
      
      // Optimized particle phase calculation
      const particlePhase = Math.max(0, Math.min(1, (currentY + 5) * 0.02));
      const particleBlend = Math.max(0, Math.min(1, blendFactor + particlePhase - 0.1));
      
      // Pre-calculated particle Bezier coefficients
      const pt = smoothTransition(particleBlend);
      const pt2 = pt * pt;
      const pt3 = pt2 * pt;
      const pmt = 1 - pt;
      const pmt2 = pmt * pmt;
      const pmt3 = pmt2 * pmt;
      
      // Optimized Bezier interpolation
      const morphedX = pmt3 * currentX + 3 * pmt2 * pt * controlX + 3 * pmt * pt2 * controlX + pt3 * nextX;
      const morphedY = pmt3 * currentY + 3 * pmt2 * pt * controlY + 3 * pmt * pt2 * controlY + pt3 * nextY;
      const morphedZ = pmt3 * currentZ + 3 * pmt2 * pt * controlZ + 3 * pmt * pt2 * controlZ + pt3 * nextZ;
      
      // Direct array assignment (fastest method)
      posArray[i3] = morphedX;
      posArray[i3 + 1] = morphedY;
      posArray[i3 + 2] = morphedZ;
      
      // Color interpolation (simplified for performance)
      if (colors && currentColors && nextColors) {
        const colorArray = colors.array as Float32Array;
        const currentColorArray = currentColors.array as Float32Array;
        const nextColorArray = nextColors.array as Float32Array;
        
        colorArray[i3] = currentColorArray[i3] + (nextColorArray[i3] - currentColorArray[i3]) * pt;
        colorArray[i3 + 1] = currentColorArray[i3 + 1] + (nextColorArray[i3 + 1] - currentColorArray[i3 + 1]) * pt;
        colorArray[i3 + 2] = currentColorArray[i3 + 2] + (nextColorArray[i3 + 2] - currentColorArray[i3 + 2]) * pt;
      }
    }
    
    positions.needsUpdate = true;
    if (colors) colors.needsUpdate = true;
  };

  // Adaptive animation loop with performance monitoring
  const animate = () => {
    if (!morphingPointCloudRef.current) return;
    
    frameCountRef.current++;
    const updateFrequency = getUpdateFrequency();
    
    // Frame skipping for mobile performance
    const shouldUpdate = frameCountRef.current % updateFrequency === 0;
    
    if (shouldUpdate) {
      const elapsedTime = clockRef.current.getElapsedTime();
      const progress = (elapsedTime % CYCLE_TIME) / CYCLE_TIME;
      const stageInfo = getStageFromProgress(progress);
      
      applyOptimizedBezierFlow(stageInfo.currentStage, stageInfo.nextStage, stageInfo.blendFactor);
    }
    
    animationIdRef.current = requestAnimationFrame(animate);
  };

  // Create optimized point cloud
  const createMorphingPointCloud = () => {
    if (geometriesRef.current.length === 0 || !geometriesRef.current[0] || !deviceCaps) {
      console.error('❌ No geometries loaded for morphing point cloud or device caps not ready');
      return;
    }
    
    console.log(`✅ Creating ${currentQuality} quality point cloud for ${modelPrefix}`);
    
    // Create group container
    const morphingGroup = new THREE.Group();
    morphingGroupRef.current = morphingGroup;
    
    const baseGeometry = geometriesRef.current[0].clone();
    
    // Optimized material based on device capabilities
    const material = new THREE.PointsMaterial({
      size: deviceCaps.isMobile ? 1.5 : 1.0, // Larger points on mobile for fewer vertices
      sizeAttenuation: !deviceCaps.isMobile, // Disable on mobile for performance
      vertexColors: baseGeometry.attributes.color ? true : false,
      transparent: !deviceCaps.isLowEnd, // Disable transparency on low-end devices
      opacity: deviceCaps.isLowEnd ? 1.0 : 0.8
    });

    if (!baseGeometry.attributes.color) {
      material.color.setHex(FALLBACK_COLORS[modelPrefix]);
    }

    const pointCloud = new THREE.Points(baseGeometry, material);
    morphingPointCloudRef.current = pointCloud;
    
    // No rotation needed - models are pre-normalized
    morphingGroup.add(pointCloud);
    
    // Experience-specific scale multipliers (pre-calculated)
    const experienceScales = {
      'lily': 1.4,
      'lotus': 0.8,
      'cattail': 2.5
    };
    
    const finalScale = experienceScales[modelPrefix] || 1.0;
    morphingGroup.scale.set(finalScale, finalScale, finalScale);
    
    // Position based on mode
    if (isArMode && arPosition) {
      const currentOverride = (window as any).arTestingOverride ?? true;
      
      if (currentOverride) {
        morphingGroup.position.set(0, 0, -5);
      } else {
        morphingGroup.position.copy(arPosition);
      }
    } else {
      morphingGroup.position.set(0, 0, -3);
    }
    
    scene.add(morphingGroup);
    
    if (onModelLoaded) {
      onModelLoaded(pointCloud);
    }
    
    console.log(`🎯 ${modelPrefix} point cloud created (${baseGeometry.attributes.position.count} vertices)`);
    
    // Trigger reset callback
    setTimeout(() => {
      if (onReadyForReset) {
        onReadyForReset();
      }
    }, 200);
  };

  // Load optimized models
  const loadOptimizedModels = async () => {
    if (!deviceCaps) {
      console.log('⏳ Waiting for device capabilities...');
      return;
    }
    
    console.log(`🚀 Loading ${currentQuality} quality models for ${modelPrefix}`);
    
    const startTime = performance.now();
    let loadedCount = 0;
    
    try {
      for (let stage = 1; stage <= 4; stage++) {
        const geometry = await geometryLoaderRef.current.loadGeometry(
          modelPrefix, 
          stage, 
          currentQuality
        );
        
        geometriesRef.current[stage - 1] = geometry;
        loadedCount++;
        
        if (onLoadingProgress) {
          onLoadingProgress((loadedCount / 4) * 100);
        }
        
        console.log(`📥 Loaded ${modelPrefix}_${stage}_${currentQuality}: ${geometry.attributes.position.count} vertices`);
      }
      
      const loadTime = performance.now() - startTime;
      console.log(`⚡ Models loaded in ${loadTime.toFixed(1)}ms`);
      
      // Create point cloud and start animation
      createMorphingPointCloud();
      clockRef.current.start();
      animate();
      
    } catch (error) {
      console.error(`❌ Failed to load ${modelPrefix} models:`, error);
      if (onError) {
        onError(`Failed to load ${modelPrefix} models: ${error}`);
      }
      
      // Try fallback quality
      if (currentQuality !== 'lowEnd') {
        console.log('🔄 Attempting fallback to lower quality...');
        setCurrentQuality('lowEnd');
      }
    }
  };

  // Handle quality changes
  const handleQualityChange = async (newQuality: string) => {
    if (newQuality === currentQuality) return;
    
    console.log(`🔄 Quality change: ${currentQuality} → ${newQuality}`);
    
    // Stop current animation
    if (animationIdRef.current) {
      cancelAnimationFrame(animationIdRef.current);
    }
    
    // Clean up current geometries
    geometriesRef.current.forEach(geometry => geometry?.dispose());
    geometriesRef.current = [];
    
    // Remove current point cloud
    if (morphingGroupRef.current && scene) {
      scene.remove(morphingGroupRef.current);
      morphingGroupRef.current = null;
      morphingPointCloudRef.current = null;
    }
    
    // Update quality and reload
    setCurrentQuality(newQuality as any);
  };

  // Initialize performance monitoring
  useEffect(() => {
    if (!deviceCaps) return;
    
    try {
      performanceMonitorRef.current = new PerformanceMonitor();
      qualityManagerRef.current = new AdaptiveQualityManager(currentQuality as any);
      
      qualityManagerRef.current.onQualityChanged(handleQualityChange);
    } catch (error) {
      console.warn('⚠️ Performance monitoring failed to initialize:', error);
    }
    
    return () => {
      // Cleanup performance monitoring
      performanceMonitorRef.current = undefined;
      qualityManagerRef.current = undefined;
    };
  }, [deviceCaps, currentQuality]);

  // Main loading effect - wait for device capabilities
  useEffect(() => {
    if (!deviceCaps) return;
    
    loadOptimizedModels();
    
    return () => {
      // Cleanup animation
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      
      // Dispose geometries
      geometriesRef.current.forEach(geometry => geometry?.dispose());
      
      // Remove from scene
      if (morphingGroupRef.current && scene) {
        scene.remove(morphingGroupRef.current);
        
        if (morphingPointCloudRef.current?.material) {
          if (Array.isArray(morphingPointCloudRef.current.material)) {
            morphingPointCloudRef.current.material.forEach(material => material.dispose());
          } else {
            morphingPointCloudRef.current.material.dispose();
          }
        }
      }
      
      // Clear geometry cache
      geometryLoaderRef.current.clearCache();
    };
  }, [modelPrefix, scene, isArMode, arPosition, currentQuality, deviceCaps]);

  return null; // This component doesn't render anything itself
};

export default OptimizedPointCloudMorphingEngine;