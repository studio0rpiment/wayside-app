import React, { useEffect, useState, useRef } from 'react';
import * as THREE from 'three';
import { getAssetPath } from '../../utils/assetPaths';

// Import PLYLoader separately to avoid Vite optimization issues
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';

// Import positioning systems
import { useARPositioning } from '../../hooks/useARPositioning';

const SHOW_DEBUG_PANEL = true; // Enable for testing

// POSITIONING SYSTEM TOGGLE
const USE_NEW_POSITIONING = true; // Set to true to test new world coordinate system

interface MacExperienceProps {
  onClose: () => void;
  onNext?: () => void;
  // REQUIRED: AR Scene and Camera (no more standalone mode)
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
  onExperienceReady
}) => {

  // =================================================================
  // NEW WORLD COORDINATE POSITIONING SYSTEM
  // =================================================================
  const newPositioningSystem = useARPositioning();
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
  // LEGACY GPS-TO-AR POSITIONING SYSTEM
  // =================================================================
  const [legacyArTestingOverride, setLegacyArTestingOverride] = useState(() => {
    return (window as any).arTestingOverride ?? true;
  });

  // Legacy positioning functions
  const legacyPositionModel = (model: THREE.Points) => {
    if (!model || !arPosition) return;

    const currentOverride = (window as any).arTestingOverride ?? true;
    
    if (currentOverride) {
      // Debug position (in front of camera)
      model.position.set(0, 0, -5);
      console.log('🎯 LEGACY: MAC positioned at debug location (0, 0, -5)');
    } else {
      // Use GPS anchor position + centering offset
      const centeringOffset = new THREE.Vector3(-knownCenter.x, -knownCenter.y, -knownCenter.z);
      const finalPosition = arPosition.clone().add(centeringOffset);
      model.position.copy(finalPosition);
      console.log('🎯 LEGACY: MAC positioned at GPS anchor:', {
        arPosition: arPosition.toArray(),
        centeringOffset: centeringOffset.toArray(),
        finalPosition: finalPosition.toArray()
      });
    }
  };

  const legacyHandleReset = (model: THREE.Points) => {
    // Reset rotation and scale first
    model.rotation.set(-Math.PI / 2, 0, 0);
    model.scale.set(initialScale, initialScale, initialScale);
    
    // Then reposition
    legacyPositionModel(model);
    console.log('🔄 LEGACY: Model reset completed');
  };

  // Legacy override monitoring
  useEffect(() => {
    if (USE_NEW_POSITIONING) return; // Skip if using new system

    const checkLegacyOverride = () => {
      const currentOverride = (window as any).arTestingOverride ?? true;
      if (currentOverride !== legacyArTestingOverride) {
        setLegacyArTestingOverride(currentOverride);
        console.log('🎯 LEGACY: Override changed to:', currentOverride);
        
        if (modelRef.current) {
          legacyPositionModel(modelRef.current);
          
          // Force visual update
          modelRef.current.visible = false;
          setTimeout(() => {
            if (modelRef.current) {
              modelRef.current.visible = true;
            }
          }, 50);
        }
      }
    };
    
    const interval = setInterval(checkLegacyOverride, 100);
    return () => clearInterval(interval);
  }, [legacyArTestingOverride, arPosition]);

  // =================================================================
  // POSITIONING SYSTEM INTERFACE
  // =================================================================
  
  // Unified positioning interface that delegates to the active system
 const positionModel = (model: THREE.Points) => {
  if (USE_NEW_POSITIONING) {
    
    // Pass our locally calculated scale to the world system
    const success = newPositionObject(model, 'mac', { 
      manualScale: initialScale 
    });
    
    if (success) {
      console.log('🧪 NEW: Scale after positioning (before force):', model.scale.x);
      
      // FORCE our local scale AFTER positioning to override anchor scale
      model.scale.set(initialScale, initialScale, initialScale);
      
      console.log('🧪 NEW: Forced local scale after positioning:', initialScale);
      console.log('🧪 NEW: Final model position:', model.position.toArray());
      console.log('🧪 NEW: Final model scale:', model.scale.x);
    } else {
      console.warn('🧪 NEW: Positioning failed');
    }
    return success;
  } else {
    console.log('🎯 LEGACY: Positioning model with GPS-to-AR system');
    legacyPositionModel(model);
    return true;
  }
};

  const handleModelReset = (model: THREE.Points) => {
    if (USE_NEW_POSITIONING) {
      console.log('🔄 NEW SYSTEM: Resetting model');
      // Reset transforms first - keep same orientation as legacy for consistency
      model.rotation.set(-Math.PI / 2, 0, 0); // Same Z-up to Y-up conversion as legacy
      model.scale.set(initialScale, initialScale, initialScale); // Reset to initial calculated scale first
      // Use new system positioning with our local scale
      newPositionObject(model, 'mac', { 
        manualScale: initialScale 
      });
      // Store the final scale after positioning system applies its changes
      activeScaleRef.current = model.scale.x;
      console.log('🔄 NEW: Reset completed with local scale:', initialScale);
      console.log('🔄 NEW: Final scale after reset:', model.scale.x);
    } else {
      console.log('🔄 LEGACY: Resetting model');
      legacyHandleReset(model);
      // Store the legacy scale for consistency
      activeScaleRef.current = model.scale.x;
    }
  };

  const getPositionInfo = () => {
    if (USE_NEW_POSITIONING) {
      return newGetPosition('mac');
    } else {
      return {
        system: 'legacy',
        debugMode: legacyArTestingOverride,
        position: modelRef.current?.position.toArray() || null,
        arPosition: arPosition.toArray()
      };
    }
  };



  // =================================================================
  // SHARED MODEL SETUP AND CONFIGURATION
  // =================================================================

  // Refs for Three.js objects
  const modelRef = useRef<THREE.Points | null>(null);
  const initialScaleRef = useRef<number>(1);
  const originalGeometryRef = useRef<THREE.BufferGeometry | null>(null);
  const activeScaleRef = useRef<number>(1); // Store the actual scale after positioning system applies

  // Point cloud state
  const [hasPointCloud, setHasPointCloud] = useState(false);
  const [pointCount, setPointCount] = useState(0);

  // Model configuration
  const knownMaxDim = 13.2659; // X dimension is largest for Mac
  const knownCenter = new THREE.Vector3(0.357610, -0.017726, 4.838261);
  const scale = 2.5 / knownMaxDim;
  initialScaleRef.current = scale; 
  const initialScale = initialScaleRef.current;
  
  // Point cloud configuration
  const POINT_SIZE = 2;
  const POINT_DENSITY = 0.7;

  // =================================================================
  // GESTURE HANDLERS (SYSTEM AGNOSTIC)
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
          console.log(`🎮 Rotation applied (${USE_NEW_POSITIONING ? 'NEW' : 'LEGACY'}):`, {
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
          console.log(`🔍 Scale applied (${USE_NEW_POSITIONING ? 'NEW' : 'LEGACY'}):`, {
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
        console.log(`🔄 RESET triggered (${USE_NEW_POSITIONING ? 'NEW' : 'LEGACY'} system)`);
        if (modelRef.current) {
          handleModelReset(modelRef.current);
        }
      });
    }

    // Register swipe handlers
    if (onSwipeUp) {
      onSwipeUp(() => {
        console.log(`👆 Swipe up (${USE_NEW_POSITIONING ? 'NEW' : 'LEGACY'})`);
      });
    }

    if (onSwipeDown) {
      onSwipeDown(() => {
        console.log(`👇 Swipe down (${USE_NEW_POSITIONING ? 'NEW' : 'LEGACY'})`);
      });
    }
  }, []); // No dependencies - register once

  // =================================================================
  // MODEL LOADING AND SCENE SETUP
  // =================================================================

  // Geometry sampling function
  const sampleGeometry = (geometry: THREE.BufferGeometry, density: number): THREE.BufferGeometry => {
    if (density >= 1.0) return geometry;
    
    const positions = geometry.attributes.position;
    const colors = geometry.attributes.color;
    const normals = geometry.attributes.normal;
    
    const totalPoints = positions.count;
    const sampleCount = Math.floor(totalPoints * density);
    
    // Create new geometry
    const sampledGeometry = new THREE.BufferGeometry();
    
    // Sample positions
    const sampledPositions = new Float32Array(sampleCount * 3);
    const sampledColors = colors ? new Float32Array(sampleCount * 3) : null;
    const sampledNormals = normals ? new Float32Array(sampleCount * 3) : null;
    
    // Random sampling with consistent distribution
    const indices = [];
    for (let i = 0; i < totalPoints; i++) indices.push(i);
    
    // Shuffle for random sampling
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    
    // Copy sampled data
    for (let i = 0; i < sampleCount; i++) {
      const idx = indices[i];
      
      // Positions
      sampledPositions[i * 3] = positions.getX(idx);
      sampledPositions[i * 3 + 1] = positions.getY(idx);
      sampledPositions[i * 3 + 2] = positions.getZ(idx);
      
      // Colors
      if (colors && sampledColors) {
        sampledColors[i * 3] = colors.getX(idx);
        sampledColors[i * 3 + 1] = colors.getY(idx);
        sampledColors[i * 3 + 2] = colors.getZ(idx);
      }
      
      // Normals
      if (normals && sampledNormals) {
        sampledNormals[i * 3] = normals.getX(idx);
        sampledNormals[i * 3 + 1] = normals.getY(idx);
        sampledNormals[i * 3 + 2] = normals.getZ(idx);
      }
    }
    
    sampledGeometry.setAttribute('position', new THREE.BufferAttribute(sampledPositions, 3));
    if (sampledColors) {
      sampledGeometry.setAttribute('color', new THREE.BufferAttribute(sampledColors, 3));
    }
    if (sampledNormals) {
      sampledGeometry.setAttribute('normal', new THREE.BufferAttribute(sampledNormals, 3));
    }
    
    return sampledGeometry;
  };

  // Main model loading effect
  useEffect(() => {
    let isMounted = true;
    
    console.log(`🎯 MAC Experience starting with ${USE_NEW_POSITIONING ? 'NEW WORLD COORDINATE' : 'LEGACY GPS-TO-AR'} positioning system`);
    
    // Use provided AR scene and camera
    const scene = arScene;
    const camera = arCamera;

    // Create loader
    const loader = new PLYLoader();
    
    // Create loading indicator
    const loadingDiv = document.createElement('div');
    loadingDiv.style.position = 'absolute';
    loadingDiv.style.top = '50%';
    loadingDiv.style.left = '50%';
    loadingDiv.style.transform = 'translate(-50%, -50%)';
    loadingDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    loadingDiv.style.color = 'white';
    loadingDiv.style.padding = '20px';
    loadingDiv.style.borderRadius = '10px';
    loadingDiv.style.zIndex = '1003';
    loadingDiv.innerHTML = `Loading MAC Model...<br><small>Using ${USE_NEW_POSITIONING ? 'World Coordinate' : 'Legacy GPS'} System</small>`;
    document.body.appendChild(loadingDiv);

    // Load the PLY model
    const modelPath = getAssetPath('models/mac.ply');
    console.log('📦 Loading MAC PLY model:', modelPath);

    loader.load(
      modelPath,
      (geometry) => {
        if (!isMounted) return;

        console.log('📊 PLY geometry loaded:', {
          vertices: geometry.attributes.position.count,
          hasColors: !!geometry.attributes.color,
          hasNormals: !!geometry.attributes.normal,
          positioningSystem: USE_NEW_POSITIONING ? 'NEW' : 'LEGACY'
        });

        // Store original geometry
        originalGeometryRef.current = geometry.clone();
        
        // Apply density sampling
        const sampledGeometry = sampleGeometry(geometry, POINT_DENSITY);
        const finalPointCount = sampledGeometry.attributes.position.count;
        
        // Create point material
        const material = new THREE.PointsMaterial({
          size: 1.0,
          sizeAttenuation: false,
          vertexColors: !!sampledGeometry.attributes.color
        });

        // Set fallback color if no vertex colors
        if (!sampledGeometry.attributes.color) {
          material.color.setHex(0xff6b6b);
        }

        // Create point cloud
        const pointCloud = new THREE.Points(sampledGeometry, material);
        pointCloud.name = 'mac-point-cloud';
        modelRef.current = pointCloud;
        
        // Apply model centering (move model center to origin)
        pointCloud.position.set(-knownCenter.x, -knownCenter.y, -knownCenter.z);
        pointCloud.scale.set(initialScale, initialScale, initialScale);
        pointCloud.rotation.set(-Math.PI / 2, 0, 0);
        
        // Add to scene
        scene.add(pointCloud);
        
        activeScaleRef.current = pointCloud.scale.x;

        
        // Update state
        setHasPointCloud(true);
        setPointCount(finalPointCount);
        onExperienceReady?.();
        
        // Remove loading indicator
        if (document.body.contains(loadingDiv)) {
          document.body.removeChild(loadingDiv);
        }
        
        console.log(`🎉 MAC Experience ready with ${USE_NEW_POSITIONING ? 'NEW' : 'LEGACY'} positioning system`);
      },
      
      // Progress callback
      (xhr) => {
        const percent = (xhr.loaded / xhr.total) * 100;
        if (loadingDiv && document.body.contains(loadingDiv)) {
          loadingDiv.innerHTML = `Loading MAC ${percent.toFixed(0)}%<br><small>Using ${USE_NEW_POSITIONING ? 'World Coordinate' : 'Legacy GPS'} System</small>`;
        }
      },
      
      // Error callback
      (error) => {
        console.error('❌ Error loading MAC PLY:', error);
        if (document.body.contains(loadingDiv)) {
          loadingDiv.innerHTML = `Error loading MAC PLY file<br><small>System: ${USE_NEW_POSITIONING ? 'World Coordinate' : 'Legacy GPS'}</small>`;
          loadingDiv.style.color = '#ff6666';
        }
      }
    );

//******** WAIT FOR THE HOOK TO BE READY FOR NEW POSITION SYSTEM */
    useEffect(() => {
      if (USE_NEW_POSITIONING && newSystemReady && modelRef.current && hasPointCloud) {
        console.log('🧪 NEW: Hook became ready, positioning model now...');
        positionModel(modelRef.current)
      }
    }, [newSystemReady, hasPointCloud])
    
    // Cleanup function
    return () => {
      isMounted = false;
      
      // Clean up geometries
      if (originalGeometryRef.current) {
        originalGeometryRef.current.dispose();
      }
      
      if (modelRef.current && modelRef.current.geometry) {
        modelRef.current.geometry.dispose();
      }
      
      if (modelRef.current && modelRef.current.material) {
        if (Array.isArray(modelRef.current.material)) {
          modelRef.current.material.forEach(material => material.dispose());
        } else {
          modelRef.current.material.dispose();
        }
      }
      
      // Remove loading indicator if still present
      if (document.body.contains(loadingDiv)) {
        document.body.removeChild(loadingDiv);
      }
      
      console.log(`🧹 MAC Experience cleanup completed (${USE_NEW_POSITIONING ? 'NEW' : 'LEGACY'} system)`);
    };
  }, []); // Only run once on mount

  // =================================================================
  // DEBUG INTERFACE
  // =================================================================

  return (
    <>
      {/* Debug Panel for System Comparison */}
      {SHOW_DEBUG_PANEL && (
        <div style={{
          position: 'absolute',
          bottom: '10px',
          right: '10px',
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          color: 'white',
          padding: '12px',
          borderRadius: '8px',
          fontSize: '11px',
          zIndex: 1003,
          pointerEvents: 'auto',
          fontFamily: 'monospace',
          maxWidth: '320px'
        }}>
          <div style={{ 
            color: USE_NEW_POSITIONING ? 'lightgreen' : 'orange', 
            marginBottom: '8px', 
            fontSize: '12px',
            fontWeight: 'bold'
          }}>
            🎯 MAC - {USE_NEW_POSITIONING ? 'NEW WORLD COORDINATE' : 'LEGACY GPS-TO-AR'} SYSTEM
          </div>
          
          {/* System Status */}
          <div style={{ marginBottom: '8px', padding: '4px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '4px' }}>
            <div>Active System: <span style={{ color: USE_NEW_POSITIONING ? 'lightgreen' : 'orange' }}>
              {USE_NEW_POSITIONING ? 'NEW (World Coordinates)' : 'LEGACY (GPS-to-AR)'}
            </span></div>
            {USE_NEW_POSITIONING ? (
              <>
                <div>Hook Ready: <span style={{ color: newSystemReady ? 'lightgreen' : 'red' }}>
                  {newSystemReady ? '✅' : '❌'}
                </span></div>
                <div>Debug Mode: <span style={{ color: newDebugMode ? 'lightgreen' : 'gray' }}>
                  {newDebugMode ? '✅ ON' : '❌ OFF'}
                </span></div>
              </>
            ) : (
              <div>Override Mode: <span style={{ color: legacyArTestingOverride ? 'yellow' : 'cyan' }}>
                {legacyArTestingOverride ? '🔧 DEBUG' : '📍 GPS'}
              </span></div>
            )}
          </div>

          {/* Position Info */}
          {modelRef.current && (
            <div style={{ marginBottom: '8px' }}>
              <div style={{ color: 'cyan', fontSize: '10px' }}>Model Position:</div>
              <div>X: {modelRef.current.position.x.toFixed(2)}</div>
              <div>Y: {modelRef.current.position.y.toFixed(2)}</div>
              <div>Z: {modelRef.current.position.z.toFixed(2)}</div>
              <div style={{ fontSize: '9px', opacity: 0.7 }}>
                Rotation: [{modelRef.current.rotation.x.toFixed(2)}, {modelRef.current.rotation.y.toFixed(2)}, {modelRef.current.rotation.z.toFixed(2)}]
              </div>
            </div>
          )}

          {/* User Position */}
          {(USE_NEW_POSITIONING ? newUserPosition : true) && (
            <div style={{ marginBottom: '8px' }}>
              <div style={{ color: 'lightblue', fontSize: '10px' }}>
                {USE_NEW_POSITIONING ? 'User GPS (Hook):' : 'AR Position:'}
              </div>
              {USE_NEW_POSITIONING && newUserPosition ? (
                <>
                  <div>{newUserPosition[0].toFixed(6)}</div>
                  <div>{newUserPosition[1].toFixed(6)}</div>
                </>
              ) : (
                <div>[{arPosition.x.toFixed(2)}, {arPosition.y.toFixed(2)}, {arPosition.z.toFixed(2)}]</div>
              )}
            </div>
          )}

          {/* Point Cloud Info */}
          <div style={{ marginBottom: '8px' }}>
            <div style={{ color: 'pink', fontSize: '10px' }}>Point Cloud:</div>
            <div>Points: {pointCount.toLocaleString()}</div>
            <div>Density: {POINT_DENSITY * 100}%</div>
          </div>

          {/* System-Specific Test Controls */}
          <div style={{ marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.3)', paddingTop: '8px' }}>
            {USE_NEW_POSITIONING ? (
              // NEW SYSTEM CONTROLS
              <>
                <button
                  onClick={() => {
                    if (newSystemReady && modelRef.current) {
                      console.log('🧪 NEW: Manual positioning test...');
                      const success = newPositionObject(modelRef.current, 'mac');
                      console.log(`🧪 NEW: Manual positioning ${success ? 'SUCCESS' : 'FAILED'}`);
                    }
                  }}
                  disabled={!newSystemReady}
                  style={{
                    padding: '4px 8px',
                    backgroundColor: newSystemReady ? 'rgba(0,255,0,0.3)' : 'rgba(128,128,128,0.3)',
                    border: 'none',
                    color: 'white',
                    cursor: newSystemReady ? 'pointer' : 'not-allowed',
                    borderRadius: '4px',
                    fontSize: '10px',
                    marginRight: '4px',
                    marginBottom: '4px'
                  }}
                >
                  🧪 Test Position
                </button>

                <button
                  onClick={() => {
                    console.log('🧪 NEW: Elevation adjustment test...');
                    newAdjustElevation(-0.5);
                    if (modelRef.current && newSystemReady) {
                      newPositionObject(modelRef.current, 'mac');
                    }
                  }}
                  disabled={!newSystemReady}
                  style={{
                    padding: '4px 8px',
                    backgroundColor: newSystemReady ? 'rgba(255,165,0,0.3)' : 'rgba(128,128,128,0.3)',
                    border: 'none',
                    color: 'white',
                    cursor: newSystemReady ? 'pointer' : 'not-allowed',
                    borderRadius: '4px',
                    fontSize: '10px',
                    marginBottom: '4px'
                  }}
                >
                  📏 Elevate -0.5m
                </button>
              </>
            ) : (
              // LEGACY SYSTEM CONTROLS
              <>
                <button
                  onClick={() => {
                    if (modelRef.current) {
                      console.log('🎯 LEGACY: Manual positioning test...');
                      legacyPositionModel(modelRef.current);
                      console.log('🎯 LEGACY: Manual positioning completed');
                    }
                  }}
                  style={{
                    padding: '4px 8px',
                    backgroundColor: 'rgba(255,165,0,0.3)',
                    border: 'none',
                    color: 'white',
                    cursor: 'pointer',
                    borderRadius: '4px',
                    fontSize: '10px',
                    marginRight: '4px',
                    marginBottom: '4px'
                  }}
                >
                  🎯 Test Position
                </button>

                <button
                  onClick={() => {
                    console.log('🎯 LEGACY: Toggle override test...');
                    const currentOverride = (window as any).arTestingOverride ?? true;
                    (window as any).arTestingOverride = !currentOverride;
                    console.log('🎯 LEGACY: Override now:', !currentOverride);
                  }}
                  style={{
                    padding: '4px 8px',
                    backgroundColor: 'rgba(0,165,255,0.3)',
                    border: 'none',
                    color: 'white',
                    cursor: 'pointer',
                    borderRadius: '4px',
                    fontSize: '10px',
                    marginBottom: '4px'
                  }}
                >
                  🔧 Toggle Override
                </button>
              </>
            )}
          </div>

          {/* System Info */}
          <div style={{ marginTop: '8px', fontSize: '9px', opacity: 0.8 }}>
            <div style={{ color: 'yellow' }}>System Info:</div>
            {USE_NEW_POSITIONING ? (
              <div>Uses centralized world coordinate system with anchor management</div>
            ) : (
              <div>Uses direct GPS-to-Three.js coordinate conversion with manual positioning</div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default MacExperience;