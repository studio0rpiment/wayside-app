import React from 'react';
import ExperienceManager from './ExperienceManager';

interface DemoExperienceProps {
  onClose: () => void;
  markerUrl?: string;
  onNext?: () => void;
}

// This is a wrapper component for backward compatibility
const DemoExperience: React.FC<DemoExperienceProps> = ({ 
  onClose,
  markerUrl,
  onNext
}) => {
  return (
    <ExperienceManager
      experienceType="cube"
      onClose={onClose}
      onNext={onNext}
      markerUrl={markerUrl}
    />
  );
};

export default DemoExperience;
