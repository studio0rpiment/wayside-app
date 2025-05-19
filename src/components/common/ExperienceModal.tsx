// src/components/common/ExperienceModal.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { checkGeofences } from '../../utils/geoUtils';
import { routePointsData } from '../../data/mapRouteData';
import CompassArrow from './CompassArrow';

interface ModalContent {
  title: string;
  description: string;
  imageUrl?: string;
  experienceRoute: string;
  buttonText: string;
  year?: string;
  additionalInfo?: Record<string, string | number | boolean>;
}

interface PointData {
  title: string;
  iconName: string;
  modalContent: ModalContent;
  [key: string]: any;
}

interface ExperienceModalProps {
  isOpen: boolean;
  pointData: PointData | null;
  onClose: () => void;
  isNotification?: boolean;
  userPosition?: [number, number] | null;
  // Add custom radius prop
  radius?: number;
}

// Declare the global for TypeScript
declare global {
  interface Window {
    geofenceDebuggerRadius?: number;
  }
}

const ExperienceModal: React.FC<ExperienceModalProps> = ({
  isOpen,
  pointData,
  onClose,
  isNotification = false,
  userPosition = null,
  // Default to the window global radius, or fall back to 50
  radius
}) => {
  const navigate = useNavigate();
  const [isWithinGeofence, setIsWithinGeofence] = useState(false);
  const [distance, setDistance] = useState<number | null>(null);
  const [direction, setDirection] = useState<number | null>(null);
  
  // Use the global radius or provided radius or default
  const [currentRadius, setCurrentRadius] = useState(
    radius || window.geofenceDebuggerRadius || 3
  );
  
  // Sync with the global radius
  useEffect(() => {
    // Update from props if provided
    if (radius) {
      setCurrentRadius(radius);
    }
    // Otherwise check for global updates
    else {
      const checkRadiusInterval = setInterval(() => {
        if (window.geofenceDebuggerRadius && window.geofenceDebuggerRadius !== currentRadius) {
          setCurrentRadius(window.geofenceDebuggerRadius);
        }
      }, 1000); // Check every second
      
      return () => clearInterval(checkRadiusInterval);
    }
  }, [radius, currentRadius]);

  // Check if user is within the geofence using the current radius
  useEffect(() => {
    if (!isOpen || !pointData || !userPosition) {
      setIsWithinGeofence(false);
      return;
    }

    // Find the point's coordinates
    const pointFeature = routePointsData.features.find(
      feature => feature.properties.iconName === pointData.iconName
    );

    if (!pointFeature) {
      setIsWithinGeofence(false);
      return;
    }

    // Use the synchronized radius for geofence checking
    const results = checkGeofences(userPosition, [pointFeature], currentRadius);
    
    // Debug output
    console.log(`ExperienceModal checking geofence with radius: ${currentRadius}m`);
    
    // Update state
    setIsWithinGeofence(results.insideGeofences.length > 0);
    
    // If we have distance info, store it
    if (results.outsideGeofences.length > 0 && !isWithinGeofence) {
      setDistance(results.outsideGeofences[0].distance);
      
      // Calculate direction (simplified)
      const pointCoords = pointFeature.geometry.coordinates;
      const dx = pointCoords[0] - userPosition[0];
      const dy = pointCoords[1] - userPosition[1];
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);
      setDirection(angle);
    } else if (results.insideGeofences.length > 0) {
      setDistance(results.insideGeofences[0].distance);
    }
  }, [isOpen, pointData, userPosition, isWithinGeofence, currentRadius]);

  const handleExperienceStart = () => {
    if (pointData && pointData.modalContent) {
      navigate(pointData.modalContent.experienceRoute);
    }
    onClose();
  };

  if (!isOpen || !pointData) return null;

  return (
    <>
      {/* Modal component */}
      <div 
        className="experience-modal"
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: 'var(--color-dark)',
          color: 'var(--color-light)',
          padding: '20px',
          borderRadius: '12px',
          width: '80%',
          maxWidth: '400px',
          zIndex: 100,
          boxShadow: '0 4px 8px rgba(0, 0, 0, 0.5)',
          ...(isNotification && {
            borderLeft: '4px solid var(--color-blue)',
          })
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h2 style={{ margin: 0, fontSize: '24px' }}>
            {isNotification ? '🔔 ' : ''}{pointData.title}
          </h2>
          <button 
            onClick={onClose}
            style={{ 
              background: 'none', 
              border: 'none', 
              color: 'var(--color-light)', 
              fontSize: '24px',
              cursor: 'pointer' 
            }}
          >
            ×
          </button>
        </div>
        
        {pointData.modalContent.imageUrl && (
          <div style={{ marginBottom: '15px' }}>
            <img 
              src={pointData.modalContent.imageUrl} 
              alt={pointData.title}
              style={{ width: '50%', borderRadius: '8px' }}
            />
          </div>
        )}
        
        <div style={{ marginBottom: '15px' }}>
          {isNotification && (
            <p style={{ fontWeight: 'bold', color: 'var(--color-blue)' }}>
              You've entered a new experience area!
            </p>
          )}
          <p>{pointData.modalContent.description}</p>
          
          {pointData.modalContent.year && (
            <p><strong>Time Period:</strong> {pointData.modalContent.year}</p>
          )}
          
          {pointData.modalContent.additionalInfo?.heading && (
            <p><strong>Heading:</strong> {pointData.modalContent.additionalInfo.heading}</p>
          )}
        </div>
        
        {isWithinGeofence ? (
          // Show start button when within geofence
          <button
            onClick={handleExperienceStart}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: 'var(--color-blue)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontFamily: 'var(--font-rigby)',
              fontWeight: '400',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            Launch {pointData.title}
          </button>
        ) : (
          // Show direction and distance when not within geofence
          <div style={{ 
            textAlign: 'center', 
            padding: '15px',
            backgroundColor: 'rgba(0, 0, 0, 0.2)',
            borderRadius: '8px' 
          }}>
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column',
              alignItems: 'center', 
              justifyContent: 'center', 
              marginBottom: '10px' 
            }}>
              {direction !== null && (
                <CompassArrow 
                  direction={direction} 
                  size={36}
                />
              )}
              <div style={{ marginTop: '8px' }}>
                <strong>{distance !== null ? `${distance.toFixed(0)}m away` : 'Distance unknown'}</strong>
                {currentRadius && (
                  <span style={{ fontSize: '0.8em', opacity: 0.8, marginLeft: '5px' }}>
                    (Range: {currentRadius}m)
                  </span>
                )}
              </div>
            </div>
            <p style={{ margin: '0', color: 'var(--color-light)', opacity: 0.8 }}>
              You need to be at the location to start this experience
            </p>
          </div>
        )}
      </div>

      {/* Backdrop overlay */}
      <div 
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 90
        }}
        onClick={onClose}
      />
    </>
  );
};

export default ExperienceModal;