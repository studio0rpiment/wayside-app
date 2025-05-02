import React, { useState } from 'react';
import MarkerDetector from './MarkerDetector';
import CubeExperience from './experiences/CubeExperience';
import { useNavigate } from 'react-router-dom';

interface ExperienceManagerProps {
  experienceType: string;
  onClose: () => void;
  onNext?: () => void;
  markerUrl?: string;
}

const ExperienceManager: React.FC<ExperienceManagerProps> = ({
  experienceType,
  onClose,
  onNext,
  markerUrl = window.location.origin + '/wayside-app/marker-patterns/pattern-ar-marker-2.patt'
}) => {
  const [markerDetected, setMarkerDetected] = useState(false);
  const navigate = useNavigate();

  // Handler for when marker is detected
  const handleMarkerDetected = () => {
    console.log('Marker detected! Adding experience on top');
    setMarkerDetected(true);
  };

  const handleNavigateToMap = () => {
    navigate('/map'); // Navigate to the map route
  };

  // Render different experiences based on type
  const renderExperience = () => {
    switch (experienceType) {
      case 'cube':
        return <CubeExperience onClose={onClose} onNext={handleNavigateToMap} />;
      // Add more cases for other experiences here
      default:
        return <CubeExperience onClose={onClose} onNext={handleNavigateToMap} />;
    }
  };

  return (
    <>
      {markerDetected && renderExperience()}
      <MarkerDetector 
        onMarkerDetected={handleMarkerDetected} 
        markerUrl={markerUrl}
        // hide={markerDetected} // Pass the hide prop based on marker detection
      />
    </>
  );
};

export default ExperienceManager;