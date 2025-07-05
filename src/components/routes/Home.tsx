import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ContentConfigHelper from '../../utils/ContentConfigHelper';
import { ContentContainerProps } from '../../components/common/ContentContainer';
import ContentContainer from '../../components/common/ContentContainer';
import Button from '../../components/common/Button';
import GradientElement from '../../utils/GradientElement';
import VerticalSection from '../sections/vertical/VerticalSection';

import LocationGateModal from '../common/LocationGateModal';
import { universalModeManager } from '../../utils/UniversalModeManager';

const Home: React.FC = () => {
  const navigate = useNavigate();
  
  // LocationGate state
  const [showLocationGate, setShowLocationGate] = useState(false);

  // Fetch configurations
  const headerConfig = ContentConfigHelper.getTemplateById('header') as ContentContainerProps;
  const heroConfig = ContentConfigHelper.getTemplateById('hero') as ContentContainerProps;
  const infoConfig = ContentConfigHelper.getTemplateById('info-card') as ContentContainerProps;
  const arCam = ContentConfigHelper.getTemplateById('arCam') as ContentContainerProps;
  const camMap = ContentConfigHelper.getTemplateById('camMap') as ContentContainerProps;
  const kenConfig = ContentConfigHelper.getTemplateById('kenilworthLogo') as ContentContainerProps;
  const buttonConfig = ContentConfigHelper.getTemplateById('buttonToOnboarding') as ContentContainerProps;

  // Initialize UniversalModeManager
  useEffect(() => {
    universalModeManager.initialize();
  }, []);

  // Handle start experience click
  const handleStartExperienceClick = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent Link navigation
    
    // First check: Location-based restrictions (before permissions)
    if (universalModeManager.shouldBlockLocation) {
      setShowLocationGate(true);
    } else {
      // Proceed to onboarding
      navigate('/onboarding');
    }
  };

  const handleLocationGateBypass = () => {
    setShowLocationGate(false);
    navigate('/onboarding'); // URL bypass active, proceed
  };



  return (
    <div className="home-route" style={{height: '100svh'}}>
      <GradientElement 
        color="gradient(  var(--color-dark), var(--color-light) , var(--color-dark))" 
        gradientType="aurora"
        blockSize={150}
        animationDuration="30s"
      >
        <VerticalSection 
          id="vert1" 
          title="" 
          color='transparent'
        >
          <div style={{ textDecoration: 'none', margin: '1rem 1rem 1rem 1rem', height: '100%', overflow: 'visible', overflowY: 'scroll', WebkitOverflowScrolling: 'touch', textAlign: "center"}}>
            <ContentContainer {...headerConfig} />
          </div>

          <div style={{ textAlign: "left"}}>
            <ContentContainer {...heroConfig} />
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', background: 'transparent', margin: '0rem', borderRadius: '1rem', fontWeight:'bold'}}>
            
            <div style={{
              background: 'linear-gradient(45deg, var(--color-blue), var(--color-pink), var(--color-green))',
              padding: '2px',
              borderRadius: '1rem',
              margin: "1rem 1rem 1rem 1rem"
            }}>
              {/* Replace Link with div and onClick handler */}
              <div 
                onClick={handleStartExperienceClick}
                style={{ 
                  textDecoration: 'none',
                  display: 'block',
                  background: 'var(--color-dark)',
                  borderRadius: 'calc(1rem - 2px)',
                  padding: '1rem',
                  cursor: 'pointer' // Add cursor pointer
                }}
              >
                <Button {...buttonConfig} />
              </div>
            </div>
          </div>

          

          {/* Development debug info */}
          {process.env.NODE_ENV === 'development' && (
            <div style={{
              position: 'fixed',
              top: '10px',
              left: '10px',
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              color: 'white',
              padding: '8px',
              borderRadius: '4px',
              fontSize: '10px',
              fontFamily: 'monospace',
              zIndex: 9998
            }}>
              <div>Universal Mode: {universalModeManager.isUniversal ? 'ON' : 'OFF'}</div>
              <div>Should Block Location: {universalModeManager.shouldBlockLocation ? 'YES' : 'NO'}</div>
              <div>Reasons: {universalModeManager.reasons.join(', ') || 'none'}</div>
            </div>
          )}
        </VerticalSection>
      </GradientElement>

      {/* LocationGate Modal */}
      <LocationGateModal
        isOpen={showLocationGate}
        onClose={() => setShowLocationGate(false)}
        onBypass={handleLocationGateBypass}
        checkType="location"
      />
    </div>
  );
};

export default Home;