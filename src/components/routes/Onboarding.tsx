import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import GradientElement from '../../utils/GradientElement';
import SwipeableCarousel from '../carousel/SwipeableCarousel';
import SnappingCard from '../carousel/SnappingCard';
import PermissionsStatus from '../common/PermissionsStatus';

import { 
  PermissionType, 
  PermissionStatus, 
  getPermissionExplanation 
} from '../../utils/permissions';
import { usePermissions } from '../../context/PermissionsContext';
import SimpleContentContainer, { ContentContainerProps } from '../common/SimpleContentContainer';
import ContentConfigHelper from '../../utils/ContentConfigHelper';

// Define interface for component props 
interface OnboardingProps {
  onComplete: () => void;
}

const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const navigate = useNavigate();
  
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
  useEffect(() => {
  console.log('🟡 currentStep changed from somewhere:', currentStep);
}, [currentStep]);
  
  // State to track if the AR experience is ready to be shown
  const [showARExperience, setShowARExperience] = useState(false);
  
  // State to track which AR experience to show
  const [currentARExperience, setCurrentARExperience] = useState<string | null>(null);
  
  // Track AR step progression
  const [arStep, setARStep] = useState(1);
  
  // Memoize the value of allGranted to use as a dependency
  const allPermissionsGranted = useMemo(() => 
    permissionsState?.allGranted, 
    [permissionsState?.allGranted]
  );

  // Initialize permissions when the component mounts
  useEffect(() => {
    console.log(`Current step changed to: ${currentStep}`);
    initialize();
  }, [initialize]);
  
  // Only mark permissions as complete in context (no auto-navigation)
  useEffect(() => {
    if (allPermissionsGranted && permissionsState) {
      completeOnboarding();
    }
  }, [allPermissionsGranted, completeOnboarding, permissionsState]);

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
      
    } catch (error) {
      console.error("Error requesting permission:", error);
    }
  }, [requestPermission, updatePermissionState]);

  // Function to handle completion of onboarding and navigation
  const handleCompleteOnboarding = useCallback(() => {
    // Mark onboarding as complete in the permissions context
    completeOnboarding();
    
    // Navigate to the map route
    // onComplete();
    navigate('/map');

  }, [completeOnboarding, onComplete]);

  // Handle closing the AR experience
  const handleCloseARExperience = useCallback(() => {
    setCurrentARExperience(null);
    setShowARExperience(false);
  }, []);

  // Handle launching the AR demo experience
  const handleLaunchAR = useCallback(() => {
    setShowARExperience(true);
  }, []);
  
  // Handler for when the AR box is clicked
  const handleNextARStep = useCallback(() => {
    // Additional logic can be added here based on the step
  }, []);

  // Handle card changes from swipe gestures
 const handleCardChange = useCallback((index: number) => {
  console.log('🔴 handleCardChange called with:', index, 'from SwipeableCarousel');
  setCurrentStep(index);
}, []);

  // Manual navigation functions
const goToNextCard = useCallback(() => {
  console.log('🔵 Button clicked - currentStep BEFORE:', currentStep);
  const nextStep = Math.min(currentStep + 1, 2);
  console.log('🔵 Button clicked - nextStep calculated:', nextStep);
  setCurrentStep(nextStep);
  console.log('🔵 setCurrentStep called with:', nextStep);
}, [currentStep]);

  // Content configurations - disable animations for carousel use
  const permConfig1 = { 
    ...ContentConfigHelper.getTemplateById('onboarding-card-permisions') as ContentContainerProps,
    animateIn: false,
    scrollTrigger: false,
    scrollParallax: false,
    fontAnimatesOnScroll: false,

  };
  const instruct = {
    ...ContentConfigHelper.getTemplateById('instruct') as ContentContainerProps,
    animateIn: false,
    scrollTrigger: false,
    scrollParallax: false,
    fontAnimatesOnScroll: false,
  };
  const explain = {
    ...ContentConfigHelper.getTemplateById('explain') as ContentContainerProps,
    animateIn: false,
    scrollTrigger: false,
    scrollParallax: false,
    fontAnimatesOnScroll: false,
  };
  const experienceMap = {
    ...ContentConfigHelper.getTemplateById('experienceMap') as ContentContainerProps,
    animateIn: false,
    scrollTrigger: false,
    scrollParallax: false,
    fontAnimatesOnScroll: false,
  };

  const buttonStyle = {
    // position: 'absolute' as const,
    width: '65vw',
    // left: '50%',
    // transform: 'translateX(-50%)',
    margin: '1rem auto 0',
    padding: '1rem 1rem',
    backgroundColor: 'var(--color-pink)',
    color: 'var(--color-light)',
    borderRadius: '2rem',
    border: 'none',
    fontFamily: 'var(--font-rigby)',
    fontSize: '1.2rem',
    fontWeight:'1000',
    display: 'block' ,
    
    cursor: 'pointer',
    zIndex: 10,
    touchAction: 'manipulation', // Ensure buttons work on mobile
  };


  return (
    <div 
      className="onboarding-route"
      style={{ touchAction: 'manipulation', height: '100svh' }} // Only allow essential touch actions
    >
      <GradientElement 
        color="gradient(var(--color-dark), var(--color-pink), var(--color-blue), var(--color-dark), var(--color-green))" 
        gradientType="blocks"
        blockSize={200}
      >
        <SwipeableCarousel 
          id="carousel1" 
          title="onboarding"
          background=""
          currentCard={currentStep}
          onCardChange={handleCardChange}
        >
          {/* Card 0: Welcome */}
          <SnappingCard title="" subtitle="" color="var(--color-dark)" index={0} height="80%"  >
            <div style={{ }}>
            <SimpleContentContainer {...permConfig1} />
            </div>

            <button 
              className="primary-button continue-button" 
              style={buttonStyle}
              onClick={goToNextCard}
            >
              CONTINUE
            </button>
          </SnappingCard>
          
          {/* Card 1: Permissions */}
          <SnappingCard title="" subtitle="" color="var(--color-dark)" index={1} height="80%" >
            <div className="card-content permissions" 
              style={{ 
                
                textAlign: 'center' ,
                height: 'calc(100vh - 120px)',
                overflowY: 'scroll',
                display: 'flex',
                flexDirection: 'column',
                WebkitOverflowScrolling: 'touch', 
              }}>

                 <div style={{ 
                  padding: '0rem', 
                  textAlign: 'center',
                  flex: 1,
                  paddingBottom: '6rem'  // Space for the button
                }}>
              <h2 style={{ color: 'var(--color-light)', marginBottom: '0rem' }}>Required Permissions</h2>
              <p style={{ color: 'var(--color-light)', margin: '1rem' }}>
                The following permissions are needed for the AR experience:
              </p>
              
              <div className="permissions-summary" 
                style={{ 
                  margin: '1rem -1rem 1rem -1rem' ,
                  width: '120%',
                  flex: 1, 
                  minHeight: 0 
                }}>
                <PermissionsStatus />
              </div>
            
            
            <button 
              className="primary-button continue-button" 
              style={{
                ...buttonStyle,
                backgroundColor: allPermissionsGranted ? 'var(--color-green)' : '#666',
                cursor: allPermissionsGranted ? 'pointer' : 'not-allowed',
                opacity: allPermissionsGranted ? 1 : 0.6,
                
              }}
              onClick={allPermissionsGranted ? goToNextCard : undefined}
              disabled={!allPermissionsGranted}
            >
              {allPermissionsGranted ? 'CONTINUE' : 'Grant Permissions First'}
            </button>
            </div>
          </div>

          </SnappingCard>
          
          {/* Card 2: AR Demo */}
<SnappingCard title="" subtitle="" color="var(--color-dark)" index={2} height="90%">
  <div 
    style={{ 
      height: '100%',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative'
    }}
  >
    {/* Fixed height scrollable container - same as permissions card */}
    <div 
      className="card-content ready" 
      style={{ 
        height: 'calc(100vh - 120px)', // Same explicit height calculation
        overflowY: 'scroll',           // Force scroll bars
        overflowX: 'hidden',
        padding: '2rem',
        textAlign: 'center',
        WebkitOverflowScrolling: 'touch', // iOS smooth scrolling
      }}
    >
      {/* <h2 style={{ color: 'var(--color-light)', marginBottom: '1rem' }}>How to Find HotSpots</h2> */}

      {/* <SimpleContentContainer {...instruct} /> */}
      {/* <SimpleContentContainer {...explain} /> */}
      <SimpleContentContainer {...experienceMap} />

      <p style={{ 
        color: 'var(--color-light)', 
        margin: '1rem 0', 
        fontSize: '.85rem',
        textAlign: 'left'
      }}>
        Each Icon on the map of the Kenilworth Aquatic Gardens marks a location where you can open an experience. Your location is shown with the concentric circles. When you arrive at the location you will get a notification that you can open a portal.
      </p>

      {/* Button inside scrollable area with lots of space below */}
      <button 
        className="primary-button start-button" 
        style={{
          width: '65vw',
          margin: '3rem auto 8rem', // Large bottom margin to ensure scrollability
          padding: '1rem 2rem',
          backgroundColor: 'var(--color-green)',
          color: 'var(--color-light)',
          borderRadius: '2rem',
          border: 'none',
          fontFamily: 'var(--font-rigby)',
          fontSize: '1.2rem',
          fontWeight: '1000',
          cursor: 'pointer',
          display: 'block'
        }}
        onClick={handleCompleteOnboarding}
      >
        BEGIN
      </button>
    </div>
  </div>
</SnappingCard>
        </SwipeableCarousel>
      </GradientElement>
      

      
      {/* Render AR experience through Portal when active */}
      {/* {showARExperience && (
        <DemoExperience 
          onClose={() => setShowARExperience(false)} 
          onNext={handleNextARStep}
        />
      )} */}
    </div>
  ); 
};

export default Onboarding;