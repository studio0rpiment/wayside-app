// src/hooks/useGeofenceManager.ts
import { useState, useEffect, useRef, useCallback } from 'react';
import { calculateDistance, checkGeofences } from '../utils/geoUtils';
import { usePermissions } from '../context/PermissionsContext';
import { PermissionType } from '../utils/permissions';

// Simplified interfaces
export interface GeofenceOptions {
  proximityThreshold?: number;
  debugMode?: boolean;
  autoStart?: boolean;
}

export interface GeofenceEntry {
  id: string;
  title: string;
  distance: number;
  isActive: boolean;
  properties: any;
}

export function useGeofenceManager(
  mapRouteData: any,
  options: GeofenceOptions = {}
) {
  const {
    proximityThreshold = 50,
    debugMode = false,
    autoStart = false
  } = options;
  
  // Core state
  const [userPosition, setUserPosition] = useState<[number, number] | null>(null);
  const [activeGeofences, setActiveGeofences] = useState<GeofenceEntry[]>([]);
  const [isTracking, setIsTracking] = useState(false);
  
  // Refs
  const watchIdRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);
  
  // Access permissions
  const { isPermissionGranted } = usePermissions();
  
  // Simple debug logging
  const debugLog = useCallback((message: string, ...args: any[]) => {
    if (debugMode) {
      console.log(`🧭 [GeoManager] ${message}`, ...args);
    }
  }, [debugMode]);
  
  // Get current radius (with debugger support)
  const getCurrentRadius = useCallback(() => {
    const debugRadius = typeof window !== 'undefined' ? window.geofenceDebuggerRadius : undefined;
    const effectiveRadius = debugRadius !== undefined ? debugRadius : proximityThreshold;
    return effectiveRadius;
  }, [proximityThreshold]);
  
  // Process geofences with enhanced debugging
  const processGeofences = useCallback((position: [number, number]) => {
    if (!mapRouteData?.features || !isMountedRef.current) {
      debugLog('Cannot process geofences - no data or unmounted');
      return;
    }
    
    const radius = getCurrentRadius();
    debugLog('=== PROCESSING GEOFENCES ===');
    debugLog('User position:', position);
    debugLog('Radius:', radius);
    debugLog('Available features:', mapRouteData.features.length);
    
    try {
      // Call the geofence checking function
      const results = checkGeofences(position, mapRouteData.features, radius);
      
      debugLog('Raw checkGeofences results:', results);
      
      // Validate results structure
      if (!results) {
        debugLog('ERROR: checkGeofences returned null/undefined');
        setActiveGeofences([]);
        return;
      }
      
      if (!results.insideGeofences) {
        debugLog('ERROR: results.insideGeofences is missing');
        setActiveGeofences([]);
        return;
      }
      
      debugLog('Inside geofences count:', results.insideGeofences.length);
      debugLog('Inside geofences data:', results.insideGeofences);
      
      // Create safe geofence entries
      const newActiveGeofences = results.insideGeofences.map((geofence, index) => {
        debugLog(`Processing geofence ${index}:`, geofence);
        
        const safeGeofence = {
          id: geofence.id || `geofence-${index}`,
          title: geofence.title || geofence.id || `Unknown-${index}`,
          distance: typeof geofence.distance === 'number' ? geofence.distance : 0, // Keep the actual distance
          isActive: true,
          properties: geofence.properties || {}
        };
        
        debugLog('Created safe geofence:', safeGeofence);
        return safeGeofence;
      });
      
      debugLog(`Final result: ${newActiveGeofences.length} active geofences`);
      debugLog('Setting active geofences:', newActiveGeofences);
      
      setActiveGeofences(newActiveGeofences);
      
    } catch (error) {
      console.error('Error in processGeofences:', error);
      debugLog('ERROR in processGeofences:', error);
      setActiveGeofences([]);
    }
  }, [mapRouteData, getCurrentRadius, debugLog]);
  
  // Start tracking - simplified
  const startTracking = useCallback(async () => {
    if (isTracking) {
      debugLog('Already tracking, ignoring start request');
      return true;
    }
    
    if (!isPermissionGranted(PermissionType.LOCATION)) {
      debugLog('Location permission not granted');
      return false;
    }
    
    debugLog('Starting location tracking...');
    
    try {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          if (!isMountedRef.current) return;
          
          const newPosition: [number, number] = [
            position.coords.longitude,
            position.coords.latitude
          ];
          
          debugLog('GPS position updated:', newPosition);
          setUserPosition(newPosition);
          
          // Process geofences directly with new position
          processGeofences(newPosition);
        },
        (error) => {
          console.error('Geolocation error:', error);
          debugLog('Geolocation error:', error);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 10000,
          timeout: 15000
        }
      );
      
      watchIdRef.current = watchId;
      setIsTracking(true);
      debugLog('Location tracking started successfully');
      return true;
      
    } catch (error) {
      console.error('Failed to start tracking:', error);
      debugLog('Failed to start tracking:', error);
      return false;
    }
  }, [isTracking, isPermissionGranted, processGeofences, debugLog]);
  
  // Stop tracking - simplified
  const stopTracking = useCallback(() => {
    debugLog('Stopping location tracking...');
    
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    
    setIsTracking(false);
    setActiveGeofences([]); // Clear geofences when stopping
    debugLog('Location tracking stopped');
  }, [debugLog]);
  
  // Auto-start effect
  useEffect(() => {
    if (autoStart && !isTracking) {
      debugLog('Auto-start enabled, starting tracking in 1 second...');
      const timeout = setTimeout(() => {
        if (isMountedRef.current) {
          startTracking();
        }
      }, 1000);
      
      return () => clearTimeout(timeout);
    }
  }, [autoStart, isTracking, startTracking, debugLog]);
  
  // Cleanup on unmount
  useEffect(() => {
    debugLog('useGeofenceManager mounted');
    
    return () => {
      debugLog('useGeofenceManager unmounting, cleaning up...');
      isMountedRef.current = false;
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [debugLog]);
  
  // Public API
  return {
    // State
    userPosition,
    activeGeofences,
    isTracking,
    
    // Methods
    startTracking,
    stopTracking,
    
    // Utilities

    simulatePosition: (position: [number, number]) => {
      debugLog('=== SIMULATING POSITION ===');
      debugLog('Simulated position:', position);
      setUserPosition(position);
      processGeofences(position);
    },

    isInsideGeofence: (geofenceId: string) => {
      const result = activeGeofences.some(g => g.id === geofenceId);
      debugLog(`isInsideGeofence(${geofenceId}):`, result);
      return result;
    },
    
    getDistanceTo: (geofenceId: string) => {
      const geofence = activeGeofences.find(g => g.id === geofenceId);
      const distance = geofence?.distance ?? null;
      debugLog(`getDistanceTo(${geofenceId}):`, distance);
      return distance;
    },
    
     getDistanceToPoint: (pointId: string) => {
    if (!userPosition || !mapRouteData?.features) return null;
    
    // Find the point in our route data
    const pointFeature = mapRouteData.features.find(
      (      feature: { properties: { iconName: string; }; }) => feature.properties.iconName === pointId
    );
    
    if (!pointFeature) {
      debugLog(`Point ${pointId} not found in route data`);
      return null;
    }
    
    const pointCoords = pointFeature.geometry.coordinates;
    
    // Calculate distance using the same function that checkGeofences uses
    try {
      // Import calculateDistance if not already imported
      const distance = calculateDistance(userPosition, pointCoords);
      debugLog(`Distance to ${pointId}: ${distance}m`);
      return distance;
    } catch (error) {
      console.error('Error calculating distance:', error);
      return null;
    }
  },

    
    // Debug helpers
    getCurrentRadius,
    processGeofences: () => {
      if (userPosition) {
        debugLog('Manual processGeofences trigger');
        processGeofences(userPosition);
      } else {
        debugLog('Cannot manually process geofences - no user position');
      }
    }
  };
}

// Global type declaration
declare global {
  interface Window {
    geofenceDebuggerRadius?: number;
  }
}