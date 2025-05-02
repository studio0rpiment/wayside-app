import React from 'react';
import VerticalSection from '../sections/vertical/VerticalSection';
import PermissionsStatus from '../common/PermissionsStatus';
import ContentConfigHelper from '../../utils/ContentConfigHelper';
import ContentContainer, { ContentContainerProps } from '../common/ContentContainer';
import Button from '../common/Button';
import { getAssetPath } from '../../utils/assetPaths';

const Map: React.FC = () => {
  const mapBase1 = ContentConfigHelper.getTemplateById('mapBase1') as ContentContainerProps;
  const mapBase2 = ContentConfigHelper.getTemplateById('mapBase2') as ContentContainerProps;

  return (
    <div className="map-route">
      <VerticalSection 
        id="mapSection" 
        title="Map"
        color="var(--color-dark)"
        backgroundImage={getAssetPath('img/mapBase2.jpg')}
        backgroundSize="70vw"
        backgroundPosition="center center"
        height="100vh"  // This sets the height to 100% of the viewport height
        fullHeight={true}
      >
        <div className="map-content" style={{ 
          padding: '0rem',
          height: '100vh',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative'
        }}>
          {/* Experience navigation buttons container - positioned in the upper right */}
          <div style={{
            position: 'absolute',
            top: '20vh',
            right: '20vh',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            zIndex: 100
          }}>
            {/* Water Level Experience Button */}
            <Button
              title="WATER"
              backgroundColor="var(--color-blue)"
              textColor="white"
              href={getAssetPath('#/water-level')}
              hasShadow={true}
              interactive={true}
              hoverEffect="lift"
              buttonClassName="experience-button"
              style={{
                width: '20%',
                borderRadius: '4rem',
                padding: '12px 16px',
                textAlign: 'center',
                fontWeight: 'bold'
              }}
            />
            
            {/* Lotus Experience Button */}
            <Button
              title="LOTUS"
              backgroundColor="var(--color-pink)"
              textColor="white"
              href={getAssetPath('#/lotus')}
              hasShadow={true}
              interactive={true}
              hoverEffect="lift"
              buttonClassName="experience-button"
              style={{
                width: '20vw',
                borderRadius: '4rem',
                padding: '12px 16px',
                textAlign: 'center',
                fontWeight: 'bold'
              }}
            />
            
            {/* McDowney Era Experience Button */}
            <Button
              title="MAC"
              backgroundColor="var(--color-green)"
              textColor="white"
              href={getAssetPath('#/mac')}
              hasShadow={true}
              interactive={true}
              hoverEffect="lift"
              buttonClassName="experience-button"
              style={{
                width: '100vw' ,
                borderRadius: '4rem',
                padding: '12px 16px',
                textAlign: 'center',
                fontWeight: 'bold'
              }}
            />
          </div>

          {/* Minimal permission status indicators */}
          <div style={{ position: 'absolute', bottom: '20px', left: '20px' }}>
            <PermissionsStatus compact={true} />
          </div>
        </div>
      </VerticalSection>
    </div>
  );
};

export default Map;