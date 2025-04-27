import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';

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
  const [scrollProgress, setScrollProgress] = useState<number>(0);
  const [isScrolling, setIsScrolling] = useState<boolean>(false);
  
  // Use refs to avoid dependency issues in useEffect
  const lastScrollYRef = useRef<number>(0);
  const scrollTimerRef = useRef<number | null>(null);
  
  // Register a section - using useCallback to prevent recreating on each render
  const registerSection = useCallback((id: string, type: 'vertical' | 'horizontal' | 'carousel', element: HTMLElement) => {
    setSections(prev => {
      // Check if section already exists
      const existing = prev.find(section => section.id === id);
      if (existing) {
        // Only update if element changed (avoid unnecessary re-renders)
        if (existing.element !== element) {
          return prev.map(section => 
            section.id === id 
              ? { ...section, type, element }
              : section
          );
        }
        return prev;
      }
      
      // Add new section
      return [...prev, { id, type, inView: false, element }];
    });
  }, []);
  
  // Unregister a section - using useCallback
  const unregisterSection = useCallback((id: string) => {
    setSections(prev => prev.filter(section => section.id !== id));
  }, []);
  
  // Set active section - using useCallback
  const setActiveSection = useCallback((id: string | null) => {
    if (id === null) {
      setActiveSectionState(null);
      return;
    }
    
    setSections(prev => {
      // Only update if the active state would change
      const sectionToActivate = prev.find(section => section.id === id);
      if (!sectionToActivate || sectionToActivate.inView) return prev;
      
      const updated = prev.map(section => ({
        ...section,
        inView: section.id === id
      }));
      
      const active = updated.find(section => section.id === id) || null;
      setActiveSectionState(active);
      
      return updated;
    });
  }, []);
  
  // Track scroll position and direction
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // Update scroll direction
      if (currentScrollY > lastScrollYRef.current) {
        setScrollDirection('down');
      } else if (currentScrollY < lastScrollYRef.current) {
        setScrollDirection('up');
      }
      
      // Update scroll position
      setScrollY(currentScrollY);
      lastScrollYRef.current = currentScrollY;
      
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
      }, 150) as unknown as number;
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
  }, []); // Empty dependency array - no dependencies that change on render
  
  // Context value - memoize to prevent unnecessary renders
  const contextValue = React.useMemo(() => ({
    sections,
    activeSection,
    scrollDirection,
    scrollY,
    scrollProgress,
    isScrolling,
    registerSection,
    unregisterSection,
    setActiveSection
  }), [
    sections, 
    activeSection, 
    scrollDirection, 
    scrollY, 
    scrollProgress, 
    isScrolling,
    registerSection, 
    unregisterSection, 
    setActiveSection
  ]);
  
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