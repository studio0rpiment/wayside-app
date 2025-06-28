// src/utils/anchorCorrections.ts - Clean, expandable ML corrections

interface MLCorrection {
  deltaLon: number;
  deltaLat: number;
  confidence: number;
  sampleCount: number;
  version?: string;
  lastUpdated?: string;
}

interface MLCorrections {
  [experienceId: string]: MLCorrection;
}

// Regression analysis results - easy to expand
const ML_CORRECTIONS: MLCorrections = {
  "mac": {
    deltaLon: -9.024755517397688e-06,
    deltaLat: -0.0001426132075721398,
    confidence: 0.7557048797607422,
    sampleCount: 16,
    version: "v1.0",
    lastUpdated: "2025-01-15"
  }
  
  // TODO: Add other experiences as you train them
  // "lotus": { deltaLon: ..., deltaLat: ..., confidence: ..., sampleCount: ... },
  // "lily": { deltaLon: ..., deltaLat: ..., confidence: ..., sampleCount: ... },
  // "cattail": { deltaLon: ..., deltaLat: ..., confidence: ..., sampleCount: ... },
};

/**
 * Simple ML correction system for anchor positioning
 * Designed to expand to all experiences as you train them
 */
export class MLAnchorCorrections {
  private corrections = ML_CORRECTIONS;
  private enabled = false;
  private minConfidence = 0.5;
  private minSamples = 10;

  constructor() {
    // Restore enabled state from previous session
    if (typeof window !== 'undefined') {
      this.enabled = (window as any).mlAnchorCorrectionsEnabled ?? false;
    }
  }

  /**
   * Toggle corrections globally
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    
    // Persist setting
    if (typeof window !== 'undefined') {
      (window as any).mlAnchorCorrectionsEnabled = enabled;
    }
    
    console.log(`🧠 ML Anchor Corrections: ${enabled ? 'ENABLED' : 'DISABLED'}`);
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Check if correction exists and meets quality thresholds
   */
  hasValidCorrection(experienceId: string): boolean {
    const correction = this.corrections[experienceId];
    if (!correction) return false;
    
    return correction.confidence >= this.minConfidence && 
           correction.sampleCount >= this.minSamples;
  }

  /**
   * Get correction for experience (returns null if disabled or invalid)
   */
  getCorrection(experienceId: string): MLCorrection | null {
    if (!this.enabled) return null;
    if (!this.hasValidCorrection(experienceId)) return null;
    
    return this.corrections[experienceId];
  }

  /**
   * Apply correction to GPS coordinates
   */
  applyCorrectionToGPS(
    experienceId: string, 
    originalGPS: [number, number]
  ): {
    gps: [number, number];
    corrected: boolean;
    correction?: MLCorrection;
  } {
    const correction = this.getCorrection(experienceId);
    
    if (!correction) {
      return {
        gps: originalGPS,
        corrected: false
      };
    }

    const correctedGPS: [number, number] = [
      originalGPS[0] + correction.deltaLon,
      originalGPS[1] + correction.deltaLat
    ];

    console.log(`🧠 Applied ML correction to ${experienceId}:`, {
      original: originalGPS,
      corrected: correctedGPS,
      delta: [correction.deltaLon, correction.deltaLat],
      confidence: correction.confidence
    });

    return {
      gps: correctedGPS,
      corrected: true,
      correction
    };
  }

  /**
   * Get info for debugging/UI
   */
  getInfo(experienceId: string): {
    available: boolean;
    enabled: boolean;
    valid: boolean;
    correction?: MLCorrection;
  } {
    const correction = this.corrections[experienceId];
    
    return {
      available: !!correction,
      enabled: this.enabled,
      valid: this.hasValidCorrection(experienceId),
      correction
    };
  }

  /**
   * Get all available experiences (for UI)
   */
  getAvailableExperiences(): string[] {
    return Object.keys(this.corrections);
  }

  /**
   * Get total count of trained experiences
   */
  getTrainedCount(): number {
    return Object.keys(this.corrections).length;
  }
}

// Export singleton
export const mlAnchorCorrections = new MLAnchorCorrections();