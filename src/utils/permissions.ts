// src/utils/permissions.ts - Revised for iOS Safari compatibility

/**
 * Permission types supported by the AR application
 */
export enum PermissionType {
  CAMERA = 'camera',
  LOCATION = 'location',
  ORIENTATION = 'orientation',
  MICROPHONE = 'microphone',
  NOTIFICATION = 'notification' 
}

/**
 * Permission status
 */
export enum PermissionStatus {
  GRANTED = 'granted',
  DENIED = 'denied',
  PROMPT = 'prompt',
  UNKNOWN = 'unknown'
}

/**
 * Permission result object
 */
export interface PermissionResult {
  type: PermissionType;
  status: PermissionStatus;
}

/**
 * Comprehensive permissions result
 */
export interface PermissionsState {
  results: Record<PermissionType, PermissionStatus>;
  allGranted: boolean;
  isFirstTimeUser: boolean;
}

/**
 * Options for permission initialization
 */
export interface PermissionOptions {
  localStorageKey?: string;
  requiredPermissions?: PermissionType[];
  showUI?: boolean;
  onStatusChange?: (state: PermissionsState) => void;
}

// Default options
const DEFAULT_OPTIONS: PermissionOptions = {
  localStorageKey: 'park-ar-visited',
  requiredPermissions: [
    PermissionType.CAMERA,
    PermissionType.LOCATION,
    PermissionType.ORIENTATION
    // MICROPHONE: Available for future features, not required by default
    // NOTIFICATION: Removed - geofencing handles in-app notifications better
  ],
  showUI: true,
  onStatusChange: () => {}
};

// Local storage key for tracking orientation permission state
const ORIENTATION_PERMISSION_KEY = 'wayside-orientation-permission';

/**
 * Initialize permissions system
 * Acts as the main entry point for the permissions flow
 */
export async function initPermissions(options: PermissionOptions = {}): Promise<PermissionsState> {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
  
  // Check if this is first time user
  const isFirstTimeUser = !localStorage.getItem(mergedOptions.localStorageKey || '');
  
  // Mark that they've visited (for next time)
  localStorage.setItem(mergedOptions.localStorageKey || '', 'true');
  
  // Get current permission status
  const permissionsState = await checkAllPermissions(mergedOptions.requiredPermissions || []);
  permissionsState.isFirstTimeUser = isFirstTimeUser;
  
  // Notify of initial status
  if (mergedOptions.onStatusChange) {
    mergedOptions.onStatusChange(permissionsState);
  }
  
  // Determine flow based on user status and permissions
  if (permissionsState.allGranted) {
    // All permissions already granted, no need for UI
    return permissionsState;
  }
  
  // Different flows based on first time vs returning user
  if (isFirstTimeUser && mergedOptions.showUI) {
    // First time user - trigger full onboarding
    return showFullOnboarding(mergedOptions);
  } else if (mergedOptions.showUI) {
    // Returning user - show streamlined permission UI
    return showStreamlinedPermissionUI(permissionsState, mergedOptions);
  }
  
  // No UI requested, just return current state
  return permissionsState;
}

/**
 * Check all required permissions and return their status
 */
export async function checkAllPermissions(
  requiredPermissions: PermissionType[] = []
): Promise<PermissionsState> {
  console.log('🔍 Checking permissions for:', requiredPermissions);

  const results: Record<PermissionType, PermissionStatus> = {
    [PermissionType.CAMERA]: PermissionStatus.UNKNOWN,
    [PermissionType.LOCATION]: PermissionStatus.UNKNOWN,
    [PermissionType.ORIENTATION]: PermissionStatus.UNKNOWN,
    [PermissionType.MICROPHONE]: PermissionStatus.UNKNOWN,
    [PermissionType.NOTIFICATION]: PermissionStatus.UNKNOWN,
  };
  
  // Check each required permission
  const permissionChecks = await Promise.all(
    requiredPermissions.map(async (type) => {
      let status: PermissionStatus;
      
      try {
        switch (type) {
          case PermissionType.CAMERA:
            status = await checkCameraPermission();
            break;
          case PermissionType.LOCATION:
            status = await checkLocationPermission();
            break;
          case PermissionType.ORIENTATION:
            status = await checkOrientationPermission();
            break;
          case PermissionType.MICROPHONE:
            status = await checkMicrophonePermission();
            break;
          case PermissionType.NOTIFICATION:
            status = await checkNotificationPermission();
            break;
          default:
            status = PermissionStatus.UNKNOWN;
        }
      } catch (error) {
        console.error(`Error checking permission ${type}:`, error);
        status = PermissionStatus.UNKNOWN;
      }
      
      results[type] = status;
      console.log(`🎯 Permission status for ${type}:`, status);

      return status;
    })
  );

  // Check if all required permissions are granted
  const allGranted = requiredPermissions.length > 0 && 
    requiredPermissions.every(type => results[type] === PermissionStatus.GRANTED);

  return {
    results,
    allGranted,
    isFirstTimeUser: false
  };
}

/**
 * Check camera permission status
 */
export async function checkCameraPermission(): Promise<PermissionStatus> {
  try {
    // First check if the Permission API is available
    if (navigator.permissions && navigator.permissions.query) {
      try {
        const result = await navigator.permissions.query({ name: 'camera' as PermissionName });
        return result.state as PermissionStatus;
      } catch (e) {
        // Permission API might not support camera query on some browsers
        console.log('Permission API query failed for camera, using fallback');
      }
    }
    
    // Fallback: Try to access the camera with minimal constraints
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 1, height: 1 } // Minimal request
      });
      // Clean up immediately
      stream.getTracks().forEach(track => track.stop());
      return PermissionStatus.GRANTED;
    } catch (e: any) {
      // Check specific error types
      if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
        return PermissionStatus.DENIED;
      }
      return PermissionStatus.UNKNOWN;
    }
  } catch (error) {
    console.error('Error checking camera permission:', error);
    return PermissionStatus.UNKNOWN;
  }
}

/**
 * Check location permission status
 */
export async function checkLocationPermission(): Promise<PermissionStatus> {
  try {
    // First check if the Permission API is available
    if (navigator.permissions && navigator.permissions.query) {
      try {
        const result = await navigator.permissions.query({ name: 'geolocation' });
        return result.state as PermissionStatus;
      } catch (e) {
        console.log('Permission API query failed for geolocation, using fallback');
      }
    }
    
    // Fallback: Try to access location
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        () => resolve(PermissionStatus.GRANTED),
        (error) => {
          if (error.code === error.PERMISSION_DENIED) {
            resolve(PermissionStatus.DENIED);
          } else {
            resolve(PermissionStatus.UNKNOWN);
          }
        },
        { timeout: 5000, enableHighAccuracy: false, maximumAge: 300000 }
      );
    });
  } catch (error) {
    console.error('Error checking location permission:', error);
    return PermissionStatus.UNKNOWN;
  }
}

/**
 * Check device orientation permission status
 * iOS Safari specific: Cannot check without requesting, so we use localStorage to track state
 */
export async function checkOrientationPermission(): Promise<PermissionStatus> {
  try {
    // iOS 13+ Safari - has explicit permission system
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      
      // Check our localStorage cache first
      const cachedStatus = localStorage.getItem(ORIENTATION_PERMISSION_KEY);
      if (cachedStatus === 'granted') {
        // Verify it's still working by testing if events fire
        const isActuallyWorking = await testOrientationEvents();
        if (isActuallyWorking) {
          return PermissionStatus.GRANTED;
        } else {
          // Clear stale cache
          localStorage.removeItem(ORIENTATION_PERMISSION_KEY);
        }
      } else if (cachedStatus === 'denied') {
        return PermissionStatus.DENIED;
      }
      
      // No cached state or cache was stale - need to prompt user
      return PermissionStatus.PROMPT;
    }
    
    // Non-iOS browsers - test if orientation events work
    const hasOrientation = await testOrientationEvents();
    return hasOrientation ? PermissionStatus.GRANTED : PermissionStatus.UNKNOWN;
    
  } catch (error) {
    console.error('Error checking orientation permission:', error);
    return PermissionStatus.UNKNOWN;
  }
}

/**
 * Test if device orientation events are actually working
 * Returns true if events fire within timeout period
 */
function testOrientationEvents(): Promise<boolean> {
  return new Promise((resolve) => {
    let hasOrientation = false;
    const timeout = 1000; // 1 second timeout
    
    const testHandler = (event: DeviceOrientationEvent) => {
      // Check if we got real data (not all zeros)
      if (event.alpha !== null || event.beta !== null || event.gamma !== null) {
        hasOrientation = true;
        window.removeEventListener('deviceorientation', testHandler);
        resolve(true);
      }
    };
    
    // Add listener
    window.addEventListener('deviceorientation', testHandler);
    
    // Timeout fallback
    setTimeout(() => {
      window.removeEventListener('deviceorientation', testHandler);
      resolve(hasOrientation);
    }, timeout);
  });
}

/**
 * Check microphone permission status
 */
export async function checkMicrophonePermission(): Promise<PermissionStatus> {
  try {
    // First check if the Permission API is available
    if (navigator.permissions && navigator.permissions.query) {
      try {
        const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        return result.state as PermissionStatus;
      } catch (e) {
        console.log('Permission API query failed for microphone, using fallback');
      }
    }
    
    // Fallback: Try to access the microphone
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Clean up immediately
      stream.getTracks().forEach(track => track.stop());
      return PermissionStatus.GRANTED;
    } catch (e: any) {
      if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
        return PermissionStatus.DENIED;
      }
      return PermissionStatus.UNKNOWN;
    }
  } catch (error) {
    console.error('Error checking microphone permission:', error);
    return PermissionStatus.UNKNOWN;
  }
}

/**
 * Check notification permission status
 */
export async function checkNotificationPermission(): Promise<PermissionStatus> {
  try {
    // Check if Notification API is available
    if (!('Notification' in window)) {
      console.log('Notifications not supported in this browser');
      return PermissionStatus.UNKNOWN;
    }
    
    // Direct check of Notification permission status
    switch (Notification.permission) {
      case 'granted':
        return PermissionStatus.GRANTED;
      case 'denied':
        return PermissionStatus.DENIED;
      case 'default':
        return PermissionStatus.PROMPT;
      default:
        return PermissionStatus.UNKNOWN;
    }
  } catch (error) {
    console.error('Error checking notification permission:', error);
    return PermissionStatus.UNKNOWN;
  }
}

/**
 * Request camera permission
 */
export async function requestCameraPermission(): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    // Clean up the stream
    stream.getTracks().forEach(track => track.stop());
    return true;
  } catch (error: any) {
    console.error('Error requesting camera permission:', error);
    if (error.name === 'NotAllowedError') {
      console.log('Camera permission explicitly denied by user');
    }
    return false;
  }
}

/**
 * Request location permission
 */
export async function requestLocationPermission(): Promise<boolean> {
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      () => {
        console.log('Location permission granted');
        resolve(true);
      },
      (error) => {
        console.error('Location permission denied:', error);
        resolve(false);
      },
      { timeout: 10000, enableHighAccuracy: false, maximumAge: 300000 }
    );
  });
}

/**
 * Request device orientation permission
 * IMPORTANT: Must be called from a user gesture (click event)
 */
export async function requestOrientationPermission(): Promise<boolean> {
  try {
    // iOS 13+ requires explicit permission
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      
      console.log('Requesting iOS orientation permission...');
      const permission = await (DeviceOrientationEvent as any).requestPermission();
      
      // Cache the result in localStorage
      localStorage.setItem(ORIENTATION_PERMISSION_KEY, permission);
      
      if (permission === 'granted') {
        console.log('iOS orientation permission granted');
        return true;
      } else {
        console.log('iOS orientation permission denied');
        return false;
      }
    }
    
    // Non-iOS browsers - test if orientation works
    const hasOrientation = await testOrientationEvents();
    if (hasOrientation) {
      console.log('Orientation events available (non-iOS)');
      return true;
    } else {
      console.log('Orientation events not available');
      return false;
    }
    
  } catch (error) {
    console.error('Error requesting orientation permission:', error);
    // Cache denial on error
    localStorage.setItem(ORIENTATION_PERMISSION_KEY, 'denied');
    return false;
  }
}

/**
 * Request microphone permission
 */
export async function requestMicrophonePermission(): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Clean up the stream
    stream.getTracks().forEach(track => track.stop());
    console.log('Microphone permission granted');
    return true;
  } catch (error: any) {
    console.error('Error requesting microphone permission:', error);
    if (error.name === 'NotAllowedError') {
      console.log('Microphone permission explicitly denied by user');
    }
    return false;
  }
}

/**
 * Request notification permission
 */
export async function requestNotificationPermission(): Promise<boolean> {
  try {
    // Check if Notification API is available
    if (!('Notification' in window)) {
      console.log('Notifications not supported in this browser');
      return false;
    }
    
    // Request permission
    const permission = await Notification.requestPermission();
    const granted = permission === 'granted';
    
    if (granted) {
      console.log('Notification permission granted');
    } else {
      console.log('Notification permission denied');
    }
    
    return granted;
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return false;
  }
}

/**
 * Request all required permissions in sequence
 * This ensures proper UX for permission dialogs
 */
export async function requestAllPermissions(
  requiredPermissions: PermissionType[] = []
): Promise<PermissionsState> {
  const results: Record<PermissionType, PermissionStatus> = {
    [PermissionType.CAMERA]: PermissionStatus.UNKNOWN,
    [PermissionType.LOCATION]: PermissionStatus.UNKNOWN,
    [PermissionType.ORIENTATION]: PermissionStatus.UNKNOWN,
    [PermissionType.MICROPHONE]: PermissionStatus.UNKNOWN,
    [PermissionType.NOTIFICATION]: PermissionStatus.UNKNOWN,
  };
  
  // Request each permission in sequence
  for (const type of requiredPermissions) {
    let granted = false;
    
    try {
      switch (type) {
        case PermissionType.CAMERA:
          granted = await requestCameraPermission();
          break;
        case PermissionType.LOCATION:
          granted = await requestLocationPermission();
          break;
        case PermissionType.ORIENTATION:
          granted = await requestOrientationPermission();
          break;
        case PermissionType.MICROPHONE:
          granted = await requestMicrophonePermission();
          break;
        case PermissionType.NOTIFICATION:
          granted = await requestNotificationPermission();
          break;
      }
    } catch (error) {
      console.error(`Error requesting permission ${type}:`, error);
      granted = false;
    }
    
    results[type] = granted ? PermissionStatus.GRANTED : PermissionStatus.DENIED;
  }
  
  // Calculate if all were granted
  const allGranted = requiredPermissions.length > 0 && 
    requiredPermissions.every(type => results[type] === PermissionStatus.GRANTED);
  
  return {
    results,
    allGranted,
    isFirstTimeUser: false
  };
}

/**
 * Clear orientation permission cache
 * Useful for debugging or when user wants to reset their choice
 */
export function clearOrientationPermissionCache(): void {
  localStorage.removeItem(ORIENTATION_PERMISSION_KEY);
  console.log('Orientation permission cache cleared');
}

/**
 * Check if device supports orientation permission requests (iOS Safari specific)
 */
export function isOrientationPermissionRequired(): boolean {
  return typeof DeviceOrientationEvent !== 'undefined' &&
         typeof (DeviceOrientationEvent as any).requestPermission === 'function';
}

// UI-related functions that would connect to your UI system
// These would be implemented based on your UI framework (React, Vue, etc.)
// These are placeholders that you'd need to integrate with your actual UI components

/**
 * Show full onboarding with explanations and permission requests
 * This is a placeholder - implement according to your UI framework
 */
async function showFullOnboarding(options: PermissionOptions): Promise<PermissionsState> {
  console.log('Showing full onboarding experience with permission explanations');
  
  // This would trigger your onboarding UI component
  // For now, just request permissions directly
  return await requestAllPermissions(options.requiredPermissions);
}

/**
 * Show streamlined permission UI for returning users
 * This is a placeholder - implement according to your UI framework
 */
async function showStreamlinedPermissionUI(
  currentState: PermissionsState,
  options: PermissionOptions
): Promise<PermissionsState> {
  console.log('Showing streamlined permission UI for returning user');
  
  // This would trigger a simpler UI component
  // For now, just request permissions directly
  return await requestAllPermissions(options.requiredPermissions);
}

/**
 * Get permission explanation text for each permission type
 */
export function getPermissionExplanation(type: PermissionType): string {
  switch (type) {
    case PermissionType.CAMERA:
      return 'Camera access enables the AR experience - your phone becomes a window into the augmented world of Kenilworth Aquatic Gardens.';
    case PermissionType.LOCATION:
      return 'Location access places AR elements at their correct real-world positions as you move around the park.';
    case PermissionType.ORIENTATION:
      return 'Device orientation allows you to look around naturally - point your phone in any direction to explore the AR world.';
    case PermissionType.MICROPHONE:
      return 'Microphone access enables voice interactions and audio features in future AR experiences.';
    case PermissionType.NOTIFICATION:
      return 'Background notifications are handled by our in-app geofencing system for better battery life and user experience.';
    default:
      return 'This permission is needed for the AR experience to work properly.';
  }
}