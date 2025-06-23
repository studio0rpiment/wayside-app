// src/engines/ARRenderingEngine.ts
import * as THREE from 'three';
import { getOptimizedRendererSettings, optimizeWebGLRenderer } from '../../utils/systemOptimization'

export interface ARRenderingEngineOptions {
  fov?: number;
  near?: number;
  far?: number;
  enableOptimizations?: boolean;
  antialias?: boolean;
  alpha?: boolean;
  clearColor?: number;
  clearAlpha?: number;
}

export interface ARRenderingEngineEvents {
  onSceneReady?: (scene: THREE.Scene, camera: THREE.PerspectiveCamera) => void;
  onRenderFrame?: (deltaTime: number) => void;
  onDispose?: () => void;
  onError?: (error: string) => void;
}

/**
 * AR Rendering Engine - Manages Three.js scene, camera, and renderer
 * Extracted from ArCameraComponent for better separation of concerns
 */
export class ARRenderingEngine {
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private canvas: HTMLCanvasElement | null = null;
  
  // Animation loop management
  private animationId: number | null = null;
  private isRenderLoopActive: boolean = false;
  private lastFrameTime: number = 0;
  
  // Configuration
  private options: ARRenderingEngineOptions;
  private events: ARRenderingEngineEvents;
  
  // State tracking
  private isInitialized: boolean = false;
  private isDisposed: boolean = false;

  constructor(options: ARRenderingEngineOptions = {}, events: ARRenderingEngineEvents = {}) {
    this.options = {
      fov: 70, // Typical mobile AR FOV
      near: 0.1,
      far: 1000,
      enableOptimizations: true,
      antialias: true,
      alpha: true,
      clearColor: 0x000000,
      clearAlpha: 0,
      ...options
    };
    
    this.events = events;
    
    // Bind methods to preserve context
    this.animate = this.animate.bind(this);
    this.handleResize = this.handleResize.bind(this);
    
    console.log('🎨 ARRenderingEngine: Constructor initialized');
  }

  /**
   * Initialize the rendering engine with a canvas
   */
  async initialize(canvas: HTMLCanvasElement): Promise<boolean> {
    if (this.isDisposed) {
      this.handleError('Cannot initialize disposed engine');
      return false;
    }

    if (this.isInitialized) {
      console.warn('🎨 ARRenderingEngine: Already initialized');
      return true;
    }

    try {
      console.log('🎨 ARRenderingEngine: Starting initialization...');
      
      this.canvas = canvas;
      
      // Create scene
      this.scene = new THREE.Scene();
      console.log('🎨 ARRenderingEngine: Scene created');

      // Create camera with AR-appropriate settings
      this.camera = new THREE.PerspectiveCamera(
        this.options.fov!,
        window.innerWidth / window.innerHeight,
        this.options.near!,
        this.options.far!
      );
      
      // Position camera at origin and look forward (AR camera positioning)
      this.camera.position.set(0, 0, 0);
      this.camera.lookAt(0, 0, -1);
      console.log('🎨 ARRenderingEngine: Camera created with AR settings');

      // Create optimized renderer
      const success = await this.createRenderer();
      if (!success) {
        return false;
      }

      // Setup basic lighting for AR scenes
      this.setupLighting();

      // Setup resize handling
      this.setupEventListeners();

      this.isInitialized = true;
      
      // Notify that scene is ready
      if (this.events.onSceneReady && this.scene && this.camera) {
        this.events.onSceneReady(this.scene, this.camera);
      }

      console.log('✅ ARRenderingEngine: Initialization complete');
      return true;
      
    } catch (error) {
      console.error('❌ ARRenderingEngine: Initialization failed:', error);
      this.handleError(`Initialization failed: ${error}`);
      return false;
    }
  }

  /**
   * Create and configure the WebGL renderer with optimizations
   */
  private async createRenderer(): Promise<boolean> {
    if (!this.canvas) {
      this.handleError('No canvas provided for renderer');
      return false;
    }

    try {
      if (this.options.enableOptimizations) {
        console.log('🎨 ARRenderingEngine: Creating optimized renderer...');
        
        // Use optimized renderer settings
        const rendererSettings = await getOptimizedRendererSettings(this.canvas);
        this.renderer = new THREE.WebGLRenderer(rendererSettings);
        
        // Apply WebGL optimizations
        await optimizeWebGLRenderer(this.renderer);
        console.log('✅ ARRenderingEngine: Optimized renderer created');
        
      } else {
        console.log('🎨 ARRenderingEngine: Creating standard renderer...');
        
        // Fallback to standard renderer
        this.renderer = new THREE.WebGLRenderer({
          canvas: this.canvas,
          alpha: this.options.alpha!,
          antialias: this.options.antialias!
        });
        console.log('✅ ARRenderingEngine: Standard renderer created');
      }
      
      // Configure renderer
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.renderer.setClearColor(this.options.clearColor!, this.options.clearAlpha!);
      
      // Enable shadow mapping for AR objects
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      
      return true;
      
    } catch (error) {
      console.warn('⚠️ ARRenderingEngine: Optimized renderer failed, using fallback:', error);
      
      // Ultimate fallback
      try {
        this.renderer = new THREE.WebGLRenderer({
          canvas: this.canvas,
          alpha: true,
          antialias: false // Disable for performance
        });
        
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x000000, 0);
        
        console.log('✅ ARRenderingEngine: Fallback renderer created');
        return true;
        
      } catch (fallbackError) {
        this.handleError(`Renderer creation failed: ${fallbackError}`);
        return false;
      }
    }
  }

  /**
   * Setup lighting appropriate for AR scenes
   */
  private setupLighting(): void {
    if (!this.scene) return;

    // Ambient light for general illumination
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    ambientLight.name = 'AR_AmbientLight';
    this.scene.add(ambientLight);

    // Directional light for shadows and definition
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 1);
    directionalLight.castShadow = true;
    directionalLight.name = 'AR_DirectionalLight';
    
    // Configure shadow mapping
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    
    this.scene.add(directionalLight);
    
    console.log('🎨 ARRenderingEngine: Lighting setup complete');
  }

  /**
   * Setup event listeners for resize handling
   */
  private setupEventListeners(): void {
    window.addEventListener('resize', this.handleResize);
    console.log('🎨 ARRenderingEngine: Event listeners attached');
  }

  /**
   * Handle window resize events
   */
  handleResize(): void {
    if (!this.camera || !this.renderer || !this.isInitialized) return;

    const width = window.innerWidth;
    const height = window.innerHeight;

    // Update camera aspect ratio
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    // Update renderer size
    this.renderer.setSize(width, height);

    console.log(`🎨 ARRenderingEngine: Resized to ${width}x${height}`);
  }

  /**
   * Update camera orientation (typically from device sensors)
   */
  updateCameraOrientation(quaternion: THREE.Quaternion): void {
    if (!this.camera || !this.isInitialized) return;

    try {
      this.camera.quaternion.copy(quaternion);
    } catch (error) {
      console.warn('🎨 ARRenderingEngine: Error updating camera orientation:', error);
    }
  }

  /**
   * Start the render loop
   */
  startRenderLoop(): void {
    if (!this.isInitialized) {
      console.warn('🎨 ARRenderingEngine: Cannot start render loop - not initialized');
      return;
    }

    if (this.isRenderLoopActive) {
      console.warn('🎨 ARRenderingEngine: Render loop already active');
      return;
    }

    this.isRenderLoopActive = true;
    this.lastFrameTime = performance.now();
    this.animate();
    
    console.log('🎨 ARRenderingEngine: Render loop started');
  }

  /**
   * Stop the render loop
   */
  stopRenderLoop(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    
    this.isRenderLoopActive = false;
    console.log('🎨 ARRenderingEngine: Render loop stopped');
  }

  /**
   * Render a single frame
   */
  render(): void {
    if (!this.renderer || !this.scene || !this.camera || !this.isInitialized) {
      return;
    }

    try {
      this.renderer.render(this.scene, this.camera);
    } catch (error) {
      console.error('🎨 ARRenderingEngine: Render error:', error);
      this.handleError(`Render error: ${error}`);
    }
  }

  /**
   * Animation loop
   */
  private animate(): void {
    if (!this.isRenderLoopActive || this.isDisposed) {
      return;
    }

    // Calculate delta time
    const currentTime = performance.now();
    const deltaTime = currentTime - this.lastFrameTime;
    this.lastFrameTime = currentTime;

    // Render the frame
    this.render();

    // Notify listeners of frame render
    if (this.events.onRenderFrame) {
      this.events.onRenderFrame(deltaTime);
    }

    // Schedule next frame
    this.animationId = requestAnimationFrame(this.animate);
  }

  /**
   * Add an object to the scene
   */
  addToScene(object: THREE.Object3D): void {
    if (!this.scene || !this.isInitialized) {
      console.warn('🎨 ARRenderingEngine: Cannot add object - scene not ready');
      return;
    }

    this.scene.add(object);
    console.log(`🎨 ARRenderingEngine: Added object to scene: ${object.name || object.type}`);
  }

  /**
   * Remove an object from the scene
   */
  removeFromScene(object: THREE.Object3D): void {
    if (!this.scene || !this.isInitialized) {
      console.warn('🎨 ARRenderingEngine: Cannot remove object - scene not ready');
      return;
    }

    this.scene.remove(object);
    console.log(`🎨 ARRenderingEngine: Removed object from scene: ${object.name || object.type}`);
  }

  /**
   * Clear all objects from the scene (except lights)
   */
  clearScene(): void {
    if (!this.scene) return;

    const objectsToRemove: THREE.Object3D[] = [];
    
    this.scene.traverse((object) => {
      // Keep lights but remove other objects
      if (object !== this.scene && 
          !(object instanceof THREE.Light) && 
          !object.name.startsWith('AR_')) {
        objectsToRemove.push(object);
      }
    });

    objectsToRemove.forEach(object => {
      this.scene!.remove(object);
    });

    console.log(`🎨 ARRenderingEngine: Cleared ${objectsToRemove.length} objects from scene`);
  }

  /**
   * Get current renderer info for debugging
   */
  getRendererInfo(): any {
    if (!this.renderer) return null;
    
    return {
      memory: this.renderer.info.memory,
      render: this.renderer.info.render,
      capabilities: {
        maxTextures: this.renderer.capabilities.maxTextures,
        maxVertexTextures: this.renderer.capabilities.maxVertexTextures,
        maxTextureSize: this.renderer.capabilities.maxTextureSize
      }
    };
  }

  /**
   * Error handling
   */
  private handleError(message: string): void {
    console.error(`🎨 ARRenderingEngine: ${message}`);
    if (this.events.onError) {
      this.events.onError(message);
    }
  }

  /**
   * Dispose of all resources
   */
  dispose(): void {
    if (this.isDisposed) {
      console.warn('🎨 ARRenderingEngine: Already disposed');
      return;
    }

    console.log('🎨 ARRenderingEngine: Starting disposal...');

    // Stop render loop
    this.stopRenderLoop();

    // Remove event listeners
    window.removeEventListener('resize', this.handleResize);

    // Dispose of Three.js resources
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }

    if (this.scene) {
      // Dispose of all objects in scene
      this.scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          if (Array.isArray(object.material)) {
            object.material.forEach(material => material.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
      this.scene.clear();
      this.scene = null;
    }

    this.camera = null;
    this.canvas = null;
    
    this.isInitialized = false;
    this.isDisposed = true;

    // Notify disposal
    if (this.events.onDispose) {
      this.events.onDispose();
    }

    console.log('✅ ARRenderingEngine: Disposal complete');
  }

  // Getters
  getScene(): THREE.Scene | null {
    return this.scene;
  }

  getCamera(): THREE.PerspectiveCamera | null {
    return this.camera;
  }

  getRenderer(): THREE.WebGLRenderer | null {
    return this.renderer;
  }

  isReady(): boolean {
    return this.isInitialized && !this.isDisposed;
  }

  isRenderingActive(): boolean {
    return this.isRenderLoopActive;
  }
}