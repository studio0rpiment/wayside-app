import React from 'react';
import GradientElement from '../../utils/GradientElement';
import SnappingCarousel from '../carousel/SnappingCarousel';
import SnappingCard from '../carousel/SnappingCard';

const Onboarding: React.FC = () => {
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
        >
          <SnappingCard title="" subtitle="" color="var(--color-dark)" index={1} height="90%">
            {/* Card 1 content */}
          </SnappingCard>
          
          <SnappingCard title="" subtitle="" color="var(--color-dark)" index={2} height="90%">
            {/* Card 2 content */}
          </SnappingCard>
          
          <SnappingCard title="" subtitle="" color="var(--color-dark)" index={3} height="90%">
            {/* Card 3 content */}
          </SnappingCard>
          
          <SnappingCard title="" subtitle="" color="var(--color-dark)" index={4} height="90%">
            {/* Card 4 content */}
          </SnappingCard>
          
          <SnappingCard title="" subtitle="" color="var(--color-dark)" index={5} height="90%">
            {/* Card 5 content */}
          </SnappingCard>
        </SnappingCarousel>
      </GradientElement>
    </div>
  );
};

export default Onboarding;