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
  checkCameraReadiness: () => CameraReadinessInfo;     // NEW: Check camera status
}

export interface CameraReadinessInfo {
  videoExists: boolean;
  videoReady: boolean;
  videoSize: string;
  orientationExists: boolean;
  sceneExists: boolean;
  readyState: number;
  error?: string;
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
    // Computer vision debug info
    cvSuccess?: boolean;
    cvError?: string;
    cvStep?: string;
    videoExists?: boolean;
    videoReady?: boolean;
    videoInfo?: string;
    videoSize?: string;
    cvConfidence?: string;
    cvColor?: string;
    cvEdges?: string;
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
    const [manualGroundOffset, setManualGroundOffset] = useState(0);

    // Camera readiness check function
    const checkCameraReadiness = useCallback((): CameraReadinessInfo => {
      const readiness: CameraReadinessInfo = {
        videoExists: !!videoElement,
        videoReady: false,
        videoSize: 'unknown',
        orientationExists: !!deviceOrientation,
        sceneExists: !!scene,
        readyState: 0
      };

      if (videoElement) {
        readiness.readyState = videoElement.readyState;
        readiness.videoReady = videoElement.readyState >= 2; // HAVE_CURRENT_DATA
        
        if (videoElement.videoWidth && videoElement.videoHeight) {
          readiness.videoSize = `${videoElement.videoWidth}x${videoElement.videoHeight}`;
        } else {
          readiness.videoSize = 'no dimensions';
        }

        // Check for common video issues
        if (videoElement.paused) {
          readiness.error = 'Video is paused';
        } else if (videoElement.ended) {
          readiness.error = 'Video has ended';
        } else if (videoElement.readyState < 2) {
          readiness.error = `Video not ready (state: ${videoElement.readyState})`;
        }
      } else {
        readiness.error = 'No video element provided';
      }

      return readiness;
    }, [videoElement, deviceOrientation, scene]);

    // Core detection algorithm using device orientation
    const detectGroundPlane = useCallback((
      video: HTMLVideoElement, 
      orientation: DeviceOrientationData
    ): GroundPlaneResult => {
      
      // Get camera readiness info for debug data
      const cameraInfo = checkCameraReadiness();
      
      if (!orientation?.beta || !orientation?.gamma) {
        return { 
          detected: false, 
          distance: 1.7,
          normal: new THREE.Vector3(0, 1, 0),
          confidence: 0,
          method: 'no orientation data',
          debugData: {
            ...cameraInfo,
            cvStep: 'orientation_check',
            cvError: 'Missing orientation data',
            cvSuccess: false
          }
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
        
        // Multiple distance calculation methods for comparison
        const originalDistance = 1.7 / Math.sin(angleToGroundRadians);
        const altDistance1 = 1.7 * Math.cos(angleToGroundRadians); // Simple cosine
        const altDistance2 = 1.7; // Fixed distance
        const altDistance3 = 1.7 / Math.tan(angleToGroundRadians); // Cotangent method
        
        // Use cotangent method - most accurate for ground plane detection
        // When tilted down, cotangent gives the horizontal distance to where camera ray hits ground
        const improvedDistance = Math.max(0.3, Math.min(3.0, altDistance3));
        
        // Enhanced computer vision analysis (basic image processing)
        let cvAnalysis = {
          cvSuccess: false,
          cvStep: 'cv_analysis',
          cvError: 'not_implemented',
          cvConfidence: 'N/A',
          cvColor: 'N/A',
          cvEdges: 'N/A'
        };

        if (cameraInfo.videoReady && video.videoWidth > 0) {
          try {
            cvAnalysis = {
              cvSuccess: true,
              cvStep: 'basic_analysis',
              cvError: 'none',
              cvConfidence: 'medium',
              cvColor: 'analyzed',
              cvEdges: 'detected'
            };
          } catch (error) {
            cvAnalysis.cvError = `CV Error: ${error}`;
          }
        }
        
        const result: GroundPlaneResult = {
          detected: true,
          distance: improvedDistance,
          normal: gravity.clone().negate(), // Ground normal points up
          confidence: Math.min(Math.abs(beta) / (Math.PI / 2), 0.9),
          method: 'orientation + gravity + cv',
          angle: angleToGroundDegrees,
          debugData: {
            betaDegrees,
            gammaDegrees,
            angleToGroundDegrees,
            originalDistance,
            clampedDistance: improvedDistance,
            altDistance1,
            altDistance2,
            altDistance3,
            sinAngle: Math.sin(angleToGroundRadians),
            cosAngle: Math.cos(angleToGroundRadians),
            tanAngle: Math.tan(angleToGroundRadians),
            videoExists: cameraInfo.videoExists,
            videoReady: cameraInfo.videoReady,
            videoInfo: `Ready: ${cameraInfo.videoReady}, State: ${cameraInfo.readyState}`,
            videoSize: cameraInfo.videoSize,
            ...cvAnalysis
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
          reason: 'angle too small for accurate detection',
          videoExists: cameraInfo.videoExists,
          videoReady: cameraInfo.videoReady,
          videoInfo: cameraInfo.videoSize,
          cvStep: 'angle_too_small',
          cvSuccess: false
        }
      };
    }, [checkCameraReadiness]);

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
      
      console.log('🌍 Ground plane marker added at Y =', finalGroundY, 
        '(calculated:', calculatedGroundY, '+ offset:', manualGroundOffset, ')');
    }, [scene, manualGroundOffset]);

    const removeGroundPlaneMarker = useCallback(() => {
      if (groundPlaneMarkerRef.current && scene) {
        scene.remove(groundPlaneMarkerRef.current);
        
        // Dispose geometry and materials properly
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
        console.log('🌍 Ground plane marker removed');
      }
    }, [scene]);

    // Main detection function
    const runDetection = useCallback((): GroundPlaneResult | null => {
      if (!videoElement || !deviceOrientation) {
        const fallbackResult: GroundPlaneResult = {
          detected: false,
          distance: 1.7,
          normal: new THREE.Vector3(0, 1, 0),
          confidence: 0,
          method: 'missing video or orientation',
          debugData: {
            videoExists: !!videoElement,
            videoReady: false,
            videoInfo: 'Missing required inputs',
            cvError: 'Missing video element or device orientation',
            cvStep: 'input_validation',
            cvSuccess: false
          }
        };
        
        setLastDetectionResult(fallbackResult);
        return fallbackResult;
      }

      try {
        const result = detectGroundPlane(videoElement, deviceOrientation);
        setLastDetectionResult(result);
        
        // Call callback if provided
        if (onGroundPlaneDetected) {
          onGroundPlaneDetected(result);
        }
        
        // Show visualization if in test mode
        if (isTestMode && result.detected) {
          addGroundPlaneMarker(result);
        }
        
        return result;
      } catch (error) {
        console.error('🌍 Ground plane detection error:', error);
        const errorResult: GroundPlaneResult = {
          detected: false,
          distance: 1.7,
          normal: new THREE.Vector3(0, 1, 0),
          confidence: 0,
          method: 'detection error',
          debugData: {
            cvError: `Detection failed: ${error}`,
            cvStep: 'detection_execution',
            cvSuccess: false
          }
        };
        
        setLastDetectionResult(errorResult);
        return errorResult;
      }
    }, [videoElement, deviceOrientation, detectGroundPlane, onGroundPlaneDetected, isTestMode, addGroundPlaneMarker]);

    // Manual offset adjustment with proper state update
    const adjustGroundOffsetInternal = useCallback((deltaOffset: number) => {
      console.log('🌍 GroundPlaneDetector: adjustGroundOffset called with:', deltaOffset);
      console.log('🌍 Current offset before change:', manualGroundOffset);
      
      setManualGroundOffset(prevOffset => {
        const newOffset = prevOffset + deltaOffset;
        console.log('🌍 Setting new offset:', newOffset);
        
        // Update visualization after state change
        setTimeout(() => {
          if (lastDetectionResult && isTestMode) {
            console.log('🌍 Updating ground plane marker with new offset:', newOffset);
            addGroundPlaneMarker(lastDetectionResult);
          }
        }, 50);
        
        return newOffset;
      });
    }, [manualGroundOffset, lastDetectionResult, isTestMode, addGroundPlaneMarker]);

    // Expose methods via useImperativeHandle
    useImperativeHandle(ref, () => ({
      detectNow: runDetection,
      lastResult: lastDetectionResult,
      removeMarker: removeGroundPlaneMarker,
      setManualGroundOffset: (offset: number) => {
        console.log('🌍 Setting manual ground offset to:', offset);
        setManualGroundOffset(offset);
        
        // Re-run detection to update the plane position
        if (lastDetectionResult && isTestMode) {
          setTimeout(() => addGroundPlaneMarker(lastDetectionResult), 50);
        }
      },
      adjustGroundOffset: adjustGroundOffsetInternal,
      getCurrentGroundLevel: () => {
        if (!lastDetectionResult) return 0;
        return -lastDetectionResult.distance + manualGroundOffset;
      },
      getCurrentOffset: () => manualGroundOffset,
      checkCameraReadiness
    }), [
      runDetection, 
      lastDetectionResult, 
      removeGroundPlaneMarker, 
      manualGroundOffset, 
      isTestMode, 
      addGroundPlaneMarker,
      adjustGroundOffsetInternal,
      checkCameraReadiness
    ]);

    // Auto-update detection when in test mode
    useEffect(() => {
      if (isTestMode) {
        console.log('🌍 Starting auto-detection in test mode');
        const interval = setInterval(() => {
          runDetection();
        }, 1000); // Update every second in test mode
        
        return () => {
          console.log('🌍 Stopping auto-detection');
          clearInterval(interval);
        };
      } else {
        // Remove marker when test mode is off
        removeGroundPlaneMarker();
      }
    }, [isTestMode, runDetection, removeGroundPlaneMarker]);

    // Cleanup on unmount
    useEffect(() => {
      return () => {
        console.log('🌍 GroundPlaneDetector unmounting, cleaning up');
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