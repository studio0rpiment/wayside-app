import React, { ReactNode } from 'react';
import classNames from 'classnames';
import { getAssetPath } from '../../utils/assetPaths.ts';

export interface ContentContainerProps {
  // Content
  title?: string;
  subtitle?: string;
  content?: string | ReactNode;
  children?: ReactNode;
  
  // Styling and Layout
  id?: string;
  backgroundColor?: string;
  backgroundImage?: string;
  textColor?: string;
  width?: string | number;
  height?: string | number;
  padding?: string;
  margin?: string;
  className?: string;
  
  // Layout options
  alignment?: 'left' | 'center' | 'right';
  verticalAlignment?: 'top' | 'center' | 'bottom';
  fullWidth?: boolean;
  fullHeight?: boolean;
  
  // Content Media
  contentImage?: {
    src: string;
    alt?: string;
    width?: string | number;
    height?: string | number;
    position?: 'above' | 'below' | 'left' | 'right';
    caption?: string;
    className?: string;
  };
  
  // Typography
  fontFamily?: string;
  fontWeight?: number | string;
  fontSize?: string;
  lineHeight?: string | number;
  letterSpacing?: string;
  variableFontSettings?: {
    wght?: number;
    wdth?: number;
    slnt?: number;
    ital?: number;
    opsz?: number;
    grad?: number;
    custom?: Record<string, number>;
  };
  
  // Visual Effects
  hasShadow?: boolean;
  borderRadius?: string;
  opacity?: number;
  glassmorphism?: boolean;
  
  // Content Formatting
  contentClassName?: string;
  titleClassName?: string;
  subtitleClassName?: string;
  textClassName?: string;
  
  // Interactive Behavior
  interactive?: boolean;
  hoverEffect?: 'none' | 'scale' | 'glow' | 'lift';
  onClick?: () => void;
  
  // Animation flags (ignored in this version)
  animateIn?: boolean;
  scrollTrigger?: boolean;
  scrollParallax?: boolean;
  fontAnimatesOnScroll?: boolean;
  animationType?: string;
  animationDuration?: number;
  animationDelay?: number;
}

const SimpleContentContainer: React.FC<ContentContainerProps> = ({
  // Content
  title,
  subtitle,
  content,
  children,
  
  // Styling and Layout
  id,
  backgroundColor = 'transparent',
  backgroundImage,
  textColor = 'white',
  width = '100%',
  height = 'auto',
  padding = '0',
  margin = '0',
  className = '',
  
  // Layout options
  alignment = 'center',
  verticalAlignment = 'center',
  fullWidth = false,
  fullHeight = false,
  
  // Content Media
  contentImage,
  
  // Typography
  fontFamily,
  fontWeight,
  fontSize,
  lineHeight,
  letterSpacing,
  variableFontSettings,
  
  // Visual Effects
  hasShadow = false,
  borderRadius = '0.5rem',
  opacity = 1,
  glassmorphism = false,
  
  // Content Formatting
  contentClassName = '',
  titleClassName = '',
  subtitleClassName = '',
  textClassName = '',
  
  // Interactive Behavior
  interactive = false,
  hoverEffect = 'none',
  onClick,
}) => {
  
  // Generate variable font style
  const getVariableFontStyle = () => {
    if (!variableFontSettings) return {};
    
    const style: React.CSSProperties = {};
    const variations = [];
    
    if (variableFontSettings.wght !== undefined) {
      variations.push(`"wght" ${variableFontSettings.wght}`);
    }
    if (variableFontSettings.wdth !== undefined) {
      variations.push(`"wdth" ${variableFontSettings.wdth}`);
    }
    if (variableFontSettings.slnt !== undefined) {
      variations.push(`"slnt" ${variableFontSettings.slnt}`);
    }
    if (variableFontSettings.ital !== undefined) {
      variations.push(`"ital" ${variableFontSettings.ital}`);
    }
    if (variableFontSettings.opsz !== undefined) {
      variations.push(`"opsz" ${variableFontSettings.opsz}`);
    }
    if (variableFontSettings.grad !== undefined) {
      variations.push(`"grad" ${variableFontSettings.grad}`);
    }
    
    if (variableFontSettings.custom) {
      Object.entries(variableFontSettings.custom).forEach(([axis, value]) => {
        variations.push(`"${axis}" ${value}`);
      });
    }
    
    if (variations.length > 0) {
      style.fontVariationSettings = variations.join(', ');
    }
    
    return style;
  };
  
  // Container classes
  const containerClasses = classNames(
    'content-container',
    {
      'w-full': fullWidth,
      'h-full': fullHeight,
      'shadow-lg': hasShadow,
      'backdrop-blur-sm bg-opacity-70': glassmorphism,
      
      // Interactive hover effects
      'transition-transform duration-300 ease-in-out': interactive,
      'hover:scale-105': interactive && hoverEffect === 'scale',
      'hover:shadow-xl hover:-translate-y-1': interactive && hoverEffect === 'lift',
      'hover:shadow-glow': interactive && hoverEffect === 'glow',
      
      // Alignment
      'text-left': alignment === 'left',
      'text-center': alignment === 'center', 
      'text-right': alignment === 'right',
      
      // Vertical alignment
      'justify-start': verticalAlignment === 'top',
      'justify-center': verticalAlignment === 'center',
      'justify-end': verticalAlignment === 'bottom',
      
      // Flex container
      'flex flex-col': true,
    },
    className
  );
  
  // Container style
  const containerStyle: React.CSSProperties = {
    backgroundColor,
    color: textColor,
    width: fullWidth ? '100%' : width,
    height: fullHeight ? '100%' : height,
    padding,
    margin,
    borderRadius,
    opacity,
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    ...getVariableFontStyle(),
  };
  
  // Add background image if provided
  if (backgroundImage) {
    containerStyle.backgroundImage = `url(${getAssetPath(backgroundImage)})`;
    containerStyle.backgroundSize = 'cover';
    containerStyle.backgroundPosition = 'center';
  }
  
  // Add typography styles
  if (fontFamily) containerStyle.fontFamily = fontFamily;
  if (fontWeight) containerStyle.fontWeight = fontWeight;
  if (fontSize) containerStyle.fontSize = fontSize;
  if (lineHeight) containerStyle.lineHeight = lineHeight;
  if (letterSpacing) containerStyle.letterSpacing = letterSpacing;

  return (
    <div 
      id={id}
      className={containerClasses}
      style={containerStyle}
      onClick={onClick}
      data-component={id}
    >
      {/* Glassmorphism overlay */}
      {glassmorphism && (
        <div className="absolute inset-0 bg-white/30 backdrop-blur-sm" />
      )}
      
      {/* Content section */}
      <div className={classNames('content-wrapper relative z-10', contentClassName)}>
        
        {/* Content image above */}
        {contentImage?.position === 'above' && (
          <div className="media-container mb-4">
            <figure className={classNames('media-figure', contentImage.className)}>
              <img 
                src={getAssetPath(contentImage.src)}
                alt={contentImage.alt || title || 'Content image'} 
                style={{
                  width: contentImage.width || '100%',
                  height: contentImage.height || 'auto',
                }}
                className="max-w-full object-contain"
              />
              {contentImage.caption && (
                <figcaption className="text-sm mt-2 opacity-75">{contentImage.caption}</figcaption>
              )}
            </figure>
          </div>
        )}
        
        {/* Text content */}
        <div className="text-content">
          {title && (
            <h3 className={classNames('font-bold mb-2', titleClassName || 'text-2xl')}>
              {title}
            </h3>
          )}
          
          {subtitle && (
            <h4 className={classNames('text-xl font-light mb-4 opacity-80', subtitleClassName)}>
              {subtitle}
            </h4>
          )}
          
          {content && (
            <div className={classNames('content-text', textClassName)}>
              {typeof content === 'string' ? <p>{content}</p> : content}
            </div>
          )}
          
          {children}
        </div>
        
        {/* Content image below */}
        {contentImage?.position === 'below' && (
          <div className="media-container mt-4">
            <figure className={classNames('media-figure', contentImage.className)}>
              <img 
                src={getAssetPath(contentImage.src)} 
                alt={contentImage.alt || title || 'Content image'} 
                style={{
                  width: contentImage.width || '100%',
                  height: contentImage.height || 'auto',
                }}
                className="max-w-full object-contain"
              />
              {contentImage.caption && (
                <figcaption className="text-sm mt-2 opacity-75">{contentImage.caption}</figcaption>
              )}
            </figure>
          </div>
        )}
        
        {/* Content image with no position specified (default to above) */}
        {contentImage && !contentImage.position && (
          <div className="media-container mb-4">
            <figure className={classNames('media-figure', contentImage.className)}>
              <img 
                src={getAssetPath(contentImage.src)}
                alt={contentImage.alt || title || 'Content image'} 
                style={{
                  width: contentImage.width || '100%',
                  height: contentImage.height || 'auto',
                }}
                className="max-w-full object-contain"
              />
              {contentImage.caption && (
                <figcaption className="text-sm mt-2 opacity-75">{contentImage.caption}</figcaption>
              )}
            </figure>
          </div>
        )}
      </div>
    </div>
  );
};

export default SimpleContentContainer;