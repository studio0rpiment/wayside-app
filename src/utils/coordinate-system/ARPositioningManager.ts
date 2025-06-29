// src/utils/coordinate-system/ARPositioningManager.ts
import * as THREE from 'three';
import { WorldCoordinateSystem } from './WorldCoordinateSystem';
import { AnchorManager, WorldAnchor } from './AnchorManager';
import { mlAnchorCorrections } from './anchorCorrections';
import { debugModeManager } from '../DebugModeManager';


export interface UserPositionInput {
  gpsPosition?: [number, number] | null;
  worldPosition?: THREE.Vector3 | null;
  isUniversalMode?: boolean;
}

export interface ExperiencePositionResult {
  // Core positioning
  worldPosition: THREE.Vector3;
  relativeToUser: THREE.Vector3; // Position relative to user (for AR placement)
  
  // Transform data
  rotation: THREE.Euler;
  scale: number;
  
  // Context info
  isUsingDebugMode: boolean;
  distanceFromUser: number | null;
  anchor: WorldAnchor;
  
  // User context
  userWorldPosition: THREE.Vector3 | null;
  userGpsPosition: [number, number] | null;
}

export interface PositioningOptions {
  useDebugOverride?: boolean;
  manualElevationOffset?: number; // Additional height adjustment (positive = higher)
  manualScale?: number; // Scale multiplier
  forcePosition?: THREE.Vector3; // Override position entirely
}

/**
 * Main AR positioning system that experiences will use
 * Replaces all the scattered positioning logic across components
 * Addresses the "everything too high" issue with configurable offsets
 */
export class ARPositioningManager {
  private worldSystem: WorldCoordinateSystem;
  private anchorManager: AnchorManager;
  
  // Global elevation adjustment to fix "too high" issue
  private globalElevationOffset: number = -1.5; // Start lower to counteract high positioning
  
  // Debug state
  private debugMode: boolean = false;
  private globalDebugPosition: THREE.Vector3 = new THREE.Vector3(0, 0, -5);

  private positionCache: Map<string, {
  result: ExperiencePositionResult;
  cacheKey: string;
  }> = new Map();

  constructor(worldSystem: WorldCoordinateSystem, anchorManager: AnchorManager) {
    this.worldSystem = worldSystem;
    this.anchorManager = anchorManager;
    this.setupDebugListener();
  }

  /**
   * Main API: Get positioning data for an experience
   * This is the primary method experiences will call
   */
  getExperiencePosition(
    experienceId: string,
    userInput: UserPositionInput,
    options: PositioningOptions = {}
  ): ExperiencePositionResult | null {

//****** */ Check cache first
    const cacheKey = this.generateCacheKey(experienceId, userInput, options);
    const cached = this.positionCache.get(experienceId);
    
    if (cached && cached.cacheKey === cacheKey) {
      return cached.result; // Return cached result without console logs
    }
    // Clear old cache entry
    this.positionCache.delete(experienceId);
    
//***** FIND ANCHOR */    

    const anchor = this.anchorManager.getAnchor(experienceId);
    if (!anchor) {
      console.warn(`🎯 ARPositioningManager: No anchor found for ${experienceId}`);
      return null;
    }

    // Determine user position in world coordinates
    const userWorldPosition = this.getUserWorldPosition(userInput);
    const userGpsPosition = userInput.gpsPosition || null;

    // Get anchor world position (with debug override support)
    let anchorWorldPosition: THREE.Vector3;

    // ✅ DEBUG: Check for Universal Mode from user input
    const isUniversalMode = userInput.isUniversalMode || false;

    console.log("🔍 Positioning Debug:", {
      debugMode: this.debugMode,
      useDebugOverride: options.useDebugOverride,
      isUniversalMode,
      hasForcePosition: !!options.forcePosition,
      userWorldPosition: !!userWorldPosition
    });

    if (this.debugMode || options.useDebugOverride || isUniversalMode) {
      if (options.forcePosition) {
        anchorWorldPosition = options.forcePosition.clone();
        console.log("🎯 Using force position");
      } else {
        // Make debug position relative to user, not world origin
        if (userWorldPosition) {
          anchorWorldPosition = userWorldPosition.clone().add(this.globalDebugPosition);
          console.log("🌐 Universal Mode: Using debug position relative to user", {
            userWorldPosition: userWorldPosition.toArray(),
            globalDebugPosition: this.globalDebugPosition.toArray(),
            finalPosition: anchorWorldPosition.toArray()
          });
        } else {
          // Fallback if no user position available
          anchorWorldPosition = this.globalDebugPosition.clone();
          console.log("🌐 Universal Mode: Using fallback debug position", {
            globalDebugPosition: this.globalDebugPosition.toArray()
          });
        }
      }
    } else {
      anchorWorldPosition = anchor.worldPosition.clone();
      console.log("📍 Using normal anchor position");
    }

    // Apply elevation adjustments to address "too high" issue
    const totalElevationOffset = this.globalElevationOffset + (options.manualElevationOffset || 0);
    anchorWorldPosition.y += totalElevationOffset;

    // Calculate relative position for AR placement
    let relativeToUser: THREE.Vector3;
    if (userWorldPosition) {
      relativeToUser = anchorWorldPosition.clone().sub(userWorldPosition);
    } else {
       
      // No user position available - use anchor position directly
      relativeToUser = anchorWorldPosition.clone();
  
    }

    // Calculate distance
    const distanceFromUser = userWorldPosition ? 
      userWorldPosition.distanceTo(anchorWorldPosition) : null;

    // Apply scale adjustments
    const finalScale = anchor.scale * (options.manualScale || 1.0);

    const result: ExperiencePositionResult = {
      worldPosition: anchorWorldPosition,
      relativeToUser,
      rotation: new THREE.Euler(anchor.rotation.x, anchor.rotation.y, anchor.rotation.z),
      scale: finalScale,
      isUsingDebugMode: this.debugMode || !!options.useDebugOverride || isUniversalMode,
      distanceFromUser,
      anchor,
      userWorldPosition,
      userGpsPosition
    };

    // ✅ NEW: Cache the result
    this.positionCache.set(experienceId, {
      result,
      cacheKey
    });

    // Only log when we actually calculate (not from cache)
    console.log("🎯 Calculated new position for", experienceId);

    return result;
    }

  /**
 * Generate cache key for position calculation
 */
    private generateCacheKey(
      experienceId: string,
      userInput: UserPositionInput,
      options: PositioningOptions
    ): string {
      const userPos = userInput.gpsPosition || userInput.worldPosition?.toArray() || [0,0,0];
      const isUniversal = userInput.isUniversalMode || false;
      const debugOverride = options.useDebugOverride || false;
      const manualElevation = options.manualElevationOffset || 0;
      const manualScale = options.manualScale || 1;
      
      return `${experienceId}:${userPos.join(',')}:${isUniversal}:${this.debugMode}:${debugOverride}:${manualElevation}:${manualScale}:${this.globalElevationOffset}`;
    }

/**
   * Adjust anchor position by GPS offset
   * This moves the anchor's GPS coordinates and recalculates world position
   */
  adjustAnchorPosition(
    experienceId: string,
    deltaLon: number,
    deltaLat: number
  ): boolean {
    const anchor = this.anchorManager.getAnchor(experienceId);
    if (!anchor) {
      console.warn(`🎯 ARPositioningManager: No anchor found for ${experienceId}`);
      return false;
    }

    // Calculate new GPS coordinates
    const newGpsCoordinates: [number, number] = [
      anchor.gpsCoordinates[0] + deltaLon,
      anchor.gpsCoordinates[1] + deltaLat
    ];

    // Update the anchor using the anchor manager
    const success = this.anchorManager.updateAnchorPosition(
      experienceId,
      newGpsCoordinates,
      anchor.elevationOffset
    );

    if (success) {
      console.log(`🎯 ARPositioningManager: Anchor ${experienceId} moved by [${deltaLon.toFixed(8)}, ${deltaLat.toFixed(8)}]`);
      console.log(`🎯 ARPositioningManager: New GPS coordinates: [${newGpsCoordinates[0].toFixed(8)}, ${newGpsCoordinates[1].toFixed(8)}]`);
    } else {
      console.error(`🎯 ARPositioningManager: Failed to update anchor ${experienceId}`);
    }

    return success;
  }
/**
 * Get current GPS coordinates (after adjustments)
 */
getCurrentAnchorGps(experienceId: string): [number, number] | null {
  const anchor = this.anchorManager.getAnchor(experienceId);
  if (!anchor) return null;
  
  return anchor.gpsCoordinates; // These are already updated by adjustAnchorPosition
}
/**
 * Reset anchor to original position
 */
resetAnchorPosition(experienceId: string): boolean {
  console.log(`🎯 ARPositioningManager: Resetting anchor ${experienceId} to original position`);
  
  const success = this.anchorManager.resetAnchorToOriginal(experienceId);
  
  if (success) {
    console.log(`🎯 ARPositioningManager: Anchor ${experienceId} reset to original position`);
  } else {
    console.error(`🎯 ARPositioningManager: Failed to reset anchor ${experienceId}`);
  }
  
  return success;
}
  
  /**
   * Simplified API for experiences that just want a position
   */
  getExperienceWorldPosition(
    experienceId: string, 
    userInput: UserPositionInput,
    options: PositioningOptions = {}
  ): THREE.Vector3 | null {
    const result = this.getExperiencePosition(experienceId, userInput, options);
    return result?.worldPosition || null;
  }

  /**
   * Get position relative to user (for direct AR object placement)
   */
  getExperienceRelativePosition(
    experienceId: string,
    userInput: UserPositionInput,
    options: PositioningOptions = {}
  ): THREE.Vector3 | null {
    const result = this.getExperiencePosition(experienceId, userInput, options);
    return result?.relativeToUser || null;
  }

  /**
   * Apply positioning result to a Three.js object
   * This replaces the manual positioning code in experiences
   */
  applyPositioningToObject(
    object: THREE.Object3D,
    positionResult: ExperiencePositionResult,
    useRelativePosition: boolean = true
  ): void {
    // Choose position type
    const targetPosition = useRelativePosition ? 
      positionResult.relativeToUser : positionResult.worldPosition;
    
    // Apply transforms
    object.position.copy(targetPosition);
    object.rotation.copy(positionResult.rotation);
    object.scale.setScalar(positionResult.scale);

    console.log(`🎯 Applied positioning to ${object.name || 'object'}:`, {
      position: object.position.toArray(),
      rotation: object.rotation.toArray(),
      scale: object.scale.toArray(),
      debugMode: positionResult.isUsingDebugMode,
      distance: positionResult.distanceFromUser?.toFixed(1) + 'm'
    });
  }

  /**
   * Quick positioning method for simple cases
   */
  positionObject(
    object: THREE.Object3D,
    experienceId: string,
    userInput: UserPositionInput,
    options: PositioningOptions = {}
  ): boolean {
    const result = this.getExperiencePosition(experienceId, userInput, options);
    if (!result) return false;

    this.applyPositioningToObject(object, result, true); // Use relative positioning
    return true;
  }

  /**
   * Get user position in world coordinates from various input types
   */
  private getUserWorldPosition(userInput: UserPositionInput): THREE.Vector3 | null {
    // Direct world position takes priority
    if (userInput.worldPosition) {
      return userInput.worldPosition;
    }

    // Convert GPS to world coordinates
    if (userInput.gpsPosition) {
      return this.worldSystem.gpsToWorld(userInput.gpsPosition, 0); // Assume user at ground level
    }

    return null;
  }

  /**
   * Check if user is in range of an experience
   */
  isUserInRange(
    experienceId: string,
    userInput: UserPositionInput,
    maxDistance: number = 50
  ): boolean {
    const result = this.getExperiencePosition(experienceId, userInput);
    return result ? (result.distanceFromUser || Infinity) <= maxDistance : false;
  }

  /**
   * Get all experiences within range of user
   */
  getExperiencesInRange(
    userInput: UserPositionInput,
    maxDistance: number = 100
  ): ExperiencePositionResult[] {
    const allAnchors = this.anchorManager.getAllAnchors();
    const inRange: ExperiencePositionResult[] = [];

    allAnchors.forEach(anchor => {
      const result = this.getExperiencePosition(anchor.id, userInput);
      if (result && result.distanceFromUser && result.distanceFromUser <= maxDistance) {
        inRange.push(result);
      }
    });

    return inRange.sort((a, b) => (a.distanceFromUser || 0) - (b.distanceFromUser || 0));
  }

  /**
   * Global elevation offset management (to fix "too high" issue)
   */
  setGlobalElevationOffset(offset: number): void {
    this.globalElevationOffset = offset;
    console.log(`🎯 Global elevation offset set to ${offset}m`);
  }

  getGlobalElevationOffset(): number {
    return this.globalElevationOffset;
  }

  /**
   * Adjust elevation offset (for runtime tuning)
   */
  adjustGlobalElevationOffset(delta: number): void {
    this.globalElevationOffset += delta;
    console.log(`🎯 Global elevation offset adjusted to ${this.globalElevationOffset}m`);
  }

  /**
   * Debug positioning controls
   */
  setGlobalDebugPosition(position: THREE.Vector3): void {
    this.globalDebugPosition = position.clone();
    console.log(`🎯 Debug position set to (${position.x}, ${position.y}, ${position.z})`);
  }

  getGlobalDebugPosition(): THREE.Vector3 {
    return this.globalDebugPosition.clone();
  }

  /**
   *  Event Driven Debug listening
   */
private setupDebugListener(): void {
  // Import the debug mode manager
  import('../DebugModeManager').then(({ debugModeManager }) => {
    // Initialize if not already done
    debugModeManager.initialize();
    
    // Listen for debug mode changes
    const handleDebugModeChange = (event: CustomEvent) => {
      const enabled = event.detail.enabled;
      if (enabled !== this.debugMode) {
        this.debugMode = enabled;
        console.log(`🎯 ARPositioningManager debug mode: ${enabled ? 'ON' : 'OFF'}`);
      }
    };
    
    debugModeManager.addEventListener('debugModeChanged', handleDebugModeChange as EventListener);
    
    // Set initial state
    this.debugMode = debugModeManager.debugMode;
    console.log(`🎯 ARPositioningManager: Initial debug mode: ${this.debugMode}`);
  });
}


/**
 * Reset all positioning adjustments
 */
resetAdjustments(): void {
  this.globalElevationOffset = -1.5; // Back to default "fix too high" value
  this.globalDebugPosition = new THREE.Vector3(0, 0, -5);
  
  // ✅ NEW: Reset all anchors to original positions from mapRouteData
  console.log('🎯 ARPositioningManager: Resetting all anchors to original positions...');
  
  // Tell AnchorManager to reload from route data
  this.anchorManager.resetAllAnchorsToOriginal();
  
  console.log('🎯 ARPositioningManager: Reset all adjustments to defaults');
}

  /**
   * Test positioning system with a specific experience
   */
  testExperiencePositioning(
    experienceId: string,
    testUserGps?: [number, number]
  ): void {
    console.log(`🧪 Testing positioning for ${experienceId}...`);
    
    // Use test GPS or origin
    const userInput: UserPositionInput = {
      gpsPosition: testUserGps || this.worldSystem.getOrigin()
    };

    // Test normal positioning
    const normalResult = this.getExperiencePosition(experienceId, userInput);
    if (normalResult) {
      console.log('📍 Normal positioning:', {
        worldPos: normalResult.worldPosition.toArray(),
        relativePos: normalResult.relativeToUser.toArray(),
        distance: normalResult.distanceFromUser?.toFixed(1) + 'm',
        debugMode: normalResult.isUsingDebugMode
      });
    }

    // Test debug positioning
    const debugResult = this.getExperiencePosition(experienceId, userInput, { useDebugOverride: true });
    if (debugResult) {
      console.log('🔧 Debug positioning:', {
        worldPos: debugResult.worldPosition.toArray(),
        relativePos: debugResult.relativeToUser.toArray(),
        debugMode: debugResult.isUsingDebugMode
      });
    }

    // Test with elevation adjustment
    const elevationResult = this.getExperiencePosition(experienceId, userInput, { manualElevationOffset: -2.0 });
    if (elevationResult) {
      console.log('📏 With -2m elevation adjustment:', {
        worldPos: elevationResult.worldPosition.toArray(),
        relativePos: elevationResult.relativeToUser.toArray()
      });
    }
  }
/**
   * Toggle ML corrections (called from debug panel)
   */
  toggleMLCorrections = (enabled: boolean): void => {
    console.log(`🧠 ARPositioningManager: Toggling ML corrections ${enabled ? 'ON' : 'OFF'}`);
    
    // Update the anchor manager
    this.anchorManager.toggleMLCorrections(enabled);
    
    // Clear position cache to force recalculation
    this.positionCache.clear();
    
    console.log(`🧠 ML corrections ${enabled ? 'ENABLED' : 'DISABLED'}, position cache cleared`);
  };

  /**
   * Get ML correction summary for debugging
   */
  getMLSummary(): {
    enabled: boolean;
    totalExperiences: number;
    trainedExperiences: number;
    availableExperiences: string[];
    appliedCount: number;
  } {
    return this.anchorManager.getMLSummary();
  }

  /**
   * Get ML info for specific experience
   */
  getMLInfo(experienceId: string): {
    available: boolean;
    enabled: boolean;
    valid: boolean;
    applied: boolean;
    correction?: any;
    positionComparison?: any;
  } {
    const mlInfo = this.anchorManager.getMLInfo(experienceId);
    const positionComparison = this.anchorManager.getPositionComparison(experienceId);
    
    return {
      ...mlInfo,
      positionComparison
    };
  }

  /**
   * Enhanced debug info with ML correction data
   */
  getDebugInfo(experienceId?: string): {
    debugMode: boolean;
    globalElevationOffset: number;
    globalDebugPosition: THREE.Vector3;
    totalAnchors: number;
    mlSummary: any; // NEW
    experienceInfo?: {
      id: string;
      anchorWorldPos: THREE.Vector3;
      debugPos: THREE.Vector3;
      elevationOffset: number;
      mlInfo?: any; // NEW
    };
  } {
    const baseDebugInfo = {
      debugMode: this.debugMode,
      globalElevationOffset: this.globalElevationOffset,
      globalDebugPosition: this.globalDebugPosition.clone(),
      totalAnchors: this.anchorManager.getAllAnchors().length,
      mlSummary: this.getMLSummary() // NEW: Add ML summary
    };

    if (experienceId) {
      const anchor = this.anchorManager.getAnchor(experienceId);
      if (anchor) {
        (baseDebugInfo as any).experienceInfo = {
          id: experienceId,
          anchorWorldPos: anchor.worldPosition.clone(),
          debugPos: this.globalDebugPosition.clone(),
          elevationOffset: this.globalElevationOffset,
          mlInfo: this.getMLInfo(experienceId) // NEW: Add ML info
        };
      }
    }

    return baseDebugInfo;
  }




}