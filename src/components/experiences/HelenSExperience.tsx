import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import StaticPointCloudEngine, { StaticPointCloudConfig } from '../engines/StaticPointCloudEngine';
import { useARPositioning } from '../../hooks/useARPositioning';

interface HelenExperienceProps {
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

const HelenExperience: React.FC<HelenExperienceProps> = ({ 
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

  const renderIdRef = useRef(Math.random().toString(36).substr(2, 9));
  console.log(`🔄 HelenExperience: Component render (ID: ${renderIdRef.current})`);
  
  console.log('🔍 HelenExperience props:', {
    isUniversalMode,
    sharedARPositioning: !!sharedARPositioning,
    arPosition: arPosition.toArray()
  });

  // =================================================================
  // AR POSITIONING SYSTEM
  // =================================================================
  const newPositioningSystem = sharedARPositioning || useARPositioning();
  const {
    positionObject: newPositionObject,
    getPosition: newGetPosition,
    isReady: newSystemReady,
    debugMode: newDebugMode
  } = newPositioningSystem;

  // =================================================================
  // STATE AND REFS
  // =================================================================
  
  const modelRef = useRef<THREE.Points | null>(null);
  const activeScaleRef = useRef<number>(1);
  
  const [isEngineReady, setIsEngineReady] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Helen Fowler-specific configuration (memoized)
  const helenConfig: StaticPointCloudConfig = useMemo(() => ({
    modelName: 'helen_s' as const,
    knownMaxDim: 7.5,
    knownCenter: new THREE.Vector3(0, 0, 0),
    targetScale: 2.0 / 7.5,
    pointSize: 1.5,
    pointDensity: 0.8,
    fallbackColor: 0x9b59b6, // Purple for Helen
    rotationCorrection: new THREE.Euler(-Math.PI / 2, 0, 0),
    centerModel: true,
    maxVertices: 100000 // Helen-specific vertex limit
  }), []); // Config never changes

  // =================================================================
  // POSITIONING FUNCTIONS (MEMOIZED)
  // =================================================================
  
  const positionModel = useCallback((model: THREE.Points) => {
    if (!newSystemReady) {
      console.log('🧪 HELEN: Positioning system not ready yet');
      return false;
    }
    
    if (isUniversalMode) {
      console.log('🌐 HELEN: Universal Mode - using debug position');
      return newPositionObject(model, 'helen_s', { useDebugOverride: true });
    }
    
    return newPositionObject(model, 'helen_s');
  }, [newSystemReady, isUniversalMode, newPositionObject]);

  const handleModelReset = useCallback((model: THREE.Points) => {
    console.log('🔄 HELEN: Resetting model position');
    
    if (isUniversalMode) {
      newPositionObject(model, 'helen_s', { useDebugOverride: true });
    } else {
      newPositionObject(model, 'helen_s');
    }
    
    activeScaleRef.current = model.scale.x;
    console.log('🔄 HELEN: Reset completed with scale:', model.scale.x);
  }, [isUniversalMode, newPositionObject]);

  // =================================================================
  // ENGINE CALLBACKS (MEMOIZED)
  // =================================================================

  const handleModelLoaded = useCallback((pointCloud: THREE.Points) => {
    console.log('🎯 HelenExperience: Model loaded from engine');

      // ADD THIS DEBUG INFO:
  console.log('🔍 HELEN Model Debug:', {
    vertices: pointCloud.geometry.attributes.position.count,
    hasColors: !!pointCloud.geometry.attributes.color,
    material: pointCloud.material,
    scale: pointCloud.scale.toArray(),
    boundingBox: pointCloud.geometry.boundingBox,
    visible: pointCloud.visible
  });
  
  // Compute bounding box if not already computed
  if (!pointCloud.geometry.boundingBox) {
    pointCloud.geometry.computeBoundingBox();
    console.log('🔍 HELEN Computed bounding box:', pointCloud.geometry.boundingBox);
  }





    modelRef.current = pointCloud;
    activeScaleRef.current = pointCloud.scale.x;
    
    // Position the model using AR positioning system
    if (newSystemReady) {
      positionModel(pointCloud);
    }
    
    setIsEngineReady(true);
  }, [newSystemReady, positionModel]);

  const handleEngineReady = useCallback(() => {
    console.log('🎉 HelenExperience: Engine ready');
    onExperienceReady?.();
  }, [onExperienceReady]);

  const handleEngineError = useCallback((errorMessage: string) => {
    console.error('❌ HelenExperience: Engine error:', errorMessage);
    setError(errorMessage);
  }, []);

  // =================================================================
  // MEMOIZED ENGINE COMPONENT
  // =================================================================

  const staticEngine = useMemo(() => {
    console.log('🔧 HelenExperience: Creating memoized StaticPointCloudEngine');
    
    return (
      <StaticPointCloudEngine
        config={helenConfig}
        scene={arScene}
        enabled={true}
        onModelLoaded={handleModelLoaded}
        onLoadingProgress={setLoadingProgress}
        onError={handleEngineError}
        onReady={handleEngineReady}
      />
    );
  }, [
    helenConfig,
    arScene,
    handleModelLoaded,
    handleEngineError,
    handleEngineReady
  ]); // Only recreate if these actually change

  // =================================================================
  // GESTURE HANDLERS
  // =================================================================

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
          console.log(`🎮 HELEN: Rotation applied`, {
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
          console.log(`🔍 HELEN: Scale applied`, {
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
        console.log(`🔄 HELEN: Reset triggered`);
        if (modelRef.current) {
          handleModelReset(modelRef.current);
        }
      });
    }

    // Register swipe handlers
    if (onSwipeUp) {
      onSwipeUp(() => {
        console.log(`👆 HELEN: Swipe up`);
        // Add Helen-specific swipe behavior here
      });
    }

    if (onSwipeDown) {
      onSwipeDown(() => {
        console.log(`👇 HELEN: Swipe down`);
        // Add Helen-specific swipe behavior here
      });
    }
  }, []); // No dependencies - register once

  // Handle elevation changes (memoized)
  const handleElevationChanged = useCallback(() => {
    console.log('🧪 HelenExperience: Elevation changed');
    
    if (modelRef.current) {
      if (isUniversalMode) {
        const success = newPositionObject(modelRef.current, 'helen_s', { useDebugOverride: true });
        console.log('🧪 HELEN: UNIVERSAL MODE - Model repositioned:', success);
      } else {
        const success = newPositionObject(modelRef.current, 'helen_s');
        console.log('🧪 HELEN: NORMAL MODE - Model repositioned:', success);
      }
    }
  }, [isUniversalMode, newPositionObject]);

  useEffect(() => {
    if (onElevationChanged) {
      onElevationChanged(handleElevationChanged);
    }
  }, [onElevationChanged, handleElevationChanged]);

  // Monitor debug mode changes
  useEffect(() => {
    if (newDebugMode !== undefined) {
      console.log('🔗 HELEN: Debug mode changed to:', newDebugMode);
      
      (window as any).arTestingOverride = newDebugMode;
      
      setTimeout(() => {
        if (modelRef.current && newSystemReady) {
          console.log('🔗 HELEN: Repositioning after debug mode change...');
          const success = newPositionObject(modelRef.current, 'helen_s');
          console.log('🔗 HELEN: Positioning result:', success);
        }
      }, 100);
    }
  }, [newDebugMode, newSystemReady, newPositionObject]);

  // Wait for positioning system to be ready
  useEffect(() => {
    if (newSystemReady && modelRef.current && isEngineReady) {
      console.log('🧪 HELEN: Positioning system ready, positioning model...');
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
          Loading HELEN FOWLER Model... {loadingProgress.toFixed(0)}%
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
          Error loading HELEN FOWLER Model
          <br />
          <small>{error}</small>
        </div>
      )}
    </>
  );
};

export default HelenExperience;