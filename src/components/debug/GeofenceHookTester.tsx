// src/components/debug/GeofenceHookTester.tsx
import React, { useState } from 'react';
import { useGeofenceManager } from '../../hooks/useGeofenceManager';
import { routePointsData } from '../../data/mapRouteData';

const GeofenceHookTester: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Use the simplified hook
  const {
    userPosition,
    activeGeofences,
    isTracking,
    startTracking,
    stopTracking,
    simulatePosition
  } = useGeofenceManager(routePointsData, {
    debugMode: true,
    autoStart: false
  });

  // Function to simulate moving to a test location
  const testSimulation = () => {
    // Use the first point from your data as a test
    if (routePointsData.features.length > 0) {
      const coords = routePointsData.features[0].geometry.coordinates as [number, number];
      simulatePosition(coords);
    }
  };

  return (
    <div style={{
      position: 'absolute',
      bottom: '10px',
      left: '10px',
      zIndex: 1000,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      color: 'white',
      padding: '10px',
      borderRadius: '5px',
      maxWidth: '300px',
      fontFamily: 'monospace',
      fontSize: '12px'
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        marginBottom: '5px',
        cursor: 'pointer' 
      }}
      onClick={() => setIsExpanded(!isExpanded)}>
        <h3 style={{ margin: 0 }}>🧭 Geofence Test (Simple)</h3>
        <span>{isExpanded ? '▼' : '▲'}</span>
      </div>

      {isExpanded && (
        <>
          <div style={{ marginBottom: '10px' }}>
            <div><strong>Status:</strong> {isTracking ? '✅ Tracking' : '❌ Not Tracking'}</div>
            
            {userPosition && (
              <div>
                <strong>Position:</strong> [{userPosition[0].toFixed(5)}, {userPosition[1].toFixed(5)}]
              </div>
            )}
            
            <div>
              <strong>Debug Radius:</strong> {window.geofenceDebuggerRadius || 50}m
            </div>
          </div>

          <div style={{ marginBottom: '10px' }}>
            <div><strong>Active Geofences ({activeGeofences.length}):</strong></div>
            {activeGeofences.length > 0 ? (
              <div style={{ margin: '5px 0' }}>
                {activeGeofences.map((geofence, index) => (
                  <div key={geofence.id || index} style={{ marginBottom: '2px' }}>
                    • {geofence.title} 
                    {typeof geofence.distance === 'number' && (
                      <span> ({geofence.distance.toFixed(1)}m)</span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontStyle: 'italic', opacity: 0.7, margin: '5px 0' }}>
                None detected
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '5px', marginTop: '10px' }}>
            <button 
              onClick={isTracking ? stopTracking : startTracking}
              style={{
                background: isTracking ? '#ff4d4d' : '#4caf50',
                color: 'white',
                border: 'none',
                padding: '5px 10px',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '11px'
              }}
            >
              {isTracking ? 'Stop' : 'Start'}
            </button>
            
            <button
              onClick={testSimulation}
              style={{
                background: '#2196f3',
                color: 'white',
                border: 'none',
                padding: '5px 10px',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '11px'
              }}
            >
              Test Sim
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default GeofenceHookTester;