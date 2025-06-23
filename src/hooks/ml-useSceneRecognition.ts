// src/hooks/useSceneRecognition.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl'; // Use WebGL backend for better mobile performance

export interface SceneRecognitionResult {
  location: string;
  confidence: number;
  allProbabilities: number[];
  timestamp: number;
}

export interface SceneRecognitionOptions {
  confidenceThreshold?: number;
  throttleMs?: number;
  debugMode?: boolean;
}

export interface UseSceneRecognitionReturn {
  recognizeScene: (videoElement: HTMLVideoElement) => Promise<SceneRecognitionResult | null>;
  isLoaded: boolean;
  isLoading: boolean;
  error: string | null;
  lastPrediction: SceneRecognitionResult | null;
  modelInfo: {
    inputShape: number[] | null;
    outputClasses: string[];
  };
  // Performance monitoring
  stats: {
    totalPredictions: number;
    averageInferenceTime: number;
    lastInferenceTime: number;
  };
}

const DEFAULT_OPTIONS: Required<SceneRecognitionOptions> = {
  confidenceThreshold: 0.7,
  throttleMs: 2000, // Only run inference every 2 seconds
  debugMode: false
};

// Location class names - should match your training data folder names
const LOCATION_CLASSES = [
  'lotus_pond',
  'flagpole_area', 
  'boardwalk',
  'volunteers_area',
  'cattail_marsh',
  'helen_overlook'
];

/**
 * Custom hook for scene recognition using TensorFlow.js
 * Integrates with Teachable Machine exported models
 */
export function useSceneRecognition(
  modelPath: string = '/models/kenilworth-scene-recognition/model.json',
  options: SceneRecognitionOptions = {}
): UseSceneRecognitionReturn {
  
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  // State
  const [model, setModel] = useState<tf.LayersModel | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastPrediction, setLastPrediction] = useState<SceneRecognitionResult | null>(null);
  
  // Performance tracking
  const [stats, setStats] = useState({
    totalPredictions: 0,
    averageInferenceTime: 0,
    lastInferenceTime: 0
  });
  
  // Refs for throttling
  const lastPredictionTime = useRef<number>(0);
  const inferenceTimesRef = useRef<number[]>([]);
  
  // Debug logging
  const debugLog = useCallback((message: string, data?: any) => {
    if (opts.debugMode) {
      console.log(`🎯 SceneRecognition: ${message}`, data || '');
    }
  }, [opts.debugMode]);
  
  // Load the model on mount
  useEffect(() => {
    let isMounted = true;
    
    const loadModel = async () => {
      setIsLoading(true);
      setError(null);
      debugLog('Loading scene recognition model...', { modelPath });
      
      try {
        // Ensure TensorFlow.js is ready
        await tf.ready();
        debugLog('TensorFlow.js backend ready', { backend: tf.getBackend() });
        
        // Load the model
        const loadedModel = await tf.loadLayersModel(modelPath);
        
        if (!isMounted) return;
        
        setModel(loadedModel);
        setIsLoaded(true);
        debugLog('Model loaded successfully', {
          inputShape: loadedModel.inputs[0].shape,
          outputShape: loadedModel.outputs[0].shape
        });
        
      } catch (err) {
        if (!isMounted) return;
        
        const errorMessage = `Failed to load scene recognition model: ${err}`;
        setError(errorMessage);
        console.error('❌ Scene Recognition Error:', err);
        debugLog('Model loading failed', err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };
    
    loadModel();
    
    // Cleanup function
    return () => {
      isMounted = false;
      if (model) {
        debugLog('Disposing model on unmount');
        model.dispose();
      }
    };
  }, [modelPath, debugLog]); // Note: model not in deps to avoid reload loop
  
  // Main scene recognition function
  const recognizeScene = useCallback(async (
    videoElement: HTMLVideoElement
  ): Promise<SceneRecognitionResult | null> => {
    
    // Early returns for various conditions
    if (!model || !isLoaded) {
      debugLog('Model not ready for inference');
      return null;
    }
    
    if (!videoElement || videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
      debugLog('Invalid video element provided');
      return null;
    }
    
    // Throttling check
    const now = Date.now();
    if (now - lastPredictionTime.current < opts.throttleMs) {
      debugLog('Throttling: too soon since last prediction');
      return lastPrediction; // Return cached result
    }
    
    try {
      const startTime = performance.now();
      
      // Capture and preprocess frame
      debugLog('Processing video frame', {
        videoWidth: videoElement.videoWidth,
        videoHeight: videoElement.videoHeight
      });
      
      // Create tensor from video element
      const tensor = tf.tidy(() => {
        // Capture frame from video
        const videoTensor = tf.browser.fromPixels(videoElement);
        
        // Resize to model input size (Teachable Machine uses 224x224)
        const resized = tf.image.resizeBilinear(videoTensor, [224, 224]);
        
        // Normalize to [0,1] range (Teachable Machine format)
        const normalized = resized.toFloat().div(255.0);
        
        // Add batch dimension [1, 224, 224, 3]
        return normalized.expandDims(0);
      });
      
      debugLog('Tensor created', { shape: tensor.shape });
      
      // Run inference
      const predictions = await model.predict(tensor) as tf.Tensor;
      const probabilities = Array.from(await predictions.data());
      
      // Clean up tensors immediately
      tensor.dispose();
      predictions.dispose();
      
      // Calculate inference time
      const inferenceTime = performance.now() - startTime;
      inferenceTimesRef.current.push(inferenceTime);
      
      // Keep only last 10 inference times for rolling average
      if (inferenceTimesRef.current.length > 10) {
        inferenceTimesRef.current.shift();
      }
      
      // Find best prediction
      const maxIndex = probabilities.indexOf(Math.max(...probabilities));
      const confidence = probabilities[maxIndex];
      const detectedLocation = LOCATION_CLASSES[maxIndex] || 'unknown';
      
      // Create result
      const result: SceneRecognitionResult = {
        location: detectedLocation,
        confidence,
        allProbabilities: probabilities,
        timestamp: now
      };
      
      // Update state
      setLastPrediction(result);
      lastPredictionTime.current = now;
      
      // Update stats
      setStats(prev => ({
        totalPredictions: prev.totalPredictions + 1,
        lastInferenceTime: inferenceTime,
        averageInferenceTime: 
          inferenceTimesRef.current.reduce((a, b) => a + b, 0) / inferenceTimesRef.current.length
      }));
      
      debugLog('Scene recognition complete', {
        location: detectedLocation,
        confidence: `${(confidence * 100).toFixed(1)}%`,
        inferenceTime: `${inferenceTime.toFixed(1)}ms`,
        allProbabilities: probabilities.map((p, i) => 
          `${LOCATION_CLASSES[i]}: ${(p * 100).toFixed(1)}%`
        )
      });
      
      // Only return result if confidence meets threshold
      return confidence >= opts.confidenceThreshold ? result : null;
      
    } catch (err) {
      console.error('Scene recognition inference error:', err);
      debugLog('Inference error', err);
      return null;
    }
  }, [model, isLoaded, opts.confidenceThreshold, opts.throttleMs, lastPrediction, debugLog]);
  
  // Model info for debugging
  const modelInfo = {
    inputShape: model ? model.inputs[0].shape : null,
    outputClasses: LOCATION_CLASSES
  };
  
  return {
    recognizeScene,
    isLoaded,
    isLoading,
    error,
    lastPrediction,
    modelInfo,
    stats
  };
}

/**
 * Utility function to preload the scene recognition model
 * Call this early in your app lifecycle to improve first-use performance
 */
export async function preloadSceneRecognitionModel(
  modelPath: string = '/models/kenilworth-scene-recognition/model.json'
): Promise<void> {
  try {
    await tf.ready();
    const model = await tf.loadLayersModel(modelPath);
    console.log('🎯 Scene recognition model preloaded successfully');
    // Don't dispose - let the hook manage the model lifecycle
  } catch (error) {
    console.warn('⚠️ Failed to preload scene recognition model:', error);
  }
}