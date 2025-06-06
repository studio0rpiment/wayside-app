// src/components/GradientElement.tsx

import React, { ReactNode } from 'react';

interface CustomGradientElementProps {
  color?: string;
  direction?: string;
  gradientType?: 'linear' | 'radial' | 'conic' | 'repeating-linear' | 'repeating-radial' | 'blocks' | 'aurora';
  position?: string;
  shape?: 'circle' | 'ellipse';
  size?: string;
  angle?: string;
  
  blockSize?: number;
  isText?: boolean;
  children: ReactNode;
  className?: string;
  tag?: keyof JSX.IntrinsicElements;
  animationDuration?: string;
}

const GradientElement: React.FC<CustomGradientElementProps> = ({ 
  color = 'var(--color-dark)',
  direction = 'to right', 
  gradientType = 'linear',
  position = 'center',
  shape = 'circle',
  size = 'farthest-corner',
  angle = '',

  blockSize = 30,
  isText = false,
  children, 
  className = '',
  tag = 'div',
  animationDuration = '20s'
}) => { 
  let backgroundStyle: React.CSSProperties = {};
  
  if (color.startsWith('gradient(')) {
    const gradientContent = color.substring(9, color.length - 1);
    let colors = gradientContent.split(',').map(c => c.trim());
    
    if (colors.length >= 2) {
      // Enhanced colors for smooth transitions (except special cases)
      if (!color.includes('%') && gradientType !== 'conic' && gradientType !== 'blocks' && gradientType !== 'aurora') {
        const enhancedColors: string[] = [];
        enhancedColors.push(`${colors[0]} 0%`, `${colors[0]} 10%`);
        
        for (let i = 1; i < colors.length - 1; i++) {
          const position = (i / (colors.length - 1)) * 100;
          enhancedColors.push(
            `${colors[i-1]} ${position - 15}%`,
            `${colors[i]} ${position}%`,
            `${colors[i]} ${position + 15}%`
          );
        }
        
        enhancedColors.push(`${colors[colors.length-1]} 90%`, `${colors[colors.length-1]} 100%`);
        colors = enhancedColors;
      }
      
      // Create gradients based on type
      switch (gradientType) {
        case 'blocks':
          const backgrounds: string[] = [];
          colors.forEach((color) => {
            const xPos = Math.floor(Math.random() * 100);
            const yPos = Math.floor(Math.random() * 100);
            backgrounds.push(
              `radial-gradient(circle ${blockSize}vw at ${xPos}% ${yPos}%, ${color} 0%, transparent 70%)`
            );
          });
          
          backgroundStyle = {
            backgroundColor: colors[colors.length - 1],
            backgroundImage: backgrounds.join(', '),
            backgroundSize: '100% 100%',
            backgroundRepeat: 'no-repeat'
          };
          break;
          
        case 'aurora':
          const auroraPositions = [
            { x: 20, y: 15 }, { x: 45, y: 60 }, { x: 70, y: 55 }, { x: 85, y: 75 }
          ];
          
          const auroraBackgrounds: string[] = [];
          colors.forEach((color, index) => {
            const pos = auroraPositions[index % auroraPositions.length];
            auroraBackgrounds.push(
              `radial-gradient(circle ${blockSize}vw at ${pos.x}% ${pos.y}%, ${color} 0%, transparent 70%)`
            );
          });
          
          backgroundStyle = {
            backgroundColor: colors[colors.length - 1],
            backgroundImage: auroraBackgrounds.join(', '),
            backgroundSize: '200% 200%',
            backgroundRepeat: 'no-repeat',
            animationDuration: animationDuration
          };
          break;

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
  } else {
    backgroundStyle = { backgroundColor: color };
  }
  
  // Text gradient handling
  if (isText && backgroundStyle.backgroundImage) { 
    backgroundStyle.backgroundClip = 'text';
    backgroundStyle.WebkitBackgroundClip = 'text';
    backgroundStyle.color = 'transparent';
    backgroundStyle.WebkitTextFillColor = 'transparent';
  } 
  
  const animationClass = gradientType === 'aurora' ? 'aurora-animation' : '';
  const finalClassName = `${className} ${animationClass}`.trim();

  // Render based on tag
  if (tag === 'span') {
    return <span className={finalClassName} style={backgroundStyle}>{children}</span>;
  } else if (tag === 'h1') {
    return <h1 className={finalClassName} style={backgroundStyle}>{children}</h1>;
  } else if (tag === 'h2') {
    return <h2 className={finalClassName} style={backgroundStyle}>{children}</h2>;
  } else if (tag === 'h3') {
    return <h3 className={finalClassName} style={backgroundStyle}>{children}</h3>;
  } else if (tag === 'p') {
    return <p className={finalClassName} style={backgroundStyle}>{children}</p>;
  } else {
    return <div className={finalClassName} style={backgroundStyle}>{children}</div>;
  }
};

export default GradientElement;