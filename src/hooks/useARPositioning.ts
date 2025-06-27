// src/hooks/useARPositioning.ts
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import { ARPositioningManager, ExperiencePositionResult, PositioningOptions } from '../utils/coordinate-system/ARPositioningManager';
import { useGeofenceContext } from '../context/GeofenceContext';
// Import the singleton instance
import { arPositioningManager } from '../utils/coordinate-system/PositioningSystemSingleton';
import { debugModeManager } from '../utils/DebugModeManager';


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
  
  // Anchor adjustment
  adjustAnchorPosition: (experienceId: string, deltaLon: number, deltaLat: number) => boolean;
  resetAnchorPosition: (experienceId: string) => boolean;
  getCurrentAnchorGps: (experienceId: string) => [number, number] | null;
  
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
 * Now uses singleton positioning system for consistency across all components
 */
export function useARPositioning(): ARPositioningHookResult {
  
  // Get user position from enhanced geofence context
  const {
    userPosition: rawUserPosition,
    averagedPosition: preciseUserPosition,
    currentAccuracy,
    positionQuality,
    isPositionStable,
    isUniversalMode
  } = useGeofenceContext();

  // State for hook
  const [isReady, setIsReady] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  
  // Use the singleton instance directly (no more creating new instances!)
  const arPositioningManagerRef = useRef<ARPositioningManager>(arPositioningManager);
  
  // Track debug mode changes event driven!
useEffect(() => {
  // Initialize debug mode manager
  debugModeManager.initialize();
  
  // Listen for debug mode changes
  const handleDebugModeChange = (event: CustomEvent) => {
    const enabled = event.detail.enabled;
    setDebugMode(enabled);
  };
  
  debugModeManager.addEventListener('debugModeChanged', handleDebugModeChange as EventListener);
  
  // Set initial state
  setDebugMode(debugModeManager.debugMode);
  
  return () => {
    debugModeManager.removeEventListener('debugModeChanged', handleDebugModeChange as EventListener);
  };
}, []);
  
  // Simplified initialization - singleton is already created
  useEffect(() => {
    console.log('🎣 useARPositioning: Using singleton positioning system');
    setIsReady(true);
    
    // No cleanup needed since we're using singleton
    return () => {
      console.log('🎣 useARPositioning: Hook cleanup (singleton remains active)');
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
    
    const userInput = { 
      gpsPosition: currentUserPosition,
      isUniversalMode
    };
    
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
  }, [isReady, currentUserPosition, isUniversalMode]);
  
  // Get position data without applying to object
  const getPosition = useCallback((
    experienceId: string,
    options: PositioningOptions = {}
  ): ExperiencePositionResult | null => {
    if (!isReady || !arPositioningManagerRef.current) {
      return null;
    }
    
    const userInput = { 
      gpsPosition: currentUserPosition,
      isUniversalMode
    };
    
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
  }, [isReady, currentUserPosition, isUniversalMode]);
  
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
      console.log(`🎣 useARPositioning: Adjusted global elevation by ${delta}m`);
    }
  }, []);
  
  const setGlobalElevation = useCallback((offset: number) => {
    if (arPositioningManagerRef.current) {
      arPositioningManagerRef.current.setGlobalElevationOffset(offset);
      console.log(`🎣 useARPositioning: Set global elevation to ${offset}m`);
    }
  }, []);
  
  const getCurrentElevationOffset = useCallback((): number => {
    return arPositioningManagerRef.current?.getGlobalElevationOffset() || 0;
  }, []);
  
  // Anchor adjustment methods
  const adjustAnchorPosition = useCallback((
    experienceId: string, 
    deltaLon: number, 
    deltaLat: number
  ): boolean => {
    if (!arPositioningManagerRef.current) {
      console.warn('🎣 useARPositioning: Positioning manager not ready for anchor adjustment');
      return false;
    }
    
    try {
      const success = arPositioningManagerRef.current.adjustAnchorPosition(experienceId, deltaLon, deltaLat);
      if (success) {
        console.log(`🎣 useARPositioning: Adjusted anchor ${experienceId} by [${deltaLon.toFixed(8)}, ${deltaLat.toFixed(8)}]`);
      }
      return success;
    } catch (error) {
      console.error('🎣 useARPositioning: Error adjusting anchor position:', error);
      return false;
    }
  }, []);
  
  const resetAnchorPosition = useCallback((experienceId: string): boolean => {
    if (!arPositioningManagerRef.current) {
      console.warn('🎣 useARPositioning: Positioning manager not ready for anchor reset');
      return false;
    }
    
    try {
      const success = arPositioningManagerRef.current.resetAnchorPosition(experienceId);
      if (success) {
        console.log(`🎣 useARPositioning: Reset anchor ${experienceId} to original position`);
      }
      return success;
    } catch (error) {
      console.error('🎣 useARPositioning: Error resetting anchor position:', error);
      return false;
    }
  }, []);

  const getCurrentAnchorGps = useCallback((experienceId: string): [number, number] | null => {
    if (!arPositioningManagerRef.current) {
      return null;
    }
    
    try {
      return arPositioningManagerRef.current.getCurrentAnchorGps(experienceId);
    } catch (error) {
      console.error('🎣 useARPositioning: Error getting current anchor GPS:', error);
      return null;
    }
  }, []);
  
  // Reset methods
  const resetPosition = useCallback((experienceId: string) => {
    console.log(`🎣 useARPositioning: Resetting position for ${experienceId}`);
    // Reset is handled by calling resetAnchorPosition
    resetAnchorPosition(experienceId);
  }, [resetAnchorPosition]);
  
  const resetAllAdjustments = useCallback(() => {
    if (arPositioningManagerRef.current) {
      arPositioningManagerRef.current.resetAdjustments();
      console.log('🎣 useARPositioning: Reset all positioning adjustments (singleton)');
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
      singletonInfo: {
        usingSingleton: true,
        arPositioningManagerInstance: arPositioningManagerRef.current.constructor.name
      },
      hookState: {
        isReady,
        debugMode,
        currentUserPosition,
        isUniversalMode,
        userPositionSource: preciseUserPosition && isPositionStable ? 'ENHANCED_STABLE' :
                           preciseUserPosition ? 'ENHANCED_AVERAGED' :
                           rawUserPosition ? 'RAW_GPS' : 'NO_POSITION',
        currentAccuracy,
        positionQuality,
        isPositionStable
      }
    };
  }, [isReady, debugMode, currentUserPosition, isUniversalMode, preciseUserPosition, rawUserPosition, currentAccuracy, positionQuality, isPositionStable]);
  
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
    
    // Anchor adjustment methods
    adjustAnchorPosition,
    resetAnchorPosition,
    getCurrentAnchorGps,
    
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
    adjustAnchorPosition,
    resetAnchorPosition,
    getCurrentAnchorGps,
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