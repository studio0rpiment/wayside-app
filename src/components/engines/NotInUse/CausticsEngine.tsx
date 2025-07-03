// engines/CausticsEngine.tsx
import React, { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { getAssetPath } from '../../utils/assetPaths';

interface CausticsEngineProps {
  scene: THREE.Scene;
  enabled: boolean;
  waterLevel: number;
  terrainY?: number; // For terrain-aware positioning
  
  // Positioning controls
  position?: THREE.Vector3;
  rotation?: THREE.Euler;
  scale?: number;
  
  // Visual controls  
  color?: THREE.Color;
  opacity?: number;
  blendMode?: THREE.Blending;
  
  // Animation controls
  animationSpeed?: number; // Frames between texture changes
  scrollSpeed?: number;    // Texture offset animation speed
  
  // Geometry options
  geometryType?: 'plane' | 'circle' | 'ring' | 'terrain';
  size?: number;
  segments?: number;
  
  // Performance options
  isArMode?: boolean;
  
  // Callbacks
  onReady?: () => void;
  onError?: (error: string) => void;
}

const CausticsEngine: React.FC<CausticsEngineProps> = ({
  scene,
  enabled,
  waterLevel,
  terrainY = 0,
  
  position = new THREE.Vector3(0, 0, 0),
  rotation = new THREE.Euler(0, 0, 0),
  scale = 1,
  
  color = new THREE.Color(0xffffff),
  opacity = 0.3,
  blendMode = THREE.AdditiveBlending,
  
  animationSpeed = 5,
  scrollSpeed = 0.1,
  
  geometryType = 'circle', // More organic than plane
  size = 20,
  segments = 32,
  
  isArMode = false,
  
  onReady,
  onError
}) => {
  console.log('🌊 CausticsEngine: Initializing caustics system');

  // Refs following your pattern
  const causticsGroupRef = useRef<THREE.Group | null>(null);
  const causticsMeshRef = useRef<THREE.Mesh | null>(null);
  const texturesRef = useRef<THREE.Texture[]>([]);
  const materialRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const animationIdRef = useRef<number | null>(null);
  const clockRef = useRef(new THREE.Clock());
  
  // Animation state (ref-based to avoid re-renders)
  const animationStateRef = useRef({
    currentTextureIndex: 0,
    frameCount: 0,
    time: 0,
    isAnimating: false
  });

  // Caustics configuration
  const causticsConfig = useRef({
    textureUrls: [
      getAssetPath('textures/c1.bmp'),
      getAssetPath('textures/c2.bmp'), 
      getAssetPath('textures/c3.bmp'),
      getAssetPath('textures/c4.bmp'),
      getAssetPath('textures/c5.bmp')
    ],
    // Smaller for AR performance, larger for standalone
    planeSize: isArMode ? size * 0.5 : size,
    segments: Math.max(8, segments / (isArMode ? 2 : 1))
  });

  // Create more organic geometry than plane
  const createCausticsGeometry = useCallback(() => {
    const config = causticsConfig.current;
    
    switch (geometryType) {
      case 'circle':
        // More organic circular spread - better for natural water caustics
        return new THREE.CircleGeometry(config.planeSize, config.segments);
        
      case 'ring':
        // Ring shape for interesting caustic patterns
        return new THREE.RingGeometry(
          config.planeSize * 0.2, 
          config.planeSize, 
          config.segments
        );
        
      case 'terrain':
        // Heightmapped plane for terrain following (future enhancement)
        const terrainGeom = new THREE.PlaneGeometry(
          config.planeSize, 
          config.planeSize, 
          config.segments, 
          config.segments
        );
        // Future: Apply your heightmap data here for terrain-following caustics
        return terrainGeom;
        
      case 'plane':
      default:
        return new THREE.PlaneGeometry(config.planeSize, config.planeSize);
    }
  }, [geometryType, isArMode, size, segments]);

  // Load caustics textures (extracted from your existing code)
  const loadCausticsTextures = useCallback(async () => {
    console.log('🌊 Loading caustics textures...');
    const textureLoader = new THREE.TextureLoader();
    const urls = causticsConfig.current.textureUrls;
    
    try {
      const textures = await Promise.all(
        urls.map((url, index) => 
          new Promise<THREE.Texture>((resolve, reject) => {
            textureLoader.load(
              url,
              (texture) => {
                // Configure for better performance and tiling
                texture.wrapS = THREE.RepeatWrapping;
                texture.wrapT = THREE.RepeatWrapping;
                texture.repeat.set(4, 4);
                texture.minFilter = THREE.LinearFilter;
                texture.magFilter = THREE.LinearFilter;
                
                console.log(`✅ Caustic texture ${index + 1}/${urls.length} loaded`);
                resolve(texture);
              },
              undefined,
              reject
            );
          })
        )
      );
      
      texturesRef.current = textures;
      console.log('🌊 All caustics textures loaded successfully');
      return textures;
      
    } catch (error) {
      console.warn('⚠️ Failed to load some caustic textures:', error);
      if (onError) onError('Failed to load caustic textures');
      return [];
    }
  }, [onError]);

  // Create caustics system (following your existing approach)
  const createCausticsSystem = useCallback(async () => {
    console.log('🌊 Creating caustics system...');
    
    // Load textures first
    const textures = await loadCausticsTextures();
    if (textures.length === 0) return null;

    // Create group
    const causticsGroup = new THREE.Group();
    causticsGroupRef.current = causticsGroup;
    
    // Create geometry
    const geometry = createCausticsGeometry();
    
    // Create material
    const material = new THREE.MeshBasicMaterial({
      map: textures[0],
      transparent: true,
      opacity: opacity,
      blending: blendMode,
      depthWrite: false,
      color: color,
      side: THREE.DoubleSide
    });
    materialRef.current = material;
    
    // Create mesh
    const causticsMesh = new THREE.Mesh(geometry, material);
    causticsMeshRef.current = causticsMesh;
    
    // Apply transforms
    causticsMesh.position.copy(position);
    causticsMesh.rotation.copy(rotation);
    causticsMesh.scale.setScalar(scale);
    
    // For ground projection, rotate to horizontal
    if (geometryType === 'circle' || geometryType === 'ring' || geometryType === 'terrain') {
      causticsMesh.rotation.x = -Math.PI / 2; // Lay flat on ground
    }
    
    causticsGroup.add(causticsMesh);
    
    // Position based on water level and terrain
    updateCausticsPosition(causticsGroup);
    
    // Add to scene
    scene.add(causticsGroup);
    
    console.log('✅ Caustics system created with', geometryType, 'geometry');
    if (onReady) onReady();
    
    return causticsGroup;
  }, [
    loadCausticsTextures, 
    createCausticsGeometry,
    scene, 
    position, 
    rotation, 
    scale, 
    color, 
    opacity, 
    blendMode,
    geometryType,
    onReady
  ]);

  // Update caustics position based on water level and terrain
  const updateCausticsPosition = useCallback((group?: THREE.Group) => {
    const causticsGroup = group || causticsGroupRef.current;
    if (!causticsGroup) return;
    
    // Position caustics below water surface, above terrain
    const causticsY = Math.max(
      terrainY - 1,           // Just above terrain
      waterLevel - 3          // Below water surface  
    );
    
    causticsGroup.position.y = causticsY;
    
    // Adjust visibility based on water depth
    const waterDepth = waterLevel - terrainY;
    const shouldShow = waterDepth > 0.5; // Only show if significant water depth
    
    causticsGroup.visible = enabled && shouldShow;
    
    if (materialRef.current && shouldShow) {
      // Adjust opacity based on water depth for realistic blending
      const depthFactor = Math.min(waterDepth / 5.0, 1.0);
      materialRef.current.opacity = opacity * depthFactor;
    }
  }, [enabled, waterLevel, terrainY, opacity]);

  // Animation loop (extracted from your existing code)
  const animateCaustics = useCallback(() => {
    if (!animationStateRef.current.isAnimating || !causticsMeshRef.current || texturesRef.current.length === 0) {
      return;
    }

    const deltaTime = clockRef.current.getDelta();
    const state = animationStateRef.current;
    const material = materialRef.current;
    
    state.time += deltaTime;
    state.frameCount++;
    
    // Texture switching animation
    if (state.frameCount % animationSpeed === 0) {
      state.currentTextureIndex = (state.currentTextureIndex + 1) % texturesRef.current.length;
      if (material) {
        material.map = texturesRef.current[state.currentTextureIndex];
        material.needsUpdate = true;
      }
    }
    
    // Texture scrolling for flowing effect
    if (material && material.map) {
      material.map.offset.x = Math.cos(state.time * 0.5) * scrollSpeed;
      material.map.offset.y = Math.sin(state.time * 0.3) * scrollSpeed;
    }
    
    // Update position based on water level changes
    updateCausticsPosition();
    
    if (animationStateRef.current.isAnimating) {
      animationIdRef.current = requestAnimationFrame(animateCaustics);
    }
  }, [animationSpeed, scrollSpeed, updateCausticsPosition]);

  // Start/stop animation
  const startAnimation = useCallback(() => {
    if (animationStateRef.current.isAnimating) return;
    
    animationStateRef.current.isAnimating = true;
    clockRef.current.start();
    animateCaustics();
    console.log('🌊 Caustics animation started');
  }, [animateCaustics]);

  const stopAnimation = useCallback(() => {
    animationStateRef.current.isAnimating = false;
    if (animationIdRef.current) {
      cancelAnimationFrame(animationIdRef.current);
      animationIdRef.current = null;
    }
    clockRef.current.stop();
    console.log('🌊 Caustics animation stopped');
  }, []);

  // Complete cleanup (following your cleanup patterns)
  const cleanup = useCallback(() => {
    console.log('🧹 Cleaning up caustics system');
    
    stopAnimation();
    
    // Dispose textures
    texturesRef.current.forEach(texture => {
      if (texture) texture.dispose();
    });
    texturesRef.current = [];
    
    // Dispose material
    if (materialRef.current) {
      materialRef.current.dispose();
      materialRef.current = null;
    }
    
    // Remove from scene and dispose geometry
    if (causticsGroupRef.current) {
      scene.remove(causticsGroupRef.current);
      
      causticsGroupRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(mat => mat.dispose());
            } else {
              child.material.dispose();
            }
          }
        }
      });
      
      causticsGroupRef.current.clear();
      causticsGroupRef.current = null;
    }
    
    causticsMeshRef.current = null;
    
    console.log('✅ Caustics cleanup completed');
  }, [scene, stopAnimation]);

  // Main initialization effect
  useEffect(() => {
    let isMounted = true;
    
    const initialize = async () => {
      if (!isMounted) return;
      
      try {
        await createCausticsSystem();
        
        if (enabled && isMounted) {
          startAnimation();
        }
      } catch (error) {
        console.error('❌ Failed to initialize caustics:', error);
        if (onError) onError(`Caustics initialization failed: ${error}`);
      }
    };
    
    initialize();
    
    return () => {
      isMounted = false;
      cleanup();
    };
  }, []); // Initialize once

  // Handle enabled state changes
  useEffect(() => {
    if (!causticsGroupRef.current) return;
    
    if (enabled) {
      startAnimation();
      updateCausticsPosition();
    } else {
      stopAnimation();
      causticsGroupRef.current.visible = false;
    }
  }, [enabled, startAnimation, stopAnimation, updateCausticsPosition]);

  // Handle water level changes
  useEffect(() => {
    if (causticsGroupRef.current) {
      updateCausticsPosition();
    }
  }, [waterLevel, terrainY, updateCausticsPosition]);

  // Handle visual property changes
  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.color.copy(color);
      materialRef.current.opacity = opacity;
      materialRef.current.blending = blendMode;
      materialRef.current.needsUpdate = true;
    }
  }, [color, opacity, blendMode]);

  // Handle transform changes
  useEffect(() => {
    if (causticsMeshRef.current) {
      causticsMeshRef.current.position.copy(position);
      causticsMeshRef.current.rotation.copy(rotation);
      causticsMeshRef.current.scale.setScalar(scale);
    }
  }, [position, rotation, scale]);

  return null; // Engine component renders nothing directly
};

export default CausticsEngine;