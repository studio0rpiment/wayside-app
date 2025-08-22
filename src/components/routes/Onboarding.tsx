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

import LocationGateModal from '../common/LocationGateModal';
// import { universalModeManager } from '../../utils/UniversalModeManager';

// Define interface for component props 
interface OnboardingProps {
  onComplete: () => void;
}

interface UniversalModeManager {
    getBlockInfo(): { hasUrlBypass: boolean };
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

  // NEW: State for permission gate modal
  const [showPermissionGate, setShowPermissionGate] = useState(false);

  // Memoize the value of allGranted to use as a dependency
  const allPermissionsGranted = useMemo(() => 
    permissionsState?.allGranted, 
    [permissionsState?.allGranted]
  );



  // Initialize permissions when the component mounts
  // console.log('🔄 About to run initialize effect');
  useEffect(() => {
    console.log(`Current step changed to: ${currentStep}`);
    initialize();
  }, []);
  
  // Only mark permissions as complete in context (no auto-navigation)
  // console.log('🔄 About to run completeOnboarding effect');
  useEffect(() => {
    if (allPermissionsGranted && permissionsState) {
      completeOnboarding();
    }
  }, [allPermissionsGranted, completeOnboarding, permissionsState]);

// Add this in your Onboarding.tsx, with your other useEffects:
// useEffect(() => {
//   console.log('🔍 Onboarding state check:', {
//     currentStep,
//     allPermissionsGranted,
//     showPermissionGate,
//     shouldBlockLocation: universalModeManager.shouldBlockLocation,
//     shouldBlockPermissions: universalModeManager.shouldBlockPermissions,
//     blockType: universalModeManager.blockType,
//     blockReason: universalModeManager.blockReason
//   });
// }); // No dependencies = logs every render

// useEffect(() => {
//   console.log('🌐 Universal Mode listener added');
  
//   const handleUniversalModeChange = () => {
//     console.log('🌐 Universal Mode CHANGED - new state:', {
//       isUniversal: universalModeManager.isUniversal,
//       reasons: universalModeManager.reasons,
//       blockType: universalModeManager.blockType,
//       blockReason: universalModeManager.blockReason
//     });
//   };


// //  console.log("has URL Pass " + getBlockInfo)
  
//  console.log(universalModeManager.getBlockInfo().hasUrlBypass)
 
  
//   return () => {
//     universalModeManager.removeEventListener('universalModeChanged', handleUniversalModeChange);
//   };
// }, []);


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
  console.log('🔍 handleCompleteOnboarding called');

    //************ MOVING THID HERE TO BYPASS FOR THE SATURDAY EVENT */
  completeOnboarding();
  navigate('/map');
  
  
  // const blockInfo = universalModeManager.getBlockInfo();
  // const hasUrlBypass = blockInfo.hasUrlBypass;

  // console.log('🔍 Final validation check:', {
  //   allPermissionsGranted,
  //   hasUrlBypass,
  //   shouldBlockLocation: universalModeManager.shouldBlockLocation,
  //   shouldBlockPermissions: universalModeManager.shouldBlockPermissions,
  //   blockType: universalModeManager.blockType,
  //   blockReason: universalModeManager.blockReason
  // });
  
  // If URL bypass is active, always allow completion
  // if (hasUrlBypass) {
  //   console.log('🔓 URL bypass active - completing onboarding');
  //   completeOnboarding();
  //   navigate('/map');
  //   return;
  // }
  
  // Check for any blocking conditions (location, permissions, etc.)
  // if (universalModeManager.shouldBlockApp) {
  //   console.log('🚫 App blocked - showing location gate modal');
  //   setShowPermissionGate(true);
  //   return;
  // }
  
  // All checks passed - complete onboarding
  console.log('✅ All final checks passed - completing onboarding');
  // completeOnboarding();
  // navigate('/map');
  
}, [completeOnboarding, onComplete, navigate]);

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

  // NEW: Handle permission card next button with gate check
const handlePermissionCardNext = useCallback(() => {
  // console.log('🔍 handlePermissionCardNext called');
  // console.log('🔍 allPermissionsGranted:', allPermissionsGranted);
  goToNextCard();

    // const blockInfo = universalModeManager.getBlockInfo();
    // const hasUrlBypass = blockInfo.hasUrlBypass;


 //check 1 Bypass
  //  if (hasUrlBypass) {
  //   console.log('🔓 URL bypass active - skipping permission checks');
  //   goToNextCard();
  //   return;
  // }
  

  
  // Check 2: Missing permissions
  if (!allPermissionsGranted) {
    console.log('⚠️ Permissions not granted - showing modal with permission message');
    setShowPermissionGate(true);
    return;
  }
  
  // Check 3: Universal Mode restrictions (location, etc.)
  // console.log('🔍 shouldBlockPermissions:', universalModeManager.shouldBlockPermissions);
  // console.log('🔍 blockReason:', universalModeManager.blockReason);
  
  // if (universalModeManager.shouldBlockApp) {
  //   // console.log('🚫 Universal Mode blocking - showing modal');
  //   setShowPermissionGate(true);
  // } else {
  //   // console.log('✅ All checks passed - proceeding');
  //   goToNextCard();
  // }
}, [allPermissionsGranted, goToNextCard]);


  // NEW: Handle permission gate bypass
  const handlePermissionGateBypass = useCallback(() => {
    setShowPermissionGate(false);
    goToNextCard(); // URL bypass active, proceed to next card
  }, [goToNextCard]);

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

   const camMap = ContentConfigHelper.getTemplateById('camMap') as ContentContainerProps;

  const buttonStyle = {
    width: '65vw',
    margin: '1rem auto 0',
    padding: '1rem 1rem',
    backgroundColor: 'var(--color-pink)',
    color: 'var(--color-light)',
    borderRadius: '2rem',
    border: 'none',
    fontFamily: 'var(--font-rigby)',
    fontSize: '1.2rem',
    fontWeight:'1000',
    display: 'block',
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
                textAlign: 'center',
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
                    margin: '1rem -1rem 1rem -1rem',
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
                    cursor: 'pointer', // Always clickable
                    opacity: 1, // Always full opacity
                  }}
                  onClick={handlePermissionCardNext} // Always active, check happens inside
                  // Remove disabled prop entirely
                >
                  {allPermissionsGranted ? 'CONTINUE' : 'Grant Permissions First'}
                </button>
                  
              
              </div>
            </div>
          </SnappingCard>
          
          {/* Card 2: Instructions */}
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

      {/* Permission Gate Modal */}
      {/* <LocationGateModal
        isOpen={showPermissionGate}
        onClose={() => setShowPermissionGate(false)}
        onBypass={handlePermissionGateBypass}
       checkType={(universalModeManager.blockType !== 'none' ? universalModeManager.blockType : 'permissions') as 'location' | 'permissions'}

      /> */}

{/* {process.env.NODE_ENV === 'development' && (
      <OnboardingDebugOverlay
        currentStep={currentStep}
        allPermissionsGranted={allPermissionsGranted ?? false}
        showPermissionGate={showPermissionGate}
      />
    )} */}
    </div>
  ); 
};

export default Onboarding;