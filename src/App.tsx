import React, { ReactNode } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { getAssetPath } from './utils/assetPaths';
import ContentConfigHelper from './utils/ContentConfigHelper';
import GradientElement from './utils/GradientElement'
import VerticalSection from './components/sections/vertical/VerticalSection';

import SnappingCarousel from './components/carousel/SnappingCarousel';
import SnappingCard from './components/carousel/SnappingCard';
// Import ContentContainerProps along with the component
import ContentContainer, { ContentContainerProps } from './components/common/ContentContainer';
import Button from './components/common/Button'
import HorizontalSection from './components/sections/horizontal/HorizontalSection';
import HorizontalPanel from './components/sections/horizontal/HorizontalPanel';
import ConfigurableHorizontalPanel from './components/sections/horizontal/ConfigurableHorizontalPanel';



import './App.css';



function App() {
  // Fetch the config and assert its type to match ContentContainerProps
  const headerConfig = ContentConfigHelper.getTemplateById('header') as ContentContainerProps;
  const heroConfig = ContentConfigHelper.getTemplateById('hero') as ContentContainerProps;
  const infoConfig = ContentConfigHelper.getTemplateById('info-card') as ContentContainerProps;
  const kenConfig = ContentConfigHelper.getTemplateById('kenilworthLogo') as ContentContainerProps;
  const buttonConfig = ContentConfigHelper.getTemplateById('buttonToOnboarding') as ContentContainerProps;

  return (
    <div className="App">

    
    <GradientElement 
             color="gradient(var(--color-dark), var(--color-pink), var(--color-blue), var(--color-dark), var(--color-green))" 
             gradientType="blocks"
            
             blockSize={200} //
      >
        <VerticalSection id="vert1" title="" color='gradient(var(--color-dark), var(--color-pink), var(--color-blue))' >

          <ContentContainer {...headerConfig} />
          <ContentContainer {...heroConfig} />
          <ContentContainer {...infoConfig} />
          <ContentContainer {...kenConfig} />
          <Button {...buttonConfig} />



        </VerticalSection>
        
      </GradientElement>
     
     
      <GradientElement 
             color="gradient(var(--color-dark), var(--color-pink), var(--color-blue), var(--color-dark), var(--color-green))" 
             gradientType="blocks"
            
             blockSize={200} //
             >
        {/* Snapping Carousel Section */}
          <SnappingCarousel 
            id="carousel1" 
            title="" 
            background=""
          >
            <SnappingCard title="" subtitle="" color="var(--color-dark)" index={1} height="80%">
              
            </SnappingCard>
            
            <SnappingCard title="" subtitle="" color="var(--color-dark)" index={2} height="80%">
           
            </SnappingCard>
            
            <SnappingCard title="" subtitle="" color="var(--color-dark)" index={3} height="80%">
              
              
            </SnappingCard>
            
            <SnappingCard title="" subtitle="" color="var(--color-dark)" index={4} height="80%">
              
              
            </SnappingCard>
            
            <SnappingCard title="" subtitle="" color="var(--color-dark)" index={5} height="80%">
             
             
            </SnappingCard>
          </SnappingCarousel>

      </GradientElement>



       {/* <VerticalSection id="vert2" title="Vertical 2" color="var(--color-green)">
  
     
      </VerticalSection> */}
      
      {/* Horizontal Section */}
      {/* <HorizontalSection id="horz1" background="var(--color-dark)">
        
        <HorizontalPanel title="Horizontal 1" color="var(--color-blue)" />

        <ConfigurableHorizontalPanel 
          templateId="horizontal-panel"
          configOverrides={{
            subtitle: "This panel uses the configuration from contentConfigurations.json",
            content: "Configuration comes directly from the JSON file."
          }}
        />
        
        
        <ConfigurableHorizontalPanel 
          templateId="horizontal-panel"
          configOverrides={{
            backgroundColor: "var(--color-green)",
            subtitle: "Panel with custom overrides",
            content: "You can still override specific properties when needed.",
            padding: "4rem",
            titleClassName: "text-5xl font-black mb-4"
          }}
        />
        
      
        <ConfigurableHorizontalPanel 
          templateId="cta-section"
          configOverrides={{
            content: "This panel uses a different template configuration.",
            width: "100vw"
          }}
        />
      </HorizontalSection>
       */}
      {/* Another Vertical Section */}
      {/* <VerticalSection id="vert3" title="Vertical 3" color="var(--color-pink)" /> */}
      
      {/* Final Vertical Section */}
      {/* <VerticalSection id="vert4" title="Vertical 4" color="var(--color-green)" /> */}
    </div>
  );
}

export default App;