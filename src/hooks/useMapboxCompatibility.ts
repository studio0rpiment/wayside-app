/**
 * useMapboxCompatibility.ts
 * 
 * React hook that provides browser detection and telemetry blocking for Mapbox.
 * Centralizes compatibility features in one easy-to-use hook.
 */

import { useEffect, useState, useRef } from 'react';
import BrowserInfo, { 
  isFirefoxBrowser, 
  isChromeBrowser, 
  isSafariBrowser, 
  isIOS,
  isAndroid,
  isArcBrowser,
  getOptimalMapSettings
} from '../utils/browserDetection';
import MapboxTelemetry from '../utils/mapboxTelemetry';

interface MapboxCompatibilityOptions {
  // Whether to apply telemetry blocking
  blockTelemetry?: boolean;
  
  // Whether to use aggressive telemetry blocking
  aggressiveBlocking?: boolean;
  
  // Whether to remove telemetry DOM elements
  removeDomElements?: boolean;
  
  // Whether to apply optimal map settings based on browser
  applyOptimalSettings?: boolean;
  
  // Firefox-specific zoom handling
  firefoxZoomLimit?: boolean;
  
  // Debug mode to show extra console logs
  debug?: boolean;
}

/**
 * Hook for managing Mapbox compatibility across browsers
 * @param options Configuration options
 */
export const useMapboxCompatibility = (options: MapboxCompatibilityOptions = {}) => {
  // Default options
  const {
    blockTelemetry = true,
    aggressiveBlocking = true,
    removeDomElements = true,
    applyOptimalSettings = true,
    firefoxZoomLimit = true,
    debug = false
  } = options;
  
  // Store the map instance once it's created
  const mapRef = useRef<any>(null);
  
  // Track Firefox zoom limit state if relevant
  const [isFirefoxZoomLimited, setIsFirefoxZoomLimited] = useState(
    isFirefoxBrowser() && firefoxZoomLimit
  );
  
  // Browser detection results
  const browserInfo = {
    isFirefox: isFirefoxBrowser(),
    isChrome: isChromeBrowser(),
    isSafari: isSafariBrowser(),
    isIOS: isIOS(),
    isAndroid: isAndroid(),
    isArc: isArcBrowser(),
  };
  
  // Log browser info if debug mode is on
  useEffect(() => {
    if (debug) {
      console.log('Browser Detection:', browserInfo);
      console.log('User Agent:', navigator.userAgent);
    }
  }, [debug]);
  
  // Apply telemetry blocking when the hook is first used
  useEffect(() => {
    if (blockTelemetry) {
      if (debug) {
        console.log('Applying Mapbox telemetry blocking');
      }
      
      // Apply official blocking methods
      MapboxTelemetry.disableOfficialTelemetry();
      
      // Block network requests
      MapboxTelemetry.blockTelemetryNetworkRequests(aggressiveBlocking);
      
      // Remove DOM elements if requested
      if (removeDomElements) {
        MapboxTelemetry.removeTelemetryElements();
      }
    }
  }, [blockTelemetry, aggressiveBlocking, removeDomElements, debug]);
  
  // Set up Firefox zoom limit toggle if needed
  useEffect(() => {
    if (!browserInfo.isFirefox) return;
    
    // Only add the event listener if we're in Firefox
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'f') {
        setIsFirefoxZoomLimited(prev => !prev);
        if (debug) {
          console.log(`Firefox zoom limitation ${isFirefoxZoomLimited ? 'disabled' : 'enabled'}`);
        }
        
        // Apply zoom limit change to map if it exists
        if (mapRef.current && mapRef.current.getZoom) {
          if (isFirefoxZoomLimited && mapRef.current.getZoom() > 15.95) {
            mapRef.current.setZoom(15.95);
          }
        }
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [browserInfo.isFirefox, isFirefoxZoomLimited, debug]);
  
  /**
   * Register a Mapbox map instance with the hook
   * @param map Mapbox map instance
   */
  const registerMap = (map: any) => {
    if (!map) return;
    
    mapRef.current = map;
    
    // Apply event suppression to the map instance
    if (blockTelemetry) {
      MapboxTelemetry.setupMapEventSuppression(map);
      
      if (debug) {
        console.log('Applied event suppression to map instance');
      }
    }
    
    // Apply Firefox-specific handling if needed
    if (browserInfo.isFirefox) {
      // Disable 3D features in Firefox for better performance
      if (map.setFog) {
        map.setFog(null);
        if (debug) console.log('Disabled fog for Firefox compatibility');
      }
      
      if (map.setTerrain) {
        map.setTerrain(null);
        if (debug) console.log('Disabled terrain for Firefox compatibility');
      }
      
      // Monitor zoom to prevent going above safe level in Firefox if enabled
      if (isFirefoxZoomLimited) {
        map.on('zoom', () => {
          const currentZoom = map.getZoom();
          if (currentZoom > 15.95) {
            if (debug) console.log('Firefox zoom limit exceeded, resetting to safe level');
            map.setZoom(15.95);
          }
        });
      }
    }
  };
  
  /**
   * Get optimal Mapbox settings based on detected browser
   */
  const getMapSettings = () => {
    // Always return the latest settings to account for state changes
    const settings = getOptimalMapSettings();
    
    // Apply Firefox zoom limit if enabled
    if (browserInfo.isFirefox && isFirefoxZoomLimited) {
      return {
        ...settings,
        maxZoom: 15.95
      };
    }
    
    return settings;
  };
  
  /**
   * Apply CSS adjustments for better map rendering
   * @param containerRef Reference to the map container element
   */
const applyContainerOptimizations = (containerRef: React.RefObject<HTMLElement>): void => {
  if (!containerRef || !containerRef.current) {
    console.warn('Container ref is undefined or has no current property');
    return;
  }
  
  try {
    // Apply Firefox-specific optimizations
    if (browserInfo.isFirefox) {
      containerRef.current.style.transform = 'translateZ(0)';
      containerRef.current.style.backfaceVisibility = 'hidden';
    }
  } catch (error) {
    console.error('Error applying container optimizations:', error);
  }
};
  
  return {
    // Browser detection
    browserInfo,
    
    // Firefox zoom state
    isFirefoxZoomLimited,
    setIsFirefoxZoomLimited,
    
    // Map registration
    registerMap,
    
    // Helper functions
    getMapSettings,
    applyContainerOptimizations,
    
    // Direct access to utilities
    blockTelemetry: MapboxTelemetry.blockMapboxTelemetry
  };
};

export default useMapboxCompatibility;