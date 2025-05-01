// src/components/ar/ARPortalExperience.tsx
import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import ARExperience from './ARExperience'; // Your existing component

interface ARPortalExperienceProps {
  experienceId: string;
  markerId: number;
  patternUrl?: string;
  onClose: () => void;
}

const ARPortalExperience: React.FC<ARPortalExperienceProps> = ({
  experienceId,
  markerId,
  patternUrl,
  onClose
}) => {
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
  
  // Create portal and disable GSAP
  useEffect(() => {
    // Disable GSAP animations
    const gsap = window.gsap;
    const ScrollTrigger = gsap?.ScrollTrigger;
    const disabledTriggers: any[] = [];
    
    if (ScrollTrigger) {
      console.log('Disabling GSAP ScrollTrigger for AR experience');
      const allTriggers = ScrollTrigger.getAll();
      allTriggers.forEach((trigger: { enabled: () => any; disable: () => void; }) => {
        if (trigger.enabled()) {
          disabledTriggers.push(trigger);
          trigger.disable();
        }
      });
    }
    
    // Create a container outside the React DOM tree
    const container = document.createElement('div');
    container.id = 'ar-portal-container';
    container.style.position = 'fixed';
    container.style.top = '0';
    container.style.left = '0';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.zIndex = '1000';
    document.body.appendChild(container);
    
    setPortalContainer(container);
    
    return () => {
      // Clean up GSAP
      disabledTriggers.forEach(trigger => {
        if (trigger && typeof trigger.enable === 'function') {
          trigger.enable();
        }
      });
      
      // Clean up portal
      if (document.body.contains(container)) {
        document.body.removeChild(container);
      }
    };
  }, []);
  
  if (!portalContainer) return null;
  
  return ReactDOM.createPortal(
    <div style={{ width: '100%', height: '100%' }}>
      {/* Use your existing ARExperience component */}
      <ARExperience
        experienceId={experienceId}
        markerId={markerId}
        patternUrl={patternUrl}
        instructions={`Point your camera at Marker #${markerId}`}
      />
      
      <button 
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          zIndex: 1001,
          padding: '12px 20px',
          background: 'rgba(255, 255, 255, 0.8)',
          border: 'none',
          borderRadius: '5px',
          fontSize: '16px',
          cursor: 'pointer'
        }}
        onClick={onClose}
      >
        Close AR Demo
      </button>
    </div>,
    portalContainer
  );
};

export default ARPortalExperience;