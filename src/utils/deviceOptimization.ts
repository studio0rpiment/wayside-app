// src/utils/deviceOptimization.ts
import * as THREE from 'three';

export interface DeviceCapabilities {
  quality: 'high' | 'low'; // Simplified to just two levels
  isMobile: boolean;
  isLowEnd: boolean;
  maxVertices: number;
  shouldReduceFrameRate: boolean;
  maxPixelRatio: number;
  rendererSettings: {
    antialias: boolean;
    powerPreference: 'high-performance' | 'low-power' | 'default';
    precision: 'highp' | 'mediump' | 'lowp';
  };
}

/**
 * Simplified device capability detection with only two quality tiers
 */
export function getDeviceCapabilities(): DeviceCapabilities {
  // Basic device detection
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const isTablet = isMobile && (window.innerWidth >= 768 || window.innerHeight >= 768);
  
  // Hardware detection
  const memoryGB = (navigator as any).deviceMemory || 4;
  const cores = navigator.hardwareConcurrency || 4;
  const screenWidth = window.screen.width;
  const screenHeight = window.screen.height;
  const pixelRatio = window.devicePixelRatio || 1;
  
  // Network-based hints
  const connection = (navigator as any).connection;
  const isSlowConnection = connection?.effectiveType === '2g' || connection?.effectiveType === 'slow-2g';
  
  // Performance scoring algorithm (simplified)
  let performanceScore = 0;
  
  // Memory weight (most important for vertex processing)
  performanceScore += memoryGB * 3;
  
  // CPU cores weight
  performanceScore += cores * 2;
  
  // Screen resolution impact
  const totalPixels = screenWidth * screenHeight * pixelRatio;
  if (totalPixels > 2000000) performanceScore -= 2; // 4K+ penalty
  else if (totalPixels > 1000000) performanceScore -= 1; // 1080p+ penalty
  
  // Platform bonuses/penalties
  if (!isMobile) performanceScore += 6; // Desktop bonus
  else if (isTablet) performanceScore += 2; // Tablet bonus
  
  // Network penalty
  if (isSlowConnection) performanceScore -= 2;
  
  // iOS-specific optimizations (better GPU performance)
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  if (isIOS && performanceScore > 8) performanceScore += 1;
  
  // SIMPLIFIED: Only two quality levels
  let quality: DeviceCapabilities['quality'];
  let maxVertices: number;
  
  if (performanceScore >= 10) {
    quality = 'high';
    maxVertices = 40000;
  } else {
    quality = 'low';
    maxVertices = 20000;
  }
  
  const isLowEndDevice = quality === 'low';
  
  console.log(`📱 Device capabilities: ${quality} quality (score: ${performanceScore}, ${maxVertices} vertices)`);
  
  return {
    quality,
    isMobile,
    isLowEnd: isLowEndDevice,
    maxVertices,
    shouldReduceFrameRate: isLowEndDevice || isSlowConnection,
    maxPixelRatio: isMobile ? 1.5 : 2.0,
    rendererSettings: {
      antialias: !isMobile || quality === 'high',
      powerPreference: isMobile ? 'low-power' : 'high-performance',
      precision: isLowEndDevice ? 'mediump' : 'highp'
    }
  };
}

/**
 * Simplified performance monitoring with hysteresis
 */
export class PerformanceMonitor {
  private frameTimings: number[] = [];
  private lastFrameTime = performance.now();
  private callbacks: Array<(fps: number) => void> = [];
  private isRunning = false;
  
  constructor() {
    // Don't auto-start - let the morphing engine control this
  }
  
  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.animate();
  }
  
  stop() {
    this.isRunning = false;
  }
  
  private animate = () => {
    if (!this.isRunning) return;
    
    const now = performance.now();
    const frameTime = now - this.lastFrameTime;
    
    this.frameTimings.push(frameTime);
    if (this.frameTimings.length > 60) {
      this.frameTimings.shift();
    }
    
    // Notify callbacks every 5 seconds (increased from 2)
    if (this.frameTimings.length === 60) {
      const avgFPS = this.getAverageFPS();
      this.callbacks.forEach(callback => callback(avgFPS));
      this.frameTimings.length = 0;
    }
    
    this.lastFrameTime = now;
    requestAnimationFrame(this.animate);
  };
  
  getAverageFPS(): number {
    if (this.frameTimings.length === 0) return 60;
    const avgFrameTime = this.frameTimings.reduce((a, b) => a + b) / this.frameTimings.length;
    return Math.min(60, 1000 / avgFrameTime);
  }
  
  onPerformanceChange(callback: (fps: number) => void) {
    this.callbacks.push(callback);
  }
  
  clearCallbacks() {
    this.callbacks = [];
  }
}

/**
 * Simplified adaptive quality manager with hysteresis
 */
export class AdaptiveQualityManager {
  private currentQuality: DeviceCapabilities['quality'];
  private monitor = new PerformanceMonitor();
  private onQualityChange?: (quality: DeviceCapabilities['quality']) => void;
  private lastSwitchTime = 0;
  private switchCooldown = 10000; // 10 seconds cooldown
  private isEnabled = true;
  
  // Hysteresis thresholds - different for up/down switching
  private readonly DOWNGRADE_THRESHOLD = 15; // Switch to low if FPS < 15
  private readonly UPGRADE_THRESHOLD = 35;   // Switch to high if FPS > 35
  
  constructor(initialQuality: DeviceCapabilities['quality']) {
    this.currentQuality = initialQuality;
    
    this.monitor.onPerformanceChange((fps) => {
      if (!this.isEnabled) return;
      
      const now = performance.now();
      if (now - this.lastSwitchTime < this.switchCooldown) {
        // console.log(`⏳ Quality switch on cooldown (${Math.round((this.switchCooldown - (now - this.lastSwitchTime)) / 1000)}s remaining)`);
        return;
      }
      
      const shouldDowngrade = fps < this.DOWNGRADE_THRESHOLD && this.currentQuality === 'high';
      const shouldUpgrade = fps > this.UPGRADE_THRESHOLD && this.currentQuality === 'low';
      
      if (shouldDowngrade) {
        // console.log(`📉 Performance low (${fps.toFixed(1)} FPS), switching to low quality`);
        this.switchToLow();
      } else if (shouldUpgrade) {
        // console.log(`📈 Performance good (${fps.toFixed(1)} FPS), switching to high quality`);
        this.switchToHigh();
      }
    });
  }
  
  start() {
    this.monitor.start();
  }
  
  stop() {
    this.monitor.stop();
  }
  
  onQualityChanged(callback: (quality: DeviceCapabilities['quality']) => void) {
    this.onQualityChange = callback;
  }
  
  private switchToLow() {
    if (this.currentQuality === 'low') return;
    
    this.currentQuality = 'low';
    this.lastSwitchTime = performance.now();
    this.onQualityChange?.(this.currentQuality);
  }
  
  private switchToHigh() {
    if (this.currentQuality === 'high') return;
    
    this.currentQuality = 'high';
    this.lastSwitchTime = performance.now();
    this.onQualityChange?.(this.currentQuality);
  }
  
  getCurrentQuality(): DeviceCapabilities['quality'] {
    return this.currentQuality;
  }
  
  // Allow manual disable for testing
  setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
    if (!enabled) {
      this.monitor.stop();
    } else {
      this.monitor.start();
    }
  }
  
  // Force a quality level (for testing)
  forceQuality(quality: DeviceCapabilities['quality']) {
    this.currentQuality = quality;
    this.lastSwitchTime = performance.now();
    this.onQualityChange?.(quality);
  }
}

/**
 * Pre-loading geometry loader that loads BOTH quality levels upfront
 */
export class OptimizedGeometryLoader {
 
  private geometryCache: Map<string, THREE.BufferGeometry> = new Map();
  private cache: Map<string, THREE.BufferGeometry> = new Map();

 /**
 * Load a specific animation frame for animated models
 * @param modelName The name of the animated model (e.g., 'bc2200')
 * @param frameIndex The frame number (1-based, e.g., 1-24)
 * @param quality The quality level ('high' or 'low')
 * @returns Promise<THREE.BufferGeometry>
 */
async loadAnimationFrame(
  modelName: string,
  frameIndex: number,
  quality: 'high' | 'low' = 'high'
): Promise<THREE.BufferGeometry> {
  // Pad frame number to 3 digits (001, 002, etc.)
  const frameNumber = String(frameIndex).padStart(3, '0');
  
  // Create cache key for animated frames
  const cacheKey = `${modelName}_frame_${frameNumber}_${quality}`;
  
  // console.log(`📦 Loading animated frame: ${cacheKey}`);
  
  // Check cache first
  if (this.geometryCache.has(cacheKey)) {
    // console.log(`💾 Using cached frame: ${cacheKey}`);
    return this.geometryCache.get(cacheKey)!.clone();
  }
  
  // Try to load binary format
  try {
    const binaryPath = `/models/processed/${modelName}_frame_${frameNumber}_${quality}.bin`;
    // console.log(`📥 Attempting to load binary frame: ${binaryPath}`);
    
    const response = await fetch(binaryPath);
    if (!response.ok) {
      throw new Error(`Binary frame not found: ${response.status} ${response.statusText}`);
    }
    
    const buffer = await response.arrayBuffer();
    const geometry = this.binaryToGeometry(buffer);
    
    // Cache the loaded geometry
    this.geometryCache.set(cacheKey, geometry.clone());
    
    // console.log(`✅ Binary frame loaded successfully: ${cacheKey} (${geometry.attributes.position.count} vertices)`);
    return geometry;
    
  } catch (binaryError) {
    console.warn(`⚠️ Binary frame loading failed for ${cacheKey}:`, binaryError);
    throw new Error(`Animation frame ${frameNumber} not found for ${modelName}. Make sure to run the preprocessor first.`);
  }
}
  
  /**
   * Pre-load both high and low quality versions
   */
  async preloadAllQualities(experience: string, stages: number[]): Promise<{
    high: THREE.BufferGeometry[];
    low: THREE.BufferGeometry[];
  }> {
    // console.log(`🚀 Pre-loading ${experience} models in both qualities...`);
    
    const highPromises = stages.map(stage => this.loadGeometry(experience, stage, 'high'));
    const lowPromises = stages.map(stage => this.loadGeometry(experience, stage, 'low'));
    
    const [highGeometries, lowGeometries] = await Promise.all([
      Promise.all(highPromises),
      Promise.all(lowPromises)
    ]);
    
    console.log(`✅ Pre-loaded ${experience}: ${highGeometries.length} high + ${lowGeometries.length} low quality models`);
    
    return {
      high: highGeometries,
      low: lowGeometries
    };
  }
  
  async loadGeometry(experience: string, stage: number, quality: 'high' | 'low'): Promise<THREE.BufferGeometry> {
    const cacheKey = `${experience}_${stage}_${quality}`;
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!.clone();
    }
    
    const path = `/models/processed/${experience}_${stage}_${quality}.bin`;
    
    try {
      const response = await fetch(path);
      if (!response.ok) {
        throw new Error(`Failed to load ${path}: ${response.statusText}`);
      }
      
      const buffer = await response.arrayBuffer();
      const geometry = this.binaryToGeometry(buffer);
      
      this.cache.set(cacheKey, geometry);
      return geometry.clone();
      
    } catch (error) {
      console.error(`Failed to load optimized geometry: ${cacheKey}`, error);
      throw error;
    }
  }

 //headersize
  // private static readonly FIXED_HEADER_SIZE = 64;

private binaryToGeometry(buffer: ArrayBuffer): THREE.BufferGeometry {
  try {
    // Read the first 4 bytes to get JSON length
    const headerLengthBytes = new Uint8Array(buffer.slice(0, 4));
    const jsonLength = new DataView(headerLengthBytes.buffer).getUint32(0, true);
    
    // console.log(`📋 JSON length: ${jsonLength}`);
    
    // Dynamically determine header size
    let headerSize: number;
    
    if (jsonLength <= 60) {
      // Fits in 64-byte header (60 = 64 - 4 bytes for length field)
      headerSize = 64;
    } else if (jsonLength <= 124) {
      // Needs 128-byte header (124 = 128 - 4 bytes for length field)
      headerSize = 128;
    } else {
      throw new Error(`JSON length ${jsonLength} too long for any supported header format`);
    }
    
    // console.log(`📦 Using ${headerSize}-byte header`);
    
    // Parse the JSON header
    const headerBuffer = buffer.slice(4, 4 + jsonLength);
    const headerText = new TextDecoder().decode(headerBuffer);
    const headerData = JSON.parse(headerText);
    
    // Extract geometry data
    const { vertexCount, hasColors } = headerData;
    
    console.log(`📊 Parsed header:`, {
      vertexCount,
      hasColors,
      version: headerData.version,
      frameData: headerData.frameData || false,
      headerSize
    });
    
    // Calculate data offsets after the dynamically-sized header
    const dataOffset = headerSize;
    const positionsSize = vertexCount * 3 * 4; // 3 floats * 4 bytes each
    const colorsSize = hasColors ? vertexCount * 3 * 4 : 0;
    
    // Extract positions
    const positionsBuffer = buffer.slice(dataOffset, dataOffset + positionsSize);
    const positions = new Float32Array(positionsBuffer);
    
    // Extract colors if present
    let colors: Float32Array | null = null;
    if (hasColors) {
      const colorsBuffer = buffer.slice(dataOffset + positionsSize, dataOffset + positionsSize + colorsSize);
      colors = new Float32Array(colorsBuffer);
    }
    
    // Create Three.js geometry
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    if (colors) {
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    }
    
    // console.log(`✅ Binary geometry parsed successfully: ${vertexCount} vertices`);
    return geometry;
    
  } catch (error) {
    console.error('❌ Binary parsing error:', error);
    console.error('❌ Buffer info:', {
      byteLength: buffer.byteLength,
      firstBytes: Array.from(new Uint8Array(buffer.slice(0, 16)))
    });
    throw error;
  }
}
  
  clearCache() {
    this.cache.forEach(geometry => geometry.dispose());
    this.cache.clear();
  }
}