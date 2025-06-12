// GeofenceDebugger.tsx
import React, { useState, useEffect } from 'react';
import { useGeofenceContext } from '../../context/GeofenceContext'; // Add this import
import { routePointsData } from '../../data/mapRouteData';

interface GeofenceDebuggerProps {
  // Remove the old props since we'll get them from context
  // userPosition: [number, number] | null;
  // radius?: number;
  // onRadiusChange?: (radius: number) => void;
}

// Remove the props and get data from context
const GeofenceDebugger: React.FC<GeofenceDebuggerProps> = () => {
  // Get data from context instead of props
  const {
    userPosition,
    activeGeofences,
    getCurrentRadius
  } = useGeofenceContext();
  
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [customRadius, setCustomRadius] = useState(getCurrentRadius());
  const [updateCount, setUpdateCount] = useState(0);

  useEffect(() => {
    if (updateCount > 10) return;
    
    // Update global radius only when new
    if (window.geofenceDebuggerRadius !== customRadius) {
      window.geofenceDebuggerRadius = customRadius;
    }
  }, [customRadius]);
  
  // Update customRadius when context radius changes
  useEffect(() => {
    const contextRadius = getCurrentRadius();
    if (contextRadius !== customRadius) {
      setCustomRadius(contextRadius);
    }
  }, [getCurrentRadius(), customRadius]);
  
  return (
    <div 
      style={{
        position: 'absolute',
        top: '78px',
        right: '10px',
        zIndex: 100,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        color: 'white',
        padding: '10px',
        borderRadius: '5px',
        maxWidth: '300px',
        maxHeight: isCollapsed ? 'auto' : '50vh',
        overflowY: 'auto',
        fontFamily: 'monospace',
        fontSize: '12px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isCollapsed ? 0 : '10px' }}>
        <h3 style={{ margin: '0', fontSize: '14px' }}>Geofence Debugger</h3>
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          style={{
            background: 'none',
            border: 'none',
            color: 'white',
            cursor: 'pointer',
            fontSize: '14px',
            padding: '2px 5px'
          }}
        >
          {isCollapsed ? '+' : '-'}
        </button>
      </div>
      
      {!isCollapsed && (
        <>
          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>
              Geofence Radius: {customRadius}m
            </label>
            <input 
              type="range" 
              min="1" 
              max="500000" 
              value={customRadius} 
              onChange={(e) => setCustomRadius(parseInt(e.target.value))}
              style={{ width: '100%' }}
            />

          </div>
          
          {userPosition ? (
            <>
              <div style={{ marginBottom: '10px' }}>
                {/* <strong>User Position:</strong><br/> */}
                {userPosition[0].toFixed(6)}
                +{userPosition[1].toFixed(6)}
              </div>
              
              <div>
                <strong>Active Geofences ({activeGeofences.length})</strong>
                {activeGeofences.length > 0 ? (
                  <ul style={{ margin: '0px 0', paddingLeft: '20px' }}>
                    {/* {activeGeofences.map(fence => (
                      <li key={fence.id}>
                        {fence.title} ({fence.distance.toFixed(2)}m)
                      </li>
                    ))} */}
                  </ul>
                ) : (
                  <p style={{ margin: '5px 0' }}>Not inside any geofence</p>
                )}
              </div>
            </>
          ) : (
            <p>Waiting for user position...</p>
          )}
        </>
      )}
    </div>
  );
};

export default GeofenceDebugger;