// src/utils/coordinate-system/AnchorManager.ts
import * as THREE from 'three';
import { WorldCoordinateSystem } from './WorldCoordinateSystem';
import { routePointsData, ArAnchorPoint } from '../../data/mapRouteData';

export interface WorldAnchor {
  id: string;
  gpsCoordinates: [number, number];
  worldPosition: THREE.Vector3;
  elevationOffset: number;
  rotation: THREE.Euler;
  scale: number;
  
  // Geofence configuration
  geofenceShape: 'circle' | 'hexagon';
  geofenceRadius: number;
  directionSensitive: boolean;
  entryMessages?: Record<string, string>;
  
  // Metadata
  experienceType: string;
  title: string;
  debugPosition?: THREE.Vector3;
}

export interface AnchorQuery {
  experienceId: string;
  userWorldPosition?: THREE.Vector3;
  useDebugOverride?: boolean;
}

/**
 * Centralized anchor management system
 * Converts GPS-based anchors to persistent world coordinates
 * Replaces scattered positioning logic across experiences
 */
export class AnchorManager {
  private worldSystem: WorldCoordinateSystem;
  private anchors: Map<string, WorldAnchor> = new Map();
  private debugMode: boolean = false;
  private globalDebugOffset: THREE.Vector3 | null = null;

  constructor(worldSystem: WorldCoordinateSystem) {
    this.worldSystem = worldSystem;
    this.loadAnchorsFromRouteData();
    this.setupDebugListener();
  }

  /**
   * Load all anchors from existing mapRouteData and convert to world coordinates
   */
  private loadAnchorsFromRouteData(): void {
    console.log('🔗 AnchorManager: Loading anchors from route data...');
    
    let loadedCount = 0;
    let skippedCount = 0;

    routePointsData.features.forEach(feature => {
      const properties = feature.properties;
      const arAnchor = properties.arAnchor;
      
      if (!arAnchor) {
        console.warn(`⚠️ No AR anchor defined for ${properties.iconName}`);
        skippedCount++;
        return;
      }

      try {
        const worldAnchor = this.convertToWorldAnchor(properties.iconName, arAnchor, properties);
        this.anchors.set(properties.iconName, worldAnchor);
        loadedCount++;
        
        console.log(`✅ Loaded anchor: ${properties.iconName} at world position (${worldAnchor.worldPosition.x.toFixed(1)}, ${worldAnchor.worldPosition.y.toFixed(1)}, ${worldAnchor.worldPosition.z.toFixed(1)})`);
      } catch (error) {
        console.error(`❌ Failed to load anchor ${properties.iconName}:`, error);
        skippedCount++;
      }
    });

    console.log(`🔗 AnchorManager: Loaded ${loadedCount} anchors, skipped ${skippedCount}`);
  }

  /**
   * Convert GPS-based anchor to world coordinate anchor
   */
  private convertToWorldAnchor(
    id: string, 
    arAnchor: ArAnchorPoint, 
    properties: any
  ): WorldAnchor {
    // Convert GPS to world coordinates
    const worldPosition = this.worldSystem.gpsToWorld(
      arAnchor.coordinates,
      arAnchor.elevation || 0
    );

    // Create rotation from orientation (if provided)
    const rotation = new THREE.Euler(
      0, // Keep X as 0 initially
      THREE.MathUtils.degToRad(arAnchor.orientation || 0), // Y rotation from orientation
      0  // Keep Z as 0 initially
    );

    // Experience-specific rotation adjustments
    this.applyExperienceSpecificRotation(id, rotation);

    return {
      id,
      gpsCoordinates: arAnchor.coordinates,
      worldPosition,
      elevationOffset: arAnchor.elevation || 0,
      rotation,
      scale: arAnchor.scale || 1.0,
      
      // Geofence configuration
      geofenceShape: arAnchor.geofenceShape || 'circle',
      geofenceRadius: arAnchor.radius || 15, // Use from arAnchor or default
      directionSensitive: arAnchor.directionSensitive || false,
      entryMessages: arAnchor.entryMsgs,
      
      // Metadata
      experienceType: id,
      title: properties.title || id,
      debugPosition: new THREE.Vector3(0, 0, -5) // Standard debug position
    };
  }

  /**
   * Apply experience-specific rotation adjustments
   * This centralizes the rotation logic that was scattered in experiences
   */
  private applyExperienceSpecificRotation(experienceId: string, rotation: THREE.Euler): void {
    switch (experienceId) {
      case 'mac':
        // Mac needs Z-up to Y-up conversion (from MacExperience.tsx)
        rotation.x = -Math.PI / 2;
        break;
        
      case 'lily':
      case 'lotus':
      case 'cattail':
        // Plant experiences typically don't need rotation
        break;
        
      case '2030-2105':
        // Water rise experience needs slight tilt (from WaterRiseExperience.tsx)
        rotation.x = THREE.MathUtils.degToRad(25);
        break;
        
      case '1968':
        // Smoke experience typically faces up
        break;
        
      case '2200_bc':
        // Canoe experience might need specific orientation
        break;
        
      case 'volunteers':
      case 'helen_s':
        // Human figures might need specific orientation
        break;
        
      default:
        console.log(`🔗 No specific rotation defined for ${experienceId}`);
    }
  }

  /**
   * Setup debug mode listener (matches existing pattern)
   */
  private setupDebugListener(): void {
    setInterval(() => {
      const currentDebugMode = (window as any).arTestingOverride ?? false;
      if (currentDebugMode !== this.debugMode) {
        this.debugMode = currentDebugMode;
        console.log(`🔗 AnchorManager debug mode: ${currentDebugMode ? 'ON' : 'OFF'}`);
      }
    }, 100);
  }

  /**
   * Get anchor world position with debug override support
   */
  getAnchorWorldPosition(query: AnchorQuery): THREE.Vector3 | null {
    const anchor = this.anchors.get(query.experienceId);
    if (!anchor) {
      console.warn(`🔗 Anchor not found: ${query.experienceId}`);
      return null;
    }

    // Debug mode overrides
    if (this.debugMode || query.useDebugOverride) {
      // Global debug offset takes priority
      if (this.globalDebugOffset) {
        return this.globalDebugOffset.clone();
      }
      
      // Experience-specific debug position
      if (anchor.debugPosition) {
        return anchor.debugPosition.clone();
      }
    }

    // Normal world position
    return anchor.worldPosition.clone();
  }

  /**
   * Get complete anchor information
   */
  getAnchor(experienceId: string): WorldAnchor | null {
    return this.anchors.get(experienceId) || null;
  }

  /**
   * Get all anchors (useful for debugging and overview)
   */
  getAllAnchors(): WorldAnchor[] {
    return Array.from(this.anchors.values());
  }

  /**
   * Check if an anchor exists
   */
  hasAnchor(experienceId: string): boolean {
    return this.anchors.has(experienceId);
  }

  /**
   * Get anchor in world space relative to user position
   * This replaces the user-relative calculations from geoArUtils
   */
  getRelativeAnchorPosition(
    experienceId: string, 
    userWorldPosition: THREE.Vector3
  ): THREE.Vector3 | null {
    const anchorWorldPos = this.getAnchorWorldPosition({ experienceId });
    if (!anchorWorldPos) return null;

    // Return anchor position relative to user
    return anchorWorldPos.clone().sub(userWorldPosition);
  }

  /**
   * Get distance to anchor from user position
   */
  getDistanceToAnchor(
    experienceId: string, 
    userWorldPosition: THREE.Vector3
  ): number | null {
    const anchorWorldPos = this.getAnchorWorldPosition({ experienceId });
    if (!anchorWorldPos) return null;

    return userWorldPosition.distanceTo(anchorWorldPos);
  }

  /**
   * Check if user is within anchor's geofence
   */
  isUserInGeofence(
    experienceId: string, 
    userWorldPosition: THREE.Vector3
  ): boolean {
    const anchor = this.anchors.get(experienceId);
    if (!anchor) return false;

    const distance = this.getDistanceToAnchor(experienceId, userWorldPosition);
    return distance !== null && distance <= anchor.geofenceRadius;
  }

  /**
   * Get anchors within range of user position
   */
  getAnchorsInRange(
    userWorldPosition: THREE.Vector3, 
    maxDistance: number = 100
  ): WorldAnchor[] {
    return this.getAllAnchors().filter(anchor => {
      const distance = userWorldPosition.distanceTo(anchor.worldPosition);
      return distance <= maxDistance;
    });
  }

  /**
   * Set global debug offset (for testing)
   */
  setGlobalDebugOffset(offset: THREE.Vector3 | null): void {
    this.globalDebugOffset = offset;
    console.log(`🔗 Global debug offset: ${offset ? `(${offset.x}, ${offset.y}, ${offset.z})` : 'cleared'}`);
  }

  /**
   * Update anchor position (for manual adjustments)
   */
  updateAnchorPosition(
    experienceId: string, 
    newGpsCoordinates: [number, number], 
    newElevation?: number
  ): boolean {
    const anchor = this.anchors.get(experienceId);
    if (!anchor) return false;

    // Update GPS coordinates
    anchor.gpsCoordinates = newGpsCoordinates;
    if (newElevation !== undefined) {
      anchor.elevationOffset = newElevation;
    }

    // Recalculate world position
    anchor.worldPosition = this.worldSystem.gpsToWorld(
      newGpsCoordinates,
      anchor.elevationOffset
    );

    console.log(`🔗 Updated anchor ${experienceId} to world position (${anchor.worldPosition.x.toFixed(1)}, ${anchor.worldPosition.y.toFixed(1)}, ${anchor.worldPosition.z.toFixed(1)})`);
    return true;
  }

  /**
 * Reset all anchors to their original positions from mapRouteData
 */
resetAllAnchorsToOriginal(): void {
  console.log('🔗 AnchorManager: Resetting all anchors to original positions...');
  
  // Clear current anchors
  this.anchors.clear();
  
  // Reload from route data (this calls the existing loadAnchorsFromRouteData logic)
  this.loadAnchorsFromRouteData();
  
  console.log('🔗 AnchorManager: All anchors reset to original positions');
}

/**
 * Reset a specific anchor to its original position
 */
resetAnchorToOriginal(experienceId: string): boolean {
  // Find the original anchor data in routePointsData
  const originalFeature = routePointsData.features.find(
    feature => feature.properties.iconName === experienceId
  );
  
  if (!originalFeature || !originalFeature.properties.arAnchor) {
    console.warn(`🔗 AnchorManager: No original anchor data found for ${experienceId}`);
    return false;
  }
  
  const originalAnchor = originalFeature.properties.arAnchor;
  
  // Update the anchor to original position
  return this.updateAnchorPosition(
    experienceId,
    originalAnchor.coordinates,
    originalAnchor.elevation || 0
  );
}

  /**
   * Get anchor metadata for geofencing
   */
  getGeofenceConfig(experienceId: string): {
    shape: 'circle' | 'hexagon';
    radius: number;
    directionSensitive: boolean;
    entryMessages?: Record<string, string>;
  } | null {
    const anchor = this.anchors.get(experienceId);
    if (!anchor) return null;

    return {
      shape: anchor.geofenceShape,
      radius: anchor.geofenceRadius,
      directionSensitive: anchor.directionSensitive,
      entryMessages: anchor.entryMessages
    };
  }

  /**
   * Generate debug info for display
   */
  getDebugInfo(experienceId?: string): {
    totalAnchors: number;
    debugMode: boolean;
    requestedAnchor?: {
      id: string;
      gpsCoordinates: [number, number];
      worldPosition: THREE.Vector3;
      geofenceShape: string;
      geofenceRadius: number;
    };
  } {
    const debugInfo = {
      totalAnchors: this.anchors.size,
      debugMode: this.debugMode
    };

    if (experienceId) {
      const anchor = this.anchors.get(experienceId);
      if (anchor) {
        (debugInfo as any).requestedAnchor = {
          id: anchor.id,
          gpsCoordinates: anchor.gpsCoordinates,
          worldPosition: anchor.worldPosition,
          geofenceShape: anchor.geofenceShape,
          geofenceRadius: anchor.geofenceRadius
        };
      }
    }

    return debugInfo;
  }

  /**
   * Test anchor system integrity
   */
  runAnchorTest(): {
    totalAnchors: number;
    validAnchors: number;
    invalidAnchors: string[];
    withinBounds: number;
    averageDistance: number;
  } {
    const allAnchors = this.getAllAnchors();
    const invalidAnchors: string[] = [];
    let validCount = 0;
    let withinBoundsCount = 0;
    let totalDistance = 0;

    allAnchors.forEach(anchor => {
      // Check if anchor is valid
      if (anchor.worldPosition && !isNaN(anchor.worldPosition.x)) {
        validCount++;
        
        // Check if within Kenilworth bounds
        if (this.worldSystem.isWithinKenilworth(anchor.gpsCoordinates)) {
          withinBoundsCount++;
        }
        
        // Calculate distance from origin
        const distance = anchor.worldPosition.length();
        totalDistance += distance;
      } else {
        invalidAnchors.push(anchor.id);
      }
    });

    const averageDistance = validCount > 0 ? totalDistance / validCount : 0;

    console.log(`🔗 Anchor Test Results:`, {
      total: allAnchors.length,
      valid: validCount,
      invalid: invalidAnchors.length,
      withinBounds: withinBoundsCount,
      averageDistance: averageDistance.toFixed(1) + 'm'
    });

    return {
      totalAnchors: allAnchors.length,
      validAnchors: validCount,
      invalidAnchors,
      withinBounds: withinBoundsCount,
      averageDistance
    };
  }
}