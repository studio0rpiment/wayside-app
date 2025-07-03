// Updated MacExperience.tsx - Receives position from ExperienceManager (single source)

import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import StaticPointCloudEngine, { StaticPointCloudConfig } from '../engines/StaticPointCloudEngine';

interface MacExperienceProps {
  // Core AR props - position comes from ExperienceManager
  arScene: THREE.Scene;
  arCamera: THREE.PerspectiveCamera;
  arPosition: THREE.Vector3; // ← SINGLE SOURCE: Position from ExperienceManager
  
  // Experience control
  onClose: () => void;
  onNext?: () => void;
  onExperienceReady?: () => void;
  
  // Gesture handlers
  onModelRotate?: (handler: (deltaX: number, deltaY: number, deltaZ: number) => void) => void;
  onModelScale?: (handler: (scaleFactor: number) => void) => void;
  onModelReset?: (handler: () => void) => void;
  onSwipeUp?: (handler: () => void) => void;
  onSwipeDown?: (handler: () => void) => void;
  
  // Elevation adjustment (for debug panel)
  onElevationChanged?: (handler: () => void) => void;
  
  // Mode flags
  isUniversalMode?: boolean;
  
  // ❌ REMOVED: sharedARPositioning - no longer needed
  // ❌ REMOVED: coordinateScale - handled by positioning system
}

const MacExperience: React.FC<MacExperienceProps> = ({ 
  arScene,
  arCamera,
  arPosition, // ← SINGLE SOURCE: Position calculated by ExperienceManager
  onClose, 
  onNext,
  onModelRotate,
  onModelScale,
  onModelReset,
  onSwipeUp,
  onSwipeDown,
  onExperienceReady,
  onElevationChanged,
  isUniversalMode = false 
}) => {

  const renderIdRef = useRef(Math.random().toString(36).substr(2, 9));
  console.log(`🔄 MacExperience: Component render (ID: ${renderIdRef.current})`);

    useEffect(() => {
    console.log('🔧 MacExperience received props:', {
      hasArPosition: !!arPosition,
      arPosition: arPosition?.toArray(),
      isUniversalMode,
      experienceType: 'mac'
    });
  }, [arPosition, isUniversalMode]);

  // =================================================================
  // USER TRANSFORM TRACKING
  // =================================================================
  
  // Track user-applied transforms separately from AR positioning
  const userTransformsRef = useRef({
    rotation: new THREE.Euler(0, 0, 0), // User's rotation deltas
    scale: 1.0,                         // User's scale multiplier
    hasUserChanges: false               // Flag to know if user made changes
  });

  // =================================================================
  // STATE AND REFS
  // =================================================================
  
  const modelRef = useRef<THREE.Points | null>(null);
  const [modelPositioned, setModelPositioned] = useState(false); // ← NEW: Track if model is positioned
  const activeScaleRef = useRef<number>(1);
  
  const [isEngineReady, setIsEngineReady] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Mac-specific configuration (memoized)
  const macConfig: StaticPointCloudConfig = useMemo(() => ({
    modelName: 'mac' as const,
    knownMaxDim: 13.2659,
    knownCenter: new THREE.Vector3(0.357610, -0.017726, 4.838261),
    targetScale: 2.5 / 13.2659,
    pointSize: 2.0,
    pointDensity: 0.7,
    fallbackColor: 0xff6b6b,
    rotationCorrection: new THREE.Euler(0, 0, 0),
    centerModel: true,
    maxVertices: 100000
  }), []);

  // =================================================================
  // SIMPLE POSITIONING - USES SINGLE SOURCE
  // =================================================================
  
  const positionModelWithSingleSource = useCallback((model: THREE.Points) => {
    if (!arPosition) {
      console.log('🎯 MAC: No AR position available yet');
      return false;
    }
    
    console.log('🎯 MAC: Positioning model using single source:', arPosition.toArray());
    
    // Apply the position from ExperienceManager (single source)
    model.position.copy(arPosition);
    
    // Apply Mac-specific rotation correction (built into config, applied by engine)
    // The engine already applies rotationCorrection from macConfig
    
    // Apply any existing user transforms on top
    if (userTransformsRef.current.hasUserChanges) {
      console.log('🔄 MAC: Reapplying user transforms after positioning', {
        userRotation: userTransformsRef.current.rotation.toArray(),
        userScale: userTransformsRef.current.scale
      });
      
      // Reapply user rotation
      model.rotation.x += userTransformsRef.current.rotation.x;
      model.rotation.y += userTransformsRef.current.rotation.y;
      model.rotation.z += userTransformsRef.current.rotation.z;
      
      // Reapply user scale
      const currentScale = model.scale.x;
      model.scale.setScalar(currentScale * userTransformsRef.current.scale);
    }
    
    model.updateMatrixWorld();
    console.log('✅ MAC: Model positioned at:', model.position.toArray());
    
    return true;
  }, [arPosition]);

  const handleModelReset = useCallback((model: THREE.Points) => {
    console.log('🔄 MAC: Resetting model (clearing user transforms)');
    
    // Clear user transforms
    userTransformsRef.current = {
      rotation: new THREE.Euler(0, 0, 0),
      scale: 1.0,
      hasUserChanges: false
    };
    
    // Reposition with fresh state
    positionModelWithSingleSource(model);
    
    activeScaleRef.current = model.scale.x;
    console.log('🔄 MAC: Reset completed');
  }, [positionModelWithSingleSource]);

  // =================================================================
  // ENGINE CALLBACKS (MEMOIZED)
  // =================================================================

  const handleModelLoaded = useCallback((pointCloud: THREE.Points) => {
    console.log('🎯 MacExperience: Model loaded from engine');
    modelRef.current = pointCloud;
    
    // Store initial scale
    activeScaleRef.current = pointCloud.scale.x;
    
    // Position the model using single source
    if (arPosition) {
      const success = positionModelWithSingleSource(pointCloud);
      if (success) {
        setModelPositioned(true);
         onExperienceReady?.();
      }
    }
    
    setIsEngineReady(true);
  }, [arPosition, positionModelWithSingleSource]);

const handleEngineReady = useCallback(() => {
  console.log('🎉 MacExperience: Engine ready');
  
}, []);

  const handleEngineError = useCallback((errorMessage: string) => {
    console.error('❌ MacExperience: Engine error:', errorMessage);
    setError(errorMessage);
  }, []);

  // =================================================================
  // POSITION MODEL WHEN AR POSITION BECOMES AVAILABLE
  // =================================================================
  
  useEffect(() => {
    if (arPosition && modelRef.current && isEngineReady && !modelPositioned) {
      console.log('🎯 MAC: AR position available, positioning model...');
      const success = positionModelWithSingleSource(modelRef.current);
      if (success) {
        setModelPositioned(true);
        onExperienceReady?.();
      }
    }
  }, [arPosition, isEngineReady, modelPositioned, positionModelWithSingleSource, onExperienceReady]);

  // =================================================================
  // MEMOIZED ENGINE COMPONENT
  // =================================================================

  const staticEngine = useMemo(() => {
    console.log('🔧 MacExperience: Creating memoized StaticPointCloudEngine');
    
    return (
      <StaticPointCloudEngine
        config={macConfig}
        scene={arScene}
        experienceId="mac"
        isUniversalMode={isUniversalMode}
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
    isUniversalMode,
    handleModelLoaded,
    handleEngineError,
    handleEngineReady
  ]);

  // =================================================================
  // GESTURE HANDLERS WITH TRANSFORM TRACKING
  // =================================================================

  useEffect(() => {
    // Register rotation handler
    if (onModelRotate) {
      onModelRotate((deltaX: number, deltaY: number, deltaZ: number = 0) => {
        if (modelRef.current) {
          // Apply rotation to model
          modelRef.current.rotation.y += deltaX;
          modelRef.current.rotation.x += deltaY;
          if (deltaZ !== 0) {
            modelRef.current.rotation.z += deltaZ;
          }
          
          // Track user changes
          userTransformsRef.current.rotation.y += deltaX;
          userTransformsRef.current.rotation.x += deltaY;
          userTransformsRef.current.rotation.z += deltaZ;
          userTransformsRef.current.hasUserChanges = true;
          
          console.log(`🎮 MAC: Rotation applied and tracked`, {
            deltaX, deltaY, deltaZ,
            currentRotation: modelRef.current.rotation.toArray(),
            userRotation: userTransformsRef.current.rotation.toArray()
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
          
          // Track user scale changes
          userTransformsRef.current.scale *= scaleFactor;
          userTransformsRef.current.scale = Math.max(0.1, Math.min(10, userTransformsRef.current.scale));
          userTransformsRef.current.hasUserChanges = true;
          
          console.log(`🔍 MAC: Scale applied and tracked`, {
            scaleFactor,
            currentScale: currentScale.toFixed(3),
            newScale: newScale.toFixed(3),
            userScale: userTransformsRef.current.scale.toFixed(3)
          });
        }
      });
    }

    // Register reset handler
    if (onModelReset) {
      onModelReset(() => {
        console.log(`🔄 MAC: Reset triggered`);
        if (modelRef.current) {
          handleModelReset(modelRef.current);
        }
      });
    }

    // Register swipe handlers
    if (onSwipeUp) {
      onSwipeUp(() => {
        console.log(`👆 MAC: Swipe up`);
      });
    }

    if (onSwipeDown) {
      onSwipeDown(() => {
        console.log(`👇 MAC: Swipe down`);
      });
    }
  }, []); // No dependencies - register once

  // =================================================================
  // ELEVATION CHANGE HANDLER (for debug panel adjustments)
  // =================================================================
  
  const handleElevationChanged = useCallback(() => {
    console.log('🧪 MacExperience: Elevation changed - repositioning with preserved transforms');
    
    if (modelRef.current && arPosition) {
      // Note: The arPosition from ExperienceManager should already include elevation changes
      // since it comes from the positioning system. But we can reposition to be safe.
      positionModelWithSingleSource(modelRef.current);
    }
  }, [arPosition, positionModelWithSingleSource]);

  useEffect(() => {
    if (onElevationChanged) {
      onElevationChanged(handleElevationChanged);
    }
  }, [onElevationChanged, handleElevationChanged]);

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
          <small>Using Single Source Position{isUniversalMode ? ' - Universal Mode' : ''}</small>
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

      {/* Debug info */}
      {/* {process.env.NODE_ENV === 'development' && (
        <div style={{
          position: 'absolute',
          bottom: '100px',
          right: '10px',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          color: 'white',
          padding: '8px',
          borderRadius: '4px',
          fontSize: '10px',
          zIndex: 1003,
          fontFamily: 'monospace'
        }}>
          <div>🎯 MAC: Single Source Position</div>
          <div>Position: {arPosition ? `[${arPosition.x.toFixed(2)}, ${arPosition.y.toFixed(2)}, ${arPosition.z.toFixed(2)}]` : 'null'}</div>
          <div>Model Ready: {isEngineReady ? '✅' : '❌'}</div>
          <div>Positioned: {modelPositioned ? '✅' : '❌'}</div>
          <div>User Changes: {userTransformsRef.current.hasUserChanges ? '✅' : '❌'}</div>
        </div>
      )} */}
    </>
  );
};

export default React.memo(MacExperience);