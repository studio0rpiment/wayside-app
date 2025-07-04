import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import WaterParticleEngine from '../engines/WaterParticleEngine';
import ElasticSlider from '../common/ElasticSlider';

const SHOW_DEBUG_PANEL = false;

interface WaterRiseExperienceProps {
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
}

const WaterRiseExperience: React.FC<WaterRiseExperienceProps> = ({ 
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
  console.log(`🌊 WaterRiseExperience: Component render with NEW singleton engine (ID: ${renderIdRef.current})`);

  // =================================================================
  // USER TRANSFORM TRACKING (following Experience1968 pattern)
  // =================================================================
  
  // Track user-applied transforms separately from AR positioning
  const userTransformsRef = useRef({
    rotation: new THREE.Euler(0, 0, 0), // User's rotation deltas
    scale: 1.0,                         // User's scale multiplier
    hasUserChanges: false               // Flag to know if user made changes
  });

  // =================================================================
  // WATER PARAMETERS (preserved exactly)
  // =================================================================
  
  const waterParamsRef = useRef({
    maxWaterRise: 2,
    startYear: 2030,
    endYear: 2100,
    gridResolution: 50,
    waterSize: 40,
    particleColor: new THREE.Color().setHSL(210/360, 0.8, 0.7),
    waveSpeed: 0.001,
    waveAmplitude: 0.1,
    floodExpansionFactor: 3.0,
    particleBaseSize: 0.03,
    particleSizeMultiplier: 0.0
  });

  // State for UI and engine communication
  const [isEngineReady, setIsEngineReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // ✅ NEW: State for ElasticSlider (minimal state for UI only)
  const [sliderValue, setSliderValue] = useState(0);
  const [currentYear, setCurrentYear] = useState(2030);

  // ✅ NEW: Engine transform states (for React re-renders)
  const [engineScale, setEngineScale] = useState<number>(0.02); // ← Back to state
  const [engineRotation, setEngineRotation] = useState<THREE.Euler>(new THREE.Euler(THREE.MathUtils.degToRad(-10), THREE.MathUtils.degToRad(-45), THREE.MathUtils.degToRad(0)));

  // =================================================================
  // SLIDER UTILITIES (preserved exactly)
  // =================================================================
  
  // Calculate year from slider value
  const calculateYear = useCallback((value: number): number => {
    const percentage = (value / waterParamsRef.current.maxWaterRise) * 100;
    return Math.floor(
      waterParamsRef.current.startYear + 
      (percentage / 100) * (waterParamsRef.current.endYear - waterParamsRef.current.startYear)
    );
  }, []);

  // Immediate slider change handler (for visual feedback)
  const handleSliderChange = useCallback((newValue: number) => {
    // Immediate UI updates (React state for visual feedback)
    setSliderValue(newValue);
    setCurrentYear(calculateYear(newValue));
  }, [calculateYear]);

  // =================================================================
  // ENGINE CALLBACKS (simplified)
  // =================================================================

  const handleEngineReady = useCallback(() => {
    console.log('🎉 WaterRiseExperience: Water engine ready (using singleton positioning)');
    setIsEngineReady(true);
    onExperienceReady?.();
  }, [onExperienceReady]);

  const handleEngineError = useCallback((errorMessage: string) => {
    console.error('❌ WaterRiseExperience: Water engine error:', errorMessage);
    setError(errorMessage);
  }, []);

  // Handle engine reset
  const handleEngineReset = useCallback(() => {
    console.log('🔄 WATER: Resetting engine (clearing user transforms)');
    
    // Clear user transforms
    userTransformsRef.current = {
      rotation: new THREE.Euler(0, 0, 0),
      scale: 1.0,
      hasUserChanges: false
    };
    
    // ✅ Reset engine transforms back to defaults
    setEngineScale(1.0); // ← Back to default scale
    setEngineRotation(new THREE.Euler(0, 0, 0));
    
    // Reset slider
    setSliderValue(0);
    setCurrentYear(waterParamsRef.current.startYear);
    
    console.log('🔄 WATER: Reset completed');
  }, []);

  // =================================================================
  // GESTURE HANDLERS WITH TRANSFORM TRACKING (fixed scale)
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
      });
    }

    // ✅ FIXED: Scale handler now properly updates state
    if (onModelScale) {
      onModelScale((scaleFactor: number) => {
        const currentScale = engineScale; // ← Use current state value
        const newScale = Math.max(0.01, Math.min(10, currentScale * scaleFactor));
        
        // Track user scale changes
        userTransformsRef.current.scale *= scaleFactor;
        userTransformsRef.current.scale = Math.max(0.01, Math.min(10, userTransformsRef.current.scale));
        userTransformsRef.current.hasUserChanges = true;

        console.log('🎮 Scale gesture:', { 
          scaleFactor, 
          currentScale, 
          newScale,
          willUpdate: newScale !== currentScale 
        });
        
        // ✅ Update engine scale state (triggers React re-render)
        setEngineScale(newScale);
        
        console.log('🔧 Updated engineScale state to:', newScale);
      });
    }

    // Register reset handler
    if (onModelReset) {
      onModelReset(() => {
        console.log(`🔄 WATER: Reset triggered`);
        handleEngineReset();
      });
    }

    // Register swipe handlers
    if (onSwipeUp) {
      onSwipeUp(() => {
        console.log('👆 Swipe up detected on water - increasing flood level');
        const newSliderValue = Math.min(waterParamsRef.current.maxWaterRise, sliderValue + 0.2);
        handleSliderChange(newSliderValue);
      });
    }

    if (onSwipeDown) {
      onSwipeDown(() => {
        console.log('👇 Swipe down detected on water - decreasing flood level');
        const newSliderValue = Math.max(0, sliderValue - 0.2);
        handleSliderChange(newSliderValue);
      });
    }
  }, [onModelRotate, onModelScale, onModelReset, onSwipeUp, onSwipeDown, handleEngineReset, engineScale, sliderValue, handleSliderChange]);

  // =================================================================
  // ELEVATION CHANGE HANDLER (simplified)
  // =================================================================
  
  const handleElevationChanged = useCallback(() => {
    console.log('🌊 WaterRiseExperience: Elevation changed - engine will handle via singleton');
    // The engine will automatically reposition via its debug mode system
    // No manual repositioning needed here!
  }, []);

  useEffect(() => {
    if (onElevationChanged) {
      onElevationChanged(handleElevationChanged);
    }
  }, [onElevationChanged, handleElevationChanged]);

  // =================================================================
  // MEMOIZED ENGINE COMPONENT (with proper dependencies!)
  // =================================================================

  const waterEngine = useMemo(() => {
    if (!arScene) {
      console.warn('🌊 WaterRiseExperience: No AR scene available');
      return null;
    }

    console.log('🔧 WaterRiseExperience: Creating memoized WaterParticleEngine with singleton positioning');
    console.log('🔧 Current engineScale for engine:', engineScale); // ← Debug log
    
    return (
      <WaterParticleEngine
        // ✅ NEW: Positioning via singleton (like SmokeParticleEngine)
        scene={arScene}
        enabled={true}
        experienceId="2030-2105" // ← Engine handles all positioning via singleton!
        isUniversalMode={isUniversalMode}
        lockPosition={true}
        
        // ✅ FIXED: Pass engineScale state as scale prop
        scale={engineScale} // ← Now uses state value that triggers re-renders
        rotation={engineRotation} 
        
        // ✅ KEEP: Visual and animation props
        floodLevel={sliderValue}
        particleColor={waterParamsRef.current.particleColor}
        particleSize={waterParamsRef.current.particleBaseSize}
        opacity={1.0}
        
        // Animation controls (preserved exactly)
        waveSpeed={waterParamsRef.current.waveSpeed}
        waveAmplitude={waterParamsRef.current.waveAmplitude}
        gridResolution={waterParamsRef.current.gridResolution}
        waterSize={waterParamsRef.current.waterSize}
        
        // Water system parameters
        maxWaterRise={waterParamsRef.current.maxWaterRise}
        startYear={waterParamsRef.current.startYear}
        endYear={waterParamsRef.current.endYear}
        floodExpansionFactor={waterParamsRef.current.floodExpansionFactor}
        particleSizeMultiplier={waterParamsRef.current.particleSizeMultiplier}
        
        // Callbacks
        onReady={handleEngineReady}
        onError={handleEngineError}
      />
    );
  }, [
    arScene,
    isUniversalMode,
    // ✅ FIXED: Include engineScale in dependencies
    engineScale, // ← This triggers re-render when scale changes
    engineRotation,
    // Water parameters that can change via slider
    sliderValue,
    // Callbacks
    handleEngineReady,
    handleEngineError
  ]);

  // =================================================================
  // RENDER (much simpler!)
  // =================================================================

  console.log('🌊 WaterRiseExperience: Rendering with engineScale:', engineScale);

  return (
    <>
      {/* Memoized Water Particle Engine with Singleton Positioning */}
      {waterEngine}

      {/* ✅ NEW: ElasticSlider Control Panel */}
      {isEngineReady && (
        <div style={{
          position: 'fixed',
          bottom: '0.5svh',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '95vw',
          backgroundColor: 'rgba(0, 0, 0, 0)',
          color: '',
          padding: '0px',
          borderRadius: '2rem',
          fontFamily: 'var(--font-rigby)',
          fontWeight: '400',
          zIndex: 1030,
          pointerEvents: 'auto',
        }}>
          {/* ElasticSlider */}
          <ElasticSlider
            min={0}
            max={waterParamsRef.current.maxWaterRise}
            value={sliderValue}
            step={0.001}
            onChange={handleSliderChange}
            leftLabel="2030"
            rightLabel="2150"
            labelPosition="top"
            labelColor="var(--color-light)"
            labelFontWeight="bold"
            valueFontWeight="700" 
            trackFillColor="var(--color-dark)"
            trackBorderRadius={10}
            labelGap={12}
            trackHeight={15}     
            labelFontSize={20}     
            showValueDisplay={false}
            className="water-rise-slider"
          />
        </div>
      )}

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
            border: '3px solid rgba(0, 100, 200, 0.3)',
            borderTop: '3px solid #0066cc',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            marginBottom: '20px'
          }} />
      
          <h2 style={{
            margin: '0 0 10px 0',
            fontSize: '24px',
            fontWeight: '400',
            color: '#0099cc'
          }}>
            🌊 Preparing Water Rise Experience
          </h2>
          
          <p style={{
            margin: '0',
            fontSize: '16px',
            opacity: 0.8,
            textAlign: 'center',
            maxWidth: '300px'
          }}>
            Setting up water particle engine{isUniversalMode ? ' - Universal Mode' : ''}<br/>
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
          Error loading Water Rise Experience
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
          <div style={{ color: 'cyan' }}>🌊 WATER ENGINE DEBUG (SINGLETON)</div>
          <div>Mode: Singleton Positioning</div>
          <div>Universal Mode: {isUniversalMode ? '✅' : '❌'}</div>
          <div>Experience ID: 2030-2105</div>
          <div>Engine Scale: {engineScale.toFixed(3)}</div>
          <div>Engine Ready: {isEngineReady ? '✅' : '❌'}</div>
          <div style={{ color: 'lightblue', fontSize: '10px' }}>
            Flood Level: {sliderValue.toFixed(2)} ({((sliderValue / waterParamsRef.current.maxWaterRise) * 100).toFixed(1)}%)
          </div>
          <div style={{ color: 'lightblue', fontSize: '10px' }}>
            Current Year: {currentYear}
          </div>
          <div style={{ color: 'lightblue', fontSize: '10px' }}>
            Grid: {waterParamsRef.current.gridResolution}x{waterParamsRef.current.gridResolution}
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

export default React.memo(WaterRiseExperience);