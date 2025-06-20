// src/components/ar/ArPositioning.tsx
import React, { useEffect, useRef, useCallback, useState } from 'react';
import * as THREE from 'three';
import { 
  gpsToThreeJsPosition, 
  gpsToThreeJsPositionTerrain,
  getEnhancedAnchorPosition,
  calculateBearing,
  calculateGpsDistance 
} from '../../utils/geoArUtils';

// Types for different object references that experiences might use
export type ArObjectRef = 
  | React.RefObject<THREE.Points>          // modelRef (Mac, Helen, Volunteers, BC220)
  | React.RefObject<THREE.Group>           // waterSystemRef, smokeSystemRef, morphingGroupRef
  | React.RefObject<THREE.Object3D>        // Generic Three.js object
  | React.RefObject<THREE.Mesh>            // Mesh objects
  | null;

export interface ArPositioningProps {
  // Required props
  userGPS: [number, number] | null;
  anchorGPS: [number, number];
  experienceType: string;
  
  // Object reference to position
  objectRef: ArObjectRef;
  
  // Optional props with defaults
  override?: boolean;
  coordinateScale?: number;
  enableTerrainAwareness?: boolean;
  enableDebugLogging?: boolean;
  
  // Positioning options
  elevationOffset?: number;        // Manual elevation override
  centeringOffset?: THREE.Vector3; // Object centering offset (for point clouds)
  
  // Callbacks
  onPositionUpdate?: (position: THREE.Vector3, metadata: PositionMetadata) => void;
  onPositionError?: (error: string) => void;
  
  // Children (for wrapper usage)
  children?: React.ReactNode;
}

export interface PositionMetadata {
  distance: number;
  bearing: number;
  terrainElevation: number | null;
  usedTerrain: boolean;
  positioningMethod: 'override' | 'gps' | 'fallback';
  accuracy?: number;
  gpsSource: 'raw' | 'averaged' | 'manual';
}

const ArPositioning: React.FC<ArPositioningProps> = ({
  userGPS,
  anchorGPS,
  experienceType,
  objectRef,
  override = false,
  coordinateScale = 1.0,
  enableTerrainAwareness = true,
  enableDebugLogging = false,
  elevationOffset,
  centeringOffset,
  onPositionUpdate,
  onPositionError,
  children
}) => {
  // Refs for internal state management
  const lastPositionRef = useRef<THREE.Vector3 | null>(null);
  const positioningHistoryRef = useRef<Array<{ position: THREE.Vector3; timestamp: number; method: string }>>([]);
  
  // State for debug information
  const [debugInfo, setDebugInfo] = useState<{
    lastUpdate: number;
    totalUpdates: number;
    currentMethod: string;
    lastDistance: number;
    lastBearing: number;
  }>({
    lastUpdate: 0,
    totalUpdates: 0,
    currentMethod: 'none',
    lastDistance: 0,
    lastBearing: 0
  });

  // Experience-specific configuration
  const getExperienceConfig = useCallback((expType: string) => {
    const configs: Record<string, {
      defaultElevationOffset: number;
      requiresTerrain: boolean;
      description: string;
    }> = {
      // Point cloud experiences (Mac, Helen, Volunteers, BC220)
      'mac': { defaultElevationOffset: 0, requiresTerrain: true, description: 'Ranger Mac Point Cloud' },
      'helen_s': { defaultElevationOffset: 0, requiresTerrain: true, description: 'Helen Fowler Point Cloud' },
      'volunteers': { defaultElevationOffset: 0, requiresTerrain: true, description: 'Volunteers Point Cloud' },
      '2200_bc': { defaultElevationOffset: 0, requiresTerrain: true, description: '2200 BC Canoe Point Cloud' },
      
      // Water-based experiences (morphing plants)
      'lotus': { defaultElevationOffset: 0, requiresTerrain: true, description: 'Lotus Morphing Model' },
      'lily': { defaultElevationOffset: 0, requiresTerrain: true, description: 'Water Lily Morphing Model' },
      'cattail': { defaultElevationOffset: 0, requiresTerrain: true, description: 'Cattail Morphing Model' },
      
      // Environmental experiences
      '2030-2105': { defaultElevationOffset: 0, requiresTerrain: true, description: 'Water Rise System' },
      '1968': { defaultElevationOffset: 0, requiresTerrain: false, description: 'Smoke System' },
      
      // Default fallback
      'default': { defaultElevationOffset: 0, requiresTerrain: true, description: 'Generic AR Object' }
    };
    
    return configs[expType] || configs['default'];
  }, []);

  // Debug logging utility
  const debugLog = useCallback((message: string, data?: any) => {
    if (enableDebugLogging) {
      const timestamp = new Date().toISOString();
      console.log(`🎯 [ArPositioning ${timestamp}] ${experienceType}: ${message}`, data || '');
    }
  }, [enableDebugLogging, experienceType]);

  // Calculate position using appropriate method
  const calculatePosition = useCallback((): {
    position: THREE.Vector3;
    metadata: PositionMetadata;
  } | null => {
    debugLog('calculatePosition() called', {
      userGPS,
      anchorGPS,
      override,
      enableTerrainAwareness
    });

    // Handle override mode
    if (override) {
      const overridePosition = new THREE.Vector3(0, 0, -5);
      const metadata: PositionMetadata = {
        distance: 5,
        bearing: 0,
        terrainElevation: null,
        usedTerrain: false,
        positioningMethod: 'override',
        gpsSource: 'manual'
      };

      debugLog('Using override positioning', { position: overridePosition });
      return { position: overridePosition, metadata };
    }

    // Require GPS for real positioning
    if (!userGPS) {
      debugLog('No GPS position available');
      onPositionError?.('No GPS position available');
      return null;
    }

    const config = getExperienceConfig(experienceType);
    const finalElevationOffset = elevationOffset ?? config.defaultElevationOffset;

    try {
      let position: THREE.Vector3;
      let metadata: PositionMetadata;

      if (enableTerrainAwareness && config.requiresTerrain) {
        // Use terrain-aware positioning
        const result = gpsToThreeJsPositionTerrain(
          userGPS,
          anchorGPS,
          finalElevationOffset,
          coordinateScale,
          finalElevationOffset // fallback
        );

        position = result.position;
        metadata = {
          distance: calculateGpsDistance(userGPS, anchorGPS),
          bearing: calculateBearing(userGPS, anchorGPS),
          terrainElevation: result.terrainElevation,
          usedTerrain: result.usedTerrain,
          positioningMethod: 'gps',
          gpsSource: 'averaged' // Assume from enhanced geofence manager
        };

        debugLog('Terrain-aware positioning calculated', { 
          position, 
          terrainElevation: result.terrainElevation,
          usedTerrain: result.usedTerrain 
        });
      } else {
        // Use standard GPS positioning
        position = gpsToThreeJsPosition(
          userGPS,
          anchorGPS,
          finalElevationOffset,
          coordinateScale
        );

        metadata = {
          distance: calculateGpsDistance(userGPS, anchorGPS),
          bearing: calculateBearing(userGPS, anchorGPS),
          terrainElevation: null,
          usedTerrain: false,
          positioningMethod: 'gps',
          gpsSource: 'averaged'
        };

        debugLog('Standard GPS positioning calculated', { position });
      }

      // Apply centering offset if provided (for point clouds)
      if (centeringOffset) {
        position.add(centeringOffset);
        debugLog('Applied centering offset', { centeringOffset, finalPosition: position });
      }

      return { position, metadata };

    } catch (error) {
      const errorMessage = `Position calculation failed: ${error}`;
      debugLog('Position calculation error', error);
      onPositionError?.(errorMessage);
      return null;
    }
  }, [
    userGPS, 
    anchorGPS, 
    experienceType, 
    override, 
    coordinateScale, 
    enableTerrainAwareness,
    elevationOffset,
    centeringOffset,
    debugLog,
    onPositionError,
    getExperienceConfig
  ]);

  // Apply position to the object reference
  const applyPositionToObject = useCallback((
    newPosition: THREE.Vector3, 
    metadata: PositionMetadata
  ) => {
    if (!objectRef?.current) {
      debugLog('No object reference available to position');
      return false;
    }

    try {
      // Apply position to the object
      objectRef.current.position.copy(newPosition);
      
      // Store in history
      positioningHistoryRef.current.push({
        position: newPosition.clone(),
        timestamp: Date.now(),
        method: metadata.positioningMethod
      });

      // Keep only last 10 positions
      if (positioningHistoryRef.current.length > 10) {
        positioningHistoryRef.current.shift();
      }

      // Update debug info
      setDebugInfo(prev => ({
        lastUpdate: Date.now(),
        totalUpdates: prev.totalUpdates + 1,
        currentMethod: metadata.positioningMethod,
        lastDistance: metadata.distance,
        lastBearing: metadata.bearing
      }));

      lastPositionRef.current = newPosition.clone();

      debugLog('Position applied to object', {
        newPosition,
        metadata,
        objectType: objectRef.current.type
      });

      return true;
    } catch (error) {
      debugLog('Error applying position to object', error);
      onPositionError?.(`Failed to apply position: ${error}`);
      return false;
    }
  }, [objectRef, debugLog, onPositionError]);

  // Main positioning effect - runs when any dependency changes
  useEffect(() => {
    debugLog('Positioning effect triggered', {
      hasUserGPS: !!userGPS,
      hasObjectRef: !!objectRef?.current,
      override
    });

    const result = calculatePosition();
    if (!result) {
      debugLog('Position calculation returned null');
      return;
    }

    const { position, metadata } = result;

    // Apply position to object if reference exists
    if (objectRef?.current) {
      const success = applyPositionToObject(position, metadata);
      if (!success) return;
    }

    // Notify parent component
    onPositionUpdate?.(position, metadata);

  }, [
    userGPS,
    anchorGPS,
    experienceType,
    override,
    coordinateScale,
    enableTerrainAwareness,
    elevationOffset,
    centeringOffset,
    objectRef,
    calculatePosition,
    applyPositionToObject,
    onPositionUpdate
  ]);

  // Utility functions for external use
  const getLastPosition = useCallback(() => {
    return lastPositionRef.current?.clone() || null;
  }, []);

  const getPositionHistory = useCallback(() => {
    return [...positioningHistoryRef.current];
  }, []);

  const getCurrentMetadata = useCallback((): PositionMetadata | null => {
    if (!userGPS) return null;

    return {
      distance: calculateGpsDistance(userGPS, anchorGPS),
      bearing: calculateBearing(userGPS, anchorGPS),
      terrainElevation: null, // Would need to be calculated
      usedTerrain: enableTerrainAwareness,
      positioningMethod: override ? 'override' : 'gps',
      gpsSource: 'averaged'
    };
  }, [userGPS, anchorGPS, override, enableTerrainAwareness]);

  // Expose utility functions via imperative handle if needed. might be problematic since the object.ref is refereing to a threejs object type
//   React.useImperativeHandle(objectRef, () => ({
//     getLastPosition,
//     getPositionHistory,
//     getCurrentMetadata,
//     forcePositionUpdate: () => {
//       const result = calculatePosition();
//       if (result && objectRef?.current) {
//         applyPositionToObject(result.position, result.metadata);
//       }
//     }
//   }), [getLastPosition, getPositionHistory, getCurrentMetadata, calculatePosition, applyPositionToObject]);

  // Debug panel (only show if debug logging is enabled)
  const renderDebugPanel = () => {
    if (!enableDebugLogging) return null;

    const config = getExperienceConfig(experienceType);
    const currentMetadata = getCurrentMetadata();

    return (
      <div style={{
        position: 'fixed',
        top: '10px',
        right: '10px',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        color: 'white',
        padding: '10px',
        borderRadius: '4px',
        fontSize: '11px',
        fontFamily: 'monospace',
        zIndex: 1040,
        maxWidth: '300px',
        pointerEvents: 'auto'
      }}>
        <div style={{ color: 'cyan', marginBottom: '5px' }}>
          🎯 AR POSITIONING DEBUG - {experienceType.toUpperCase()}
        </div>
        
        <div>{config.description}</div>
        
        <div style={{ marginTop: '5px', fontSize: '10px' }}>
          Updates: {debugInfo.totalUpdates} | Method: {debugInfo.currentMethod}
        </div>
        
        {userGPS && (
          <div style={{ fontSize: '10px' }}>
            User: [{userGPS[0].toFixed(6)}, {userGPS[1].toFixed(6)}]
          </div>
        )}
        
        <div style={{ fontSize: '10px' }}>
          Anchor: [{anchorGPS[0].toFixed(6)}, {anchorGPS[1].toFixed(6)}]
        </div>
        
        {currentMetadata && (
          <>
            <div style={{ fontSize: '10px' }}>
              Distance: {currentMetadata.distance.toFixed(1)}m | 
              Bearing: {currentMetadata.bearing.toFixed(1)}°
            </div>
            
            {lastPositionRef.current && (
              <div style={{ fontSize: '10px', color: 'lightgreen' }}>
                3D Pos: [{lastPositionRef.current.x.toFixed(2)}, {lastPositionRef.current.y.toFixed(2)}, {lastPositionRef.current.z.toFixed(2)}]
              </div>
            )}
          </>
        )}
        
        <div style={{ 
          marginTop: '5px', 
          padding: '2px 4px',
          backgroundColor: override ? 'rgba(0, 255, 0, 0.2)' : 'rgba(255, 0, 0, 0.2)',
          borderRadius: '2px',
          fontSize: '9px'
        }}>
          {override ? '✅ Override Mode (0,0,-5)' : '🌍 GPS Positioning'}
        </div>
        
        {elevationOffset !== undefined && (
          <div style={{ fontSize: '9px' }}>
            Elevation Offset: {elevationOffset.toFixed(2)}m
          </div>
        )}
        
        {centeringOffset && (
          <div style={{ fontSize: '9px' }}>
            Centering: [{centeringOffset.x.toFixed(2)}, {centeringOffset.y.toFixed(2)}, {centeringOffset.z.toFixed(2)}]
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {renderDebugPanel()}
      {children}
    </>
  );
};

export default ArPositioning;