// src/utils/coordinate-system/PositioningSystemSingleton.ts
import { WorldCoordinateSystem } from './WorldCoordinateSystem';
import { AnchorManager } from './AnchorManager';
import { ARPositioningManager } from './ARPositioningManager';

/**
 * Singleton positioning system to ensure consistent state across all components
 * 
 * This module creates a single instance of each positioning system component
 * that is shared across the entire application. This prevents inconsistencies
 * that occur when multiple components create their own positioning instances.
 */

console.log('🔧 Initializing Positioning System Singleton...');

// Create singleton instances at module level
// These are created ONCE when the module first loads
const worldSystem = new WorldCoordinateSystem(0, true); // Use cached Kenilworth centroid
const anchorManager = new AnchorManager(worldSystem);
const arPositioningManager = new ARPositioningManager(worldSystem, anchorManager);

console.log('✅ Positioning System Singleton initialized');

// Export the singleton instances
export { worldSystem, anchorManager, arPositioningManager };

// Export a combined interface for convenience
export const PositioningSystemSingleton = {
  world: worldSystem,
  anchors: anchorManager,
  positioning: arPositioningManager,
  
  // Convenience methods that components can use directly
  getExperiencePosition: (experienceId: string, userInput: any, options?: any) => 
    arPositioningManager.getExperiencePosition(experienceId, userInput, options),
    
  positionObject: (object: any, experienceId: string, userInput: any, options?: any) =>
    arPositioningManager.positionObject(object, experienceId, userInput, options),
    
  adjustAnchorPosition: (experienceId: string, deltaLon: number, deltaLat: number) =>
    arPositioningManager.adjustAnchorPosition(experienceId, deltaLon, deltaLat),
    
  setGlobalElevationOffset: (offset: number) =>
    arPositioningManager.setGlobalElevationOffset(offset),
    
  resetAllAdjustments: () => {
    arPositioningManager.resetAdjustments();
    anchorManager.resetAllAnchorsToOriginal();
    console.log('🔄 All positioning adjustments reset');
  },
  
  // Debug helpers (useful for development)
  getDebugInfo: (experienceId?: string) =>
    arPositioningManager.getDebugInfo(experienceId),
    
  // System status
  getSystemStatus: () => ({
    worldSystemReady: !!worldSystem,
    anchorManagerReady: !!anchorManager,
    positioningManagerReady: !!arPositioningManager,
    totalAnchors: anchorManager.getAllAnchors().length,
    currentElevationOffset: arPositioningManager.getGlobalElevationOffset(),
    origin: worldSystem.getOrigin(),
    debugMode: (window as any).arTestingOverride ?? false
  })
};