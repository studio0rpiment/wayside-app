import React from 'react';
import VerticalSection from '../sections/vertical/VerticalSection';

const WaterLevel: React.FC = () => {
  return (
    <div className="water-level-route">
      <VerticalSection 
        id="waterLevelSection" 
        title="Water Level"
        color="var(--color-dark)"
      >
        {/* Content will go here */}
      </VerticalSection>
    </div>
  );
};

export default WaterLevel;