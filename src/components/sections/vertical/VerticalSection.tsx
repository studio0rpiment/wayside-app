import React, { useRef, useEffect, ReactNode } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import classNames from 'classnames';

interface VerticalSectionProps {
  id: string;
  title?: string; // Made optional
  color: string;
  children?: ReactNode;
  className?: string;
  height?: string | number;
  minHeight?: string | number;
  fullHeight?: boolean;
  isScrollLocked?: boolean;
  backgroundImage?: string; // Changed to string type for URL or path
  backgroundSize?: string; // Added for control over background sizing
  backgroundPosition?: string; // Added for control over background positioning
  backgroundRepeat?: string; // Added for control over background repeating
}

const VerticalSection: React.FC<VerticalSectionProps> = ({
  id,
  title,
  color,
  children,
  className = '',
  height,
  minHeight = '100vh',
  fullHeight = true,
  isScrollLocked = false, // Default to false for normal scrolling
  backgroundImage,
  backgroundSize = 'cover',
  backgroundPosition = 'center center',
  backgroundRepeat = 'no-repeat',
}) => {
  const sectionRef = useRef<HTMLElement>(null);
  
  useEffect(() => {
    if (!sectionRef.current) return;
    
    const section = sectionRef.current;
    
    const trigger = ScrollTrigger.create({
      trigger: section,
      start: 'top 80%',
      end: 'bottom 20%',
      toggleClass: 'active',
      id: id,
      markers: false,
    });
    
    return () => {
      trigger.kill();
    };
  }, [id]);

  // Scroll locking functionality
  useEffect(() => {
    if (!isScrollLocked) return;
    
    // Handle wheel events
    const preventDownScroll = (e: WheelEvent) => {
      if (e.deltaY > 0) { // Scrolling down
        e.preventDefault();
        const rect = sectionRef.current?.getBoundingClientRect();
        // Only prevent if we're at or near the bottom of this section
        if (rect && Math.abs(rect.bottom - window.innerHeight) < 50) {
          window.scrollTo({
            top: sectionRef.current?.offsetTop || 0,
            behavior: 'auto'
          });
        }
      }
    };
    
    // Handle touch events for mobile
    let touchStartY = 0;
    const touchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY;
    };
    
    const touchMove = (e: TouchEvent) => {
      const touchY = e.touches[0].clientY;
      const direction = touchStartY - touchY;
      
      if (direction > 0) { // Scrolling down
        const rect = sectionRef.current?.getBoundingClientRect();
        // Only prevent if we're at or near the bottom of this section
        if (rect && Math.abs(rect.bottom - window.innerHeight) < 50) {
          e.preventDefault();
        }
      }
    };
    
    // Add event listeners with passive: false to allow preventDefault
    window.addEventListener('wheel', preventDownScroll, { passive: false });
    window.addEventListener('touchstart', touchStart, { passive: true });
    window.addEventListener('touchmove', touchMove, { passive: false });
    
    return () => {
      window.removeEventListener('wheel', preventDownScroll);
      window.removeEventListener('touchstart', touchStart);
      window.removeEventListener('touchmove', touchMove);
    };
  }, [isScrollLocked]);
  
  // Prepare background image style
  const backgroundImageStyle = backgroundImage 
    ? `url(${backgroundImage})` 
    : '';
  
  return (
    <section
      ref={sectionRef}
      id={id}
      className={classNames(
        'vertical-section w-full',
        fullHeight && !height ? 'min-h-screen' : '',
        className
      )}
      style={{ 
        backgroundColor: color,
        height: 'auto',
        minHeight: !height ? minHeight : undefined,
        maxWidth: '100vw',
        backgroundImage: backgroundImageStyle,
        backgroundSize: backgroundImage ? backgroundSize : undefined,
        backgroundPosition: backgroundImage ? backgroundPosition : undefined,
        backgroundRepeat: backgroundImage ? backgroundRepeat : undefined
      }}
      data-section-id={id}
    >
       {children}
    </section>
  );
};

export default VerticalSection;