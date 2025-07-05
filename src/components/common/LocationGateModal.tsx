// src/components/common/LocationGateModal.tsx
import React from 'react';
import { universalModeManager } from '../../utils/UniversalModeManager';

interface LocationGateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBypass: () => void;
  checkType?: 'location' | 'permissions';
}

interface MessageConfig {
  title: string;
  message: string;
  action: string;
  showAddress: boolean;
}

const LocationGateModal: React.FC<LocationGateModalProps> = ({ 
  isOpen, 
  onClose, 
  onBypass,
  checkType = 'location'
}) => {
  if (!isOpen) return null;

  // Check for URL bypass
  const hasUrlBypass = 
    new URLSearchParams(window.location.search).has('universal') ||
    new URLSearchParams(window.location.search).has('demo') ||
    new URLSearchParams(window.location.search).has('access') ||
    process.env.NODE_ENV === 'development';

  // If URL bypass is active, proceed immediately
  if (hasUrlBypass) {
    onBypass();
    return null;
  }

  const blockReason = universalModeManager.blockReason;
  
  // Location-based messages (pre-permissions)
  const locationMessages: Record<string, MessageConfig> = {
    outside_park: {
      title: '🌳 Visit Kenilworth Aquatic Gardens',
      message: 'This AR experience is only available at Kenilworth Aquatic Gardens in Washington, DC.',
      action: 'Please visit the park to access the immersive AR experiences.',
      showAddress: true
    },
    no_gps_hardware: {
      title: '🚫 GPS Not Available',
      message: 'This device does not support location services required for the AR experience.',
      action: 'Please use a device with GPS capabilities to access location-based features.',
      showAddress: false
    }
  };

  // Permission-based messages (post-permissions)
  const permissionMessages: Record<string, MessageConfig> = {
    location_unavailable: {
      title: '📍 Location Access Required',
      message: 'Location access is required to verify you are at Kenilworth Aquatic Gardens and provide accurate AR positioning.',
      action: 'Please enable location permissions in your browser settings and refresh the page.',
      showAddress: false
    },
    orientation_unavailable: {
      title: '📱 Motion Access Required',
      message: 'Device motion and orientation access is required for AR camera positioning and immersive experiences.',
      action: 'Please enable motion & orientation access in your browser settings and refresh the page.',
      showAddress: false
    }
  };

  // Choose message set based on check type
  const messageSet = checkType === 'location' ? locationMessages : permissionMessages;
  
  // Fallback message if reason not found
  const fallbackMessage: MessageConfig = {
    title: checkType === 'location' ? '🚫 Location Restricted' : '🚫 Permissions Required',
    message: checkType === 'location' 
      ? 'Access to this experience is restricted to the park location.'
      : 'Required permissions are not available.',
    action: 'Please check your settings and try again.',
    showAddress: false
  };

  // Use fallback if current message doesn't exist
  const message: MessageConfig = messageSet[blockReason] || fallbackMessage;

  // Determine button behavior based on check type and block reason
  const isPermissionIssue = checkType === 'permissions' || 
    blockReason === 'location_unavailable' || 
    blockReason === 'orientation_unavailable';

  const primaryButtonText = isPermissionIssue ? 'Try Again' : 'Back to Home';
  const primaryButtonAction = isPermissionIssue ? 'retry' : 'close';

  const handlePrimaryButtonClick = () => {
    if (primaryButtonAction === 'retry') {
      window.location.reload();
    } else {
      onClose();
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          zIndex: 9998
        }}
        onClick={onClose}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        backgroundColor: '#1a1a1a',
        color: 'white',
        padding: '30px',
        borderRadius: '12px',
        maxWidth: '450px',
        width: '90%',
        textAlign: 'center',
        zIndex: 9999,
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '20px', flex: 1 }}>
            {message.title}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#888',
              fontSize: '24px',
              cursor: 'pointer',
              padding: '0',
              marginLeft: '10px'
            }}
          >
            ×
          </button>
        </div>
        
        {/* Main message */}
        <p style={{ 
          fontSize: '16px', 
          lineHeight: '1.5', 
          marginBottom: '15px',
          color: '#e0e0e0'
        }}>
          {message.message}
        </p>
        
        {/* Action instruction */}
        <p style={{ 
          fontSize: '14px', 
          opacity: 0.8, 
          marginBottom: '25px',
          color: '#b0b0b0'
        }}>
          {message.action}
        </p>

        {/* Park address (only for location-based blocks) */}
        {message.showAddress && (
          <div style={{ 
            fontSize: '12px', 
            opacity: 0.6, 
            marginBottom: '25px',
            padding: '10px',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '6px'
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
              Kenilworth Aquatic Gardens
            </div>
            <div>1550 Anacostia Ave NE</div>
            <div>Washington, DC 20019</div>
          </div>
        )}
        
        {/* Action buttons */}
        <div style={{ 
          display: 'flex', 
          gap: '10px', 
          justifyContent: 'center',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={handlePrimaryButtonClick}
            style={{
              padding: '12px 24px',
              backgroundColor: primaryButtonAction === 'retry' ? '#007bff' : '#666',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              cursor: 'pointer',
              minWidth: '120px'
            }}
          >
            {primaryButtonAction === 'retry' ? '🔄 ' : ''}
            {primaryButtonText}
          </button>

          {/* Additional retry button for permission issues that don't have retry as primary */}
          {isPermissionIssue && primaryButtonAction !== 'retry' && (
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '12px 24px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                cursor: 'pointer',
                minWidth: '120px'
              }}
            >
              🔄 Retry
            </button>
          )}
        </div>

        {/* Developer info (only in development) */}
        {process.env.NODE_ENV === 'development' && (
          <div style={{
            marginTop: '20px',
            padding: '10px',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '6px',
            fontSize: '10px',
            opacity: 0.7,
            textAlign: 'left'
          }}>
            <div><strong>Debug Info:</strong></div>
            <div>Check Type: {checkType}</div>
            <div>Block Reason: {blockReason}</div>
            <div>Universal Mode: {universalModeManager.isUniversal ? 'ON' : 'OFF'}</div>
            <div>Active Reasons: {universalModeManager.reasons.join(', ') || 'none'}</div>
            <div style={{ marginTop: '5px', color: '#4a90e2' }}>
              Bypass: Add ?universal, ?demo, or ?access to URL
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default LocationGateModal;