import React, { useEffect, useState, useRef } from 'react';
import * as THREE from 'three';
import { getAssetPath } from '../../utils/assetPaths';

// Import PLYLoader separately to avoid Vite optimization issues
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const SHOW_DEBUG_PANEL = false;


interface HelenSExperienceProps {
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

const HelenSExperience: React.FC<HelenSExperienceProps> = ({ 
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
  
  // State to track override status
  const [arTestingOverride, setArTestingOverride] = useState(() => {  
    return (window as any).arTestingOverride ?? true;
  });

  // Point cloud state
  const [hasPointCloud, setHasPointCloud] = useState(false);
  const [pointCount, setPointCount] = useState(0);

  const knownMaxDim = 17.4211; // X dimension is largest for Helen Fowler
  const knownCenter = new THREE.Vector3(-0.469336, 0.770841, 4.931496);

  // Define isArMode at the component level
  const isArMode = !!(arScene && arCamera && arPosition);


    //SCALE
  const scale = 2.5/ knownMaxDim;
  initialScaleRef.current = scale; 
  const initialScale = initialScaleRef.current;
  

  // Point cloud configuration (fixed as requested)
  const POINT_SIZE = 2; // Reduced from 1.0 - pixels can be very large
  const POINT_DENSITY = 0.7;

  // Listen for override changes
  useEffect(() => {
    const checkOverride = () => {
      const currentOverride = (window as any).arTestingOverride ?? true;
      if (currentOverride !== arTestingOverride) {
        setArTestingOverride(currentOverride);
        console.log('🎯 HelenSExperience override changed:', currentOverride);
        
        if (modelRef.current && isArMode && arPosition) {
          if (currentOverride) {
            console.log('🎯 Setting override position (0, 0, -5)');
            modelRef.current.position.set(0, 0, -5);
          } else {
            console.log('🎯 Setting anchor position:', arPosition);
            modelRef.current.position.copy(arPosition);
          }
          
          // Force visual update
          modelRef.current.visible = false;
          setTimeout(() => {
            if (modelRef.current) {
              modelRef.current.visible = true;
            }
          }, 50);
          
          console.log('🎯 Model position after change:', modelRef.current.position);
        }
      }
    };
    
    const interval = setInterval(checkOverride, 100);
    return () => clearInterval(interval);
  }, [arTestingOverride, isArMode, arPosition]);

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
         console.log('🔍 Scale handler called AFTER RESET:', {
            scaleFactor,
            currentScale: currentScale.toFixed(3),
            newScale: newScale.toFixed(3),
            timestamp: new Date().getTime()
          });
          modelRef.current.scale.setScalar(newScale);
        }
      });
    }

    // Register reset handler
    if (onModelReset) {
      onModelReset(() => {
        console.log('🔄 RESET HANDLER CALLED - Starting reset...');
        if (modelRef.current) {
          // Reset rotation and scale
          modelRef.current.rotation.set(-Math.PI / 2, 0, 0); // Keep Z-up to Y-up conversion
          // Reset to initial calculated scale, not 1
        
            modelRef.current.scale.set(initialScale, initialScale, initialScale);
          
          // Reset position based on current mode
          if (isArMode && arPosition) {
            const currentOverride = (window as any).arTestingOverride ?? true;
            
            if (currentOverride) {
              modelRef.current.position.set(0, 0, -5);
              console.log('🔄 Reset: Fowler positioned at override location');
            } else {
              modelRef.current.position.copy(arPosition);
              console.log('🔄 Reset: Fowler positioned at AR anchor location');
            }
          } else {
            modelRef.current.position.set(0, 0, -3);
            console.log('🔄 Reset: Fowler positioned at standalone location');
          }
          
          console.log('🔄 Model reset completed - Scale is now:', modelRef.current.scale.x);
        }
      });
    }

    // Register swipe handlers
    if (onSwipeUp) {
      onSwipeUp(() => {
        console.log('👆 Swipe up detected on Fowler');
      });
    }

    if (onSwipeDown) {
      onSwipeDown(() => {
        console.log('👇 Swipe down detected on Fowler');
      });
    }
  }, []); // Empty dependency array - register once on mount

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
    
    console.log('🎯 FowlerExperience mode:', isArMode ? 'AR' : 'Standalone');
    
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
      console.log('🎯 FowlerExperience using AR scene and camera');
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
    loadingDiv.innerHTML = 'Loading Fowler Point Cloud...';
    container.appendChild(loadingDiv);

    // Load the PLY model
    const modelPath = getAssetPath('models/fowler.ply');
    console.log('🎯 Loading Fowler PLY model:', modelPath);

    // Fixed PLY loader.load function
   // Optimized PLY loader using known Cloud Compare dimensions
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
    
    console.log('📊 Sampled geometry:', {
      originalPoints: geometry.attributes.position.count,
      sampledPoints: finalPointCount,
      density: POINT_DENSITY,
      reduction: `${(100 - (finalPointCount / geometry.attributes.position.count) * 100).toFixed(1)}%`
    });

    // Create point material with simple fixed size
    const material = new THREE.PointsMaterial({
      size: 1.0, // Fixed size - scale will handle the visual sizing
      sizeAttenuation: false, // Keep consistent size
      vertexColors: !!sampledGeometry.attributes.color
    });

    // Set fallback color if no vertex colors
    if (!sampledGeometry.attributes.color) {
      material.color.setHex(0x6b6bff); // Blue fallback for Fowler
      console.log('⚠️ No vertex colors found, using fallback color');
    } else {
      console.log('✅ Using embedded vertex colors from PLY');
    }

    // Create point cloud
    const pointCloud = new THREE.Points(sampledGeometry, material);
    modelRef.current = pointCloud;
    
    // Use known dimensions from Cloud Compare - NO expensive bounding box calculation



    console.log('📐 Using known model dimensions:', {
      maxDim: knownMaxDim,
      center: knownCenter
    });

    // Apply centering - move model so its center is at origin
    pointCloud.position.x = -knownCenter.x;
    pointCloud.position.y = -knownCenter.y;
    pointCloud.position.z = -knownCenter.z;

    // Calculate and apply scale using known max dimension
  
    pointCloud.scale.set(initialScale, initialScale, initialScale);
    
    console.log('🔧 Applied scale:', scale.toFixed(3));

    // Apply Z-up to Y-up rotation (Blender to Three.js conversion)
    pointCloud.rotation.x = -Math.PI / 2;

    // Apply final positioning - ADD to the centered position, don't replace it
    if (isArMode && arPosition) {
      const currentOverride = (window as any).arTestingOverride ?? true;
      
    if (currentOverride) {
          modelRef.current.position.set(0, 0, -5);
          console.log('🔄 Reset: Fowler positioned at override location');
        } else {
          modelRef.current.position.copy(arPosition);
          console.log('🔄 Reset: Fowler positioned at AR anchor location');
        }
    } else {
      // Add standalone offset to centered position
      pointCloud.position.add(new THREE.Vector3(0, 0, -3));
      console.log('🎯 Fowler positioned at standalone location');
    }
    
    // Add point cloud to scene
    scene.add(pointCloud);
    
    // Update state
    setHasPointCloud(true);
    setPointCount(finalPointCount);
    onExperienceReady?.();
    
    // Remove loading indicator
    if (container.contains(loadingDiv)) {
      container.removeChild(loadingDiv);
    }
    
    console.log('✅ Fowler point cloud loaded successfully');
    console.log('📊 Final model stats:', {
      position: {
        x: pointCloud.position.x.toFixed(3),
        y: pointCloud.position.y.toFixed(3), 
        z: pointCloud.position.z.toFixed(3)
      },
      rotation: {
        x: pointCloud.rotation.x.toFixed(3),
        y: pointCloud.rotation.y.toFixed(3),
        z: pointCloud.rotation.z.toFixed(3)
      },
      scale: {
        x: pointCloud.scale.x.toFixed(3),
        y: pointCloud.scale.y.toFixed(3),
        z: pointCloud.scale.z.toFixed(3)
      },
      pointCount: finalPointCount,
      pointSize: material.size,
      materialType: material.type
    });
  },
  
  // Progress callback
  (xhr) => {
    const percent = (xhr.loaded / xhr.total) * 100;
    console.log(`📥 Fowler PLY ${percent.toFixed(1)}% loaded`);
    if (loadingDiv && container.contains(loadingDiv)) {
      loadingDiv.innerHTML = `Loading Fowler Point Cloud... ${percent.toFixed(0)}%`;
    }
  },
  
  // Error callback
  (error) => {
    console.error('❌ Error loading Fowler PLY:', error);
    if (container.contains(loadingDiv)) {
      loadingDiv.innerHTML = 'Error loading Fowler PLY file. File may be missing or invalid.';
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
    
    // // Animation loop (no model animations needed for point clouds)
    // const animate = function () {
    //   if (!isMounted) return;
      
    //   requestAnimationFrame(animate);
      
    //   if (controls) {
    //     controls.update();
    //   }
      
    //   if (renderer && scene && camera) {
    //     renderer.render(scene, camera);
    //   }
    // };
    
    // animate();
    
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
  }, [isArMode]); // Only isArMode dependency

  return (
    <>
      {/* Debug Panel for Fowler Experience */}
      {SHOW_DEBUG_PANEL && (
        <div style={{
          position: 'absolute',
          bottom: '10px',
          right: '10px',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          color: 'white',
          padding: '10px',
          borderRadius: '4px',
          fontSize: '12px',
          zIndex: 1003,
          pointerEvents: 'auto',
          fontFamily: 'monospace'
        }}>
          <div style={{ color: 'yellow' }}>🖥️ Fowler POINT CLOUD DEBUG</div>
          <div>Mode: {isArMode ? 'AR Portal' : 'Standalone'}</div>
          {arPosition && (
            <div>AR Anchor: [{arPosition.x.toFixed(3)}, {arPosition.y.toFixed(3)}, {arPosition.z.toFixed(3)}]</div>
          )}
          {modelRef.current && (
            <div style={{ color: 'cyan' }}>
              Model Pos: [{modelRef.current.position.x.toFixed(3)}, {modelRef.current.position.y.toFixed(3)}, {modelRef.current.position.z.toFixed(3)}]
            </div>
          )}
          <div>Scale: {coordinateScale}x</div>
          <div style={{ color: hasPointCloud ? 'lightgreen' : 'orange' }}>
            Point Cloud: {hasPointCloud ? `✅ ${pointCount.toLocaleString()} pts` : '❌ None'}
          </div>
          <div style={{ color: 'lightblue', fontSize: '10px' }}>
            Size: {POINT_SIZE}px | Density: {(POINT_DENSITY * 100).toFixed(0)}%
          </div>
          
          <div 
            onClick={() => {
              const newValue = !arTestingOverride;
              (window as any).arTestingOverride = newValue;
              setArTestingOverride(newValue);
              console.log('🎯 AR Override toggled:', newValue ? 'ON' : 'OFF');
              
              // Immediately update model position if we have the model
              if (modelRef.current && isArMode && arPosition) {
                if (newValue) {
                  console.log('🎯 Immediately setting override position (0, 0, -5)');
                  modelRef.current.position.set(0, 0, -5);
                } else {
                  console.log('🎯 Immediately setting anchor position:', arPosition);
                  modelRef.current.position.copy(arPosition);
                }
                console.log('🎯 Model position updated to:', modelRef.current.position);
              }
            }}
            style={{ 
              cursor: 'pointer', 
              userSelect: 'none', 
              marginTop: '5px',
              padding: '2px 4px',
              backgroundColor: arTestingOverride ? 'rgba(0, 255, 0, 0.2)' : 'rgba(255, 0, 0, 0.2)',
              borderRadius: '2px'
            }}
          >
            Override: {arTestingOverride ? '✅ (0,0,-5)' : '❌ (AR Anchor)'}
          </div>
        </div>
      )}
    </>
  );
};

export default HelenSExperience;