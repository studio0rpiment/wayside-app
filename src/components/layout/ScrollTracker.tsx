import React from 'react';
import { useScroll } from '../../context/ScrollContext';

interface ScrollTrackerProps {
  showDetails?: boolean;
}

const ScrollTracker: React.FC<ScrollTrackerProps> = ({ showDetails = false }) => {
  const { 
    scrollY, 
    scrollProgress, 
    scrollDirection, 
    activeSection, 
    isScrolling 
  } = useScroll();
  
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col space-y-2">
      {/* Visual progress bar */}
      <div className="w-16 h-16 bg-black bg-opacity-80 rounded-full flex items-center justify-center shadow-lg">
        <div className="text-white font-bold text-sm">
          {Math.round(scrollProgress)}%
        </div>
      </div>
      
      {/* Detailed info (optional) */}
      {showDetails && (
        <div className="bg-black bg-opacity-80 text-white text-sm p-3 rounded-lg max-w-xs shadow-lg border border-gray-700">
          <div className="mb-1"><span className="font-semibold">Direction:</span> {scrollDirection}</div>
          <div className="mb-1"><span className="font-semibold">Position:</span> {Math.round(scrollY)}px</div>
          <div className="mb-1"><span className="font-semibold">Scrolling:</span> {isScrolling ? 'Yes' : 'No'}</div>
          <div className="mb-1"><span className="font-semibold">Section:</span> {activeSection?.id || 'None'}</div>
          <div><span className="font-semibold">Type:</span> {activeSection?.type || 'None'}</div>
        </div>
      )}
    </div>
  );
};

export default ScrollTracker;