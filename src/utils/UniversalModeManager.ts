// src/utils/UniversalModeManager.ts
enum UniversalModeReason {
  DEVELOPMENT = 'development',
  NO_GPS_HARDWARE = 'no_gps_hardware',
  LOCATION_UNAVAILABLE = 'location_unavailable',
  ORIENTATION_UNAVAILABLE = 'orientation_unavailable',
  OUTSIDE_KENILWORTH = 'outside_kenilworth'
}

class UniversalModeManager extends EventTarget {
  private _isUniversal = false;
  private _reasons = new Set<UniversalModeReason>();
  private _initialized = false;

  async initialize(): Promise<void> {
    if (this._initialized) return;
    
    // Check development mode
    if (process.env.NODE_ENV === 'development' || (window as any).arTestingOverride) {
      this.addReason(UniversalModeReason.DEVELOPMENT);
    }
    
    // Check GPS hardware
    if (!('geolocation' in navigator)) {
      this.addReason(UniversalModeReason.NO_GPS_HARDWARE);
    }
    
    this._initialized = true;
    this.updateUniversalMode();
  }
  
  // Simple methods to add/remove reasons
  addReason(reason: UniversalModeReason) {
    this._reasons.add(reason);
    this.updateUniversalMode();
  }
  
  removeReason(reason: UniversalModeReason) {
    this._reasons.delete(reason);
    this.updateUniversalMode();
  }
  
  private updateUniversalMode() {
    const shouldBeUniversal = this._reasons.size > 0;
    if (this._isUniversal !== shouldBeUniversal) {
      this._isUniversal = shouldBeUniversal;
      this.dispatchEvent(new CustomEvent('universalModeChanged', {
        detail: { enabled: shouldBeUniversal, reasons: Array.from(this._reasons) }
      }));
      console.log(`🌐 Universal Mode: ${shouldBeUniversal ? 'ON' : 'OFF'} - Reasons: [${Array.from(this._reasons).join(', ')}]`);
    }
  }
  
  get isUniversal() { return this._isUniversal; }
  get reasons() { return Array.from(this._reasons); }
}

export const universalModeManager = new UniversalModeManager();
export { UniversalModeReason };