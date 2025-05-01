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
      if (currentStep < 4) {
        setCurrentStep(4);
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
      
      // Only advance to the next step if permission was granted
      if (granted) {
        setCurrentStep(prev => prev + 1);
      }
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

  // Content for each card in the carousel
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
          <div className="card-content camera-permission">
            <h2>Camera Access</h2>
            <div style={{ position: 'absolute', top: '10px', right: '10px' }}>
              <PermissionsStatus showCamera={true} showLocation={false} showOrientation={false} compact={true} />
            </div>
            <p>{getPermissionExplanation(PermissionType.CAMERA)}</p>
            <button className="primary-button" onClick={() => handleRequestPermission(PermissionType.CAMERA)}>
              Allow Camera
            </button>
          </div>
        );
      case 3:
        return (
          <div className="card-content location-permission">
            <h2>Location Access</h2>
            <div style={{ position: 'absolute', top: '10px', right: '10px' }}>
              <PermissionsStatus showCamera={false} showLocation={true} showOrientation={false} compact={true} />
            </div>
            <p>{getPermissionExplanation(PermissionType.LOCATION)}</p>
            <button className="primary-button" onClick={() => handleRequestPermission(PermissionType.LOCATION)}>
              Allow Location
            </button>
          </div>
        );
      case 4:
        return (
          <div className="card-content orientation-permission">
            <h2>Device Orientation</h2>
            <div style={{ position: 'absolute', top: '10px', right: '10px' }}>
              <PermissionsStatus showCamera={false} showLocation={false} showOrientation={true} compact={true} />
            </div>
            <p>{getPermissionExplanation(PermissionType.ORIENTATION)}</p>
            <button className="primary-button" onClick={() => handleRequestPermission(PermissionType.ORIENTATION)}>
              Allow Orientation
            </button>
          </div>
        );
      case 5:
        return (
          <div className="card-content ready">
            <h2>You're All Set!</h2>
            <p>Your AR experience is ready to explore. Enjoy your visit to the park!</p>
            
            <div className="permissions-summary" style={{ margin: '1.5rem 0' }}>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: 'var(--color-light)' }}>
                Permissions Status:
              </h3>
              <PermissionsStatus />
            </div>
            
            <button className="primary-button" onClick={handleCompleteOnboarding}>
              Start Experience
            </button>
          </div>
        );
      default:
        return null;
    }
  }, [handleRequestPermission, handleCompleteOnboarding]);

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
          
          <SnappingCard title="" subtitle="" color="var(--color-dark)" index={4} height="90%">
            {renderCardContent(4)}
          </SnappingCard>
          
          <SnappingCard title="" subtitle="" color="var(--color-dark)" index={5} height="90%">
            {renderCardContent(5)}
          </SnappingCard>
        </SnappingCarousel>
        
      </GradientElement>
    </div>
  );
};

export default Onboarding;