// src/utils/UniversalModeManager.ts
enum UniversalModeReason {
  DEVELOPMENT = 'development',
  NO_GPS_HARDWARE = 'no_gps_hardware',
  PERMISSIONS_DENIED = 'permissions_denied',
  OUTSIDE_KENILWORTH_CONFIRMED = 'outside_kenilworth_confirmed'
}

class UniversalModeManager extends EventTarget {
  private _isUniversal = false;
  private _reason: UniversalModeReason | null = null;
  private _initialized = false;

  // Determine universal mode ONCE on startup
  async initialize(): Promise<void> {
    if (this._initialized) return;
    
    console.log('🌐 UniversalModeManager: Initializing...');
    
    // Check development mode first
    if (process.env.NODE_ENV === 'development' || (window as any).arTestingOverride) {
      this.setUniversalMode(true, UniversalModeReason.DEVELOPMENT);
      this._initialized = true;
      return;
    }
    
    // Check hardware capabilities  
    if (!('geolocation' in navigator)) {
      this.setUniversalMode(true, UniversalModeReason.NO_GPS_HARDWARE);
      this._initialized = true;
      return;
    }
    
    // Start in GPS mode - will only change on explicit events
    this.setUniversalMode(false, null);
    this._initialized = true;
    
    console.log('🌐 UniversalModeManager: Initialized in GPS mode');
  }
  
  // Only call this for MAJOR persistent changes
  setUniversalMode(enabled: boolean, reason: UniversalModeReason | null) {
    if (this._isUniversal !== enabled) {
      this._isUniversal = enabled;
      this._reason = reason;
      
      this.dispatchEvent(new CustomEvent('universalModeChanged', {
        detail: { enabled, reason }
      }));
      
      console.log(`🌐 Universal Mode: ${enabled ? 'ENABLED' : 'DISABLED'} (${reason || 'gps_mode'})`);
    }
  }
  
  // Public API for external triggers
  onPermissionsDenied() {
    this.setUniversalMode(true, UniversalModeReason.PERMISSIONS_DENIED);
  }
  
  onLeftKenilworthPersistent() {
    this.setUniversalMode(true, UniversalModeReason.OUTSIDE_KENILWORTH_CONFIRMED);
  }
  
  onPermissionsGranted() {
    // Only switch back if we were in universal mode due to permissions
    if (this._reason === UniversalModeReason.PERMISSIONS_DENIED) {
      this.setUniversalMode(false, null);
    }
  }
  
  onEnteredKenilworth() {
    // Only switch back if we were in universal mode due to location
    if (this._reason === UniversalModeReason.OUTSIDE_KENILWORTH_CONFIRMED) {
      this.setUniversalMode(false, null);
    }
  }
  
  get isUniversal() { return this._isUniversal; }
  get reason() { return this._reason; }
  get isInitialized() { return this._initialized; }
}

export const universalModeManager = new UniversalModeManager();
export { UniversalModeReason };