import React, { useEffect, useState, useRef } from 'react';
import * as THREE from 'three';
import { getAssetPath } from '../../utils/assetPaths';

// Import PLYLoader separately to avoid Vite optimization issues
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';

import { useARPositioning } from '../../hooks/useARPositioning';

interface MacExperienceProps {
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
  onExperienceReady,
  onElevationChanged,
  sharedARPositioning,
  isUniversalMode = false 
}) => {

  // =================================================================
  // NEW WORLD COORDINATE POSITIONING SYSTEM
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
  // POSITIONING SYSTEM INTERFACE
  // =================================================================
  
  const positionModel = (model: THREE.Points) => {
    if (!newSystemReady) {
      console.log('🧪 NEW: Hook not ready yet, skipping positioning');
      return false;
    }
    
    if (isUniversalMode) {
      console.log('🌐 Universal Mode: Forcing debug position for Mac');
      const success = newPositionObject(model, 'mac', { useDebugOverride: true });
      return success;
    }
    
    const success = newPositionObject(model, 'mac');
    return success;
  };

  const handleModelReset = (model: THREE.Points) => {
    console.log('🔄 NEW SYSTEM: Resetting model');
    
    if (isUniversalMode) {
      newPositionObject(model, 'mac', { useDebugOverride: true });
    } else {
      newPositionObject(model, 'mac');
    }
    
    // Store the final scale after positioning system applies its changes
    activeScaleRef.current = model.scale.x;
    console.log('🔄 NEW: Reset completed with scale:', model.scale.x);
  };

  const getPositionInfo = () => {
    return newGetPosition('mac');
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
  // GESTURE HANDLERS
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
          console.log(`🎮 Rotation applied:`, {
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
          console.log(`🔍 Scale applied:`, {
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
        console.log(`🔄 RESET triggered`);
        if (modelRef.current) {
          handleModelReset(modelRef.current);
        }
      });
    }

    // Register swipe handlers
    if (onSwipeUp) {
      onSwipeUp(() => {
        console.log(`👆 Swipe up`);
      });
    }

    if (onSwipeDown) {
      onSwipeDown(() => {
        console.log(`👇 Swipe down`);
      });
    }
  }, []); // No dependencies - register once

  // Register elevation change handler
  useEffect(() => {
    if (onElevationChanged) {
      onElevationChanged(handleElevationChanged);
    }
  }, [onElevationChanged]);

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

  // Handle elevation changes from ArCameraComponent debug panel
  const handleElevationChanged = () => {
    console.log('🧪 MacExperience: handleElevationChanged called!');
    
    if (modelRef.current) {
      if (isUniversalMode) {
        const success = newPositionObject(modelRef.current, 'mac', { useDebugOverride: true });
        console.log('🧪 MacExperience: UNIVERSAL MODE - Model repositioned:', success);
      } else {
        const success = newPositionObject(modelRef.current, 'mac');
        console.log('🧪 MacExperience: NORMAL MODE - Model repositioned:', success);
      }
    } else {
      console.warn('🧪 MacExperience: modelRef.current is null, cannot reposition');
    }
  };

  // Monitor debug mode changes and reposition accordingly
  useEffect(() => {
    if (newDebugMode !== undefined) {
      console.log('🔗 newDebugMode changed to:', newDebugMode);
      
      (window as any).arTestingOverride = newDebugMode;
      
      // Add a small delay to ensure the anchor manager picks up the change
      setTimeout(() => {
        if (modelRef.current && newSystemReady) {
          console.log('🔗 Calling newPositionObject after debug mode change...');
          const success = newPositionObject(modelRef.current, 'mac');
          console.log('🔗 Positioning result:', success);
        }
      }, 100);
    }
  }, [newDebugMode]);

  // Wait for the positioning system to be ready and position the model
  useEffect(() => {
    if (newSystemReady && modelRef.current && hasPointCloud) {
      console.log('🧪 NEW: Hook became ready, positioning model now...');
      positionModel(modelRef.current);
    }
  }, [newSystemReady, hasPointCloud]);

  // Main model loading effect
  useEffect(() => {
    let isMounted = true;
    
    console.log(`🎯 MAC Experience starting with NEW WORLD COORDINATE positioning system`);
    
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
    loadingDiv.innerHTML = `Loading MAC Model...<br><small>Using World Coordinate System${isUniversalMode ? ' - Universal Mode' : ''}</small>`;
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
          positioningSystem: 'NEW_WORLD_COORDINATE'
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
        
        console.log(`🎉 MAC Experience ready with NEW positioning system`);
      },
      
      // Progress callback
      (xhr) => {
        const percent = (xhr.loaded / xhr.total) * 100;
        if (loadingDiv && document.body.contains(loadingDiv)) {
          loadingDiv.innerHTML = `Loading MAC ${percent.toFixed(0)}%<br><small>Using World Coordinate System</small>`;
        }
      },
      
      // Error callback
      (error) => {
        console.error('❌ Error loading MAC PLY:', error);
        if (document.body.contains(loadingDiv)) {
          loadingDiv.innerHTML = `Error loading MAC PLY file<br><small>World Coordinate System</small>`;
          loadingDiv.style.color = '#ff6666';
        }
      }
    );

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
      
      console.log(`🧹 MAC Experience cleanup completed`);
    };
  }, []); // Only run once on mount

  // No visible UI - this component only manages the 3D model in the AR scene
  return null;
};

export default MacExperience;