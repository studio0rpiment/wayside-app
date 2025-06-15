import React, { useState, useRef, useCallback, useEffect } from 'react';

interface ElasticSliderProps {
  min: number;
  max: number;
  value: number;
  step?: number;
  onChange: (value: number) => void;
  formatValue?: (value: number) => string;
  leftLabel?: string;
  rightLabel?: string;
  className?: string;
  // New size props
  trackHeight?: number;
  labelFontSize?: number;
  showValueDisplay?: boolean;
  trackBorderRadius?: number;
  // New styling props
  labelFontWeight?: string | number;
  valueFontWeight?: string | number;
  labelColor?: string;
  valueColor?: string;
  labelPosition?: 'top' | 'bottom' | 'sides';
  labelGap?: number;
  trackFillColor?: string;
  trackFillGradient?: string;


}

const ElasticSlider: React.FC<ElasticSliderProps> = ({
  min,
  max,
  value,
  step = 1,
  onChange,
  formatValue = (val) => val.toString(),
  leftLabel,
  rightLabel,
  className = '',
  trackHeight = 6,
  labelFontSize = 14,
  showValueDisplay = true,
  trackBorderRadius = 3,
  labelFontWeight = 700,
  valueFontWeight = 600,
  labelColor = 'rgba(255, 255, 255, 0.8)',
  valueColor = 'white',
  labelPosition = 'sides',
  labelGap = 16,
  trackFillColor,
  trackFillGradient
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartValue, setDragStartValue] = useState(0);
  const sliderRef = useRef<HTMLDivElement>(null);

  // Calculate percentage from value
  const percentage = ((value - min) / (max - min)) * 100;

  // Handle mouse/touch start
  const handleStart = useCallback((clientX: number) => {
    setIsDragging(true);
    setDragStartX(clientX);
    setDragStartValue(value);
  }, [value]);

  // Handle mouse/touch move
  const handleMove = useCallback((clientX: number) => {
    if (!isDragging || !sliderRef.current) return;

    const rect = sliderRef.current.getBoundingClientRect();
    const deltaX = clientX - dragStartX;
    const deltaPercentage = (deltaX / rect.width) * 100;
    const deltaValue = (deltaPercentage / 100) * (max - min);
    
    let newValue = dragStartValue + deltaValue;
    
    // Apply step rounding
    newValue = Math.round(newValue / step) * step;
    
    // Clamp to bounds
    newValue = Math.max(min, Math.min(max, newValue));
    
    onChange(newValue);
  }, [isDragging, dragStartX, dragStartValue, max, min, step, onChange]);

  // Handle mouse/touch end
  const handleEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Mouse events
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    handleStart(e.clientX);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    handleMove(e.clientX);
  }, [handleMove]);

  const handleMouseUp = useCallback(() => {
    handleEnd();
  }, [handleEnd]);

  // Native touch event handlers (non-passive)
  const handleTouchStart = useCallback((e: TouchEvent) => {
    e.preventDefault();
    if (e.touches.length > 0) {
      handleStart(e.touches[0].clientX);
    }
  }, [handleStart]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    e.preventDefault();
    if (e.touches.length > 0) {
      handleMove(e.touches[0].clientX);
    }
  }, [handleMove]);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    e.preventDefault();
    handleEnd();
  }, [handleEnd]);

  // Click on track to jump to position
  const handleTrackClick = (e: React.MouseEvent) => {
    if (!sliderRef.current) return;
    
    const rect = sliderRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = (clickX / rect.width) * 100;
    let newValue = min + (percentage / 100) * (max - min);
    
    // Apply step rounding
    newValue = Math.round(newValue / step) * step;
    
    // Clamp to bounds
    newValue = Math.max(min, Math.min(max, newValue));
    
    onChange(newValue);
  };

  // Global event listeners for dragging
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleTouchEnd, { passive: false });
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleTouchEnd);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

  // Touch event listeners for track (non-passive)
  useEffect(() => {
    const trackElement = sliderRef.current;
    if (!trackElement) return;

    trackElement.addEventListener('touchstart', handleTouchStart, { passive: false });
    
    return () => {
      trackElement.removeEventListener('touchstart', handleTouchStart);
    };
  }, [handleTouchStart]);

  return (
    <div className={`elastic-slider ${className}`}>
      {/* Value display - conditionally rendered */}
      {showValueDisplay && (
        <div 
          className="slider-value" 
          style={{ 
            fontSize: `${labelFontSize + 10}px`,
            color: valueColor,
            fontWeight: valueFontWeight
          }}
        >
          {formatValue(value)}
        </div>
      )}
      
      {/* Labels positioned above track (top position) */}
      {labelPosition === 'top' && (leftLabel || rightLabel) && (
        <div className="slider-labels-top" style={{ marginBottom: `${labelGap}px` }}>
          <div 
            className="slider-label" 
            style={{ 
              fontSize: `${labelFontSize}px`,
              color: labelColor,
              fontWeight: labelFontWeight
            }}
          >
            {leftLabel || ''}
          </div>
          <div 
            className="slider-label" 
            style={{ 
              fontSize: `${labelFontSize}px`,
              color: labelColor ,
              fontWeight: labelFontWeight
            }}
          >
            {rightLabel || ''}
          </div>
        </div>
      )}
      
      {/* Slider track container */}
      <div className={`slider-container ${labelPosition}`}>
        {/* Left label for sides position */}
        {labelPosition === 'sides' && leftLabel && (
          <div 
            className="slider-label slider-label-left" 
            style={{ 
              fontSize: `${labelFontSize}px`,
              color: labelColor,
              marginRight: `${labelGap}px`
            }}
          >
            {leftLabel}
          </div>
        )}
        
        {/* Slider track - now the entire track is interactive */}
        <div 
          ref={sliderRef}
          className={`slider-track ${isDragging ? 'dragging' : ''}`}
          style={{ 
            height: `${trackHeight}px`,
            borderRadius: `${trackBorderRadius}px`
          }}
          onClick={handleTrackClick}
          onMouseDown={handleMouseDown}
        >
          {/* Progress fill - this replaces the thumb and shows current position */}
          <div 
            className="slider-progress"
            style={{ 
              width: `${percentage}%`,
              background: trackFillGradient || trackFillColor,
              borderRadius: `${trackBorderRadius}px`,
            //  borderRadius: '50%', 
              height: '100%'
           

            }}
          />
          
          {/* Optional: End indicator for better visual feedback */}
          <div 
            className="slider-end-indicator"
            style={{ 
              left: `calc(${percentage}% - 10px)`,
              background: 'var(--color-dark)',
              borderRadius: '50%', 
              height: `${trackHeight}px`,
              width: `${trackHeight}px`,
            }}
          />
        </div>
        
        {/* Right label for sides position */}
        {labelPosition === 'sides' && rightLabel && (
          <div 
            className="slider-label slider-label-right" 
            style={{ 
              fontSize: `${labelFontSize}px`,
              color: labelColor,
              marginLeft: `${labelGap}px`
            }}
          >
            {rightLabel}
          </div>
        )}
      </div>
      
      {/* Labels positioned below track (bottom position) */}
      {labelPosition === 'bottom' && (leftLabel || rightLabel) && (
        <div className="slider-labels-bottom" style={{ marginTop: `${labelGap}px` }}>
          <div 
            className="slider-label" 
            style={{ 
              fontSize: `${labelFontSize}px`,
              color: labelColor 
            }}
          >
            {leftLabel || ''}
          </div>
          <div 
            className="slider-label" 
            style={{ 
              fontSize: `${labelFontSize}px`,
              color: labelColor 
            }}
          >
            {rightLabel || ''}
          </div>
        </div>
      )}
      
      <style>{`
        .elastic-slider {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
          user-select: none;
          padding: 20px;
        }
        
        .slider-value {
          text-align: center;
          font-weight: 600;
          margin-bottom: 20px;
          text-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
        }
        
        .slider-container {
          display: flex;
          align-items: center;
          width: 100%;
        }
        
        .slider-container.sides {
          gap: 0; /* Gap controlled by margin props */
        }
        
        .slider-labels-top,
        .slider-labels-bottom {
          display: flex;
          justify-content: space-between;
          width: 100%;
        }
        
        .slider-label {
          font-weight: 500;
          min-width: 40px;
          text-align: center;
        }
        
        .slider-track {
          position: relative;
          flex: 1;
          background: rgba(255, 255, 255, 0.2);
          cursor: pointer;
          transition: all 0.2s ease;
          overflow: hidden;
        }
        
        .slider-track:hover {
          background: rgba(255, 255, 255, 0.25);
        }
        
        .slider-track.dragging {
          cursor: grabbing;
        }
        
        .slider-progress {
          position: absolute;
          top: 0;
          left: 0;
          background: linear-gradient(90deg, #3b82f6, #1d4ed8);
          transition: width 0.1s ease;
          box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
          pointer-events: none;
          border-radius: 50%;
        }
        
        .slider-end-indicator {
          position: absolute;
          top: 0;
          width: 3px;
          background: rgba(255, 255, 255, 0.9);
          border-radius: 0 2px 2px 0;
          transform: translateX(-1.5px);
          transition: all 0.1s ease;
          pointer-events: none;
          // box-shadow: 0 0 4px rgba(255, 255, 255, 0.5);
          border-radius: 50%;
        }
        
        .slider-track:hover .slider-end-indicator {
          background: rgba(255, 255, 255, 1);
          box-shadow: 0 0 8px rgba(255, 255, 255, 0.8);
        }
        
        .slider-track.dragging .slider-end-indicator {
          background: rgba(255, 255, 255, 1);
          width: 4px;
          transform: translateX(-2px);
          box-shadow: 0 0 12px rgba(255, 255, 255, 1);
        }
        
        /* Elastic animation for the track */
        .slider-track:active .slider-progress {
          animation: elastic-pulse 0.3s ease-out;
        }
        
        @keyframes elastic-pulse {
          0% { 
            transform: scaleY(1); 
          }
          50% { 
            transform: scaleY(1.2); 
          }
          100% { 
            transform: scaleY(1); 
          }
        }
        
        /* Responsive adjustments */
        @media (max-width: 480px) {
          .slider-container.sides {
            gap: 0;
          }
          
          .slider-label {
            min-width: 35px;
          }
        }
      `}</style>
    </div>
  );
};

export default ElasticSlider;