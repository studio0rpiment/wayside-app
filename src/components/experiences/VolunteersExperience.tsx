import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import StaticPointCloudEngine, { StaticPointCloudConfig } from '../engines/StaticPointCloudEngine';
import { useARPositioning } from '../../hooks/useARPositioning';

interface VolunteersExperienceProps {
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

const VolunteersExperience: React.FC<VolunteersExperienceProps> = ({ 
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
  console.log(`🔄 VolunteersExperience: Component render (ID: ${renderIdRef.current})`);
  
  console.log('🔍 VolunteersExperience props:', {
    isUniversalMode,
    sharedARPositioning: !!sharedARPositioning,
    arPosition: arPosition.toArray()
  });

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

  // Volunteers-specific configuration (memoized)
  const volunteersConfig: StaticPointCloudConfig = useMemo(() => ({
    modelName: 'volunteers' as const,
    knownMaxDim: 8.0,
    knownCenter: new THREE.Vector3(0, 0, 0),
    targetScale: 2.0 / 8.0,
    pointSize: 1.5,
    pointDensity: 0.8,
    fallbackColor: 0x4a90e2, // Blue for volunteers
    rotationCorrection: new THREE.Euler(-Math.PI / 2, 0, 0),
    centerModel: true,
    maxVertices: 100000 // Volunteers can handle more vertices
  }), []); // Config never changes

  // =================================================================
  // POSITIONING WITH TRANSFORM PRESERVATION
  // =================================================================
  
  const positionModelWithTransformPreservation = useCallback((model: THREE.Points) => {
    if (!newSystemReady) {
      console.log('🧪 VOLUNTEERS: Positioning system not ready yet');
      return false;
    }
    
    // Apply AR positioning (this resets transforms)
    let success;
    if (isUniversalMode) {
      console.log('🌐 VOLUNTEERS: Universal Mode - using debug position');
      success = newPositionObject(model, 'volunteers', { useDebugOverride: true });
    } else {
      success = newPositionObject(model, 'volunteers');
    }
    
    // Reapply user transforms if they exist
    if (userTransformsRef.current.hasUserChanges && success) {
      console.log('🔄 VOLUNTEERS: Reapplying user transforms after positioning', {
        userRotation: userTransformsRef.current.rotation.toArray(),
        userScale: userTransformsRef.current.scale
      });
      
      // Reapply user rotation on top of AR positioning
      model.rotation.x += userTransformsRef.current.rotation.x;
      model.rotation.y += userTransformsRef.current.rotation.y;
      model.rotation.z += userTransformsRef.current.rotation.z;
      
      // Reapply user scale
      const currentScale = model.scale.x;
      model.scale.setScalar(currentScale * userTransformsRef.current.scale);
    }
    
    return success;
  }, [newSystemReady, isUniversalMode, newPositionObject]);

  const handleModelReset = useCallback((model: THREE.Points) => {
    console.log('🔄 VOLUNTEERS: Resetting model (clearing user transforms)');
    
    // Clear user transforms
    userTransformsRef.current = {
      rotation: new THREE.Euler(0, 0, 0),
      scale: 1.0,
      hasUserChanges: false
    };
    
    // Reposition with fresh state
    positionModelWithTransformPreservation(model);
    
    activeScaleRef.current = model.scale.x;
    console.log('🔄 VOLUNTEERS: Reset completed');
  }, [positionModelWithTransformPreservation]);

  // =================================================================
  // ENGINE CALLBACKS (MEMOIZED)
  // =================================================================

  const handleModelLoaded = useCallback((pointCloud: THREE.Points) => {
    console.log('🎯 VolunteersExperience: Model loaded from engine');
    modelRef.current = pointCloud;
    activeScaleRef.current = pointCloud.scale.x;
    
    // Position the model (no user transforms yet)
    if (newSystemReady) {
      positionModelWithTransformPreservation(pointCloud);
    }
    
    setIsEngineReady(true);
  }, [newSystemReady, positionModelWithTransformPreservation]);

  const handleEngineReady = useCallback(() => {
    console.log('🎉 VolunteersExperience: Engine ready');
    onExperienceReady?.();
  }, [onExperienceReady]);

  const handleEngineError = useCallback((errorMessage: string) => {
    console.error('❌ VolunteersExperience: Engine error:', errorMessage);
    setError(errorMessage);
  }, []);

  // =================================================================
  // MEMOIZED ENGINE COMPONENT
  // =================================================================

  const staticEngine = useMemo(() => {
    console.log('🔧 VolunteersExperience: Creating memoized StaticPointCloudEngine');
    
    return (
      <StaticPointCloudEngine
        config={volunteersConfig}
        scene={arScene}
        experienceId="volunteers"        
        isUniversalMode={isUniversalMode} 
        enabled={true}
        onModelLoaded={handleModelLoaded}
        onLoadingProgress={setLoadingProgress}
        onError={handleEngineError}
        onReady={handleEngineReady}
      />
    );
  }, [
    volunteersConfig,
    arScene,
    handleModelLoaded,
    handleEngineError,
    handleEngineReady
  ]); // Only recreate if these actually change

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
          
          console.log(`🎮 VOLUNTEERS: Rotation applied and tracked`, {
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
          
          console.log(`🔍 VOLUNTEERS: Scale applied and tracked`, {
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
        console.log(`🔄 VOLUNTEERS: Reset triggered`);
        if (modelRef.current) {
          handleModelReset(modelRef.current);
        }
      });
    }

    // Register swipe handlers
    if (onSwipeUp) {
      onSwipeUp(() => {
        console.log(`👆 VOLUNTEERS: Swipe up`);
        // Add volunteers-specific swipe behavior here
      });
    }

    if (onSwipeDown) {
      onSwipeDown(() => {
        console.log(`👇 VOLUNTEERS: Swipe down`);
        // Add volunteers-specific swipe behavior here
      });
    }
  }, []); // No dependencies - register once

  // Handle elevation changes (memoized)
  const handleElevationChanged = useCallback(() => {
    console.log('🧪 VolunteersExperience: Elevation changed - repositioning with preserved transforms');
    
    if (modelRef.current) {
      positionModelWithTransformPreservation(modelRef.current);
    }
  }, [positionModelWithTransformPreservation]);

  useEffect(() => {
    if (onElevationChanged) {
      onElevationChanged(handleElevationChanged);
    }
  }, [onElevationChanged, handleElevationChanged]);

  // Monitor debug mode changes
  useEffect(() => {
    if (newDebugMode !== undefined) {
      console.log('🔗 VOLUNTEERS: Debug mode changed - repositioning with preserved transforms');
      
      (window as any).arTestingOverride = newDebugMode;
      
      setTimeout(() => {
        if (modelRef.current && newSystemReady) {
          positionModelWithTransformPreservation(modelRef.current);
        }
      }, 100);
    }
  }, [newDebugMode, newSystemReady, positionModelWithTransformPreservation]);

  // Wait for positioning system to be ready
  useEffect(() => {
    if (newSystemReady && modelRef.current && isEngineReady) {
      console.log('🧪 VOLUNTEERS: Positioning system ready, positioning model...');
      positionModelWithTransformPreservation(modelRef.current);
    }
  }, [newSystemReady, isEngineReady, positionModelWithTransformPreservation]);

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
          Loading VOLUNTEERS Model... {loadingProgress.toFixed(0)}%
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
          Error loading VOLUNTEERS Model
          <br />
          <small>{error}</small>
        </div>
      )}
    </>
  );
};

export default VolunteersExperience;