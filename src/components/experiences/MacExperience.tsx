import React, { useEffect, useState, useRef } from 'react';
import * as THREE from 'three';
import { getAssetPath } from '../../utils/assetPaths';

// Import PLYLoader separately to avoid Vite optimization issues
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// NEW: Import the positioning hook
import { useARPositioning } from '../../hooks/useARPositioning';

const SHOW_DEBUG_PANEL = true; // Enable for testing

// NEW: Test flag to switch between systems
const USE_NEW_POSITIONING = true; // Set to true to test new hook

interface MacExperienceProps {
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
}

const MacExperience: React.FC<MacExperienceProps> = ({ 
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
  onExperienceReady
}) => {

  // NEW: Use the positioning hook
  const { 
    positionObject, 
    getPosition,
    adjustGlobalElevation,
    isReady: hookReady,
    userPosition: hookUserPosition,
    debugMode: hookDebugMode,
    getDebugInfo
  } = useARPositioning();

  // Refs for Three.js objects
  const modelRef = useRef<THREE.Points | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const initialScaleRef = useRef<number>(1);
  
  // Store original geometry for density/size adjustments
  const originalGeometryRef = useRef<THREE.BufferGeometry | null>(null);
  
  // Store initial camera position for reset
  const initialCameraPos = useRef(new THREE.Vector3(0, 0, 5));
  
  // OLD SYSTEM: State to track override status (keep for comparison)
  const [arTestingOverride, setArTestingOverride] = useState(() => {  
    return (window as any).arTestingOverride ?? true;
  });

  // Point cloud state
  const [hasPointCloud, setHasPointCloud] = useState(false);
  const [pointCount, setPointCount] = useState(0);

  const knownMaxDim = 13.2659; // X dimension is largest for Mac
  const knownCenter = new THREE.Vector3(0.357610, -0.017726, 4.838261);

  // Define isArMode at the component level
  const isArMode = !!(arScene && arCamera && arPosition);

  //SCALE
  const scale = 2.5/ knownMaxDim;
  initialScaleRef.current = scale; 
  const initialScale = initialScaleRef.current;
  
  // Point cloud configuration (fixed as requested)
  const POINT_SIZE = 2;
  const POINT_DENSITY = 0.7;

  // NEW: Test positioning with hook when model loads
  useEffect(() => {
    if (modelRef.current && USE_NEW_POSITIONING && hookReady) {
      console.log('🧪 Testing NEW positioning system with hook...');
      
      const success = positionObject(modelRef.current, 'mac');
      console.log(`🧪 Hook positioning result: ${success ? 'SUCCESS' : 'FAILED'}`);
      
      if (success) {
        console.log('🧪 Model positioned by hook at:', modelRef.current.position);
        
        // Get position data for debugging
        const positionData = getPosition('mac');
        if (positionData) {
          console.log('🧪 Hook position data:', {
            worldPosition: positionData.worldPosition.toArray(),
            relativeToUser: positionData.relativeToUser.toArray(),
            isUsingDebugMode: positionData.isUsingDebugMode,
            distanceFromUser: positionData.distanceFromUser
          });
        }
      }
    }
  }, [modelRef.current, hookReady, USE_NEW_POSITIONING, positionObject, getPosition]);

  // OLD SYSTEM: Listen for override changes (keep for comparison)
  useEffect(() => {
    if (!USE_NEW_POSITIONING) {
      const checkOverride = () => {
        const currentOverride = (window as any).arTestingOverride ?? true;
        if (currentOverride !== arTestingOverride) {
          setArTestingOverride(currentOverride);
          console.log('🎯 OLD SYSTEM: MacExperience override changed:', currentOverride);
          
          if (modelRef.current && isArMode && arPosition) {
            if (currentOverride) {
              console.log('🎯 OLD SYSTEM: Setting override position (0, 0, -5)');
              modelRef.current.position.set(0, 0, -5);
            } else {
              console.log('🎯 OLD SYSTEM: Setting anchor position:', arPosition);
              modelRef.current.position.copy(arPosition);
            }
            
            // Force visual update
            modelRef.current.visible = false;
            setTimeout(() => {
              if (modelRef.current) {
                modelRef.current.visible = true;
              }
            }, 50);
            
            console.log('🎯 OLD SYSTEM: Model position after change:', modelRef.current.position);
          }
        }
      };
      
      const interval = setInterval(checkOverride, 100);
      return () => clearInterval(interval);
    }
  }, [arTestingOverride, isArMode, arPosition, USE_NEW_POSITIONING]);

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
        }
      });
    }

    // Register scale handler
    if (onModelScale) {
      onModelScale((scaleFactor: number) => {
        if (modelRef.current) {
          const currentScale = modelRef.current.scale.x;
          const newScale = Math.max(0.1, Math.min(10, currentScale * scaleFactor));
          console.log('🔍 Scale handler called:', {
            scaleFactor,
            currentScale: currentScale.toFixed(3),
            newScale: newScale.toFixed(3),
            system: USE_NEW_POSITIONING ? 'NEW' : 'OLD'
          });
          modelRef.current.scale.setScalar(newScale);
        }
      });
    }

    // Register reset handler
    if (onModelReset) {
      onModelReset(() => {
        console.log(`🔄 RESET HANDLER CALLED - ${USE_NEW_POSITIONING ? 'NEW' : 'OLD'} system`);
        if (modelRef.current) {
          // Reset rotation and scale
          modelRef.current.rotation.set(-Math.PI / 2, 0, 0); // Keep Z-up to Y-up conversion
          modelRef.current.scale.set(initialScale, initialScale, initialScale);
          
          if (USE_NEW_POSITIONING && hookReady) {
            // NEW SYSTEM: Use hook for positioning
            console.log('🔄 NEW SYSTEM: Using hook for reset positioning');
            positionObject(modelRef.current, 'mac');
          } else {
            // OLD SYSTEM: Manual positioning logic
            if (isArMode && arPosition) {
              const currentOverride = (window as any).arTestingOverride ?? true;
              
              if (currentOverride) {
                modelRef.current.position.set(0, 0, -5);
                console.log('🔄 OLD SYSTEM: MAC positioned at override location');
              } else {
                modelRef.current.position.copy(arPosition);
                console.log('🔄 OLD SYSTEM: MAC positioned at AR anchor location');
              }
            } else {
              modelRef.current.position.set(0, 0, -3);
              console.log('🔄 OLD SYSTEM: MAC positioned at standalone location');
            }
          }
          
          console.log('🔄 Model reset completed - Scale is now:', modelRef.current.scale.x);
        }
      });
    }

    // Register swipe handlers
    if (onSwipeUp) {
      onSwipeUp(() => {
        console.log('👆 Swipe up detected on MAC');
      });
    }

    if (onSwipeDown) {
      onSwipeDown(() => {
        console.log('👇 Swipe down detected on MAC');
      });
    }
  }, [USE_NEW_POSITIONING, hookReady, positionObject]); // Added dependencies

  const centeringOffset = new THREE.Vector3(-knownCenter.x, -knownCenter.y, -knownCenter.z);

  // OLD SYSTEM: Position updates (only run if using old system)
  useEffect(() => {
    if (!USE_NEW_POSITIONING && modelRef.current && arPosition && isArMode) {
      const currentOverride = (window as any).arTestingOverride ?? false;
      
      if (!currentOverride) {
        // Apply AR position + centering offset
        const finalPosition = arPosition.clone().add(centeringOffset);
        modelRef.current.position.copy(finalPosition);
        
        console.log('🎯 OLD SYSTEM: MAC positioned with centering:', {
          arPosition,
          centeringOffset,
          finalPosition
        });
      }
    }
  }, [arPosition, isArMode, USE_NEW_POSITIONING]);

  // Geometry sampling function (ported from CodePen)
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

  // Main effect for model loading and scene setup
  useEffect(() => {
    let isMounted = true;
    
    console.log(`🎯 MACExperience mode: ${isArMode ? 'AR' : 'Standalone'} | System: ${USE_NEW_POSITIONING ? 'NEW HOOK' : 'OLD'}`);
    
    // Create container for standalone mode
    const container = document.createElement('div');
    container.id = 'threejs-container';
    container.style.position = 'fixed';
    container.style.top = '0';
    container.style.left = '0';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.zIndex = '1001';
    
    if (!isArMode) {
      document.body.appendChild(container);
    }

    // Initialize Three.js components
    let scene: THREE.Scene;
    let camera: THREE.PerspectiveCamera;
    let renderer: THREE.WebGLRenderer | null = null;
    let controls: OrbitControls | null = null;

    if (isArMode) {
      // AR Mode: Use provided scene and camera
      scene = arScene!;
      camera = arCamera!;
      sceneRef.current = scene;
      cameraRef.current = camera;
      console.log('🎯 MACExperience using AR scene and camera');
    } else {
      // Standalone Mode: Create own scene/camera/renderer
      scene = new THREE.Scene();
      sceneRef.current = scene;
      
      camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
      camera.position.copy(initialCameraPos.current);
      cameraRef.current = camera;
      
      renderer = new THREE.WebGLRenderer({ 
        antialias: true, 
        alpha: true,
        premultipliedAlpha: false
      });
      
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setClearColor(0x000000, 0);
      container.appendChild(renderer.domElement);

      // Add OrbitControls only in standalone mode
      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.25;
      controls.screenSpacePanning = false;
      controls.minDistance = 0.5;
      controls.maxDistance = 10;
      controls.maxPolarAngle = Math.PI / 1.5;
      controls.target.set(0, 0, 0);
      controlsRef.current = controls;
      
      // Add lighting only in standalone mode
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
      scene.add(ambientLight);

      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
      directionalLight.position.set(1, 1, 1).normalize();
      scene.add(directionalLight);
    }

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
    loadingDiv.innerHTML = `Loading MAC (${USE_NEW_POSITIONING ? 'NEW' : 'OLD'} system)...`;
    container.appendChild(loadingDiv);

    // Load the PLY model
    const modelPath = getAssetPath('models/mac.ply');
    console.log('🎯 Loading MAC PLY model:', modelPath);

    // PLY loader
    loader.load(
      modelPath,
      (geometry) => {
        if (!isMounted) return;

        console.log('📊 Original PLY loaded:', {
          vertices: geometry.attributes.position.count,
          hasColors: !!geometry.attributes.color,
          hasNormals: !!geometry.attributes.normal
        });

        // Store original geometry
        originalGeometryRef.current = geometry.clone();
        
        // Apply density sampling
        const sampledGeometry = sampleGeometry(geometry, POINT_DENSITY);
        const finalPointCount = sampledGeometry.attributes.position.count;
        
        // Create point material with simple fixed size
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
        pointCloud.name = 'mac-point-cloud'; // Name for debugging
        modelRef.current = pointCloud;
        
        // Apply centering - move model so its center is at origin
        pointCloud.position.x = -knownCenter.x;
        pointCloud.position.y = -knownCenter.y;
        pointCloud.position.z = -knownCenter.z;

        pointCloud.scale.set(initialScale, initialScale, initialScale);
        
        // Apply Z-up to Y-up rotation (Blender to Three.js conversion)
        pointCloud.rotation.x = -Math.PI / 2;

        // Add point cloud to scene FIRST
        scene.add(pointCloud);
        
        // THEN apply positioning based on system
        if (USE_NEW_POSITIONING) {
          console.log('🧪 NEW SYSTEM: Model loaded, will use hook for positioning');
          // The useEffect above will handle positioning via hook
        } else {
          console.log('🎯 OLD SYSTEM: Applying manual positioning');
          // Apply final positioning - OLD SYSTEM
          if (isArMode && arPosition) {
            const currentOverride = (window as any).arTestingOverride ?? true;
            
            if (currentOverride) {
              pointCloud.position.set(0, 0, -5);
              console.log('🔄 OLD SYSTEM: MAC positioned at override location');
            } else {
              pointCloud.position.copy(arPosition);
              console.log('🔄 OLD SYSTEM: MAC positioned at AR anchor location');
            }
          } else {
            // Add standalone offset to centered position
            pointCloud.position.add(new THREE.Vector3(0, 0, -3));
            console.log('🎯 OLD SYSTEM: MAC positioned at standalone location');
          }
        }
        
        // Update state
        setHasPointCloud(true);
        setPointCount(finalPointCount);
        onExperienceReady?.();
        
        // Remove loading indicator
        if (container.contains(loadingDiv)) {
          container.removeChild(loadingDiv);
        }
        
        console.log('✅ MAC point cloud loaded successfully');
      },
      
      // Progress callback
      (xhr) => {
        const percent = (xhr.loaded / xhr.total) * 100;
        if (loadingDiv && container.contains(loadingDiv)) {
          loadingDiv.innerHTML = `Loading MAC (${USE_NEW_POSITIONING ? 'NEW' : 'OLD'}) ${percent.toFixed(0)}%`;
        }
      },
      
      // Error callback
      (error) => {
        console.error('❌ Error loading MAC PLY:', error);
        if (container.contains(loadingDiv)) {
          loadingDiv.innerHTML = 'Error loading MAC PLY file';
          loadingDiv.style.color = '#ff6666';
        }
      }
    );

    // Handle window resize
    const handleResize = () => {
      if (isMounted && camera && renderer) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      }
    };
    
    window.addEventListener('resize', handleResize);
    
    // Cleanup function
    return () => {
      isMounted = false;
      
      window.removeEventListener('resize', handleResize);
      
      if (controls) {
        controls.dispose();
      }
      
      if (renderer) {
        renderer.dispose();
      }
      
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
      
      if (document.body.contains(container)) {
        document.body.removeChild(container);
      }
    };
  }, [isArMode, USE_NEW_POSITIONING]); // Added USE_NEW_POSITIONING dependency

  return (
    <>
      {/* Enhanced Debug Panel for Testing */}
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
          maxWidth: '300px'
        }}>
          <div style={{ color: 'yellow', marginBottom: '8px', fontSize: '12px' }}>
            🧪 MAC POSITIONING TEST
          </div>
          
          {/* System Status */}
          <div style={{ marginBottom: '8px', padding: '4px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '4px' }}>
            <div>System: <span style={{ color: USE_NEW_POSITIONING ? 'lightgreen' : 'orange' }}>
              {USE_NEW_POSITIONING ? 'NEW HOOK' : 'OLD MANUAL'}
            </span></div>
            <div>Mode: {isArMode ? 'AR' : 'Standalone'}</div>
            <div>Hook Ready: <span style={{ color: hookReady ? 'lightgreen' : 'red' }}>
              {hookReady ? '✅' : '❌'}
            </span></div>
            <div>Debug Mode: <span style={{ color: hookDebugMode ? 'lightgreen' : 'gray' }}>
              {hookDebugMode ? '✅ ON' : '❌ OFF'}
            </span></div>
          </div>

          {/* Position Info */}
          {modelRef.current && (
            <div style={{ marginBottom: '8px' }}>
              <div style={{ color: 'cyan', fontSize: '10px' }}>Current Position:</div>
              <div>X: {modelRef.current.position.x.toFixed(1)}</div>
              <div>Y: {modelRef.current.position.y.toFixed(1)}</div>
              <div>Z: {modelRef.current.position.z.toFixed(1)}</div>
            </div>
          )}

          {/* User Position */}
          {hookUserPosition && (
            <div style={{ marginBottom: '8px' }}>
              <div style={{ color: 'lightblue', fontSize: '10px' }}>User GPS:</div>
              <div>{hookUserPosition[0].toFixed(6)}</div>
              <div>{hookUserPosition[1].toFixed(6)}</div>
            </div>
          )}

          {/* Test Controls */}
          <div style={{ marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.3)', paddingTop: '8px' }}>
            <button
              onClick={() => {
                if (USE_NEW_POSITIONING && hookReady && modelRef.current) {
                  console.log('🧪 Manual hook positioning test...');
                  const success = positionObject(modelRef.current, 'mac');
                  console.log(`Manual positioning: ${success ? 'SUCCESS' : 'FAILED'}`);
                }
              }}
              disabled={!USE_NEW_POSITIONING || !hookReady}
              style={{
                padding: '4px 8px',
                backgroundColor: USE_NEW_POSITIONING && hookReady ? 'rgba(0,255,0,0.3)' : 'rgba(128,128,128,0.3)',
                border: 'none',
                color: 'white',
                cursor: 'pointer',
                borderRadius: '4px',
                fontSize: '10px',
                marginRight: '4px'
              }}
            >
              🧪 Test Hook
            </button>

            <button
              onClick={() => {
                console.log('🧪 Elevation adjustment test...');
                adjustGlobalElevation(-0.5);
                if (modelRef.current && USE_NEW_POSITIONING) {
                  positionObject(modelRef.current, 'mac');
                }
              }}
              disabled={!USE_NEW_POSITIONING || !hookReady}
              style={{
                padding: '4px 8px',
                backgroundColor: USE_NEW_POSITIONING && hookReady ? 'rgba(255,165,0,0.3)' : 'rgba(128,128,128,0.3)',
                border: 'none',
                color: 'white',
                cursor: 'pointer',
                borderRadius: '4px',
                fontSize: '10px'
              }}
            >
              📏 -0.5m
            </button>
          </div>

          {/* Debug Info */}
          {USE_NEW_POSITIONING && hookReady && (
            <div style={{ marginTop: '8px', fontSize: '9px', opacity: 0.8 }}>
              <div style={{ color: 'yellow' }}>Hook Debug:</div>
              <div>Toggle arTestingOverride to test debug positioning</div>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default MacExperience;