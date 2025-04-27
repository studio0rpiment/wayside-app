import contentConfigurations from '../data/contentConfigurations.json';

/**
 * ContentConfigHelper - Utility for working with ContentContainer configurations
 */
export const ContentConfigHelper = {
  /**
   * Get a content template by ID
   * @param id Template ID from contentConfigurations.json
   * @returns Configuration object for the requested template
   */
  getTemplateById: (id: string) => {
    const template = contentConfigurations.contentTemplates.find(
      template => template.id === id
    );
    
    if (!template) {
      console.warn(`Template with ID "${id}" not found.`);
      return null;
    }
    
    return template.configuration;
  },
  
  /**
   * Get a layout by ID
   * @param id Layout ID from contentConfigurations.json
   * @returns Layout configuration object
   */
  getLayoutById: (id: string) => {
    const layout = contentConfigurations.contentLayouts.find(
      layout => layout.id === id
    );
    
    if (!layout) {
      console.warn(`Layout with ID "${id}" not found.`);
      return null;
    }
    
    return layout;
  },
  
  /**
   * Get a color palette by ID
   * @param id Palette ID from contentConfigurations.json
   * @returns Color palette object
   */
  getColorPaletteById: (id: string) => {
    const palette = contentConfigurations.colorPalettes.find(
      palette => palette.id === id
    );
    
    if (!palette) {
      console.warn(`Color palette with ID "${id}" not found.`);
      return null;
    }
    
    return palette.colors;
  },
  
  /**
   * Get typography settings by ID
   * @param id Typography ID from contentConfigurations.json
   * @returns Typography settings object
   */
  getTypographyById: (id: string) => {
    const typography = contentConfigurations.typographySettings.find(
      typography => typography.id === id
    );
    
    if (!typography) {
      console.warn(`Typography settings with ID "${id}" not found.`);
      return null;
    }
    
    return typography;
  },
  
  /**
   * Get animation options by ID
   * @param id Animation ID from contentConfigurations.json
   * @returns Animation options object
   */
  getAnimationById: (id: string) => {
    const animation = contentConfigurations.animationOptions.find(
      animation => animation.id === id
    );
    
    if (!animation) {
      console.warn(`Animation with ID "${id}" not found.`);
      return null;
    }
    
    return animation;
  },
  
  /**
   * Get media asset by ID
   * @param id Media asset ID from contentConfigurations.json
   * @returns Media asset object with path and metadata
   */
  getMediaById: (id: string) => {
    const images = contentConfigurations.mediaAssets.images;
    const videos = contentConfigurations.mediaAssets.videos;
    
    const image = images.find(img => img.id === id);
    if (image) return image;
    
    const video = videos.find(vid => vid.id === id);
    if (video) return video;
    
    console.warn(`Media asset with ID "${id}" not found.`);
    return null;
  },
  
  /**
   * Create a combined configuration by merging a template with overrides
   * @param templateId Base template ID
   * @param overrides Properties to override on the base template
   * @returns Combined configuration object
   */
  createConfigFromTemplate: (templateId: string, overrides: Record<string, any> = {}) => {
    const template = ContentConfigHelper.getTemplateById(templateId);
    
    if (!template) {
      console.error(`Cannot create config: Template with ID "${templateId}" not found.`);
      return overrides;
    }
    
    return {
      ...template,
      ...overrides
    };
  },
  
  /**
   * Apply a color palette to a configuration
   * @param config Content configuration object
   * @param paletteId Color palette ID
   * @returns Updated configuration with colors from the palette
   */
  applyColorPalette: (config: Record<string, any>, paletteId: string) => {
    const palette = ContentConfigHelper.getColorPaletteById(paletteId);
    
    if (!palette) {
      return config;
    }
    
    return {
      ...config,
      backgroundColor: palette.background,
      textColor: palette.text,
      // Add other color mappings as needed
    };
  },
  
  /**
   * Get all available templates
   * @returns Array of all templates with their IDs and names
   */
  getAllTemplates: () => {
    return contentConfigurations.contentTemplates.map(template => ({
      id: template.id,
      name: template.name,
      description: template.description
    }));
  },
  
  /**
   * Get all available layouts
   * @returns Array of all layouts with their IDs and names
   */
  getAllLayouts: () => {
    return contentConfigurations.contentLayouts.map(layout => ({
      id: layout.id,
      name: layout.name,
      description: layout.description
    }));
  }
};

export default ContentConfigHelper;