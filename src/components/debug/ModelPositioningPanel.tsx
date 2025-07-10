// src/components/debug/ReformedModelPositioningPanel.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { PositioningSystemSingleton } from '../../utils/coordinate-system/PositioningSystemSingleton';

export interface ReformedPositioningData {
  // Model transforms (from useARInteractions)
  accumulatedTransforms: {
    rotation: { x: number; y: number; z: number }; // In radians
    scale: number;
  };
  
  // Position data
  userPosition: [number, number] | null;
  activeAnchorPosition: [number, number];
  
  // Model positioning
  arScene?: THREE.Scene;
  expectedModelPosition: THREE.Vector3 | null;
  modelDistance: number | null;
  
  // System configuration
  experienceType: string;
}

export interface ReformedPositioningCallbacks {
  onModelScale?: (scaleFactor: number) => void;
  onModelReset?: () => void;
  onElevationChanged?: () => void; // Trigger experience re-render
  
  // Coordinate transformation callbacks (for triggering re-renders)
  onHorizontalRotationAdjust?: (deltaRotation: number) => void;
  onCoordinateScaleAdjust?: (deltaScale: number) => void;
  onTranslationAdjust?: (deltaX: number, deltaZ: number) => void;
}

interface ReformedModelPositioningPanelProps {
  isCollapsed: boolean;
  data: ReformedPositioningData;
  callbacks: ReformedPositioningCallbacks;
  isVisible?: boolean;
  arScene?: THREE.Scene;
  currentTransforms?: {   // From useARInteractions
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
  currentTransforms
}) => {
  
  if (!isVisible) return null;

  // Live coordinate transformation data from singleton
  const [coordinateTransforms, setCoordinateTransforms] = useState({
    rotation: 0,
    scale: 1.0,
    translation: { x: 0, z: 0 },
    elevation: 0
  });

  // Update coordinate transforms from singleton
  const updateTransforms = useCallback(() => {
    try {
      const summary = PositioningSystemSingleton.getCoordinateTransformationSummary();
      const elevation = PositioningSystemSingleton.getGlobalElevationOffset();
      
      setCoordinateTransforms({
        rotation: summary.rotation,
        scale: summary.scale,
        translation: summary.translation,
        elevation: elevation
      });
    } catch (error) {
      console.warn('Could not get coordinate transformation summary:', error);
    }
  }, []);

  // Update transforms on mount and when data changes
  useEffect(() => {
    updateTransforms();
  }, [updateTransforms, data.experienceType]);

  // Track accumulated scale from model transform buttons
  const [accumulatedScale, setAccumulatedScale] = useState(1.0);
  const displayRotation = currentTransforms?.rotation || { x: 0, y: 0, z: 0 };
  const displayScale = accumulatedScale;

  const prevTotalRotationsRef = useRef(-1);

  // Listen for model transform reset (totalRotations goes back to 0)
  useEffect(() => {
    if (currentTransforms?.totalRotations !== undefined) {
      const currentCount = currentTransforms.totalRotations;
      const prevCount = prevTotalRotationsRef.current;
      
      // If totalRotations went from positive back to 0, it was reset
      if (prevCount > 0 && currentCount === 0 && accumulatedScale !== 1.0) {
        console.log('🔄 Panel: Detected model reset, resetting scale display');
        setAccumulatedScale(1.0);
        prevTotalRotationsRef.current = -1;
      } else {
        prevTotalRotationsRef.current = currentCount;
      }
    }
  }, [currentTransforms?.totalRotations, accumulatedScale]);

  // Coordinate transformation handlers
  const handleHorizontalRotation = useCallback((deltaRotation: number) => {
    try {
      if (deltaRotation === 0) {
        PositioningSystemSingleton.resetHorizontalRotation();
        console.log('🔄 Panel: Reset horizontal rotation');
      } else {
        PositioningSystemSingleton.adjustHorizontalRotation(deltaRotation);
        console.log(`🔄 Panel: Adjusted horizontal rotation by ${deltaRotation}°`);
      }
      
      updateTransforms();
      if (callbacks.onHorizontalRotationAdjust) {
        callbacks.onHorizontalRotationAdjust(deltaRotation);
      }
    } catch (error) {
      console.error('Error adjusting horizontal rotation:', error);
    }
  }, [updateTransforms, callbacks.onHorizontalRotationAdjust]);

  const handleCoordinateScale = useCallback((deltaScale: number) => {
    try {
      if (deltaScale === 0) {
        PositioningSystemSingleton.resetCoordinateScale();
        console.log('🔄 Panel: Reset coordinate scale');
      } else {
        PositioningSystemSingleton.adjustCoordinateScale(deltaScale);
        console.log(`📏 Panel: Adjusted coordinate scale by ${deltaScale}`);
      }
      
      updateTransforms();
      if (callbacks.onCoordinateScaleAdjust) {
        callbacks.onCoordinateScaleAdjust(deltaScale);
      }
    } catch (error) {
      console.error('Error adjusting coordinate scale:', error);
    }
  }, [updateTransforms, callbacks.onCoordinateScaleAdjust]);

  const handleTranslation = useCallback((deltaX: number, deltaZ: number, direction: string) => {
    try {
      PositioningSystemSingleton.adjustTranslation(deltaX, deltaZ);
      console.log(`📍 Panel: Adjusted translation ${direction} by [${deltaX}, ${deltaZ}]m`);
      
      updateTransforms();
      if (callbacks.onTranslationAdjust) {
        callbacks.onTranslationAdjust(deltaX, deltaZ);
      }
    } catch (error) {
      console.error('Error adjusting translation:', error);
    }
  }, [updateTransforms, callbacks.onTranslationAdjust]);

  const handleElevationAdjustment = useCallback((delta: number) => {
    try {
      PositioningSystemSingleton.adjustGlobalElevationOffset(delta);
      console.log(`📏 Panel: Applied elevation adjustment ${delta}m`);
      
      updateTransforms();
      if (callbacks.onElevationChanged) {
        callbacks.onElevationChanged();
      }
    } catch (error) {
      console.error('Error adjusting elevation:', error);
    }
  }, [updateTransforms, callbacks.onElevationChanged]);

  // GPS anchor movement using translation
  const handleAnchorMovement = useCallback((direction: string) => {
    const moveDistance = 1.0; // 1 meter movement
    let deltaX = 0, deltaZ = 0;
    
    switch (direction.toLowerCase()) {
      case 'west':
        deltaX = -moveDistance;
        break;
      case 'east':
        deltaX = moveDistance;
        break;
      case 'north':
        deltaZ = -moveDistance; // Negative Z is north in your coordinate system
        break;
      case 'south':
        deltaZ = moveDistance;
        break;
    }
    
    handleTranslation(deltaX, deltaZ, direction);
  }, [handleTranslation]);

  // Helper functions
  const formatWithSign = (num: number, decimals: number = 1, totalWidth: number = 10) => {
    const sign = num >= 0 ? '+' : '';
    return `${sign}${Math.abs(num).toFixed(decimals)}`.padStart(totalWidth, '  ');
  };

  const getUserLocalPosition = () => {
    if (!data.userPosition) return 'No GPS';
    
    const deltaLon = data.userPosition[0] - data.activeAnchorPosition[0];
    const deltaLat = data.userPosition[1] - data.activeAnchorPosition[1];
    
    const x = deltaLon * 111320 * Math.cos(data.userPosition[1] * Math.PI / 180);
    const z = deltaLat * 110540;
    const y = 0;
    
    return `[${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)}]`;
  };

  const buttonStyle = {
    fontSize: '1rem',
    padding: '4px 12px',
    backgroundColor: 'rgba(0,255,0,0.2)',
    border: 'none',
    borderRadius: '0.5rem',
    color: 'white',
    cursor: 'pointer'
  };

  const xzbuttonStyle = {
    fontSize: '0.5rem',
    padding: '4px 12px',
    backgroundColor: 'rgba(0,255,0,0.2)',
    border: 'none',
    borderRadius: '0.5rem',
    color: 'white',
    cursor: 'pointer'
  };

  const scaleButtonStyle = {
    fontSize: '12px',
    padding: '4px 12px',
    backgroundColor: 'rgba(0,255,0,0.2)',
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
      {/* Always visible: Title */}
      <div style={{ fontSize: '10px', color: 'yellow' }}>
        MODEL POSITIONING CONTROLS
      </div>
      
      {/* Always visible: Model rotation values */}
      <div>
        Model Rot: X:{formatWithSign(displayRotation.x * 180/Math.PI)}° Y:{formatWithSign(displayRotation.y * 180/Math.PI)}° Z:{formatWithSign(displayRotation.z * 180/Math.PI)}°
      </div>

      {/* Collapsible content */}
      {!isCollapsed && (
        <>
          <div style={{ marginTop: '0px', borderTop: '1px solid rgba(255,255,255,0.3)', paddingTop: '2px' }}></div>
          
          {/* User and Model Position */}
          <div style={{ display: 'flex', justifyContent: 'space-around', fontSize: '0.5rem', marginBottom: '5px' }}>
            <div>
              <span style={{ color: 'cyan' }}>User: </span>
              <span>{getUserLocalPosition()}</span>
            </div>
            
            {data.expectedModelPosition && (
              <div>
                <span style={{ color: 'orange' }}>Model: </span>
                <span>[{data.expectedModelPosition.x.toFixed(1)}, {data.expectedModelPosition.y.toFixed(1)}, {data.expectedModelPosition.z.toFixed(1)}]</span>
              </div>
            )}
          </div>

        <div style={{ marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.3)', paddingTop: '5px' }}>
            <div style={{ color: 'yellow', fontSize: '10px', marginBottom: '5px' }}>
              🔄 COORDINATE ROTATION: {coordinateTransforms.rotation.toFixed(1)}°
            </div>
            
            {/* Rotation Slider */}
            <div style={{ margin: '0.5rem', padding: '0 10px' }}>
              <input
                type="range"
                min="-90"
                max="90"
                step="1"
                value={coordinateTransforms.rotation}
                onChange={(e) => {
                  const newRotation = parseFloat(e.target.value);
                  PositioningSystemSingleton.setHorizontalRotation(newRotation);
                  updateTransforms();
                  if (callbacks.onHorizontalRotationAdjust) {
                    callbacks.onHorizontalRotationAdjust(newRotation - coordinateTransforms.rotation);
                  }
                }}
                style={{
                  width: '100%',
                  height: '8px',
                  borderRadius: '5px',
                  background: `linear-gradient(to right, 
                    #ff4444 0%, 
                    #ffff44 50%, 
                    #44ff44 100%)`,
                  outline: 'none',
                  cursor: 'pointer',
                  appearance: 'none',
                  WebkitAppearance: 'none'
                }}
              />
              
              {/* Slider labels */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                fontSize: '8px', 
                marginTop: '2px',
                opacity: 0.7
              }}>
                <span>-90°</span>
                <span>0°</span>
                <span>+90°</span>
              </div>
            </div>
            
            {/* Quick preset buttons */}
            {/* <div style={{ display: 'flex', justifyContent: 'space-between', gap: '2px', margin: '0.5rem' }}>
              <button onClick={() => handleHorizontalRotation(-90)} style={{...buttonStyle, fontSize: '12px'}}>-90°</button>
              <button onClick={() => handleHorizontalRotation(-45)} style={{...buttonStyle, fontSize: '12px'}}>-45°</button>
              <button onClick={() => handleHorizontalRotation(0)} style={{...buttonStyle, fontSize: '12px'}}>RESET</button>
              <button onClick={() => handleHorizontalRotation(45)} style={{...buttonStyle, fontSize: '12px'}}>+45°</button>
              <button onClick={() => handleHorizontalRotation(90)} style={{...buttonStyle, fontSize: '12px'}}>+90°</button>
            </div> */}
          </div>

          {/* Coordinate Scale Section */}
          <div style={{ marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.3)', paddingTop: '5px' }}>
            <div style={{ color: 'yellow', fontSize: '10px', marginBottom: '5px' }}>
              📏 COORDINATE SCALE: {coordinateTransforms.scale.toFixed(3)}x
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '2px', margin: '0.5rem' }}>
              <button onClick={() => handleCoordinateScale(-0.1)} style={buttonStyle}>-0.1</button>
              <button onClick={() => handleCoordinateScale(-0.01)} style={buttonStyle}>-0.01</button>
              <button onClick={() => handleCoordinateScale(0)} style={buttonStyle}>RESET</button>
              <button onClick={() => handleCoordinateScale(0.01)} style={buttonStyle}>+0.01</button>
              <button onClick={() => handleCoordinateScale(0.1)} style={buttonStyle}>+0.1</button>
            </div>
          </div>

          {/* Translation/GPS Movement Section */}
          <div style={{ marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.3)', paddingTop: '2px' }}>
            <div style={{ color: 'yellow', fontSize: '10px', marginBottom: '5px' }}>
              📍 COORDINATE TRANSLATION: [{coordinateTransforms.translation.x.toFixed(1)}, {coordinateTransforms.translation.z.toFixed(1)}]m
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '2px', margin: '0.5rem' }}>
              <button onClick={() => handleAnchorMovement('west')} style={buttonStyle}>WEST</button>
              <button onClick={() => handleAnchorMovement('east')} style={buttonStyle}>EAST</button>
              <button onClick={() => handleAnchorMovement('north')} style={buttonStyle}>NORTH</button>
              <button onClick={() => handleAnchorMovement('south')} style={buttonStyle}>SOUTH</button>
            </div>
          </div>

          {/* Elevation Section */}
          <div style={{ marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.3)', paddingTop: '5px' }}>
            <div style={{ color: 'yellow', fontSize: '10px', marginBottom: '5px' }}>
              ⬆️ ELEVATION OFFSET: {coordinateTransforms.elevation.toFixed(3)}m
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '2px', margin: '0.5rem' }}>
              <button onClick={() => handleElevationAdjustment(-0.1)} style={buttonStyle}>-0.1m</button>
              <button onClick={() => handleElevationAdjustment(-0.01)} style={buttonStyle}>-1cm</button>
              <button onClick={() => handleElevationAdjustment(0.01)} style={buttonStyle}>+1cm</button>
              <button onClick={() => handleElevationAdjustment(0.1)} style={buttonStyle}>+0.1m</button>
            </div>
          </div>

          {/* Model Scale Section */}
          <div style={{ marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.3)', paddingTop: '5px' }}>
            <div style={{ color: 'yellow', fontSize: '10px', marginBottom: '5px' }}>
              🔍 MODEL SCALE: {displayScale.toFixed(2)}x
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '2px', margin: '0.5rem' }}>
              <button onClick={() => {
                setAccumulatedScale(prev => (prev - 0.2));
                callbacks.onModelScale?.(0.8);
              }} style={scaleButtonStyle}>-0.2</button>
              
              <button onClick={() => {
                setAccumulatedScale(prev => Math.max(0.1, prev - 0.05));
                callbacks.onModelScale?.(0.95);
              }} style={scaleButtonStyle}>-0.05</button>
              
              <button onClick={() => {
                setAccumulatedScale(1.0);
                callbacks.onModelReset?.();
              }} style={scaleButtonStyle}>RESET</button>
              
              <button onClick={() => {
                setAccumulatedScale(prev => (prev + 0.05));
                callbacks.onModelScale?.(1.05);
              }} style={scaleButtonStyle}>+0.05</button>
              
              <button onClick={() => {
                setAccumulatedScale(prev => (prev + 0.2));
                callbacks.onModelScale?.(1.2);
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
            <div>Coord System: {coordinateTransforms.rotation === 45 && coordinateTransforms.scale === 1.0 && coordinateTransforms.translation.x === 0 && coordinateTransforms.translation.z === 0 ? '✅ Default' : '🔧 Modified'}</div>
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
          ⬆ swipe up to expand controls
        </div>
      )}
    </div>
  );
};

export default ReformedModelPositioningPanel;