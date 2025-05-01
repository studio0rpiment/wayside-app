import React from 'react';
import VerticalSection from '../sections/vertical/VerticalSection';
import PermissionsStatus from '../common/PermissionsStatus';

const WaterLevel: React.FC = () => {
  return (
    <div className="water-level-route">
      <div style={{ 
        position: 'absolute', 
        top: '20px', 
        right: '20px', 
        zIndex: 100,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        padding: '0.5rem',
        borderRadius: '0.5rem'
      }}>
        <PermissionsStatus 
          compact={true} 
          showCamera={false}
          showLocation={true}
          showOrientation={false}
        />
      </div>

      <VerticalSection 
        id="waterLevelSection" 
        title="Water Level"
        color="var(--color-dark)"
      >
        <div style={{ padding: '1rem' }}>
          <p>Water level data requires location permissions to show relevant information for your area.</p>
          <div style={{ height: '200px', marginTop: '20px', backgroundColor: 'rgba(0, 100, 255, 0.2)', borderRadius: '5px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            Water level visualization will appear here
          </div>
        </div>
      </VerticalSection>
    </div>
  );
};

export default WaterLevel;