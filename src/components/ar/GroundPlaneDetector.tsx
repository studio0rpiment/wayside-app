// src/components/ar/GroundPlaneDetector.tsx
import React, { forwardRef, useImperativeHandle, useRef, useCallback, useState, useEffect } from 'react';
import * as THREE from 'three';
import { DeviceOrientationData } from '../../hooks/useDeviceOrientation';

// Define the interface for methods exposed via ref
export interface GroundPlaneDetectorRef {
  detectNow: () => GroundPlaneResult | null;
  lastResult: GroundPlaneResult | null;
  removeMarker: () => void;
  setManualGroundOffset: (offset: number) => void;    // Set to specific value
  adjustGroundOffset: (deltaOffset: number) => void;  // Add to current value
  getCurrentGroundLevel: () => number;                 // Get current ground Y
  getCurrentOffset: () => number;                      // Get current offset value
}

export interface GroundPlaneResult {
  detected: boolean;
  distance: number;
  normal: THREE.Vector3;
  confidence: number;
  method: string;
  angle?: number;
  debugData?: {
    betaDegrees?: number;
    gammaDegrees?: number;
    angleToGroundDegrees?: number;
    originalDistance?: number;
    clampedDistance?: number;
    altDistance1?: number;
    altDistance2?: number;
    altDistance3?: number;
    sinAngle?: number;
    cosAngle?: number;
    tanAngle?: number;
    reason?: string;
    cvAnalysis?: {
      confidence: number;
      groundColor: { r: number; g: number; b: number };
      uniformity: number;
      estimatedDistance: number;
    };
  };
}

interface GroundPlaneDetectorProps {
  videoElement: HTMLVideoElement | null;
  deviceOrientation: DeviceOrientationData | null;
  scene: THREE.Scene | null;
  isTestMode: boolean;
  onGroundPlaneDetected?: (result: GroundPlaneResult) => void;
}

const GroundPlaneDetector = forwardRef<GroundPlaneDetectorRef, GroundPlaneDetectorProps>(
  ({ videoElement, deviceOrientation, scene, isTestMode, onGroundPlaneDetected }, ref) => {
    
    // Refs for visualization
    const groundPlaneMarkerRef = useRef<THREE.Group | null>(null);
    
    // State
    const [lastDetectionResult, setLastDetectionResult] = useState<GroundPlaneResult | null>(null);
    const [manualGroundOffset, setManualGroundOffset] = useState(0); // NEW: Manual adjustment

    // Core detection algorithm
    const detectGroundPlane = useCallback((
      video: HTMLVideoElement, 
      orientation: DeviceOrientationData
    ): GroundPlaneResult => {
      
      if (!orientation?.beta || !orientation?.gamma) {
        return { 
          detected: false, 
          distance: 1.7,
          normal: new THREE.Vector3(0, 1, 0),
          confidence: 0,
          method: 'no orientation data'
        };
      }

      const betaDegrees = orientation.beta;
      const gammaDegrees = orientation.gamma;
      const beta = betaDegrees * Math.PI / 180;
      const gamma = gammaDegrees * Math.PI / 180;
      
      // Calculate gravity vector (which way is down)
      const gravity = new THREE.Vector3(
        Math.sin(gamma),
        -Math.cos(beta) * Math.cos(gamma),
        Math.sin(beta) * Math.cos(gamma)
      );
      
      // Check if camera is pointing down enough to detect ground
      if (Math.abs(betaDegrees) > 15) { // 15° threshold
        const angleToGroundDegrees = Math.abs(betaDegrees);
        const angleToGroundRadians = Math.abs(beta);
        
        // Original calculation (problematic)
        const originalDistance = 1.7 / Math.sin(angleToGroundRadians);
        
        // Alternative calculations to test
        const altDistance1 = 1.7 * Math.cos(angleToGroundRadians); // Simple cosine
        const altDistance2 = 1.7; // Fixed distance
        const altDistance3 = 1.7 / Math.tan(angleToGroundRadians); // Cotangent (adjacent/opposite)
        
        // FIXED: Use cotangent method - more accurate for ground plane detection
        // When tilted down, cotangent gives the horizontal distance to where camera ray hits ground
        const improvedDistance = Math.max(0.3, Math.min(3.0, altDistance3));
        
        // Use improved distance instead of original
        const clampedDistance = improvedDistance;
        
        // Store debug info in the result
        const result = {
          detected: true,
          distance: clampedDistance,
          normal: gravity.clone().negate(), // Ground normal points up
          confidence: Math.min(Math.abs(beta) / (Math.PI / 2), 0.9), // Higher angle = more confidence
          method: 'orientation + gravity',
          angle: angleToGroundDegrees,
          // Add debug data
          debugData: {
            betaDegrees,
            gammaDegrees,
            angleToGroundDegrees,
            originalDistance,
            clampedDistance,
            altDistance1,
            altDistance2,
            altDistance3,
            sinAngle: Math.sin(angleToGroundRadians),
            cosAngle: Math.cos(angleToGroundRadians),
            tanAngle: Math.tan(angleToGroundRadians)
          }
        };
        
        return result;
      }
      
      // Fallback when phone isn't tilted enough
      return {
        detected: true,
        distance: 1.7, // Default user height
        normal: new THREE.Vector3(0, 1, 0),
        confidence: 0.3,
        method: 'fallback assumption',
        angle: Math.abs(betaDegrees),
        debugData: {
          betaDegrees,
          gammaDegrees,
          reason: 'angle too small'
        }
      };
    }, []);

    // Visualization functions
    const addGroundPlaneMarker = useCallback((groundPlane: GroundPlaneResult) => {
      if (!scene) return;
      
      // Remove existing marker
      removeGroundPlaneMarker();
      
      // Create ground plane visualization
      const geometry = new THREE.PlaneGeometry(10, 10); // 10m x 10m plane
      const material = new THREE.MeshBasicMaterial({
        color: groundPlane.confidence > 0.7 ? 0x00ff00 : 0xff6600, // Green if confident, orange if not
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide
      });
      
      const groundMesh = new THREE.Mesh(geometry, material);
      
      // Position the ground plane WITH MANUAL OFFSET
      const calculatedGroundY = -groundPlane.distance;
      const finalGroundY = calculatedGroundY + manualGroundOffset;
      
      groundMesh.position.set(0, finalGroundY, 0);
      groundMesh.rotation.x = -Math.PI / 2; // Lay flat (horizontal)
      
      // Add grid lines for better visualization
      const gridHelper = new THREE.GridHelper(10, 20, 0xffffff, 0xffffff);
      gridHelper.position.set(0, finalGroundY + 0.01, 0); // Slightly above plane
      gridHelper.material.transparent = true;
      gridHelper.material.opacity = 0.5;
      
      // Group them together
      const groundGroup = new THREE.Group();
      groundGroup.add(groundMesh);
      groundGroup.add(gridHelper);
      
      scene.add(groundGroup);
      groundPlaneMarkerRef.current = groundGroup;
      
      console.log('🌍 Ground plane at Y =', finalGroundY, '(calculated:', calculatedGroundY, '+ offset:', manualGroundOffset, ')');
    }, [scene, manualGroundOffset]);

    const removeGroundPlaneMarker = useCallback(() => {
      if (groundPlaneMarkerRef.current && scene) {
        scene.remove(groundPlaneMarkerRef.current);
        
        // Dispose geometry and materials
        groundPlaneMarkerRef.current.children.forEach(child => {
          if (child instanceof THREE.Mesh) {
            child.geometry?.dispose();
            if (Array.isArray(child.material)) {
              child.material.forEach(mat => mat.dispose());
            } else {
              child.material?.dispose();
            }
          }
        });
        
        groundPlaneMarkerRef.current = null;
      }
    }, [scene]);

    // Main detection function
    const runDetection = useCallback(() => {
      if (!videoElement || !deviceOrientation) {
        console.log('❌ Cannot detect: missing video or orientation');
        return null;
      }
      
      console.log('🧪 Running ground plane detection...');
      
      const result = detectGroundPlane(videoElement, deviceOrientation);
      setLastDetectionResult(result);
      
      console.log('🌍 Ground detection result:', result);
      
      // Call callback if provided
      if (onGroundPlaneDetected) {
        onGroundPlaneDetected(result);
      }
      
      // Show visualization if in test mode
      if (isTestMode && result.detected) {
        addGroundPlaneMarker(result);
      }
      
      return result;
    }, [videoElement, deviceOrientation, detectGroundPlane, onGroundPlaneDetected, isTestMode, addGroundPlaneMarker]);

    // Expose methods via useImperativeHandle
    useImperativeHandle(ref, () => ({
      detectNow: runDetection,
      lastResult: lastDetectionResult,
      removeMarker: removeGroundPlaneMarker,
      setManualGroundOffset: (offset: number) => {
        setManualGroundOffset(offset);
        // Re-run detection to update the plane position
        if (lastDetectionResult && isTestMode) {
          addGroundPlaneMarker(lastDetectionResult);
        }
      },
      adjustGroundOffset: (deltaOffset: number) => {  // NEW: Add to current offset
        setManualGroundOffset(prev => prev + deltaOffset);
        // Re-run detection to update the plane position
        if (lastDetectionResult && isTestMode) {
          setTimeout(() => {
            if (lastDetectionResult) {
              addGroundPlaneMarker(lastDetectionResult);
            }
          }, 50); // Small delay to ensure state update
        }
      },
      getCurrentGroundLevel: () => {
        if (!lastDetectionResult) return 0;
        return -lastDetectionResult.distance + manualGroundOffset;
      },
      getCurrentOffset: () => manualGroundOffset  // NEW: Get current offset value
    }), [runDetection, lastDetectionResult, removeGroundPlaneMarker, manualGroundOffset, isTestMode, addGroundPlaneMarker]);

    // Auto-update detection when in test mode
    useEffect(() => {
      if (isTestMode) {
        const interval = setInterval(runDetection, 500); // Update every 500ms
        return () => clearInterval(interval);
      } else {
        // Remove marker when test mode is off
        removeGroundPlaneMarker();
      }
    }, [isTestMode, runDetection, removeGroundPlaneMarker]);

    // Cleanup on unmount
    useEffect(() => {
      return () => {
        removeGroundPlaneMarker();
      };
    }, [removeGroundPlaneMarker]);

    // Return null since this component doesn't render anything visible
    // It only manages Three.js scene objects and exposes methods via ref
    return null;
  }
);

// Set display name for better debugging
GroundPlaneDetector.displayName = 'GroundPlaneDetector';

export default GroundPlaneDetector;
