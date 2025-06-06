// EdgeChevrons.tsx
import React, { useMemo } from 'react';
import { calculateBearing } from '../../utils/geoArUtils';

// Add this to your ArCameraComponent.tsx imports:
// import EdgeChevrons from './EdgeChevrons';

interface EdgeChevronsProps {
  userPosition: [number, number];
  anchorPosition: [number, number];
  deviceHeading: number | null; // Device compass heading in degrees (0 = North)
  isVisible: boolean;
  onToggleVisibility?: (visible: boolean) => void;
}

const EdgeChevrons: React.FC<EdgeChevronsProps> = ({
  userPosition,
  anchorPosition,
  deviceHeading,
  isVisible
}) => {
  
  // Calculate direction to anchor
  const directionInfo = useMemo(() => {
    if (!deviceHeading) return null;
    
    // Get GPS bearing from user to anchor (0 = North, 90 = East)
    const gpsBearing = calculateBearing(userPosition, anchorPosition);
    
    // Calculate relative direction (where anchor is relative to device heading)
    let relativeDirection = gpsBearing - deviceHeading;
    
    // Normalize to -180 to +180 range
    while (relativeDirection > 180) relativeDirection -= 360;
    while (relativeDirection < -180) relativeDirection += 360;
    
    // Determine if anchor is in view (roughly ±45 degrees)
    const isInView = Math.abs(relativeDirection) <= 45;
    
    // Determine which side (left = negative, right = positive)
    const isOnRight = relativeDirection > 0;
    
    return {
      relativeDirection,
      isInView,
      isOnRight,
      gpsBearing,
      deviceHeading
    };
  }, [userPosition, anchorPosition, deviceHeading]);
  
  if (!isVisible || !directionInfo) return null;

  console.log('🧭 EdgeChevrons rendering:', {
  isVisible,
  directionInfo,
  isInView: directionInfo.isInView,
  isOnRight: directionInfo.isOnRight,
  relativeDirection: directionInfo.relativeDirection
});
  
  const { isInView, isOnRight, relativeDirection } = directionInfo;
  
  return (
    <>
      {/* Left Chevron */}
      {(!isInView && !isOnRight) || (isInView && isOnRight) ? (
        <div
          style={{
            position: 'fixed',
            left: '15vw',
            top: '5vh',
            height: '90vh',
            width: '20px',
            zIndex: 1004,
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(255, 0, 0, 0.3)' 
          }}
        >
          <ChevronShape 
            direction={isInView ? 'inward-right' : 'outward-left'} 
            side="left"
          />
        </div>
      ) : null}
      
      {/* Right Chevron */}
      {(!isInView && isOnRight) || (isInView && !isOnRight) ? (
        <div
          style={{
            position: 'fixed',
            right: '15vw',
            top: '5vh',
            height: '90vh',
            width: '20px',
            zIndex: 1004,
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <ChevronShape 
            direction={isInView ? 'inward-left' : 'outward-right'} 
            side="right"
          />
        </div>
      ) : null}
    </>
  );
};

// Curly brace-style chevron shape
interface ChevronShapeProps {
  direction: 'outward-left' | 'outward-right' | 'inward-left' | 'inward-right';
  side: 'left' | 'right';
}

const ChevronShape: React.FC<ChevronShapeProps> = ({ direction, side }) => {
  const isOutward = direction.startsWith('outward');
  
  // Create curly brace path
  const createPath = () => {
    const height = 300; // SVG height
    const width = 20;   // SVG width
    const curve = 8;    // Curve radius
    
    if (side === 'left') {
      if (isOutward) {
        // Point left (outward from left edge)
        return `M ${width-2} 0 
                Q ${width-2-curve} ${height/2-curve} ${width-2-curve} ${height/2}
                Q ${width-2-curve} ${height/2+curve} ${width-2} ${height}
                L ${width-8} ${height-20}
                L 2 ${height/2}
                L ${width-8} 20
                L ${width-2} 0`;
      } else {
        // Point right (inward to left edge)
        return `M 2 0 
                Q ${2+curve} ${height/2-curve} ${2+curve} ${height/2}
                Q ${2+curve} ${height/2+curve} 2 ${height}
                L 8 ${height-20}
                L ${width-2} ${height/2}
                L 8 20
                L 2 0`;
      }
    } else {
      if (isOutward) {
        // Point right (outward from right edge)
        return `M 2 0 
                Q ${2+curve} ${height/2-curve} ${2+curve} ${height/2}
                Q ${2+curve} ${height/2+curve} 2 ${height}
                L 8 ${height-20}
                L ${width-2} ${height/2}
                L 8 20
                L 2 0`;
      } else {
        // Point left (inward to right edge)
        return `M ${width-2} 0 
                Q ${width-2-curve} ${height/2-curve} ${width-2-curve} ${height/2}
                Q ${width-2-curve} ${height/2+curve} ${width-2} ${height}
                L ${width-8} ${height-20}
                L 2 ${height/2}
                L ${width-8} 20
                L ${width-2} 0`;
      }
    }
  };
  
  return (
    <svg
      width="20"
      height="300"
      style={{
        filter: 'drop-shadow(0 0 4px rgba(190, 105, 169, 0.3))'
      }}
    >
      <path
        d={createPath()}
        fill="var(--color-pink)"
        stroke="var(--color-pink)"
        strokeWidth="1"
        style={{
          animation: isOutward 
            ? 'chevronFlash 1.5s ease-in-out infinite' 
            : 'chevronPulse 2s ease-in-out infinite'
        }}
      />
      
      <style>{`
        @keyframes chevronFlash {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        
        @keyframes chevronPulse {
          0%, 100% { opacity: 0.8; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.05); }
        }
      `}</style>
    </svg>
  );
};

export default EdgeChevrons;