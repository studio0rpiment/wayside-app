// src/components/common/ExperienceModal.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
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
  // New props from the centralized hook
  isInsideGeofence?: boolean;
  distanceToGeofence?: number | null;
  directionToGeofence?: number | null;
  currentRadius?: number;
}

const ExperienceModal: React.FC<ExperienceModalProps> = ({
  isOpen,
  pointData,
  onClose,
  isNotification = false,
  isInsideGeofence = false,
  distanceToGeofence = null,
  directionToGeofence = null,
  currentRadius = 50
}) => {
  const navigate = useNavigate();
  
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
          <p><strong>Duration:</strong> {pointData.modalContent.additionalInfo.heading}</p>
        )}
      </div>
      
      {isInsideGeofence ? (
        // Show start button when within geofence, but also show distance info
        <div>
          {/* Add distance/direction info even when inside */}
          {(distanceToGeofence !== null || directionToGeofence !== null) && (
            <div style={{ 
              textAlign: 'center', 
              padding: '10px',
              backgroundColor: 'rgba(0, 255, 0, 0.1)', // Light green background when inside
              borderRadius: '8px',
              marginBottom: '15px',
              border: '1px solid rgba(0, 255, 0, 0.3)'
            }}>
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column',
                alignItems: 'center', 
                justifyContent: 'center' 
              }}>
                {directionToGeofence !== null && (
                  <CompassArrow 
                    direction={directionToGeofence} 
                    size={24}
                  />
                )}
                <div style={{ fontSize: '14px', opacity: 0.9, marginTop: '5px' }}>
                  {distanceToGeofence !== null && (
                    <span><strong>{distanceToGeofence.toFixed(1)}m</strong> from center</span>
                  )}
                  <div style={{ fontSize: '12px', opacity: 0.7, marginTop: '2px' }}>
                    Within {currentRadius}m range ✓
                  </div>
                </div>
              </div>
            </div>
          )}
          
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
        </div>
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
            {directionToGeofence !== null && (
              <CompassArrow 
                direction={directionToGeofence} 
                size={36}
              />
            )}
            <div style={{ marginTop: '8px' }}>
              <strong>
                {distanceToGeofence !== null 
                  ? `${distanceToGeofence.toFixed(0)}m away` 
                  : 'Distance unknown'
                }
              </strong>
              <span style={{ fontSize: '0.8em', opacity: 0.8, marginLeft: '5px' }}>
                (Range: {currentRadius}m)
              </span>
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