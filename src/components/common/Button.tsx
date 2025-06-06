import React from 'react';
import classNames from 'classnames';
import ContentContainer, { ContentContainerProps } from './ContentContainer';
import GradientElement from '../../utils/GradientElement';

export interface ButtonProps extends Omit<ContentContainerProps, 'children'> {
 href?: string;
 targetId?: string;
 targetAction?: string;
 openInNewTab?: boolean;
 buttonClassName?: string;
 unlockScrolling?: boolean;
 onUnlock?: () => void;
 width?: string | number;
 textSize?: string | number;
 style?: React.CSSProperties;
}

const Button: React.FC<ButtonProps> = ({
 href,
 targetId,
 targetAction,
 openInNewTab,
 buttonClassName = '',
 unlockScrolling = false,
 onUnlock,
 width,
 textSize,
 style,
 
 // ContentContainer props
 title,
 subtitle,
 content,
 backgroundColor,
 backgroundImage,
 textColor,
 contentImage,
 hasShadow,
 interactive = true,
 hoverEffect = 'lift',
 className = '',
 ...otherProps
}) => {
 const handleClick = () => {
   if (unlockScrolling && onUnlock) {
     onUnlock();
   }
   
   setTimeout(() => {
     if (targetId) {
       const targetElement = document.getElementById(targetId);
       if (targetElement) {
         targetElement.scrollIntoView({ behavior: 'smooth' });
       }
     } else if (href) {
       if (openInNewTab) {
         window.open(href, '_blank');
       } else {
         window.location.href = href;
       }
     }
   }, 50);
 };
 
 const customStyle: React.CSSProperties = {
   ...(width !== undefined && { width }),
   ...(textSize !== undefined && { fontSize: textSize }),
   ...style
 };
 
 // Check for gradient
 const isGradient = textColor && textColor.startsWith('gradient(');
 
      if (isGradient) {
        const gradientContent = (
            <div style={{ 
            textAlign: 'center', 
            fontSize: textSize || '1.3rem',
            fontFamily: "'rigby', sans-serif",
            fontWeight: 'bold'
          }}>
            {title && (
              <GradientElement color={textColor} isText={true} tag="h4">
                {title}
              </GradientElement>
            )}
            {subtitle && (
              <GradientElement color={textColor} isText={true} tag="span">
                {subtitle}
              </GradientElement>
            )}
            {content}
          </div>
        );
   
   return (
     <ContentContainer
       content={gradientContent}
       backgroundColor={backgroundColor}
       backgroundImage={backgroundImage}
       contentImage={contentImage}
       hasShadow={hasShadow}
       interactive={interactive}
       hoverEffect={hoverEffect}
       className={classNames('cursor-pointer', className, buttonClassName)}
       onClick={handleClick}
       // style={customStyle}
       {...otherProps}
     />
   );
 }
 
 return (
   <ContentContainer
     title={title}
     subtitle={subtitle}
     content={content}
     backgroundColor={backgroundColor}
     backgroundImage={backgroundImage}
     textColor={textColor}
     contentImage={contentImage}
     hasShadow={hasShadow}
     interactive={interactive}
     hoverEffect={hoverEffect}
     className={classNames('cursor-pointer', className, buttonClassName)}
     onClick={handleClick}
     
     {...otherProps}
   />
 );
};

export default Button;