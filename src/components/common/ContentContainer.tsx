import React, { useRef, useEffect, useState, ReactNode } from 'react';
import classNames from 'classnames';
import { gsap } from 'gsap';
import { useScroll } from '../../context/ScrollContext';
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
  contentVideo?: {
    src: string;
    autoPlay?: boolean;
    loop?: boolean;
    muted?: boolean;
    controls?: boolean;
    width?: string | number;
    height?: string | number;
    position?: 'above' | 'below' | 'left' | 'right';
    caption?: string;
    className?: string;
  };
  
  // Background Media
  backgroundVideo?: string;
  
  // Animation and Scroll
  animateIn?: boolean;
  animationDuration?: number;
  animationDelay?: number;
  animationType?: 'fade' | 'slide' | 'scale' | 'custom';
  customAnimation?: gsap.TweenVars;
  scrollTrigger?: boolean;
  scrollParallax?: boolean;
  parallaxStrength?: number;
  
  // Typography and Variable Fonts
  fontFamily?: string;
  fontWeight?: number | string;
  fontSize?: string;
  lineHeight?: string | number;
  letterSpacing?: string;
  variableFontSettings?: {
    wght?: number; // Weight
    wdth?: number; // Width
    slnt?: number; // Slant
    ital?: number; // Italic
    opsz?: number; // Optical Size
    grad?: number; // Grade
    custom?: Record<string, number>; // Other custom axes
  };
  fontAnimatesOnScroll?: boolean;
  fontAnimationRange?: [number, number]; // Start and end trigger points in viewport percent
  
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
}

const ContentContainer: React.FC<ContentContainerProps> = ({
  // Content
  title,
  subtitle,
  content,
  children,
  
  // Styling and Layout
  id,
  backgroundColor = 'white',
  backgroundImage,
  textColor = 'black',
  width = '100%',
  height = 'auto',
  padding = '0',
  margin = '0',
  className = '',
  
  // Layout options
  alignment = 'left',
  verticalAlignment = 'top',
  fullWidth = false,
  fullHeight = false,
  
  // Content Media
  contentImage,
  contentVideo,
  
  // Background Media
  backgroundVideo,
  
  // Animation and Scroll
  animateIn = false,
  animationDuration = 0.5,
  animationDelay = 0,
  animationType = 'fade',
  customAnimation,
  scrollTrigger = false,
  scrollParallax = false,
  parallaxStrength = 0.1,
  
  // Typography and Variable Fonts
  fontFamily,
  fontWeight,
  fontSize,
  lineHeight,
  letterSpacing,
  variableFontSettings,
  fontAnimatesOnScroll = false,
  fontAnimationRange = [0, 1],
  
  // Visual Effects
  hasShadow = false,
  borderRadius = '0.5rem',
  opacity = 1,
  glassmorphism = false,
  
  // Content Formatting
  contentClassName = '',
  titleClassName = '',
  subtitleClassName = '!text-center mb-0 opacity-80',
  textClassName = '',
  
  // Interactive Behavior
  interactive = false,
  hoverEffect = 'none',
  onClick,
  
}) => {
  // Refs for animation targets
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Get scroll context
  const { scrollY, scrollDirection, scrollProgress, isScrolling } = useScroll();
  
  // State for dynamic properties (like variable font values)
  const [fontSettings, setFontSettings] = useState(variableFontSettings);
  
  // Handle scroll-based effects
  useEffect(() => {
    if (!containerRef.current) return;
    
    // Handle parallax scrolling
    if (scrollParallax && parallaxStrength !== 0) {
      const yOffset = scrollY * parallaxStrength;
      gsap.to(containerRef.current, {
        y: yOffset,
        duration: 0.1,
        ease: "power1.out",
        overwrite: true
      });
    }
    
    // Handle variable font animation based on scroll
    if (fontAnimatesOnScroll && variableFontSettings) {
      // Calculate progress within the animation range
      const [startPoint, endPoint] = fontAnimationRange;
      const element = containerRef.current;
      const rect = element.getBoundingClientRect();
      
      // Calculate element's position in viewport (0 = top edge at top, 1 = bottom edge at bottom)
      const elementTop = rect.top / window.innerHeight;
      const elementBottom = rect.bottom / window.innerHeight;
      
      // Element is in view when top is between 0 and 1
      const elementProgress = 1 - elementTop;
      
      // Map to animation range
      const rangeSize = endPoint - startPoint;
      const progressInRange = Math.max(0, Math.min(1, (elementProgress - startPoint) / rangeSize));
      
      if (variableFontSettings) {
        // Interpolate font settings based on scroll progress
        const newSettings = { ...variableFontSettings };
        
        if (newSettings.wght !== undefined) {
          // Example: Interpolate weight from 100 to 900 based on scroll
          const startWeight = 100;
          const endWeight = 900;
          newSettings.wght = startWeight + progressInRange * (endWeight - startWeight);
        }
        
        if (newSettings.slnt !== undefined) {
          // Example: Interpolate slant from 0 to -15 degrees based on scroll
          const startSlant = 0;
          const endSlant = -15;
          newSettings.slnt = startSlant + progressInRange * (endSlant - startSlant);
        }
        
        setFontSettings(newSettings);
      }
    }
  }, [scrollY, scrollParallax, parallaxStrength, fontAnimatesOnScroll, variableFontSettings, fontAnimationRange]);
  
  // Handle entrance animations
  useEffect(() => {
    if (!containerRef.current || !animateIn) return;
    
    // Set initial state
    gsap.set(containerRef.current, { 
      autoAlpha: 0,
      ...(animationType === 'slide' ? { y: 50 } : {}),
      ...(animationType === 'scale' ? { scale: 0.8 } : {})
    });
    
    // Animate in
    let animation;
    if (customAnimation) {
      animation = gsap.to(containerRef.current, {
        ...customAnimation,
        delay: animationDelay,
        duration: animationDuration
      });
    } else {
      animation = gsap.to(containerRef.current, {
        autoAlpha: 1,
        ...(animationType === 'slide' ? { y: 0 } : {}),
        ...(animationType === 'scale' ? { scale: 1 } : {}),
        delay: animationDelay,
        duration: animationDuration,
        ease: "power2.out"
      });
    }
    
    return () => {
      animation.kill();
    };
  }, [animateIn, animationType, animationDelay, animationDuration, customAnimation]);
  
  // Handle scroll trigger animations
  useEffect(() => {
    if (!containerRef.current || !scrollTrigger) return;
    
    // Create scroll trigger
    const trigger = gsap.fromTo(containerRef.current, 
      { 
        autoAlpha: 0,
        ...(animationType === 'slide' ? { y: 50 } : {}),
        ...(animationType === 'scale' ? { scale: 0.8 } : {})
      },
      {
        autoAlpha: 1,
        ...(animationType === 'slide' ? { y: 0 } : {}),
        ...(animationType === 'scale' ? { scale: 1 } : {}),
        duration: animationDuration,
        ease: "power2.out",
        scrollTrigger: {
          trigger: containerRef.current,
          start: "top 80%",
          end: "bottom 20%",
          toggleActions: "play none none reverse"
        }
      }
    );
    
    return () => {
      if (trigger.scrollTrigger) {
        trigger.scrollTrigger.kill();
      }
    };
  }, [scrollTrigger, animationType, animationDuration]);
  
  // Generate variable font style
  const getVariableFontStyle = () => {
    if (!fontSettings) return {};
    
    const style: React.CSSProperties & { [key: string]: any } = {};
    
    // Apply each font variation setting as a CSS variable
    if (fontSettings.wght !== undefined) {
      style['--wght'] = fontSettings.wght;
    }
    
    if (fontSettings.wdth !== undefined) {
      style['--wdth'] = fontSettings.wdth;
    }
    
    if (fontSettings.slnt !== undefined) {
      style['--slnt'] = fontSettings.slnt;
    }
    
    if (fontSettings.ital !== undefined) {
      style['--ital'] = fontSettings.ital;
    }
    
    if (fontSettings.opsz !== undefined) {
      style['--opsz'] = fontSettings.opsz;
    }
    
    if (fontSettings.grad !== undefined) {
      style['--grad'] = fontSettings.grad;
    }
    
    // Handle custom axes
    if (fontSettings.custom) {
      Object.entries(fontSettings.custom).forEach(([axis, value]) => {
        style[`--${axis}`] = value;
      });
    }
    
    // Apply font-variation-settings
    const variations = [];
    if (fontSettings.wght !== undefined) variations.push(`"wght" var(--wght)`);
    if (fontSettings.wdth !== undefined) variations.push(`"wdth" var(--wdth)`);
    if (fontSettings.slnt !== undefined) variations.push(`"slnt" var(--slnt)`);
    if (fontSettings.ital !== undefined) variations.push(`"ital" var(--ital)`);
    if (fontSettings.opsz !== undefined) variations.push(`"opsz" var(--opsz)`);
    if (fontSettings.grad !== undefined) variations.push(`"grad" var(--grad)`);
    
    if (fontSettings.custom) {
      Object.keys(fontSettings.custom).forEach(axis => {
        variations.push(`"${axis}" var(--${axis})`);
      });
    }
    
    if (variations.length > 0) {
      style.fontVariationSettings = variations.join(', ');
    }
    
    return style;
  };
  
  // Prepare container class names
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
      
      // Vertical alignment (using justify for column flexbox)
    'justify-start': verticalAlignment === 'top',
    'justify-center': verticalAlignment === 'center',
    'justify-end': verticalAlignment === 'bottom',
    
      // Flex container settings
      'flex flex-col': true,
    },
    className
  );
  
  // Prepare content layout class
  const contentLayoutClass = classNames(
    'content-wrapper relative z-10',
    {
      // Add margin based on content media position if present
      'mt-4': contentImage?.position === 'above' || contentVideo?.position === 'above',
      'mb-4': contentImage?.position === 'below' || contentVideo?.position === 'below',
      'ml-4': contentImage?.position === 'left' || contentVideo?.position === 'left',
      'mr-4': contentImage?.position === 'right' || contentVideo?.position === 'right',
      
      // Use flex for side-by-side layout
      'flex flex-col': (!contentImage?.position && !contentVideo?.position) || (contentImage?.position === 'below' || contentVideo?.position === 'below'),
      'flex flex-col-reverse': contentImage?.position === 'above' || contentVideo?.position === 'above',
      'flex flex-row-reverse gap-4': contentImage?.position === 'left' || contentVideo?.position === 'left',
      'flex flex-row gap-4': contentImage?.position === 'right' || contentVideo?.position === 'right',


    },
    contentClassName
  );
  
  // Base inline styles for container
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
  
  // Add typography styles if provided
  if (fontFamily) containerStyle.fontFamily = fontFamily;
  if (fontWeight) containerStyle.fontWeight = fontWeight;
  if (fontSize) containerStyle.fontSize = fontSize;
  if (lineHeight) containerStyle.lineHeight = lineHeight;
  if (letterSpacing) containerStyle.letterSpacing = letterSpacing;

  // Create a specific style for the content wrapper
const contentWrapperStyle: React.CSSProperties = {
  // Position the content at top, center, or bottom
  marginTop: verticalAlignment === 'top' ? 0 : 
            verticalAlignment === 'center' ? 'auto' : 0,
  marginBottom: verticalAlignment === 'bottom' ? 0 : 
               verticalAlignment === 'center' ? 'auto' : 0,
  display: 'flex',
  flexDirection: 'column',
  width: '100%'
};
  
  return (
    <div 
      ref={containerRef}
      id={id}
      className={containerClasses}
      style={containerStyle}
      onClick={onClick}
      data-component={id}
    >
      {/* Background video if provided */}
      {backgroundVideo && (
        <div className="absolute inset-0 w-full h-full overflow-hidden">
          <video
            className="w-full h-full object-cover"
            src={getAssetPath(backgroundVideo)}
            autoPlay
            loop
            muted
            playsInline
          />
        </div>
      )}
      
      {/* Glassmorphism overlay */}
      {glassmorphism && (
        <div className="absolute inset-0 bg-white/30 backdrop-blur-sm" />
      )}
      
      {/* Content section */}
      <div 
        ref={contentRef}
        className={contentLayoutClass}
        style={contentWrapperStyle}
      >
        {/* If content media is positioned above text */}
        {((contentImage?.position === 'above' || contentVideo?.position === 'above')) && (
          <div className="media-container mb-4">
            {contentImage?.position === 'above' && (
              <figure className={classNames('media-figure', contentImage.className)}>
                <img 
                  ref={imageRef}
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
            )}
            
            {contentVideo?.position === 'above' && (
              <figure className={classNames('media-figure', contentVideo.className)}>
                <video
                  ref={videoRef}
                  src={getAssetPath(contentVideo.src)}
                  autoPlay={contentVideo.autoPlay}
                  loop={contentVideo.loop}
                  muted={contentVideo.muted}
                  controls={contentVideo.controls}
                  playsInline
                  style={{
                    width: contentVideo.width || '100%',
                    height: contentVideo.height || 'auto',
                  }}
                  className="max-w-full"
                />
                {contentVideo.caption && (
                  <figcaption className="text-sm mt-2 opacity-75">{contentVideo.caption}</figcaption>
                )}
              </figure>
            )}
          </div>
        )}
        
        {/* Text content */}
        <div className="text-content">
          {title && (
            <h3 
              ref={titleRef}
              className={classNames('font-bold mb-2', titleClassName || 'text-2xl')}
            >
              {title}
            </h3>
          )}
          
          {subtitle && (
            <h4 className={classNames('!text-center text-xl md:text-2xl font-light mb-0 opacity-80', subtitleClassName || 'text-lg')}>
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
        
        {/* If content media is positioned below text */}
        {(contentImage?.position === 'below' || contentVideo?.position === 'below') && (
          <div className="media-container mt-4">
            {contentImage?.position === 'below' && (
              <figure className={classNames('media-figure', contentImage.className)}>
                <img 
                  ref={imageRef}
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
            )}
            
            {contentVideo?.position === 'below' && (
              <figure className={classNames('media-figure', contentVideo.className)}>
                <video
                  ref={videoRef}
                  src={getAssetPath(contentVideo.src)}
                  autoPlay={contentVideo.autoPlay}
                  loop={contentVideo.loop}
                  muted={contentVideo.muted}
                  controls={contentVideo.controls}
                  playsInline
                  style={{
                    width: contentVideo.width || '100%',
                    height: contentVideo.height || 'auto',
                  }}
                  className="max-w-full"
                />
                {contentVideo.caption && (
                  <figcaption className="text-sm mt-2 opacity-75">{contentVideo.caption}</figcaption>
                )}
              </figure>
            )}
          </div>
        )}
      </div>
      
      {/* Side positioned media (left or right) is handled by flex layout classes */}
      {contentImage?.position === 'left' && (
        <figure className={classNames('media-figure', contentImage.className)}>
          <img 
            ref={imageRef}
            src={getAssetPath(contentImage.src)}
            alt={contentImage.alt || title || 'Content image'} 
            style={{
              width: contentImage.width || '30%',
              height: contentImage.height || 'auto',
            }}
            className="max-w-full object-contain"
          />
          {contentImage.caption && (
            <figcaption className="text-sm mt-2 opacity-75">{contentImage.caption}</figcaption>
          )}
        </figure>
      )}
      
      {contentImage?.position === 'right' && (
        <figure className={classNames('media-figure', contentImage.className)}>
          <img 
            ref={imageRef}
            src={getAssetPath(contentImage.src)}
            alt={contentImage.alt || title || 'Content image'} 
            style={{
              width: contentImage.width || '30%',
              height: contentImage.height || 'auto',
            }}
            className="max-w-full object-contain"
          />
          {contentImage.caption && (
            <figcaption className="text-sm mt-2 opacity-75">{contentImage.caption}</figcaption>
          )}
        </figure>
      )}
      
      {contentVideo?.position === 'left' && (
        <figure className={classNames('media-figure', contentVideo.className)}>
          <video
            ref={videoRef}
            src={getAssetPath(contentVideo.src)}
            autoPlay={contentVideo.autoPlay}
            loop={contentVideo.loop}
            muted={contentVideo.muted}
            controls={contentVideo.controls}
            playsInline
            style={{
              width: contentVideo.width || '30%',
              height: contentVideo.height || 'auto',
            }}
            className="max-w-full"
          />
          {contentVideo.caption && (
            <figcaption className="text-sm mt-2 opacity-75">{contentVideo.caption}</figcaption>
          )}
        </figure>
      )}
      
      {contentVideo?.position === 'right' && (
        <figure className={classNames('media-figure', contentVideo.className)}>
          <video
            ref={videoRef}
            src={getAssetPath(contentVideo.src)}
            autoPlay={contentVideo.autoPlay}
            loop={contentVideo.loop}
            muted={contentVideo.muted}
            controls={contentVideo.controls}
            playsInline
            style={{
              width: contentVideo.width || '30%',
              height: contentVideo.height || 'auto',
            }}
            className="max-w-full"
          />
          {contentVideo.caption && (
            <figcaption className="text-sm mt-2 opacity-75">{contentVideo.caption}</figcaption>
          )}
        </figure>
      )}
    </div>
  );
};

export default ContentContainer;