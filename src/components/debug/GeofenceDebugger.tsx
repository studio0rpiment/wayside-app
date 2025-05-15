// GeofenceDebugger.tsx
import React, { useState, useEffect } from 'react';
import { checkGeofences } from '../../utils/geoUtils';
import { routePointsData } from '../../data/mapRouteData';

interface GeofenceDebuggerProps {
  userPosition: [number, number] | null;
  radius?: number;
}

const GeofenceDebugger: React.FC<GeofenceDebuggerProps> = ({ 
  userPosition, 
  radius = 3 
}) => {
  const [geofenceResults, setGeofenceResults] = useState<ReturnType<typeof checkGeofences> | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [customRadius, setCustomRadius] = useState(radius);
  
  useEffect(() => {
    if (userPosition) {
      const results = checkGeofences(userPosition, routePointsData.features, customRadius);
      setGeofenceResults(results);
    }
  }, [userPosition, customRadius]);
  
  return (
    <div 
      style={{
        position: 'absolute',
        top: '10px',
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
              Radius: {customRadius}m
            </label>
            <input 
              type="range" 
              min="1" 
              max="50000" 
              value={customRadius} 
              onChange={(e) => setCustomRadius(parseInt(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>
          
          {userPosition ? (
            <>
              <div style={{ marginBottom: '10px' }}>
                <strong>User Position:</strong><br/>
                Lng: {userPosition[0].toFixed(6)}<br/>
                Lat: {userPosition[1].toFixed(6)}
              </div>
              
              {geofenceResults && (
                <div>
                  <strong>Any Experience ({geofenceResults.insideGeofences.length}):</strong>
                  {geofenceResults.insideGeofences.length > 0 ? (
                    <ul style={{ margin: '5px 0', paddingLeft: '20px' }}>
                      {geofenceResults.insideGeofences.map(fence => (
                        <li key={fence.id}>
                          {fence.title} ({fence.distance.toFixed(2)}m)
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p style={{ margin: '5px 0' }}>Not inside any experience</p>
                  )}
                </div>
              )}
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