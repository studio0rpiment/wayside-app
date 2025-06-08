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
    if (this.isArActive) return;
    
    console.log(`🎯 Starting AR experience: ${experienceType}`);
    this.isArActive = true;
    
    const deviceCaps = await this.initDeviceCaps();
    
    // Suspend systems based on device capabilities
    if (deviceCaps.isMobile) {
      this.suspendMapRendering();
      this.reduceGeofenceTracking();
    }
    
    if (deviceCaps.isLowEnd) {
      this.suspendDebugSystems();
      this.optimizeMemoryUsage();
    }
    
    // Force garbage collection if available
    this.triggerGarbageCollection();
  }

  /**
   * Notify system that AR experience is ending
   */
  endArExperience() {
    if (!this.isArActive) return;
    
    console.log('🏁 Ending AR experience');
    this.isArActive = false;
    
    // Resume all suspended systems
    this.resumeAllSystems();
  }

  private suspendMapRendering() {
    if (this.suspendedSystems.has('map')) return;
    
    console.log('🗺️ Suspending map rendering');
    this.suspendedSystems.add('map');
    
    // Find map container and hide it
    const mapContainers = document.querySelectorAll('[class*="mapbox"], .map-wrapper, #mapSection');
    mapContainers.forEach(container => {
      if (container instanceof HTMLElement) {
        container.style.display = 'none';
        container.setAttribute('data-suspended', 'true');
      }
    });
    
    // Try to pause Mapbox GL if available
    try {
      const mapboxInstances = (window as any).mapboxgl_instances;
      if (mapboxInstances) {
        mapboxInstances.forEach((map: any) => {
          if (map.stop) map.stop();
        });
      }
    } catch (error) {
      // Silent fail - map might not be Mapbox GL
    }
  }

  private reduceGeofenceTracking() {
    if (this.suspendedSystems.has('geofence')) return;
    
    console.log('📍 Reducing geofence tracking frequency');
    this.suspendedSystems.add('geofence');
    
    // Emit custom event to reduce tracking frequency
    window.dispatchEvent(new CustomEvent('ar-performance-mode', {
      detail: { reduceTracking: true }
    }));
  }

  private suspendDebugSystems() {
    if (this.suspendedSystems.has('debug')) return;
    
    console.log('🐛 Suspending debug systems');
    this.suspendedSystems.add('debug');
    
    // Hide debug panels
    const debugElements = document.querySelectorAll('[class*="debug"], [id*="debug"]');
    debugElements.forEach(element => {
      if (element instanceof HTMLElement) {
        element.style.display = 'none';
        element.setAttribute('data-suspended', 'true');
      }
    });
  }

  private optimizeMemoryUsage() {
    console.log('🧹 Optimizing memory usage');
    
    // Clear any large caches
    if ('caches' in window) {
      caches.keys().then(cacheNames => {
        cacheNames.forEach(cacheName => {
          if (cacheName.includes('images') || cacheName.includes('tiles')) {
            // Don't clear essential caches, just limit them
            caches.open(cacheName).then(cache => {
              // Implementation would depend on cache structure
            });
          }
        });
      });
    }
    
    // Reduce image quality for background elements
    const images = document.querySelectorAll('img[data-src], img[loading="lazy"]');
    images.forEach(img => {
      if (img instanceof HTMLImageElement && !img.closest('[class*="ar-"]')) {
        img.style.filter = 'blur(1px)'; // Slight blur to reduce GPU load
      }
    });
  }

  private triggerGarbageCollection() {
    // Force garbage collection if available (Chrome DevTools)
    if ((window as any).gc) {
      (window as any).gc();
    }
    
    // Manual memory pressure hint
    if ('memory' in performance) {
      console.log(`💾 Memory usage: ${Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024)}MB`);
    }
  }

  private resumeAllSystems() {
    console.log('🔄 Resuming all suspended systems');
    
    // Resume map rendering
    if (this.suspendedSystems.has('map')) {
      const suspendedMaps = document.querySelectorAll('[data-suspended="true"]');
      suspendedMaps.forEach(element => {
        if (element instanceof HTMLElement) {
          element.style.display = '';
          element.removeAttribute('data-suspended');
        }
      });
      
      // Try to resume Mapbox GL
      try {
        const mapboxInstances = (window as any).mapboxgl_instances;
        if (mapboxInstances) {
          mapboxInstances.forEach((map: any) => {
            if (map.resume) map.resume();
            if (map.resize) {
              setTimeout(() => map.resize(), 100); // Allow DOM to update
            }
          });
        }
      } catch (error) {
        // Silent fail
      }
    }
    
    // Resume geofence tracking
    if (this.suspendedSystems.has('geofence')) {
      window.dispatchEvent(new CustomEvent('ar-performance-mode', {
        detail: { reduceTracking: false }
      }));
    }
    
    // Clear image optimizations
    const optimizedImages = document.querySelectorAll('img[style*="blur"]');
    optimizedImages.forEach(img => {
      if (img instanceof HTMLImageElement) {
        img.style.filter = '';
      }
    });
    
    this.suspendedSystems.clear();
  }

  isSystemSuspended(system: string): boolean {
    return this.suspendedSystems.has(system);
  }

  getActiveOptimizations(): string[] {
    return Array.from(this.suspendedSystems);
  }
}

/**
 * React hook for system optimization
 */
export function useSystemOptimization() {
  const manager = SystemOptimizationManager.getInstance();
  
  return {
    startArExperience: async (type: string) => await manager.startArExperience(type),
    endArExperience: () => manager.endArExperience(),
    isSystemSuspended: (system: string) => manager.isSystemSuspended(system),
    getActiveOptimizations: () => manager.getActiveOptimizations()
  };
}

/**
 * Enhanced ExperienceManager with system optimization
 */
// Update your ExperienceManager.tsx to include:

/*
import { useSystemOptimization } from '../../utils/systemOptimization';

const ExperienceManager: React.FC<ExperienceManagerProps> = ({
  isOpen,
  onClose,
  experienceType,
  // ... other props
}) => {
  const { startArExperience, endArExperience } = useSystemOptimization();

  useEffect(() => {
    if (isOpen) {
      startArExperience(experienceType);
    } else {
      endArExperience();
    }

    return () => {
      endArExperience();
    };
  }, [isOpen, experienceType]);

  // ... rest of component
};
*/

/**
 * Enhanced GeofenceContext with performance awareness
 */
// Update your GeofenceContext to listen for performance events:

/*
// In GeofenceContext
useEffect(() => {
  const handlePerformanceMode = (event: CustomEvent) => {
    const { reduceTracking } = event.detail;
    
    if (reduceTracking) {
      // Increase tracking interval from 1s to 5s
      setTrackingInterval(5000);
    } else {
      // Resume normal tracking
      setTrackingInterval(1000);
    }
  };

  window.addEventListener('ar-performance-mode', handlePerformanceMode);
  
  return () => {
    window.removeEventListener('ar-performance-mode', handlePerformanceMode);
  };
}, []);
*/

/**
 * Get optimized WebGL renderer settings for device
 */
export async function getOptimizedRendererSettings(canvas: HTMLCanvasElement) {
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
}

/**
 * Optimize existing WebGL renderer (for settings that can be changed after creation)
 */
export async function optimizeWebGLRenderer(renderer: THREE.WebGLRenderer) {
  const deviceCaps = await getDeviceCapabilities();
  const gl = renderer.getContext();
  
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
    
    // Enable WebGL extensions for better performance
    const extensions = [
      'OES_vertex_array_object',
      'ANGLE_instanced_arrays', 
      'OES_element_index_uint'
    ];
    
    extensions.forEach(ext => {
      try {
        gl.getExtension(ext);
      } catch (error) {
        // Extension not available
      }
    });
  }
  
  return renderer;
}

/**
 * Memory monitoring and cleanup
 */
export class MemoryMonitor {
  private static instance: MemoryMonitor;
  private intervalId?: NodeJS.Timeout;
  private memoryWarningThreshold = 0.8; // 80% of available memory
  
  static getInstance(): MemoryMonitor {
    if (!MemoryMonitor.instance) {
      MemoryMonitor.instance = new MemoryMonitor();
    }
    return MemoryMonitor.instance;
  }
  
  startMonitoring() {
    if (this.intervalId) return;
    
    this.intervalId = setInterval(() => {
      this.checkMemoryUsage();
    }, 5000); // Check every 5 seconds
  }
  
  stopMonitoring() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }
  
  private checkMemoryUsage() {
    if (!('memory' in performance)) return;
    
    const memory = (performance as any).memory;
    const usedRatio = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
    
    if (usedRatio > this.memoryWarningThreshold) {
      console.warn(`⚠️ High memory usage: ${Math.round(usedRatio * 100)}%`);
      
      // Trigger aggressive cleanup
      this.performEmergencyCleanup();
    }
  }
  
  private performEmergencyCleanup() {
    console.log('🚨 Performing emergency memory cleanup');
    
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

// Auto-start memory monitoring in production
if (process.env.NODE_ENV === 'production') {
  MemoryMonitor.getInstance().startMonitoring();
}