import React from 'react';
import VerticalSection from '../sections/vertical/VerticalSection';

const Mac: React.FC = () => {
  return (
    <div className="mac-route">
      <VerticalSection 
        id="macSection" 
        title="Mac"
        color="var(--color-dark)"
      >
        <div className="mac-content" style={{ padding: '1rem' }}>
          {/* Content will be added here */}
        </div>
      </VerticalSection>
    </div>
  );
};

export default Mac;