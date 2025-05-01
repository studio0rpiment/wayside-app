import React from 'react';
import VerticalSection from '../sections/vertical/VerticalSection';
import PermissionsStatus from '../common/PermissionsStatus';

const Map: React.FC = () => {
  return (
    <div className="map-route">
      <VerticalSection 
        id="mapSection" 
        title="Map"
        color="var(--color-dark)"
      >
        <div className="map-content" style={{ padding: '1rem' }}>
          <p>Map content will be displayed here...</p>
          
          {/* Minimal permission status indicators */}
          <PermissionsStatus compact={true} />
        </div>
      </VerticalSection>
    </div>
  );
};

export default Map;