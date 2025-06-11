// src/utils/systemOptimization.ts
import { getDeviceCapabilities } from './deviceOptimization';
import * as THREE from 'three';

/**
 * Centralized system performance management
 * Handles suspension of background systems during AR experiences
 */
export class SystemOptimizationManager {
  private static instance: SystemOptimizationManager;
  private isArActive = false;
  private deviceCaps: any = null;
  private suspendedSystems = new Set<string>();
  private callbacks = new Map<string, () => void>();
  
  // NEW: Track original states for proper restoration
  private originalStates = new Map<string, any>();

  static getInstance(): SystemOptimizationManager {
    if (!SystemOptimizationManager.instance) {
      SystemOptimizationManager.instance = new SystemOptimizationManager();
    }
    return SystemOptimizationManager.instance;
  }

  private async initDeviceCaps() {
    if (!this.deviceCaps) {
      this.deviceCaps = await getDeviceCapabilities();
    }
    return this.deviceCaps;
  }

  /**
   * Notify system that AR experience is starting
   */
  async startArExperience(experienceType: string) {
    if (this.isArActive) {
      console.log(`⚠️ AR experience already active, ignoring start request for ${experienceType}`);
      return;
    }
    
    console.log(`🎯 Starting AR experience: ${experienceType}`);
    this.isArActive = true;
    
    const deviceCaps = await this.initDeviceCaps();
    
    // CONSERVATIVE: Only suspend systems on low-end mobile devices
    if (deviceCaps.isMobile && deviceCaps.isLowEnd) {
      console.log('📱 Low-end mobile detected - applying conservative optimizations');
      this.reduceGeofenceTracking();
      this.optimizeMemoryUsage();
    } else {
      console.log('💻 High-end device detected - minimal optimizations');
      // Only trigger garbage collection on high-end devices
      this.triggerGarbageCollection();
    }
  }

  /**
   * Notify system that AR experience is ending
   */
  endArExperience() {
    if (!this.isArActive) {
      console.log('⚠️ No AR experience active, ignoring end request');
      return;
    }
    
    console.log('🏁 Ending AR experience');
    this.isArActive = false;
    
    // Resume all suspended systems with proper cleanup
    this.resumeAllSystems();
    
    // Clear all tracking
    this.suspendedSystems.clear();
    this.originalStates.clear();
  }

  // REMOVED: suspendMapRendering - too aggressive, causes issues
  // REMOVED: suspendDebugSystems - not worth the complexity

  private reduceGeofenceTracking() {
    if (this.suspendedSystems.has('geofence')) return;
    
    console.log('📍 Reducing geofence tracking frequency');
    this.suspendedSystems.add('geofence');
    
    // Emit custom event to reduce tracking frequency
    window.dispatchEvent(new CustomEvent('ar-performance-mode', {
      detail: { reduceTracking: true }
    }));
  }

  private optimizeMemoryUsage() {
    console.log('🧹 Optimizing memory usage (conservative)');
    
    // CONSERVATIVE: Only blur non-essential images, don't mess with caches
    const images = document.querySelectorAll('img[data-src], img[loading="lazy"]');
    const blurredImages: HTMLImageElement[] = [];
    
    images.forEach(img => {
      if (img instanceof HTMLImageElement && !img.closest('[class*="ar-"]')) {
        // Store original filter for restoration
        const originalFilter = img.style.filter;
        if (!this.originalStates.has('blurred-images')) {
          this.originalStates.set('blurred-images', []);
        }
        
        this.originalStates.get('blurred-images').push({
          element: img,
          originalFilter
        });
        
        img.style.filter = 'blur(1px)'; // Slight blur to reduce GPU load
        blurredImages.push(img);
      }
    });
    
    if (blurredImages.length > 0) {
      this.suspendedSystems.add('image-optimization');
      console.log(`🖼️ Blurred ${blurredImages.length} background images`);
    }
  }

  private triggerGarbageCollection() {
    // Force garbage collection if available (Chrome DevTools)
    if ((window as any).gc) {
      (window as any).gc();
      console.log('🗑️ Triggered garbage collection');
    }
    
    // Manual memory pressure hint
    if ('memory' in performance) {
      const memoryMB = Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024);
      console.log(`💾 Memory usage: ${memoryMB}MB`);
    }
  }

  private resumeAllSystems() {
    console.log('🔄 Resuming suspended systems...');
    
    // Resume geofence tracking
    if (this.suspendedSystems.has('geofence')) {
      console.log('📍 Resuming normal geofence tracking');
      window.dispatchEvent(new CustomEvent('ar-performance-mode', {
        detail: { reduceTracking: false }
      }));
    }
    
    // Restore blurred images
    if (this.suspendedSystems.has('image-optimization')) {
      const blurredImages = this.originalStates.get('blurred-images') || [];
      console.log(`🖼️ Restoring ${blurredImages.length} background images`);
      
      blurredImages.forEach(({ element, originalFilter }: any) => {
        if (element && element.style) {
          element.style.filter = originalFilter;
        }
      });
    }
    
    // Small delay to let DOM updates settle
    setTimeout(() => {
      console.log('✅ System resume complete');
    }, 100);
  }

  isSystemSuspended(system: string): boolean {
    return this.suspendedSystems.has(system);
  }

  getActiveOptimizations(): string[] {
    return Array.from(this.suspendedSystems);
  }

  // NEW: Force reset if something goes wrong
      forceReset() {
        console.log('🚨 Force resetting system optimization manager');
        this.isArActive = false;
        
        // Restore blurred images before clearing states
        if (this.suspendedSystems.has('image-optimization')) {
          const blurredImages = this.originalStates.get('blurred-images') || [];
          console.log(`🖼️ Force restoring ${blurredImages.length} background images`);
          
          blurredImages.forEach(({ element, originalFilter }: any) => {
            if (element && element.style) {
              element.style.filter = originalFilter;
            }
          });
        }
        
        // Clear all tracking
        this.suspendedSystems.clear();
        this.originalStates.clear();
        
        // Emit reset events
        window.dispatchEvent(new CustomEvent('ar-performance-mode', {
          detail: { reduceTracking: false }
        }));
        
        // Small delay to let DOM updates settle
        setTimeout(() => {
          console.log('✅ Force reset complete');
        }, 100);
      }
}

/**
 * React hook for system optimization
 */
export function useSystemOptimization() {
  const manager = SystemOptimizationManager.getInstance();
  
  return {
    startArExperience: async (type: string) => {
      try {
        await manager.startArExperience(type);
      } catch (error) {
        console.error('❌ Failed to start AR experience optimization:', error);
        // Continue anyway - don't block AR experience
      }
    },
    endArExperience: () => {
      try {
        manager.endArExperience();
      } catch (error) {
        console.error('❌ Failed to end AR experience optimization:', error);
        // Force reset on error
        manager.forceReset();
      }
    },
    isSystemSuspended: (system: string) => manager.isSystemSuspended(system),
    getActiveOptimizations: () => manager.getActiveOptimizations(),
    forceReset: () => manager.forceReset() // NEW: Emergency reset
  };
}

/**
 * Get optimized WebGL renderer settings for device
 */
export async function getOptimizedRendererSettings(canvas: HTMLCanvasElement) {
  try {
    const deviceCaps = await getDeviceCapabilities();
    
    const settings: THREE.WebGLRendererParameters = {
      canvas,
      alpha: true,
      antialias: deviceCaps.rendererSettings.antialias,
      powerPreference: deviceCaps.rendererSettings.powerPreference,
      precision: deviceCaps.rendererSettings.precision,
      stencil: false,
      depth: true
    };
    
    // Additional mobile optimizations
    if (deviceCaps.isMobile) {
      settings.logarithmicDepthBuffer = false; // Disable for better mobile performance
      settings.preserveDrawingBuffer = false;  // Save memory
    }
    
    return settings;
  } catch (error) {
    console.warn('⚠️ Failed to get optimized renderer settings, using defaults:', error);
    // Fallback to safe defaults
    return {
      canvas,
      alpha: true,
      antialias: false,
      powerPreference: 'default' as const,
      stencil: false,
      depth: true
    };
  }
}

/**
 * Optimize existing WebGL renderer (for settings that can be changed after creation)
 */
export async function optimizeWebGLRenderer(renderer: THREE.WebGLRenderer) {
  try {
    const deviceCaps = await getDeviceCapabilities();
    
    if (deviceCaps.isMobile) {
      // Optimize pixel ratio (this CAN be changed after creation)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, deviceCaps.maxPixelRatio));
      
      // Disable expensive features on low-end devices (these CAN be changed)
      if (deviceCaps.isLowEnd) {
        renderer.shadowMap.enabled = false;
        renderer.toneMapping = THREE.NoToneMapping; // Disable tone mapping
      }
      
      // Set mobile-optimized settings
      renderer.sortObjects = false; // Disable sorting for better performance
      renderer.outputColorSpace = THREE.SRGBColorSpace; // Ensure correct color space
    }
    
    console.log('✅ WebGL renderer optimized');
    return renderer;
  } catch (error) {
    console.warn('⚠️ Failed to optimize WebGL renderer:', error);
    return renderer; // Return as-is if optimization fails
  }
}

/**
 * Memory monitoring and cleanup
 */
export class MemoryMonitor {
  private static instance: MemoryMonitor;
  private intervalId?: number; // CHANGED: Use number instead of NodeJS.Timeout for browser
  private memoryWarningThreshold = 0.8; // 80% of available memory
  private isMonitoring = false;
  
  static getInstance(): MemoryMonitor {
    if (!MemoryMonitor.instance) {
      MemoryMonitor.instance = new MemoryMonitor();
    }
    return MemoryMonitor.instance;
  }
  
  startMonitoring() {
    if (this.isMonitoring || this.intervalId) return;
    
    this.isMonitoring = true;
    this.intervalId = window.setInterval(() => {
      this.checkMemoryUsage();
    }, 10000); // CHANGED: Check every 10 seconds (less aggressive)
    
    console.log('📊 Memory monitoring started');
  }
  
  stopMonitoring() {
    if (this.intervalId) {
      window.clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    this.isMonitoring = false;
    console.log('📊 Memory monitoring stopped');
  }
  
  private checkMemoryUsage() {
    if (!('memory' in performance)) return;
    
    try {
      const memory = (performance as any).memory;
      const usedRatio = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
      
      if (usedRatio > this.memoryWarningThreshold) {
        console.warn(`⚠️ High memory usage: ${Math.round(usedRatio * 100)}%`);
        
        // Trigger cleanup
        this.performCleanup();
      }
    } catch (error) {
      console.warn('⚠️ Memory monitoring error:', error);
    }
  }
  
  private performCleanup() {
    console.log('🧹 Performing memory cleanup');
    
    // Emit event for components to clean up
    window.dispatchEvent(new CustomEvent('memory-pressure', {
      detail: { level: 'high' }
    }));
    
    // Force garbage collection
    if ((window as any).gc) {
      (window as any).gc();
    }
  }
}

// CHANGED: Only start memory monitoring in development (less aggressive)
if (process.env.NODE_ENV === 'development') {
  // Don't auto-start in production - let apps decide
  // MemoryMonitor.getInstance().startMonitoring();
}