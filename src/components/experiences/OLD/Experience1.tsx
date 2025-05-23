// src/components/experiences/Experience1.tsx
import React from 'react';
import ARPortalExperience from '../ar/ARPortalExperience';

interface Experience1Props {
  onClose: () => void;
}

const Experience1: React.FC<Experience1Props> = ({ onClose }) => {
  return (
    <ARPortalExperience
      experienceId="experience1"
      markerId={1}
      patternUrl="/marker-patterns/pattern-ar-marker-1.patt"
      onClose={onClose}
    />
  );
};

export default Experience1;

//CHANGE THE NAMES HERE