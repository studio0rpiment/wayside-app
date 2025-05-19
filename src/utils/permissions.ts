// src/utils/permissions.ts

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
  ],
  showUI: true,
  onStatusChange: () => {}
};

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
      const result = await navigator.permissions.query({ name: 'camera' as PermissionName });
      return result.state as PermissionStatus;
    }
    
    // Fallback: Try to access the camera
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      // If we get here, permission is granted
      // Clean up the stream we just created
      stream.getTracks().forEach(track => track.stop());
      return PermissionStatus.GRANTED;
    } catch (e) {
      return PermissionStatus.DENIED;
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
      const result = await navigator.permissions.query({ name: 'geolocation' });
      return result.state as PermissionStatus;
    }
    
    // Fallback: Try to access location
    try {
      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          () => resolve(PermissionStatus.GRANTED),
          () => resolve(PermissionStatus.DENIED),
          { timeout: 3000 }
        );
      });
    } catch (e) {
      return PermissionStatus.DENIED;
    }
  } catch (error) {
    console.error('Error checking location permission:', error);
    return PermissionStatus.UNKNOWN;
  }
}

/**
 * Check device orientation permission status
 * Note: This is mostly relevant for iOS which has a explicit permission
 */
export async function checkOrientationPermission(): Promise<PermissionStatus> {
  try {
    // iOS 13+ requires explicit permission for DeviceMotionEvent
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      try {
        const permissionState = await (DeviceOrientationEvent as any).requestPermission();
        return permissionState === 'granted' ? PermissionStatus.GRANTED : PermissionStatus.DENIED;
      } catch (e) {
        return PermissionStatus.PROMPT;
      }
    }
    
    // For other browsers, assume it's available (no permission needed)
    return PermissionStatus.GRANTED;
  } catch (error) {
    console.error('Error checking orientation permission:', error);
    return PermissionStatus.UNKNOWN;
  }
}

/**
 * Check microphone permission status
 */
export async function checkMicrophonePermission(): Promise<PermissionStatus> {
  try {
    // First check if the Permission API is available
    if (navigator.permissions && navigator.permissions.query) {
      const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      return result.state as PermissionStatus;
    }
    
    // Fallback: Try to access the microphone
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // If we get here, permission is granted
      // Clean up the stream we just created
      stream.getTracks().forEach(track => track.stop());
      return PermissionStatus.GRANTED;
    } catch (e) {
      return PermissionStatus.DENIED;
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
    if (Notification.permission === 'granted') {
      return PermissionStatus.GRANTED;
    } else if (Notification.permission === 'denied') {
      return PermissionStatus.DENIED;
    } else {
      return PermissionStatus.PROMPT;
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
  } catch (error) {
    console.error('Error requesting camera permission:', error);
    return false;
  }
}

/**
 * Request location permission
 */
export async function requestLocationPermission(): Promise<boolean> {
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      () => resolve(true),
      (error) => {
        console.error('Location permission denied:', error);
        resolve(false);
      }
    );
  });
}

/**
 * Request device orientation permission
 */
export async function requestOrientationPermission(): Promise<boolean> {
  // iOS 13+ requires explicit permission
  if (typeof DeviceOrientationEvent !== 'undefined' &&
      typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
    try {
      const permission = await (DeviceOrientationEvent as any).requestPermission();
      return permission === 'granted';
    } catch (error) {
      console.error('Error requesting orientation permission:', error);
      return false;
    }
  }
  
  // For other browsers, assume it's granted
  return true;
}

/**
 * Request microphone permission
 */
export async function requestMicrophonePermission(): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Clean up the stream
    stream.getTracks().forEach(track => track.stop());
    return true;
  } catch (error) {
    console.error('Error requesting microphone permission:', error);
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
    return permission === 'granted';
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
      return 'Camera access is needed to see AR elements in the park through your device.';
    case PermissionType.LOCATION:
      return 'Location access helps place AR elements in the correct spots as you move around the park.';
    case PermissionType.ORIENTATION:
      return 'Device orientation helps position AR elements correctly as you move your device.';
    case PermissionType.MICROPHONE:
      return 'Microphone access enables interactive audio features in the AR experience.';
    case PermissionType.NOTIFICATION:
      return 'Notification permission allows us to alert you when you enter experience areas, even when the app is in the background.';
    default:
      return 'This permission is needed for the AR experience to work properly.';
  }
}