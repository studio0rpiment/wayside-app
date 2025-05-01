import { useState, useCallback } from 'react';

interface UseMarkerDetectionResult {
  markerDetected: boolean;
  detectedMarkerId: number | null;
  handleMarkerFound: (id: number) => void;
  handleMarkerLost: () => void;
}

export function useMarkerDetection(): UseMarkerDetectionResult {
  const [markerDetected, setMarkerDetected] = useState(false);
  const [detectedMarkerId, setDetectedMarkerId] = useState<number | null>(null);
  
  const handleMarkerFound = useCallback((id: number) => {
    setMarkerDetected(true);
    setDetectedMarkerId(id);
  }, []);
  
  const handleMarkerLost = useCallback(() => {
    setMarkerDetected(false);
    setDetectedMarkerId(null);
  }, []);
  
  return {
    markerDetected,
    detectedMarkerId,
    handleMarkerFound,
    handleMarkerLost
  };
}
