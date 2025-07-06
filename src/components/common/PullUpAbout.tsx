import React, { useState, useEffect, useRef } from 'react';

const PullupAbout = () => {
  const [isOpen, setIsOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const currentY = useRef(0);

  // Team member names with color rotation
const teamMembers = [
  { name: 'ANDREW KASTNER', color: '--color-blue' },
  { name: 'FOURTH FLOOR DESIGN COLLECTIVE', color: '--color-green' },
  { name: 'NATALIE ADAM', color: '--color-pink' },
  { name: 'ALEX MURPURGO', color: '--color-pink' },
  { name: 'SARAH DALLAS', color: '--color-blue' },
  { name: 'COREY HOWELL', color: '--color-green' },
  { name: 'KEVIN PATTON', color: '--color-pink' }
];
  // Handle touch start
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isOpen) return;
    startY.current = e.touches[0].clientY;
  };

  // Handle touch move
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isOpen) return;
    currentY.current = e.touches[0].clientY;
    const diff = currentY.current - startY.current;
    
    // Only allow downward swipes
    if (diff > 0) {
      const sheet = sheetRef.current;
      if (sheet) {
        sheet.style.transform = `translateY(calc(10svh + ${diff}px))`;
      }
    }
  };

  // Handle touch end
  const handleTouchEnd = () => {
    if (!isOpen) return;
    const diff = currentY.current - startY.current;
    
    // If swiped down more than 100px, close the sheet
    if (diff > 100) {
      setIsOpen(false);
    } else {
      // Snap back to open position
      const sheet = sheetRef.current;
      if (sheet) {
        sheet.style.transform = 'translateY(15svh)';
      }
    }
  };

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  // Reset transform when opening/closing
  useEffect(() => {
    const sheet = sheetRef.current;
    if (sheet) {
      sheet.style.transform = isOpen ? 'translateY(15svh)' : 'translateY(calc(100svh - 40px))';
    }
  }, [isOpen]);

   return (
    <>
      {/* Unified Sheet - includes both tab and content */}
      <div
        ref={sheetRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          position: 'fixed',
          left: '3svw',
          top: 0,
          transform: 'translateY(calc(100svh - 5svh))',
          width: '90svw',
          height: 'calc(70svh + 5svh)', // Content height + tab height
          backgroundColor: 'transparent',
          backdropFilter: 'blur(10px)',
          borderRadius: '20px',
          zIndex: 1001,
          transition: 'transform 0.4s cubic-bezier(0.32, 0.72, 0, 1)',
          boxSizing: 'border-box',
          overflow: 'hidden'
        }}
      >
        {/* Tab Section - always visible */}
        <div
          onClick={() => setIsOpen(true)}
          style={{
            width: '100%',
            height: '5svh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            borderRadius: '20px 20px 0 0'
          }}
        >
          <span style={{ 
            color: 'var(--color-pink)', 
            fontSize: '1.2rem', 
            fontWeight: 'bold' 
          }}>
            ABOUT THE PROJECT
          </span>
        </div>

        {/* Content Section - only visible when open */}
        {isOpen && (
          <div style={{
            height: '70svh',
            padding: '20px',
            overflow: 'auto',
            WebkitOverflowScrolling: 'touch',
            position: 'relative'
          }}>
            {/* Close Button */}
            <button
              onClick={() => setIsOpen(false)}
              style={{
                position: 'absolute',
                top: '15px',
                right: '15px',
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                border: 'none',
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                color: 'var(--color-dark)',
                fontSize: '18px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                zIndex: 1002
              }}
            >
              ×
            </button>

            {/* Content */}
             {/* Content */}
        <div style={{
          textAlign: 'left',
          color: 'var(--color-light)',
          lineHeight: '1.6',
          fontSize: '1rem',
          fontWeight: '700',
          marginTop: '30px'
        }}>
          <p style={{ marginBottom: '20px' }}>
            <span style={{ color: `var(${teamMembers[0].color})`, fontWeight: 'bold', textShadow: '0 0 4px rgba(0,0,0,0.8)' }}>
              {teamMembers[0].name}
            </span> is an artist and stroke survivor developing an immersive augmented reality app as part of his <em>Down to Earth</em> residency. His work explores universal communication—an interest that deepened after a stroke and resulting aphasia. Now, he's focused on designing experiences that go beyond language.
          </p>

          <p style={{ marginBottom: '20px' }}>
            This project was only possible through deep collaboration. A dedicated team of designers, developers, and artists helped bring <em>Wayside.at</em> to life—far beyond what Andrew could have created alone.
          </p>

          <p style={{ marginBottom: '20px' }}>
            The <span style={{ color: `var(${teamMembers[1].color})`, fontWeight: 'bold' }}>
              {teamMembers[1].name}
            </span>, co-founded by <span style={{ color: `var(${teamMembers[2].color})`, fontWeight: 'bold' }}>
              {teamMembers[2].name}
            </span> and <span style={{ color: `var(${teamMembers[3].color})`, fontWeight: 'bold' }}>
              {teamMembers[3].name}
            </span>, helped shape the voice and visual identity of <em>Wayside.at</em>.
          </p>

          <p style={{ marginBottom: '20px' }}>
            <span style={{ color: `var(${teamMembers[4].color})`, fontWeight: 'bold' }}>
              {teamMembers[4].name}
            </span>, a longtime collaborator, managed the project from start to finish—keeping timelines on track and ideas in motion.
          </p>

          <p style={{ marginBottom: '20px' }}>
            <span style={{ color: `var(${teamMembers[5].color})`, fontWeight: 'bold' }}>
              {teamMembers[5].name}
            </span> created the 3D models that bring the experience to life. His technical skill and artistic eye were essential in translating research and site data into responsive, spatial forms.
          </p>

          <p style={{ marginBottom: '20px' }}>
            <span style={{ color: `var(${teamMembers[6].color})`, fontWeight: 'bold' }}>
              {teamMembers[6].name}
            </span> led AR development and interaction design, building the bespoke interactive platform that makes <em>Wayside.at</em> function seamlessly in real-world space.
          </p>

          <p style={{ marginBottom: '0' }}>
            This team would like to give special thanks to <span style={{ color: 'var(--color-blue)' }}>Julianne Brienza</span>, the Down to Earth Residency, Capital Fringe, Friends of Kenilworth, and <span style={{ color: 'var(--color-blue)' }}>Andrea Dietz</span>.
          </p>
        </div>
      
          </div>
        )}
      </div>

      {/* Background Overlay (when open) */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            zIndex: 998,
            backdropFilter: 'blur(2px)',
            pointerEvents: 'none'
          }}
        />
      )}

      {/* Clickable overlay area (excludes bottom tab) */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: '5svh',
            zIndex: 999,
            pointerEvents: 'auto'
          }}
        />
      )}
    </>
  );
};

export default PullupAbout;