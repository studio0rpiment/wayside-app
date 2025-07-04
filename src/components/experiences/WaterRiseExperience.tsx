import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import WaterParticleEngine from '../engines/WaterParticleEngine';
import ElasticSlider from '../common/ElasticSlider';
import DebugWindow, { debugLogger } from '../debug/WaterSliderDebug';

interface WaterRiseExperienceProps {
  // Core AR props
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
  
  // Elevation adjustment
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
  console.log(`🌊 WaterRiseExperience: Component render (ID: ${renderIdRef.current})`);

  // =================================================================
  // STATIC REFS - These never change, no re-renders
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

  // =================================================================
  // ENGINE-ONLY REFS - These affect 3D scene only, no UI re-renders
  // =================================================================
  
  const engineScaleRef = useRef<number>(1);
  const engineRotationRef = useRef<THREE.Euler>(
    new THREE.Euler(THREE.MathUtils.degToRad(-10), THREE.MathUtils.degToRad(-45), THREE.MathUtils.degToRad(0))
  );
  const floodLevelRef = useRef<number>(0);
  
  const userTransformsRef = useRef({
    rotation: new THREE.Euler(0, 0, 0),
    scale: 1.0,
    hasUserChanges: false
  });

  // =================================================================
  // UI STATE - These drive React components and need re-renders
  // =================================================================
  
  const [isEngineReady, setIsEngineReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sliderValue, setSliderValue] = useState(0); // ✅ UI state - drives slider
  const [currentYear, setCurrentYear] = useState(2030); // ✅ UI state - for display
  const [showDebug, setShowDebug] = useState(true);

  // =================================================================
  // SLIDER UTILITIES
  // =================================================================
  
  const calculateYear = useCallback((value: number): number => {
    const percentage = (value / waterParamsRef.current.maxWaterRise) * 100;
    return Math.floor(
      waterParamsRef.current.startYear + 
      (percentage / 100) * (waterParamsRef.current.endYear - waterParamsRef.current.startYear)
    );
  }, []);

  const handleSliderChange = useCallback((newValue: number) => {
    // ✅ Update UI state (causes re-render for slider)
    setSliderValue(newValue);
    
    // ✅ Update engine ref (no re-render, read by animation loop)
    floodLevelRef.current = newValue;
    
    const year = calculateYear(newValue);
    setCurrentYear(year);
    
    // Debug logging
    debugLogger.log('Slider Value', `${newValue.toFixed(3)}`);
    debugLogger.log('Current Year', year);
    debugLogger.log('Flood Level Ref', floodLevelRef.current.toFixed(3));
  }, [calculateYear]);

  // =================================================================
  // ENGINE CALLBACKS
  // =================================================================

  const handleEngineReady = useCallback(() => {
    setIsEngineReady(true);
    debugLogger.log('Engine Ready', true);
    onExperienceReady?.();
  }, [onExperienceReady]);

  const handleEngineError = useCallback((errorMessage: string) => {
    setError(errorMessage);
    debugLogger.log('Engine Error', errorMessage);
  }, []);

  const handleEngineReset = useCallback(() => {
    // ✅ Reset all refs (no re-renders)
    userTransformsRef.current = {
      rotation: new THREE.Euler(0, 0, 0),
      scale: 1.0,
      hasUserChanges: false
    };
    
    engineScaleRef.current = 0.02;
    engineRotationRef.current = new THREE.Euler(
      THREE.MathUtils.degToRad(-10), 
      THREE.MathUtils.degToRad(-45), 
      THREE.MathUtils.degToRad(0)
    );
    floodLevelRef.current = 0;
    
    // ✅ Reset UI state (causes re-render for slider)
    setSliderValue(0);
    setCurrentYear(waterParamsRef.current.startYear);
    
    debugLogger.log('Engine Reset', 'Completed');
  }, []);

  // =================================================================
  // GESTURE HANDLERS - Update refs only
  // =================================================================

  useEffect(() => {
    if (onModelRotate) {
      onModelRotate((deltaX: number, deltaY: number, deltaZ: number = 0) => {
        // ✅ Update refs only (no re-render)
        userTransformsRef.current.rotation.y += deltaX;
        userTransformsRef.current.rotation.x += deltaY;
        userTransformsRef.current.rotation.z += deltaZ;
        userTransformsRef.current.hasUserChanges = true;
        
        // ✅ Update engine rotation ref (no re-render)
        engineRotationRef.current.x += deltaY;
        engineRotationRef.current.y += deltaX;
        engineRotationRef.current.z += deltaZ;
        
        debugLogger.log('User Rotation', `${engineRotationRef.current.x.toFixed(3)}, ${engineRotationRef.current.y.toFixed(3)}, ${engineRotationRef.current.z.toFixed(3)}`);
      });
    }

    if (onModelScale) {
      onModelScale((scaleFactor: number) => {
        // ✅ Update refs only (no re-render)
        const currentScale = engineScaleRef.current;
        const newScale = Math.max(0.01, Math.min(10, currentScale * scaleFactor));
        
        userTransformsRef.current.scale *= scaleFactor;
        userTransformsRef.current.scale = Math.max(0.01, Math.min(10, userTransformsRef.current.scale));
        userTransformsRef.current.hasUserChanges = true;

        engineScaleRef.current = newScale;
        debugLogger.log('User Scale', newScale.toFixed(3));
      });
    }

    if (onModelReset) {
      onModelReset(() => {
        handleEngineReset();
      });
    }

    if (onSwipeUp) {
      onSwipeUp(() => {
        const newSliderValue = Math.min(waterParamsRef.current.maxWaterRise, sliderValue + 0.2);
        handleSliderChange(newSliderValue);
      });
    }

    if (onSwipeDown) {
      onSwipeDown(() => {
        const newSliderValue = Math.max(0, sliderValue - 0.2);
        handleSliderChange(newSliderValue);
      });
    }
  }, [onModelRotate, onModelScale, onModelReset, onSwipeUp, onSwipeDown, handleEngineReset, sliderValue, handleSliderChange]);

  // =================================================================
  // ELEVATION CHANGE HANDLER
  // =================================================================
  
  const handleElevationChanged = useCallback(() => {
    // Engine handles via singleton positioning system
  }, []);

  useEffect(() => {
    if (onElevationChanged) {
      onElevationChanged(handleElevationChanged);
    }
  }, [onElevationChanged, handleElevationChanged]);

  // =================================================================
  // DEBUG LOGGING
  // =================================================================
  
  useEffect(() => {
    debugLogger.log('Engine Scale Ref', engineScaleRef.current.toFixed(3));
    debugLogger.log('Universal Mode', isUniversalMode);
    debugLogger.log('Flood Level', sliderValue.toFixed(3));
    debugLogger.log('Flood Level Ref', floodLevelRef.current.toFixed(3));
    debugLogger.log('Flood Progress', `${((sliderValue / waterParamsRef.current.maxWaterRise) * 100).toFixed(1)}%`);
  }, [isUniversalMode, sliderValue]);

  // =================================================================
  // MEMOIZED ENGINE COMPONENT - ✅ STABLE DEPENDENCIES
  // =================================================================

  const waterEngine = useMemo(() => {
    if (!arScene) {
      return null;
    }
    
    console.log('🔄 Creating WaterParticleEngine (should only happen once)');
    
    return (
      <WaterParticleEngine
        scene={arScene}
        enabled={true}
        experienceId="2030-2105"
        isUniversalMode={isUniversalMode}
        lockPosition={true}
        
        // ✅ Pass refs to engine - these won't cause re-creation
        scaleRef={engineScaleRef}
        rotationRef={engineRotationRef}
        floodLevelRef={floodLevelRef}
        
        // ✅ Static props from refs
        particleColor={waterParamsRef.current.particleColor}
        particleSize={waterParamsRef.current.particleBaseSize}
        opacity={1.0}
        
        waveSpeed={waterParamsRef.current.waveSpeed}
        waveAmplitude={waterParamsRef.current.waveAmplitude}
        gridResolution={waterParamsRef.current.gridResolution}
        waterSize={waterParamsRef.current.waterSize}
        
        maxWaterRise={waterParamsRef.current.maxWaterRise}
        startYear={waterParamsRef.current.startYear}
        endYear={waterParamsRef.current.endYear}
        floodExpansionFactor={waterParamsRef.current.floodExpansionFactor}
        particleSizeMultiplier={waterParamsRef.current.particleSizeMultiplier}
        
        onReady={handleEngineReady}
        onError={handleEngineError}
      />
    );
  }, [
    // ✅ STABLE DEPENDENCIES ONLY - these rarely/never change
    arScene,
    isUniversalMode,
    handleEngineReady,
    handleEngineError
    // ❌ REMOVED: sliderValue, engineRotation, engineScale
    // These are now handled via refs passed to the engine
  ]);

  // =================================================================
  // RENDER
  // =================================================================

  return (
    <>
      {/* Water Particle Engine - ✅ Now stable, won't re-create */}
      {waterEngine}

      {/* Slider Control Panel */}
      {isEngineReady && (
        <div style={{
          position: 'fixed',
          bottom: '0.5svh',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '95vw',
          backgroundColor: 'rgba(0, 0, 0, 0)',
          padding: '0px',
          borderRadius: '2rem',
          fontFamily: 'var(--font-rigby)',
          fontWeight: '400',
          zIndex: 1030,
          pointerEvents: 'auto',
        }}>
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

      {/* Debug Window */}
      <DebugWindow 
        isOpen={showDebug} 
        onToggle={() => setShowDebug(!showDebug)} 
      />
    </>
  );
};

export default React.memo(WaterRiseExperience);