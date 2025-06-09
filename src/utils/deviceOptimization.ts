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
        console.log(`⏳ Quality switch on cooldown (${Math.round((this.switchCooldown - (now - this.lastSwitchTime)) / 1000)}s remaining)`);
        return;
      }
      
      const shouldDowngrade = fps < this.DOWNGRADE_THRESHOLD && this.currentQuality === 'high';
      const shouldUpgrade = fps > this.UPGRADE_THRESHOLD && this.currentQuality === 'low';
      
      if (shouldDowngrade) {
        console.log(`📉 Performance low (${fps.toFixed(1)} FPS), switching to low quality`);
        this.switchToLow();
      } else if (shouldUpgrade) {
        console.log(`📈 Performance good (${fps.toFixed(1)} FPS), switching to high quality`);
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
  private cache = new Map<string, THREE.BufferGeometry>();
  
  /**
   * Pre-load both high and low quality versions
   */
  async preloadAllQualities(experience: string, stages: number[]): Promise<{
    high: THREE.BufferGeometry[];
    low: THREE.BufferGeometry[];
  }> {
    console.log(`🚀 Pre-loading ${experience} models in both qualities...`);
    
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

  // Keep your existing binaryToGeometry method unchanged
  private static readonly FIXED_HEADER_SIZE = 64;

  private binaryToGeometry(buffer: ArrayBuffer): THREE.BufferGeometry {
    const view = new DataView(buffer);
    
    try {
      // Validate minimum buffer size
      if (buffer.byteLength < OptimizedGeometryLoader.FIXED_HEADER_SIZE) {
        throw new Error(`Buffer too small: ${buffer.byteLength} bytes (minimum: ${OptimizedGeometryLoader.FIXED_HEADER_SIZE})`);
      }
      
      // Read actual JSON length from first 4 bytes
      const jsonLength = view.getUint32(0, true);
      
      console.log(`📖 Fixed header format: JSON length = ${jsonLength}`);
      
      // Validate JSON length
      if (jsonLength <= 0 || jsonLength > OptimizedGeometryLoader.FIXED_HEADER_SIZE - 4) {
        throw new Error(`Invalid JSON length: ${jsonLength}`);
      }
      
      // Read JSON from bytes 4 to 4+jsonLength
      const headerBytes = new Uint8Array(buffer, 4, jsonLength);
      const headerText = new TextDecoder().decode(headerBytes);
      const header = JSON.parse(headerText);
      
      console.log(`📖 Header parsed:`, header);
      
      // Data always starts at byte 64 (guaranteed 4-byte aligned)
      const dataOffset = OptimizedGeometryLoader.FIXED_HEADER_SIZE;
      console.log(`📖 Data starts at aligned offset: ${dataOffset}`);
      
      // Validate header
      if (!header.vertexCount || header.vertexCount <= 0 || header.vertexCount > 1000000) {
        throw new Error(`Invalid vertex count: ${header.vertexCount}`);
      }
      
      // Calculate expected data sizes
      const expectedPositionsBytes = header.vertexCount * 3 * 4;
      const expectedColorsBytes = header.hasColors ? header.vertexCount * 3 * 4 : 0;
      const remainingBytes = buffer.byteLength - dataOffset;
      
      console.log(`📖 Expected: positions=${expectedPositionsBytes}B, colors=${expectedColorsBytes}B, remaining=${remainingBytes}B`);
      
      // Validate remaining data size
      if (remainingBytes < expectedPositionsBytes + expectedColorsBytes) {
        throw new Error(`Insufficient data: expected ${expectedPositionsBytes + expectedColorsBytes}, got ${remainingBytes}`);
      }
      
      // ** FAST PATH: Direct Float32Array creation (no copying needed) **
      const positionsArray = new Float32Array(buffer, dataOffset, header.vertexCount * 3);
      
      // Create geometry
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positionsArray, 3));
      
      // Read colors if available
      if (header.hasColors && expectedColorsBytes > 0) {
        const colorsOffset = dataOffset + expectedPositionsBytes;
        const colorsArray = new Float32Array(buffer, colorsOffset, header.vertexCount * 3);
        geometry.setAttribute('color', new THREE.BufferAttribute(colorsArray, 3));
      }
      
      console.log(`✅ Geometry created: ${header.vertexCount} vertices, ${header.hasColors ? 'with' : 'without'} colors`);
      
      return geometry;
      
    } catch (error) {
      console.error('❌ Binary parsing error:', error);
      console.error('❌ Buffer info:', {
        byteLength: buffer.byteLength,
        firstBytes: Array.from(new Uint8Array(buffer, 0, Math.min(16, buffer.byteLength)))
      });
      throw error;
    }
  }
  
  clearCache() {
    this.cache.forEach(geometry => geometry.dispose());
    this.cache.clear();
  }
}