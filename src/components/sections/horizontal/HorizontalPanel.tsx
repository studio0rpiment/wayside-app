import React, { ReactNode } from 'react';

// Simplify the props interface
interface HorizontalPanelProps {
  title: string;
  color: string;
  children?: ReactNode;
  height?: string;
  width?: string;
  className?: string;
}

const HorizontalPanel: React.FC<HorizontalPanelProps> = ({
  title,
  color,
  children,
  height = '100%',
  width = '100vw',
  className = '',
}) => {
  return (
    <div 
      className={`horizontal-panel ${className}`}
      style={{ 
        width: width,
        height: height,
        backgroundColor: color,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        color: 'white',
        flexShrink: 0
      }}
    >
      <h2 className="text-5xl font-bold mb-8">{title}</h2>
      {children}
    </div>
  );
};

export default HorizontalPanel;