// src/utils/DebugModeManager.ts
class DebugModeManager extends EventTarget {
  private _debugMode = false;
  private _initialized = false;
  
  initialize(): void {
    if (this._initialized) return;
    
    // Read initial state from window
    this._debugMode = (window as any).arTestingOverride ?? false;
    this._initialized = true;
    
    console.log(`🐛 DebugModeManager: Initialized (debug mode: ${this._debugMode})`);
  }
  
  setDebugMode(enabled: boolean): void {
    if (this._debugMode !== enabled) {
      this._debugMode = enabled;
      
      // Update window variable to maintain compatibility
      (window as any).arTestingOverride = enabled;
      
      // Emit event for listeners
      this.dispatchEvent(new CustomEvent('debugModeChanged', { 
        detail: { enabled } 
      }));
      
      console.log(`🐛 Debug Mode: ${enabled ? 'ENABLED' : 'DISABLED'}`);
    }
  }
  
  // Toggle for convenience (useful for debug controls)
  toggleDebugMode(): void {
    this.setDebugMode(!this._debugMode);
  }
  
  get debugMode(): boolean { 
    return this._debugMode; 
  }
  
  get isInitialized(): boolean { 
    return this._initialized; 
  }
}

export const debugModeManager = new DebugModeManager();

// Expose to window for manual testing/debugging
if (typeof window !== 'undefined') {
  (window as any).debugModeManager = debugModeManager;
}