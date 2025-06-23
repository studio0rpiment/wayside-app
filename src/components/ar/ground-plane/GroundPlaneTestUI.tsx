// src/components/ar/GroundPlaneTestUI.tsx - Enhanced with Edge Detection Controls
import React from 'react';
import { GroundPlaneResult, EdgeDetectionStatus } from '../GroundPlaneDetector';

interface GroundPlaneTestUIProps {
  isTestMode: boolean;
  onToggleTestMode: () => void;
  onDetectNow: () => void;
  onAdjustGround?: (deltaOffset: number) => void;
  onResetGround?: () => void;
  onCheckCamera?: () => void;
  currentOffset?: number;
  lastResult: GroundPlaneResult | null;
  // NEW: Edge detection controls
  onToggleEdgeDetection?: (enabled: boolean) => void;
  edgeDetectionStatus?: EdgeDetectionStatus;
}

const GroundPlaneTestUI: React.FC<GroundPlaneTestUIProps> = ({
  isTestMode,
  onToggleTestMode,
  onDetectNow,
  onAdjustGround,
  onResetGround,
  onCheckCamera,
  currentOffset = 0,
  lastResult,
  onToggleEdgeDetection,
  edgeDetectionStatus
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

  // Helper function to get edge detection status color
  const getEdgeDetectionColor = (): string => {
    if (!edgeDetectionStatus?.enabled) return '#666666';
    if (edgeDetectionStatus.processing) return '#ffaa00';
    if (edgeDetectionStatus.error) return '#ff6666';
    if (edgeDetectionStatus.groundConfidence > 0.7) return '#66ff66';
    return '#aaaaaa';
  };

  return (
    <div style={{ 
      borderTop: '1px solid rgba(255,255,255,0.3)', 
      paddingTop: '5px', 
      marginTop: '5px' 
    }}>
      {/* Header with Edge Detection Status */}
      <div style={{ 
        color: 'yellow', 
        fontSize: '10px', 
        display: 'flex', 
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '5px'
      }}>
        <span>🌍 ENHANCED GROUND DETECTION</span>
        <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
          {lastResult && (
            <span style={{ 
              color: getStatusColor(lastResult),
              fontSize: '8px'
            }}>
              ● {lastResult.detected ? lastResult.method.toUpperCase() : 'INACTIVE'}
            </span>
          )}
          {edgeDetectionStatus && (
            <span style={{ 
              color: getEdgeDetectionColor(),
              fontSize: '8px'
            }}>
              🔍 {edgeDetectionStatus.enabled ? 
                   (edgeDetectionStatus.processing ? 'PROCESSING' : 'ACTIVE') : 
                   'DISABLED'}
            </span>
          )}
        </div>
      </div>
      
      {/* Control Buttons Row 1 */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr 1fr 1fr', 
        gap: '3px', 
        marginBottom: '5px' 
      }}>
        <button
          onClick={onToggleTestMode}
          style={{
            fontSize: '8px',
            padding: '5px 6px',
            backgroundColor: isTestMode ? 'rgba(0,255,0,0.4)' : 'rgba(255,255,255,0.3)',
            border: 'none',
            borderRadius: '3px',
            color: 'white',
            cursor: 'pointer',
            fontWeight: isTestMode ? 'bold' : 'normal'
          }}
        >
          {isTestMode ? '✅ Testing' : '🧪 Test'}
        </button>
        
        <button
          onClick={onDetectNow}
          style={{
            fontSize: '8px',
            padding: '5px 6px',
            backgroundColor: 'rgba(0,150,255,0.4)',
            border: 'none',
            borderRadius: '3px',
            color: 'white',
            cursor: 'pointer'
          }}
        >
          🔍 Detect
        </button>

        <button
          onClick={onCheckCamera}
          style={{
            fontSize: '8px',
            padding: '5px 6px',
            backgroundColor: 'rgba(150,100,255,0.4)',
            border: 'none',
            borderRadius: '3px',
            color: 'white',
            cursor: 'pointer'
          }}
        >
          📹 Camera
        </button>

        {/* NEW: Edge Detection Toggle */}
        <button
          onClick={() => onToggleEdgeDetection && onToggleEdgeDetection(!edgeDetectionStatus?.enabled)}
          style={{
            fontSize: '8px',
            padding: '5px 6px',
            backgroundColor: edgeDetectionStatus?.enabled ? 'rgba(0,255,100,0.4)' : 'rgba(100,100,100,0.4)',
            border: 'none',
            borderRadius: '3px',
            color: 'white',
            cursor: 'pointer',
            fontWeight: edgeDetectionStatus?.enabled ? 'bold' : 'normal'
          }}
        >
          {edgeDetectionStatus?.enabled ? '🔍 ON' : '🔍 OFF'}
        </button>
      </div>

      {/* Edge Detection Performance Info */}
      {edgeDetectionStatus?.enabled && (
        <div style={{
          backgroundColor: 'rgba(0,100,200,0.2)',
          padding: '3px 5px',
          borderRadius: '3px',
          marginBottom: '5px',
          fontSize: '7px'
        }}>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr 1fr 1fr 1fr', 
            gap: '3px'
          }}>
            <div>
              Edges: <span style={{ color: '#66ff66' }}>
                {lastResult?.debugData?.edgeCount || 0}
              </span>
            </div>
            <div>
              Time: <span style={{ color: '#ffaa00' }}>
                {lastResult?.debugData?.processingTime?.toFixed(1) || 0}ms
              </span>
            </div>
            <div>
              Ground: <span style={{ 
                color: lastResult?.debugData?.groundLineDetected ? '#66ff66' : '#ff6666' 
              }}>
                {lastResult?.debugData?.groundLineDetected ? '✅' : '❌'}
              </span>
            </div>
            <div>
              H-Edge: <span style={{ color: '#aaffaa' }}>
                {((lastResult?.debugData?.horizontalEdgeRatio || 0) * 100).toFixed(0)}%
              </span>
            </div>
          </div>
          
          {edgeDetectionStatus.error && (
            <div style={{ 
              color: '#ff6666', 
              fontSize: '6px', 
              marginTop: '2px' 
            }}>
              Error: {edgeDetectionStatus.error}
            </div>
          )}
        </div>
      )}
      
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
          
          {/* Enhanced: Edge Detection Results */}
          {lastResult.debugData?.edgeDetectionEnabled && (
            <div style={{
              backgroundColor: 'rgba(0,150,200,0.2)',
              padding: '3px',
              borderRadius: '3px',
              marginBottom: '5px'
            }}>
              <div style={{ color: 'cyan', fontSize: '7px', marginBottom: '2px' }}>
                🔍 EDGE DETECTION RESULTS:
              </div>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr', 
                gap: '3px',
                fontSize: '7px'
              }}>
                <div>
                  Edges Found: <span style={{ 
                    color: (lastResult.debugData.edgeCount || 0) > 20 ? '#66ff66' : '#ffaa00' 
                  }}>
                    {lastResult.debugData.edgeCount || 0}
                  </span>
                </div>
                <div>
                  Process Time: <span style={{ color: '#aaffaa' }}>
                    {lastResult.debugData.processingTime?.toFixed(1) || 0}ms
                  </span>
                </div>
                <div>
                  Ground Line: <span style={{ 
                    color: lastResult.debugData.groundLineDetected ? '#66ff66' : '#ff6666' 
                  }}>
                    {lastResult.debugData.groundLineDetected ? '✅ YES' : '❌ NO'}
                  </span>
                </div>
                <div>
                  Edge Strength: <span style={{ color: '#aaffaa' }}>
                    {((lastResult.debugData.edgeStrength || 0) * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>
          )}
          
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
                📊 Advanced Debug Data
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
                
                {/* Distance Calculations */}
                <div style={{ marginBottom: '3px' }}>
                  <div style={{ color: 'yellow', fontSize: '7px' }}>DISTANCE METHODS:</div>
                  <div style={{ fontSize: '6px', lineHeight: '1.2' }}>
                    <div>🔵 Original (1.7/sin): {lastResult.debugData.originalDistance?.toFixed(2)}m</div>
                    <div>🟢 Used (1.7/tan): {lastResult.debugData.altDistance3?.toFixed(2)}m</div>
                    <div style={{ color: '#66ff66' }}>
                      ✅ Final: {lastResult.debugData.clampedDistance?.toFixed(2)}m
                    </div>
                  </div>
                </div>

                {/* Enhanced: Detailed Edge Detection Analysis */}
                {lastResult.debugData.edgeDetectionEnabled && (
                  <div style={{ marginBottom: '3px' }}>
                    <div style={{ color: 'yellow', fontSize: '7px' }}>EDGE DETECTION ANALYSIS:</div>
                    <div style={{ fontSize: '6px', lineHeight: '1.3' }}>
                      <div>Processing Status: <span style={{ 
                        color: lastResult.debugData.cvSuccess ? '#66ff66' : '#ff6666' 
                      }}>
                        {lastResult.debugData.cvSuccess ? '✅ SUCCESS' : '❌ FAILED'}
                      </span></div>
                      <div>Edge Count: {lastResult.debugData.edgeCount || 0}</div>
                      <div>Horizontal Edge Ratio: {((lastResult.debugData.horizontalEdgeRatio || 0) * 100).toFixed(1)}%</div>
                      <div>Edge Strength Average: {((lastResult.debugData.edgeStrength || 0) * 100).toFixed(1)}%</div>
                      <div>Ground Line Detected: <span style={{ 
                        color: lastResult.debugData.groundLineDetected ? '#66ff66' : '#ff6666' 
                      }}>
                        {lastResult.debugData.groundLineDetected ? '✅ YES' : '❌ NO'}
                      </span></div>
                      <div>Processing Time: {lastResult.debugData.processingTime?.toFixed(2) || 0}ms</div>
                      {lastResult.debugData.cvError && (
                        <div style={{ color: '#ff6666' }}>
                          Error: {lastResult.debugData.cvError}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Camera Status */}
                <div style={{ marginBottom: '3px' }}>
                  <div style={{ color: 'yellow', fontSize: '7px' }}>CAMERA STATUS:</div>
                  <div style={{ fontSize: '7px' }}>
                    <div>
                      Video: {lastResult.debugData.videoExists ? '✅' : '❌'} | 
                      Ready: {lastResult.debugData.videoReady ? '✅' : '❌'} | 
                      Size: {lastResult.debugData.videoSize || 'unknown'}
                    </div>
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
      
      {/* Enhanced Instructions */}
      <div style={{
        marginTop: '5px',
        fontSize: '6px',
        color: '#aaa',
        textAlign: 'center',
        lineHeight: '1.3'
      }}>
        💡 Tilt phone down 15°+ for better detection.<br/>
        🔍 Edge detection analyzes video for ground lines.<br/>
        Use offset buttons to fine-tune ground level.
      </div>
    </div>
  );
};

export default GroundPlaneTestUI;