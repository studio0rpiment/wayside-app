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
  cardHeight?: string | number;
}

const SnappingCarousel: React.FC<CarouselProps> = ({
  id,
  title,
  background = '#222',
  children,
  className = '',
  height = '100vh',
  cardHeight = '80%',
}) => {
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
    
    // Get all cards
    let cards = gsap.utils.toArray<HTMLElement>(`#${id} .carousel-card`);
    const cardCount = cards.length;
    console.log(`${id} - Found ${cardCount} cards`);

    // Calculate snap points - one for each card
    const snapPoints = [];
    for (let i = 0; i < cardCount; i++) {
      // Create snap points at each card position (0 to 1 range)
      snapPoints.push(i / (cardCount - 1));
    }
    
    // Create the timeline for scrolling
    let tl = gsap.timeline({
      scrollTrigger: {
        trigger: trigger,
        pin: true,
        scrub: 1, // Slightly higher scrub for smoother snapping
        start: 'top top',
        end: () => `+=${section.offsetWidth}`,
        invalidateOnRefresh: true,
        markers: false,
        snap: {
          snapTo: snapPoints, // Snap to these points
          duration: { min: 0.1, max: 0.3 }, // Snap duration
          delay: 0.1, // Small delay before snapping
          ease: "power1.inOut" // Smooth easing for snap
        }
      }
    });
    
    // Animate all cards horizontally
    tl.to(cards, {
      x: () => -section.offsetWidth + window.innerWidth,
      ease: "none",
      duration: 1
    });
    
    // Apply a scale effect to centered cards
    cards.forEach((card, i) => {
      const progress = i / (cardCount - 1);
      
      // Create a separate timeline for each card's scale effect
      gsap.timeline({
        scrollTrigger: {
          trigger: trigger,
          start: 'top top',
          end: () => `+=${section.offsetWidth}`,
          scrub: true,
          onUpdate: (self) => {
            // Calculate how close this card is to center
            const cardCenterPoint = progress;
            const distanceFromCenter = Math.abs(self.progress - cardCenterPoint);
            
            // Scale cards based on how close they are to center
            // Cards at center get scale 1, cards further away get smaller
            const scale = gsap.utils.clamp(0.9, 1.05, 1 - distanceFromCenter * 0.3);
            gsap.set(card, { scale: scale });
          }
        }
      });
    });
    
    return () => {
      if (tl.scrollTrigger) {
        tl.scrollTrigger.kill();
      }
      // Kill all other ScrollTrigger instances for this section
      ScrollTrigger.getAll().forEach(trigger => {
        if (trigger.vars.trigger === triggerRef.current) {
          trigger.kill();
        }
      });
    };
  }, [id, cardHeight]);
  
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
          <h2 className="text-4xl font-bold text-white mb-6">{title}</h2>
        </div>
      )}
      
      <section 
        ref={sectionRef}
        id={id}
        className="carousel-section flex items-center justify-center"
        style={{ 
          height: title ? 'calc(100% - 100px)' : '100%',
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

export default SnappingCarousel;