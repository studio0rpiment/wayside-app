// src/components/debug/ModelPositioningPanel.tsx
import React, { useState, useEffect } from 'react';
import * as THREE from 'three';

export interface ModelPositioningData {
  accumulatedTransforms: {
    rotation: { x: number; y: number; z: number };
    scale: number;
  };
  cameraLookDirection: {
    vector: THREE.Vector3 | null;
    bearing: number | null;
    expectedModelPosition: THREE.Vector3 | null;
    aimError: number | null;
    modelDistance: number | null;
  };
  userPosition: [number, number] | null;
  activeAnchorPosition: [number, number];
  coordinateScale: number;
  newSystemReady: boolean;
  experienceType?: string;
  experienceOffsets: Record<string, number>;
  manualElevationOffset: number;
  manualScaleOffset: number;
  adjustedAnchorPosition: [number, number] | null;
  anchorPosition: [number, number];
  gpsOffset: { lon: number; lat: number };
  globalElevationOffset: number;
  
  // NEW: ML correction data
  mlSummary?: {
    enabled: boolean;
    totalExperiences: number;
    trainedExperiences: number;
    availableExperiences: string[];
    appliedCount: number;
  };
  mlInfoForExperience?: {
    available: boolean;
    enabled: boolean;
    valid: boolean;
    applied: boolean;
    correction?: any;
    positionComparison?: any;
  };
}

export interface ModelPositioningCallbacks {
  onElevationAdjust: (delta: number) => void;
  onAnchorAdjust: (deltaLon: number, deltaLat: number) => void;
  onScaleAdjust: (delta: number) => void;
  onModelScale?: (scaleFactor: number) => void;
  onModelReset?: () => void;
  onElevationChanged?: () => void;
  
  // NEW: ML correction callback
  onMLCorrectionToggle?: (enabled: boolean) => void;
}

interface ModelPositioningPanelProps {
  isCollapsed: boolean;
  data: ModelPositioningData;
  callbacks: ModelPositioningCallbacks;
  isVisible?: boolean;
}

const ModelPositioningPanel: React.FC<ModelPositioningPanelProps> = ({
  isCollapsed,
  data,
  callbacks,
  isVisible = true
}) => {
  
  if (!isVisible) return null;

  // ML Correction state - tracks current toggle state
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

  // Helper function for formatting numbers with signs
  const formatWithSign = (num: number, decimals: number = 1, totalWidth: number = 10) => {
    const sign = num >= 0 ? '+' : '';
    return `${sign}${Math.abs(num).toFixed(decimals)}`.padStart(totalWidth, '  ');
  };

  // Helper function to convert GPS to local coordinates for display
  const getUserLocalPosition = () => {
    if (!data.userPosition) return 'No GPS';
    
    // Simple local coordinate calculation
    const deltaLon = data.userPosition[0] - data.activeAnchorPosition[0];
    const deltaLat = data.userPosition[1] - data.activeAnchorPosition[1];
    
    // Approximate conversion to meters (simplified)
    const x = deltaLon * 111320 * Math.cos(data.userPosition[1] * Math.PI / 180);
    const z = deltaLat * 110540;
    const y = 0; // User at ground level
    
    return `[${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)}]`;
  };

  const getTurnDirectionText = () => {
    if (data.cameraLookDirection.aimError === null || !data.userPosition) {
      return 'No GPS position';
    }

    if (data.cameraLookDirection.aimError < 20) {
      return '⮕⮕ ON TARGET ⬅⬅';
    }

    // Calculate bearing from user to anchor
    const deltaLon = data.activeAnchorPosition[0] - data.userPosition[0];
    const deltaLat = data.activeAnchorPosition[1] - data.userPosition[1];
    const gpsToAnchor = Math.atan2(deltaLat, deltaLon) * (180 / Math.PI);
    const normalizedGpsToAnchor = (gpsToAnchor + 360) % 360;
    
    const currentLooking = data.cameraLookDirection.bearing || 0;
    
    let turnDirection = normalizedGpsToAnchor - currentLooking;
    
    // Handle wraparound
    if (turnDirection > 180) turnDirection -= 360;
    if (turnDirection < -180) turnDirection += 360;
    
    const turnAmount = Math.abs(turnDirection).toFixed(0);
    
    if (data.cameraLookDirection.aimError < 40) {
      return turnDirection > 0 
        ? `→  Close - turn RIGHT ${turnAmount}° →` 
        : `← Close - turn LEFT ${turnAmount}° ←`;
    } else if (data.cameraLookDirection.aimError < 60) {
      return turnDirection > 0 
        ? `⮕ TURN RIGHT ${turnAmount}° ⮕` 
        : `⬅ TURN LEFT ${turnAmount}° ⬅`;
    } else {
      return turnDirection > 0 
        ? `⮕⮕ TURN RIGHT ${turnAmount}° ⮕⮕` 
        : `⬅⬅ TURN LEFT ${turnAmount}° ⬅⬅`;
    }
  };

  return (
    <div 
      style={{
        position: 'absolute',
        bottom: data.experienceType === '2030-2105' ? '11svh' : '2svh',
        left: '50%',
        width: '90vw',
        transform: 'translateX(-50%)',
        backgroundColor: 'rgba(0, 0, 0, 0)',
        backdropFilter: 'blur(20px)',
        color: 'white',
        padding: '0',
        borderRadius: '1rem',
        fontSize: '0.8rem',
        fontFamily: 'monospace',
        zIndex: 1025,
        textAlign: 'center'
      }}
    >
      {/* Always visible: Title */}
      <div style={{ fontSize: '10px', color: 'yellow' }}>🎯 MODEL TRANSFORMS</div>
      
      {/* Always visible: Rotation values */}
      <div>
        Rot: X:{formatWithSign(data.accumulatedTransforms.rotation.x * 180/Math.PI)}° Y:{formatWithSign(data.accumulatedTransforms.rotation.y * 180/Math.PI)}° Z:{formatWithSign(data.accumulatedTransforms.rotation.z * 180/Math.PI)}° (±180°)
      </div>

      {/* NEW: ML Correction Toggle - Always visible, minimal */}
      <div style={{ 
        marginTop: '3px', 
        borderTop: '1px solid rgba(255,255,255,0.3)', 
        paddingTop: '3px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '8px'
      }}>
        <span style={{ fontSize: '10px', color: 'cyan' }}>ML:</span>
        <button
          onClick={handleMLToggle}
          style={{
            fontSize: '10px',
            padding: '2px 8px',
            backgroundColor: mlEnabled ? 'rgba(0,255,0,0.3)' : 'rgba(255,0,0,0.3)',
            border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: '4px',
            color: 'white',
            cursor: 'pointer'
          }}
        >
          {mlEnabled ? '✅' : '❌'}
        </button>
        
        {/* Show training info if available */}
        {data.mlSummary && data.mlSummary.trainedExperiences > 0 && (
          <span style={{ fontSize: '8px', color: 'yellow' }}>
            {data.mlSummary.appliedCount}/{data.mlSummary.trainedExperiences}
          </span>
        )}
      </div>

      {/* Collapsible content */}
      {!isCollapsed && (
        <>
          {/* ML Details when expanded and enabled */}
          {mlEnabled && data.mlInfoForExperience?.available && (
            <div style={{ 
              marginTop: '5px', 
              borderTop: '1px solid rgba(255,255,255,0.3)', 
              paddingTop: '3px',
              backgroundColor: data.mlInfoForExperience.applied ? 'rgba(0,255,0,0.1)' : 'rgba(255,255,0,0.1)',
              borderRadius: '4px',
              padding: '4px'
            }}>
              <div style={{ fontSize: '9px', color: 'lightgreen' }}>
                🧠 ML CORRECTION: {data.mlInfoForExperience.applied ? 'ACTIVE' : 'AVAILABLE'}
              </div>
              
              {data.mlInfoForExperience.correction && (
                <>
                  <div style={{ fontSize: '8px', color: 'white' }}>
                    Δ: [{(data.mlInfoForExperience.correction.deltaLon * 1e6).toFixed(1)}μ°, {(data.mlInfoForExperience.correction.deltaLat * 1e6).toFixed(1)}μ°]
                  </div>
                  <div style={{ fontSize: '8px', color: 'white' }}>
                    Conf: {(data.mlInfoForExperience.correction.confidence * 100).toFixed(1)}% 
                    | Samples: {data.mlInfoForExperience.correction.sampleCount}
                  </div>
                </>
              )}
              
              {data.mlInfoForExperience.positionComparison && (
                <div style={{ fontSize: '8px', color: 'white' }}>
                  Shift: {data.mlInfoForExperience.positionComparison.deltaMeters.toFixed(2)}m
                </div>
              )}
            </div>
          )}

          <div style={{ marginTop: '5px', borderTop: '1px solid rgba(255,255,255,0.3)', paddingTop: '2px' }}></div>
          
          {/* User Position in Local Coordinates */}
          <div style={{ fontSize: '0.5rem', marginBottom: '5px' }}>
            <span style={{ color: 'cyan' }}>User Local Position: </span>
            <span>{getUserLocalPosition()}</span>
          </div>

          {/* Camera direction section */}
          <div style={{ fontSize: '0.5rem' }}>
            <span style={{ color: 'yellow' }}>Camera Lookat: {data.cameraLookDirection.bearing?.toFixed(1) ?? 'N/A'}°</span>
            <span> Aim Error: </span>
            <span style={{ color: 'yellow' }}>
              {data.cameraLookDirection.aimError !== null ? `${data.cameraLookDirection.aimError.toFixed(1)}°` : 'N/A'}
            </span>
          </div>

          {/* Model position section */}
          {data.cameraLookDirection.expectedModelPosition ? (
            <>
              <div style={{ fontSize: '0.5rem' }}>
                Model Position: [
                  {data.cameraLookDirection.expectedModelPosition.x.toFixed(1)},
                 {data.cameraLookDirection.expectedModelPosition.y.toFixed(1)}, 
                 {data.cameraLookDirection.expectedModelPosition.z.toFixed(1)}] 
                 | Distance: 
                 {data.cameraLookDirection.modelDistance !== null && data.cameraLookDirection.modelDistance !== undefined ? (data.cameraLookDirection.modelDistance * 3.28084).toFixed(1) : 'N/A'}ft
              </div>

              {/* Turn indicators */}
              {data.cameraLookDirection.aimError !== null && (
                <div style={{ fontSize: '0.8rem', opacity: 1, color: 'yellow' }}>
                  {getTurnDirectionText()}
                </div>
              )}
            </>
          ) : (
            <div style={{ fontSize: '9px', opacity: 0.6 }}>No position calculated</div>
          )}

          {/* GPS calibration section */}
          <div style={{ marginTop: '5px', borderTop: '1px solid rgba(255,255,255,0.3)', paddingTop: '2px' }}>
            <div style={{ color: 'yellow', fontSize: '0.7rem' }}>
              {data.newSystemReady ? 
                'NEW SYSTEM - ANCHOR ADJUSTMENTS:' : 
                `USE BUTTONS TO MOVE ANCHOR: [${(data.adjustedAnchorPosition || data.anchorPosition)[0].toFixed(6)}, ${(data.adjustedAnchorPosition || data.anchorPosition)[1].toFixed(6)}]`
              }
            </div>

            {(() => {
              const buttonStyle = {
                fontSize: '20px',
                padding: '4px 12px',
                backgroundColor: data.newSystemReady ? 'rgba(0,255,0,0.2)' : 'rgba(255,255,255,0.2)',
                border: 'none',
                borderRadius: '0.5rem',
                color: 'white',
                cursor: 'pointer'
              };
              
              if (data.newSystemReady) {
                return (
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '2px', margin: '0.5rem' }}>
                    <button onClick={() => {
                      console.log('🧪 NEW: Anchor adjustment - WEST');
                      if (callbacks.onElevationChanged) callbacks.onElevationChanged();
                    }} style={buttonStyle}>WEST</button>
                    
                    <button onClick={() => {
                      console.log('🧪 NEW: Anchor adjustment - EAST');
                      if (callbacks.onElevationChanged) callbacks.onElevationChanged();
                    }} style={buttonStyle}>EAST</button>
                    
                    <button onClick={() => {
                      console.log('🧪 NEW: Anchor adjustment - NORTH');
                      if (callbacks.onElevationChanged) callbacks.onElevationChanged();
                    }} style={buttonStyle}>NORTH</button>
                    
                    <button onClick={() => {
                      console.log('🧪 NEW: Anchor adjustment - SOUTH');
                      if (callbacks.onElevationChanged) callbacks.onElevationChanged();
                    }} style={buttonStyle}>SOUTH</button>
                  </div>
                );
              } else {
                return (
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '2px', margin: '0.5rem' }}>
                    <button onClick={() => callbacks.onAnchorAdjust(-0.00001, 0)} style={buttonStyle}>WEST</button>
                    <button onClick={() => callbacks.onAnchorAdjust(0.00001, 0)} style={buttonStyle}>EAST</button>
                    <button onClick={() => callbacks.onAnchorAdjust(0, 0.00001)} style={buttonStyle}>NORTH</button>
                    <button onClick={() => callbacks.onAnchorAdjust(0, -0.00001)} style={buttonStyle}>SOUTH</button>
                  </div>
                );
              }
            })()}
          </div>

          {/* Elevation section */}
          <div style={{ marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.3)', paddingTop: '5px' }}>
            <div style={{ color: 'yellow', fontSize: '10px' }}>
              {data.newSystemReady ? 
                `NEW SYSTEM ELEVATION: Global Offset ${data.globalElevationOffset.toFixed(3)}m`
                     :
                `ELEVATION: ${((data.experienceOffsets[data.experienceType ?? 'default'] || data.experienceOffsets['default']) + data.manualElevationOffset).toFixed(3)}m, offset: ${data.manualElevationOffset.toFixed(3)}m`
              }
            </div>
            
            {(() => {
              const elevButtonStyle = {
                fontSize: '20px',
                padding: '4px 12px',
                backgroundColor: data.newSystemReady ? 'rgba(0,255,0,0.2)' : 'rgba(255,255,255,0.2)',
                border: 'none',
                borderRadius: '0.5rem',
                color: 'white',
                cursor: 'pointer'
              };
              
              if (data.newSystemReady) {
                return (
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '2px', margin: '0.5rem' }}>
                    <button onClick={() => {
                      console.log('🧪 Adjusting global elevation -0.1m');
                      callbacks.onElevationAdjust(-0.1);
                      if (callbacks.onElevationChanged) {
                        callbacks.onElevationChanged();
                      }
                    }} style={elevButtonStyle}>-0.1m</button>
                    
                    <button onClick={() => {
                      callbacks.onElevationAdjust(-0.01);
                      if (callbacks.onElevationChanged) {
                        callbacks.onElevationChanged();
                      }
                    }} style={elevButtonStyle}>-1cm</button>
                    
                    <button onClick={() => {
                      callbacks.onElevationAdjust(0.01);
                      if (callbacks.onElevationChanged) {
                        callbacks.onElevationChanged();
                      }
                    }} style={elevButtonStyle}>+1cm</button>
                    
                    <button onClick={() => {
                      callbacks.onElevationAdjust(0.1);
                      if (callbacks.onElevationChanged) {
                        callbacks.onElevationChanged();
                      }
                    }} style={elevButtonStyle}>+0.1m</button>
                  </div>
                );
              } else {
                return (
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '2px', margin: '0.5rem' }}>
                    <button onClick={() => callbacks.onElevationAdjust(-0.1)} style={elevButtonStyle}>-0.1m</button>
                    <button onClick={() => callbacks.onElevationAdjust(-0.01)} style={elevButtonStyle}>-1cm</button>
                    <button onClick={() => callbacks.onElevationAdjust(0.01)} style={elevButtonStyle}>+1cm</button>
                    <button onClick={() => callbacks.onElevationAdjust(0.1)} style={elevButtonStyle}>+0.1m</button>
                  </div>
                );
              }
            })()}
          </div>

          {/* Scale section */}
          <div style={{ marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.3)', paddingTop: '5px', paddingRight: '5px' }}>
            <div style={{ color: 'yellow', fontSize: '10px' }}>
              {data.newSystemReady ? 'NEW SYSTEM SCALE:' : 'SCALE:'} {data.manualScaleOffset.toFixed(1)}x
            </div>
            
            {(() => {
              const scaleButtonStyle = {
                fontSize: '12px',
                padding: '4px 12px',
                backgroundColor: data.newSystemReady ? 'rgba(0,255,0,0.2)' : 'rgba(255,255,255,0.2)',
                border: 'none',
                borderRadius: '0.5rem',
                color: 'white',
                cursor: 'pointer'
              };
              
              if (data.newSystemReady) {
                return (
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '2px', margin: '0.5rem' }}>
                    <button onClick={() => {
                      callbacks.onScaleAdjust(-0.2);
                      if (callbacks.onModelScale) callbacks.onModelScale(data.manualScaleOffset - 0.2);
                    }} style={scaleButtonStyle}>-0.2</button>
                    <button onClick={() => {
                      callbacks.onScaleAdjust(-0.05);
                      if (callbacks.onModelScale) callbacks.onModelScale(data.manualScaleOffset - 0.05);
                    }} style={scaleButtonStyle}>-0.05</button>
                    <button onClick={() => {
                      callbacks.onScaleAdjust(1.0 - data.manualScaleOffset); // Reset to 1.0
                      if (callbacks.onModelReset) callbacks.onModelReset();
                    }} style={scaleButtonStyle}>1.0</button>
                    <button onClick={() => {
                      callbacks.onScaleAdjust(0.05);
                      if (callbacks.onModelScale) callbacks.onModelScale(data.manualScaleOffset + 0.05);
                    }} style={scaleButtonStyle}>+0.05</button>
                    <button onClick={() => {
                      callbacks.onScaleAdjust(0.2);
                      if (callbacks.onModelScale) callbacks.onModelScale(data.manualScaleOffset + 0.2);
                    }} style={scaleButtonStyle}>+0.2</button>
                  </div>
                );
              } else {
                return (
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '2px', margin: '0.5rem' }}>
                    <button onClick={() => callbacks.onScaleAdjust(-0.2)} style={scaleButtonStyle}>-0.2</button>
                    <button onClick={() => callbacks.onScaleAdjust(-0.05)} style={scaleButtonStyle}>-0.05</button>
                    <button onClick={() => {
                      callbacks.onScaleAdjust(1.0 - data.manualScaleOffset); // Reset to 1.0
                      if (callbacks.onModelScale) callbacks.onModelScale(1.0);
                      if (callbacks.onModelReset) callbacks.onModelReset();
                    }} style={scaleButtonStyle}>1.0</button>
                    <button onClick={() => callbacks.onScaleAdjust(0.05)} style={scaleButtonStyle}>+0.05</button>
                    <button onClick={() => callbacks.onScaleAdjust(0.2)} style={scaleButtonStyle}>+0.2</button>
                  </div>
                );
              }
            })()}
          </div>
        </>
      )}
      
      {/* Collapsed state indicator */}
      {isCollapsed && (
        <div style={{ 
          fontSize: '8px', 
          opacity: 0.7, 
          marginTop: '2px',
          color: 'cyan'
        }}>
          ⬆ swipe up to expand
        </div>
      )}
    </div>
  );
};

export default ModelPositioningPanel;