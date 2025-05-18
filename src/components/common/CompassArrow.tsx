// SVG Compass Component with Transparent Fill
const CompassArrow: React.FC<{ direction: number, size?: number }> = ({ 
  direction, 
  size = 40  // Default size, easily adjustable
}) => {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 100 100" 
      style={{ 
        margin: '0 auto',
        display: 'block'
      }}
    >
      {/* Outer circle - now with transparent fill */}
      <circle 
        cx="50" 
        cy="50" 
        r="48" 
        fill="transparent" 
        stroke="var(--color-blue)" 
        strokeWidth="2"
      />
      
      {/* North label */}
      <text 
        x="50" 
        y="15" 
        textAnchor="middle" 
        fill="var(--color-light)" 
        fontSize="14"
        fontWeight="bold"
      >
        N
      </text>
      
      {/* Arrow group - will be rotated */}
      <g transform={`rotate(${direction}, 50, 50)`}>
        {/* Arrow line */}
        <line 
          x1="50" 
          y1="50" 
          x2="50" 
          y2="20" 
          stroke="var(--color-blue)" 
          strokeWidth="2" 
        />
        
        {/* Arrow head */}
        <polygon 
          points="50,10 44,22 56,22" 
          fill="var(--color-blue)" 
        />
      </g>
    </svg>
  );
};

export default CompassArrow;
