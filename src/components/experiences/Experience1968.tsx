import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useARPositioning } from '../../hooks/useARPositioning';
import SmokeParticleEngine from '../engines/SmokeParticleEngine';

const SHOW_DEBUG_PANEL = false;

interface Experience1968Props {
  onClose: () => void;
  onNext?: () => void;
  arPosition?: THREE.Vector3;
  arScene?: THREE.Scene;
  arCamera?: THREE.PerspectiveCamera;
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

const Experience1968: React.FC<Experience1968Props> = ({ 
  onClose, 
  onNext,
  arPosition,
  arScene,
  arCamera,
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
  console.log(`🔥 Experience1968: Component render (ID: ${renderIdRef.current})`);

  // =================================================================
  // USER TRANSFORM TRACKING (following MacExperience pattern)
  // =================================================================
  
  const userTransformsRef = useRef({
    rotation: new THREE.Euler(0, 0, 0),
    scale: 1.0,
    hasUserChanges: false
  });

  // =================================================================
  // AR POSITIONING SYSTEM (following MacExperience pattern)
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
  // REFS AND STATE
  // =================================================================
  
  // Smoke parameters that can be adjusted by gestures
  const smokeParamsRef = useRef({
    particleCount: 1,
    maxParticleCount: 2000, // Reduced for AR performance
    emissionRate: 70,
    particleLifetime: 10.0,
    particleSize: 1, //not working here, need to go to engine
    windSpeed: 5.0,
    windDirection: new THREE.Vector3(1, 0.1, 0),
    turbulenceStrength: 4.0,
    smokeRiseSpeed: 20.0,
    smokeSpread: 5.0,
    baseColor: new THREE.Color(0.7, 0.7, 0.7),
    opacity: 0,
    emissionWidth: 70.0, 
    emissionHeight: 3.0,
    emissionDepth: 6.0,
    scale: 0.03 // keep below 0.1
  });

  // State for UI only (minimal state)
  const [isEngineReady, setIsEngineReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enginePosition, setEnginePosition] = useState<THREE.Vector3>(new THREE.Vector3(0, 0, -5));

  // =================================================================
  // POSITIONING CALCULATIONS (memoized)
  // =================================================================
  
  // Calculate smoke position using new positioning system
  const smokePosition = useMemo(() => {
    if (!newSystemReady) {
      return new THREE.Vector3(0, 0, -5); // Default position
    }

    // Combine options since newGetPosition only takes 1-2 arguments
    const options = {
      useDebugOverride: isUniversalMode,
      isUniversalMode: isUniversalMode,
      ...(newUserPosition && { gpsPosition: newUserPosition })
    };

    const result = newGetPosition('1968', options);
    
    if (result && result.relativeToUser) {
      console.log('🔥 Calculated smoke position:', result.relativeToUser.toArray());
      return result.relativeToUser; // Extract Vector3 from ExperiencePositionResult
    }
    
    return new THREE.Vector3(0, 0, -5); // Fallback
  }, [newSystemReady, isUniversalMode, newUserPosition, newGetPosition]);

  // Update engine position when calculated position changes
  useEffect(() => {
    setEnginePosition(smokePosition);
    console.log('🔥 Engine position updated:', smokePosition.toArray());
  }, [smokePosition]);

  // =================================================================
  // ENGINE CALLBACKS (memoized)
  // =================================================================

  const handleEngineReady = useCallback(() => {
    console.log('🎉 Experience1968: Smoke engine ready');
    setIsEngineReady(true);
    onExperienceReady?.();
  }, [onExperienceReady]);

  const handleEngineError = useCallback((errorMessage: string) => {
    console.error('❌ Experience1968: Smoke engine error:', errorMessage);
    setError(errorMessage);
  }, []);

  // =================================================================
  // GESTURE HANDLERS WITH TRANSFORM TRACKING
  // =================================================================

  useEffect(() => {
    // Register rotation handler
    if (onModelRotate) {
      onModelRotate((deltaX: number, deltaY: number, deltaZ: number = 0) => {
        // Track user rotation changes
        userTransformsRef.current.rotation.y += deltaX;
        userTransformsRef.current.rotation.x += deltaY;
        userTransformsRef.current.rotation.z += deltaZ;
        userTransformsRef.current.hasUserChanges = true;
        
        // Calculate total rotation including user changes
        const totalRotation = new THREE.Euler(
          userTransformsRef.current.rotation.x,
          userTransformsRef.current.rotation.y,
          userTransformsRef.current.rotation.z
        );
        
        // Update engine rotation by setting new position with rotation
        setEnginePosition(prev => {
          // Create new position with updated rotation applied
          const newPos = prev.clone();
          // The engine will handle the rotation via its rotation prop
          return newPos;
        });
        
        console.log(`🎮 SMOKE: Rotation applied and tracked`, {
          deltaX, deltaY, deltaZ,
          userRotation: userTransformsRef.current.rotation.toArray()
        });
      });
    }

    // Register scale handler
    if (onModelScale) {
      onModelScale((scaleFactor: number) => {
        const currentScale = smokeParamsRef.current.scale;
        const newScale = Math.max(0.01, Math.min(10, currentScale * scaleFactor));
        smokeParamsRef.current.scale = newScale;
        
        // Track user scale changes
        userTransformsRef.current.scale *= scaleFactor;
        userTransformsRef.current.scale = Math.max(0.01, Math.min(10, userTransformsRef.current.scale));
        userTransformsRef.current.hasUserChanges = true;
        
        // Trigger re-render to update engine scale
        setEnginePosition(prev => prev.clone()); // Force update
        
        console.log(`🔍 SMOKE: Scale applied and tracked`, {
          scaleFactor,
          newScale: newScale.toFixed(3),
          userScale: userTransformsRef.current.scale.toFixed(3)
        });
      });
    }

    // Register reset handler
    if (onModelReset) {
      onModelReset(() => {
        console.log(`🔄 SMOKE: Reset triggered`);
        
        // Clear user transforms
        userTransformsRef.current = {
          rotation: new THREE.Euler(0, 0, 0),
          scale: 1.0,
          hasUserChanges: false
        };
        
        // Reset smoke parameters
        smokeParamsRef.current.scale = 0.1;
        
        // Force position recalculation
        setEnginePosition(smokePosition.clone());
        
        console.log('🔄 SMOKE: Reset completed');
      });
    }

    // Register swipe handlers
    if (onSwipeUp) {
      onSwipeUp(() => {
        console.log('👆 Swipe up detected on smoke - increasing emission rate');
        smokeParamsRef.current.emissionRate = Math.min(200, smokeParamsRef.current.emissionRate + 25);
        setEnginePosition(prev => prev.clone()); // Trigger update
      });
    }

    if (onSwipeDown) {
      onSwipeDown(() => {
        console.log('👇 Swipe down detected on smoke - decreasing emission rate');
        smokeParamsRef.current.emissionRate = Math.max(10, smokeParamsRef.current.emissionRate - 25);
        setEnginePosition(prev => prev.clone()); // Trigger update
      });
    }
  }, []); // Empty dependency array - register once only

  // Handle elevation changes
  const handleElevationChanged = useCallback(() => {
    console.log('🔥 Experience1968: Elevation changed - recalculating position');
    setEnginePosition(smokePosition.clone());
  }, [smokePosition]);

  useEffect(() => {
    if (onElevationChanged) {
      onElevationChanged(handleElevationChanged);
    }
  }, [onElevationChanged, handleElevationChanged]);

  // Monitor debug mode changes
  useEffect(() => {
    if (newDebugMode !== undefined) {
      console.log('🔗 SMOKE: Debug mode changed - recalculating position');
      (window as any).arTestingOverride = newDebugMode;
      
      setTimeout(() => {
        setEnginePosition(smokePosition.clone());
      }, 100);
    }
  }, [newDebugMode, smokePosition]);

  // =================================================================
  // MEMOIZED ENGINE COMPONENT
  // =================================================================

  const smokeEngine = useMemo(() => {
    // Always use AR scene (following MacExperience pattern)
    const scene = arScene;
    if (!scene) {
      console.warn('🔥 Experience1968: No AR scene available');
      return null;
    }

    console.log('🔧 Experience1968: Creating memoized SmokeParticleEngine');
    
    // Calculate final scale including user transformations
    const finalScale = smokeParamsRef.current.scale * userTransformsRef.current.scale;
    
    // Calculate final rotation including user transformations
    const finalRotation = new THREE.Euler(
      userTransformsRef.current.rotation.x,
      userTransformsRef.current.rotation.y,
      userTransformsRef.current.rotation.z
    );
    
    return (
      <SmokeParticleEngine
        scene={scene}
        enabled={true}
        position={enginePosition}
        rotation={finalRotation}
        scale={finalScale}
        maxParticleCount={smokeParamsRef.current.maxParticleCount}
        emissionRate={smokeParamsRef.current.emissionRate}
        particleLifetime={smokeParamsRef.current.particleLifetime}
        windSpeed={smokeParamsRef.current.windSpeed}
        windDirection={smokeParamsRef.current.windDirection}
        turbulenceStrength={smokeParamsRef.current.turbulenceStrength}
        smokeRiseSpeed={smokeParamsRef.current.smokeRiseSpeed}
        smokeSpread={smokeParamsRef.current.smokeSpread}
        particleColor={smokeParamsRef.current.baseColor}
        onReady={handleEngineReady}
        onError={handleEngineError}
      />
    );
  }, [
    arScene,
    enginePosition,
    userTransformsRef.current.rotation,
    userTransformsRef.current.scale,
    smokeParamsRef.current.emissionRate,
    handleEngineReady,
    handleEngineError
  ]);

  // =================================================================
  // RENDER (No standalone mode setup needed)
  // =================================================================

  return (
    <>
      {/* Memoized Smoke Particle Engine */}
      {smokeEngine}

      {/* Loading indicator */}
      {!isEngineReady && !error && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          width: '80%',
          height: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          color: 'white',
          fontFamily: 'var(--font-rigby)',
        }}>
          {/* Loading spinner */}
          <div style={{
            width: '60px',
            height: '60px',
            border: '3px solid rgba(120, 60, 30, 0.3)',
            borderTop: '3px solid #8B4513',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            marginBottom: '20px'
          }} />
      
          <h2 style={{
            margin: '0 0 10px 0',
            fontSize: '24px',
            fontWeight: '400',
            color: '#D2691E'
          }}>
            🔥 Preparing 1968 Experience
          </h2>
          
          <p style={{
            margin: '0',
            fontSize: '16px',
            opacity: 0.8,
            textAlign: 'center',
            maxWidth: '300px'
          }}>
            Setting up smoke particle engine{isUniversalMode ? ' - Universal Mode' : ''}
          </p>
          
          {/* CSS animation for spinner */}
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
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
          Error loading 1968 Smoke Experience
          <br />
          <small>{error}</small>
        </div>
      )}

      {/* Debug Panel */}
      {SHOW_DEBUG_PANEL && (
        <div style={{
          position: 'absolute',
          bottom: '10px',
          right: '10px',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          color: 'white',
          padding: '10px',
          borderRadius: '4px',
          fontSize: '12px',
          zIndex: 1020,
          pointerEvents: 'auto',
          fontFamily: 'monospace'
        }}>
          <div style={{ color: 'orange' }}>🔥 SMOKE ENGINE DEBUG</div>
          <div>Mode: AR Only</div>
          <div>Universal Mode: {isUniversalMode ? '✅' : '❌'}</div>
          <div>Positioning Ready: {newSystemReady ? '✅' : '❌'}</div>
          <div style={{ color: 'cyan' }}>
            Engine Pos: [{enginePosition.x.toFixed(3)}, {enginePosition.y.toFixed(3)}, {enginePosition.z.toFixed(3)}]
          </div>
          <div>Scale: {(smokeParamsRef.current.scale * userTransformsRef.current.scale).toFixed(3)}</div>
          <div style={{ color: isEngineReady ? 'lightgreen' : 'orange' }}>
            Engine: {isEngineReady ? '✅ Ready' : '❌ Loading'}
          </div>
          <div style={{ color: 'lightblue', fontSize: '10px' }}>
            Particles: {smokeParamsRef.current.particleCount}/{smokeParamsRef.current.maxParticleCount}
          </div>
          <div style={{ color: 'lightblue', fontSize: '10px' }}>
            Emission: {smokeParamsRef.current.emissionRate}/sec
          </div>
          <div style={{ color: 'lightblue', fontSize: '10px' }}>
            Wind: {smokeParamsRef.current.windSpeed} | Rise: {smokeParamsRef.current.smokeRiseSpeed}
          </div>
          <div style={{ color: 'lightblue', fontSize: '10px' }}>
            Turbulence: {smokeParamsRef.current.turbulenceStrength} | Spread: {smokeParamsRef.current.smokeSpread}
          </div>
          <div style={{ color: 'yellow', fontSize: '10px' }}>
            User Transforms: {userTransformsRef.current.hasUserChanges ? '✅' : '❌'}
          </div>
          
          <div 
            onClick={() => {
              const newValue = !newDebugMode;
              (window as any).arTestingOverride = newValue;
              console.log('🎯 Debug mode toggled:', newValue ? 'ON' : 'OFF');
            }}
            style={{ 
              cursor: 'pointer', 
              userSelect: 'none', 
              marginTop: '5px',
              padding: '2px 4px',
              backgroundColor: newDebugMode ? 'rgba(0, 255, 0, 0.2)' : 'rgba(255, 0, 0, 0.2)',
              borderRadius: '2px'
            }}
          >
            Debug: {newDebugMode ? '✅ (Debug Pos)' : '❌ (AR Anchor)'}
          </div>
        </div>
      )}
    </>
  );
};

export default Experience1968;