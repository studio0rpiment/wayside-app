import React from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import VerticalSection from './components/sections/vertical/VerticalSection';
import HorizontalSection from './components/sections/horizontal/HorizontalSection';
import HorizontalPanel from './components/sections/horizontal/HorizontalPanel';
import SnappingCarousel from './components/carousel/SnappingCarousel';
import SnappingCard from './components/carousel/SnappingCard';
import ContentContainer from './components/common/ContentContainer';
import ContentConfigHelper from './utils/ContentConfigHelper';
import './App.css';

// Register ScrollTrigger globally - this is important!
gsap.registerPlugin(ScrollTrigger);

function App() {
  return (
    <div className="App">
      {/* Vertical Sections */}
      <VerticalSection id="vert1" title="Vertical 1" color="#3498db" />
      <VerticalSection id="vert2" title="Vertical 2" color="#2ecc71">
        {/* Hero section using ContentContainer with hero template */}
        <ContentContainer 
          title="Welcome to Our Interactive Experience" 
          subtitle="Scroll to explore the possibilities"
          backgroundColor="#1a1a2e"
          textColor="#ffffff"
          width="100%"
          height="100vh"
          padding="3rem"
          fullWidth={true}
          fullHeight={true}
          alignment="center"
          verticalAlignment="center"
          backgroundImage="/src/assets/images/react.svg"
          hasShadow={true }
          borderRadius="0"
          glassmorphism={true}
          animateIn={true}
          animationType="fade"
          animationDuration={0.8}
          titleClassName="text-5xl md:text-7xl font-black tracking-tight mb-6"
          subtitleClassName="text-xl md:text-2xl font-light mb-10 opacity-80"
          className="hero-container relative z-10"
        />
      </VerticalSection>
      
      {/* Horizontal Section */}
      <HorizontalSection id="horz1" background="#34495e">
        <HorizontalPanel title="Horizontal 1" color="#e74c3c" />
        <HorizontalPanel title="Horizontal 2" color="#f39c12" />
        <HorizontalPanel title="Horizontal 3" color="#27ae60" />
      </HorizontalSection>
      
      {/* Another Vertical Section */}
      <VerticalSection id="vert3" title="Vertical 3" color="#9b59b6" />
      
      {/* Snapping Carousel Section */}
      <SnappingCarousel 
        id="carousel1" 
        title="Our Projects" 
        background="#2c3e50"
      >
        <SnappingCard title="Project 1" subtitle="Web Design" color="#e74c3c" index={1} height="80%">
          <p>Description of the amazing project...</p>
        </SnappingCard>
        
        <SnappingCard title="Project 2" subtitle="Mobile App" color="#9b59b6" index={2} height="80%">
          <p>Card 2 Content</p>
        </SnappingCard>
        
        <SnappingCard title="Project 3" subtitle="Brand Identity" color="#3498db" index={3} height="80%">
          <p>Card 3 Content</p>
        </SnappingCard>
        
        <SnappingCard title="Project 4" subtitle="UI/UX Design" color="#2ecc71" index={4} height="80%">
          <p>Card 4 Content</p>
        </SnappingCard>
        
        <SnappingCard title="Project 5" subtitle="Marketing Campaign" color="#f39c12" index={5} height="80%">
          <p>Card 5 Content</p>
        </SnappingCard>
      </SnappingCarousel>
      
      {/* Final Vertical Section */}
      <VerticalSection id="vert4" title="Vertical 4" color="#1abc9c" />
    </div>
  );
}

export default App;