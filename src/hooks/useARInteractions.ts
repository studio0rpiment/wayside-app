// src/hooks/useARInteractions.ts
import { useRef, useCallback, useEffect, useState } from 'react';

export interface ARInteractionCallbacks {
  onModelRotate?: (deltaX: number, deltaY: number, deltaZ?: number) => void;
  onModelScale?: (scaleFactor: number) => void;
  onModelReset?: () => void;
  onDebugSwipeUp?: () => void;
  onDebugSwipeDown?: () => void;
}

export interface ARInteractionOptions {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  callbacks: ARInteractionCallbacks;
  enableDebugSwipes?: boolean;
  debugMode?: boolean;
}

// NEW: Transform state interface
export interface TransformState {
  rotation: { x: number; y: number; z: number };
  scale: number;
  totalRotations: number; // How many rotation gestures applied
  totalScales: number;    // How many scale gestures applied
}

export interface ARInteractionReturn {
  attachListeners: () => void;
  detachListeners: () => void;
  isListening: boolean;
  
  // NEW: Current transform values for display
  currentTransforms: TransformState;
  resetTransforms: () => void;
}

/**
 * Custom hook for handling all AR touch interactions
 * Consolidates model gestures and debug panel swipes
 * NOW TRACKS: Current transform values for display purposes
 */
export function useARInteractions({
  canvasRef,
  callbacks,
  enableDebugSwipes = true,
  debugMode = false
}: ARInteractionOptions): ARInteractionReturn {

  // Touch state refs (unchanged)
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const lastTouchX = useRef(0);
  const lastTouchY = useRef(0);
  const lastTapTime = useRef(0);
  const lastMultiTouchTime = useRef(0);
  const initialPinchDistance = useRef(0);
  const initialTwoFingerAngle = useRef(0);
  const previousTwoFingerAngle = useRef(0);
  
  // Swipe detection refs (unchanged)
  const swipeStartY = useRef(0);
  const swipeStartTime = useRef(0);
  
  // State tracking (unchanged)
  const isListeningRef = useRef(false);

  // NEW: Transform tracking state
  const [currentTransforms, setCurrentTransforms] = useState<TransformState>({
    rotation: { x: 0, y: 0, z: 0 },
    scale: 1.0,
    totalRotations: 0,
    totalScales: 0
  });

  // Constants (unchanged)
  const DOUBLE_TAP_DELAY = 300;
  const MIN_SWIPE_DISTANCE = 50;
  const MAX_SWIPE_TIME = 500;
  const MIN_TWO_FINGER_DISTANCE = 100;
  const MULTI_TOUCH_COOLDOWN = 200;

  // Debug logging (unchanged)
  const debugLog = useCallback((message: string, data?: any) => {
    if (debugMode) {
      console.log(`🤏 useARInteractions: ${message}`, data || '');
    }
  }, [debugMode]);

  // NEW: Reset transforms function
  const resetTransforms = useCallback(() => {
    setCurrentTransforms({
      rotation: { x: 0, y: 0, z: 0 },
      scale: 1.0,
      totalRotations: 0,
      totalScales: 0
    });
    debugLog('Transforms reset');
  }, [debugLog]);

  // NEW: Enhanced rotation callback that tracks values
  const handleRotationWithTracking = useCallback((deltaX: number, deltaY: number, deltaZ: number = 0) => {
    // Call the original callback
    if (callbacks.onModelRotate) {
      callbacks.onModelRotate(deltaX, deltaY, deltaZ);
    }
    
    // Update our tracking state
    setCurrentTransforms(prev => ({
      ...prev,
      rotation: {
        x: prev.rotation.x + deltaY, // Note: deltaY affects X rotation
        y: prev.rotation.y + deltaX, // Note: deltaX affects Y rotation  
        z: prev.rotation.z + deltaZ
      },
      totalRotations: prev.totalRotations + 1
    }));
    
    debugLog('Rotation tracked', { deltaX, deltaY, deltaZ });
  }, [callbacks.onModelRotate, debugLog]);

  // NEW: Enhanced scale callback that tracks values
  const handleScaleWithTracking = useCallback((scaleFactor: number) => {
    // Call the original callback
    if (callbacks.onModelScale) {
      callbacks.onModelScale(scaleFactor);
    }
    
    // Update our tracking state
    setCurrentTransforms(prev => ({
      ...prev,
      scale: Math.max(0.1, Math.min(10, prev.scale * scaleFactor)), // Clamp scale
      totalScales: prev.totalScales + 1
    }));
    
    debugLog('Scale tracked', { scaleFactor });
  }, [callbacks.onModelScale, debugLog]);

  // NEW: Enhanced reset callback that tracks values
  const handleResetWithTracking = useCallback(() => {
    // Call the original callback
    if (callbacks.onModelReset) {
      callbacks.onModelReset();
    }
    
    // Reset our tracking state
    resetTransforms();
    
    debugLog('Reset tracked');
  }, [callbacks.onModelReset, resetTransforms, debugLog]);

  // Touch start handler (unchanged)
  const handleTouchStart = useCallback((event: TouchEvent) => {
    const now = Date.now();
    const timeSince = now - lastTapTime.current;
    const timeSinceMultiTouch = now - lastMultiTouchTime.current;

    debugLog('Touch start', { 
      touches: event.touches.length, 
      timeSince, 
      timeSinceMultiTouch 
    });

    if (event.touches.length === 1) {
      // Single finger handling
      const touch = event.touches[0];
      touchStartX.current = touch.clientX;
      touchStartY.current = touch.clientY;
      lastTouchX.current = touch.clientX;
      lastTouchY.current = touch.clientY;

      // Swipe detection setup (for debug panels)
      if (enableDebugSwipes) {
        swipeStartY.current = touch.clientY;
        swipeStartTime.current = now;
      }

      // Double-tap detection (takes priority over cooldown)
      if (timeSince < DOUBLE_TAP_DELAY && timeSince > 0) {
        debugLog('Double tap detected - reset');
        handleResetWithTracking(); // NEW: Use tracking version
        event.preventDefault();
        lastTapTime.current = 0;
        return;
      }

      // Multi-touch cooldown (ignore single touches just after multi-touch)
      if (timeSinceMultiTouch < MULTI_TOUCH_COOLDOWN) {
        debugLog('Ignoring single finger - multi-touch cooldown');
        return;
      }

      lastTapTime.current = now;
      
    } else if (event.touches.length === 2) {
      // Two finger handling
      lastTapTime.current = 0; // Clear any pending double-tap
      
      const touch1 = event.touches[0];
      const touch2 = event.touches[1];
      
      const fingerDistance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      
      if (fingerDistance > MIN_TWO_FINGER_DISTANCE) {
        debugLog(`Two fingers detected: ${fingerDistance.toFixed(0)}px apart`);
      }
      
      initialPinchDistance.current = fingerDistance;
      initialTwoFingerAngle.current = Math.atan2(
        touch2.clientY - touch1.clientY, 
        touch2.clientX - touch1.clientX
      );
      previousTwoFingerAngle.current = initialTwoFingerAngle.current;

    } else {
      // More than 2 fingers: clear tap detection
      lastTapTime.current = 0;
      debugLog('More than 2 fingers detected');
    }
  }, [handleResetWithTracking, enableDebugSwipes, debugLog]);

  // Touch move handler - MODIFIED to use tracking callbacks
  const handleTouchMove = useCallback((event: TouchEvent) => {
    if (event.touches.length === 1) {
      // Single finger drag: model rotation
      const now = Date.now();
      const timeSinceMultiTouch = now - lastMultiTouchTime.current;
      
      if (timeSinceMultiTouch < MULTI_TOUCH_COOLDOWN) {
        debugLog('Ignoring single finger move - multi-touch cooldown');
        return;
      }

      const touch = event.touches[0];
      const currentX = touch.clientX;
      const currentY = touch.clientY;
      
      const deltaX = currentX - lastTouchX.current;
      const deltaY = currentY - lastTouchY.current;

      // Only rotate if significant movement
      if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
        const rotDeltaX = deltaX * 0.01;
        const rotDeltaY = deltaY * 0.01;
        
        debugLog('Single finger rotation', { deltaX, deltaY, rotDeltaX, rotDeltaY });
        
        handleRotationWithTracking(rotDeltaX, rotDeltaY, 0); // NEW: Use tracking version
      }
      
      lastTouchX.current = currentX;
      lastTouchY.current = currentY;
      
    } else if (event.touches.length === 2) {
      // Two finger Z-rotation
      const touch1 = event.touches[0];
      const touch2 = event.touches[1];
      
      const currentAngle = Math.atan2(
        touch2.clientY - touch1.clientY, 
        touch2.clientX - touch1.clientX
      );
      
      const rotationDelta = currentAngle - previousTwoFingerAngle.current;
      
      if (Math.abs(rotationDelta) > 0.02) {
        const zRotDelta = rotationDelta * 0.5;
        
        debugLog('Two finger Z-rotation', { rotationDelta, zRotDelta });
        
        handleRotationWithTracking(0, 0, zRotDelta); // NEW: Use tracking version
      }
      
      previousTwoFingerAngle.current = currentAngle;
    }
    
    event.preventDefault();
  }, [handleRotationWithTracking, debugLog]);

  // Touch end handler (unchanged)
  const handleTouchEnd = useCallback((event: TouchEvent) => {
    const now = Date.now();
    
    debugLog('Touch end', { 
      remainingTouches: event.touches.length,
      targetTouches: event.targetTouches.length 
    });

    // Track when multi-touch gestures end
    if (event.touches.length === 0) {
      // All fingers lifted
      lastMultiTouchTime.current = now;
      debugLog('All touches ended');
      
      // Check for swipe gesture (debug panels)
      if (enableDebugSwipes && callbacks.onDebugSwipeUp && callbacks.onDebugSwipeDown) {
        const swipeEndY = event.changedTouches[0]?.clientY;
        if (swipeEndY !== undefined) {
          const swipeDistance = swipeEndY - swipeStartY.current;
          const swipeTime = now - swipeStartTime.current;
          
          if (swipeTime < MAX_SWIPE_TIME) {
            if (swipeDistance > MIN_SWIPE_DISTANCE) {
              debugLog('Swipe down detected');
              callbacks.onDebugSwipeDown();
            } else if (swipeDistance < -MIN_SWIPE_DISTANCE) {
              debugLog('Swipe up detected');
              callbacks.onDebugSwipeUp();
            }
          }
        }
      }
      
    } else if (event.touches.length === 1) {
      // Went from multi-touch to single touch
      lastMultiTouchTime.current = now;
      debugLog('Multi-touch ended, one finger remains');
    }
  }, [callbacks.onDebugSwipeUp, callbacks.onDebugSwipeDown, enableDebugSwipes, debugLog]);

  // Attach event listeners (unchanged)
  const attachListeners = useCallback(() => {
    if (!canvasRef.current || isListeningRef.current) {
      debugLog('Cannot attach listeners', { 
        hasCanvas: !!canvasRef.current, 
        isListening: isListeningRef.current 
      });
      return;
    }

    const canvas = canvasRef.current;
    
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
    
    isListeningRef.current = true;
    debugLog('Touch listeners attached');
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, debugLog]);

  // Detach event listeners (unchanged)
  const detachListeners = useCallback(() => {
    if (!canvasRef.current || !isListeningRef.current) {
      debugLog('Cannot detach listeners', { 
        hasCanvas: !!canvasRef.current, 
        isListening: isListeningRef.current 
      });
      return;
    }

    const canvas = canvasRef.current;
    
    canvas.removeEventListener('touchstart', handleTouchStart);
    canvas.removeEventListener('touchmove', handleTouchMove);
    canvas.removeEventListener('touchend', handleTouchEnd);
    
    isListeningRef.current = false;
    debugLog('Touch listeners detached');
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, debugLog]);

  // Auto-attach on canvas ready (unchanged)
  useEffect(() => {
    if (canvasRef.current && !isListeningRef.current) {
      attachListeners();
    }
    
    return () => {
      detachListeners();
    };
  }, [attachListeners, detachListeners]);

  // Cleanup on unmount (unchanged)
  useEffect(() => {
    return () => {
      if (isListeningRef.current) {
        detachListeners();
      }
    };
  }, [detachListeners]);

  return {
    attachListeners,
    detachListeners,
    isListening: isListeningRef.current,
    
    // NEW: Export current transform values
    currentTransforms,
    resetTransforms
  };
}