import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import StaticPointCloudEngine, { StaticPointCloudConfig } from '../engines/StaticPointCloudEngine';
import { useARPositioning } from '../../hooks/useARPositioning';

interface MacExperienceProps {
  onClose: () => void;
  onNext?: () => void;
  // REQUIRED: AR Scene and Camera
  arScene: THREE.Scene;
  arCamera: THREE.PerspectiveCamera;
  arPosition: THREE.Vector3;
  coordinateScale?: number;
  onModelRotate?: (handler: (deltaX: number, deltaY: number, deltaZ: number) => void) => void;
  onModelScale?: (handler: (scaleFactor: number) => void) => void;
  onModelReset?: (handler: () => void) => void;
  onSwipeUp?: (handler: () => void) => void;
  onSwipeDown?: (handler: () => void) => void;
  onExperienceReady?: () => void;
  onElevationChanged?: (handler: () => void) => void;
  sharedARPositioning?: ReturnType<typeof useARPositioning>;
  isUniversalMode?: boolean;
}

const MacExperience: React.FC<MacExperienceProps> = ({ 
  onClose, 
  onNext,
  arScene,
  arCamera,
  arPosition,
  coordinateScale = 1.0,
  onModelRotate,
  onModelScale,
  onModelReset,
  onSwipeUp,
  onSwipeDown,
  onExperienceReady,
  onElevationChanged,
  sharedARPositioning,
  isUniversalMode = false 
}) => {

  // =================================================================
  // RENDER DEBUG IF NEEDED
  // =================================================================

  // const renderIdRef = useRef(Math.random().toString(36).substr(2, 9));
  // console.log(`🔄 MacExperience: Component render (ID: ${renderIdRef.current})`);
  
  // console.log('🔍 MacExperience props:', {
  //   isUniversalMode,
  //   sharedARPositioning: !!sharedARPositioning,
  //   arPosition: arPosition.toArray()
  // });

  // =================================================================
  // NEW WORLD COORDINATE POSITIONING SYSTEM
  // =================================================================
  const newPositioningSystem = sharedARPositioning || useARPositioning();
  const {
    positionObject: newPositionObject,
    getPosition: newGetPosition,
    adjustGlobalElevation: newAdjustElevation,
    isReady: newSystemReady,
    userPosition: newUserPosition,
    debugMode: newDebugMode,
    getDebugInfo: newGetDebugInfo
  } = newPositioningSystem;

  // =================================================================
  // STATE AND REFS
  // =================================================================
  
  // Point cloud reference (from engine)
  const modelRef = useRef<THREE.Points | null>(null);
  const activeScaleRef = useRef<number>(1);
  
  // Loading state
  const [isEngineReady, setIsEngineReady] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Mac-specific configuration for the engine (matches original MacExperience)
  const macConfig: StaticPointCloudConfig = useMemo(() => ({
    modelName: 'mac' as const,
    knownMaxDim: 13.2659,
    knownCenter: new THREE.Vector3(0.357610, -0.017726, 4.838261),
    targetScale: 2.5 / 13.2659,
    pointSize: 2.0,
    pointDensity: 0.7,
    fallbackColor: 0xff6b6b,
    rotationCorrection: new THREE.Euler(-Math.PI / 2, 0, 0), // Z-up to Y-up (matches original)
    centerModel: true,
    maxVertices: 60000
  }), []); // Config never changes

  // =================================================================
  // POSITIONING SYSTEM INTERFACE
  // =================================================================
  
  const positionModel = useCallback((model: THREE.Points) => {
    if (!newSystemReady) {
      console.log('🧪 NEW: Hook not ready yet, skipping positioning');
      return false;
    }
    
    if (isUniversalMode) {
      console.log('🌐 Universal Mode: Forcing debug position for Mac');
      const success = newPositionObject(model, 'mac', { useDebugOverride: true });
      return success;
    }
    
    const success = newPositionObject(model, 'mac');
    return success;
  }, [newSystemReady, isUniversalMode, newPositionObject]);

  const handleModelReset = useCallback((model: THREE.Points) => {
    console.log('🔄 NEW SYSTEM: Resetting model');
    
    if (isUniversalMode) {
      newPositionObject(model, 'mac', { useDebugOverride: true });
    } else {
      newPositionObject(model, 'mac');
    }
    
    // Store the final scale after positioning system applies its changes
    activeScaleRef.current = model.scale.x;
    console.log('🔄 NEW: Reset completed with scale:', model.scale.x);
  }, [isUniversalMode, newPositionObject]);

  const getPositionInfo = useCallback(() => {
    return newGetPosition('mac');
  }, [newGetPosition]);

  // =================================================================
  // ENGINE CALLBACKS (MEMOIZED)
  // =================================================================

  const handleModelLoaded = useCallback((pointCloud: THREE.Points) => {
    console.log('🎯 MacExperience: Model loaded from engine');
    modelRef.current = pointCloud;
    
    // Store initial scale
    activeScaleRef.current = pointCloud.scale.x;
    
    // Position the model using AR positioning system
    if (newSystemReady) {
      positionModel(pointCloud);
    }
    
    setIsEngineReady(true);
  }, [newSystemReady, positionModel]);

  const handleEngineReady = useCallback(() => {
    console.log('🎉 MacExperience: Engine ready');
    onExperienceReady?.();
  }, [onExperienceReady]);

  const handleEngineError = useCallback((errorMessage: string) => {
    console.error('❌ MacExperience: Engine error:', errorMessage);
    setError(errorMessage);
  }, []);

  // =================================================================
  // MEMOIZED ENGINE COMPONENT
  // =================================================================

  const staticEngine = useMemo(() => {
    console.log('🔧 MacExperience: Creating memoized StaticPointCloudEngine');
    
    return (
      <StaticPointCloudEngine
        config={macConfig}
        scene={arScene}
        enabled={true}
        onModelLoaded={handleModelLoaded}
        onLoadingProgress={setLoadingProgress}
        onError={handleEngineError}
        onReady={handleEngineReady}
      />
    );
  }, [
    macConfig,
    arScene,
    handleModelLoaded,
    handleEngineError,
    handleEngineReady
  ]); // Only recreate if these actually change

  // =================================================================
  // GESTURE HANDLERS
  // =================================================================

  // Register gesture handlers on mount
  useEffect(() => {
    // Register rotation handler
    if (onModelRotate) {
      onModelRotate((deltaX: number, deltaY: number, deltaZ: number = 0) => {
        if (modelRef.current) {
          modelRef.current.rotation.y += deltaX;
          modelRef.current.rotation.x += deltaY;
          if (deltaZ !== 0) {
            modelRef.current.rotation.z += deltaZ;
          }
          console.log(`🎮 Rotation applied:`, {
            deltaX, deltaY, deltaZ,
            currentRotation: modelRef.current.rotation.toArray()
          });
        }
      });
    }

    // Register scale handler
    if (onModelScale) {
      onModelScale((scaleFactor: number) => {
        if (modelRef.current) {
          const currentScale = modelRef.current.scale.x;
          const newScale = Math.max(0.1, Math.min(10, currentScale * scaleFactor));
          modelRef.current.scale.setScalar(newScale);
          console.log(`🔍 Scale applied:`, {
            scaleFactor,
            currentScale: currentScale.toFixed(3),
            newScale: newScale.toFixed(3)
          });
        }
      });
    }

    // Register reset handler
    if (onModelReset) {
      onModelReset(() => {
        console.log(`🔄 RESET triggered`);
        if (modelRef.current) {
          handleModelReset(modelRef.current);
        }
      });
    }

    // Register swipe handlers
    if (onSwipeUp) {
      onSwipeUp(() => {
        console.log(`👆 Swipe up`);
      });
    }

    if (onSwipeDown) {
      onSwipeDown(() => {
        console.log(`👇 Swipe down`);
      });
    }
  }, []); // No dependencies - register once

  // Register elevation change handler
  useEffect(() => {
    if (onElevationChanged) {
      onElevationChanged(handleElevationChanged);
    }
  }, [onElevationChanged]);

  // Handle elevation changes from ArCameraComponent debug panel
  const handleElevationChanged = useCallback(() => {
    console.log('🧪 MacExperience: handleElevationChanged called!');
    
    if (modelRef.current) {
      if (isUniversalMode) {
        const success = newPositionObject(modelRef.current, 'mac', { useDebugOverride: true });
        console.log('🧪 MacExperience: UNIVERSAL MODE - Model repositioned:', success);
      } else {
        const success = newPositionObject(modelRef.current, 'mac');
        console.log('🧪 MacExperience: NORMAL MODE - Model repositioned:', success);
      }
    } else {
      console.warn('🧪 MacExperience: modelRef.current is null, cannot reposition');
    }
  }, [isUniversalMode, newPositionObject]);

  // Monitor debug mode changes and reposition accordingly
  useEffect(() => {
    if (newDebugMode !== undefined) {
      console.log('🔗 newDebugMode changed to:', newDebugMode);
      
      (window as any).arTestingOverride = newDebugMode;
      
      // Add a small delay to ensure the anchor manager picks up the change
      setTimeout(() => {
        if (modelRef.current && newSystemReady) {
          console.log('🔗 Calling newPositionObject after debug mode change...');
          const success = newPositionObject(modelRef.current, 'mac');
          console.log('🔗 Positioning result:', success);
        }
      }, 100);
    }
  }, [newDebugMode]);

  // Wait for the positioning system to be ready and position the model
  useEffect(() => {
    if (newSystemReady && modelRef.current && isEngineReady) {
      console.log('🧪 NEW: Hook became ready, positioning model now...');
      positionModel(modelRef.current);
    }
  }, [newSystemReady, isEngineReady, positionModel]);

  // =================================================================
  // RENDER
  // =================================================================

  return (
    <>
      {/* Memoized Static Point Cloud Engine */}
      {staticEngine}

      {/* Loading indicator */}
      {!isEngineReady && !error && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          color: 'white',
          padding: '20px',
          borderRadius: '10px',
          zIndex: 1003,
          textAlign: 'center'
        }}>
          Loading MAC Model... {loadingProgress.toFixed(0)}%
          <br />
          <small>Using StaticPointCloudEngine{isUniversalMode ? ' - Universal Mode' : ''}</small>
        </div>
      )}

      {/* Error indicator */}
      {error && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          color: '#ff6666',
          padding: '20px',
          borderRadius: '10px',
          zIndex: 1003,
          textAlign: 'center'
        }}>
          Error loading MAC Model
          <br />
          <small>{error}</small>
        </div>
      )}
    </>
  );
};

export default MacExperience;