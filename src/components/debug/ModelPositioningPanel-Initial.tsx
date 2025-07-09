// src/components/debug/ReformedModelPositioningPanel.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

export interface ReformedPositioningData {
  // Model transforms (from original)
  accumulatedTransforms: {
    rotation: { x: number; y: number; z: number }; // In radians
    scale: number;
  };
  
  // Position data
  userPosition: [number, number] | null;
  activeAnchorPosition: [number, number];
  adjustedAnchorPosition: [number, number] | null;
  
  // Model positioning
  arScene?: THREE.Scene;
  expectedModelPosition: THREE.Vector3 | null;
  modelDistance: number | null;
  
  // System configuration
  experienceType: string;
  coordinateScale: number;
  newSystemReady: boolean;
  
  // Elevation and offsets
  experienceOffsets: Record<string, number>;
  manualElevationOffset: number;
  globalElevationOffset: number;
  
  // Scale
  manualScaleOffset: number;
  
  // GPS adjustments
  anchorPosition: [number, number];
  gpsOffset: { lon: number; lat: number };
  
  // NEW: Horizontal rotation (ready for integration)
  horizontalRotation?: number; // In degrees
}

export interface ReformedPositioningCallbacks {
  onElevationAdjust: (delta: number) => void;
  onAnchorAdjust: (deltaLon: number, deltaLat: number) => void;
  onScaleAdjust: (delta: number) => void;
  onModelScale?: (scaleFactor: number) => void;
  onModelReset?: () => void;
  onElevationChanged?: () => void;
  
  // NEW: Ready for horizontal rotation
  onHorizontalRotationAdjust?: (deltaRotation: number) => void;
}

interface ReformedModelPositioningPanelProps {
  isCollapsed: boolean;
  data: ReformedPositioningData;
  callbacks: ReformedPositioningCallbacks;
  isVisible?: boolean;
  arScene?: THREE.Scene; // For scene info only
  currentTransforms?: {   // NEW: Get transforms from useARInteractions
    rotation: { x: number; y: number; z: number };
    scale: number;
    totalRotations: number;
    totalScales: number;
  };
}

const ReformedModelPositioningPanel: React.FC<ReformedModelPositioningPanelProps> = ({
  isCollapsed,
  data,
  callbacks,
  isVisible = true,
  arScene,
  currentTransforms // NEW: Receive transforms from interaction hook
}) => {
  
  if (!isVisible) return null;

  // State for scene discovery (simplified)
  const [modelFound, setModelFound] = useState(false);

  // ✅ SIMPLE: Just check if model exists in scene (no polling needed)
  useEffect(() => {
    if (!arScene) {
      setModelFound(false);
      return;
    }
    
    let found = false;
    arScene.traverse((object) => {
      if (!found && (
        object instanceof THREE.Points ||
        (object instanceof THREE.Group && object.children.length > 0) ||
        object.userData?.isExperienceModel ||
        (object instanceof THREE.Mesh && object.geometry.attributes.position)
      )) {
        found = true;
      }
    });
    
    setModelFound(found);
    if (found) {
      console.log('🎯 Panel: Model found in scene');
    }
  }, [arScene]);

  // ✅ Use transforms from interaction hook (or fallback to props)
  const displayRotation = currentTransforms?.rotation || { x: 0, y: 0, z: 0 };
  const displayScale = currentTransforms?.scale || data.manualScaleOffset || 1.0;

  // Helper function for formatting numbers with signs
  const formatWithSign = (num: number, decimals: number = 1, totalWidth: number = 10) => {
    const sign = num >= 0 ? '+' : '';
    return `${sign}${Math.abs(num).toFixed(decimals)}`.padStart(totalWidth, '  ');
  };

  // Helper function to convert GPS to local coordinates for display
  const getUserLocalPosition = () => {
    if (!data.userPosition) return 'No GPS';
    
    // Calculate local coordinates relative to anchor
    const deltaLon = data.userPosition[0] - data.activeAnchorPosition[0];
    const deltaLat = data.userPosition[1] - data.activeAnchorPosition[1];
    
    // Approximate conversion to meters (simplified)
    const x = deltaLon * 111320 * Math.cos(data.userPosition[1] * Math.PI / 180);
    const z = deltaLat * 110540;
    const y = 0; // User at ground level
    
    return `[${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)}]`;
  };

  const buttonStyle = {
    fontSize: '20px',
    padding: '4px 12px',
    backgroundColor: data.newSystemReady ? 'rgba(0,255,0,0.2)' : 'rgba(255,255,255,0.2)',
    border: 'none',
    borderRadius: '0.5rem',
    color: 'white',
    cursor: 'pointer'
  };

  const elevButtonStyle = {
    fontSize: '20px',
    padding: '4px 12px',
    backgroundColor: data.newSystemReady ? 'rgba(0,255,0,0.2)' : 'rgba(255,255,255,0.2)',
    border: 'none',
    borderRadius: '0.5rem',
    color: 'white',
    cursor: 'pointer'
  };

  const scaleButtonStyle = {
    fontSize: '12px',
    padding: '4px 12px',
    backgroundColor: data.newSystemReady ? 'rgba(0,255,0,0.2)' : 'rgba(255,255,255,0.2)',
    border: 'none',
    borderRadius: '0.5rem',
    color: 'white',
    cursor: 'pointer'
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
      {/* Always visible: Title with model tracking status */}
      <div style={{ fontSize: '10px', color: 'yellow' }}>
        🎯 MODEL TRANSFORMS {modelFound ? '✅' : '❌'}
      </div>
      
      {/* Always visible: Rotation values - using transforms from interaction hook */}
      <div>
        Rot: X:{formatWithSign(displayRotation.x * 180/Math.PI)}° Y:{formatWithSign(displayRotation.y * 180/Math.PI)}° Z:{formatWithSign(displayRotation.z * 180/Math.PI)}° {currentTransforms ? '(gestures)' : '(±180°)'}
      </div>

      {/* Always visible: Scale - using transforms from interaction hook */}
      <div style={{ fontSize: '0.7rem', marginTop: '2px' }}>
        Scale: {displayScale.toFixed(2)}x {currentTransforms ? '(gestures)' : '(props)'}
      </div>

      {/* Collapsible content */}
      {!isCollapsed && (
        <>
          <div style={{ marginTop: '5px', borderTop: '1px solid rgba(255,255,255,0.3)', paddingTop: '2px' }}></div>
          
          {/* Model Discovery Status */}
          <div style={{ fontSize: '0.5rem', marginBottom: '5px', color: modelFound ? 'lightgreen' : 'orange' }}>
            <span style={{ color: 'cyan' }}>Scene Status: </span>
            <span>{modelFound ? 'Model tracked ✅' : 'Searching for model...'}</span>
            {arScene && <span> | Objects in scene: {arScene.children.length}</span>}
            {currentTransforms && (
              <span> | Gestures: {currentTransforms.totalRotations}R/{currentTransforms.totalScales}S</span>
            )}
          </div>
          
          {/* User Position in Local Coordinates */}
          <div style={{ fontSize: '0.5rem', marginBottom: '5px' }}>
            <span style={{ color: 'cyan' }}>User Local Position: </span>
            <span>{getUserLocalPosition()}</span>
          </div>

          {/* Model position section */}
          {data.expectedModelPosition ? (
            <div style={{ fontSize: '0.5rem', marginBottom: '8px' }}>
              <div>
                Model Position: [
                  {data.expectedModelPosition.x.toFixed(1)},
                  {data.expectedModelPosition.y.toFixed(1)}, 
                  {data.expectedModelPosition.z.toFixed(1)}] 
              </div>
              {data.modelDistance !== null && (
                <div style={{ marginTop: '2px' }}>
                  Distance: {(data.modelDistance * 3.28084).toFixed(1)}ft ({data.modelDistance.toFixed(1)}m)
                </div>
              )}
            </div>
          ) : (
            <div style={{ fontSize: '9px', opacity: 0.6, marginBottom: '8px' }}>No model position calculated</div>
          )}

          {/* NEW: Horizontal Rotation Section (ready for integration) */}
          {data.horizontalRotation !== undefined && (
            <div style={{ marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.3)', paddingTop: '5px' }}>
              <div style={{ color: 'yellow', fontSize: '10px', marginBottom: '5px' }}>
                🔄 HORIZONTAL ROTATION: {data.horizontalRotation.toFixed(1)}°
              </div>
              {callbacks.onHorizontalRotationAdjust && (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '2px', margin: '0.5rem' }}>
                  <button onClick={() => callbacks.onHorizontalRotationAdjust!(-90)} style={buttonStyle}>-90°</button>
                  <button onClick={() => callbacks.onHorizontalRotationAdjust!(-30)} style={buttonStyle}>-30°</button>
                  <button onClick={() => callbacks.onHorizontalRotationAdjust!(-15)} style={buttonStyle}>-15°</button>
                  <button onClick={() => callbacks.onHorizontalRotationAdjust!(0)} style={buttonStyle}>RESET</button>
                  <button onClick={() => callbacks.onHorizontalRotationAdjust!(15)} style={buttonStyle}>+15°</button>
                  <button onClick={() => callbacks.onHorizontalRotationAdjust!(30)} style={buttonStyle}>+30°</button>
                  <button onClick={() => callbacks.onHorizontalRotationAdjust!(90)} style={buttonStyle}>+90°</button>
                </div>
              )}
            </div>
          )}

          {/* GPS calibration section */}
          <div style={{ marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.3)', paddingTop: '2px' }}>
            <div style={{ color: 'yellow', fontSize: '0.7rem', marginBottom: '5px' }}>
              {data.newSystemReady ? 
                'NEW SYSTEM - ANCHOR ADJUSTMENTS:' : 
                `GPS ANCHOR: [${(data.adjustedAnchorPosition || data.anchorPosition)[0].toFixed(6)}, ${(data.adjustedAnchorPosition || data.anchorPosition)[1].toFixed(6)}]`
              }
            </div>
            <div style={{ fontSize: '0.5rem', opacity: 0.8, marginBottom: '5px' }}>
              Offset: [{data.gpsOffset.lon.toFixed(8)}, {data.gpsOffset.lat.toFixed(8)}]
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '2px', margin: '0.5rem' }}>
              {data.newSystemReady ? (
                <>
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
                </>
              ) : (
                <>
                  <button onClick={() => callbacks.onAnchorAdjust(-0.00001, 0)} style={buttonStyle}>WEST</button>
                  <button onClick={() => callbacks.onAnchorAdjust(0.00001, 0)} style={buttonStyle}>EAST</button>
                  <button onClick={() => callbacks.onAnchorAdjust(0, 0.00001)} style={buttonStyle}>NORTH</button>
                  <button onClick={() => callbacks.onAnchorAdjust(0, -0.00001)} style={buttonStyle}>SOUTH</button>
                </>
              )}
            </div>
          </div>

          {/* Elevation section */}
          <div style={{ marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.3)', paddingTop: '5px' }}>
            <div style={{ color: 'yellow', fontSize: '10px', marginBottom: '5px' }}>
              {data.newSystemReady ? 
                `📏 ELEVATION: Global Offset ${data.globalElevationOffset.toFixed(3)}m`
                     :
                `📏 ELEVATION: ${((data.experienceOffsets[data.experienceType] || data.experienceOffsets['default'] || 0) + data.manualElevationOffset).toFixed(3)}m (offset: ${data.manualElevationOffset.toFixed(3)}m)`
              }
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '2px', margin: '0.5rem' }}>
              <button onClick={() => {
                callbacks.onElevationAdjust(-0.1);
                if (callbacks.onElevationChanged) callbacks.onElevationChanged();
              }} style={elevButtonStyle}>-0.1m</button>
              
              <button onClick={() => {
                callbacks.onElevationAdjust(-0.01);
                if (callbacks.onElevationChanged) callbacks.onElevationChanged();
              }} style={elevButtonStyle}>-1cm</button>
              
              <button onClick={() => {
                callbacks.onElevationAdjust(0.01);
                if (callbacks.onElevationChanged) callbacks.onElevationChanged();
              }} style={elevButtonStyle}>+1cm</button>
              
              <button onClick={() => {
                callbacks.onElevationAdjust(0.1);
                if (callbacks.onElevationChanged) callbacks.onElevationChanged();
              }} style={elevButtonStyle}>+0.1m</button>
            </div>
          </div>

          {/* Scale section */}
          <div style={{ marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.3)', paddingTop: '5px' }}>
            <div style={{ color: 'yellow', fontSize: '10px', marginBottom: '5px' }}>
              📏 SCALE: {displayScale.toFixed(1)}x {currentTransforms ? '(from gestures)' : '(from props)'}
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '2px', margin: '0.5rem' }}>
              <button onClick={() => {
                // Scale down by calling onModelScale with a factor < 1
                if (callbacks.onModelScale) {
                  callbacks.onModelScale(0.8); // Scale to 80% of current size
                }
              }} style={scaleButtonStyle}>-0.2</button>
              
              <button onClick={() => {
                // Small scale down
                if (callbacks.onModelScale) {
                  callbacks.onModelScale(0.95); // Scale to 95% of current size
                }
              }} style={scaleButtonStyle}>-0.05</button>
              
              <button onClick={() => {
                // Reset to scale 1.0 - we need to calculate the factor to get back to 1.0
                if (callbacks.onModelReset) {
                  // Use reset instead of trying to calculate scale factor
                  callbacks.onModelReset();
                } else if (callbacks.onModelScale && displayScale !== 1.0) {
                  // Fallback: calculate factor to get to 1.0
                  const resetFactor = 1.0 / displayScale;
                  callbacks.onModelScale(resetFactor);
                }
              }} style={scaleButtonStyle}>1.0</button>
              
              <button onClick={() => {
                // Small scale up
                if (callbacks.onModelScale) {
                  callbacks.onModelScale(1.05); // Scale to 105% of current size
                }
              }} style={scaleButtonStyle}>+0.05</button>
              
              <button onClick={() => {
                // Scale up
                if (callbacks.onModelScale) {
                  callbacks.onModelScale(1.2); // Scale to 120% of current size
                }
              }} style={scaleButtonStyle}>+0.2</button>
            </div>
          </div>

          {/* System Status */}
          <div style={{ 
            marginTop: '8px',
            borderTop: '1px solid rgba(255,255,255,0.2)',
            paddingTop: '5px',
            fontSize: '8px', 
            opacity: 0.7
          }}>
            <div>Experience: {data.experienceType}</div>
            <div>System: {data.newSystemReady ? '✅ New' : '🔄 Legacy'}</div>
            <div>Scene Tracking: {modelFound ? '✅ Active' : '❌ Searching'}</div>
            <div>Coordinate Scale: {data.coordinateScale}</div>
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

export default ReformedModelPositioningPanel;