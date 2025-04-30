import React, { useEffect, useState } from 'react';
import GradientElement from '../../utils/GradientElement';
import SnappingCarousel from '../carousel/SnappingCarousel';
import SnappingCard from '../carousel/SnappingCard';
import { initPermissions, PermissionType, PermissionsState, getPermissionExplanation } from '../../utils/permissions'
import { usePermissions } from '../../context/PermissionsContext';


// Define interface for component props 
interface OnboardingProps {
  onComplete: () => void;
}

const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const { 
    permissionsState, 
    requestPermission, 
    isPermissionGranted,
    completeOnboarding 
  } = usePermissions();
  const [currentStep, setCurrentStep] = useState<number>(0);
  
  useEffect(() => {
    // No need to call initPermissions here anymore since
    // the context handles initialization
    
    // Monitor permission state changes
    if (permissionsState?.allGranted) {
      completeOnboarding();
      onComplete();
    }
  }, [permissionsState, onComplete, completeOnboarding]);
  
  // Rest of the component...

  // Function to handle permission request based on current step
  const handleRequestPermission = async (type: PermissionType) => {
    // This would be implemented to request the specific permission
    // and advance to next step
    setCurrentStep(prev => prev + 1);
  };

  // Function to handle completion of onboarding
  const handleCompleteOnboarding = () => {
    onComplete();
  };

  // Content for each card in the carousel
  const renderCardContent = (index: number) => {
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
            <button className="primary-button" onClick={handleCompleteOnboarding}>
              Start Experience
            </button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="onboarding-route">
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