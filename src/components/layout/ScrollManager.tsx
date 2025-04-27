import React, { useEffect, ReactNode } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollProvider } from '../../context/ScrollContext';

// Register GSAP plugins
gsap.registerPlugin(ScrollTrigger);

interface ScrollManagerProps {
  children: ReactNode;
  showMarkers?: boolean;
}

const ScrollManager: React.FC<ScrollManagerProps> = ({ 
  children, 
  showMarkers = true
}) => {
  // Initialize GSAP ScrollTrigger
  useEffect(() => {
    // Set default ScrollTrigger settings
    ScrollTrigger.defaults({
      markers: showMarkers,
      scrub: 1, // Smooth scrubbing effect
    });
    
    // Clean up all ScrollTrigger instances on unmount
    return () => {
      const triggers = ScrollTrigger.getAll();
      triggers.forEach(trigger => trigger.kill());
    };
  }, [showMarkers]);
  
  return (
    <ScrollProvider>
      <div className="scroll-container overflow-x-hidden">
        {children}
      </div>
    </ScrollProvider>
  );
};

export default ScrollManager;
