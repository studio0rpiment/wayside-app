import React, { useState, useEffect } from 'react';
import { universalModeManager } from '../../utils/UniversalModeManager';
import { useGeofenceContext } from '../../context/GeofenceContext';
import { usePermissions } from '../../context/PermissionsContext';

interface OnboardingDebugOverlayProps {
  currentStep: number;
  allPermissionsGranted: boolean;
  showPermissionGate: boolean;
}

const OnboardingDebugOverlay: React.FC<OnboardingDebugOverlayProps> = ({
  currentStep,
  allPermissionsGranted,
  showPermissionGate
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [renderCount, setRenderCount] = useState(0);
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  
  // Get context data
  const { userPosition, isTracking, currentAccuracy, positionQuality } = useGeofenceContext();
  const { permissionsState } = usePermissions();
  
  // Track renders
  useEffect(() => {
    setRenderCount(prev => prev + 1);
    setLastUpdate(Date.now());
  });
  
  // Get Universal Mode info
  const universalModeInfo = universalModeManager.getBlockInfo();
  
  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        style={{
          position: 'fixed',
          top: '10px',
          right: '10px',
          padding: '8px 12px',
          backgroundColor: '#ff6b6b',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          fontSize: '12px',
          zIndex: 9999,
          fontFamily: 'monospace'
        }}
      >
        DEBUG
      </button>
    );
  }
  
  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      right: '10px',
      width: '300px',
      maxHeight: '80vh',
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
      color: '#00ff00',
      padding: '10px',
      borderRadius: '8px',
      fontSize: '10px',
      fontFamily: 'monospace',
      zIndex: 9999,
      overflow: 'auto',
      border: '1px solid #333'
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '10px',
        borderBottom: '1px solid #333',
        paddingBottom: '5px'
      }}>
        <strong style={{ color: '#ffff00' }}>ONBOARDING DEBUG</strong>
        <button
          onClick={() => setIsVisible(false)}
          style={{
            backgroundColor: '#666',
            color: 'white',
            border: 'none',
            borderRadius: '2px',
            padding: '2px 6px',
            fontSize: '10px'
          }}
        >
          ×
        </button>
      </div>
      
      {/* Performance Info */}
      <div style={{ marginBottom: '8px' }}>
        <div style={{ color: '#ff6b6b' }}>PERFORMANCE:</div>
        <div>Renders: {renderCount}</div>
        <div>Last: {new Date(lastUpdate).toLocaleTimeString()}</div>
      </div>
      
      {/* Onboarding State */}
      <div style={{ marginBottom: '8px' }}>
        <div style={{ color: '#ff6b6b' }}>ONBOARDING:</div>
        <div>Step: {currentStep}</div>
        <div>All Perms: {allPermissionsGranted ? '✅' : '❌'}</div>
        <div>Show Modal: {showPermissionGate ? '✅' : '❌'}</div>
      </div>
      
      {/* Permissions Detail */}
      <div style={{ marginBottom: '8px' }}>
        <div style={{ color: '#ff6b6b' }}>PERMISSIONS:</div>
        {permissionsState?.results ? Object.entries(permissionsState.results).map(([key, value]) => (
          <div key={key}>{key}: {value}</div>
        )) : <div>No permission state</div>}
      </div>
      
      {/* Location Tracking */}
      <div style={{ marginBottom: '8px' }}>
        <div style={{ color: '#ff6b6b' }}>LOCATION:</div>
        <div>Tracking: {isTracking ? '✅' : '❌'}</div>
        <div>Position: {userPosition ? 
          `${userPosition[1].toFixed(6)}, ${userPosition[0].toFixed(6)}` : 'None'
        }</div>
        <div>Accuracy: {currentAccuracy ? `${currentAccuracy.toFixed(1)}m` : 'None'}</div>
        <div>Quality: {positionQuality || 'None'}</div>
      </div>
      
      {/* Universal Mode Manager */}
      <div style={{ marginBottom: '8px' }}>
        <div style={{ color: '#ff6b6b' }}>UNIVERSAL MODE:</div>
        <div>Is Universal: {universalModeManager.isUniversal ? '✅' : '❌'}</div>
        <div>Block Location: {universalModeInfo.shouldBlockLocation ? '✅' : '❌'}</div>
        <div>Block Permissions: {universalModeInfo.shouldBlockPermissions ? '✅' : '❌'}</div>
        <div>Block Type: {universalModeInfo.blockType}</div>
        <div>Block Reason: {universalModeInfo.blockReason}</div>
        <div>URL Bypass: {universalModeInfo.hasUrlBypass ? '✅' : '❌'}</div>
        <div>Active Reasons:</div>
        {universalModeInfo.activeReasons.map(reason => (
          <div key={reason} style={{ marginLeft: '10px' }}>• {reason}</div>
        ))}
      </div>
      
      {/* Test Buttons */}
      <div style={{ marginTop: '8px', borderTop: '1px solid #333', paddingTop: '5px' }}>
        <div style={{ color: '#ff6b6b', marginBottom: '4px' }}>TESTING:</div>
        <button
          onClick={() => universalModeManager.simulateOutsidePark()}
          style={{
            backgroundColor: '#333',
            color: 'white',
            border: '1px solid #666',
            borderRadius: '2px',
            padding: '2px 4px',
            fontSize: '9px',
            marginRight: '4px',
            marginBottom: '2px'
          }}
        >
          Simulate Outside
        </button>
        <button
          onClick={() => universalModeManager.simulatePermissionFailure('both')}
          style={{
            backgroundColor: '#333',
            color: 'white',
            border: '1px solid #666',
            borderRadius: '2px',
            padding: '2px 4px',
            fontSize: '9px',
            marginRight: '4px',
            marginBottom: '2px'
          }}
        >
          Simulate Perm Fail
        </button>
        <button
          onClick={() => universalModeManager.resetTestConditions()}
          style={{
            backgroundColor: '#333',
            color: 'white',
            border: '1px solid #666',
            borderRadius: '2px',
            padding: '2px 4px',
            fontSize: '9px',
            marginBottom: '2px'
          }}
        >
          Reset
        </button>
      </div>
    </div>
  );
};

export default OnboardingDebugOverlay;