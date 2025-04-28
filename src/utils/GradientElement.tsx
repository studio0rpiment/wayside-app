// src/components/GradientElement.tsx

import React, { ReactNode } from 'react';

interface GradientElementProps {
  color?: string; // Can be a simple color or gradient string
  direction?: string;
  gradientType?: 'linear' | 'radial' | 'conic' | 'repeating-linear' | 'repeating-radial' | 'blocks';
  position?: string; // For controlling centerpoint like "center" or "top left"
  shape?: 'circle' | 'ellipse'; // For radial gradients
  size?: string; // For radial gradients like "closest-side" or "farthest-corner"
  angle?: string; // For conic gradients like "from 45deg"
  blurAmount?: number; // How much to blur the gradient (0 for no blur)
  softTransition?: boolean; // Whether to soften color transitions
  blockSize?: number; // For block gradients - higher numbers mean larger blocks
  isText?: boolean;
  children: ReactNode;
  className?: string;
  tag?: string;
}

const GradientElement: React.FC<GradientElementProps> = ({ 
  color = 'var(--color-dark)',
  direction = 'to right', 
  gradientType = 'linear',
  position = 'center',
  shape = 'circle',
  size = 'farthest-corner',
  angle = '',
  blurAmount = 0,
  softTransition = false,
  blockSize = 30, // Default block size
  isText = false,
  children, 
  className = '',
  tag = 'div'
}) => { 
  // Parse the color prop
  let backgroundStyle: React.CSSProperties = {};
  
  if (color.startsWith('gradient(')) {
    // Extract colors from the gradient syntax
    const gradientContent = color.substring(9, color.length - 1);
    let colors = gradientContent.split(',').map(c => c.trim());
    
    if (colors.length >= 2) {
      // Different gradient types
      if (gradientType === 'blocks') {
        // Create a color blocks effect with soft edges
        // We use multiple background images to create the effect
        
        // For color blocks, we use multiple radial gradients with different positions
        const backgrounds: string[] = [];
        
        // Create a color point for each color
        colors.forEach((color, index) => {
          // Calculate random position for this color block
          const xPos = Math.floor(Math.random() * 100);
          const yPos = Math.floor(Math.random() * 100);
          
          // Create a radial gradient for this color
          // The size parameter controls how large the blocks are
          backgrounds.push(
            `radial-gradient(circle ${blockSize}vw at ${xPos}% ${yPos}%, ${color} 0%, transparent 70%)`
          );
        });
        
        // Add a base color (last color) to fill any gaps
        backgroundStyle = {
          backgroundColor: colors[colors.length - 1],
          backgroundImage: backgrounds.join(', '),
          backgroundSize: '100% 100%',
          backgroundRepeat: 'no-repeat'
        };
      } else if (softTransition && !color.includes('%') && gradientType !== 'conic') {
        // Create smoother transitions by adding percentage stops
        const enhancedColors: string[] = [];
        
        // For the first color, add a gradual start
        enhancedColors.push(`${colors[0]} 0%`);
        enhancedColors.push(`${colors[0]} 10%`);
        
        // For middle colors, add transition points
        for (let i = 1; i < colors.length - 1; i++) {
          const position = (i / (colors.length - 1)) * 100;
          const prevPosition = position - 15;
          const nextPosition = position + 15;
          
          // Add overlapping color stops for smoother blending
          enhancedColors.push(`${colors[i-1]} ${prevPosition}%`);
          enhancedColors.push(`${colors[i]} ${position}%`);
          enhancedColors.push(`${colors[i]} ${nextPosition}%`);
        }
        
        // For the last color, add a gradual end
        enhancedColors.push(`${colors[colors.length-1]} 90%`);
        enhancedColors.push(`${colors[colors.length-1]} 100%`);
        
        colors = enhancedColors;
        
        // Create the appropriate gradient based on type
        switch (gradientType) {
          case 'radial':
            backgroundStyle = {
              backgroundImage: `radial-gradient(${shape} ${size} at ${position}, ${colors.join(', ')})`
            };
            break;
          case 'repeating-linear':
            backgroundStyle = {
              backgroundImage: `repeating-linear-gradient(${direction}, ${colors.join(', ')})`
            };
            break;
          case 'repeating-radial':
            backgroundStyle = {
              backgroundImage: `repeating-radial-gradient(${shape} ${size} at ${position}, ${colors.join(', ')})`
            };
            break;
          default: // linear
            backgroundStyle = {
              backgroundImage: `linear-gradient(${direction}, ${colors.join(', ')})`
            };
        }
      } else {
        // Standard gradient creation without soft transition enhancement
        switch (gradientType) {
          case 'radial':
            backgroundStyle = {
              backgroundImage: `radial-gradient(${shape} ${size} at ${position}, ${colors.join(', ')})`
            };
            break;
          case 'conic':
            backgroundStyle = {
              backgroundImage: `conic-gradient(${angle ? angle + ' ' : ''}from ${position}, ${colors.join(', ')})`
            };
            break;
          case 'repeating-linear':
            backgroundStyle = {
              backgroundImage: `repeating-linear-gradient(${direction}, ${colors.join(', ')})`
            };
            break;
          case 'repeating-radial':
            backgroundStyle = {
              backgroundImage: `repeating-radial-gradient(${shape} ${size} at ${position}, ${colors.join(', ')})`
            };
            break;
          default: // linear
            backgroundStyle = {
              backgroundImage: `linear-gradient(${direction}, ${colors.join(', ')})`
            };
        }
      }
      
      // Add blur filter if specified
      if (blurAmount > 0) {
        backgroundStyle.filter = `blur(${blurAmount}px)`;
        
        // When using a blur filter, we need to slightly expand the element to avoid seeing edges
        backgroundStyle.margin = `-${blurAmount}px`;
        backgroundStyle.padding = `${blurAmount}px`;
      }
    }
  } else {
    // Use as a simple color
    backgroundStyle = { backgroundColor: color };
  }
  
  // Add text gradient properties if needed
  if (isText && backgroundStyle.backgroundImage) { 
    backgroundStyle.backgroundClip = 'text';
    backgroundStyle.WebkitBackgroundClip = 'text';
    backgroundStyle.color = 'transparent';
    backgroundStyle.WebkitTextFillColor = 'transparent';
    
    // Remove blur filter for text if it was applied
    if (backgroundStyle.filter && backgroundStyle.filter.includes('blur')) {
      delete backgroundStyle.filter;
      delete backgroundStyle.margin;
      delete backgroundStyle.padding;
    }
  } 
  
  // Render the appropriate element based on the tag prop
  if (tag === 'span') {
    return (
      <span className={className} style={backgroundStyle}>
        {children}
      </span>
    );
  } else if (tag === 'h1') {
    return (
      <h1 className={className} style={backgroundStyle}>
        {children}
      </h1>
    );
  } else if (tag === 'h2') {
    return (
      <h2 className={className} style={backgroundStyle}>
        {children}
      </h2>
    );
  } else if (tag === 'h3') {
    return (
      <h3 className={className} style={backgroundStyle}>
        {children}
      </h3>
    );
  } else if (tag === 'p') {
    return (
      <p className={className} style={backgroundStyle}>
        {children}
      </p>
    );
  } else {
    // Default to div
    return (
      <div className={className} style={backgroundStyle}>
        {children}
      </div>
    );
  }
};

export default GradientElement;