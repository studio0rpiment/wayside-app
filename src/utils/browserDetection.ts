/**
 * browserDetection.ts
 * 
 * Utility functions for detecting browsers and their capabilities.
 * Focused on mobile browsers with support for Safari, Chrome, and Firefox.
 */

/**
 * Detects if the current browser is Firefox
 * Uses multiple detection methods for reliability
 */
export const isFirefoxBrowser = (): boolean => {
  // Check if window and navigator exist (for SSR safety)
  if (typeof window === 'undefined' || !window.navigator) {
    return false;
  }
  
  // Check using multiple methods for reliable detection
  const ua = navigator.userAgent;
  
  // Check for common Firefox identifier
  if (ua.indexOf('Firefox') !== -1) {
    return true;
  }
  
  // Check for Firefox on iOS (which uses WebKit but has Firefox in UA)
  if (ua.indexOf('FxiOS') !== -1) {
    return true;
  }
  
  // Return false if none of the checks match
  return false;
};

/**
 * Detects if the current browser is Chrome
 */
export const isChromeBrowser = (): boolean => {
  if (typeof window === 'undefined' || !window.navigator) {
    return false;
  }
  
  const ua = navigator.userAgent;
  
  // Check for Chrome or Chrome on iOS
  return ua.indexOf('Chrome') !== -1 || ua.indexOf('CriOS') !== -1;
};

/**
 * Detects if the current browser is Safari
 */
export const isSafariBrowser = (): boolean => {
  if (typeof window === 'undefined' || !window.navigator) {
    return false;
  }
  
  const ua = navigator.userAgent;
  
  // Check for Safari, but exclude Chrome and other browsers that include "Safari" in UA
  // Safari on iOS will have "Safari" and "Mobile" but not "Chrome" or "CriOS"
  return ua.indexOf('Safari') !== -1 && 
         ua.indexOf('Chrome') === -1 && 
         ua.indexOf('CriOS') === -1;
};

/**
 * Detects if we're running on iOS
 */
export const isIOS = (): boolean => {
  if (typeof window === 'undefined' || !window.navigator) {
    return false;
  }
  
  const ua = navigator.userAgent;
  
  // Check for iOS devices
  return /iPad|iPhone|iPod/.test(ua) || 
         (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

/**
 * Detects if we're running on Android
 */
export const isAndroid = (): boolean => {
  if (typeof window === 'undefined' || !window.navigator) {
    return false;
  }
  
  const ua = navigator.userAgent;
  
  // Check for Android devices
  return ua.indexOf('Android') !== -1;
};

/**
 * For compatibility, we still include the Arc browser detection,
 * although it's rarely used on mobile
 */
export const isArcBrowser = (): boolean => {
  if (typeof window === 'undefined' || !window.navigator) {
    return false;
  }
  
  const ua = navigator.userAgent;
  
  // Arc browser detection
  return ua.indexOf('Arc/') !== -1;
};

/**
 * Returns optimal map settings based on browser detection
 * Focused on mobile browsers and without unnecessary limitations
 * @returns Object with recommended settings for Mapbox
 */
export const getOptimalMapSettings = () => {
  const isFirefox = isFirefoxBrowser();
  const isIos = isIOS();
  const isArc = isArcBrowser();
  
  // Base settings that work well across mobile browsers
  const settings = {
    preserveDrawingBuffer: false,
    antialias: true,
    fadeDuration: 300,
    renderWorldCopies: true,
    collectResourceTiming: false,
    attributionControl: false,
    cooperativeGestures: true,  // Better for touch interfaces
    pitchWithRotate: true       // Allow pitch with rotate
  };
  
  // Firefox-specific optimizations
  if (isFirefox) {
    return {
      ...settings,
      preserveDrawingBuffer: true,  // Help with Firefox WebGL rendering
      fadeDuration: 0               // Reduce animations in Firefox
      // No zoom limitations for Firefox
    };
  }
  
  // iOS-specific optimizations
  if (isIos) {
    return {
      ...settings,
      cooperativeGestures: true     // Particularly important for iOS
    };
  }
  
  // Arc-specific optimizations (kept for compatibility)
  if (isArc) {
    return {
      ...settings,
      refreshExpiredTiles: false,   // Reduce network requests
      fadeDuration: 0               // Minimize animations
    };
  }
  
  // Return default settings for other browsers
  return settings;
};

/**
 * Browser detection utility object that combines all detections
 */
export const BrowserInfo = {
  isFirefox: isFirefoxBrowser(),
  isChrome: isChromeBrowser(),
  isSafari: isSafariBrowser(),
  isIOS: isIOS(),
  isAndroid: isAndroid(),
  isArc: isArcBrowser(),
  getMapSettings: getOptimalMapSettings
};

export default BrowserInfo;