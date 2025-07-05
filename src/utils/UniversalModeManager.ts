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

 /**
  * Check for URL parameter bypass
  */
 private hasUrlBypass(): boolean {
   const urlParams = new URLSearchParams(window.location.search);
   return (
     urlParams.has('universal') ||
     urlParams.has('demo') ||
     urlParams.has('access') ||
     this._reasons.has(UniversalModeReason.DEVELOPMENT) // Dev mode always bypasses
   );
 }

 /**
  * Check if blocked due to location (pre-permissions check)
  * Used before asking for permissions
  */
 get shouldBlockLocation(): boolean {
   const isOutsideKenilworth = this._reasons.has(UniversalModeReason.OUTSIDE_KENILWORTH);
   const noGpsHardware = this._reasons.has(UniversalModeReason.NO_GPS_HARDWARE);
   
   return (isOutsideKenilworth || noGpsHardware) && !this.hasUrlBypass();
 }

 /**
  * Check if blocked due to permissions (post-permissions check)
  * Used after permission requests have been made
  */
 get shouldBlockPermissions(): boolean {
   const hasLocationIssues = this._reasons.has(UniversalModeReason.LOCATION_UNAVAILABLE);
   const hasOrientationIssues = this._reasons.has(UniversalModeReason.ORIENTATION_UNAVAILABLE);
   
   return (hasLocationIssues || hasOrientationIssues) && !this.hasUrlBypass();
 }

 /**
  * Check if app should be blocked (any reason)
  * Legacy method - use specific checks above instead
  */
 get shouldBlockApp(): boolean {
   return this.shouldBlockLocation || this.shouldBlockPermissions;
 }

 /**
  * Get specific block type for UI messaging
  */
 get blockType(): 'location' | 'permissions' | 'none' {
   if (this.shouldBlockLocation) return 'location';
   if (this.shouldBlockPermissions) return 'permissions';
   return 'none';
 }

 /**
  * Get user-friendly block reason for UI messaging
  */
 get blockReason(): string {
   // Priority order for determining primary block reason
   if (this._reasons.has(UniversalModeReason.OUTSIDE_KENILWORTH)) {
     return 'outside_park';
   }
   if (this._reasons.has(UniversalModeReason.NO_GPS_HARDWARE)) {
     return 'no_gps_hardware';
   }
   if (this._reasons.has(UniversalModeReason.LOCATION_UNAVAILABLE)) {
     return 'location_unavailable';
   }
   if (this._reasons.has(UniversalModeReason.ORIENTATION_UNAVAILABLE)) {
     return 'orientation_unavailable';
   }
   return 'none';
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