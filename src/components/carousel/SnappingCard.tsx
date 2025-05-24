import React, { ReactNode } from 'react';
import classNames from 'classnames';

interface CardProps {
  title: string;
  subtitle?: string;
  color: string;
  children?: ReactNode;
  className?: string;
  index?: number;
  height?: string | number;
}

const SnappingCard: React.FC<CardProps> = ({
  title,
  subtitle,
  color,
  children,
  className = '',
  index,
  height = '80%',
}) => {
  return (
    <div 
      className={classNames("carousel-card", className)}
      style={{ 
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '1rem',
        position: 'relative',
      }}
    >
      <div
        className="card-inner rounded-xl shadow-lg"
        style={{
          width: '90%',
          height: height,
          backgroundColor: color,
          display: 'flex',
          flexDirection: 'column',
          padding: '0rem',
          position: 'relative',
          borderRadius: '1rem',
          boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
          color: 'white',
          overflow: 'hidden',
        }}
      >
        {title && <h3 className="text-3xl font-bold mb-2">{title}</h3>}
        
        {subtitle && (
          <h4 className="text-xl opacity-80 mb-6">{subtitle}</h4>
        )}
        
        <div className="card-content flex-grow overflow-auto">
          {children}
        </div>
        
        {/* Card number indicator */}
        {index !== undefined && (
          <div className="bg-black bg-opacity-50 px-3 py-1 rounded-full text-sm absolute bottom-4 right-4">
            {/* Optional: show index */}
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(SnappingCard);