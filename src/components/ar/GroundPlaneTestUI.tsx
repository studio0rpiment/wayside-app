// src/components/ar/GroundPlaneTestUI.tsx
import React from 'react';
import { GroundPlaneResult } from './GroundPlaneDetector';

interface GroundPlaneTestUIProps {
  isTestMode: boolean;
  onToggleTestMode: () => void;
  onDetectNow: () => void;
  onAdjustGround?: (deltaOffset: number) => void;  // Accumulates delta changes
  onResetGround?: () => void;                      // Reset to zero
  onCheckCamera?: () => void;                      // NEW: Check camera status
  currentOffset?: number;                          // Current manual offset
  lastResult: GroundPlaneResult | null;
}

const GroundPlaneTestUI: React.FC<GroundPlaneTestUIProps> = ({
  isTestMode,
  onToggleTestMode,
  onDetectNow,
  onAdjustGround,
  onResetGround,
  onCheckCamera,
  currentOffset = 0,
  lastResult
}) => {
  
  // Helper function to get status color based on confidence
  const getStatusColor = (result: GroundPlaneResult | null): string => {
    if (!result || !result.detected) return '#ff6666'; // Red for not detected
    if (result.confidence > 0.7) return '#66ff66';     // Green for high confidence
    if (result.confidence > 0.4) return '#ffaa00';     // Orange for medium confidence
    return '#ff6666';                                   // Red for low confidence
  };

  // Helper function to format distance with status
  const getDistanceStatus = (distance: number): { text: string; color: string } => {
    if (distance > 2.2) return { text: '⬆️ TOO HIGH', color: '#ff6666' };
    if (distance < 1.2) return { text: '⬇️ TOO LOW', color: '#ff6666' };
    if (distance >= 1.5 && distance <= 1.9) return { text: '✅ EXCELLENT', color: '#66ff66' };
    return { text: '⚠️ OK', color: '#ffaa00' };
  };

  return (
    <div style={{ 
      borderTop: '1px solid rgba(255,255,255,0.3)', 
      paddingTop: '5px', 
      marginTop: '5px' 
    }}>
      {/* Header */}
      <div style={{ 
        color: 'yellow', 
        fontSize: '10px', 
        display: 'flex', 
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '5px'
      }}>
        <span>🌍 GROUND PLANE TEST</span>
        {lastResult && (
          <span style={{ 
            color: getStatusColor(lastResult),
            fontSize: '8px'
          }}>
            ● {lastResult.detected ? 'ACTIVE' : 'INACTIVE'}
          </span>
        )}
      </div>
      
      {/* Control Buttons */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr 1fr', 
        gap: '4px', 
        marginBottom: '8px' 
      }}>
        <button
          onClick={onToggleTestMode}
          style={{
            fontSize: '9px',
            padding: '6px 8px',
            backgroundColor: isTestMode ? 'rgba(0,255,0,0.4)' : 'rgba(255,255,255,0.3)',
            border: 'none',
            borderRadius: '4px',
            color: 'white',
            cursor: 'pointer',
            fontWeight: isTestMode ? 'bold' : 'normal'
          }}
        >
          {isTestMode ? '✅ Testing' : '🧪 Start Test'}
        </button>
        
        <button
          onClick={onDetectNow}
          style={{
            fontSize: '9px',
            padding: '6px 8px',
            backgroundColor: 'rgba(0,150,255,0.4)',
            border: 'none',
            borderRadius: '4px',
            color: 'white',
            cursor: 'pointer'
          }}
        >
          🔍 Detect
        </button>

        <button
          onClick={onCheckCamera}
          style={{
            fontSize: '9px',
            padding: '6px 8px',
            backgroundColor: 'rgba(150,100,255,0.4)',
            border: 'none',
            borderRadius: '4px',
            color: 'white',
            cursor: 'pointer'
          }}
        >
          📹 Camera
        </button>
      </div>
      
      {/* Ground Level Adjustment */}
      <div style={{ 
        backgroundColor: 'rgba(0,0,0,0.3)', 
        padding: '5px', 
        borderRadius: '4px',
        marginBottom: '5px'
      }}>
        <div style={{ 
          fontSize: '8px', 
          color: 'cyan', 
          marginBottom: '3px',
          textAlign: 'center'
        }}>
          MANUAL GROUND OFFSET: {currentOffset.toFixed(2)}m
        </div>
        
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', 
          gap: '2px'
        }}>
          <button
            onClick={() => {
              console.log('🔴 +1m button clicked, calling onAdjustGround with +1.0');
              onAdjustGround && onAdjustGround(1.0);
            }}
            style={{
              fontSize: '8px',
              padding: '4px 2px',
              backgroundColor: 'rgba(255,100,100,0.5)',
              border: 'none',
              borderRadius: '3px',
              color: 'white',
              cursor: 'pointer'
            }}
          >
            +1m
          </button>
          
          <button
            onClick={() => {
              console.log('🟠 +0.1m button clicked, calling onAdjustGround with +0.1');
              onAdjustGround && onAdjustGround(0.1);
            }}
            style={{
              fontSize: '8px',
              padding: '4px 2px',
              backgroundColor: 'rgba(255,150,100,0.5)',
              border: 'none',
              borderRadius: '3px',
              color: 'white',
              cursor: 'pointer'
            }}
          >
            +0.1m
          </button>
          
          <button
            onClick={() => {
              console.log('⚪ Reset button clicked, calling onResetGround');
              onResetGround && onResetGround();
            }}
            style={{
              fontSize: '8px',
              padding: '4px 2px',
              backgroundColor: 'rgba(150,150,150,0.5)',
              border: 'none',
              borderRadius: '3px',
              color: 'white',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            0
          </button>
          
          <button
            onClick={() => {
              console.log('🟢 -0.1m button clicked, calling onAdjustGround with -0.1');
              onAdjustGround && onAdjustGround(-0.1);
            }}
            style={{
              fontSize: '8px',
              padding: '4px 2px',
              backgroundColor: 'rgba(100,255,150,0.5)',
              border: 'none',
              borderRadius: '3px',
              color: 'white',
              cursor: 'pointer'
            }}
          >
            -0.1m
          </button>
          
          <button
            onClick={() => {
              console.log('🔵 -1m button clicked, calling onAdjustGround with -1.0');
              onAdjustGround && onAdjustGround(-1.0);
            }}
            style={{
              fontSize: '8px',
              padding: '4px 2px',
              backgroundColor: 'rgba(100,100,255,0.5)',
              border: 'none',
              borderRadius: '3px',
              color: 'white',
              cursor: 'pointer'
            }}
          >
            -1m
          </button>
        </div>
      </div>
      
      {/* Results Display */}
      {lastResult && (
        <div style={{ 
          fontSize: '8px', 
          fontFamily: 'monospace',
          backgroundColor: 'rgba(0,0,0,0.4)',
          padding: '5px',
          borderRadius: '4px'
        }}>
          {/* Primary Status */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr 1fr', 
            gap: '4px',
            marginBottom: '5px',
            fontSize: '9px'
          }}>
            <div style={{ 
              color: lastResult.detected ? '#66ff66' : '#ff6666',
              fontWeight: 'bold'
            }}>
              Status: {lastResult.detected ? '✅ DETECTED' : '❌ NOT DETECTED'}
            </div>
            <div style={{ color: '#ffdd66' }}>
              Method: {lastResult.method}
            </div>
          </div>
          
          {/* Key Metrics */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr 1fr 1fr', 
            gap: '3px',
            marginBottom: '5px'
          }}>
            <div>
              <span style={{ color: '#aaffaa' }}>Dist: </span>
              <span style={{ color: getDistanceStatus(lastResult.distance).color }}>
                {lastResult.distance.toFixed(2)}m
              </span>
            </div>
            <div>
              <span style={{ color: '#aaffaa' }}>Conf: </span>
              <span style={{ color: getStatusColor(lastResult) }}>
                {(lastResult.confidence * 100).toFixed(0)}%
              </span>
            </div>
            <div>
              <span style={{ color: '#aaffaa' }}>Angle: </span>
              <span>{lastResult.angle?.toFixed(1) || 'N/A'}°</span>
            </div>
          </div>
          
          {/* Distance Assessment */}
          {(() => {
            const status = getDistanceStatus(lastResult.distance);
            return (
              <div style={{ 
                textAlign: 'center',
                padding: '3px',
                backgroundColor: 'rgba(0,0,0,0.3)',
                borderRadius: '3px',
                marginBottom: '5px'
              }}>
                <span style={{ color: status.color, fontWeight: 'bold' }}>
                  Ground Level: {status.text}
                </span>
              </div>
            );
          })()}
          
          {/* Debug Data - Collapsible */}
          {lastResult.debugData && (
            <details style={{ marginTop: '5px' }}>
              <summary style={{ 
                cursor: 'pointer', 
                color: 'cyan', 
                fontSize: '8px',
                userSelect: 'none'
              }}>
                📊 Debug Data
              </summary>
              
              <div style={{ 
                marginTop: '5px',
                padding: '5px',
                backgroundColor: 'rgba(0,0,0,0.2)',
                borderRadius: '3px'
              }}>
                {/* Device Orientation */}
                <div style={{ marginBottom: '3px' }}>
                  <div style={{ color: 'yellow', fontSize: '7px' }}>DEVICE ORIENTATION:</div>
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '1fr 1fr 1fr', 
                    gap: '2px',
                    fontSize: '7px'
                  }}>
                    <div>β: {lastResult.debugData.betaDegrees?.toFixed(1)}°</div>
                    <div>γ: {lastResult.debugData.gammaDegrees?.toFixed(1)}°</div>
                    <div>∠Ground: {lastResult.debugData.angleToGroundDegrees?.toFixed(1)}°</div>
                  </div>
                </div>
                
                {/* Trigonometry */}
                <div style={{ marginBottom: '3px' }}>
                  <div style={{ color: 'yellow', fontSize: '7px' }}>TRIGONOMETRY:</div>
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '1fr 1fr 1fr', 
                    gap: '2px',
                    fontSize: '7px'
                  }}>
                    <div>sin: {lastResult.debugData.sinAngle?.toFixed(3)}</div>
                    <div>cos: {lastResult.debugData.cosAngle?.toFixed(3)}</div>
                    <div>tan: {lastResult.debugData.tanAngle?.toFixed(3)}</div>
                  </div>
                </div>
                
                {/* Distance Calculations */}
                <div style={{ marginBottom: '3px' }}>
                  <div style={{ color: 'yellow', fontSize: '7px' }}>DISTANCE METHODS:</div>
                  <div style={{ fontSize: '6px', lineHeight: '1.2' }}>
                    <div>🔵 Original (1.7/sin): {lastResult.debugData.originalDistance?.toFixed(2)}m</div>
                    <div>🟢 Used (1.7/tan): {lastResult.debugData.altDistance3?.toFixed(2)}m</div>
                    <div>🟡 Cosine (1.7*cos): {lastResult.debugData.altDistance1?.toFixed(2)}m</div>
                    <div>🟠 Fixed (1.7): {lastResult.debugData.altDistance2?.toFixed(2)}m</div>
                    <div style={{ color: '#66ff66' }}>
                      ✅ Final: {lastResult.debugData.clampedDistance?.toFixed(2)}m
                    </div>
                  </div>
                </div>
                
                {/* Camera/Video Status */}
                <div style={{ marginBottom: '3px' }}>
                  <div style={{ color: 'yellow', fontSize: '7px' }}>CAMERA STATUS:</div>
                  <div style={{ fontSize: '7px' }}>
                    <div>
                      Video: {lastResult.debugData.videoExists ? '✅' : '❌'} | 
                      Ready: {lastResult.debugData.videoReady ? '✅' : '❌'} | 
                      Size: {lastResult.debugData.videoSize || 'unknown'}
                    </div>
                    <div>Info: {lastResult.debugData.videoInfo || 'no info'}</div>
                  </div>
                </div>
                
                {/* Computer Vision Analysis */}
                <div style={{ marginBottom: '3px' }}>
                  <div style={{ color: 'yellow', fontSize: '7px' }}>CV ANALYSIS:</div>
                  <div style={{ fontSize: '7px' }}>
                    <div>
                      Success: {lastResult.debugData.cvSuccess ? '✅' : '❌'} | 
                      Step: {lastResult.debugData.cvStep || 'unknown'}
                    </div>
                    {lastResult.debugData.cvError && (
                      <div style={{ color: '#ff6666' }}>
                        Error: {lastResult.debugData.cvError}
                      </div>
                    )}
                    {lastResult.debugData.cvSuccess && (
                      <div>
                        Confidence: {lastResult.debugData.cvConfidence} | 
                        Color: {lastResult.debugData.cvColor} | 
                        Edges: {lastResult.debugData.cvEdges}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Positioning Info */}
                <div>
                  <div style={{ color: 'yellow', fontSize: '7px' }}>POSITIONING:</div>
                  <div style={{ fontSize: '7px' }}>
                    <div>
                      Y Position: {(-lastResult.distance + currentOffset).toFixed(2)}m 
                      (calc: {(-lastResult.distance).toFixed(2)}m + offset: {currentOffset.toFixed(2)}m)
                    </div>
                    <div style={{ 
                      color: getDistanceStatus(lastResult.distance).color,
                      fontWeight: 'bold'
                    }}>
                      Assessment: {getDistanceStatus(lastResult.distance).text}
                    </div>
                  </div>
                </div>
                
                {/* Fallback reason if applicable */}
                {lastResult.debugData.reason && (
                  <div style={{ 
                    marginTop: '5px',
                    padding: '3px',
                    backgroundColor: 'rgba(255,100,0,0.2)',
                    borderRadius: '3px'
                  }}>
                    <div style={{ color: 'orange', fontSize: '7px' }}>REASON:</div>
                    <div style={{ fontSize: '7px' }}>{lastResult.debugData.reason}</div>
                  </div>
                )}
              </div>
            </details>
          )}
        </div>
      )}
      
      {/* No Results Message */}
      {!lastResult && (
        <div style={{
          textAlign: 'center',
          padding: '10px',
          color: '#888',
          fontSize: '9px',
          fontStyle: 'italic'
        }}>
          No ground plane detection results yet.<br/>
          Click "🔍 Detect" or enable test mode.
        </div>
      )}
      
      {/* Instructions */}
      <div style={{
        marginTop: '5px',
        fontSize: '6px',
        color: '#aaa',
        textAlign: 'center',
        lineHeight: '1.3'
      }}>
        💡 Tilt phone down 15°+ for better detection.<br/>
        Use offset buttons to fine-tune ground level.
      </div>
    </div>
  );
};

export default GroundPlaneTestUI;