import React, { useEffect } from 'react';
import ARExperience from '../ar/ARExperience';

// Import A-Frame and AR.js
import 'aframe';
import 'aframe-ar';

const DemoExperience: React.FC = () => {
  useEffect(() => {
    console.log('DemoExperience component mounted');
  }, []);

  // Instead of using JSX for A-Frame elements, create them programmatically
  const arContent = [
    React.createElement('a-box', {
      position: "0 0.5 0",
      color: "red",
      scale: "0.5 0.5 0.5"
    }),
    React.createElement('a-text', {
      value: "AR Demo",
      position: "0 1 0",
      align: "center",
      color: "white",
      scale: "0.5 0.5 0.5"
    })
  ];

  return (
    <ARExperience
      experienceId="demo"
      markerId={5}
      patternUrl="/marker-patterns/pattern-ar-marker-5.patt"
      instructions="Point your camera at Marker #5 to test AR functionality"
    >
      {arContent}
    </ARExperience>
  );
};

export default DemoExperience;