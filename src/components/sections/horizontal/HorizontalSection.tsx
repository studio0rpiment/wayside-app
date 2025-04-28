// HorizontalSection.tsx
import React, { useRef, useLayoutEffect, ReactNode } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import classNames from 'classnames';

interface HorizontalSectionProps {
  id: string;
  children: ReactNode;
  className?: string;
  background?: string;
  height?: string | number;
  duration?: number;
  scrub?: number | boolean;
  showMarkers?: boolean;
}

const HorizontalSection: React.FC<HorizontalSectionProps> = ({
  id,
  children,
  className = '',
  background = 'var(--color-dark)',
  height = '100vh',
  duration = 1,
  scrub = 0.5,
  showMarkers = false,
}) => {
  const sectionRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  
  useLayoutEffect(() => {
    // Register ScrollTrigger plugin to ensure it's available
    gsap.registerPlugin(ScrollTrigger);
    
    // Create a context that will properly clean up on unmount
    let ctx = gsap.context(() => {
      const section = sectionRef.current;
      const trigger = triggerRef.current;
      
      if (!section || !trigger) return;
      
      // Get all panels within this specific section
      let panels = gsap.utils.toArray<HTMLElement>(
        `#${id} .horizontal-panel`
      );
      
      console.log(`${id} - Found ${panels.length} panels`);
      
      // Make sure ScrollTrigger is refreshed on page load
      ScrollTrigger.refresh();
      
      // Create a timeline for horizontal scrolling
      let tl = gsap.timeline({
        scrollTrigger: {
          trigger: trigger,
          pin: true,
          scrub: scrub,
          start: 'top top', // Start when top of trigger reaches top of viewport
          end: () => `+=${section.offsetWidth - window.innerWidth}`, // More accurate end calculation
          invalidateOnRefresh: true,
          markers: showMarkers,
          anticipatePin: 1, // Helps with smoother pinning
          fastScrollEnd: true, // Improves performance
          onUpdate: (self) => {
            // Log progress occasionally
            if (Math.round(self.progress * 100) % 20 === 0) {
              console.log(`${id} - Progress: ${self.progress.toFixed(2)}`);
            }
          }
        }
      });
      
      // Animate panels horizontally with improved calculation
      tl.to(panels, {
        x: () => -(section.offsetWidth - window.innerWidth),
        ease: "none",
        duration: duration
      });
      
      // Add a resize listener to ensure ScrollTrigger stays accurate
      const handleResize = () => {
        ScrollTrigger.refresh(true);
      };
      
      window.addEventListener('resize', handleResize);
      
      // Return a cleanup function that removes event listener
      return () => {
        window.removeEventListener('resize', handleResize);
      };
    }, triggerRef); // Scope to your component
    
    // Clean up the context when component unmounts
    return () => ctx.revert();
  }, [id, scrub, duration, showMarkers]); // Dependencies
  
  return (
    <div 
      ref={triggerRef} 
      className={classNames("horizontal-trigger", className)}
      style={{ 
        height, 
        width: '100%', 
        position: 'relative',
        overflow: 'hidden', // Use overflow instead of overflowX for better cross-browser support
        willChange: 'transform' // Performance optimization
      }}
    >
      <section 
        ref={sectionRef}
        id={id}
        className="horizontal-section"
        style={{ 
          height: '100%',
          width: 'fit-content',
          position: 'absolute',
          display: 'flex',
          backgroundColor: background,
          left: 0, // Explicitly set left position
          top: 0 // Explicitly set top position
        }}
      >
        {children}
      </section>
    </div>
  );
};

export default HorizontalSection;