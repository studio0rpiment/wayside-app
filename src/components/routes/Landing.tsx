import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import ContentConfigHelper from '../../utils/ContentConfigHelper';
import { ContentContainerProps } from '../../components/common/ContentContainer';
import ContentContainer from '../../components/common/ContentContainer';
import Button from '../../components/common/Button';
import GradientElement from '../../utils/GradientElement';
import VerticalSection from '../sections/vertical/VerticalSection';

const Landing: React.FC = () => {
  // Fetch configurations
  const headerLandingConfig = ContentConfigHelper.getTemplateById('headerLanding') as ContentContainerProps;
  const heroConfig = ContentConfigHelper.getTemplateById('hero') as ContentContainerProps;
  const infoConfig = ContentConfigHelper.getTemplateById('info-card') as ContentContainerProps;
  const arCam = ContentConfigHelper.getTemplateById('arCam') as ContentContainerProps;
  const camMap = ContentConfigHelper.getTemplateById('camMap') as ContentContainerProps;
  const kenConfig = ContentConfigHelper.getTemplateById('kenilworthLogo') as ContentContainerProps;
  const buttonConfig = ContentConfigHelper.getTemplateById('buttonToHome') as ContentContainerProps;

  // Test coordinate system on mount (development only)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      // Small delay to let the page load first
      const timer = setTimeout(() => {
        import('../../utils/coordinate-system/test-world-system').then(module => {
          console.log('🏠 Running coordinate system test from Landing page...');
          module.testWorldCoordinateSystem();
        }).catch(error => {
          console.log('⚠️ Coordinate system test not available yet:', error.message);
        });
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, []);

  return (
    <div className="landing-route" style = {{height: '100svh'}}>
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
          // color='gradient(var(--color-dark), var(--color-pink), var(--color-blue))'
        >
          <div style={{ textDecoration: 'none', margin: '1rem 1rem 1rem 1rem', height: '100%', overflow: 'auto',  overflowY: 'scroll',WebkitOverflowScrolling: 'touch' }}>
            <ContentContainer {...headerLandingConfig} />
          </div>
          {/* <ContentContainer {...heroConfig} /> */}
          

          <div style={{ display: 'flex', flexDirection: 'row'}}>
          <ContentContainer {...camMap} />
          <ContentContainer {...arCam} />
          </div>

          
          {/* <div style={{ fontSize: '0.9rem', fontWeight: 'bold'}}>
          <ContentContainer {...kenConfig} />
          </div> */}
          <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--color-dark)', margin: '1rem', borderRadius: '1rem', fontWeight:'bold'}}
            >
          <ContentContainer  {...infoConfig} />
          
          <Link to="/home" style={{ textDecoration: 'none', border:'1px solid var(--color-light)', borderRadius: '1rem',  "margin": "1rem 1rem 1rem 1rem",  }}>
            <Button {...buttonConfig} />
          </Link>
          </div>

         
        </VerticalSection>
      </GradientElement>
    </div>
  );
};

export default Landing;