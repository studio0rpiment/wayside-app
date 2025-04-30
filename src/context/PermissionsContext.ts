import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  initPermissions, 
  PermissionsState, 
  PermissionType, 
  PermissionStatus,
  requestCameraPermission,
  requestLocationPermission,
  requestOrientationPermission,
  requestMicrophonePermission
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
    },
    allGranted: false,
    isFirstTimeUser: false
  }),
  requestPermission: async () => false,
  isPermissionGranted: () => false,
  startOnboardingFlow: () => {},
  showOnboarding: false,
  completeOnboarding: () => {}
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
  const [permissionsState, setPermissionsState] = useState<PermissionsState | null>(null);
  const [initialized, setInitialized] = useState<boolean>(false);
  const [showOnboarding, setShowOnboarding] = useState<boolean>(false);

  // Method to initialize permissions
  const initialize = async (): Promise<PermissionsState> => {
    const state = await initPermissions({
      requiredPermissions,
      onStatusChange: (newState) => {
        setPermissionsState(newState);
      },
      // Disable default UI since we're handling it with our own components
      showUI: false 
    });
    
    setPermissionsState(state);
    setInitialized(true);
    
    // Determine if we need to show onboarding
    const needsOnboarding = state.isFirstTimeUser || !state.allGranted;
    setShowOnboarding(needsOnboarding);
    
    return state;
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
    }
    
    // Update our state after permission request
    if (permissionsState) {
      const newState = { 
        ...permissionsState,
        results: {
          ...permissionsState.results,
          [type]: granted ? PermissionStatus.GRANTED : PermissionStatus.DENIED
        }
      };
      
      // Recalculate if all required permissions are granted
      newState.allGranted = requiredPermissions.every(
        perm => newState.results[perm] === PermissionStatus.GRANTED
      );
      
      setPermissionsState(newState);
      
      // If all permissions are now granted, we can hide onboarding
      if (newState.allGranted) {
        setShowOnboarding(false);
      }
      
      return granted;
    }
    
    return granted;
  };

  // Check if a specific permission is granted
  const isPermissionGranted = (type: PermissionType): boolean => {
    if (!permissionsState) return false;
    return permissionsState.results[type] === PermissionStatus.GRANTED;
  };

  // Start the onboarding flow
  const startOnboardingFlow = () => {
    setShowOnboarding(true);
  };

  // Complete the onboarding flow
  const completeOnboarding = () => {
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
    completeOnboarding
  };

  return React.createElement(
    PermissionsContext.Provider, 
    { value: contextValue }, 
    children
  );
};

// Custom hook to use the permissions context
export const usePermissions = () => {
  const context = useContext(PermissionsContext);
  
  if (context === undefined) {
    throw new Error('usePermissions must be used within a PermissionsProvider');
  }
  
  return context;
};

export default PermissionsContext;