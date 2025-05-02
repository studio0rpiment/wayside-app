import React, { useState } from 'react';
import VerticalSection from '../sections/vertical/VerticalSection';
import PermissionsStatus from '../common/PermissionsStatus';
import ExperienceManager from '../ExperienceManager';
import { useNavigate } from 'react-router-dom';

const WaterLevel: React.FC = () => {
  const [showExperience, setShowExperience] = useState(false);
  const navigate = useNavigate();
  
  const handleStartExperience = () => {
    setShowExperience(true);
  };
  
  const handleCloseExperience = () => {
    setShowExperience(false);
  };
  
  const handleCompleteExperience = () => {
    // Navigate to next route or update state
    setShowExperience(false);
    // Potentially navigate to another page or show a success message
    // navigate('/next-route');
  };

  return (
    <div className="water-level-route">
      <div style={{ 
        position: 'absolute', 
        top: '20px', 
        right: '20px', 
        zIndex: 100,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        padding: '0.5rem',
        borderRadius: '0.5rem'
      }}>
        <PermissionsStatus 
          compact={true} 
          showCamera={showExperience} // Show camera status when experience is active
          showLocation={true}
          showOrientation={false}
        />
      </div>

      {showExperience ? (
        <ExperienceManager 
          experienceType="waterRise"
          onClose={handleCloseExperience}
          onNext={handleCompleteExperience}
          nextRoute="/water-level/complete" // Adjust as needed
        />
      ) : (
        <VerticalSection 
          id="waterLevelSection" 
          title="Water Level"
          color="var(--color-dark)"
        >
          <div style={{ padding: '1rem' }}>
            <p>Water level data requires location permissions to show relevant information for your area.</p>
            <div style={{ 
              height: '200px', 
              marginTop: '20px', 
              backgroundColor: 'rgba(0, 100, 255, 0.2)', 
              borderRadius: '5px', 
              display: 'flex', 
              flexDirection: 'column',
              justifyContent: 'center', 
              alignItems: 'center' 
            }}>
              <p>Ready to experience rising water levels in AR?</p>
              <button 
                onClick={handleStartExperience}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: 'var(--color-primary)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontFamily: 'var(--font-rigby)',
                  fontWeight: '400',
                  marginTop: '1rem',
                  cursor: 'pointer'
                }}
              >
                START AR EXPERIENCE
              </button>
            </div>
          </div>
        </VerticalSection>
      )}
    </div>
  );
};

export default WaterLevel;