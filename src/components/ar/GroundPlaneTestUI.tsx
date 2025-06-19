// src/components/ar/GroundPlaneTestUI.tsx
import React from 'react';
import { GroundPlaneResult } from './GroundPlaneDetector';

interface GroundPlaneTestUIProps {
  isTestMode: boolean;
  onToggleTestMode: () => void;
  onDetectNow: () => void;
  lastResult: GroundPlaneResult | null;
}

const GroundPlaneTestUI: React.FC<GroundPlaneTestUIProps> = ({
  isTestMode,
  onToggleTestMode,
  onDetectNow,
  lastResult
}) => {
  return (
    <div style={{ borderTop: '1px solid rgba(255,255,255,0.3)', paddingTop: '5px', marginTop: '5px' }}>
      <div style={{ color: 'yellow', fontSize: '10px' }}>🌍 GROUND PLANE TEST</div>
      
      <button
        onClick={onToggleTestMode}
        style={{
          fontSize: '10px',
          padding: '4px 8px',
          backgroundColor: isTestMode ? 'rgba(0,255,0,0.3)' : 'rgba(255,255,255,0.3)',
          border: 'none',
          color: 'white',
          cursor: 'pointer',
          marginRight: '5px'
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
      
      {lastResult && (
        <div style={{ fontSize: '8px', marginTop: '5px' }}>
          <div style={{ color: lastResult.confidence > 0.7 ? 'lightgreen' : 'orange' }}>
            Detected: {lastResult.detected ? '✅' : '❌'}
          </div>
          <div>Distance: {lastResult.distance?.toFixed(2)}m</div>
          <div>Confidence: {(lastResult.confidence * 100)?.toFixed(0)}%</div>
          <div>Method: {lastResult.method}</div>
          {lastResult.angle && (
            <div>Angle: {lastResult.angle.toFixed(1)}°</div>
          )}
        </div>
      )}
    </div>
  );
};

export default GroundPlaneTestUI;