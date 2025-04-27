#!/bin/bash

# Navigate to the project directory
cd scrolling-maze

# Create context directory if it doesn't exist
mkdir -p src/context

# Create ScrollContext.tsx for state management
cat > src/context/ScrollContext.tsx << 'EOF'
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Define scroll direction type
type ScrollDirection = 'up' | 'down' | 'none';

// Define section type
interface ScrollSection {
  id: string;
  type: 'vertical' | 'horizontal' | 'carousel';
  inView: boolean;
  element: HTMLElement | null;
}

// Define context type
interface ScrollContextType {
  sections: ScrollSection[];
  activeSection: ScrollSection | null;
  scrollDirection: ScrollDirection;
  scrollY: number;
  scrollProgress: number;
  isScrolling: boolean;
  registerSection: (id: string, type: 'vertical' | 'horizontal' | 'carousel', element: HTMLElement) => void;
  unregisterSection: (id: string) => void;
  setActiveSection: (id: string | null) => void;
}

// Create the context
const ScrollContext = createContext<ScrollContextType | null>(null);

interface ScrollProviderProps {
  children: ReactNode;
}

export const ScrollProvider: React.FC<ScrollProviderProps> = ({ children }) => {
  // Sections state
  const [sections, setSections] = useState<ScrollSection[]>([]);
  const [activeSection, setActiveSectionState] = useState<ScrollSection | null>(null);
  
  // Scroll state
  const [scrollY, setScrollY] = useState<number>(0);
  const [scrollDirection, setScrollDirection] = useState<ScrollDirection>('none');
  const [lastScrollY, setLastScrollY] = useState<number>(0);
  const [scrollProgress, setScrollProgress] = useState<number>(0);
  const [isScrolling, setIsScrolling] = useState<boolean>(false);
  
  // Scroll timer for detecting when scrolling stops
  const scrollTimerRef = React.useRef<number | null>(null);
  
  // Register a section
  const registerSection = (id: string, type: 'vertical' | 'horizontal' | 'carousel', element: HTMLElement) => {
    setSections(prev => {
      // Check if section already exists
      const existing = prev.find(section => section.id === id);
      if (existing) {
        return prev.map(section => 
          section.id === id 
            ? { ...section, type, element }
            : section
        );
      }
      
      // Add new section
      return [...prev, { id, type, inView: false, element }];
    });
  };
  
  // Unregister a section
  const unregisterSection = (id: string) => {
    setSections(prev => prev.filter(section => section.id !== id));
  };
  
  // Set active section
  const setActiveSection = (id: string | null) => {
    if (id === null) {
      setActiveSectionState(null);
      return;
    }
    
    setSections(prev => {
      const updated = prev.map(section => ({
        ...section,
        inView: section.id === id
      }));
      
      const active = updated.find(section => section.id === id) || null;
      setActiveSectionState(active);
      
      return updated;
    });
  };
  
  // Track scroll position and direction
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // Update scroll direction
      if (currentScrollY > lastScrollY) {
        setScrollDirection('down');
      } else if (currentScrollY < lastScrollY) {
        setScrollDirection('up');
      }
      
      // Update scroll position
      setScrollY(currentScrollY);
      setLastScrollY(currentScrollY);
      
      // Calculate scroll progress (0-100%)
      const maxScroll = document.body.scrollHeight - window.innerHeight;
      const progress = maxScroll > 0 ? (currentScrollY / maxScroll) * 100 : 0;
      setScrollProgress(progress);
      
      // Set scrolling state
      setIsScrolling(true);
      
      // Clear previous timer
      if (scrollTimerRef.current !== null) {
        window.clearTimeout(scrollTimerRef.current);
      }
      
      // Set new timer
      scrollTimerRef.current = window.setTimeout(() => {
        setIsScrolling(false);
      }, 150);
    };
    
    // Add scroll listener
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    // Initial scroll position
    handleScroll();
    
    // Clean up
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollTimerRef.current !== null) {
        window.clearTimeout(scrollTimerRef.current);
      }
    };
  }, [lastScrollY]);
  
  // Context value
  const contextValue: ScrollContextType = {
    sections,
    activeSection,
    scrollDirection,
    scrollY,
    scrollProgress,
    isScrolling,
    registerSection,
    unregisterSection,
    setActiveSection
  };
  
  return (
    <ScrollContext.Provider value={contextValue}>
      {children}
    </ScrollContext.Provider>
  );
};

// Hook to use the scroll context
export const useScroll = () => {
  const context = useContext(ScrollContext);
  if (context === null) {
    throw new Error('useScroll must be used within a ScrollProvider');
  }
  return context;
};
EOF

# Create an improved ScrollManager that uses ScrollContext
cat > src/components/layout/ScrollManager.tsx << 'EOF'
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
EOF

# Create hooks directory if it doesn't exist
mkdir -p src/hooks

# Create a useScrollSection hook to connect sections to ScrollContext
cat > src/hooks/useScrollSection.ts << 'EOF'
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
EOF

echo "Scroll management components setup complete!"
echo "Created: ScrollContext.tsx, ScrollManager.tsx, and useScrollSection.ts"
