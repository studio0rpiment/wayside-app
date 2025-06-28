// src/components/debug/ReformedModelPositioningPanel.tsx
import React, { useState, useEffect } from 'react';
import * as THREE from 'three';

// Simplified data interface for the reformed system
export interface ReformedPositioningData {
  // Camera and model info
  cameraLookDirection: {
    vector: THREE.Vector3 | null;
    bearing: number | null;
    expectedModelPosition: THREE.Vector3 | null;
    aimError: number | null;
    modelDistance: number | null;
  };
  
  // Position info
  frozenUserPosition: [number, number] | null;
  debugFrozenModelPosition: THREE.Vector3 | null;
   manualScaleOffset: number;
  
  // System status
  experienceType: string;
  positioningSystemReady: boolean;
  arTestingOverride: boolean;
  globalElevationOffset: number;
}

// Simplified callbacks interface
export interface ReformedPositioningCallbacks {
  onElevationAdjust: (delta: number) => void;
  onAnchorAdjust: (direction: 'WEST' | 'EAST' | 'NORTH' | 'SOUTH') => void;
  onElevationChanged?: () => void;
  onMLCorrectionToggle?: (enabled: boolean) => void;
  onScaleAdjust: (newScale: number) => void;

}

interface ReformedModelPositioningPanelProps {
  isCollapsed: boolean;
  isVisible: boolean;
  data: ReformedPositioningData;
  callbacks: ReformedPositioningCallbacks;
  onClose: () => void;
}

const ReformedModelPositioningPanel: React.FC<ReformedModelPositioningPanelProps> = ({
  isCollapsed,
  isVisible,
  data,
  callbacks,
  onClose
}) => {
  
  if (!isVisible || isCollapsed) return null;

  // ML Correction state
  const [mlEnabled, setMLEnabled] = useState(() => {
    return (window as any).mlAnchorCorrectionsEnabled ?? false;
  });

  // Sync with window variable changes
  useEffect(() => {
    const checkMLState = () => {
      const windowState = (window as any).mlAnchorCorrectionsEnabled ?? false;
      if (windowState !== mlEnabled) {
        setMLEnabled(windowState);
      }
    };

    const interval = setInterval(checkMLState, 100);
    return () => clearInterval(interval);
  }, [mlEnabled]);

  const handleMLToggle = () => {
    const newEnabled = !mlEnabled;
    setMLEnabled(newEnabled);
    
    if (callbacks.onMLCorrectionToggle) {
      callbacks.onMLCorrectionToggle(newEnabled);
    }
  };

  const getTurnDirectionText = () => {
    if (data.cameraLookDirection.aimError === null || !data.frozenUserPosition) {
      return 'No position available';
    }

    if (data.cameraLookDirection.aimError < 20) {
      return '⮕⮕ ON TARGET ⬅⬅';
    }

    // Simple turn direction based on aim error
    const aimError = data.cameraLookDirection.aimError;
    
    if (aimError < 40) {
      return `Close - aim error ${aimError.toFixed(1)}°`;
    } else if (aimError < 60) {
      return `⮕ TURN TO FIND MODEL ⬅ (${aimError.toFixed(1)}°)`;
    } else {
      return `⮕⮕ LOOK AROUND FOR MODEL ⬅⬅ (${aimError.toFixed(1)}°)`;
    }
  };

  const handleAnchorAdjust = (direction: 'WEST' | 'EAST' | 'NORTH' | 'SOUTH') => {
    console.log(`🎯 Reformed Panel: Anchor adjustment - ${direction}`);
    callbacks.onAnchorAdjust(direction);
  };

  const scaleButtonStyle = {
  fontSize: '14px',
  padding: '8px 12px',
  backgroundColor: 'rgba(0,100,255,0.3)',
  border: 'none',
  borderRadius: '0.5rem',
  color: 'white',
  cursor: 'pointer',
  flex: 1
};


  return (
    <div 
      style={{
        position: 'absolute',
        bottom: data.experienceType === '2030-2105' ? '11svh' : '2svh',
        left: '50%',
        width: '90vw',
        transform: 'translateX(-50%)',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(20px)',
        color: 'white',
        padding: '15px',
        borderRadius: '1rem',
        fontSize: '0.8rem',
        fontFamily: 'monospace',
        zIndex: 1025,
        textAlign: 'center'
      }}
    >
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '10px'
      }}>
        <span style={{ color: 'yellow', fontSize: '12px', fontWeight: 'bold' }}>
          🎯 REFORMED POSITIONING PANEL
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: 'white',
            cursor: 'pointer',
            fontSize: '16px',
            opacity: 0.7
          }}
        >
          ✕
        </button>
      </div>

      {/* Camera Look Direction */}
      {data.cameraLookDirection.bearing !== null && (
        <div style={{ marginBottom: '15px' }}>
          <div style={{ fontSize: '12px', color: 'cyan', marginBottom: '5px' }}>
            📷 Camera Direction: {data.cameraLookDirection.bearing.toFixed(1)}°
          </div>
          {data.cameraLookDirection.aimError !== null && (
            <div style={{ fontSize: '10px', color: 'yellow' }}>
              {getTurnDirectionText()}
            </div>
          )}
          {data.cameraLookDirection.modelDistance !== null && (
            <div style={{ fontSize: '10px', color: 'white' }}>
              Model Distance: {(data.cameraLookDirection.modelDistance * 3.28084).toFixed(1)}ft
            </div>
          )}
        </div>
      )}

      {/* Position Status */}
      <div style={{ marginBottom: '15px' }}>
        <div style={{ fontSize: '11px', color: 'lightgreen', marginBottom: '5px' }}>
          🔒 Position Status:
        </div>
        <div style={{ fontSize: '9px', color: 'white' }}>
          User: {data.frozenUserPosition ? 'FROZEN' : 'LIVE GPS'}
        </div>
        <div style={{ fontSize: '9px', color: 'white' }}>
          Model: {data.debugFrozenModelPosition ? 'CALCULATED' : 'PENDING'}
        </div>
        {data.debugFrozenModelPosition && (
          <div style={{ fontSize: '8px', color: 'lightblue' }}>
            [{data.debugFrozenModelPosition.x.toFixed(1)}, {data.debugFrozenModelPosition.y.toFixed(1)}, {data.debugFrozenModelPosition.z.toFixed(1)}]
          </div>
        )}
      </div>

      {/* ML Correction Toggle */}
      <div style={{ 
        marginBottom: '15px',
        padding: '8px',
        borderTop: '1px solid rgba(255,255,255,0.3)',
        borderBottom: '1px solid rgba(255,255,255,0.3)'
      }}>
        <div style={{ 
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '10px'
        }}>
          <span style={{ fontSize: '11px', color: 'cyan' }}>🧠 ML Corrections:</span>
          <button
            onClick={handleMLToggle}
            style={{
              fontSize: '12px',
              padding: '4px 12px',
              backgroundColor: mlEnabled ? 'rgba(0,255,0,0.3)' : 'rgba(255,0,0,0.3)',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: '4px',
              color: 'white',
              cursor: 'pointer'
            }}
          >
            {mlEnabled ? '✅ ENABLED' : '❌ DISABLED'}
          </button>
        </div>
      </div>

      {/* Anchor Adjustments */}
      <div style={{ marginBottom: '15px' }}>
        <div style={{ color: 'yellow', fontSize: '11px', marginBottom: '8px' }}>
          🎯 ANCHOR ADJUSTMENTS (Shared System)
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '5px' }}>
          <button 
            onClick={() => handleAnchorAdjust('WEST')}
            style={{
              fontSize: '14px',
              padding: '8px 12px',
              backgroundColor: 'rgba(0,255,0,0.3)',
              border: 'none',
              borderRadius: '0.5rem',
              color: 'white',
              cursor: 'pointer',
              flex: 1
            }}
          >
            WEST
          </button>
          <button 
            onClick={() => handleAnchorAdjust('EAST')}
            style={{
              fontSize: '14px',
              padding: '8px 12px',
              backgroundColor: 'rgba(0,255,0,0.3)',
              border: 'none',
              borderRadius: '0.5rem',
              color: 'white',
              cursor: 'pointer',
              flex: 1
            }}
          >
            EAST
          </button>
          <button 
            onClick={() => handleAnchorAdjust('NORTH')}
            style={{
              fontSize: '14px',
              padding: '8px 12px',
              backgroundColor: 'rgba(0,255,0,0.3)',
              border: 'none',
              borderRadius: '0.5rem',
              color: 'white',
              cursor: 'pointer',
              flex: 1
            }}
          >
            NORTH
          </button>
          <button 
            onClick={() => handleAnchorAdjust('SOUTH')}
            style={{
              fontSize: '14px',
              padding: '8px 12px',
              backgroundColor: 'rgba(0,255,0,0.3)',
              border: 'none',
              borderRadius: '0.5rem',
              color: 'white',
              cursor: 'pointer',
              flex: 1
            }}
          >
            SOUTH
          </button>
        </div>
      </div>

      {/* Elevation Control */}
      <div style={{ marginBottom: '15px' }}>
        <div style={{ color: 'yellow', fontSize: '11px', marginBottom: '8px' }}>
          📏 ELEVATION: Global Offset {data.globalElevationOffset.toFixed(3)}m
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '5px' }}>
          <button
            onClick={() => {
              callbacks.onElevationAdjust(-0.1);
              if (callbacks.onElevationChanged) callbacks.onElevationChanged();
            }}
            style={{
              fontSize: '14px',
              padding: '8px 12px',
              backgroundColor: 'rgba(255,0,0,0.3)',
              border: 'none',
              borderRadius: '0.5rem',
              color: 'white',
              cursor: 'pointer',
              flex: 1
            }}
          >
            -0.1m
          </button>
          <button
            onClick={() => {
              callbacks.onElevationAdjust(-0.01);
              if (callbacks.onElevationChanged) callbacks.onElevationChanged();
            }}
            style={{
              fontSize: '14px',
              padding: '8px 12px',
              backgroundColor: 'rgba(255,100,100,0.3)',
              border: 'none',
              borderRadius: '0.5rem',
              color: 'white',
              cursor: 'pointer',
              flex: 1
            }}
          >
            -1cm
          </button>
          <button
            onClick={() => {
              callbacks.onElevationAdjust(0.01);
              if (callbacks.onElevationChanged) callbacks.onElevationChanged();
            }}
            style={{
              fontSize: '14px',
              padding: '8px 12px',
              backgroundColor: 'rgba(100,255,100,0.3)',
              border: 'none',
              borderRadius: '0.5rem',
              color: 'white',
              cursor: 'pointer',
              flex: 1
            }}
          >
            +1cm
          </button>
          <button
            onClick={() => {
              callbacks.onElevationAdjust(0.1);
              if (callbacks.onElevationChanged) callbacks.onElevationChanged();
            }}
            style={{
              fontSize: '14px',
              padding: '8px 12px',
              backgroundColor: 'rgba(0,255,0,0.3)',
              border: 'none',
              borderRadius: '0.5rem',
              color: 'white',
              cursor: 'pointer',
              flex: 1
            }}
          >
            +0.1m
          </button>
        </div>
      </div>

      {/* Scale Controls */}
      
<div style={{ marginTop: '15px' }}>
  <div style={{ color: 'yellow', fontSize: '11px', marginBottom: '8px' }}>
    📏 SCALE: {data.manualScaleOffset.toFixed(1)}x
  </div>
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '5px' }}>
    <button onClick={() => callbacks.onScaleAdjust(0.5)} style={scaleButtonStyle}>0.5x</button>
    <button onClick={() => callbacks.onScaleAdjust(1.0)} style={scaleButtonStyle}>1.0x</button>
    <button onClick={() => callbacks.onScaleAdjust(1.5)} style={scaleButtonStyle}>1.5x</button>
    <button onClick={() => callbacks.onScaleAdjust(2.0)} style={scaleButtonStyle}>2.0x</button>
  </div>
</div>

      {/* System Status */}
      <div style={{ 
        fontSize: '9px', 
        opacity: 0.8,
        borderTop: '1px solid rgba(255,255,255,0.2)',
        paddingTop: '8px'
      }}>
        <div>Experience: {data.experienceType}</div>
        <div>Positioning: {data.positioningSystemReady ? '✅ Ready' : '❌ Not Ready'}</div>
        <div>AR Testing: {data.arTestingOverride ? '✅ Override ON' : '❌ Override OFF'}</div>
      </div>
    </div>
  );
};

export default ReformedModelPositioningPanel;