import React, { ReactNode } from 'react';
import classNames from 'classnames';

interface CardProps {
  title: string;
  subtitle?: string;
  color: string;
  children?: ReactNode;
  className?: string;
  index?: number;
}

const SimplifiedCard: React.FC<CardProps> = ({
  title,
  subtitle,
  color,
  children,
  className = '',
  index,
}) => {
  return (
    <div 
      className={classNames("carousel-card", className)}
      style={{ 
        width: '100vw',
        height: '100%',
        backgroundColor: color,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        color: 'white',
        padding: '2rem',
        flexShrink: 0
      }}
    >
      <h3 className="text-3xl font-bold mb-2">{title}</h3>
      
      {subtitle && (
        <h4 className="text-xl opacity-80 mb-6">{subtitle}</h4>
      )}
      
      <div className="card-content">
        {children || (
          <p className="text-xl">Card {index || ''} Content</p>
        )}
      </div>
      
      {/* Card number indicator */}
      {index !== undefined && (
        <div className="bg-black bg-opacity-50 px-3 py-1 rounded-full text-sm absolute bottom-4 right-4">
          {index}
        </div>
      )}
    </div>
  );
};

export default SimplifiedCard;