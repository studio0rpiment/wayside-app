import React, { useState } from 'react';
import MarkerDetector from './MarkerDetector';
import { useNavigate } from 'react-router-dom';

// Import all experience components
import CubeExperience from './experiences/CubeExperience';
import WaterRiseExperience from './experiences/WaterRiseExperience';
import LotusExperience from './experiences/LotusExperience';
import MacExperience from './experiences/MacExperience';
// import WaterRiseExperience from './experiences/WaterRiseExperience'; 
// We'll import these when they're ready
// import LotusExperience from './experiences/LotusExperience';
// import MacExperience from './experiences/MacExperience';

// Define marker pattern mapping
const markerPatterns = {
  cube: window.location.origin + '/wayside-app/marker-patterns/pattern-ar-marker-2.patt',
  waterRise: window.location.origin + '/wayside-app/marker-patterns/pattern-ar-marker-9.patt',
  lotus: window.location.origin + '/wayside-app/marker-patterns/pattern-ar-marker-5.patt',
  mac: window.location.origin + '/wayside-app/marker-patterns/pattern-ar-marker-4.patt'
};

// Define experience types
export type ExperienceType = 'cube' | 'waterRise' | 'lotus' | 'mac';

interface ExperienceManagerProps {
  experienceType: ExperienceType;
  onClose: () => void;
  onNext?: () => void;
  markerUrl?: string;
  nextRoute?: string;
}

const ExperienceManager: React.FC<ExperienceManagerProps> = ({
  experienceType,
  onClose,
  onNext,
  markerUrl,
  nextRoute = '/map' // Default next route
}) => {
  const [markerDetected, setMarkerDetected] = useState(false);
  const navigate = useNavigate();

  // Use the provided markerUrl or get it from the mapping
  const actualMarkerUrl = markerUrl || markerPatterns[experienceType] || markerPatterns.cube;

  // Handler for when marker is detected
  const handleMarkerDetected = () => {
    console.log('Marker detected! Adding experience on top');
    setMarkerDetected(true);
  };

  const handleNavigateToNext = () => {
    navigate(nextRoute);
  };

  // Render different experiences based on type
  const renderExperience = () => {
    const nextHandler = onNext || handleNavigateToNext;
    
    switch (experienceType) {
      case 'cube':
        return <CubeExperience onClose={onClose} onNext={nextHandler} />;

      case 'waterRise':
        return <WaterRiseExperience onClose={onClose} onNext={nextHandler} />;
        
      case 'lotus':
        return <LotusExperience onClose={onClose} onNext={nextHandler} />;

      case 'mac':
        // Temporary fallback until MacExperience is implemented
       
        return <MacExperience onClose={onClose} onNext={nextHandler} />;
      default:
        console.warn(`Unknown experience type: ${experienceType}, defaulting to cube`);
        return <CubeExperience onClose={onClose} onNext={nextHandler} />;
    }
  };

  return (
    <>
      {markerDetected && renderExperience()}
      <MarkerDetector 
        onMarkerDetected={handleMarkerDetected} 
        markerUrl={actualMarkerUrl}
      />
    </>
  );
};

export default ExperienceManager;