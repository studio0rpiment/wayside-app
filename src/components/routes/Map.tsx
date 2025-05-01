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
          <div className="permissions-card" style={{ 
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            padding: '1rem',
            borderRadius: '0.5rem',
            marginBottom: '1rem'
          }}>
            <h3 style={{ marginBottom: '0.5rem' }}>Permission Status</h3>
            <PermissionsStatus />
          </div>
          
          <p>Map content will be displayed here...</p>
        </div>
      </VerticalSection>
    </div>
  );
};

export default Map;