import React, { ReactNode } from 'react';
import HorizontalPanel from './HorizontalPanel';
import ContentContainer from '../../common/ContentContainer';
import ContentConfigHelper from '../../../utils/ContentConfigHelper';
import { getAssetPath } from '../../../utils/assetPaths';

interface ConfigurableHorizontalPanelProps {
  // Configuration by template ID
  templateId: string;  // ID of the template to use from contentConfigurations.json
  
  // Optional overrides (can be empty if you want to use configuration as-is)
  configOverrides?: Record<string, any>;  // Override specific template properties
  
  // Standard props
  children?: ReactNode;
  className?: string;
}

/**
 * A HorizontalPanel that can be configured using templates from contentConfigurations.json
 */
const ConfigurableHorizontalPanel: React.FC<ConfigurableHorizontalPanelProps> = ({
  templateId,
  configOverrides = {},
  children,
  className = '',
}) => {
  // Get the configuration for this template
  const templateConfig = ContentConfigHelper.getTemplateById(templateId);
  
  if (!templateConfig) {
    console.error(`Template with ID "${templateId}" not found.`);
    return null;
  }
  
  // Merge template with any overrides
  const config = { ...templateConfig, ...configOverrides };
  
  // Process image paths if they exist and remove empty image sources
  if (config.contentImage) {
    if (!config.contentImage.src || config.contentImage.src === '') {
      // Delete contentImage if src is empty
      // delete config.contentImage;
    } else if (!config.contentImage.src.startsWith('http')) {
      config.contentImage.src = getAssetPath(config.contentImage.src);
    }
  }
  
  // Also handle video sources
  if (config.contentVideo) {
    if (!config.contentVideo.src || config.contentVideo.src === '') {
      // Delete contentVideo if src is empty
      // delete config.contentVideo;
    } else if (!config.contentVideo.src.startsWith('http')) {
      config.contentVideo.src = getAssetPath(config.contentVideo.src);
    }
  }

  // Process background image
  let processedBackgroundImage: string | null = null;
  if (typeof config.backgroundImage === 'string' && config.backgroundImage.trim() !== '') {
    processedBackgroundImage = config.backgroundImage.startsWith('http')
      ? config.backgroundImage
      : getAssetPath(config.backgroundImage);
  }

  // Process background video
  let processedBackgroundVideo: string | null = null;
  if (typeof config.backgroundVideo === 'string' && config.backgroundVideo.trim() !== '') {
    processedBackgroundVideo = config.backgroundVideo.startsWith('http')
      ? config.backgroundVideo
      : getAssetPath(config.backgroundVideo);
  }
  
  // Process colors to ensure CSS variables work
  const processColor = (colorValue: string | undefined | null): string | null => {
    if (!colorValue) return null;
    // If it's already a CSS variable reference like var(--color-blue)
    if (colorValue.startsWith('var(--color-')) {
      return colorValue;
    }
    // Direct CSS color values
    return colorValue;
  };
  
  const backgroundColor = processColor(config.backgroundColor);
  
  // Handle null values and provide defaults for essential properties
  const panelBackground = backgroundColor || 'var(--color-dark)';
  const textColor = processColor(config.textColor) || 'var(--color-light)';
  
  return (
    <HorizontalPanel
      title="" // We'll render title in ContentContainer
      color={panelBackground}
      className={className}
      width={config.width || '100vw'}
      height={config.height || '100%'}
    >
      <ContentContainer
        title={config.title || 'Horizontal Panel'}
        subtitle={config.subtitle}
        content={config.content}
        backgroundColor="transparent" // Use panel's background
        textColor={textColor}
        padding={config.padding || '2rem'}
        alignment={config.alignment as ("center" | "left" | "right" | undefined) || 'center'}
        verticalAlignment={config.verticalAlignment as ("center" | "top" | "bottom" | undefined) || 'center'}
        fullWidth={config.fullWidth !== undefined ? config.fullWidth : true}
        fullHeight={config.fullHeight !== undefined ? config.fullHeight : true}
        contentImage={config.contentImage as { src: string; alt?: string; width?: string | number; height?: string | number; position?: "left" | "above" | "right" | "below"; caption?: string; className?: string; } | undefined}
        contentVideo={config.contentVideo as { src: string; autoPlay?: boolean; loop?: boolean; muted?: boolean; controls?: boolean; width?: string | number; height?: string | number; position?: "left" | "above" | "right" | "below"; caption?: string; className?: string; } | undefined}
        backgroundImage={processedBackgroundImage || undefined}
        backgroundVideo={processedBackgroundVideo || undefined}
        className={config.className}
        titleClassName={config.titleClassName}
        animateIn={config.animateIn}
        >
      </ContentContainer>
    </HorizontalPanel>
  );
};

export default ConfigurableHorizontalPanel;