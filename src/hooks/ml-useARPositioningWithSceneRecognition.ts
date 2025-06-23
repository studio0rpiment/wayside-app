// src/hooks/useARPositioning.ts - Enhanced with Scene Recognition
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import { WorldCoordinateSystem } from '../utils/coordinate-system/WorldCoordinateSystem';
import { AnchorManager } from '../utils/coordinate-system/AnchorManager';
import { ARPositioningManager, ExperiencePositionResult, PositioningOptions } from '../utils/coordinate-system/ARPositioningManager';
import { useGeofenceContext } from '../context/GeofenceContext';
import { useSceneRecognition, SceneRecognitionResult } from './ml-useSceneRecognition';

export interface EnhancedARPositioningHookResult {
  // Original methods
  positionObject: (object: THREE.Object3D, experienceId: string, options?: PositioningOptions) => boolean;
  getPosition: (experienceId: string, options?: PositioningOptions) => ExperiencePositionResult | null;
  
  // Enhanced methods with scene recognition
  positionObjectWithSceneRecognition: (
    object: THREE.Object3D, 
    experienceId: string, 
    videoElement?: HTMLVideoElement,
    options?: PositioningOptions
  ) => Promise<boolean>;
  
  // Convenience methods
  getWorldPosition: (experienceId: string) => THREE.Vector3 | null;
  getRelativePosition: (experienceId: string) => THREE.Vector3 | null;
  
  // Elevation adjustment
  adjustGlobalElevation: (delta: number) => void;
  setGlobalElevation: (offset: number) => void;
  getCurrentElevationOffset: () => number;
  
  // Reset methods
  resetPosition: (experienceId: string) => void;
  resetAllAdjustments: () => void;
  
  // State
  isReady: boolean;
  userPosition: [number, number] | null;
  debugMode: boolean;
  
  // Scene recognition state
  sceneRecognition: {
    isLoaded: boolean;
    isLoading: boolean;
    lastPrediction: SceneRecognitionResult | null;
    error: string | null;
    stats: {
      totalPredictions: number;
      averageInferenceTime: number;
      lastInferenceTime: number;
    };
  };
  
  // Debug info
  getDebugInfo: (experienceId?: string) => any;
}

/**
 * Enhanced AR positioning hook with scene recognition capabilities
 * Maintains all existing functionality while adding ML-based position refinement
 */
export function useARPositioning(): EnhancedARPositioningHookResult {
  
  // Get user position from enhanced geofence context
  const {
    userPosition: rawUserPosition,
    averagedPosition: preciseUserPosition,
    currentAccuracy,
    positionQuality,
    isPositionStable
  } = useGeofenceContext();

  // State for hook
  const [isReady, setIsReady] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  
  // Scene recognition hook
  const {
    recognizeScene,
    isLoaded: isSceneRecognitionLoaded,
    isLoading: isSceneRecognitionLoading,
    lastPrediction: lastSceneRecognition,
    error: sceneRecognitionError,
    stats: sceneRecognitionStats
  } = useSceneRecognition('/models/kenilworth-scene-recognition/model.json', {
    confidenceThreshold: 0.7,
    throttleMs: 2000,
    debugMode: debugMode
  });
  
  // Refs for positioning system (created once, stable across renders)
  const worldSystemRef = useRef<WorldCoordinateSystem | null>(null);
  const anchorManagerRef = useRef<AnchorManager | null>(null);
  const arPositioningManagerRef = useRef<ARPositioningManager | null>(null);
  
  // Track debug mode changes
  useEffect(() => {
    const checkDebugMode = () => {
      const currentDebugMode = (window as any).arTestingOverride ?? false;
      if (currentDebugMode !== debugMode) {
        setDebugMode(currentDebugMode);
      }
    };
    
    const interval = setInterval(checkDebugMode, 100);
    return () => clearInterval(interval);
  }, [debugMode]);
  
  // Initialize positioning system (once on mount)
  useEffect(() => {
    console.log('🎣 useARPositioning: Initializing enhanced positioning system...');
    
    try {
      // Create coordinate system with Kenilworth centroid
      const worldSystem = new WorldCoordinateSystem(0, true);
      worldSystemRef.current = worldSystem;
      
      // Create anchor manager
      const anchorManager = new AnchorManager(worldSystem);
      anchorManagerRef.current = anchorManager;
      
      // Create AR positioning manager
      const arPositioningManager = new ARPositioningManager(worldSystem, anchorManager);
      arPositioningManagerRef.current = arPositioningManager;
      
      setIsReady(true);
      console.log('✅ useARPositioning: Enhanced positioning system ready');
      
    } catch (error) {
      console.error('❌ useARPositioning: Failed to initialize positioning system:', error);
      setIsReady(false);
    }
    
    // Cleanup on unmount
    return () => {
      console.log('🧹 useARPositioning: Cleaning up positioning system');
      worldSystemRef.current = null;
      anchorManagerRef.current = null;
      arPositioningManagerRef.current = null;
      setIsReady(false);
    };
  }, []); // Empty dependency array - initialize once
  
  // Get best available user position
  const getBestUserPosition = useCallback((): [number, number] | null => {
    // Priority 1: Use averaged position if stable and accurate (≤10m)
    if (preciseUserPosition && isPositionStable && 
        currentAccuracy && currentAccuracy <= 10) {
      return preciseUserPosition;
    }
    
    // Priority 2: Use averaged position if accuracy is acceptable (≤15m)
    if (preciseUserPosition && currentAccuracy && currentAccuracy <= 15) {
      return preciseUserPosition;
    }
    
    // Priority 3: Use averaged position even if not stable (for basic positioning)
    if (preciseUserPosition && currentAccuracy && currentAccuracy <= 25) {
      return preciseUserPosition;
    }
    
    // Priority 4: Fall back to raw GPS
    if (rawUserPosition) {
      return rawUserPosition;
    }
    
    return null;
  }, [preciseUserPosition, rawUserPosition, currentAccuracy, isPositionStable]);
  
  // Current best user position
  const currentUserPosition = getBestUserPosition();
  
  // Scene-based GPS correction
  const applySceneBasedCorrection = useCallback((
    gpsPosition: [number, number] | null,
    sceneResult: SceneRecognitionResult
  ): [number, number] | null => {
    if (!gpsPosition) return null;

    // Define location-specific GPS corrections in decimal degrees
    // These should be calibrated based on your field testing
    const locationCorrections: Record<string, [number, number]> = {
      'lotus_pond': [-0.00001, 0.00002],      // Example: ~1m west, ~2m north
      'flagpole_area': [0.00001, -0.00001],   // Example: ~1m east, ~1m south  
      'boardwalk': [0, 0.00001],              // Example: ~1m north
      'volunteers_area': [-0.00002, 0],       // Example: ~2m west
      'cattail_marsh': [0.00001, 0.00001],    // Example: ~1m east, ~1m north
      'helen_overlook': [0, -0.00001]         // Example: ~1m south
    };

    const correction = locationCorrections[sceneResult.location];
    if (!correction) {
      console.log(`🎯 No correction defined for location: ${sceneResult.location}`);
      return gpsPosition;
    }

    const correctedPosition: [number, number] = [
      gpsPosition[0] + correction[0],
      gpsPosition[1] + correction[1]
    ];

    console.log(`🎯 Applied scene-based correction for ${sceneResult.location}:`, {
      original: gpsPosition,
      correction: correction,
      corrected: correctedPosition,
      confidence: `${(sceneResult.confidence * 100).toFixed(1)}%`
    });

    return correctedPosition;
  }, []);
  
  // Original positioning method (unchanged)
  const positionObject = useCallback((
    object: THREE.Object3D,
    experienceId: string,
    options: PositioningOptions = {}
  ): boolean => {
    if (!isReady || !arPositioningManagerRef.current) {
      console.warn(`🎣 useARPositioning: System not ready for ${experienceId}`);
      return false;
    }
    
    const userInput = { gpsPosition: currentUserPosition };
    
    try {
      const success = arPositioningManagerRef.current.positionObject(
        object,
        experienceId,
        userInput,
        options
      );
      
      if (success) {
        console.log(`🎣 useARPositioning: Positioned ${object.name || 'object'} for ${experienceId}`);
      }
      
      return success;
    } catch (error) {
      console.error(`🎣 useARPositioning: Error positioning ${experienceId}:`, error);
      return false;
    }
  }, [isReady, currentUserPosition]);
  
  // Enhanced positioning method with scene recognition
  const positionObjectWithSceneRecognition = useCallback(async (
    object: THREE.Object3D,
    experienceId: string,
    videoElement?: HTMLVideoElement,
    options: PositioningOptions = {}
  ): Promise<boolean> => {
    if (!isReady || !arPositioningManagerRef.current) {
      console.warn(`🎣 Enhanced positioning: System not ready for ${experienceId}`);
      return false;
    }
    
    let userInput = { gpsPosition: currentUserPosition };
    let usedSceneRecognition = false;
    
    // Try scene recognition if video element provided and model loaded
    if (videoElement && isSceneRecognitionLoaded) {
      try {
        console.log(`🎯 Attempting scene recognition for ${experienceId}...`);
        const sceneResult = await recognizeScene(videoElement);
        
        if (sceneResult && sceneResult.confidence >= 0.7) {
          console.log(`🎯 Scene recognition successful: ${sceneResult.location} (${(sceneResult.confidence * 100).toFixed(1)}%)`);
          
          // Apply scene-specific position refinement
          const refinedPosition = applySceneBasedCorrection(currentUserPosition, sceneResult);
          if (refinedPosition) {
            userInput = { gpsPosition: refinedPosition };
            usedSceneRecognition = true;
          }
        } else {
          console.log(`🎯 Scene recognition confidence too low: ${sceneResult?.confidence ? (sceneResult.confidence * 100).toFixed(1) + '%' : 'null'}`);
        }
      } catch (error) {
        console.warn('🎯 Scene recognition failed, falling back to GPS positioning:', error);
      }
    } else {
      console.log('🎯 Scene recognition not available:', {
        hasVideoElement: !!videoElement,
        isModelLoaded: isSceneRecognitionLoaded
      });
    }
    
    // Use positioning logic with potentially refined position
    try {
      const success = arPositioningManagerRef.current.positionObject(
        object,
        experienceId, 
        userInput,
        options
      );
      
      if (success) {
        console.log(`🎣 Enhanced positioning successful for ${experienceId}`, {
          usedSceneRecognition,
          method: usedSceneRecognition ? 'Scene Recognition + GPS' : 'GPS Only'
        });
      }
      
      return success;
    } catch (error) {
      console.error(`🎣 Enhanced positioning error for ${experienceId}:`, error);
      return false;
    }
  }, [isReady, currentUserPosition, isSceneRecognitionLoaded, recognizeScene, applySceneBasedCorrection]);
  
  // Get position data without applying to object
  const getPosition = useCallback((
    experienceId: string,
    options: PositioningOptions = {}
  ): ExperiencePositionResult | null => {
    if (!isReady || !arPositioningManagerRef.current) {
      return null;
    }
    
    const userInput = { gpsPosition: currentUserPosition };
    
    try {
      return arPositioningManagerRef.current.getExperiencePosition(
        experienceId,
        userInput,
        options
      );
    } catch (error) {
      console.error(`🎣 useARPositioning: Error getting position for ${experienceId}:`, error);
      return null;
    }
  }, [isReady, currentUserPosition]);
  
  // Convenience method: Get world position only
  const getWorldPosition = useCallback((experienceId: string): THREE.Vector3 | null => {
    const result = getPosition(experienceId);
    return result?.worldPosition || null;
  }, [getPosition]);
  
  // Convenience method: Get relative position only
  const getRelativePosition = useCallback((experienceId: string): THREE.Vector3 | null => {
    const result = getPosition(experienceId);
    return result?.relativeToUser || null;
  }, [getPosition]);
  
  // Elevation adjustment methods
  const adjustGlobalElevation = useCallback((delta: number) => {
    if (arPositioningManagerRef.current) {
      arPositioningManagerRef.current.adjustGlobalElevationOffset(delta);
    }
  }, []);
  
  const setGlobalElevation = useCallback((offset: number) => {
    if (arPositioningManagerRef.current) {
      arPositioningManagerRef.current.setGlobalElevationOffset(offset);
    }
  }, []);
  
  const getCurrentElevationOffset = useCallback((): number => {
    return arPositioningManagerRef.current?.getGlobalElevationOffset() || 0;
  }, []);
  
  // Reset methods
  const resetPosition = useCallback((experienceId: string) => {
    console.log(`🎣 useARPositioning: Resetting position for ${experienceId}`);
  }, []);
  
  const resetAllAdjustments = useCallback(() => {
    if (arPositioningManagerRef.current) {
      arPositioningManagerRef.current.resetAdjustments();
      console.log('🎣 useARPositioning: Reset all positioning adjustments');
    }
  }, []);
  
  // Debug info with scene recognition data
  const getDebugInfo = useCallback((experienceId?: string) => {
    if (!arPositioningManagerRef.current) {
      return { error: 'Positioning system not ready' };
    }
    
    const baseInfo = arPositioningManagerRef.current.getDebugInfo(experienceId);
    
    return {
      ...baseInfo,
      hookState: {
        isReady,
        debugMode,
        currentUserPosition,
        userPositionSource: preciseUserPosition && isPositionStable ? 'ENHANCED_STABLE' :
                           preciseUserPosition ? 'ENHANCED_AVERAGED' :
                           rawUserPosition ? 'RAW_GPS' : 'NO_POSITION',
        currentAccuracy,
        positionQuality,
        isPositionStable
      },
      sceneRecognition: {
        isLoaded: isSceneRecognitionLoaded,
        isLoading: isSceneRecognitionLoading,
        lastPrediction: lastSceneRecognition,
        error: sceneRecognitionError,
        stats: sceneRecognitionStats
      }
    };
  }, [isReady, debugMode, currentUserPosition, preciseUserPosition, rawUserPosition, 
      currentAccuracy, positionQuality, isPositionStable, isSceneRecognitionLoaded,
      isSceneRecognitionLoading, lastSceneRecognition, sceneRecognitionError, 
      sceneRecognitionStats]);
  
  // Scene recognition state for external access
  const sceneRecognition = {
    isLoaded: isSceneRecognitionLoaded,
    isLoading: isSceneRecognitionLoading,
    lastPrediction: lastSceneRecognition,
    error: sceneRecognitionError,
    stats: sceneRecognitionStats
  };
  
  // Memoized return value to prevent unnecessary re-renders
  const hookResult = useMemo((): EnhancedARPositioningHookResult => ({
    // Original methods
    positionObject,
    getPosition,
    
    // Enhanced methods
    positionObjectWithSceneRecognition,
    
    // Convenience methods
    getWorldPosition,
    getRelativePosition,
    
    // Elevation adjustment
    adjustGlobalElevation,
    setGlobalElevation,
    getCurrentElevationOffset,
    
    // Reset methods
    resetPosition,
    resetAllAdjustments,
    
    // State
    isReady,
    userPosition: currentUserPosition,
    debugMode,
    
    // Scene recognition state
    sceneRecognition,
    
    // Debug
    getDebugInfo
  }), [
    positionObject,
    getPosition,
    positionObjectWithSceneRecognition,
    getWorldPosition,
    getRelativePosition,
    adjustGlobalElevation,
    setGlobalElevation,
    getCurrentElevationOffset,
    resetPosition,
    resetAllAdjustments,
    isReady,
    currentUserPosition,
    debugMode,
    sceneRecognition,
    getDebugInfo
  ]);
  
  return hookResult;
}