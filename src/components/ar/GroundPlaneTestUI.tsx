// src/components/ar/GroundPlaneTestUI.tsx
import React from 'react';
import { GroundPlaneResult } from './GroundPlaneDetector';

interface GroundPlaneTestUIProps {
  isTestMode: boolean;
  onToggleTestMode: () => void;
  onDetectNow: () => void;
  onAdjustGround?: (deltaOffset: number) => void;  // Changed: Now accumulates delta
  onResetGround?: () => void;                      // NEW: Reset to zero
  currentOffset?: number;                          // NEW: Show current offset
  lastResult: GroundPlaneResult | null;
}

const GroundPlaneTestUI: React.FC<GroundPlaneTestUIProps> = ({
  isTestMode,
  onToggleTestMode,
  onDetectNow,
  onAdjustGround,
  onResetGround,
  currentOffset = 0,
  lastResult
}) => {
  return (
    <div style={{ borderTop: '1px solid rgba(255,255,255,0.3)', paddingTop: '5px', marginTop: '5px' }}>
      <div style={{ color: 'yellow', fontSize: '10px' }}>🌍 GROUND PLANE TEST</div>
      
      <div style={{ display: 'flex', gap: '5px', marginBottom: '5px' }}>
        <button
          onClick={onToggleTestMode}
          style={{
            fontSize: '10px',
            padding: '4px 8px',
            backgroundColor: isTestMode ? 'rgba(0,255,0,0.3)' : 'rgba(255,255,255,0.3)',
            border: 'none',
            color: 'white',
            cursor: 'pointer'
          }}
        >
          {isTestMode ? '✅ Testing ON' : '🧪 Test Ground'}
        </button>
        
        <button
          onClick={onDetectNow}
          style={{
            fontSize: '10px',
            padding: '4px 8px',
            backgroundColor: 'rgba(0,100,255,0.3)',
            border: 'none',
            color: 'white',
            cursor: 'pointer'
          }}
        >
          🔍 Detect Now
        </button>
      </div>
      
      {/* Ground Level Test Buttons */}
      <div style={{ fontSize: '8px', color: 'yellow', marginBottom: '2px' }}>
        ADJUST GROUND: {currentOffset.toFixed(2)}m offset
      </div>
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', 
        gap: '2px', 
        marginBottom: '5px' 
      }}>
        <button
          onClick={() => {
            console.log('🔴 +1m button pressed, current offset:', currentOffset);
            onAdjustGround && onAdjustGround(1.0);
          }}
          style={{
            fontSize: '8px',
            padding: '2px 4px',
            backgroundColor: 'rgba(255,0,0,0.3)',
            border: 'none',
            color: 'white',
            cursor: 'pointer'
          }}
        >
          +1m
        </button>
        <button
          onClick={() => {
            console.log('🟠 +0.1m button pressed, current offset:', currentOffset);
            onAdjustGround && onAdjustGround(0.1);
          }}
          style={{
            fontSize: '8px',
            padding: '2px 4px',
            backgroundColor: 'rgba(255,100,0,0.3)',
            border: 'none',
            color: 'white',
            cursor: 'pointer'
          }}
        >
          +0.1m
        </button>
        <button
          onClick={() => {
            console.log('⚪ Reset button pressed');
            onResetGround && onResetGround();
          }}
          style={{
            fontSize: '8px',
            padding: '2px 4px',
            backgroundColor: 'rgba(100,100,100,0.3)',
            border: 'none',
            color: 'white',
            cursor: 'pointer'
          }}
        >
          Reset
        </button>
        <button
          onClick={() => {
            console.log('🟢 -0.1m button pressed, current offset:', currentOffset);
            onAdjustGround && onAdjustGround(-0.1);
          }}
          style={{
            fontSize: '8px',
            padding: '2px 4px',
            backgroundColor: 'rgba(0,255,100,0.3)',
            border: 'none',
            color: 'white',
            cursor: 'pointer'
          }}
        >
          -0.1m
        </button>
        <button
          onClick={() => {
            console.log('🔵 -1m button pressed, current offset:', currentOffset);
            onAdjustGround && onAdjustGround(-1.0);
          }}
          style={{
            fontSize: '8px',
            padding: '2px 4px',
            backgroundColor: 'rgba(0,0,255,0.3)',
            border: 'none',
            color: 'white',
            cursor: 'pointer'
          }}
        >
          -1m
        </button>
      </div>
      
      {lastResult && (
        <div style={{ fontSize: '8px', fontFamily: 'monospace' }}>
          {/* Basic Results */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr 1fr', 
            gap: '2px',
            marginBottom: '3px'
          }}>
            <div style={{ color: lastResult.confidence > 0.7 ? 'lightgreen' : 'orange' }}>
              Detected: {lastResult.detected ? '✅' : '❌'}
            </div>
            <div>Distance: {lastResult.distance?.toFixed(2)}m</div>
            <div>Confidence: {(lastResult.confidence * 100)?.toFixed(0)}%</div>
            <div>Method: {lastResult.method}</div>
          </div>
          
          {lastResult.angle && (
            <div>Tilt Angle: {lastResult.angle.toFixed(1)}°</div>
          )}
          
          {/* Debug Data */}
          {lastResult.debugData && (
            <div style={{ 
              borderTop: '1px solid rgba(255,255,255,0.2)', 
              paddingTop: '3px', 
              marginTop: '3px' 
            }}>
              <div style={{ color: 'cyan', fontSize: '8px' }}>📊 DEBUG DATA:</div>
              
              {lastResult.debugData.reason ? (
                <div style={{ color: 'orange' }}>
                  Reason: {lastResult.debugData.reason}
                </div>
              ) : (
                <>
                  {/* Device Orientation */}
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '1fr 1fr 1fr', 
                    gap: '2px',
                    fontSize: '7px'
                  }}>
                    <div>β: {lastResult.debugData.betaDegrees?.toFixed(1)}°</div>
                    <div>γ: {lastResult.debugData.gammaDegrees?.toFixed(1)}°</div>
                    <div>∠: {lastResult.debugData.angleToGroundDegrees?.toFixed(1)}°</div>
                  </div>
                  
                  {/* Trigonometry Values */}
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '1fr 1fr 1fr', 
                    gap: '2px',
                    fontSize: '7px',
                    marginTop: '2px'
                  }}>
                    <div>sin: {lastResult.debugData.sinAngle?.toFixed(3)}</div>
                    <div>cos: {lastResult.debugData.cosAngle?.toFixed(3)}</div>
                    <div>tan: {lastResult.debugData.tanAngle?.toFixed(3)}</div>
                  </div>
                  
                  {/* Distance Calculations */}
                  <div style={{ 
                    fontSize: '7px',
                    marginTop: '3px',
                    color: 'yellow'
                  }}>
                    <div>DISTANCE TESTS:</div>
                    <div>Original: {lastResult.debugData.originalDistance?.toFixed(2)}m (1.7/sin)</div>
                    <div>Clamped: {lastResult.debugData.clampedDistance?.toFixed(2)}m (0.5-5.0)</div>
                    <div>Alt1 cos: {lastResult.debugData.altDistance1?.toFixed(2)}m (1.7*cos)</div>
                    <div>Alt2 fixed: {lastResult.debugData.altDistance2?.toFixed(2)}m (fixed)</div>
                    <div>Alt3 cotan: {lastResult.debugData.altDistance3?.toFixed(2)}m (1.7/tan)</div>
                  </div>
                  
                  {/* Computer Vision Analysis */}
                  <div style={{ 
                    fontSize: '7px',
                    marginTop: '3px',
                    color: 'lightgreen'
                  }}>
                    <div>CV ANALYSIS:</div>
                    <div>Success: {lastResult.debugData.cvSuccess ? '✅ YES' : '❌ NO'}</div>
                    {!lastResult.debugData.cvSuccess && (
                      <>
                        <div>Step: {lastResult.debugData.cvStep}</div>
                        <div>Error: {lastResult.debugData.cvError}</div>
                      </>
                    )}
                    {lastResult.debugData.cvSuccess && (
                      <>
                        <div>Confidence: {lastResult.debugData.cvConfidence}</div>
                        <div>Color: {lastResult.debugData.cvColor}</div>
                        <div>Edges: {lastResult.debugData.cvEdges}</div>
                      </>
                    )}
                  </div>
                  
                  {/* Position Info */}
                  <div style={{ 
                    fontSize: '7px',
                    marginTop: '3px',
                    color: 'lightblue'
                  }}>
                    <div>PLACEMENT:</div>
                    <div>Y Position: {(-lastResult.distance).toFixed(2)}m</div>
                    <div>Ground Level: {lastResult.distance > 1.9 ? '⬆️ TOO HIGH' : 
                                        lastResult.distance < 1.5 ? '⬇️ TOO LOW' : 
                                        '✅ GOOD'}</div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GroundPlaneTestUI;