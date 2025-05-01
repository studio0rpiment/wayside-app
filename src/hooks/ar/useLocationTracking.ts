import { useState, useEffect, useMemo } from 'react';

interface Location {
  lat: number;
  lon: number;
}

interface UseLocationTrackingResult {
  location: Location | null;
  relativePosition: Location | null;
  locationStatus: 'waiting' | 'available' | 'unavailable';
  error: string | null;
}

export function useLocationTracking(): UseLocationTrackingResult {
  const [location, setLocation] = useState<Location | null>(null);
  const [initialLocation, setInitialLocation] = useState<Location | null>(null);
  const [locationStatus, setLocationStatus] = useState<'waiting' | 'available' | 'unavailable'>('waiting');
  const [error, setError] = useState<string | null>(null);

  // Get location data
  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      position => {
        const newLocation = {
          lat: position.coords.latitude,
          lon: position.coords.longitude
        };
        
        setLocation(newLocation);
        
        // Save initial location for relative positioning
        if (!initialLocation) {
          setInitialLocation(newLocation);
        }
        
        setLocationStatus('available');
        
        // Clear any previous location errors
        if (error && error.includes('Location access failed')) {
          setError(null);
        }
      },
      err => {
        console.error('Error getting location:', err);
        
        if (err.code === 2) { // POSITION_UNAVAILABLE
          setLocationStatus('unavailable');
        } else if (!location) {
          setError('Location access failed. Please check your permissions.');
        }
      },
      { enableHighAccuracy: true, maximumAge: 10000 }
    );

    // Cleanup function to remove the watch when component unmounts
    return () => navigator.geolocation.clearWatch(watchId);
  }, [location, initialLocation, error]);

  // Calculate relative position from initial location
  const relativePosition = useMemo(() => {
    if (!location || !initialLocation) return null;
    
    return {
      lat: location.lat - initialLocation.lat,
      lon: location.lon - initialLocation.lon
    };
  }, [location, initialLocation]);

  return { 
    location, 
    relativePosition, 
    locationStatus, 
    error 
  };
}
