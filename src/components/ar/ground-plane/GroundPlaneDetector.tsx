// src/components/ar/GroundPlaneDetector.tsx - Simplified with Debug Edge Detection
import React, { forwardRef, useImperativeHandle, useRef, useCallback, useState, useEffect } from 'react';
import * as THREE from 'three';
import { DeviceOrientationData } from '../../../hooks/useDeviceOrientation';

// Define the interface for methods exposed via ref
export interface GroundPlaneDetectorRef {
  detectNow: () => GroundPlaneResult | null;
  lastResult: GroundPlaneResult | null;
  removeMarker: () => void;
  setManualGroundOffset: (offset: number) => void;
  adjustGroundOffset: (deltaOffset: number) => void;
  getCurrentGroundLevel: () => number;
  getCurrentOffset: () => number;
  checkCameraReadiness: () => CameraReadinessInfo;
  // Edge detection controls
  toggleEdgeDetection: (enabled: boolean) => void;
  getEdgeDetectionStatus: () => EdgeDetectionStatus;
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

export interface EdgeDetectionStatus {
  enabled: boolean;
  processing: boolean;
  lastProcessTime: number;
  edgeCount: number;
  groundConfidence: number;
  error?: string;
  debugInfo?: string;
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
    // Edge detection data
    edgeDetectionEnabled?: boolean;
    edgeCount?: number;
    processingTime?: number;
    groundLineDetected?: boolean;
    edgeStrength?: number;
    horizontalEdgeRatio?: number;
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
    const groundPlaneMarkerRef = useRef<THREE.Object3D | null>(null);
    
    // Simplified edge detection refs
    const edgeCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const edgeContextRef = useRef<CanvasRenderingContext2D | null>(null);
    
    // State
    const [lastDetectionResult, setLastDetectionResult] = useState<GroundPlaneResult | null>(null);
    const [manualGroundOffset, setManualGroundOffset] = useState(0);
    const [edgeDetectionEnabled, setEdgeDetectionEnabled] = useState(true);
    const [edgeDetectionStatus, setEdgeDetectionStatus] = useState<EdgeDetectionStatus>({
      enabled: true,
      processing: false,
      lastProcessTime: 0,
      edgeCount: 0,
      groundConfidence: 0,
      debugInfo: 'Not initialized'
    });

    // Simplified edge detection using Canvas 2D instead of WebGL
    const initializeSimpleEdgeDetection = useCallback(() => {
      if (!videoElement) {
        setEdgeDetectionStatus(prev => ({ 
          ...prev, 
          error: 'No video element',
          debugInfo: 'Video element missing'
        }));
        return false;
      }

      try {
        // Create a small canvas for edge detection
        const canvas = document.createElement('canvas');
        canvas.width = 160;  // Even smaller for better performance
        canvas.height = 120;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          throw new Error('Could not get 2D context');
        }

        edgeCanvasRef.current = canvas;
        edgeContextRef.current = ctx;

        setEdgeDetectionStatus(prev => ({ 
          ...prev, 
          debugInfo: 'Simple edge detection initialized',
          error: undefined
        }));

        console.log('✅ Simple edge detection initialized with canvas:', canvas.width, 'x', canvas.height);
        return true;

      } catch (error) {
        console.error('❌ Failed to initialize simple edge detection:', error);
        setEdgeDetectionStatus(prev => ({ 
          ...prev, 
          error: `Init failed: ${error}`,
          debugInfo: `Initialization error: ${error}`
        }));
        return false;
      }
    }, [videoElement]);

    // Simple Sobel edge detection using Canvas 2D
    const processSimpleEdgeDetection = useCallback((): {
      edgeCount: number;
      horizontalEdgeRatio: number;
      groundLineDetected: boolean;
      edgeStrength: number;
      processingTime: number;
    } => {
      const startTime = performance.now();

      if (!videoElement || !edgeCanvasRef.current || !edgeContextRef.current) {
        console.log('❌ Edge detection: Missing required elements');
        return {
          edgeCount: 0,
          horizontalEdgeRatio: 0,
          groundLineDetected: false,
          edgeStrength: 0,
          processingTime: 0
        };
      }

      try {
        const canvas = edgeCanvasRef.current;
        const ctx = edgeContextRef.current;

        // Check if video has valid dimensions
        if (videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
          console.log('❌ Video has no dimensions:', videoElement.videoWidth, 'x', videoElement.videoHeight);
          return {
            edgeCount: 0,
            horizontalEdgeRatio: 0,
            groundLineDetected: false,
            edgeStrength: 0,
            processingTime: performance.now() - startTime
          };
        }

        // Draw video frame to canvas
        ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

        // Get image data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Convert to grayscale and apply simple edge detection
        let totalEdgeStrength = 0;
        let strongEdgeCount = 0;
        let horizontalEdges = 0;
        let verticalEdges = 0;

        // Focus on bottom 30% of image (likely ground area)
        const groundRegionStart = Math.floor(canvas.height * 0.7);

        for (let y = groundRegionStart + 1; y < canvas.height - 1; y++) {
          for (let x = 1; x < canvas.width - 1; x++) {
            // Get surrounding pixels (simplified 3x3 Sobel)
            const getPixelBrightness = (px: number, py: number) => {
              const idx = (py * canvas.width + px) * 4;
              return (data[idx] + data[idx + 1] + data[idx + 2]) / 3; // Average RGB
            };

            // Sample 3x3 neighborhood
            const tl = getPixelBrightness(x - 1, y - 1);
            const tm = getPixelBrightness(x, y - 1);
            const tr = getPixelBrightness(x + 1, y - 1);
            const ml = getPixelBrightness(x - 1, y);
            const mr = getPixelBrightness(x + 1, y);
            const bl = getPixelBrightness(x - 1, y + 1);
            const bm = getPixelBrightness(x, y + 1);
            const br = getPixelBrightness(x + 1, y + 1);

            // Sobel operators
            const gx = (-1 * tl) + (0 * tm) + (1 * tr) +
                       (-2 * ml) + (0 * 0)  + (2 * mr) +
                       (-1 * bl) + (0 * bm) + (1 * br);

            const gy = (-1 * tl) + (-2 * tm) + (-1 * tr) +
                       (0 * ml)  + (0 * 0)   + (0 * mr) +
                       (1 * bl)  + (2 * bm)  + (1 * br);

            const edgeMagnitude = Math.sqrt(gx * gx + gy * gy) / 255.0; // Normalize
            totalEdgeStrength += edgeMagnitude;

            if (edgeMagnitude > 0.3) { // Strong edge threshold
              strongEdgeCount++;
              
              // Determine edge orientation
              if (Math.abs(gy) > Math.abs(gx)) {
                horizontalEdges++; // Horizontal edge (good for ground detection)
              } else {
                verticalEdges++; // Vertical edge
              }
            }
          }
        }

        const totalPixelsInGroundRegion = (canvas.width - 2) * (canvas.height - groundRegionStart - 2);
        const averageEdgeStrength = totalEdgeStrength / totalPixelsInGroundRegion;
        const horizontalEdgeRatio = horizontalEdges / Math.max(1, horizontalEdges + verticalEdges);

        // Simple ground line detection heuristic
        const groundLineDetected = horizontalEdgeRatio > 0.4 && strongEdgeCount > 10;

        const processingTime = performance.now() - startTime;

        console.log('🔍 Edge detection results:', {
          strongEdgeCount,
          horizontalEdgeRatio: horizontalEdgeRatio.toFixed(2),
          averageEdgeStrength: averageEdgeStrength.toFixed(3),
          groundLineDetected,
          processingTime: processingTime.toFixed(1) + 'ms'
        });

        return {
          edgeCount: strongEdgeCount,
          horizontalEdgeRatio,
          groundLineDetected,
          edgeStrength: averageEdgeStrength,
          processingTime
        };

      } catch (error) {
        console.error('❌ Edge detection processing failed:', error);
        return {
          edgeCount: 0,
          horizontalEdgeRatio: 0,
          groundLineDetected: false,
          edgeStrength: 0,
          processingTime: performance.now() - startTime
        };
      }
    }, []);

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
        readiness.videoReady = videoElement.readyState >= 2;
        
        if (videoElement.videoWidth && videoElement.videoHeight) {
          readiness.videoSize = `${videoElement.videoWidth}x${videoElement.videoHeight}`;
        } else {
          readiness.videoSize = 'no dimensions';
        }

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

    // Enhanced detection algorithm
    const detectGroundPlane = useCallback((
      video: HTMLVideoElement, 
      orientation: DeviceOrientationData
    ): GroundPlaneResult => {
      
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
            cvSuccess: false,
            edgeDetectionEnabled
          }
        };
      }

      const betaDegrees = orientation.beta;
      const gammaDegrees = orientation.gamma;
      const beta = betaDegrees * Math.PI / 180;

      // Basic orientation-based distance calculation
      let orientationDistance = 1.7;
      let orientationConfidence = 0.3;
      
      if (Math.abs(betaDegrees) > 15) {
        const angleToGroundRadians = Math.abs(beta);
        const altDistance3 = 1.7 / Math.tan(angleToGroundRadians);
        orientationDistance = Math.max(0.3, Math.min(3.0, altDistance3));
        orientationConfidence = Math.min(Math.abs(beta) / (Math.PI / 2), 0.9);
      }

      // Initialize CV analysis
      let cvAnalysis: any = {
        cvSuccess: false,
        cvStep: 'cv_analysis',
        cvError: edgeDetectionEnabled ? undefined : 'edge_detection_disabled',
        cvConfidence: 'N/A',
        cvColor: 'N/A',
        cvEdges: 'N/A',
        edgeDetectionEnabled,
        edgeCount: 0,
        processingTime: 0,
        groundLineDetected: false,
        edgeStrength: 0,
        horizontalEdgeRatio: 0
      };

      let finalDistance = orientationDistance;
      let finalConfidence = orientationConfidence;
      let detectionMethod = 'orientation only';

      // Try edge detection if enabled
      if (edgeDetectionEnabled && cameraInfo.videoReady && video.videoWidth > 0) {
        try {
          setEdgeDetectionStatus(prev => ({ ...prev, processing: true }));

          // Initialize if needed
          if (!edgeCanvasRef.current) {
            const initSuccess = initializeSimpleEdgeDetection();
            if (!initSuccess) {
              throw new Error('Failed to initialize edge detection');
            }
          }

          // Process edge detection
          const edgeResults = processSimpleEdgeDetection();
          
          cvAnalysis = {
            cvSuccess: edgeResults.edgeCount > 0,
            cvStep: 'simple_edge_detection',
            cvConfidence: edgeResults.groundLineDetected ? 'high' : 'medium',
            cvColor: 'analyzed',
            cvEdges: `${edgeResults.edgeCount} edges detected`,
            edgeDetectionEnabled,
            edgeCount: edgeResults.edgeCount,
            processingTime: edgeResults.processingTime,
            groundLineDetected: edgeResults.groundLineDetected,
            edgeStrength: edgeResults.edgeStrength,
            horizontalEdgeRatio: edgeResults.horizontalEdgeRatio
          };

          // Combine results
          if (edgeResults.groundLineDetected) {
            finalConfidence = Math.min(orientationConfidence + 0.2, 0.95);
            detectionMethod = 'orientation + edge detection';
          }

          setEdgeDetectionStatus(prev => ({
            ...prev,
            processing: false,
            lastProcessTime: edgeResults.processingTime,
            edgeCount: edgeResults.edgeCount,
            groundConfidence: edgeResults.groundLineDetected ? 0.8 : 0.4,
            debugInfo: `Processed ${edgeResults.edgeCount} edges in ${edgeResults.processingTime.toFixed(1)}ms`
          }));

        } catch (error) {
          console.error('❌ Edge detection failed:', error);
          cvAnalysis.cvError = `Edge detection failed: ${error}`;
          setEdgeDetectionStatus(prev => ({ 
            ...prev, 
            processing: false, 
            error: `Processing failed: ${error}`,
            debugInfo: `Error: ${error}`
          }));
        }
      }
      
      const result: GroundPlaneResult = {
        detected: true,
        distance: finalDistance,
        normal: new THREE.Vector3(0, 1, 0),
        confidence: finalConfidence,
        method: detectionMethod,
        angle: Math.abs(betaDegrees),
        debugData: {
          betaDegrees,
          gammaDegrees,
          angleToGroundDegrees: Math.abs(betaDegrees),
          originalDistance: 1.7 / Math.sin(Math.abs(beta)),
          clampedDistance: finalDistance,
          altDistance1: 1.7 * Math.cos(Math.abs(beta)),
          altDistance2: 1.7,
          altDistance3: 1.7 / Math.tan(Math.abs(beta)),
          sinAngle: Math.sin(Math.abs(beta)),
          cosAngle: Math.cos(Math.abs(beta)),
          tanAngle: Math.tan(Math.abs(beta)),
          videoExists: cameraInfo.videoExists,
          videoReady: cameraInfo.videoReady,
          videoInfo: `Ready: ${cameraInfo.videoReady}, State: ${cameraInfo.readyState}`,
          videoSize: cameraInfo.videoSize,
          ...cvAnalysis
        }
      };
      
      return result;
    }, [checkCameraReadiness, edgeDetectionEnabled, initializeSimpleEdgeDetection, processSimpleEdgeDetection]);

    // Visualization functions (simplified)
    const addGroundPlaneMarker = useCallback((groundPlane: GroundPlaneResult) => {
      if (!scene) return;
      
      // Remove existing marker first
      if (groundPlaneMarkerRef.current) {
        scene.remove(groundPlaneMarkerRef.current);
        groundPlaneMarkerRef.current = null;
      }
      
      // Create ground plane visualization
      const geometry = new THREE.PlaneGeometry(10, 10);
      const material = new THREE.MeshBasicMaterial({
        color: groundPlane.confidence > 0.7 ? 0x00ff00 : 0xff6600,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide
      });
      
      const groundMesh = new THREE.Mesh(geometry, material);
      const finalGroundY = -groundPlane.distance + manualGroundOffset;
      groundMesh.position.set(0, finalGroundY, 0);
      groundMesh.rotation.x = -Math.PI / 2;
      
      scene.add(groundMesh);
      groundPlaneMarkerRef.current = groundMesh;
      
      console.log('🌍 Ground plane marker at Y =', finalGroundY, '(method:', groundPlane.method, ')');
    }, [scene, manualGroundOffset]);

    const removeGroundPlaneMarker = useCallback(() => {
      if (groundPlaneMarkerRef.current && scene) {
        scene.remove(groundPlaneMarkerRef.current);
        groundPlaneMarkerRef.current = null;
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
          method: 'missing inputs',
          debugData: {
            videoExists: !!videoElement,
            videoReady: false,
            cvError: 'Missing video element or device orientation',
            cvStep: 'input_validation',
            cvSuccess: false,
            edgeDetectionEnabled
          }
        };
        
        setLastDetectionResult(fallbackResult);
        return fallbackResult;
      }

      try {
        const result = detectGroundPlane(videoElement, deviceOrientation);
        setLastDetectionResult(result);
        
        if (onGroundPlaneDetected) {
          onGroundPlaneDetected(result);
        }
        
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
            cvSuccess: false,
            edgeDetectionEnabled
          }
        };
        
        setLastDetectionResult(errorResult);
        return errorResult;
      }
    }, [videoElement, deviceOrientation, detectGroundPlane, onGroundPlaneDetected, isTestMode, addGroundPlaneMarker]);

    // Offset adjustment
    const adjustGroundOffsetInternal = useCallback((deltaOffset: number) => {
      setManualGroundOffset(prevOffset => {
        const newOffset = prevOffset + deltaOffset;
        setTimeout(() => {
          if (lastDetectionResult && isTestMode) {
            addGroundPlaneMarker(lastDetectionResult);
          }
        }, 50);
        return newOffset;
      });
    }, [lastDetectionResult, isTestMode, addGroundPlaneMarker]);

    // Edge detection controls
    const toggleEdgeDetection = useCallback((enabled: boolean) => {
      setEdgeDetectionEnabled(enabled);
      setEdgeDetectionStatus(prev => ({
        ...prev,
        enabled,
        debugInfo: enabled ? 'Edge detection enabled' : 'Edge detection disabled',
        ...(enabled ? {} : { error: 'Disabled by user' })
      }));
      console.log('🔍 Edge detection', enabled ? 'enabled' : 'disabled');
    }, []);

    const getEdgeDetectionStatus = useCallback((): EdgeDetectionStatus => {
      return edgeDetectionStatus;
    }, [edgeDetectionStatus]);

    // Expose methods via useImperativeHandle
    useImperativeHandle(ref, () => ({
      detectNow: runDetection,
      lastResult: lastDetectionResult,
      removeMarker: removeGroundPlaneMarker,
      setManualGroundOffset: (offset: number) => {
        setManualGroundOffset(offset);
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
      checkCameraReadiness,
      toggleEdgeDetection,
      getEdgeDetectionStatus
    }), [
      runDetection, 
      lastDetectionResult, 
      removeGroundPlaneMarker, 
      manualGroundOffset, 
      adjustGroundOffsetInternal,
      checkCameraReadiness,
      toggleEdgeDetection,
      getEdgeDetectionStatus
    ]);

    // Auto-update detection when in test mode
    useEffect(() => {
      if (isTestMode) {
        console.log('🌍 Starting simplified auto-detection with edge detection:', edgeDetectionEnabled);
        const interval = setInterval(() => {
          runDetection();
        }, 1000);
        
        return () => {
          clearInterval(interval);
        };
      } else {
        removeGroundPlaneMarker();
      }
    }, [isTestMode, runDetection, removeGroundPlaneMarker, edgeDetectionEnabled]);

    // Cleanup on unmount
    useEffect(() => {
      return () => {
        console.log('🌍 Simplified GroundPlaneDetector unmounting');
        removeGroundPlaneMarker();
      };
    }, [removeGroundPlaneMarker]);

    return null;
  }
);

GroundPlaneDetector.displayName = 'SimplifiedGroundPlaneDetector';

export default GroundPlaneDetector;