import React from 'react';
import { Link } from 'react-router-dom';
import ContentConfigHelper from '../../utils/ContentConfigHelper';
import { ContentContainerProps } from '../../components/common/ContentContainer';
import ContentContainer from '../../components/common/ContentContainer';
import Button from '../../components/common/Button';
import GradientElement from '../../utils/GradientElement';
import VerticalSection from '../sections/vertical/VerticalSection';

const Home: React.FC = () => {
  // Fetch configurations
  const headerConfig = ContentConfigHelper.getTemplateById('header') as ContentContainerProps;
  const heroConfig = ContentConfigHelper.getTemplateById('hero') as ContentContainerProps;
  const infoConfig = ContentConfigHelper.getTemplateById('info-card') as ContentContainerProps;
  const kenConfig = ContentConfigHelper.getTemplateById('kenilworthLogo') as ContentContainerProps;
  const buttonConfig = ContentConfigHelper.getTemplateById('buttonToOnboarding') as ContentContainerProps;

  return (
    <div className="home-route">
      <GradientElement 
        color="gradient(var(--color-dark)" 
        gradientType="blocks"
        blockSize={200}
      >
        <VerticalSection 
          id="vert1" 
          title="" 
          color='transparent'
          // color='gradient(var(--color-dark), var(--color-pink), var(--color-blue))'
        >
          <div style={{ textDecoration: 'none', margin: '1rem 1rem 1rem 1rem' }}>
            <ContentContainer {...headerConfig} />
          </div>
          <ContentContainer {...heroConfig} />
          {/* <ContentContainer {...infoConfig} /> */}
          <ContentContainer {...kenConfig} />
          <Link to="/onboarding" style={{ textDecoration: 'none', "margin": "1rem 1rem 1rem 1rem", }}>
            <Button {...buttonConfig} />
          </Link>
        </VerticalSection>
      </GradientElement>
    </div>
  );
};

export default Home;