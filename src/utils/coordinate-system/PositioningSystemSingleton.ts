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
 * 
 * includes coordinate transformation controls for GPS calibration
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
  
  // =================================================================
  // CORE POSITIONING API (existing methods)
  // =================================================================
  
  getExperiencePosition: (experienceId: string, userInput: any, options?: any) => 
    arPositioningManager.getExperiencePosition(experienceId, userInput, options),
    
  positionObject: (object: any, experienceId: string, userInput: any, options?: any) =>
    arPositioningManager.positionObject(object, experienceId, userInput, options),
  
  // =================================================================
  // ANCHOR ADJUSTMENT CONTROLS (existing methods)
  // =================================================================
    
  adjustAnchorPosition: (experienceId: string, deltaLon: number, deltaLat: number) =>
    arPositioningManager.adjustAnchorPosition(experienceId, deltaLon, deltaLat),
  
  getCurrentAnchorGps: (experienceId: string) =>
    arPositioningManager.getCurrentAnchorGps(experienceId),
  
  resetAnchorPosition: (experienceId: string) =>
    arPositioningManager.resetAnchorPosition(experienceId),
  
  // =================================================================
  // ELEVATION CONTROLS (existing methods)
  // =================================================================
  
  setGlobalElevationOffset: (offset: number) =>
    arPositioningManager.setGlobalElevationOffset(offset),
  
  getGlobalElevationOffset: () =>
    arPositioningManager.getGlobalElevationOffset(),
  
  adjustGlobalElevationOffset: (delta: number) =>
    arPositioningManager.adjustGlobalElevationOffset(delta),
  
  // =================================================================
  // ✅ NEW: COORDINATE SYSTEM TRANSFORMATION CONTROLS
  // =================================================================
  
  // Horizontal Rotation Controls (X-Z plane)
  setHorizontalRotation: (degrees: number) => 
    arPositioningManager.setHorizontalRotation(degrees),
  
  getHorizontalRotation: () => 
    arPositioningManager.getHorizontalRotation(),
  
  adjustHorizontalRotation: (deltaDegrees: number) => 
    arPositioningManager.adjustHorizontalRotation(deltaDegrees),
  
  resetHorizontalRotation: () => 
    arPositioningManager.resetHorizontalRotation(),
  
  // Coordinate Scale Controls (X-Z plane)
  setCoordinateScale: (scale: number) => 
    arPositioningManager.setCoordinateScale(scale),
  
  getCoordinateScale: () => 
    arPositioningManager.getCoordinateScale(),
  
  adjustCoordinateScale: (delta: number) => 
    arPositioningManager.adjustCoordinateScale(delta),
  
  resetCoordinateScale: () => 
    arPositioningManager.resetCoordinateScale(),
  
  // Translation Controls (X-Z plane)
  setTranslation: (deltaX: number, deltaZ: number) => 
    arPositioningManager.setTranslation(deltaX, deltaZ),
  
  getTranslation: () => 
    arPositioningManager.getTranslation(),
  
  adjustTranslation: (deltaX: number, deltaZ: number) => 
    arPositioningManager.adjustTranslation(deltaX, deltaZ),
  
  resetTranslation: () => 
    arPositioningManager.resetTranslation(),
  
  // Combined Coordinate System Controls
  resetAllCoordinateTransformations: () => 
    arPositioningManager.resetAllCoordinateTransformations(),
  
  getCoordinateTransformationSummary: () => 
    arPositioningManager.getCoordinateTransformationSummary(),
  
  // Coordinate System Validation and Testing
  validateCoordinateSystem: () => 
    arPositioningManager.validateCoordinateSystem(),
  
  testCoordinateTransformation: (testGps: [number, number]) => 
    arPositioningManager.testCoordinateTransformation(testGps),
  
  // =================================================================
  // DEBUG POSITIONING CONTROLS (existing methods)
  // =================================================================
  
  setGlobalDebugPosition: (position: any) =>
    arPositioningManager.setGlobalDebugPosition(position),
  
  getGlobalDebugPosition: () =>
    arPositioningManager.getGlobalDebugPosition(),
  
  // =================================================================
  // RESET FUNCTIONALITY (includes coordinate transformations)
  // =================================================================
  
  resetAllAdjustments: () => {
    arPositioningManager.resetAdjustments(); // Now includes coordinate transformations
    anchorManager.resetAllAnchorsToOriginal();
    console.log('🔄 All positioning adjustments reset (including coordinate transformations)');
  },
  
  // =================================================================
  // ML CORRECTIONS INTEGRATION
  // =================================================================
  
  toggleMLCorrections: (enabled: boolean) =>
    arPositioningManager.toggleMLCorrections(enabled),
  
  getMLSummary: () =>
    arPositioningManager.getMLSummary(),
  
  getMLInfo: (experienceId: string) =>
    arPositioningManager.getMLInfo(experienceId),
  
  // =================================================================
  // UTILITY AND STATUS METHODS (existing and enhanced)
  // =================================================================
  
  //  Debug info now includes coordinate transformations
  getDebugInfo: (experienceId?: string) =>
    arPositioningManager.getDebugInfo(experienceId),
  
  testExperiencePositioning: (experienceId: string, testUserGps?: [number, number]) =>
    arPositioningManager.testExperiencePositioning(experienceId, testUserGps),
  
  //  System status now includes transformation state
  getSystemStatus: () => ({
    worldSystemReady: !!worldSystem,
    anchorManagerReady: !!anchorManager,
    positioningManagerReady: !!arPositioningManager,
    totalAnchors: anchorManager.getAllAnchors().length,
    currentElevationOffset: arPositioningManager.getGlobalElevationOffset(),
    origin: worldSystem.getOrigin(),
    debugMode: (window as any).arTestingOverride ?? false,
    // ✅ NEW: Coordinate transformation status
    coordinateTransformations: arPositioningManager.getCoordinateTransformationSummary()
  }),
  
  // =================================================================
  // RANGE AND VALIDATION UTILITIES 
  // =================================================================
  
  isUserInRange: (experienceId: string, userInput: any, maxDistance?: number) =>
    arPositioningManager.isUserInRange(experienceId, userInput, maxDistance),
  
  getExperiencesInRange: (userInput: any, maxDistance?: number) =>
    arPositioningManager.getExperiencesInRange(userInput, maxDistance),
  
  // =================================================================
  // CALIBRATION WORKFLOW HELPERS
  // =================================================================
  
  /**
   * Quick calibration preset for common scenarios
   */
  applyCalibrationPreset: (presetName: 'reset' | 'north-alignment' | 'custom', customValues?: {
    rotation?: number;
    scale?: number;
    translation?: { x: number; z: number };
  }) => {
    switch (presetName) {
      case 'reset':
        arPositioningManager.resetAllCoordinateTransformations();
        console.log('🎯 Applied "reset" calibration preset');
        break;
        
      case 'north-alignment':
        arPositioningManager.setHorizontalRotation(0); // Align to true north
        arPositioningManager.setCoordinateScale(1.0);
        arPositioningManager.setTranslation(0, 0);
        console.log('🧭 Applied "north-alignment" calibration preset');
        break;
        
      case 'custom':
        if (customValues?.rotation !== undefined) {
          arPositioningManager.setHorizontalRotation(customValues.rotation);
        }
        if (customValues?.scale !== undefined) {
          arPositioningManager.setCoordinateScale(customValues.scale);
        }
        if (customValues?.translation) {
          arPositioningManager.setTranslation(customValues.translation.x, customValues.translation.z);
        }
        console.log('🎛️ Applied "custom" calibration preset', customValues);
        break;
        
      default:
        console.warn(`Unknown calibration preset: ${presetName}`);
    }
  },
  
  /**
   * Get comprehensive calibration status for positioning panel
   */
  getCalibrationStatus: () => {
    const transformSummary = arPositioningManager.getCoordinateTransformationSummary();
    const debugInfo = arPositioningManager.getDebugInfo();
    
    return {
      // Coordinate transformations
      horizontalRotation: transformSummary.rotation,
      coordinateScale: transformSummary.scale,
      translation: transformSummary.translation,
      isDefaultTransformation: transformSummary.isDefault,
      
      // Elevation
      globalElevationOffset: debugInfo.globalElevationOffset,
      
      // Debug state
      debugMode: debugInfo.debugMode,
      globalDebugPosition: debugInfo.globalDebugPosition,
      
      // System state
      totalAnchors: debugInfo.totalAnchors,
      mlSummary: debugInfo.mlSummary,
      
      // Validation
      coordinateSystemValid: arPositioningManager.validateCoordinateSystem().valid
    };
  },
  
  /**
   * Log comprehensive system status for debugging
   */
  logSystemStatus: () => {
    const status = PositioningSystemSingleton.getSystemStatus();
    const calibration = PositioningSystemSingleton.getCalibrationStatus();
    
    console.group('🎯 Positioning System Status');
    console.log('Core Systems:', {
      worldSystemReady: status.worldSystemReady,
      anchorManagerReady: status.anchorManagerReady,
      positioningManagerReady: status.positioningManagerReady
    });
    console.log('Coordinate Transformations:', status.coordinateTransformations);
    console.log('Calibration Status:', calibration);
    console.log('Origin:', status.origin);
    console.log('Total Anchors:', status.totalAnchors);
    console.groupEnd();
  }
};