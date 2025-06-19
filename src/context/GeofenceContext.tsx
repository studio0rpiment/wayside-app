// src/context/GeofenceContext.tsx
import React, { createContext, useContext, ReactNode } from 'react';
import { useGeofenceManager } from '../hooks/useGeofenceManager';
import { useEnhancedGeofenceManager, PositionQuality } from '../hooks/useEnhancedGeofenceManager';
import { routePointsData } from '../data/mapRouteData';

// OPTION 1: Enhanced manager with precision improvements (RECOMMENDED)
type EnhancedGeofenceManagerType = ReturnType<typeof useEnhancedGeofenceManager>;

// OPTION 2: Original manager (fallback/comparison)
type OriginalGeofenceManagerType = ReturnType<typeof useGeofenceManager>;

// Export the enhanced type as the default
export type GeofenceManagerType = EnhancedGeofenceManagerType;

// Create the context
const GeofenceContext = createContext<GeofenceManagerType | null>(null);

// Provider component
interface GeofenceProviderProps {
  children: ReactNode;
  // Optional prop to switch between managers for testing
  usePrecisionEnhancements?: boolean;
}

export const GeofenceProvider: React.FC<GeofenceProviderProps> = ({ 
  children,
  usePrecisionEnhancements = true  // Default to enhanced version
}) => {
  
  // Enhanced manager with precision improvements
  const enhancedManager = useEnhancedGeofenceManager(routePointsData, {
    proximityThreshold: 20,  // Your current setting
    debugMode: true,         // Your current setting  
    autoStart: true,         // Your current setting
    
    // NEW precision settings optimized for AR
    maxAcceptableAccuracy: 10,      // Only use readings better than 10m
    minAcceptableAccuracy: 30,      // Stop functioning if worse than 30m
    positionAveragingWindow: 5,     // Average last 5 positions
    requireStablePosition: true,    // Wait for stable positioning
    stabilityThreshold: 3,          // Must stay within 3m
    stabilityDuration: 5000,        // For 5 seconds
    qualityUpdateInterval: 2000     // Check quality every 2 seconds
  });
  
  // Original manager (for comparison/fallback)
  const originalManager = useGeofenceManager(routePointsData, {
    debugMode: true,
    autoStart: true
  });
  
  // Choose which manager to use
  // During development, you can switch this to test differences
  const activeManager = usePrecisionEnhancements ? enhancedManager : originalManager as any;
  
  return (
    <GeofenceContext.Provider value={activeManager}>
      {children}
    </GeofenceContext.Provider>
  );
};

// Custom hook to use the context
export const useGeofenceContext = (): GeofenceManagerType => {
  const context = useContext(GeofenceContext);
  if (!context) {
    throw new Error('useGeofenceContext must be used within a GeofenceProvider');
  }
  return context;
};

// Export position quality enum for use in components
export { PositionQuality };

// Helper hook for components that only need precision data
export const useGeofencePrecision = () => {
  const context = useGeofenceContext();
  
  return {
    currentAccuracy: context.currentAccuracy || null,
    positionQuality: context.positionQuality || PositionQuality.UNACCEPTABLE,
    isPositionStable: context.isPositionStable || false,
    averagedPosition: context.averagedPosition || null,
    positionHistory: context.positionHistory || [],
    getPositionStats: context.getPositionStats || (() => ({}))
  };
};

// Helper hook for backward compatibility
export const useGeofenceBasics = () => {
  const context = useGeofenceContext();
  
  return {
    userPosition: context.userPosition,
    activeGeofences: context.activeGeofences,
    isTracking: context.isTracking,
    startTracking: context.startTracking,
    stopTracking: context.stopTracking,
    isInsideGeofence: context.isInsideGeofence,
    getDistanceTo: context.getDistanceTo,
    getDistanceToPoint: context.getDistanceToPoint,
    getCurrentRadius: context.getCurrentRadius
  };
};