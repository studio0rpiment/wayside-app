// src/context/GeofenceContext.tsx
import React, { createContext, useContext, ReactNode } from 'react';
import { useGeofenceManager } from '../hooks/useGeofenceManager';
import { routePointsData } from '../data/mapRouteData';

// Get the type from the hook
type GeofenceManagerType = ReturnType<typeof useGeofenceManager>;

// Create the context
const GeofenceContext = createContext<GeofenceManagerType | null>(null);

// Provider component
interface GeofenceProviderProps {
  children: ReactNode;
}

export const GeofenceProvider: React.FC<GeofenceProviderProps> = ({ children }) => {
  // This is the ONLY place where useGeofenceManager runs
  const geofenceManager = useGeofenceManager(routePointsData, {
    debugMode: true,
    autoStart: true
  });
  
  return (
    <GeofenceContext.Provider value={geofenceManager}>
      {children}
    </GeofenceContext.Provider>
  );
};

// Custom hook to use the context
export const useGeofenceContext = () => {
  const context = useContext(GeofenceContext);
  if (!context) {
    throw new Error('useGeofenceContext must be used within a GeofenceProvider');
  }
  return context;
};