// src/components/ar/GroundPlaneDetector.tsx - Enhanced with Real Edge Detection
import React, { forwardRef, useImperativeHandle, useRef, useCallback, useState, useEffect } from 'react';
import * as THREE from 'three';
import { DeviceOrientationData } from '../../hooks/useDeviceOrientation';

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
  // NEW: Edge detection controls
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
    // Enhanced computer vision debug info
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
    // NEW: Real edge detection data
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
    
    // Refs for visualization and edge detection
    const groundPlaneMarkerRef = useRef<THREE.Group | null>(null);
    const edgeDetectionCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const edgeDetectionContextRef = useRef<CanvasRenderingContext2D | null>(null);
    const webglRendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const edgeDetectionSceneRef = useRef<THREE.Scene | null>(null);
    const edgeDetectionCameraRef = useRef<THREE.OrthographicCamera | null>(null);
    const videoTextureRef = useRef<THREE.VideoTexture | null>(null);
    
    // State
    const [lastDetectionResult, setLastDetectionResult] = useState<GroundPlaneResult | null>(null);
    const [manualGroundOffset, setManualGroundOffset] = useState(0);
    const [edgeDetectionEnabled, setEdgeDetectionEnabled] = useState(true); // Enable by default
    const [edgeDetectionStatus, setEdgeDetectionStatus] = useState<EdgeDetectionStatus>({
      enabled: true,
      processing: false,
      lastProcessTime: 0,
      edgeCount: 0,
      groundConfidence: 0
    });

    // Create Sobel edge detection shader
    const createEdgeDetectionShader = useCallback(() => {
      const vertexShader = `
        attribute vec4 position;
        attribute vec2 uv;
        varying vec2 vUv;
        
        void main() {
          vUv = uv;
          gl_Position = position;
        }
      `;

      const fragmentShader = `
        precision mediump float;
        
        uniform sampler2D uVideoTexture;
        uniform vec2 uResolution;
        varying vec2 vUv;
        
        // Sobel kernels for edge detection
        mat3 sobelX = mat3(
          -1.0, 0.0, 1.0,
          -2.0, 0.0, 2.0,
          -1.0, 0.0, 1.0
        );
        
        mat3 sobelY = mat3(
          -1.0, -2.0, -1.0,
           0.0,  0.0,  0.0,
           1.0,  2.0,  1.0
        );
        
        void main() {
          vec2 texelSize = 1.0 / uResolution;
          
          // Sample the 3x3 neighborhood
          float tl = length(texture2D(uVideoTexture, vUv + vec2(-texelSize.x, -texelSize.y)).rgb);
          float tm = length(texture2D(uVideoTexture, vUv + vec2(0.0, -texelSize.y)).rgb);
          float tr = length(texture2D(uVideoTexture, vUv + vec2(texelSize.x, -texelSize.y)).rgb);
          
          float ml = length(texture2D(uVideoTexture, vUv + vec2(-texelSize.x, 0.0)).rgb);
          float mm = length(texture2D(uVideoTexture, vUv).rgb);
          float mr = length(texture2D(uVideoTexture, vUv + vec2(texelSize.x, 0.0)).rgb);
          
          float bl = length(texture2D(uVideoTexture, vUv + vec2(-texelSize.x, texelSize.y)).rgb);
          float bm = length(texture2D(uVideoTexture, vUv + vec2(0.0, texelSize.y)).rgb);
          float br = length(texture2D(uVideoTexture, vUv + vec2(texelSize.x, texelSize.y)).rgb);
          
          // Apply Sobel operator
          float gx = (tl * sobelX[0][0]) + (tm * sobelX[0][1]) + (tr * sobelX[0][2]) +
                     (ml * sobelX[1][0]) + (mm * sobelX[1][1]) + (mr * sobelX[1][2]) +
                     (bl * sobelX[2][0]) + (bm * sobelX[2][1]) + (br * sobelX[2][2]);
          
          float gy = (tl * sobelY[0][0]) + (tm * sobelY[0][1]) + (tr * sobelY[0][2]) +
                     (ml * sobelY[1][0]) + (mm * sobelY[1][1]) + (mr * sobelY[1][2]) +
                     (bl * sobelY[2][0]) + (bm * sobelY[2][1]) + (br * sobelY[2][2]);
          
          // Calculate edge magnitude
          float edgeMagnitude = sqrt(gx * gx + gy * gy);
          
          // Output edge strength as grayscale
          // Also encode horizontal vs vertical edge info in different channels
          gl_FragColor = vec4(
            edgeMagnitude,           // Red: overall edge strength
            abs(gx),                 // Green: horizontal edges (vertical lines)
            abs(gy),                 // Blue: vertical edges (horizontal lines)
            1.0
          );
        }
      `;

      return { vertexShader, fragmentShader };
    }, []);

    // Initialize edge detection WebGL components
    const initializeEdgeDetection = useCallback(() => {
      if (!videoElement || edgeDetectionSceneRef.current) return false;

      try {
        // Create offscreen canvas for edge detection
        const canvas = document.createElement('canvas');
        canvas.width = 320; // Reduced resolution for performance
        canvas.height = 240;
        edgeDetectionCanvasRef.current = canvas;

        // Create WebGL renderer
        const renderer = new THREE.WebGLRenderer({
          canvas: canvas,
          alpha: false,
          antialias: false,
          powerPreference: 'high-performance'
        });
        renderer.setSize(320, 240);
        webglRendererRef.current = renderer;

        // Create scene and camera
        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        edgeDetectionSceneRef.current = scene;
        edgeDetectionCameraRef.current = camera;

        // Create video texture
        const videoTexture = new THREE.VideoTexture(videoElement);
        videoTexture.minFilter = THREE.LinearFilter;
        videoTexture.magFilter = THREE.LinearFilter;
        videoTexture.format = THREE.RGBFormat;
        videoTextureRef.current = videoTexture;

        // Create shader material
        const { vertexShader, fragmentShader } = createEdgeDetectionShader();
        const material = new THREE.ShaderMaterial({
          vertexShader,
          fragmentShader,
          uniforms: {
            uVideoTexture: { value: videoTexture },
            uResolution: { value: new THREE.Vector2(videoElement.videoWidth, videoElement.videoHeight) }
          }
        });

        // Create full-screen quad
        const geometry = new THREE.PlaneGeometry(2, 2);
        const mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);

        console.log('✅ Edge detection WebGL initialized');
        return true;
      } catch (error) {
        console.error('❌ Failed to initialize edge detection:', error);
        setEdgeDetectionStatus(prev => ({ ...prev, error: `Init failed: ${error}` }));
        return false;
      }
    }, [videoElement, createEdgeDetectionShader]);

    // Process edge detection
    const processEdgeDetection = useCallback((): {
      edgeCount: number;
      horizontalEdgeRatio: number;
      groundLineDetected: boolean;
      edgeStrength: number;
      processingTime: number;
    } => {
      const startTime = performance.now();

      if (!webglRendererRef.current || 
          !edgeDetectionSceneRef.current || 
          !edgeDetectionCameraRef.current ||
          !videoTextureRef.current ||
          !edgeDetectionCanvasRef.current) {
        return {
          edgeCount: 0,
          horizontalEdgeRatio: 0,
          groundLineDetected: false,
          edgeStrength: 0,
          processingTime: 0
        };
      }

      try {
        // Update video texture
        videoTextureRef.current.needsUpdate = true;

        // Render edge detection
        webglRendererRef.current.render(edgeDetectionSceneRef.current, edgeDetectionCameraRef.current);

        // Read pixels from rendered result
        const canvas = edgeDetectionCanvasRef.current;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Could not get 2D context');

        // Get image data from WebGL canvas
        const gl = webglRendererRef.current.getContext();
        const pixels = new Uint8Array(canvas.width * canvas.height * 4);
        gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

        // Analyze the edge data
        let totalEdgeStrength = 0;
        let horizontalEdges = 0;
        let verticalEdges = 0;
        let strongEdgeCount = 0;

        // Focus on bottom 30% of image (likely ground area)
        const groundRegionStart = Math.floor(canvas.height * 0.7);
        
        for (let y = groundRegionStart; y < canvas.height; y++) {
          for (let x = 0; x < canvas.width; x++) {
            const idx = (y * canvas.width + x) * 4;
            const edgeMagnitude = pixels[idx] / 255.0;     // Red channel
            const horizontalEdge = pixels[idx + 1] / 255.0; // Green channel  
            const verticalEdge = pixels[idx + 2] / 255.0;   // Blue channel

            totalEdgeStrength += edgeMagnitude;

            if (edgeMagnitude > 0.3) { // Strong edge threshold
              strongEdgeCount++;
              
              if (horizontalEdge > verticalEdge) {
                horizontalEdges++;
              } else {
                verticalEdges++;
              }
            }
          }
        }

        const totalPixelsInGroundRegion = canvas.width * (canvas.height - groundRegionStart);
        const averageEdgeStrength = totalEdgeStrength / totalPixelsInGroundRegion;
        const horizontalEdgeRatio = horizontalEdges / Math.max(1, horizontalEdges + verticalEdges);

        // Ground line detection heuristic:
        // Look for strong horizontal edges in the lower portion of the image
        const groundLineDetected = horizontalEdgeRatio > 0.6 && strongEdgeCount > 20;

        const processingTime = performance.now() - startTime;

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

    // Enhanced detection algorithm combining orientation + edge detection
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
            cvSuccess: false,
            edgeDetectionEnabled
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
      
      // Basic orientation-based distance calculation
      let orientationDistance = 1.7; // Default fallback
      let orientationConfidence = 0.3;
      
      if (Math.abs(betaDegrees) > 15) { // 15° threshold
        const angleToGroundDegrees = Math.abs(betaDegrees);
        const angleToGroundRadians = Math.abs(beta);
        
        // Use cotangent method for distance calculation
        const altDistance3 = 1.7 / Math.tan(angleToGroundRadians);
        orientationDistance = Math.max(0.3, Math.min(3.0, altDistance3));
        orientationConfidence = Math.min(Math.abs(beta) / (Math.PI / 2), 0.9);
      }

    // Enhanced computer vision analysis with REAL edge detection
    let cvAnalysis: {
      cvSuccess: boolean;
      cvStep: string;
      cvError?: string;
      cvConfidence: string;
      cvColor: string;
      cvEdges: string;
      edgeDetectionEnabled: boolean;
      edgeCount: number;
      processingTime: number;
      groundLineDetected: boolean;
      edgeStrength: number;
      horizontalEdgeRatio: number;
    } = {
      cvSuccess: false,
      cvStep: 'cv_analysis',
      cvError: 'edge_detection_disabled',
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

      if (edgeDetectionEnabled && cameraInfo.videoReady && video.videoWidth > 0) {
        try {
          setEdgeDetectionStatus(prev => ({ ...prev, processing: true }));

          // Initialize edge detection if needed
          if (!edgeDetectionSceneRef.current) {
            initializeEdgeDetection();
          }

          // Process edge detection
          const edgeResults = processEdgeDetection();
          
          cvAnalysis = {
            cvSuccess: edgeResults.edgeCount > 0,
            cvStep: 'real_edge_detection',
            cvError: undefined,
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

          // Combine orientation and edge detection for better accuracy
          if (edgeResults.groundLineDetected) {
            // Edge detection found a likely ground line - increase confidence
            finalConfidence = Math.min(orientationConfidence + 0.3, 0.95);
            detectionMethod = 'orientation + edge detection';
            
            // Optionally adjust distance based on edge detection
            // For now, trust orientation but boost confidence
          }

          // Update edge detection status
          setEdgeDetectionStatus(prev => ({
            ...prev,
            processing: false,
            lastProcessTime: edgeResults.processingTime,
            edgeCount: edgeResults.edgeCount,
            groundConfidence: edgeResults.groundLineDetected ? 0.8 : 0.4
          }));

        } catch (error) {
          console.error('❌ Edge detection failed:', error);
          cvAnalysis.cvError = `Edge detection failed: ${error}`;
          setEdgeDetectionStatus(prev => ({ 
            ...prev, 
            processing: false, 
            error: `Processing failed: ${error}` 
          }));
        }
      }
      
      const result: GroundPlaneResult = {
        detected: true,
        distance: finalDistance,
        normal: gravity.clone().negate(), // Ground normal points up
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
    }, [checkCameraReadiness, edgeDetectionEnabled, initializeEdgeDetection, processEdgeDetection]);

    // Visualization functions (unchanged)
    const addGroundPlaneMarker = useCallback((groundPlane: GroundPlaneResult) => {
      if (!scene) return;
      
      // Remove existing marker
      removeGroundPlaneMarker();
      
      // Create ground plane visualization
      const geometry = new THREE.PlaneGeometry(10, 10);
      const material = new THREE.MeshBasicMaterial({
        color: groundPlane.confidence > 0.7 ? 0x00ff00 : 0xff6600,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide
      });
      
      const groundMesh = new THREE.Mesh(geometry, material);
      
      // Position the ground plane WITH MANUAL OFFSET
      const calculatedGroundY = -groundPlane.distance;
      const finalGroundY = calculatedGroundY + manualGroundOffset;
      
      groundMesh.position.set(0, finalGroundY, 0);
      groundMesh.rotation.x = -Math.PI / 2;
      
      // Add grid lines
      const gridHelper = new THREE.GridHelper(10, 20, 0xffffff, 0xffffff);
      gridHelper.position.set(0, finalGroundY + 0.01, 0);
      gridHelper.material.transparent = true;
      gridHelper.material.opacity = 0.5;
      
      // Group them together
      const groundGroup = new THREE.Group();
      groundGroup.add(groundMesh);
      groundGroup.add(gridHelper);
      
      scene.add(groundGroup);
      groundPlaneMarkerRef.current = groundGroup;
      
      console.log('🌍 Enhanced ground plane marker at Y =', finalGroundY, 
        '(method:', groundPlane.method, ')');
    }, [scene, manualGroundOffset]);

    const removeGroundPlaneMarker = useCallback(() => {
      if (groundPlaneMarkerRef.current && scene) {
        scene.remove(groundPlaneMarkerRef.current);
        
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
            cvSuccess: false,
            edgeDetectionEnabled
          }
        };
        
        setLastDetectionResult(errorResult);
        return errorResult;
      }
    }, [videoElement, deviceOrientation, detectGroundPlane, onGroundPlaneDetected, isTestMode, addGroundPlaneMarker]);

    // Manual offset adjustment
    const adjustGroundOffsetInternal = useCallback((deltaOffset: number) => {
      console.log('🌍 GroundPlaneDetector: adjustGroundOffset called with:', deltaOffset);
      
      setManualGroundOffset(prevOffset => {
        const newOffset = prevOffset + deltaOffset;
        console.log('🌍 Setting new offset:', newOffset);
        
        setTimeout(() => {
          if (lastDetectionResult && isTestMode) {
            addGroundPlaneMarker(lastDetectionResult);
          }
        }, 50);
        
        return newOffset;
      });
    }, [lastDetectionResult, isTestMode, addGroundPlaneMarker]);

    // NEW: Edge detection control functions
    const toggleEdgeDetection = useCallback((enabled: boolean) => {
      setEdgeDetectionEnabled(enabled);
      setEdgeDetectionStatus(prev => ({
        ...prev,
        enabled,
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
        console.log('🌍 Setting manual ground offset to:', offset);
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
      // NEW: Edge detection methods
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
        console.log('🌍 Starting enhanced auto-detection with edge detection:', edgeDetectionEnabled);
        const interval = setInterval(() => {
          runDetection();
        }, 1000); // Update every second
        
        return () => {
          console.log('🌍 Stopping auto-detection');
          clearInterval(interval);
        };
      } else {
        removeGroundPlaneMarker();
      }
    }, [isTestMode, runDetection, removeGroundPlaneMarker, edgeDetectionEnabled]);

    // Initialize edge detection when video becomes ready
    useEffect(() => {
      if (edgeDetectionEnabled && videoElement && videoElement.readyState >= 2) {
        initializeEdgeDetection();
      }
    }, [edgeDetectionEnabled, videoElement?.readyState, initializeEdgeDetection]);

    // Cleanup on unmount
    useEffect(() => {
      return () => {
        console.log('🌍 Enhanced GroundPlaneDetector unmounting, cleaning up');
        removeGroundPlaneMarker();
        
        // Cleanup edge detection resources
        if (webglRendererRef.current) {
          webglRendererRef.current.dispose();
        }
        if (videoTextureRef.current) {
          videoTextureRef.current.dispose();
        }
        if (edgeDetectionSceneRef.current) {
          edgeDetectionSceneRef.current.clear();
        }
      };
    }, [removeGroundPlaneMarker]);

    // Return null since this component doesn't render anything visible
    // It only manages Three.js scene objects and exposes methods via ref
    return null;
  }
);

// Set display name for better debugging
GroundPlaneDetector.displayName = 'EnhancedGroundPlaneDetector';

export default GroundPlaneDetector;