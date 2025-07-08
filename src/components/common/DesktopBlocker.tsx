// src/components/common/DesktopBlocker.tsx
import React, { useState, useEffect } from 'react';

interface DesktopBlockerProps {
  children: React.ReactNode;
}

const DesktopBlocker: React.FC<DesktopBlockerProps> = ({ children }) => {
  const [isClient, setIsClient] = useState(false);

  // Ensure we're on the client side
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Detect if device is desktop - only run on client
  const isDesktop = () => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return false; // Assume mobile if we can't detect
    }
    
    const userAgent = navigator.userAgent.toLowerCase();
    const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    // Consider it desktop if not mobile user agent AND no touch support
    return !isMobile && !hasTouch;
  };

  // Check for URL bypass parameters (handles hash-based routing)
  const hasUrlBypass = () => {
    if (typeof window === 'undefined') {
      return false;
    }
    
    let searchString = '';
    
    try {
      // Check regular query params first
      if (window.location.search) {
        searchString = window.location.search;
      }
      // Then check hash for query params (React Router hash mode)
      else if (window.location.hash && window.location.hash.includes('?')) {
        const hashParts = window.location.hash.split('?');
        searchString = '?' + hashParts.slice(1).join('?');
      }
      
      const urlParams = new URLSearchParams(searchString);
      return (
        urlParams.has('preview') ||
        urlParams.has('demo') ||
        urlParams.has('access') ||
        process.env.NODE_ENV === 'development'
      );
    } catch (error) {
      console.warn('Error checking URL bypass:', error);
      return false;
    }
  };

  // Don't render anything until we're on the client
  if (!isClient) {
    return <>{children}</>;
  }

  // Debug logging - ALWAYS log
  const desktopCheck = isDesktop();
  const bypassCheck = hasUrlBypass();
  
  // Force console log every render
  console.log('🖥️ DesktopBlocker Debug - FORCED LOG:', {
    isClient,
    isDesktop: desktopCheck,
    hasUrlBypass: bypassCheck,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'undefined',
    hasTouch: typeof window !== 'undefined' ? ('ontouchstart' in window) : false,
    maxTouchPoints: typeof navigator !== 'undefined' ? navigator.maxTouchPoints : 0,
    shouldBlock: desktopCheck && !bypassCheck,
    currentURL: typeof window !== 'undefined' ? window.location.href : 'undefined'
  });

  // FORCE BLOCK for testing - this should always show the modal
  if (true) {
    console.log('🚫 FORCE BLOCKING - Modal should show');
   
    return (
      <>
        {/* Backdrop */}
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: '#1a1a1a',
          zIndex: 9999
        }} />

        {/* Blocking Modal */}
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: '#2a2a2a',
          color: 'white',
          padding: '40px',
          borderRadius: '12px',
          maxWidth: '500px',
          width: '90%',
          textAlign: 'center',
          zIndex: 10000,
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)'
        }}>
          {/* Icon */}
          <div style={{
            fontSize: '64px',
            marginBottom: '20px'
          }}>
            📱
          </div>

          {/* Title */}
          <h1 style={{ 
            margin: '0 0 20px 0', 
            fontSize: '28px',
            color: '#ffffff'
          }}>
            Mobile Device Required
          </h1>
          
          {/* Main message */}
          <p style={{ 
            fontSize: '18px', 
            lineHeight: '1.6', 
            marginBottom: '20px',
            color: '#e0e0e0'
          }}>
            This immersive AR experience is designed for mobile devices with GPS and motion sensors.
          </p>
          
          {/* Instructions */}
          <p style={{ 
            fontSize: '16px', 
            opacity: 0.8, 
            marginBottom: '30px',
            color: '#b0b0b0'
          }}>
            Please visit this site on a <strong>smartphone</strong> or <strong>tablet</strong> to access the AR features at Kenilworth Aquatic Gardens.
          </p>

          {/* Park info */}
          <div style={{ 
            fontSize: '14px', 
            opacity: 0.6, 
            marginBottom: '30px',
            padding: '15px',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '8px'
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#4a90e2' }}>
              📍 Kenilworth Aquatic Gardens
            </div>
            <div>1550 Anacostia Ave NE</div>
            <div>Washington, DC 20019</div>
          </div>
          
          {/* Action button */}
          <button
            onClick={() => {
              try {
                window.location.href = '/';
              } catch (error) {
                console.warn('Navigation error:', error);
              }
            }}
            style={{
              padding: '15px 30px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer',
              minWidth: '150px',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#0056b3';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = '#007bff';
            }}
          >
            🏠 Back to Home
          </button>

          {/* QR Code suggestion */}
          <div style={{
            marginTop: '25px',
            padding: '15px',
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            borderRadius: '8px',
            fontSize: '12px',
            opacity: 0.7
          }}>
            💡 <strong>Tip:</strong> Scan a QR code or send yourself the link to easily access this on your mobile device
          </div>

          {/* Developer bypass info (only in development) */}
          {process.env.NODE_ENV === 'development' && (
            <div style={{
              marginTop: '20px',
              padding: '10px',
              backgroundColor: 'rgba(255, 255, 0, 0.1)',
              border: '1px solid rgba(255, 255, 0, 0.3)',
              borderRadius: '6px',
              fontSize: '11px',
              color: '#ffeb3b'
            }}>
              <div><strong>🔧 Developer Mode:</strong></div>
              <div>Add ?preview, ?demo, or ?access to URL to bypass desktop blocking</div>
              <div style={{ marginTop: '5px', fontFamily: 'monospace', fontSize: '10px' }}>
                Example: {typeof window !== 'undefined' ? window.location.origin : ''}/#/onboarding?access
              </div>
            </div>
          )}
        </div>
      </>
    );
  }

  // If we get here, something is wrong - this should never happen with force block
  console.log('❌ DesktopBlocker: Should not reach this point with force blocking!');
  
  // If mobile or bypass is active, render children normally
  return <>{children}</>;
};

export default DesktopBlocker;