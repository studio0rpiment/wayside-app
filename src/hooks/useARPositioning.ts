// src/hooks/useARPositioning.ts
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import { WorldCoordinateSystem } from '../utils/coordinate-system/WorldCoordinateSystem';
import { AnchorManager } from '../utils/coordinate-system/AnchorManager';
import { ARPositioningManager, ExperiencePositionResult, PositioningOptions } from '../utils/coordinate-system/ARPositioningManager';
import { useGeofenceContext } from '../context/GeofenceContext';

export interface ARPositioningHookResult {
  // Main positioning methods
  positionObject: (object: THREE.Object3D, experienceId: string, options?: PositioningOptions) => boolean;
  getPosition: (experienceId: string, options?: PositioningOptions) => ExperiencePositionResult | null;
  
  // Convenience methods
  getWorldPosition: (experienceId: string) => THREE.Vector3 | null;
  getRelativePosition: (experienceId: string) => THREE.Vector3 | null;
  
  // Elevation adjustment (to fix "too high" issue)
  adjustGlobalElevation: (delta: number) => void;
  setGlobalElevation: (offset: number) => void;
  getCurrentElevationOffset: () => number;
  
  // Reset and debug
  resetPosition: (experienceId: string) => void;
  resetAllAdjustments: () => void;
  
  // State
  isReady: boolean;
  userPosition: [number, number] | null;
  debugMode: boolean;
  
  // Debug info
  getDebugInfo: (experienceId?: string) => any;
}

/**
 * React hook that provides simple AR positioning API for experiences
 * Replaces all the scattered positioning logic across components
 */
export function useARPositioning(): ARPositioningHookResult {
  
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
    console.log('🎣 useARPositioning: Initializing positioning system...');
    
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
      console.log('✅ useARPositioning: Positioning system ready');
      
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
  
  // Main positioning method that experiences will use
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
  
  // Elevation adjustment methods (to fix "too high" issue)
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
    // Reset is handled by re-calling positionObject with default options
    // The positioning manager will use the original anchor position
  }, []);
  
  const resetAllAdjustments = useCallback(() => {
    if (arPositioningManagerRef.current) {
      arPositioningManagerRef.current.resetAdjustments();
      console.log('🎣 useARPositioning: Reset all positioning adjustments');
    }
  }, []);
  
  // Debug info
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
      }
    };
  }, [isReady, debugMode, currentUserPosition, preciseUserPosition, rawUserPosition, currentAccuracy, positionQuality, isPositionStable]);
  
  // Memoized return value to prevent unnecessary re-renders
  const hookResult = useMemo((): ARPositioningHookResult => ({
    // Main methods
    positionObject,
    getPosition,
    
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
    
    // Debug
    getDebugInfo
  }), [
    positionObject,
    getPosition,
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
    getDebugInfo
  ]);
  
  return hookResult;
}

/**
 * Lightweight hook for components that only need to check if positioning is available
 */
export function useARPositioningStatus(): {
  isReady: boolean;
  debugMode: boolean;
  userPosition: [number, number] | null;
} {
  const { isReady, debugMode, userPosition } = useARPositioning();
  
  return { isReady, debugMode, userPosition };
}

/**
 * Hook for experiences that only need elevation adjustment
 */
export function useElevationControl(): {
  adjustGlobalElevation: (delta: number) => void;
  setGlobalElevation: (offset: number) => void;
  getCurrentElevationOffset: () => number;
  resetAllAdjustments: () => void;
} {
  const { 
    adjustGlobalElevation, 
    setGlobalElevation, 
    getCurrentElevationOffset, 
    resetAllAdjustments 
  } = useARPositioning();
  
  return { 
    adjustGlobalElevation, 
    setGlobalElevation, 
    getCurrentElevationOffset, 
    resetAllAdjustments 
  };
}