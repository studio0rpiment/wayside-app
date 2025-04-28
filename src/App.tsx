import React, { ReactNode } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import VerticalSection from './components/sections/vertical/VerticalSection';
import HorizontalSection from './components/sections/horizontal/HorizontalSection';
import HorizontalPanel from './components/sections/horizontal/HorizontalPanel';
import ConfigurableHorizontalPanel from './components/sections/horizontal/ConfigurableHorizontalPanel';
import SnappingCarousel from './components/carousel/SnappingCarousel';
import SnappingCard from './components/carousel/SnappingCard';
// Import ContentContainerProps along with the component
import ContentContainer, { ContentContainerProps } from './components/common/ContentContainer';
import ContentConfigHelper from './utils/ContentConfigHelper';
import GradientElement from './utils/GradientElement'
import { getAssetPath } from './utils/assetPaths';
import './App.css';



function App() {
  // Fetch the config and assert its type to match ContentContainerProps
  const headerConfig = ContentConfigHelper.getTemplateById('header') as ContentContainerProps;

  return (
    <div className="App">

    
<GradientElement 
             color="gradient(var(--color-dark), var(--color-pink), var(--color-blue), var(--color-dark), var(--color-green))" 
             gradientType="blocks"
            
             blockSize={200} //
             
       
       
         
         
      >
        <VerticalSection id="vert1" title="" color='gradient(var(--color-dark), var(--color-pink), var(--color-blue))' >
          <ContentContainer 
            {...headerConfig} />
        </VerticalSection>
        
      </GradientElement>
     
      <VerticalSection id="vert2" title="Vertical 2" color="var(--color-green)">
  
     
      </VerticalSection>
      
      {/* Horizontal Section */}
      <HorizontalSection id="horz1" background="var(--color-dark)">
        {/* Standard panel */}
        <HorizontalPanel title="Horizontal 1" color="var(--color-blue)" />
        
        {/* Configurable panel using the template from contentConfigurations.json */}
        <ConfigurableHorizontalPanel 
          templateId="horizontal-panel"
          configOverrides={{
            subtitle: "This panel uses the configuration from contentConfigurations.json",
            content: "Configuration comes directly from the JSON file."
          }}
        />
        
        {/* Panel with custom overrides */}
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
        
        {/* Using a different template for a horizontal panel */}
        <ConfigurableHorizontalPanel 
          templateId="cta-section"
          configOverrides={{
            content: "This panel uses a different template configuration.",
            width: "100vw"
          }}
        />
      </HorizontalSection>
      
      {/* Another Vertical Section */}
      <VerticalSection id="vert3" title="Vertical 3" color="var(--color-pink)" />
      
      {/* Snapping Carousel Section */}
      <SnappingCarousel 
        id="carousel1" 
        title="Our Projects" 
        background="var(--color-dark)"
      >
        <SnappingCard title="Project 1" subtitle="Web Design" color="var(--color-pink)" index={1} height="80%">
          <p>Description of the amazing project...</p>
        </SnappingCard>
        
        <SnappingCard title="Project 2" subtitle="Mobile App" color="var(--color-blue)" index={2} height="80%">
          <p>Card 2 Content</p>
        </SnappingCard>
        
        <SnappingCard title="Project 3" subtitle="Brand Identity" color="var(--color-green)" index={3} height="80%">
          <p>Card 3 Content</p>
        </SnappingCard>
        
        <SnappingCard title="Project 4" subtitle="UI/UX Design" color="var(--color-pink)" index={4} height="80%">
          <p>Card 4 Content</p>
        </SnappingCard>
        
        <SnappingCard title="Project 5" subtitle="Marketing Campaign" color="var(--color-blue)" index={5} height="80%">
          <p>Card 5 Content</p>
        </SnappingCard>
      </SnappingCarousel>
      
      {/* Final Vertical Section */}
      <VerticalSection id="vert4" title="Vertical 4" color="var(--color-green)" />
    </div>
  );
}

export default App;