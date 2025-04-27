import React, { useRef, useEffect, ReactNode } from 'react';
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
  background = '#333',
  height = '100vh',
  duration = 1,
  scrub = 0.5,
  showMarkers = false,
}) => {
  const sectionRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const section = sectionRef.current;
    const trigger = triggerRef.current;
    
    if (!section || !trigger) return;
    
    // Get all panels within this specific section
    let panels = gsap.utils.toArray<HTMLElement>(
      `#${id} .horizontal-panel`
    );
    
    console.log(`${id} - Found ${panels.length} panels`);
    
    // Create a timeline for horizontal scrolling
    let tl = gsap.timeline({
      scrollTrigger: {
        trigger: trigger,
        pin: true,
        scrub: scrub,
        start: 'top top',
        end: () => `+=${section.offsetWidth}`,
        invalidateOnRefresh: true,
        markers: showMarkers,
        onUpdate: (self) => {
          // Log progress occasionally
          if (Math.round(self.progress * 100) % 20 === 0) {
            console.log(`${id} - Progress: ${self.progress.toFixed(2)}`);
          }
        }
      }
    });
    
    // Animate panels horizontally
    tl.to(panels, {
      x: () => -section.offsetWidth + window.innerWidth,
      ease: "none",
      duration: duration
    });
    
    return () => {
      if (tl.scrollTrigger) {
        tl.scrollTrigger.kill();
      }
    };
  }, [id, scrub, duration, showMarkers]);
  
  return (
    <div 
      ref={triggerRef} 
      className={classNames("horizontal-trigger", className)}
      style={{ 
        height: height, 
        width: '100%', 
        position: 'relative',
        overflowX: 'hidden'
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
          backgroundColor: background
        }}
      >
        {children}
      </section>
    </div>
  );
};

export default HorizontalSection;