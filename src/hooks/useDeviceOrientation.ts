// src/hooks/useDeviceOrientation.ts
import { useState, useEffect, useRef, useCallback } from 'react';
import { usePermissions } from '../context/PermissionsContext';
import { PermissionType } from '../utils/permissions';
import * as THREE from 'three';

/**
 * Device orientation data interface
 */
export interface DeviceOrientationData {
  alpha: number | null;  // Compass heading (0° = North, 90° = East)
  beta: number | null;   // Front-to-back tilt (-180° to 180°)
  gamma: number | null;  // Left-to-right tilt (-90° to 90°)
  absolute: boolean;     // Whether readings are absolute (vs relative)
}

/**
 * Hook options interface
 */
export interface UseDeviceOrientationOptions {
  enableSmoothing?: boolean;      // Apply smoothing to reduce jitter
  fallbackHeading?: number;       // Heading to use when no orientation data (default: 0 = North)
  debugMode?: boolean;            // Enable console logging for debugging
}

/**
 * Hook return value interface
 */
export interface UseDeviceOrientationReturn {
  heading: number | null;                    // Compass heading in degrees (0-360°, null if unavailable)
  deviceOrientation: DeviceOrientationData | null;  // Raw orientation data
  isAvailable: boolean;                      // Device supports orientation sensors
  isPermissionGranted: boolean;              // Permission has been granted
  error: string | null;                      // Error message if something went wrong
  accuracy: number | null;                   // iOS compass accuracy (if available)
  requestPermission: () => Promise<boolean>; // Function to request permission
  getCameraQuaternion: () => THREE.Quaternion | null;  // NEW: Camera quaternion for AR
}

/**
 * Create Three.js quaternion from device orientation for camera use
 * Handles iOS/Android differences and coordinate system conversion
 */
export function createQuaternionFromDeviceOrientation(
  alpha: number, 
  beta: number, 
  gamma: number
): THREE.Quaternion {
  // Convert degrees to radians
  const alphaRad = alpha * Math.PI / 180;
  const betaRad = beta * Math.PI / 180;
  const gammaRad = gamma * Math.PI / 180;

  // Detect platform for coordinate system corrections
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  
  // Create Euler rotation with platform-specific corrections for CAMERA
  const euler = new THREE.Euler();
  
  if (isIOS) {
    // iOS DeviceOrientation to Three.js camera conversion
    euler.set(betaRad - Math.PI/2, alphaRad, -gammaRad, 'YXZ');
  } else {
    // Android DeviceOrientation to Three.js camera conversion  
    euler.set(betaRad - Math.PI/2, -alphaRad, gammaRad, 'YXZ');
  }
  
  // Convert to quaternion (no additional correction needed for this approach)
  const quaternion = new THREE.Quaternion().setFromEuler(euler);
  
  return quaternion;
}

/**
 * Custom hook for device orientation with cross-platform compatibility
 * 
 * Handles iOS/Android differences, permission requests, and browser compatibility.
 * Provides a single source of truth for device orientation across components.
 * 
 * @param options Configuration options for the hook
 * @returns Device orientation data and control functions
 */
export function useDeviceOrientation(
  options: UseDeviceOrientationOptions = {}
): UseDeviceOrientationReturn {
  const {
    enableSmoothing = true,
    fallbackHeading = 0,
    debugMode = false
  } = options;

//************* REFS REFS REFS */
  // Refs for smoothing and cleanup
  const lastHeadingRef = useRef<number | null>(null);
  const smoothingFactorRef = useRef(0.1); // How much smoothing to apply (0 = no smoothing, 1 = no change)
  const isListenerActiveRef = useRef(false);

//************* STATE STATE STATE */
  // State for orientation data
  const [deviceOrientation, setDeviceOrientation] = useState<DeviceOrientationData | null>(null);
  const [isAvailable, setIsAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);

 // Use existing permissions context
  const { isPermissionGranted, requestPermission: requestContextPermission } = usePermissions();

  // Debug logging utility
  const debugLog = useCallback((message: string, data?: any) => {
    if (debugMode) {
      console.log(`🧭 useDeviceOrientation: ${message}`, data || '');
    }
  }, [debugMode]);

  /**
   * Calculate compass heading from device orientation alpha value
   * THIS FUNCTION STAYS UNCHANGED - Used for GPS/world positioning
   */
  const calculateHeading = useCallback((orientation: DeviceOrientationData): number | null => {
    // Priority 1: iOS webkitCompassHeading (true compass)
    if ('webkitCompassHeading' in orientation) {
      const webkitHeading = (orientation as any).webkitCompassHeading;
      if (typeof webkitHeading === 'number') {
        debugLog('Using iOS webkitCompassHeading', webkitHeading);
        return webkitHeading; // Already normalized 0-360 and compass-corrected
      }
    }

    // Priority 2: Absolute alpha (Android absolute orientation)
    if (orientation.absolute && orientation.alpha !== null) {
      let heading = orientation.alpha;
      debugLog('Using absolute alpha', heading);
      
      // Normalize to 0-360 range
      while (heading < 0) heading += 360;
      while (heading >= 360) heading -= 360;
      
      return heading;
    }

    // Priority 3: Relative alpha (may not be true compass)
    if (orientation.alpha !== null) {
      let heading = orientation.alpha;
      debugLog('Using relative alpha (may be inaccurate)', heading);
      
      // Normalize to 0-360 range
      while (heading < 0) heading += 360;
      while (heading >= 360) heading -= 360;
      
      // Apply smoothing if enabled
      if (enableSmoothing && lastHeadingRef.current !== null) {
        // Handle wrapping around 0/360 boundary
        let diff = heading - lastHeadingRef.current;
        if (diff > 180) diff -= 360;
        if (diff < -180) diff += 360;
        
        heading = lastHeadingRef.current + (diff * smoothingFactorRef.current);
        
        // Normalize again after smoothing
        while (heading < 0) heading += 360;
        while (heading >= 360) heading -= 360;
      }

      lastHeadingRef.current = heading;
      return heading;
    }

    return null;
  }, [enableSmoothing, debugLog]);

  /**
   * NEW: Get camera quaternion for AR use
   * Separate from compass heading calculation
   */
  const getCameraQuaternion = useCallback((): THREE.Quaternion | null => {
    if (!deviceOrientation || 
        deviceOrientation.alpha === null || 
        deviceOrientation.beta === null || 
        deviceOrientation.gamma === null) {
      return null;
    }

    try {
      return createQuaternionFromDeviceOrientation(
        deviceOrientation.alpha,
        deviceOrientation.beta,
        deviceOrientation.gamma
      );
    } catch (error) {
      debugLog('Error creating camera quaternion:', error);
      return null;
    }
  }, [deviceOrientation, debugLog]);

  /**
   * Handle device orientation events
   */
  const handleDeviceOrientation = useCallback((event: DeviceOrientationEvent) => {
    const { alpha, beta, gamma } = event;
    
    debugLog('Raw orientation event', { 
        alpha, 
        beta, 
        gamma, 
        absolute: event.absolute,
        webkitCompassHeading: (event as any).webkitCompassHeading
    });

    // Validate orientation data
    if (alpha === null && beta === null && gamma === null) {
        debugLog('Received null orientation data - sensor may not be available');
        return;
    }

    // Create orientation data object with iOS compass heading
    const orientationData: DeviceOrientationData = {
        alpha,
        beta, 
        gamma,
        absolute: event.absolute || false
    };

    // IMPORTANT: Capture iOS webkitCompassHeading for true compass
    if ('webkitCompassHeading' in event) {
        const webkitHeading = (event as any).webkitCompassHeading;
        if (typeof webkitHeading === 'number') {
        // Store the true compass heading in a custom property
        (orientationData as any).webkitCompassHeading = webkitHeading;
        debugLog('iOS webkitCompassHeading captured', webkitHeading);
        }
    }

    // Handle iOS-specific compass accuracy (non-standard property)
    if ('webkitCompassAccuracy' in event) {
        const compassAccuracy = (event as any).webkitCompassAccuracy;
        if (typeof compassAccuracy === 'number') {
        setAccuracy(compassAccuracy);
        debugLog('iOS compass accuracy', compassAccuracy);
        }
    }

    setDeviceOrientation(orientationData);
    setError(null); // Clear any previous errors
    }, [debugLog]);

  /**
   * Request device orientation permission (especially important for iOS 13+)
   */
  const requestOrientationPermission = useCallback(async (): Promise<boolean> => {
    debugLog('Requesting device orientation permission...');

    try {
      // First check if permission is already granted via context
      if (isPermissionGranted(PermissionType.ORIENTATION)) {
        debugLog('Permission already granted via context');
        return true;
      }

      // iOS 13+ requires explicit permission request
      if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
        debugLog('iOS detected - requesting DeviceOrientationEvent permission');
        
        const permission = await (DeviceOrientationEvent as any).requestPermission();
        const granted = permission === 'granted';
        
        debugLog('iOS permission result', permission);
        
        if (!granted) {
          setError('Device orientation permission denied. Please allow motion access in Safari settings.');
          return false;
        }
      }

      // Also request via existing permission context for consistency
      const contextGranted = await requestContextPermission(PermissionType.ORIENTATION);
      debugLog('Context permission result', contextGranted);

      return true;
    } catch (err) {
      const errorMessage = `Failed to request orientation permission: ${err}`;
      debugLog('Permission request error', err);
      setError(errorMessage);
      return false;
    }
  }, [isPermissionGranted, requestContextPermission, debugLog]);

  /**
   * Check if device orientation is supported
   */
  const checkDeviceOrientationSupport = useCallback((): boolean => {
    const supported = 'DeviceOrientationEvent' in window;
    debugLog('Device orientation support check', supported);
    return supported;
  }, [debugLog]);

  /**
   * Initialize device orientation listener
   */
  const initializeOrientation = useCallback(async () => {
    debugLog('Initializing device orientation...');

    // Check support
    if (!checkDeviceOrientationSupport()) {
      setError('Device orientation not supported on this device/browser');
      setIsAvailable(false);
      return;
    }

    // Request permission
    const permissionGranted = await requestOrientationPermission();
    if (!permissionGranted) {
      setIsAvailable(false);
      return;
    }

    // Add event listener
    if (!isListenerActiveRef.current) {
      window.addEventListener('deviceorientation', handleDeviceOrientation, true);
      isListenerActiveRef.current = true;
      debugLog('Device orientation listener added');
    }

    setIsAvailable(true);
    debugLog('Device orientation initialized successfully');
  }, [checkDeviceOrientationSupport, requestOrientationPermission, handleDeviceOrientation, debugLog]);

  /**
   * Cleanup function
   */
  const cleanup = useCallback(() => {
    if (isListenerActiveRef.current) {
      window.removeEventListener('deviceorientation', handleDeviceOrientation, true);
      isListenerActiveRef.current = false;
      debugLog('Device orientation listener removed');
    }
  }, [handleDeviceOrientation, debugLog]);

  // Initialize on mount
  useEffect(() => {
    initializeOrientation();
    
    // Cleanup on unmount
    return cleanup;
  }, []); // Empty deps - only run once

  // Calculate current heading (UNCHANGED - for GPS/world positioning)
  const heading = deviceOrientation ? calculateHeading(deviceOrientation) : null;

  // Use fallback heading if no orientation data is available but device supports it
  const finalHeading = heading !== null ? heading : (isAvailable ? fallbackHeading : null);

  // Debug current state
  useEffect(() => {
    if (debugMode) {
      debugLog('Current state', {
        heading: finalHeading,
        isAvailable,
        isPermissionGranted: isPermissionGranted(PermissionType.ORIENTATION),
        error,
        accuracy,
        hasOrientation: !!deviceOrientation
      });
    }
  }, [finalHeading, isAvailable, error, accuracy, deviceOrientation, debugMode, debugLog, isPermissionGranted]);

  return {
    heading: finalHeading,
    deviceOrientation,
    isAvailable,
    isPermissionGranted: isPermissionGranted(PermissionType.ORIENTATION),
    error,
    accuracy,
    requestPermission: requestOrientationPermission,
    getCameraQuaternion  // NEW: Camera quaternion function
  };
}

/**
 * Utility function to format heading for display
 */
export function formatHeading(heading: number | null): string {
  if (heading === null) return 'N/A';
  return `${heading.toFixed(1)}°`;
}

/**
 * Utility function to get cardinal direction from heading
 */
export function getCardinalDirection(heading: number | null): string {
  if (heading === null) return 'Unknown';
  
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(heading / 45) % 8;
  return directions[index];
}

/**
 * Utility function to calculate difference between two headings (accounting for 0/360 wrap)
 */
export function getHeadingDifference(heading1: number, heading2: number): number {
  let diff = heading2 - heading1;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return diff;
}