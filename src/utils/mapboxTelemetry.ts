/**
 * mapboxTelemetry.ts
 * 
 * Utility for managing and blocking Mapbox telemetry.
 * Provides functions to disable telemetry through various methods.
 */

import { isArcBrowser, isFirefoxBrowser } from './browserDetection';

/**
 * Main function to disable Mapbox telemetry through official channels
 * @returns boolean indicating if official methods were attempted
 */
export const disableOfficialTelemetry = (): boolean => {
  try {
    // Access mapboxgl - requires the library to be already loaded
    const mapboxgl = (window as any).mapboxgl;
    
    if (!mapboxgl) {
      console.warn('Mapbox GL not found, cannot disable telemetry through official methods');
      return false;
    }
    
    // This property should exist in newer versions
    if (typeof mapboxgl.config === 'object' && mapboxgl.config !== null) {
      console.log('Attempting to disable Mapbox telemetry via official methods');
      
      // For newer versions that might have this method
      if (typeof mapboxgl.setTelemetryEnabled === 'function') {
        mapboxgl.setTelemetryEnabled(false);
        console.log('Telemetry disabled via setTelemetryEnabled');
        return true;
      }
    }
    
    // Official methods not available
    return false;
  } catch (e) {
    console.warn('Could not disable Mapbox telemetry directly:', e);
    return false;
  }
};

/**
 * Blocks Mapbox telemetry by intercepting network requests
 * @param aggressive Whether to use more aggressive blocking techniques
 */
export const blockTelemetryNetworkRequests = (aggressive: boolean = false): void => {
  // Only apply in browser environment
  if (typeof window === 'undefined') return;
  
  const isArc = isArcBrowser();
  
  // Block Fetch API requests
  const originalFetch = window.fetch;
  window.fetch = function(input, init) {
    if (input && typeof input === 'string' && 
        (input.includes('events.mapbox.com') || 
         input.includes('api.mapbox.com/events'))) {
      console.log('Blocked Mapbox telemetry fetch request:', input);
      return Promise.resolve(new Response('{}', { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' } 
      }));
    }
    return originalFetch.call(this, input, init);
  };
  
  // Block XMLHttpRequest
  const originalXHROpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (
    method: string,
    url: string | URL,
    async?: boolean,
    username?: string | null,
    password?: string | null
  ): void {
    const urlStr = typeof url === 'string' ? url : url.toString();
    if (
      urlStr &&
      (urlStr.includes('events.mapbox.com') ||
        urlStr.includes('api.mapbox.com/events'))
    ) {
      console.log('Blocked Mapbox telemetry XHR request:', urlStr);
      // Store the original URL for later checking in send()
      (this as any)._url = urlStr;
      return originalXHROpen.call(this, method, 'about:blank', typeof async === 'boolean' ? async : true, username, password);
    }
    return originalXHROpen.call(this, method, url, typeof async === 'boolean' ? async : true, username, password);
  };
  
  // Also patch the send method to prevent any data from being sent
// Block XMLHttpRequest send method
const originalXHRSend = XMLHttpRequest.prototype.send;
XMLHttpRequest.prototype.send = function(body?: Document | XMLHttpRequestBodyInit | null): void {
  if ((this as any)._url && 
      ((this as any)._url.includes('events.mapbox.com') || 
      (this as any)._url.includes('api.mapbox.com/events'))) {
    console.log('Prevented sending data to Mapbox telemetry endpoint');
      
    // Properly type the xhr object
    const xhr = this as XMLHttpRequest;
      
    // Mock the response to avoid errors
    setTimeout(() => {
      // Check if onreadystatechange is defined
      if (typeof xhr.onreadystatechange === 'function') {
        // Use defineProperty to work around readonly properties
        try {
          // These properties are normally readonly, we need to use Object.defineProperty
          // to override them for our mock response
          Object.defineProperty(xhr, 'readyState', { 
            configurable: true,
            get: function() { return 4; }
          });
            
          Object.defineProperty(xhr, 'status', { 
            configurable: true,
            get: function() { return 200; }
          });
            
          Object.defineProperty(xhr, 'responseText', { 
            configurable: true,
            get: function() { return '{}'; }
          });
            
          // Trigger the event
          xhr.onreadystatechange(new ProgressEvent('readystatechange'));
        } catch (e) {
          console.warn('Failed to mock XHR response:', e);
        }
      }
    }, 0);
    return;
  }
  return originalXHRSend.call(this, body);
};
  
  // Block WebSocket connections if available
  if (typeof WebSocket !== 'undefined') {
    const OriginalWebSocket = window.WebSocket;
    window.WebSocket = function(url: string, protocols?: string | string[]) {
      if (url && typeof url === 'string' && 
          (url.includes('events.mapbox.com') || 
           url.includes('api.mapbox.com'))) {
        console.log('Blocked Mapbox telemetry WebSocket:', url);
        // Create a dummy WebSocket that never connects
        const fakeWS = {} as WebSocket;
        setTimeout(() => {
          if (typeof (fakeWS as any).onclose === 'function') {
            (fakeWS as any).onclose(new CloseEvent('close'));
          }
        }, 50);
        return fakeWS;
      }
      return new OriginalWebSocket(url, protocols);
    } as any;
  }
  
  // Apply more aggressive blocking for Arc or when requested
  if (isArc || aggressive) {
    console.log('Applying aggressive telemetry blocking');
    
    // Block during user interaction events to catch dynamic requests
    ['mousedown', 'touchstart', 'wheel', 'keydown'].forEach(event => {
      window.addEventListener(event, () => {
        // Create a temporary stronger block during user interaction
        const originalSend = XMLHttpRequest.prototype.send;
        XMLHttpRequest.prototype.send = function(body?: Document | XMLHttpRequestBodyInit | null): void {
          if ((this as any)._url && 
              ((this as any)._url.includes('events.mapbox.com') || 
               (this as any)._url.includes('api.mapbox.com/events'))) {
            console.log('Blocked reactive XHR during user interaction');
            return;
          }
          return originalSend.call(this, body);
        };
        
        // Restore after a short delay
        setTimeout(() => {
          XMLHttpRequest.prototype.send = originalSend;
        }, 100);
      }, { passive: true });
    });
  }
};

/**
 * Sets up event suppression for a Mapbox map instance
 * @param map Mapbox map instance
 */
export const setupMapEventSuppression = (map: any): void => {
  if (!map || !map.fire) {
    console.warn('Map instance not valid for event suppression');
    return;
  }
  
  // Store original fire method
  const originalFire = map.fire;
  
  // Replace with filtered version
  map.fire = function(event: any, ...args: any[]) {
    // Suppress events that look like telemetry
    const eventName = typeof event === 'string' ? event : event?.type;
    if (typeof eventName === 'string' && 
        (eventName.startsWith('mapbox.') || 
         eventName.includes('telemetry') ||
         eventName === 'trackResize' && args?.length > 0 && args[0]?.timestamp)) {
      console.log('Suppressed Mapbox event:', eventName);
      return map;
    }
    return originalFire.apply(this, [event, ...args]);
  };
};

/**
 * Removes telemetry DOM elements that Mapbox might add
 */
export const removeTelemetryElements = (): void => {
  // Apply CSS to minimize Mapbox branding and possible tracking elements
  const style = document.createElement('style');
  style.innerHTML = `
    .mapboxgl-ctrl-logo {
      opacity: 0.3 !important;
      transform: scale(0.8) !important;
    }
    .mapboxgl-ctrl-attrib-inner {
      opacity: 0.3 !important;
      font-size: 9px !important;
    }
    /* Hide any potential tracking pixels */
    img[src*="events.mapbox.com"],
    img[src*="api.mapbox.com/events"] {
      display: none !important;
    }
  `;
  document.head.appendChild(style);
  
  // Look for and remove any tracking pixels
  setInterval(() => {
    const trackingPixels = document.querySelectorAll(
      'img[src*="events.mapbox.com"], img[src*="api.mapbox.com/events"]'
    );
    trackingPixels.forEach(pixel => {
      if (pixel.parentNode) {
        pixel.parentNode.removeChild(pixel);
      }
    });
  }, 2000);
};

/**
 * Complete telemetry blocking solution that applies all methods
 * @param map Optional Mapbox map instance for event suppression
 * @param options Configuration options
 */
export const blockMapboxTelemetry = (
  map?: any, 
  options: { 
    aggressive?: boolean, 
    removeElements?: boolean 
  } = {}
): void => {
  // Try official methods first
  const officialMethodsWorked = disableOfficialTelemetry();
  
  // Always apply network blocking
  blockTelemetryNetworkRequests(options.aggressive || isArcBrowser());
  
  // If map instance provided, set up event suppression
  if (map) {
    setupMapEventSuppression(map);
  }
  
  // Optionally remove DOM elements
  if (options.removeElements) {
    removeTelemetryElements();
  }
  
  console.log(`Mapbox telemetry blocking applied. Official methods ${officialMethodsWorked ? 'succeeded' : 'failed'}.`);
};

export default {
  blockMapboxTelemetry,
  disableOfficialTelemetry,
  blockTelemetryNetworkRequests,
  setupMapEventSuppression,
  removeTelemetryElements
};