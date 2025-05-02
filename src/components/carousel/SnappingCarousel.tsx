import React, { useRef, useEffect, ReactNode, useState } from 'react';
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
  currentCard?: string | number;
}

const SnappingCarousel: React.FC<CarouselProps> = ({
  id,
  title,
  background = '#222',
  children,
  className = '',
  height = '100vh',
  cardHeight = '80%',
  currentCard,
}) => {
  const sectionRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const [cardCount, setCardCount] = useState(0);
  
  // Setup the initial timeline and scroll triggers
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
    const count = cards.length;
    setCardCount(count);

    // Calculate snap points - one for each card
    const snapPoints = [];
    for (let i = 0; i < count; i++) {
      // Create snap points at each card position (0 to 1 range)
      snapPoints.push(i / (count - 1));
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
    
    // Store the timeline in a ref for later use
    timelineRef.current = tl;
    
    // Animate all cards horizontally
    tl.to(cards, {
      x: () => -section.offsetWidth + window.innerWidth,
      ease: "none",
      duration: 1
    });
    
    // Apply a scale effect to centered cards
    cards.forEach((card, i) => {
      const progress = i / (count - 1);
      
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
  
  // Handle currentCard changes separately from the initial setup
  useEffect(() => {
    if (currentCard !== undefined && cardCount > 0 && timelineRef.current?.scrollTrigger) {
      const cardIndex = typeof currentCard === 'string' ? parseInt(currentCard, 10) - 1 : currentCard - 1;
      if (cardIndex >= 0 && cardIndex < cardCount) {
        const progress = cardIndex / (cardCount - 1);
        // Navigate to the specified card
        timelineRef.current.scrollTrigger.scroll(progress);
      }
    }
  }, [currentCard, cardCount]);
  
  return (
    <div 
      ref={triggerRef} 
      className={classNames("carousel-trigger", className)}
      style={{ 
        fontFamily: "'rigby', sans-serif",
        
        height: height, 
        width: '100%', 
        position: 'relative',
        overflowX: 'hidden',
        backgroundColor: background
      }}
    >
      {title && (
        <div className="carousel-title"
          style={{
            padding: '1rem 0rem 0rem 1rem',
            fontSize: '1.3rem',
          }}
        >
              {title}
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
      <div 
      className='scrollup flex items-center justify-center'
      style={{
        position: 'absolute',
        bottom: '10px',
        width: '100%',
        textAlign: 'center',
        fontSize: '1rem',
        fontWeight: 'bold',
        color: '#333',
        padding: '10px 0',
      }}
    >
          <p>  
          <span className="mr-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 15l-6-6-6 6"/>
                  </svg>
                </span>
            Swipe Up to Continue 
                <span className="mr-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 15l-6-6-6 6"/>
                  </svg>
            </span>
            
            </p>

        </div>

    </div>
  );
};

export default SnappingCarousel;