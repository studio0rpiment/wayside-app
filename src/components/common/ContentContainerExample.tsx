import React from 'react';
import ContentContainer from './ContentContainer';
import ContentConfigHelper from '../../utils/ContentConfigHelper';

/**
 * Example component showing how to use ContentContainer with configurations
 */
const ContentContainerExample: React.FC = () => {
  // Get a predefined configuration
  const heroConfig = ContentConfigHelper.getTemplateById('hero');
  
  // Create a custom configuration by extending a template
  const customFeatureConfig = ContentConfigHelper.createConfigFromTemplate('feature-card', {
    title: 'Custom Feature',
    subtitle: 'Modified from template',
    backgroundColor: '#2a4365',
    textColor: '#ffffff'
  });
  
  // Apply a color palette to a configuration
  const darkModeStats = ContentConfigHelper.applyColorPalette(
    ContentConfigHelper.getTemplateById('statistics-section') || {},
    'dark'
  );
  
  return (
    <div className="content-examples">
      {/* Using a template configuration directly */}
      {heroConfig && (
        <ContentContainer {...heroConfig} />
      )}
      
      {/* Using a modified template */}
      <ContentContainer {...customFeatureConfig} />
      
      {/* Using a configuration with a color palette applied */}
      <ContentContainer {...darkModeStats} />
      
      {/* Inline configuration */}
      <ContentContainer
        title="Inline Example"
        subtitle="Created with direct props"
        content="This content container is configured directly with props."
        backgroundColor="#f8f9fa"
        textColor="#212529"
        padding="2rem"
        borderRadius="0.5rem"
        hasShadow={true}
        contentImage={{
          src: "/path/to/example-image.jpg",
          alt: "Example image",
          position: "right",
          width: "40%"
        }}
        animateIn={true}
        animationType="fade"
        className="my-8"
      />
    </div>
  );
};

export default ContentContainerExample;