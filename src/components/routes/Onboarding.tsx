import React, { useEffect, useState, useCallback, useMemo } from 'react';
import GradientElement from '../../utils/GradientElement';
import SnappingCarousel from '../carousel/SnappingCarousel';
import SnappingCard from '../carousel/SnappingCard';
import PermissionsStatus from '../common/PermissionsStatus';
import { 
  PermissionType, 
  PermissionStatus, 
  getPermissionExplanation 
} from '../../utils/permissions';
import { usePermissions } from '../../context/PermissionsContext';

// Define interface for component props 
interface OnboardingProps {
  onComplete: () => void;
}

const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  // Get permissions functionality from context
  const { 
    permissionsState, 
    initialize,
    requestPermission,
    updatePermissionState, 
    isPermissionGranted,
    completeOnboarding 
  } = usePermissions();

  // Track the current step in the onboarding flow
  const [currentStep, setCurrentStep] = useState<number>(0);
  
  // Memoize the value of allGranted to use as a dependency
  const allPermissionsGranted = useMemo(() => 
    permissionsState?.allGranted, 
    [permissionsState?.allGranted]
  );

  // Initialize permissions when the component mounts
  useEffect(() => {
    // Ensure we show at least the welcome screen
    if (currentStep === 0) {
      initialize();
    }
  }, [initialize, currentStep]);
  
  // Check if all permissions are granted and update the UI accordingly
  useEffect(() => {
    // Only mark onboarding as complete in the context 
    // But DON'T navigate automatically - that should happen only on button click
    if (allPermissionsGranted && currentStep > 0 && permissionsState) {
      // Just mark permissions as complete in the context
      completeOnboarding();
      
      // Ensure we show the final card if all permissions are granted
      if (currentStep < 2) {
        setCurrentStep(2);
      }
    }
  }, [allPermissionsGranted, completeOnboarding, permissionsState, currentStep]);

  // Handle requesting permissions
  const handleRequestPermission = useCallback(async (type: PermissionType) => {
    try {
      let granted = false;
      
      // Location requires special handling with direct API call
      if (type === PermissionType.LOCATION) {
        granted = await new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              resolve(true);
            },
            (error) => {
              resolve(false);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
          );
        });
        
        // If location permission was granted, manually update the state
        if (granted) {
          updatePermissionState(type, PermissionStatus.GRANTED);
        }
      } else {
        // For other permissions use the context method
        granted = await requestPermission(type);
      }
      
      // No longer automatically advancing steps since we have a consolidated permissions card
      // We'll rely on the Continue button and the useEffect that checks allPermissionsGranted
    } catch (error) {
      console.error("Error requesting permission:", error);
    }
  }, [requestPermission, updatePermissionState]);

  // Debug button component for development - memoized to prevent re-renders
  const DebugButton = useCallback(() => (
    <button 
      onClick={() => {
       
        // Test location API directly
        if ('geolocation' in navigator) {
          navigator.geolocation.getCurrentPosition(
            () => {},
            () => {}
          );
        }
      }}
      style={{
        position: 'absolute',
        top: 60,
        right: 10,
        padding: '8px 16px',
        background: '#4CAF50',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        zIndex: 9999
      }}
    >
      Debug Permissions
    </button>
  ), []);

  // Function to handle completion of onboarding and navigation
  // This is explicitly called by the "Start Experience" button
  const handleCompleteOnboarding = useCallback(() => {
    // Mark onboarding as complete in the permissions context
    completeOnboarding();
    
    // Navigate to the map route - this is the ONLY place that should trigger navigation
    onComplete();
  }, [completeOnboarding, onComplete]);

  // Content for each card in the carousel (simplified to 3 cards)
  const renderCardContent = useCallback((index: number) => {
    switch (index) {
      case 1:
        return (
          <div className="card-content welcome">
            <h1>Welcome to the Park AR Experience</h1>
            <p>Explore interactive augmented reality features throughout the park!</p>
            <button className="primary-button" onClick={() => setCurrentStep(1)}>
              Get Started
            </button>
          </div>
        );
      case 2:
        return (
          <div className="card-content permissions">
            <h2>Required Permissions</h2>
            <p>The following permissions are needed for the AR experience:</p>
            
            <div className="permissions-summary" style={{ margin: '1rem 0' }}>
              <PermissionsStatus />
            </div>
            
            <button 
              className="primary-button" 
              onClick={() => setCurrentStep(2)}
              disabled={!allPermissionsGranted}
            >
              Continue
            </button>
          </div>
        );
      case 3:
        return (
          <div className="card-content ready">
            <h2>You're All Set!</h2>
            <p>Your AR experience is ready to explore. Enjoy your visit to the park!</p>
            
            <button className="primary-button" onClick={handleCompleteOnboarding}>
              Start Experience
            </button>
          </div>
        );
      default:
        return null;
    }
  }, [setCurrentStep, handleCompleteOnboarding, allPermissionsGranted]);

  // Memoize the Debug Button component to avoid re-rendering it
  const MemoizedDebugButton = useMemo(() => {
    return process.env.NODE_ENV === 'development' ? <DebugButton /> : null;
  }, [DebugButton]);

  return (
    <div className="onboarding-route">
      {MemoizedDebugButton}

      <GradientElement 
        color="gradient(var(--color-dark), var(--color-pink), var(--color-blue), var(--color-dark), var(--color-green))" 
        gradientType="blocks"
        blockSize={200}
      >
        <SnappingCarousel 
          id="carousel1" 
          title="onboarding"
          background=""
          currentCard={currentStep + 1} // +1 because card indices start at 1
        >
          <SnappingCard title="" subtitle="" color="var(--color-dark)" index={1} height="90%">
            {renderCardContent(1)}
          </SnappingCard>
          
          <SnappingCard title="" subtitle="" color="var(--color-dark)" index={2} height="90%">
            {renderCardContent(2)}
          </SnappingCard>
          
          <SnappingCard title="" subtitle="" color="var(--color-dark)" index={3} height="90%">
            {renderCardContent(3)}
          </SnappingCard>
        </SnappingCarousel>
        
      </GradientElement>
    </div>
  );
};

export default Onboarding;