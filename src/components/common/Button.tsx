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
}

const Button: React.FC<ButtonProps> = ({
  href,
  targetId,
  targetAction,
  openInNewTab,
  buttonClassName = '',
  unlockScrolling = false,
  onUnlock,
  
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