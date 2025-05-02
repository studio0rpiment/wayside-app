import React from 'react';
import classNames from 'classnames';
import ContentContainer, { ContentContainerProps } from './ContentContainer';

export interface ButtonProps extends Omit<ContentContainerProps, 'children'> {
  href?: string;
  targetId?: string; // ID of component to scroll to
  targetAction?: string; // Custom action to trigger
  openInNewTab?: boolean;
  buttonClassName?: string;
  unlockScrolling?: boolean;
  onUnlock?: () => void; // Callback to notify parent component to unlock scrolling
  width?: string | number; // Added width property
  textSize?: string | number; // Added textSize property
  style?: React.CSSProperties; // Added style property for additional custom styling
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
  
  // ContentContainer props passed through
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
    // If this button should unlock scrolling, call the callback
    if (unlockScrolling && onUnlock) {
      onUnlock();
    }
    
    // Handle navigation after a small delay (allows unlock to take effect first)
    setTimeout(() => {
      if (targetId) {
        // Scroll to target element
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
    
    // Custom action handling could be added here
  };
  
  // Build custom style object
  const customStyle: React.CSSProperties = {
    ...(width !== undefined && { width }),
    ...(textSize !== undefined && { fontSize: textSize }),
    ...style // Merge any additional styles
  };
  
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
      style={customStyle} // Apply our custom styles
      {...otherProps}
    />
  );
};

export default Button;