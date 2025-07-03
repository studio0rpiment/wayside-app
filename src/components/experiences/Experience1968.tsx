import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import * as THREE from 'three'
import SmokeParticleEngine from '../engines/SmokeParticleEngine';

const SHOW_DEBUG_PANEL = false;

interface Experience1968Props {
  // Core AR props - SIMPLIFIED (no arPosition needed!)
  arScene: THREE.Scene;
  arCamera: THREE.PerspectiveCamera;
  
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
  
  // ❌ REMOVED: arPosition - engine handles positioning internally!
  // ❌ REMOVED: coordinateScale - handled by positioning system
}

const Experience1968: React.FC<Experience1968Props> = ({ 
  arScene,
  arCamera,
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
  console.log(`🔥 Experience1968: Component render with NEW singleton engine (ID: ${renderIdRef.current})`);

  // =================================================================
  // USER TRANSFORM TRACKING (following MacExperience pattern)
  // =================================================================
  
  // Track user-applied transforms separately from AR positioning
  const userTransformsRef = useRef({
    rotation: new THREE.Euler(0, 0, 0), // User's rotation deltas
    scale: 1.0,                         // User's scale multiplier
    hasUserChanges: false               // Flag to know if user made changes
  });

  // =================================================================
  // SMOKE PARAMETERS (preserved exactly)
  // =================================================================
  
  // Smoke parameters that can be adjusted by gestures
  const smokeParamsRef = useRef({
    particleCount: 1,
    maxParticleCount: 2000, // Reduced for AR performance
    emissionRate: 70,
    particleLifetime: 5.0,
    particleSize: 0.03, // Applied via engine sizeMultiplier
    windSpeed: 1.0,
    windDirection: new THREE.Vector3(0.3, 0.8, 0),
    turbulenceStrength: 0.5,
    smokeRiseSpeed: 1.0,
    smokeSpread: 2.0,
    baseColor: new THREE.Color(0.7, 0.7, 0.7),
    opacity: 0.25,
    emissionWidth: 3, 
    emissionHeight: 0.2,
    emissionDepth: 0.2,
    // scale: 0.03 
  });

  // State for UI only (minimal state)
  const [isEngineReady, setIsEngineReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ✅ NEW: Track engine transforms separately (applied via engine props)
  const [engineScale, setEngineScale] = useState<number>(0.03); // Default scale
  const [engineRotation, setEngineRotation] = useState<THREE.Euler>(new THREE.Euler(0, 0, 0));

  // =================================================================
  // ENGINE CALLBACKS (simplified)
  // =================================================================

  const handleEngineReady = useCallback(() => {
    // console.log('🎉 Experience1968: Smoke engine ready (using singleton positioning)');
    setIsEngineReady(true);
    onExperienceReady?.();
  }, [onExperienceReady]);

  const handleEngineError = useCallback((errorMessage: string) => {
    // console.error('❌ Experience1968: Smoke engine error:', errorMessage);
    setError(errorMessage);
  }, []);

  // Handle engine reset
  const handleEngineReset = useCallback(() => {
    // console.log('🔄 SMOKE: Resetting engine (clearing user transforms)');
    
    // Clear user transforms
    userTransformsRef.current = {
      rotation: new THREE.Euler(0, 0, 0),
      scale: 1.0,
      hasUserChanges: false
    };
    
    // Reset engine transforms
    setEngineScale(0.03); // Back to default
    setEngineRotation(new THREE.Euler(0, 0, 0));
    
    // console.log('🔄 SMOKE: Reset completed');
  }, []);

  // =================================================================
  // GESTURE HANDLERS WITH TRANSFORM TRACKING (simplified)
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
        
        // Update engine rotation state
        setEngineRotation(prev => new THREE.Euler(
          prev.x + deltaY,
          prev.y + deltaX,
          prev.z + deltaZ
        ));
        
        // console.log(`🎮 SMOKE: Rotation applied and tracked`, {
        //   deltaX, deltaY, deltaZ,
        //   userRotation: userTransformsRef.current.rotation.toArray()
        // });
      });
    }

    // Register scale handler
    if (onModelScale) {
      onModelScale((scaleFactor: number) => {
        const currentScale = engineScale;
        const newScale = Math.max(0.01, Math.min(10, currentScale * scaleFactor));
        
        // Track user scale changes
        userTransformsRef.current.scale *= scaleFactor;
        userTransformsRef.current.scale = Math.max(0.01, Math.min(10, userTransformsRef.current.scale));
        userTransformsRef.current.hasUserChanges = true;
        
        // Update engine scale state
        setEngineScale(newScale);
        
        // console.log(`🔍 SMOKE: Scale applied and tracked`, {
        //   scaleFactor,
        //   newScale: newScale.toFixed(3),
        //   userScale: userTransformsRef.current.scale.toFixed(3)
        // });
      });
    }

    // Register reset handler
    if (onModelReset) {
      onModelReset(() => {
        // console.log(`🔄 SMOKE: Reset triggered`);
        handleEngineReset();
      });
    }

    // Register swipe handlers
    if (onSwipeUp) {
      onSwipeUp(() => {
        // console.log('👆 Swipe up detected on smoke - increasing emission rate');
        smokeParamsRef.current.emissionRate = Math.min(200, smokeParamsRef.current.emissionRate + 25);
        // Note: Engine will pick up this change through its props
      });
    }

    if (onSwipeDown) {
      onSwipeDown(() => {
        // console.log('👇 Swipe down detected on smoke - decreasing emission rate');
        smokeParamsRef.current.emissionRate = Math.max(10, smokeParamsRef.current.emissionRate - 25);
        // Note: Engine will pick up this change through its props
      });
    }
  }, [onModelRotate, onModelScale, onModelReset, onSwipeUp, onSwipeDown, handleEngineReset, engineScale]);

  // =================================================================
  // ELEVATION CHANGE HANDLER (simplified)
  // =================================================================
  
  const handleElevationChanged = useCallback(() => {
    // console.log('🔥 Experience1968: Elevation changed - engine will handle via singleton');
    // The engine will automatically reposition via its debug mode system
    // No manual repositioning needed here!
  }, []);

  useEffect(() => {
    if (onElevationChanged) {
      onElevationChanged(handleElevationChanged);
    }
  }, [onElevationChanged, handleElevationChanged]);

  // =================================================================
  // MEMOIZED ENGINE COMPONENT (much simpler!)
  // =================================================================

  const smokeEngine = useMemo(() => {
    if (!arScene) {
      console.warn('🔥 Experience1968: No AR scene available');
      return null;
    }

    // console.log('🔧 Experience1968: Creating memoized SmokeParticleEngine with singleton positioning');
    
    return (
      <SmokeParticleEngine
        // ✅ NEW: Positioning via singleton (like StaticPointCloudEngine)
        scene={arScene}
        enabled={true}
        experienceId="1968" // ← Engine handles all positioning via singleton!
        isUniversalMode={isUniversalMode}
        lockPosition={true}
        
        // ❌ REMOVED: position prop - engine calculates this internally!
        // ✅ KEEP: Visual and animation props
        particleColor={smokeParamsRef.current.baseColor}
        particleSize={smokeParamsRef.current.particleSize}
        opacity={smokeParamsRef.current.opacity}
        
        // Smoke animation controls (preserved exactly)
        maxParticleCount={smokeParamsRef.current.maxParticleCount}
        emissionRate={smokeParamsRef.current.emissionRate}
        particleLifetime={smokeParamsRef.current.particleLifetime}
        windSpeed={smokeParamsRef.current.windSpeed}
        windDirection={smokeParamsRef.current.windDirection}
        turbulenceStrength={smokeParamsRef.current.turbulenceStrength}
        smokeRiseSpeed={smokeParamsRef.current.smokeRiseSpeed}
        smokeSpread={smokeParamsRef.current.smokeSpread}
        emissionWidth={smokeParamsRef.current.emissionWidth}
        emissionHeight={smokeParamsRef.current.emissionHeight}
        emissionDepth={smokeParamsRef.current.emissionDepth}
        
        // Callbacks
        onReady={handleEngineReady}
        onError={handleEngineError}
      />
    );
  }, [
    arScene,
    isUniversalMode,
    // User transform dependencies (trigger re-render when changed)
    engineScale,
    engineRotation,
    // Smoke parameters that can change via gestures
    smokeParamsRef.current.emissionRate,
    // Callbacks
    handleEngineReady,
    handleEngineError
  ]);

  // =================================================================
  // RENDER (much simpler!)
  // =================================================================

  return (
    <>
      {/* Memoized Smoke Particle Engine with Singleton Positioning */}
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
            Setting up smoke particle engine{isUniversalMode ? ' - Universal Mode' : ''}<br/>
            <small>Using Singleton Positioning System</small>
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

      {/* Debug Panel (simplified) */}
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
          <div style={{ color: 'orange' }}>🔥 SMOKE ENGINE DEBUG (SINGLETON)</div>
          <div>Mode: Singleton Positioning</div>
          <div>Universal Mode: {isUniversalMode ? '✅' : '❌'}</div>
          <div>Experience ID: 1968</div>
          <div>Engine Scale: {engineScale.toFixed(3)}</div>
          <div>Engine Ready: {isEngineReady ? '✅' : '❌'}</div>
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
          <div style={{ color: 'lightgreen', fontSize: '10px' }}>
            🎯 Position: Handled by Singleton
          </div>
        </div>
      )}
    </>
  );
};

export default React.memo(Experience1968) ;