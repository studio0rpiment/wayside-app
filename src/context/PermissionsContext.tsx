import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { 
  initPermissions, 
  PermissionsState, 
  PermissionType, 
  PermissionStatus,
  requestCameraPermission,
  requestLocationPermission,
  requestOrientationPermission,
  requestMicrophonePermission,
  requestNotificationPermission
} from '../utils/permissions';

// Define the context shape
interface PermissionsContextType {
  // Permission state
  permissionsState: PermissionsState | null;
  
  // Flag to track if initialization has been attempted
  initialized: boolean;
  
  // Method to initialize permissions
  initialize: () => Promise<PermissionsState>;
  
  // Methods to request individual permissions
  requestPermission: (type: PermissionType) => Promise<boolean>;
  
  // Method to check if specific permission is granted
  isPermissionGranted: (type: PermissionType) => boolean;
  
  // Method to start onboarding UI flow
  startOnboardingFlow: () => void;
  
  // Flag to indicate if onboarding UI should be shown
  showOnboarding: boolean;
  
  // Method to complete onboarding
  completeOnboarding: () => void;
  
  // Method to manually update permission state
  updatePermissionState: (type: PermissionType, status: PermissionStatus) => void;
}

// Create the context with a default value
const PermissionsContext = createContext<PermissionsContextType>({
  permissionsState: null,
  initialized: false,
  initialize: async () => ({ 
    results: {
      [PermissionType.CAMERA]: PermissionStatus.UNKNOWN,
      [PermissionType.LOCATION]: PermissionStatus.UNKNOWN,
      [PermissionType.ORIENTATION]: PermissionStatus.UNKNOWN,
      [PermissionType.MICROPHONE]: PermissionStatus.UNKNOWN,
      [PermissionType.NOTIFICATION]: PermissionStatus.UNKNOWN,
    },
    allGranted: false,
    isFirstTimeUser: false
  }),
  requestPermission: async () => false,
  isPermissionGranted: () => false,
  startOnboardingFlow: () => {},
  showOnboarding: false,
  completeOnboarding: () => {},
  updatePermissionState: () => {} // Add default implementation
});

// Props for the provider component
interface PermissionsProviderProps {
  children: ReactNode;
  requiredPermissions?: PermissionType[];
}

// Provider component
export const PermissionsProvider: React.FC<PermissionsProviderProps> = ({ 
  children,
  requiredPermissions = [
    PermissionType.CAMERA,
    PermissionType.LOCATION,
    PermissionType.ORIENTATION
  ]
}) => {
  console.log("🚀 PermissionsProvider mounted");
  
  const [permissionsState, setPermissionsState] = useState<PermissionsState | null>(null);
  const [initialized, setInitialized] = useState<boolean>(false);
  const [showOnboarding, setShowOnboarding] = useState<boolean>(false);

  // Method to initialize permissions
const initialize = useCallback(async (): Promise<PermissionsState> => {
  // If already initialized, return the current state
  if (initialized && permissionsState) {
    return permissionsState;
  }

  const state = await initPermissions({
    requiredPermissions,
    onStatusChange: (newState) => {
      // Only update if there are actual changes
      setPermissionsState(current => {
        if (JSON.stringify(newState) !== JSON.stringify(current)) {
          return newState;
        }
        return current;
      });
    },
    showUI: false 
  });
  
  setPermissionsState(state);
  setInitialized(true);
  
  // Determine if we need to show onboarding
  const needsOnboarding = state.isFirstTimeUser || !state.allGranted;
  setShowOnboarding(needsOnboarding);
  
  return state;
}, [initialized, permissionsState, requiredPermissions]); // Add dependencies

//   useEffect(() => {
//   // Only run if not already initialized
//   if (initialized) return;
  
//   const isFirstRun = !localStorage.getItem('permissions-initialized');
  
//   // Call initPermissions directly instead of the initialize function
//   initPermissions({
//     requiredPermissions,
//     onStatusChange: (newState) => {
//       setPermissionsState(current => {
//         if (JSON.stringify(newState) !== JSON.stringify(current)) {
//           return newState;
//         }
//         return current;
//       });
//     },
//     showUI: false 
//   }).then(state => {
//     localStorage.setItem('permissions-initialized', 'true');
    
//     setPermissionsState(state);
//     setInitialized(true);
    
//     if (isFirstRun) {
//       setPermissionsState(prevState => 
//         prevState ? {...prevState, isFirstTimeUser: true} : prevState
//       );
//     }
    
//     const needsOnboarding = state.isFirstTimeUser || !state.allGranted;
//     setShowOnboarding(needsOnboarding);
//   }).catch(error => {
//     console.error("Error initializing permissions:", error);
//   });
// }, [initialized, requiredPermissions]); // Only depend on initialized flag

useEffect(() => {
  console.log("🔍 PermissionsProvider useEffect running");
  
  // Just set dummy state without calling initPermissions
 // Just set dummy state without calling initPermissions
setPermissionsState({
  results: {
    [PermissionType.CAMERA]: PermissionStatus.PROMPT,     // Changed from GRANTED
    [PermissionType.LOCATION]: PermissionStatus.PROMPT,   // Changed from GRANTED
    [PermissionType.ORIENTATION]: PermissionStatus.GRANTED, // Keep this one
    [PermissionType.MICROPHONE]: PermissionStatus.PROMPT,
    [PermissionType.NOTIFICATION]: PermissionStatus.PROMPT,
  },
  allGranted: false,  // Changed from true
  isFirstTimeUser: false
});
  setInitialized(true);
  
  console.log("🔍 PermissionsProvider useEffect completed");
}, []);

  // Method to manually update permission state
  const updatePermissionState = (type: PermissionType, status: PermissionStatus) => {
    if (!permissionsState) return;
    
    // Skip update if the status hasn't changed
    if (permissionsState.results[type] === status) return;
    
    const updatedResults = {
      ...permissionsState.results,
      [type]: status
    };
    
    // Recalculate if all required permissions are granted
    const allGranted = requiredPermissions.every(
      perm => updatedResults[perm] === PermissionStatus.GRANTED
    );
    
    // Skip update if nothing changed
    if (allGranted === permissionsState.allGranted && 
        permissionsState.results[type] === status) {
      return;
    }
    
    const updatedState: PermissionsState = {
      ...permissionsState,
      results: updatedResults,
      allGranted
    };
    
    setPermissionsState(updatedState);
    
    // If all permissions are now granted, we can hide onboarding
    if (allGranted && !permissionsState.allGranted) {
      setShowOnboarding(false);
    }
  };

  // Request a specific permission
  const requestPermission = async (type: PermissionType): Promise<boolean> => {
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
    
    // Use the optimized updatePermissionState to avoid redundant renders
    updatePermissionState(
      type, 
      granted ? PermissionStatus.GRANTED : PermissionStatus.DENIED
    );
    
    return granted;
  };

  // Check if a specific permission is granted
  const isPermissionGranted = (type: PermissionType): boolean => {
    if (!permissionsState) return false;
    return permissionsState.results[type] === PermissionStatus.GRANTED;
  };

  // Start the onboarding flow
  const startOnboardingFlow = () => {
    console.log('🚀 Starting onboarding flow');
    setShowOnboarding(true);
  };

  // Complete the onboarding flow
  const completeOnboarding = () => {
    console.log('🎉 Completing onboarding flow');
    setShowOnboarding(false);
  };

  // Context value
  const contextValue: PermissionsContextType = {
    permissionsState,
    initialized,
    initialize,
    requestPermission,
    isPermissionGranted,
    startOnboardingFlow,
    showOnboarding,
    completeOnboarding,
    updatePermissionState // Add the new function to the context value
  };

  return (
    <PermissionsContext.Provider value={contextValue}>
      {children}
    </PermissionsContext.Provider>
  );
};

// Custom hook to use the permissions context
export const usePermissions = () => {
  const context = useContext(PermissionsContext);
  
  if (!context) {
    throw new Error('usePermissions must be used within a PermissionsProvider');
  }
  
  return context;
};

export default PermissionsContext;