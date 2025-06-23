// src/components/debug/PrecisionDebugger.tsx - Enhanced with Three-Level Progressive Disclosure
import React, { useState } from 'react';
import { PositionQuality } from '../../hooks/useEnhancedGeofenceManager';
import { useGeofenceContext } from '../../context/GeofenceContext';

interface PrecisionDebuggerProps {
  // Enhanced precision data
  currentAccuracy: number | null;
  positionQuality: PositionQuality;
  isPositionStable: boolean;
  averagedPosition: [number, number] | null;
  positionHistory: any[];
  userPosition: [number, number] | null;
  isTracking: boolean;
  currentRadius?: number;
  
  // Control functions
  startTracking: () => Promise<boolean>;
  stopTracking: () => void;
  getPositionStats: () => any;
}

// Three-level disclosure states
type DisclosureLevel = 'minimal' | 'summary' | 'detailed';

const PrecisionDebugger: React.FC<PrecisionDebuggerProps> = ({
  currentAccuracy,
  positionQuality,
  isPositionStable,
  averagedPosition,
  positionHistory,
  userPosition,
  isTracking,
  startTracking,
  stopTracking,
  getPositionStats,
  currentRadius = 10,
}) => {

  // ✅ NEW: Three-level progressive disclosure state
  const [disclosureLevel, setDisclosureLevel] = useState<DisclosureLevel>('minimal');
  const [showHistory, setShowHistory] = useState(false);
  const [displayRadius, setDisplayRadius] = useState(currentRadius);

  const { updateGlobalRadius, currentRadius: contextRadius, isUniversalMode } = useGeofenceContext();
  

  // Function to change radius
  const changeRadius = (newRadius: number) => {
    if (updateGlobalRadius) {
      updateGlobalRadius(newRadius);
    }
    setDisplayRadius(newRadius);
    console.log(`🎯 Geofence radius changed to ${newRadius}m`);
  };

  React.useEffect(() => {
    setDisplayRadius(contextRadius || currentRadius);
  }, [contextRadius, currentRadius]);

  // ✅ NEW: Cycle through disclosure levels
  const cycleDisclosureLevel = () => {
    setDisclosureLevel(prev => {
      switch (prev) {
        case 'minimal': return 'summary';
        case 'summary': return 'detailed';
        case 'detailed': return 'minimal';
        default: return 'minimal';
      }
    });
  };

  // ✅ NEW: Get appropriate header text and icon for each level
  const getHeaderInfo = () => {
    switch (disclosureLevel) {
      case 'minimal':
        return { text: '🎯 RADIUS', icon: '▶' };
      case 'summary':
        return { text: '📡 GPS STATUS', icon: '▼' };
      case 'detailed':
        return { text: '🔧 GPS DEBUG', icon: '◀' };
      default:
        return { text: '🎯 RADIUS', icon: '▶' };
    }
  };

  // Quality color mapping
  const getQualityColor = (quality: PositionQuality): string => {
    switch (quality) {
      case PositionQuality.EXCELLENT: return '#10B981';
      case PositionQuality.GOOD: return '#059669';
      case PositionQuality.FAIR: return '#F59E0B';
      case PositionQuality.POOR: return '#EF4444';
      case PositionQuality.UNACCEPTABLE: return '#7F1D1D';
      default: return '#6B7280';
    }
  };
  
  // Accuracy quality indicator
  const getAccuracyIndicator = () => {
    if (currentAccuracy === null) return '❓';
    if (currentAccuracy <= 3) return '🎯';
    if (currentAccuracy <= 8) return '✅';
    if (currentAccuracy <= 15) return '⚠️';
    if (currentAccuracy <= 30) return '🔶';
    return '❌';
  };
  
  const stats = getPositionStats();
  const headerInfo = getHeaderInfo();

  return (
    <div style={{
      position: 'fixed',
      top: '20svh',
      right: '10px',
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
      color: 'white',
      padding: '8px',
      borderRadius: '8px',
      fontSize: '11px',
      fontFamily: 'monospace',
      zIndex: 1000,
      minWidth: '200px',
      maxWidth: '300px',
      // ✅ Dynamic border color based on disclosure level and quality
      border: disclosureLevel === 'minimal' ? '2px solid #6366F1' : 
              disclosureLevel === 'summary' ? '2px solid #F59E0B' :
              `2px solid ${getQualityColor(positionQuality)}`,
      transition: 'border-color 0.2s ease'
    }}>

      {/* ✅ NEW: Progressive disclosure header - cycles through levels */}
      <div 
        style={{ 
          cursor: 'pointer', 
          userSelect: 'none',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: disclosureLevel === 'minimal' ? '4px' : '8px',
          padding: '2px 0'
        }}
        onClick={cycleDisclosureLevel}
        title={`Click to ${disclosureLevel === 'minimal' ? 'show status' : 
                             disclosureLevel === 'summary' ? 'show details' : 
                             'minimize'}`}
      >
        <span style={{ 
          fontWeight: 'bold', 
          color: disclosureLevel === 'minimal' ? '#6366F1' : 
                 disclosureLevel === 'summary' ? '#F59E0B' : '#FFD700'
        }}>
          {headerInfo.text} {disclosureLevel !== 'minimal' && getAccuracyIndicator()}
        </span>
        <span style={{ fontSize: '12px' }}>{headerInfo.icon}</span>
      </div>

      {/* ✅ LEVEL 1: MINIMAL - Just radius controls (always visible) */}
      <div style={{ marginBottom: disclosureLevel === 'minimal' ? '0' : '8px' }}>
        <div style={{ 
          color: '#9CA3AF', 
          marginBottom: '4px',
          fontSize: disclosureLevel === 'minimal' ? '11px' : '10px'
        }}>
          GEOFENCE: {displayRadius}m
        </div>
        <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap' }}>
          {[5, 10, 15, 20, 40, 10000].map(radius => (
            <button
              key={radius}
              onClick={(e) => {
                e.stopPropagation(); // Prevent triggering disclosure cycle
                changeRadius(radius);
              }}
              style={{
                padding: '2px 6px',
                fontSize: '10px',
                backgroundColor: displayRadius === radius ? '#10B981' : '#6B7280',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              {radius === 10000 ? '∞' : `${radius}m`}
            </button>
          ))}
        </div>
      </div>

      {/* ✅ LEVEL 2: SUMMARY - Core status (summary + minimal) */}
      {disclosureLevel !== 'minimal' && (
        <div style={{ marginBottom: disclosureLevel === 'summary' ? '0' : '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
            <span>Tracking:</span>
            <span style={{ color: isTracking ? '#10B981' : '#EF4444' }}>
              {isTracking ? '🟢 ON' : '🔴 OFF'}
            </span>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
            <span>Accuracy:</span>
            <span style={{ color: getQualityColor(positionQuality) }}>
              {currentAccuracy ? `${currentAccuracy.toFixed(1)}m` : 'N/A'}
            </span>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
            <span>Quality:</span>
            <span style={{ 
              color: getQualityColor(positionQuality),
              textTransform: 'uppercase',
              fontSize: '10px',
              fontWeight: 'bold'
            }}>
              {positionQuality}
            </span>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Stable:</span>
            <span style={{ color: isPositionStable ? '#10B981' : '#F59E0B' }}>
              {isPositionStable ? '✅ YES' : '⏳ NO'}
            </span>
          </div>
    {/* Universal Mode indicator */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3px' }}>
            <span>Universal:</span>
            <span style={{ color: isUniversalMode ? '#FFD700' : '#6B7280' }}>
              {isUniversalMode ? '🌐 ON' : '📍 OFF'}
            </span>
          </div>
        </div>
      )}

      {/* ✅ LEVEL 3: DETAILED - Full debug info (detailed + summary + minimal) */}
      {disclosureLevel === 'detailed' && (
        <>
          {/* Position Information */}
          <div style={{ marginBottom: '8px', fontSize: '10px' }}>
            <div style={{ color: '#9CA3AF', marginBottom: '4px' }}>POSITION DATA:</div>
            
            {userPosition && (
              <div style={{ marginLeft: '8px' }}>
                <div>Current: {userPosition[1].toFixed(8)}, {userPosition[0].toFixed(8)}</div>
                {averagedPosition && (
                  <div style={{ color: '#10B981' }}>
                    Averaged: {averagedPosition[1].toFixed(8)}, {averagedPosition[0].toFixed(8)}
                  </div>
                )}
              </div>
            )}
            
            <div style={{ marginLeft: '8px', marginTop: '4px' }}>
              <div>History: {positionHistory.length} readings</div>
              <div>Decimal Places: {userPosition ? userPosition[0].toString().split('.')[1]?.length || 0 : 0}</div>
            </div>
          </div>
          
          {/* Controls */}
          <div style={{ marginBottom: '8px' }}>
            <div style={{ color: '#9CA3AF', marginBottom: '4px' }}>CONTROLS:</div>
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  isTracking ? stopTracking() : startTracking();
                }}
                style={{
                  padding: '2px 6px',
                  fontSize: '10px',
                  backgroundColor: isTracking ? '#EF4444' : '#10B981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                {isTracking ? 'Stop' : 'Start'}
              </button>
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowHistory(!showHistory);
                }}
                style={{
                  padding: '2px 6px',
                  fontSize: '10px',
                  backgroundColor: '#6366F1',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                {showHistory ? 'Hide' : 'Show'} History
              </button>
            </div>
          </div>
          
          {/* Technical Stats */}
          <div style={{ fontSize: '9px', color: '#9CA3AF', marginBottom: '8px' }}>
            <div>TECHNICAL:</div>
            <div style={{ marginLeft: '8px' }}>
              <div>JS Number Precision: ~15-17 digits</div>
              <div>GPS Physical Limit: 2-5m (ideal)</div>
              <div>Browser API Limit: Hardware dependent</div>
            </div>
          </div>
          
          {/* Position History */}
          {showHistory && positionHistory.length > 0 && (
            <div style={{ 
              marginTop: '8px', 
              fontSize: '9px',
              maxHeight: '200px',
              overflowY: 'auto',
              backgroundColor: 'rgba(255,255,255,0.1)',
              padding: '4px',
              borderRadius: '4px'
            }}>
              <div style={{ color: '#FFD700', marginBottom: '4px' }}>
                POSITION HISTORY ({positionHistory.length}):
              </div>
              {positionHistory.slice().reverse().map((pos, index) => {
                const age = (Date.now() - pos.timestamp) / 1000;
                return (
                  <div key={pos.timestamp} style={{ marginBottom: '2px' }}>
                    <div style={{ color: getQualityColor(getQualityFromAccuracy(pos.accuracy)) }}>
                      #{positionHistory.length - index}: {pos.accuracy.toFixed(1)}m ({age.toFixed(1)}s ago)
                    </div>
                    <div style={{ marginLeft: '8px', color: '#9CA3AF' }}>
                      {pos.coordinates[1].toFixed(8)}, {pos.coordinates[0].toFixed(8)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          
          {/* Tips */}
          <div style={{ 
            marginTop: '8px', 
            fontSize: '9px', 
            color: '#9CA3AF',
            borderTop: '1px solid #374151',
            paddingTop: '4px'
          }}>
            💡 TIPS:<br/>
            • Wait for STABLE + GOOD quality<br/>
            • 8-10 decimal places = precision, not accuracy<br/>
            • GPS accuracy is the real limitation<br/>
            • Position averaging improves stability
          </div>
        </>
      )}

      {/* ✅ NEW: Progressive disclosure hint */}
      <div style={{
        fontSize: '8px',
        color: '#6B7280',
        textAlign: 'center',
        marginTop: '4px',
        opacity: 0.7
      }}>
        {disclosureLevel === 'minimal' && 'Click for GPS status →'}
        {disclosureLevel === 'summary' && 'Click for full debug →'}
        {disclosureLevel === 'detailed' && '← Click to minimize'}
      </div>
    </div>
  );
};

// Helper function to get quality from accuracy value
function getQualityFromAccuracy(accuracy: number): PositionQuality {
  if (accuracy <= 3) return PositionQuality.EXCELLENT;
  if (accuracy <= 8) return PositionQuality.GOOD;
  if (accuracy <= 15) return PositionQuality.FAIR;
  if (accuracy <= 50) return PositionQuality.POOR;
  return PositionQuality.UNACCEPTABLE;
}

export default PrecisionDebugger;