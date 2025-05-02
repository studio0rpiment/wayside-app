import React from 'react';
import VerticalSection from '../sections/vertical/VerticalSection';
import PermissionsStatus from '../common/PermissionsStatus';
import ContentConfigHelper from '../../utils/ContentConfigHelper';
import ContentContainer, { ContentContainerProps } from '../common/ContentContainer';

const Map: React.FC = () => {

    const mapBase1 = ContentConfigHelper.getTemplateById('mapBase1') as ContentContainerProps;
    const mapBase2 = ContentConfigHelper.getTemplateById('mapBase2') as ContentContainerProps;

  return (
    <div className="map-route">
      <VerticalSection 
        id="mapSection" 
        title="Map"
        color="var(--color-dark)"
      >
        <div className="map-content" style={{ padding: '0rem' }}>
         
          <ContentContainer {...mapBase1} />
          <ContentContainer {...mapBase2} />


          {/* Minimal permission status indicators */}
          <PermissionsStatus compact={true} />
        </div>
      </VerticalSection>
    </div>
  );
};

export default Map;