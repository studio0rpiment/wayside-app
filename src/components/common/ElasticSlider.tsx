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
  className = ''
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartValue, setDragStartValue] = useState(0);
  const sliderRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);

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
    e.preventDefault(); // This will now work properly
    if (e.touches.length > 0) {
      handleStart(e.touches[0].clientX);
    }
  }, [handleStart]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    e.preventDefault(); // Prevent scrolling during drag
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

  // Touch event listeners for thumb (non-passive)
  useEffect(() => {
    const thumbElement = thumbRef.current;
    if (!thumbElement) return;

    // Add touch event listeners with { passive: false }
    thumbElement.addEventListener('touchstart', handleTouchStart, { passive: false });
    
    return () => {
      thumbElement.removeEventListener('touchstart', handleTouchStart);
    };
  }, [handleTouchStart]);

  return (
    <div className={`elastic-slider ${className}`}>
      {/* Value display */}
      <div className="slider-value">
        {formatValue(value)}
      </div>
      
      {/* Slider track container */}
      <div className="slider-container">
        {/* Left label */}
        {leftLabel && (
          <div className="slider-label slider-label-left">
            {leftLabel}
          </div>
        )}
        
        {/* Slider track */}
        <div 
          ref={sliderRef}
          className="slider-track"
          onClick={handleTrackClick}
        >
          {/* Progress fill */}
          <div 
            className="slider-progress"
            style={{ width: `${percentage}%` }}
          />
          
          {/* Thumb - removed onTouchStart to use native event listener */}
          <div
            ref={thumbRef}
            className={`slider-thumb ${isDragging ? 'dragging' : ''}`}
            style={{ left: `${percentage}%` }}
            onMouseDown={handleMouseDown}
          />
        </div>
        
        {/* Right label */}
        {rightLabel && (
          <div className="slider-label slider-label-right">
            {rightLabel}
          </div>
        )}
      </div>
      
      <style>{`
        .elastic-slider {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
          user-select: none;
          padding: 20px;
        }
        
        .slider-value {
          text-align: center;
          font-size: 24px;
          font-weight: 600;
          color: white;
          margin-bottom: 20px;
          text-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
        }
        
        .slider-container {
          display: flex;
          align-items: center;
          gap: 16px;
          width: 100%;
        }
        
        .slider-label {
          font-size: 14px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.8);
          min-width: 40px;
          text-align: center;
        }
        
        .slider-track {
          position: relative;
          flex: 1;
          height: 6px;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 3px;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        
        .slider-track:hover {
          background: rgba(255, 255, 255, 0.25);
        }
        
        .slider-progress {
          position: absolute;
          top: 0;
          left: 0;
          height: 100%;
          background: linear-gradient(90deg, #3b82f6, #1d4ed8);
          border-radius: 3px;
          transition: width 0.1s ease;
          box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
        }
        
        .slider-thumb {
          position: absolute;
          top: 50%;
          width: 24px;
          height: 24px;
          background: white;
          border-radius: 50%;
          transform: translate(-50%, -50%);
          cursor: grab;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 
            0 2px 8px rgba(0, 0, 0, 0.15),
            0 0 0 2px rgba(59, 130, 246, 0.2);
        }
        
        .slider-thumb:hover {
          transform: translate(-50%, -50%) scale(1.1);
          box-shadow: 
            0 4px 12px rgba(0, 0, 0, 0.2),
            0 0 0 3px rgba(59, 130, 246, 0.3);
        }
        
        .slider-thumb.dragging {
          cursor: grabbing;
          transform: translate(-50%, -50%) scale(1.15);
          box-shadow: 
            0 6px 16px rgba(0, 0, 0, 0.25),
            0 0 0 4px rgba(59, 130, 246, 0.4);
        }
        
        .slider-thumb::before {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          width: 8px;
          height: 8px;
          background: #3b82f6;
          border-radius: 50%;
          transform: translate(-50%, -50%);
          transition: all 0.2s ease;
        }
        
        .slider-thumb:hover::before,
        .slider-thumb.dragging::before {
          background: #1d4ed8;
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
          .slider-container {
            gap: 12px;
          }
          
          .slider-label {
            font-size: 12px;
            min-width: 35px;
          }
          
          .slider-value {
            font-size: 20px;
          }
          
          .slider-thumb {
            width: 28px;
            height: 28px;
          }
          
          .slider-track {
            height: 8px;
          }
        }
      `}</style>
    </div>
  );
};

export default ElasticSlider;