import { useRef, useEffect } from 'react';
import { useScroll } from '../context/ScrollContext';

/**
 * Hook to register a scroll section with the ScrollContext
 * @param id Section ID
 * @param type Section type ('vertical', 'horizontal', or 'carousel')
 * @returns Reference to the section element
 */
const useScrollSection = (
  id: string, 
  type: 'vertical' | 'horizontal' | 'carousel'
) => {
  const { registerSection, unregisterSection, setActiveSection } = useScroll();
  const sectionRef = useRef<HTMLDivElement>(null);
  
  // Register and unregister the section
  useEffect(() => {
    if (!sectionRef.current) return;
    
    // Register the section
    registerSection(id, type, sectionRef.current);
    
    // Create intersection observer to detect when section is in view
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setActiveSection(id);
        }
      },
      { threshold: 0.3 } // Trigger when 30% of the section is visible
    );
    
    // Observe the section
    observer.observe(sectionRef.current);
    
    // Clean up
    return () => {
      if (sectionRef.current) {
        observer.unobserve(sectionRef.current);
      }
      unregisterSection(id);
    };
  }, [id, type, registerSection, unregisterSection, setActiveSection]);
  
  return sectionRef;
};

export default useScrollSection;
