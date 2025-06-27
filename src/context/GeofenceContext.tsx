// src/context/GeofenceContext.tsx
import React, { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { useGeofenceManager } from '../hooks/useGeofenceManager';
import { useEnhancedGeofenceManager, PositionQuality } from '../hooks/useEnhancedGeofenceManager';
import { routePointsData } from '../data/mapRouteData';
import { universalModeManager, UniversalModeReason } from '../utils/UniversalModeManager';

// Enhanced type with universal mode from manager
type EnhancedGeofenceManagerType = ReturnType<typeof useEnhancedGeofenceManager> & {
  isUniversalMode: boolean;
  universalModeReason: UniversalModeReason | null;
};

type OriginalGeofenceManagerType = ReturnType<typeof useGeofenceManager> & {
  isUniversalMode: boolean;
  universalModeReason: UniversalModeReason | null;
};

export type GeofenceManagerType = EnhancedGeofenceManagerType;

const GeofenceContext = createContext<GeofenceManagerType | null>(null);

interface GeofenceProviderProps {
  children: ReactNode;
  usePrecisionEnhancements?: boolean;
}

export const GeofenceProvider: React.FC<GeofenceProviderProps> = ({ 
  children,
  usePrecisionEnhancements = true
}) => {
  
  // Universal mode state (from standalone manager)
  const [isUniversalMode, setIsUniversalMode] = useState(false);
  const [universalModeReason, setUniversalModeReason] = useState<UniversalModeReason | null>(null);
  
  // Initialize universal mode manager
  useEffect(() => {
    const initializeUniversalMode = async () => {
      await universalModeManager.initialize();
      
      // Set initial state
      setIsUniversalMode(universalModeManager.isUniversal);
      setUniversalModeReason(universalModeManager.reason);
      
      // Listen for changes
      const handleUniversalModeChange = (event: CustomEvent) => {
        const { enabled, reason } = event.detail;
        setIsUniversalMode(enabled);
        setUniversalModeReason(reason);
      };
      
      universalModeManager.addEventListener('universalModeChanged', handleUniversalModeChange as EventListener);
      
      return () => {
        universalModeManager.removeEventListener('universalModeChanged', handleUniversalModeChange as EventListener);
      };
    };
    
    initializeUniversalMode();
  }, []);
  
  // Enhanced manager with precision improvements (NO UNIVERSAL MODE LOGIC)
  const enhancedManager = useEnhancedGeofenceManager(routePointsData, {
    proximityThreshold: 20,
    debugMode: true,
    autoStart: true,
    
    // Precision settings (unchanged)
    maxAcceptableAccuracy: 10,
    minAcceptableAccuracy: 50,
    positionAveragingWindow: 12,
    requireStablePosition: true,
    stabilityThreshold: 3,
    stabilityDuration: 8000,
    qualityUpdateInterval: 2000
  });
  
  // Original manager (NO UNIVERSAL MODE LOGIC)
  const originalManager = useGeofenceManager(routePointsData, {
    debugMode: true,
    autoStart: true
  });
  
  // Choose base manager
  const baseManager = usePrecisionEnhancements ? enhancedManager : originalManager;
  
  // Combine base manager with universal mode from standalone manager
  const activeManager: GeofenceManagerType = {
    ...baseManager,
    isUniversalMode,
    universalModeReason
  } as GeofenceManagerType;
  
  // Handle permission-based universal mode changes
  useEffect(() => {
    // This could be enhanced to detect actual permission changes
    // For now, we rely on the manager's initialization
  }, []);
  
  return (
    <GeofenceContext.Provider value={activeManager}>
      {children}
    </GeofenceContext.Provider>
  );
};

// Rest of the exports remain the same
export const useGeofenceContext = (): GeofenceManagerType => {
  const context = useContext(GeofenceContext);
  if (!context) {
    throw new Error('useGeofenceContext must be used within a GeofenceProvider');
  }
  return context;
};

export { PositionQuality };

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
    getCurrentRadius: context.getCurrentRadius,
    isUniversalMode: context.isUniversalMode, // Now from standalone manager
    universalModeReason: context.universalModeReason // NEW: expose the reason
  };
};