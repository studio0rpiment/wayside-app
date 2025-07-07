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

 // NEW: Cache properties to prevent recalculation on every access
 private _urlBypass: boolean | null = null;
 private _cachedBlockType: 'location' | 'permissions' | 'none' | null = null;
 private _cachedBlockReason: string | null = null;
 private _cachedShouldBlockLocation: boolean | null = null;
 private _cachedShouldBlockPermissions: boolean | null = null;

 async initialize(): Promise<void> {
   if (this._initialized) return;
   
   console.log('🌐 UniversalModeManager: Initializing...');
   
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

 // NEW: Method to clear all caches when state changes
 private clearCaches(): void {
   this._cachedBlockType = null;
   this._cachedBlockReason = null;
   this._cachedShouldBlockLocation = null;
   this._cachedShouldBlockPermissions = null;
   // Note: _urlBypass stays cached since URL params don't change
 }
 
 // Simple methods to add/remove reasons
 addReason(reason: UniversalModeReason) {
   this._reasons.add(reason);
   this.clearCaches(); // NEW: Clear caches when reasons change
   this.updateUniversalMode();
 }
 
 removeReason(reason: UniversalModeReason) {
   this._reasons.delete(reason);
   this.clearCaches(); // NEW: Clear caches when reasons change
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

 /**
  * Check for URL parameter bypass - CACHED since URL doesn't change
  */
 private hasUrlBypass(): boolean {
   if (this._urlBypass === null) {
     console.log('🌐 Calculating URL bypass (first time)');
     const urlParams = new URLSearchParams(window.location.search);
     this._urlBypass = (
       urlParams.has('preview') ||
       urlParams.has('demo') ||
       urlParams.has('access') ||
       this._reasons.has(UniversalModeReason.DEVELOPMENT)
     );
     console.log('🌐 URL bypass result:', this._urlBypass);
   }
   return this._urlBypass;
 }

 /**
  * Check if blocked due to location (pre-permissions check) - CACHED
  */
 get shouldBlockLocation(): boolean {
   if (this._cachedShouldBlockLocation === null) {
     console.log('🌐 Calculating shouldBlockLocation (cache miss)');
     const isOutsideKenilworth = this._reasons.has(UniversalModeReason.OUTSIDE_KENILWORTH);
     const noGpsHardware = this._reasons.has(UniversalModeReason.NO_GPS_HARDWARE);
     
     this._cachedShouldBlockLocation = (isOutsideKenilworth || noGpsHardware) && !this.hasUrlBypass();
   }
   return this._cachedShouldBlockLocation;
 }

 /**
  * Check if blocked due to permissions (post-permissions check) - CACHED
  */
 get shouldBlockPermissions(): boolean {
   if (this._cachedShouldBlockPermissions === null) {
     console.log('🌐 Calculating shouldBlockPermissions (cache miss)');
     const hasLocationIssues = this._reasons.has(UniversalModeReason.LOCATION_UNAVAILABLE);
     const hasOrientationIssues = this._reasons.has(UniversalModeReason.ORIENTATION_UNAVAILABLE);
     
     this._cachedShouldBlockPermissions = (hasLocationIssues || hasOrientationIssues) && !this.hasUrlBypass();
   }
   return this._cachedShouldBlockPermissions;
 }

 /**
  * Check if app should be blocked (any reason)
  */
 get shouldBlockApp(): boolean {
   return this.shouldBlockLocation || this.shouldBlockPermissions;
 }

 /**
  * Get specific block type for UI messaging - CACHED
  */
 get blockType(): 'location' | 'permissions' | 'none' {
   if (this._cachedBlockType === null) {
     console.log('🌐 Calculating blockType (cache miss)');
     if (this.shouldBlockLocation) {
       this._cachedBlockType = 'location';
     } else if (this.shouldBlockPermissions) {
       this._cachedBlockType = 'permissions';
     } else {
       this._cachedBlockType = 'none';
     }
   }
   return this._cachedBlockType;
 }

 /**
  * Get user-friendly block reason for UI messaging - CACHED
  */
 get blockReason(): string {
   if (this._cachedBlockReason === null) {
     console.log('🌐 Calculating blockReason (cache miss)');
     // Priority order for determining primary block reason
     if (this._reasons.has(UniversalModeReason.OUTSIDE_KENILWORTH)) {
       this._cachedBlockReason = 'outside_park';
     } else if (this._reasons.has(UniversalModeReason.NO_GPS_HARDWARE)) {
       this._cachedBlockReason = 'no_gps_hardware';
     } else if (this._reasons.has(UniversalModeReason.LOCATION_UNAVAILABLE)) {
       this._cachedBlockReason = 'location_unavailable';
     } else if (this._reasons.has(UniversalModeReason.ORIENTATION_UNAVAILABLE)) {
       this._cachedBlockReason = 'orientation_unavailable';
     } else {
       this._cachedBlockReason = 'none';
     }
   }
   return this._cachedBlockReason;
 }

 /**
  * Get detailed block information for debugging
  */
 getBlockInfo(): {
   shouldBlockLocation: boolean;
   shouldBlockPermissions: boolean;
   blockType: string;
   blockReason: string;
   hasUrlBypass: boolean;
   activeReasons: string[];
 } {
   return {
     shouldBlockLocation: this.shouldBlockLocation,
     shouldBlockPermissions: this.shouldBlockPermissions,
     blockType: this.blockType,
     blockReason: this.blockReason,
     hasUrlBypass: this.hasUrlBypass(),
     activeReasons: Array.from(this._reasons)
   };
 }

 /**
  * Manual bypass methods for testing
  */
 enableUrlBypass(): void {
   (window as any).forceUniversalAccess = true;
   this.addReason(UniversalModeReason.DEVELOPMENT);
   console.log('🔓 Manual bypass enabled');
 }

 /**
  * Test method - simulate being outside Kenilworth
  */
 simulateOutsidePark(): void {
   this.addReason(UniversalModeReason.OUTSIDE_KENILWORTH);
   console.log('🧪 Simulated: Outside park');
 }

 /**
  * Test method - simulate permission failures
  */
 simulatePermissionFailure(type: 'location' | 'orientation' | 'both'): void {
   if (type === 'location' || type === 'both') {
     this.addReason(UniversalModeReason.LOCATION_UNAVAILABLE);
   }
   if (type === 'orientation' || type === 'both') {
     this.addReason(UniversalModeReason.ORIENTATION_UNAVAILABLE);
   }
   console.log(`🧪 Simulated: ${type} permission failure`);
 }

 /**
  * Reset all test conditions
  */
 resetTestConditions(): void {
   this.removeReason(UniversalModeReason.OUTSIDE_KENILWORTH);
   this.removeReason(UniversalModeReason.LOCATION_UNAVAILABLE);
   this.removeReason(UniversalModeReason.ORIENTATION_UNAVAILABLE);
   console.log('🧪 Test conditions reset');
 }

 // Getters for external access
 get isUniversal() { return this._isUniversal; }
 get reasons() { return Array.from(this._reasons); }
 get isInitialized() { return this._initialized; }
}

export const universalModeManager = new UniversalModeManager();
export { UniversalModeReason };