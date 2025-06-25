import React, { useState, useCallback, forwardRef, useImperativeHandle, useRef, useEffect } from 'react';
import { routePointsData } from '../../data/mapRouteData';
import { getAssetPath } from '../../utils/assetPaths';

// Define the exposed API interface
export interface ExperienceProgressTrackerRef {
  markComplete: (experienceId: string) => void;
  isComplete: (experienceId: string) => boolean;
  getCompletedCount: () => number;
  getCompletedIds: () => string[];
  updateMapDots: (markers: mapboxgl.Marker[]) => void;
  reset: () => void;
}

interface ExperienceProgressTrackerProps {
  onExperienceComplete?: (experienceId: string, totalCompleted: number) => void;
}

// Define experience data structure
interface ExperienceItem {
  id: string; // iconName (geofenceId)
  order: number; // 1-9 based on routePointsData id
  title: string;
  themeGroup: 'time' | 'seasons' | 'moments';
  color: string;
}



// Process routePointsData outside component to avoid recreation
const experiences: ExperienceItem[] = routePointsData.features
  .sort((a, b) => a.properties.id - b.properties.id)
  .map(feature => {
    const id = feature.properties.id;
    let themeGroup: 'time' | 'seasons' | 'moments';
    let color: string;
    
    if (id >= 1 && id <= 3) {
      themeGroup = 'time';
      color = 'var(--color-blue)';
    } else if (id >= 4 && id <= 6) {
      themeGroup = 'seasons';
      color = 'var(--color-green)';
    } else {
      themeGroup = 'moments';
      color = 'var(--color-pink)';
    }
    
    return {
      id: feature.properties.iconName,
      order: id,
      title: feature.properties.title,
      themeGroup,
      color
    };
  });



const ExperienceProgressTracker = forwardRef<ExperienceProgressTrackerRef, ExperienceProgressTrackerProps>(
  ({ onExperienceComplete }, ref) => {



  const prevOnExperienceComplete = useRef(onExperienceComplete);

      const markComplete = useCallback((experienceId: string) => {
    
      setCompletedExperiences(prev => {
        if (prev.has(experienceId)) {
         
          
          return prev; // Already completed
        }
        
        const newCompleted = new Set(prev);
        newCompleted.add(experienceId);
        
        
        
        // Notify parent
        if (onExperienceComplete) {
          onExperienceComplete(experienceId, newCompleted.size);
        }
        
        return newCompleted;
      });
    }, [onExperienceComplete]);


    useEffect(() => {
      if (prevOnExperienceComplete.current !== onExperienceComplete) {
     
        prevOnExperienceComplete.current = onExperienceComplete;
      }
    });

    // Listen for experience completion events
    useEffect(() => {
      const handleExperienceCompletion = (event: Event) => {
        const customEvent = event as CustomEvent;
        const { experienceId } = customEvent.detail;
        console.log('📊 ExperienceProgressTracker received completion event for:', experienceId);
        markComplete(experienceId);
      };

      document.addEventListener('experience-completed', handleExperienceCompletion);
      
      return () => {
        document.removeEventListener('experience-completed', handleExperienceCompletion);
      };
    }, [markComplete]);

 

    // Track completion state
    const [completedExperiences, setCompletedExperiences] = useState<Set<string>>(new Set());
    
    // Store markers reference for auto-updates
    const markersRef = useRef<mapboxgl.Marker[]>([]);
    
    // Double-tap handling
    const lastTapTime = useRef<{ [key: string]: number }>({});
    const doubleTapDelay = 300;

    // Debug completed experiences changes
    useEffect(() => {
      
    }, [completedExperiences]);

    // Get theme color for an experience based on its ID
    const getThemeColor = useCallback((experienceId: string) => {
      const experience = experiences.find(exp => exp.id === experienceId);
      return experience ? experience.color : 'var(--color-blue)';
    }, []);

    // Get the inverted icon path for a completed experience
    const getCompletedIconPath = useCallback((experienceId: string) => {
      return getAssetPath(`icons/${experienceId}_inv.svg`);
    }, []);

    // Create completion dot element
    const createCompletionDot = useCallback((experienceId: string) => {
      const dot = document.createElement('div');
      dot.className = 'completion-dot';
      dot.style.position = 'absolute';
      dot.style.top = '-4px';
      dot.style.right = '-4px';
      dot.style.width = '6px';
      dot.style.height = '6px';
      dot.style.borderRadius = '50%';
      dot.style.backgroundColor = getThemeColor(experienceId);
      dot.style.border = '0px';
      dot.style.display = 'none'; // Hidden by default
      dot.style.pointerEvents = 'none';
      dot.style.zIndex = '10';
      return dot;
    }, [getThemeColor]);

    // Update map completion dots
    const updateMapDots = useCallback((markers: mapboxgl.Marker[]) => {
      // Store markers for future auto-updates
      markersRef.current = markers;
      
      markers.forEach((marker, index) => {
        const point = routePointsData.features[index];
        const experienceId = point.properties.iconName;
        const isCompleted = completedExperiences.has(experienceId);
        
        const markerElement = marker.getElement();
        let dot = markerElement.querySelector('.completion-dot') as HTMLElement;
        
        // Create dot if it doesn't exist
        if (!dot) {
          dot = createCompletionDot(experienceId);
          markerElement.appendChild(dot);
        }
        
        // Update visibility
        dot.style.display = isCompleted ? 'block' : 'none';
      });
    }, [completedExperiences, createCompletionDot]);

    // Auto-update map dots when completion state changes
    useEffect(() => {
      if (markersRef.current.length > 0) {
        updateMapDots(markersRef.current);
      }
    }, [completedExperiences, updateMapDots]);

    // Mark experience as complete - stable function


    // Check if experience is complete
    const isComplete = useCallback((experienceId: string) => {
      return completedExperiences.has(experienceId);
    }, [completedExperiences]);

    // Get completed count
    const getCompletedCount = useCallback(() => {
      return completedExperiences.size;
    }, [completedExperiences]);

    // Get completed IDs array
    const getCompletedIds = useCallback(() => {
      return Array.from(completedExperiences);
    }, [completedExperiences]);

    // Reset all progress
    const reset = useCallback(() => {
      setCompletedExperiences(new Set());
    }, []);

    // Handle circle tap (double-tap resets completed circles)
    const handleCircleTap = useCallback((experienceId: string, isCompleted: boolean) => {
      if (!isCompleted) return;
      
      const now = Date.now();
      const lastTap = lastTapTime.current[experienceId] || 0;
      
      if (now - lastTap < doubleTapDelay) {
        // Double tap detected - reset this experience
        setCompletedExperiences(prev => {
          const newCompleted = new Set(prev);
          newCompleted.delete(experienceId);
          return newCompleted;
        });
        lastTapTime.current[experienceId] = 0;
      } else {
        lastTapTime.current[experienceId] = now;
      }
    }, []);

    // Expose API via ref - minimal dependencies
    useImperativeHandle(ref, () => ({
      markComplete,
      isComplete,
      getCompletedCount,
      getCompletedIds,
      updateMapDots,
      reset
    }), [markComplete, isComplete, getCompletedCount, getCompletedIds, updateMapDots, reset]);

    // Container styles
    const containerStyle: React.CSSProperties = {
      position: 'fixed',
      top: '0vh',
      left: '50%',
      transform: 'translateX(-50%)',
      width: '100%',
      height: '5svh',
      
      backdropFilter: 'blur(2px)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      gap: '8px',
      zIndex: 200,
      pointerEvents: 'auto',
      padding: '0 10px'
    };

    // Individual bubble styles
    const getBubbleStyle = useCallback((experience: ExperienceItem, isCompleted: boolean): React.CSSProperties => ({
      width: '22px',
      height: '22px',
      borderRadius: '50%',
      // border: `0.5px solid ${'var(--color-light)'}`,
      backgroundColor: isCompleted ? experience.color : 'var(--color-dark)', // Keep color as fallback
      backgroundImage: isCompleted ? `url(${getAssetPath(`icons/${experience.id}_inv.svg`)})` : 'none',
      backgroundSize: 'contain',
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'center',
      cursor: isCompleted ? 'pointer' : 'default',
      transition: 'background-color 200ms ease-in-out, background-image 200ms ease-in-out',
      flexShrink: 0,
      userSelect: 'none'
    }), [getCompletedIconPath]);

    // Icon error handler
    const handleIconError = useCallback((event: React.SyntheticEvent<HTMLDivElement>, experience: ExperienceItem) => {
      const target = event.currentTarget;
      // If icon fails to load, fall back to color fill
      target.style.backgroundImage = 'none';
      target.style.backgroundColor = experience.color;
    }, []);

    return (
      <div style={containerStyle}>
        {experiences.map(experience => {
          const isCompleted = completedExperiences.has(experience.id);
         

          return (
            <div
              key={experience.id}
              style={getBubbleStyle(experience, isCompleted)}
              onClick={() => handleCircleTap(experience.id, isCompleted)}
              onError={(e) => isCompleted && handleIconError(e, experience)}
              title={`${experience.title} ${isCompleted ? '(completed - double-tap to reset)' : '(not completed)'}`}
            />
          );
        })}
      </div>
    );
  }
);

ExperienceProgressTracker.displayName = 'ExperienceProgressTracker';

export default ExperienceProgressTracker;