import React, { ReactNode, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

interface SwipeableCarouselProps {
  id: string;
  title?: string;
  background?: string;
  children: ReactNode;
  className?: string;
  height?: string | number;
  currentCard?: number;
  onCardChange?: (index: number) => void;
}

const SwipeableCarousel: React.FC<SwipeableCarouselProps> = ({
  id,
  title,
  background = '#222',
  children,
  className = '',
  height = '100vh',
  currentCard = 0,
  onCardChange,
}) => {
  
  const cardCount = React.Children.count(children);
  
  console.log('Carousel render - currentCard:', currentCard, 'cardCount:', cardCount);

  // Simple transform calculation
  const getTransform = () => {
    const offset = -currentCard * 100/cardCount;
    console.log('Transform: translateX(' + offset + '%)');
    return `translateX(${offset}%)`;
  };

  return (
    <div 
      className={`carousel-container ${className}`}
      style={{ 
        height,
        width: '100%',
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: background,
        fontFamily: "'rigby', sans-serif",
        touchAction: 'manipulation', // Allow essential touch actions like button taps
      }}
    >
      {title && (
        <div style={{
          padding: '1rem 1rem 0rem 1rem',
          fontSize: '1.3rem',
          color: 'var(--color-light)',
          zIndex: 10,
          position: 'relative',
        }}>
          {title}
        </div>
      )}
      
      <div 
        className="carousel-track"
        style={{
          height: title ? 'calc(100% - 60px)' : '100%',
          width: `${cardCount * 100}%`,
          display: 'flex',
          transform: getTransform(),
          transition: 'transform 0.3s ease-out',
        }}
      >
        {React.Children.map(children, (child, index) => (
          <div
            key={index}
            style={{
              width: `${100 / cardCount}%`,
              height: '100%',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'start',
              justifyContent: 'center',
              paddingTop: '0rem',   
              transform: 'translateY(-2rem)' 
            }}
          >
            {child}
          </div>
        ))}
      </div>

      {/* Progress dots */}
            <div style={{
            position: 'absolute',
            top: '3vh',
            right: '5vh',
            display: 'flex',
            gap: '8px',
            zIndex: 10,
            }}>
            {Array.from({ length: cardCount }, (_, index) => (
                <div
                key={index}
                onClick={() => onCardChange?.(index)}
                style={{
                    width: '15px',
                    height: '15px',
                    borderRadius: '50%',
                    backgroundColor: index === currentCard ? 'var(--color-pink)' : 'rgba(255, 255, 255, 0.3)',
                    transition: 'background-color 0.3s ease',
                    cursor: 'pointer', // Add pointer cursor
                    padding: '4px', // Add padding for better touch targets
                    margin: '1px', // Negative margin to maintain visual spacing
                }}
                />
            ))}
            </div>

      {/* Debug info */}
      {/* <div style={{
        position: 'absolute',
        bottom: '60px',
        left: '20px',
        color: 'white',
        fontSize: '12px',
        zIndex: 10,
        backgroundColor: 'rgba(0,0,0,0.5)',
        padding: '5px',
        borderRadius: '5px',
      }}>
        Current Card: {currentCard} / {cardCount - 1}
      </div> */}

      {/* Navigation hint */}
      {/* <div style={{
        position: 'absolute',
        bottom: '10px',
        width: '100%',
        textAlign: 'center',
        fontSize: '0.9rem',
        color: 'rgba(255, 255, 255, 0.7)',
        zIndex: 5,
      }}>
        <p style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          gap: '8px',
          margin: 0,
        }}>
          <span>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </span>
          Swipe to Navigate
          <span>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </span>
        </p>
      </div> */}
    </div>
  );
};

export default SwipeableCarousel;