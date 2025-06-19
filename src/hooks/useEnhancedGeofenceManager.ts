// src/hooks/useEnhancedGeofenceManager.ts
import { useState, useEffect, useRef, useCallback } from 'react';
import { calculateDistance, checkGeofences } from '../utils/geoUtils';
import { usePermissions } from '../context/PermissionsContext';
import { PermissionType } from '../utils/permissions';

// Enhanced position data with accuracy tracking
export interface EnhancedPositionData {
  coordinates: [number, number];
  accuracy: number;              // GPS accuracy in meters
  timestamp: number;             // When this reading was taken
  altitude?: number;             // Altitude if available
  altitudeAccuracy?: number;     // Altitude accuracy if available
  heading?: number;              // Movement direction if available
  speed?: number;                // Movement speed if available
}

// Position quality levels
export enum PositionQuality {
  EXCELLENT = 'excellent',    // < 3m accuracy
  GOOD = 'good',             // 3-8m accuracy  
  FAIR = 'fair',             // 8-15m accuracy
  POOR = 'poor',             // 15-30m accuracy
  UNACCEPTABLE = 'unacceptable' // > 30m accuracy
}

// Enhanced geofence options
export interface EnhancedGeofenceOptions {
  proximityThreshold?: number;
  debugMode?: boolean;
  autoStart?: boolean;
  
  // NEW precision options
  maxAcceptableAccuracy?: number;    // Only accept readings better than this (meters)
  minAcceptableAccuracy?: number;    // Minimum accuracy to function (meters)
  positionAveragingWindow?: number;  // Number of positions to average
  qualityUpdateInterval?: number;    // How often to check quality (ms)
  requireStablePosition?: boolean;   // Wait for position to stabilize
  stabilityThreshold?: number;       // Max movement to consider "stable" (meters)
  stabilityDuration?: number;        // How long position must be stable (ms)
}

export interface GeofenceEntry {
  id: string;
  title: string;
  distance: number;
  isActive: boolean;
  properties: any;
}

// Enhanced geofence manager with precision improvements
export function useEnhancedGeofenceManager(
  mapRouteData: any,
  options: EnhancedGeofenceOptions = {}
) {
  const {
    proximityThreshold = 5,
    debugMode = false,
    autoStart = false,
    
    // Precision defaults
    maxAcceptableAccuracy = 10,      // Only use readings better than 10m
    minAcceptableAccuracy = 50,      // Stop functioning if worse than 30m
    positionAveragingWindow = 5,     // Average last 5 positions
    qualityUpdateInterval = 2000,    // Update quality every 2 seconds
    requireStablePosition = true,    // Wait for stable positioning
    stabilityThreshold = 3,          // Must stay within 3m
    stabilityDuration = 5000         // For 5 seconds
  } = options;
  
  // Core state
  const [userPosition, setUserPosition] = useState<[number, number] | null>(null);
  const [activeGeofences, setActiveGeofences] = useState<GeofenceEntry[]>([]);
  const [isTracking, setIsTracking] = useState(false);
  
  // NEW precision state
  const [currentAccuracy, setCurrentAccuracy] = useState<number | null>(null);
  const [positionQuality, setPositionQuality] = useState<PositionQuality>(PositionQuality.UNACCEPTABLE);
  const [isPositionStable, setIsPositionStable] = useState(false);
  const [positionHistory, setPositionHistory] = useState<EnhancedPositionData[]>([]);
  const [averagedPosition, setAveragedPosition] = useState<[number, number] | null>(null);
  
  // Refs
  const watchIdRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);
  const lastStableCheckRef = useRef<number>(0);
  
  // Access permissions
  const { isPermissionGranted } = usePermissions();
  
  // Enhanced debug logging
  const debugLog = useCallback((message: string, data?: any) => {
    if (debugMode) {
      const timestamp = new Date().toISOString();
      console.log(`🎯 [EnhancedGeoManager ${timestamp}] ${message}`, data || '');
    }
  }, [debugMode]);
  
  // Determine position quality from accuracy
  const getPositionQuality = useCallback((accuracy: number): PositionQuality => {
    if (accuracy <= 3) return PositionQuality.EXCELLENT;
    if (accuracy <= 8) return PositionQuality.GOOD;
    if (accuracy <= 15) return PositionQuality.FAIR;
    if (accuracy <= 50) return PositionQuality.POOR;
    return PositionQuality.UNACCEPTABLE;
  }, []);
  
  // Calculate weighted average position from history
  const calculateAveragedPosition = useCallback((history: EnhancedPositionData[]): [number, number] => {
    if (history.length === 0) return [0, 0];
    if (history.length === 1) return history[0].coordinates;
    
    // Weight more recent and more accurate positions higher
    let totalWeight = 0;
    let weightedLon = 0;
    let weightedLat = 0;
    
    const now = Date.now();
    
    history.forEach((pos, index) => {
      // Accuracy weight (better accuracy = higher weight)
      const accuracyWeight = 1 / Math.max(pos.accuracy, 1);
      
      // Recency weight (more recent = higher weight)
      const ageMs = now - pos.timestamp;
      const recencyWeight = Math.exp(-ageMs / 10000); // Decay over 10 seconds
      
      // Position weight (later in array = more recent = higher weight)
      const positionWeight = (index + 1) / history.length;
      
      const combinedWeight = accuracyWeight * recencyWeight * positionWeight;
      
      weightedLon += pos.coordinates[0] * combinedWeight;
      weightedLat += pos.coordinates[1] * combinedWeight;
      totalWeight += combinedWeight;
    });
    
    if (totalWeight === 0) return history[history.length - 1].coordinates;
    
    return [weightedLon / totalWeight, weightedLat / totalWeight];
  }, []);
  
  // Check if position is stable
  const checkPositionStability = useCallback((history: EnhancedPositionData[]): boolean => {
    if (history.length < 2) return false;
    
    const now = Date.now();
    const recentPositions = history.filter(pos => 
      now - pos.timestamp <= stabilityDuration
    );
    
    if (recentPositions.length < 2) return false;
    
    // Check if all recent positions are within stability threshold
    const firstPos = recentPositions[0].coordinates;
    return recentPositions.every(pos => {
      const distance = calculateDistance(firstPos, pos.coordinates);
      return distance <= stabilityThreshold;
    });
  }, [stabilityDuration, stabilityThreshold]);
  
  // Process new GPS position with enhanced precision handling
  const processNewPosition = useCallback((position: GeolocationPosition) => {
    const { coords } = position;
    const timestamp = Date.now();
    
    debugLog('Raw GPS reading', {
      lat: coords.latitude,
      lon: coords.longitude,
      accuracy: coords.accuracy,
      altitude: coords.altitude,
      altitudeAccuracy: coords.altitudeAccuracy,
      heading: coords.heading,
      speed: coords.speed
    });
    
    // Create enhanced position data
    const enhancedPosition: EnhancedPositionData = {
      coordinates: [coords.longitude, coords.latitude],
      accuracy: coords.accuracy,
      timestamp,
      altitude: coords.altitude || undefined,
      altitudeAccuracy: coords.altitudeAccuracy || undefined,
      heading: coords.heading || undefined,
      speed: coords.speed || undefined
    };
    
    // Determine quality
    const quality = getPositionQuality(coords.accuracy);
    setPositionQuality(quality);
    setCurrentAccuracy(coords.accuracy);
    
    debugLog('Position quality assessment', {
      accuracy: coords.accuracy,
      quality,
      acceptable: coords.accuracy <= maxAcceptableAccuracy
    });
    
    // Check if accuracy is acceptable
    if (coords.accuracy > minAcceptableAccuracy) {
      debugLog('Position accuracy too poor, ignoring', {
        accuracy: coords.accuracy,
        maxAcceptable: minAcceptableAccuracy
      });
      return;
    }
    
    // Add to position history
    setPositionHistory(prev => {
      const newHistory = [...prev, enhancedPosition];
      
      // Keep only recent positions within window
      const cutoffTime = timestamp - (qualityUpdateInterval * positionAveragingWindow);
      const trimmedHistory = newHistory.filter(pos => pos.timestamp > cutoffTime);
      
      // Limit to window size
      return trimmedHistory.slice(-positionAveragingWindow);
    });
    
  }, [maxAcceptableAccuracy, minAcceptableAccuracy, getPositionQuality, qualityUpdateInterval, positionAveragingWindow, debugLog]);
  
  // Update averaged position and stability when history changes
  useEffect(() => {
    if (positionHistory.length === 0) return;
    
    // Calculate new averaged position
    const averaged = calculateAveragedPosition(positionHistory);
    setAveragedPosition(averaged);
    
    // Check stability
    const stable = checkPositionStability(positionHistory);
    setIsPositionStable(stable);
    
    debugLog('Position analysis updated', {
      historyLength: positionHistory.length,
      averagedPosition: averaged,
      isStable: stable,
      accuracy: currentAccuracy,
      quality: positionQuality
    });
    
    // Only update user position if we have good enough accuracy
    const latestPosition = positionHistory[positionHistory.length - 1];
    const shouldUsePosition = latestPosition.accuracy <= maxAcceptableAccuracy && 
                             (!requireStablePosition || stable);
    
    if (shouldUsePosition) {
      // Use averaged position for better accuracy
      setUserPosition(averaged);
      debugLog('Updated user position', { position: averaged, method: 'averaged' });
    } else {
      debugLog('Position not ready for use', {
        accuracy: latestPosition.accuracy,
        maxAcceptable: maxAcceptableAccuracy,
        requireStable: requireStablePosition,
        isStable: stable
      });
    }
    
  }, [positionHistory, calculateAveragedPosition, checkPositionStability, maxAcceptableAccuracy, requireStablePosition, debugLog, currentAccuracy, positionQuality]);
  
  // Process geofences (unchanged logic, but now uses enhanced position)
  const processGeofences = useCallback((position: [number, number]) => {
    if (!mapRouteData?.features || !isMountedRef.current) {
      debugLog('Cannot process geofences - no data or unmounted');
      return;
    }
    
    const radius = typeof window !== 'undefined' ? 
      window.geofenceDebuggerRadius ?? proximityThreshold : proximityThreshold;
    
    debugLog('Processing geofences with enhanced position', {
      position,
      radius,
      accuracy: currentAccuracy,
      quality: positionQuality,
      isStable: isPositionStable
    });
    
    try {
      const results = checkGeofences(position, mapRouteData.features, radius);
      
      if (!results?.insideGeofences) {
        setActiveGeofences([]);
        return;
      }
      
      const newActiveGeofences = results.insideGeofences.map((geofence, index) => ({
        id: geofence.id || `geofence-${index}`,
        title: geofence.title || geofence.id || `Unknown-${index}`,
        distance: typeof geofence.distance === 'number' ? geofence.distance : 0,
        isActive: true,
        properties: geofence.properties || {}
      }));
      
      setActiveGeofences(newActiveGeofences);
      
    } catch (error) {
      console.error('Error in processGeofences:', error);
      setActiveGeofences([]);
    }
  }, [mapRouteData, proximityThreshold, currentAccuracy, positionQuality, isPositionStable, debugLog]);
  
  // Process geofences when position updates
  useEffect(() => {
    if (userPosition) {
      processGeofences(userPosition);
    }
  }, [userPosition, processGeofences]);
  
  // Enhanced start tracking with precision monitoring
  const startTracking = useCallback(async () => {
    if (isTracking) {
      debugLog('Already tracking, ignoring start request');
      return true;
    }
    
    if (!isPermissionGranted(PermissionType.LOCATION)) {
      debugLog('Location permission not granted');
      return false;
    }
    
    debugLog('Starting enhanced location tracking...', {
      maxAcceptableAccuracy,
      minAcceptableAccuracy,
      positionAveragingWindow,
      requireStablePosition
    });
    
    try {
      const watchId = navigator.geolocation.watchPosition(
        processNewPosition,
        (error) => {
          console.error('Enhanced geolocation error:', error);
          debugLog('Geolocation error', { error: error.message, code: error.code });
        },
        {
          enableHighAccuracy: true,
          maximumAge: 5000,        // Slightly more aggressive caching
          timeout: 20000           // Longer timeout for high accuracy
        }
      );
      
      watchIdRef.current = watchId;
      setIsTracking(true);
      debugLog('Enhanced location tracking started successfully');
      return true;
      
    } catch (error) {
      console.error('Failed to start enhanced tracking:', error);
      return false;
    }
  }, [isTracking, isPermissionGranted, processNewPosition, maxAcceptableAccuracy, minAcceptableAccuracy, positionAveragingWindow, requireStablePosition, debugLog]);
  
  // Stop tracking (enhanced cleanup)
  const stopTracking = useCallback(() => {
    debugLog('Stopping enhanced location tracking...');
    
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    
    setIsTracking(false);
    setActiveGeofences([]);
    setPositionHistory([]);
    setAveragedPosition(null);
    setCurrentAccuracy(null);
    setPositionQuality(PositionQuality.UNACCEPTABLE);
    setIsPositionStable(false);
    
    debugLog('Enhanced location tracking stopped and state cleared');
  }, [debugLog]);
  
  // Auto-start effect
  useEffect(() => {
    if (autoStart && !isTracking) {
      debugLog('Auto-start enabled, starting enhanced tracking...');
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
    debugLog('Enhanced geofence manager mounted');
    
    return () => {
      debugLog('Enhanced geofence manager unmounting...');
      isMountedRef.current = false;
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [debugLog]);
  
  // Enhanced public API
  return {
    // Original API
    userPosition,
    activeGeofences,
    isTracking,
    startTracking,
    stopTracking,
    
    // Enhanced precision data
    currentAccuracy,
    positionQuality,
    isPositionStable,
    averagedPosition,
    positionHistory: positionHistory.slice(-3), // Last 3 positions for debugging
    
    // Enhanced utilities
    simulatePosition: (position: [number, number]) => {
      debugLog('=== SIMULATING ENHANCED POSITION ===');
      const simulatedData: EnhancedPositionData = {
        coordinates: position,
        accuracy: 1.0, // Perfect accuracy for simulation
        timestamp: Date.now()
      };
      setPositionHistory([simulatedData]);
      setUserPosition(position);
      setCurrentAccuracy(1.0);
      setPositionQuality(PositionQuality.EXCELLENT);
      setIsPositionStable(true);
    },
    
    isInsideGeofence: (geofenceId: string) => {
      return activeGeofences.some(g => g.id === geofenceId);
    },
    
    getDistanceTo: (geofenceId: string) => {
      const geofence = activeGeofences.find(g => g.id === geofenceId);
      return geofence?.distance ?? null;
    },
    
    getDistanceToPoint: (pointId: string) => {
      if (!userPosition || !mapRouteData?.features) return null;
      
      const pointFeature = mapRouteData.features.find(
        (feature: { properties: { iconName: string; }; }) => feature.properties.iconName === pointId
      );
      
      if (!pointFeature) return null;
      
      try {
        return calculateDistance(userPosition, pointFeature.geometry.coordinates);
      } catch (error) {
        console.error('Error calculating distance:', error);
        return null;
      }
    },
    
    // Enhanced debug helpers
    getCurrentRadius: () => {
      return typeof window !== 'undefined' ? 
        window.geofenceDebuggerRadius ?? proximityThreshold : proximityThreshold;
    },
    
    getPositionStats: () => ({
      accuracy: currentAccuracy,
      quality: positionQuality,
      isStable: isPositionStable,
      historyLength: positionHistory.length,
      hasPosition: !!userPosition,
      isTracking
    })
  };
}