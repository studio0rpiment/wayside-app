import React, { useRef, useEffect, ReactNode } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import classNames from 'classnames';

interface CarouselProps {
  id: string;
  title?: string;
  background?: string;
  children: ReactNode;
  className?: string;
  height?: string | number;
}

const SimplifiedCarousel: React.FC<CarouselProps> = ({
  id,
  title,
  background = '#222',
  children,
  className = '',
  height = '100vh',
}) => {
  // Similar to the working horizontal section
  const sectionRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    // Register ScrollTrigger if not already registered
    if (!ScrollTrigger) {
      gsap.registerPlugin(ScrollTrigger);
    }
    
    const section = sectionRef.current;
    const trigger = triggerRef.current;
    
    if (!section || !trigger) return;
    
    // Create the timeline for scrolling - following exactly the pattern that worked
    let tl = gsap.timeline({
      scrollTrigger: {
        trigger: trigger,
        pin: true,
        scrub: 0.5,
        start: 'top top',
        end: () => `+=${section.offsetWidth}`,
        invalidateOnRefresh: true,
        markers: true,
      }
    });
    
    // Get all cards
    let cards = gsap.utils.toArray<HTMLElement>(`#${id} .carousel-card`);
    
    // Animate all cards horizontally
    tl.to(cards, {
      x: () => -section.offsetWidth + window.innerWidth,
      ease: "none",
      duration: 1
    });
    
    return () => {
      if (tl.scrollTrigger) {
        tl.scrollTrigger.kill();
      }
    };
  }, [id]);
  
  return (
    <div 
      ref={triggerRef} 
      className={classNames("carousel-trigger", className)}
      style={{ 
        height: height, 
        width: '100%', 
        position: 'relative',
        overflowX: 'hidden',
        backgroundColor: background
      }}
    >
      {title && (
        <div className="carousel-title p-6 text-center">
          <h2 className="text-4xl font-bold text-white">{title}</h2>
        </div>
      )}
      
      <section 
        ref={sectionRef}
        id={id}
        className="carousel-section"
        style={{ 
          height: title ? 'calc(100% - 80px)' : '100%',
          width: 'fit-content',
          position: 'absolute',
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'nowrap'
        }}
      >
        {children}
      </section>
    </div>
  );
};

export default SimplifiedCarousel;