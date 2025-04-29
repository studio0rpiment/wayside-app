import React, { useRef, useEffect, ReactNode } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import classNames from 'classnames';

interface VerticalSectionProps {
  id: string;
  title?: string; // Made optional
  color: string;
  children?: ReactNode;
  className?: string;
  height?: string | number;
  minHeight?: string | number;
  fullHeight?: boolean;
}

const VerticalSection: React.FC<VerticalSectionProps> = ({
  id,
  title,
  color,
  children,
  className = '',
  height,
  minHeight = '100vh',
  fullHeight = true,
}) => {
  const sectionRef = useRef<HTMLElement>(null);
  
  useEffect(() => {
    if (!sectionRef.current) return;
    
    const section = sectionRef.current;
    
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
        'vertical-section w-full',
        fullHeight && !height ? 'min-h-screen' : '',
        className
      )}
      style={{ 
        backgroundColor: color,
        height: 'auto',
        minHeight: !height ? minHeight : undefined,
        maxWidth: '100vw'
      }}
      data-section-id={id}
    >
       {children}

    </section>
  );
};

export default VerticalSection;