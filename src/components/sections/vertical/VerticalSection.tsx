import React, { useRef, useEffect, ReactNode } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import classNames from 'classnames';

interface VerticalSectionProps {
  id: string;
  title: string;
  color: string;
  children?: ReactNode;
  className?: string;
  height?: string | number;
  minHeight?: string | number;
  contentWidth?: string | number;
  fullHeight?: boolean;
}

const VerticalSection: React.FC<VerticalSectionProps> = ({
  id,
  title,
  color,
  children,
  className = '',
  height, // Optional explicit height
  minHeight = '100vh', // Default minimum height
  contentWidth = 'max-w-6xl', // Default content width
  fullHeight = true, // Default to full viewport height
}) => {
  // Use a simple ref instead of the context hook
  const sectionRef = useRef<HTMLElement>(null);
  
  // Set up ScrollTrigger for animation if needed
  useEffect(() => {
    if (!sectionRef.current) return;
    
    const section = sectionRef.current;
    
    // Create a simple ScrollTrigger for this section
    const trigger = ScrollTrigger.create({
      trigger: section,
      start: 'top 80%',
      end: 'bottom 20%',
      toggleClass: 'active',
      id: id,
      markers: false,
    });
    
    return () => {
      trigger.kill();
    };
  }, [id]);
  
  return (
    <section
      ref={sectionRef}
      id={id}
      className={classNames(
        'vertical-section w-full flex flex-col items-center justify-center',
        fullHeight && !height ? 'min-h-screen' : '',
        className
      )}
      style={{ 
        backgroundColor: color,
        height: height,
        minHeight: !height ? minHeight : undefined,
      }}
      data-section-id={id}
    >
      <div className={classNames("section-content px-4 py-8 md:px-8 md:py-12 w-full mx-auto", contentWidth)}>
        <h2 className="text-6xl font-bold text-white mb-8">{title}</h2>
        {children}
      </div>
    </section>
  );
};

export default VerticalSection;