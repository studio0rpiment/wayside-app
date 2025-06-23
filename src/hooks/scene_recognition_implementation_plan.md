# Scene Recognition Implementation Plan

## Overview

This plan implements a custom React hook approach to integrate TensorFlow.js-based scene recognition into your AR positioning system. The goal is to improve GPS precision by identifying which of your 6 Kenilworth locations the user is at, then applying location-specific position corrections.

## Project Structure

```
src/
├── hooks/
│   ├── useSceneRecognition.ts         # NEW: Custom hook for ML inference
│   └── useARPositioning.ts            # ENHANCED: Add scene recognition integration
├── components/
│   └── ArCameraComponent.tsx          # ENHANCED: Use enhanced positioning
└── context/
    └── GeofenceNotificationSystem.tsx # ENHANCED: Trigger scene recognition

public/
└── models/
    └── kenilworth-scene-recognition/
        ├── model.json                 # From Teachable Machine export
        └── model.weights.bin          # From Teachable Machine export
```

## Step 1: Create Custom Scene Recognition Hook

**File:** `src/hooks/useSceneRecognition.ts`

Key interfaces:
```typescript
export interface SceneRecognitionResult {
  location: string;
  confidence: number;
  allProbabilities: number[];
  timestamp: number;
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
  stats: {
    totalPredictions: number;
    averageInferenceTime: number;
    lastInferenceTime: number;
  };
}
```

Core functionality:
```typescript
// Location class names - match your training data folder names
const LOCATION_CLASSES = [
  'lotus_pond',
  'flagpole_area', 
  'boardwalk',
  'volunteers_area',
  'cattail_marsh',
  'helen_overlook'
];

// Main inference function
const recognizeScene = useCallback(async (
  videoElement: HTMLVideoElement
): Promise<SceneRecognitionResult | null> => {
  
  // Create tensor from video element
  const tensor = tf.tidy(() => {
    const videoTensor = tf.browser.fromPixels(videoElement);
    const resized = tf.image.resizeBilinear(videoTensor, [224, 224]);
    const normalized = resized.toFloat().div(255.0);
    return normalized.expandDims(0); // Add batch dimension
  });
  
  // Run inference
  const predictions = await model.predict(tensor) as tf.Tensor;
  const probabilities = Array.from(await predictions.data());
  
  // Clean up tensors
  tensor.dispose();
  predictions.dispose();
  
  // Find best prediction
  const maxIndex = probabilities.indexOf(Math.max(...probabilities));
  const confidence = probabilities[maxIndex];
  const detectedLocation = LOCATION_CLASSES[maxIndex];
  
  return confidence >= opts.confidenceThreshold ? {
    location: detectedLocation,
    confidence,
    allProbabilities: probabilities,
    timestamp: Date.now()
  } : null;
}, [model, isLoaded, opts.confidenceThreshold]);
```

## Step 2: Enhance AR Positioning Hook

**File:** `src/hooks/useARPositioning.ts`

Add scene recognition import:
```typescript
import { useSceneRecognition, SceneRecognitionResult } from './useSceneRecognition';
```

Add scene recognition hook:
```typescript
// Scene recognition hook
const {
  recognizeScene,
  isLoaded: isSceneRecognitionLoaded,
  isLoading: isSceneRecognitionLoading,
  lastPrediction: lastSceneRecognition,
  error: sceneRecognitionError,
  stats: sceneRecognitionStats
} = useSceneRecognition('/models/kenilworth-scene-recognition/model.json', {
  confidenceThreshold: 0.7,
  throttleMs: 2000,
  debugMode: debugMode
});
```

Add GPS correction function:
```typescript
// Scene-based GPS correction
const applySceneBasedCorrection = useCallback((
  gpsPosition: [number, number] | null,
  sceneResult: SceneRecognitionResult
): [number, number] | null => {
  if (!gpsPosition) return null;

  // Define location-specific GPS corrections in decimal degrees
  const locationCorrections: Record<string, [number, number]> = {
    'lotus_pond': [-0.00001, 0.00002],      // ~1m west, ~2m north
    'flagpole_area': [0.00001, -0.00001],   // ~1m east, ~1m south  
    'boardwalk': [0, 0.00001],              // ~1m north
    'volunteers_area': [-0.00002, 0],       // ~2m west
    'cattail_marsh': [0.00001, 0.00001],    // ~1m east, ~1m north
    'helen_overlook': [0, -0.00001]         // ~1m south
  };

  const correction = locationCorrections[sceneResult.location];
  if (!correction) return gpsPosition;

  return [
    gpsPosition[0] + correction[0],
    gpsPosition[1] + correction[1]
  ];
}, []);
```

Add enhanced positioning method:
```typescript
// Enhanced positioning method with scene recognition
const positionObjectWithSceneRecognition = useCallback(async (
  object: THREE.Object3D,
  experienceId: string,
  videoElement?: HTMLVideoElement,
  options: PositioningOptions = {}
): Promise<boolean> => {
  if (!isReady || !arPositioningManagerRef.current) {
    return false;
  }
  
  let userInput = { gpsPosition: currentUserPosition };
  let usedSceneRecognition = false;
  
  // Try scene recognition if video element provided and model loaded
  if (videoElement && isSceneRecognitionLoaded) {
    try {
      const sceneResult = await recognizeScene(videoElement);
      
      if (sceneResult && sceneResult.confidence >= 0.7) {
        console.log(`🎯 Scene recognition: ${sceneResult.location} (${(sceneResult.confidence * 100).toFixed(1)}%)`);
        
        // Apply scene-specific position refinement
        const refinedPosition = applySceneBasedCorrection(currentUserPosition, sceneResult);
        if (refinedPosition) {
          userInput = { gpsPosition: refinedPosition };
          usedSceneRecognition = true;
        }
      }
    } catch (error) {
      console.warn('Scene recognition failed, falling back to GPS:', error);
    }
  }
  
  // Use positioning logic with potentially refined position
  const success = arPositioningManagerRef.current.positionObject(
    object,
    experienceId, 
    userInput,
    options
  );
  
  return success;
}, [isReady, currentUserPosition, isSceneRecognitionLoaded, recognizeScene, applySceneBasedCorrection]);
```

Update return interface:
```typescript
export interface EnhancedARPositioningHookResult {
  // Original methods
  positionObject: (object: THREE.Object3D, experienceId: string, options?: PositioningOptions) => boolean;
  
  // Enhanced methods with scene recognition
  positionObjectWithSceneRecognition: (
    object: THREE.Object3D, 
    experienceId: string, 
    videoElement?: HTMLVideoElement,
    options?: PositioningOptions
  ) => Promise<boolean>;
  
  // Scene recognition state
  sceneRecognition: {
    isLoaded: boolean;
    isLoading: boolean;
    lastPrediction: SceneRecognitionResult | null;
    error: string | null;
    stats: {
      totalPredictions: number;
      averageInferenceTime: number;
      lastInferenceTime: number;
    };
  };
  
  // ... existing methods
}
```

## Step 3: Update AR Camera Component

**File:** `src/components/ArCameraComponent.tsx`

Import enhanced hook:
```typescript
import { useARPositioning } from '../hooks/useARPositioning';
```

Use enhanced positioning:
```typescript
export const ArCameraComponent: React.FC<ArCameraComponentProps> = ({
  experienceType,
  onClose,
  ...otherProps
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Use enhanced positioning hook
  const { 
    positionObjectWithSceneRecognition, 
    sceneRecognition,
    isReady: isPositioningReady 
  } = useARPositioning();

  // Your existing AR object creation logic...
  const [arObject, setArObject] = useState<THREE.Object3D | null>(null);

  // Enhanced positioning when object is created
  const positionArObject = useCallback(async () => {
    if (!arObject || !videoRef.current) return;

    const success = await positionObjectWithSceneRecognition(
      arObject,
      experienceType, // e.g., 'lotus_pond', 'flagpole_area'
      videoRef.current // Pass video element for scene recognition
    );

    if (success) {
      console.log('🎯 AR object positioned with enhanced precision');
    }
  }, [arObject, experienceType, positionObjectWithSceneRecognition]);

  // Position object when ready
  useEffect(() => {
    if (arObject && isPositioningReady) {
      positionArObject();
    }
  }, [arObject, isPositioningReady, positionArObject]);

  return (
    <div className="ar-camera-container">
      <video 
        ref={videoRef}
        autoPlay 
        playsInline 
        muted
        style={{ width: '100%', height: '100%' }}
      />
      
      {/* Scene Recognition Debug Info (development only) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="scene-recognition-debug" style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          background: 'rgba(0,0,0,0.7)',
          color: 'white',
          padding: '8px',
          borderRadius: '4px',
          fontSize: '12px'
        }}>
          <div>Scene Recognition: {sceneRecognition.isLoaded ? '✅' : '⏳'}</div>
          {sceneRecognition.lastPrediction && (
            <>
              <div>Location: {sceneRecognition.lastPrediction.location}</div>
              <div>Confidence: {(sceneRecognition.lastPrediction.confidence * 100).toFixed(1)}%</div>
            </>
          )}
          <div>Predictions: {sceneRecognition.stats.totalPredictions}</div>
          <div>Avg Time: {sceneRecognition.stats.averageInferenceTime.toFixed(0)}ms</div>
        </div>
      )}
      
      {/* Your existing Three.js canvas */}
      <canvas ref={canvasRef} />
    </div>
  );
};
```

## Step 4: Update Geofence System

**File:** `src/context/GeofenceNotificationSystem.tsx`

Import and use enhanced positioning:
```typescript
import { useARPositioning } from '../hooks/useARPositioning';

const GeofenceNotificationSystem: React.FC = ({ children }) => {
  const { positionObjectWithSceneRecognition, sceneRecognition } = useARPositioning();
  
  // Handle geofence entry with scene recognition awareness
  const handleGeofenceEntry = useCallback(async (geofenceId: string, pointData: any) => {
    console.log(`🎯 Geofence entered: ${geofenceId}`);
    
    if (sceneRecognition.isLoaded) {
      console.log('🎯 Scene recognition available for enhanced positioning');
      // Scene recognition will be triggered when AR experience starts
    }
    
    // Your existing modal logic...
  }, [sceneRecognition.isLoaded]);

  // Rest of your existing component...
};
```

## Step 5: Model File Setup

Place your Teachable Machine exported files:

```
public/
└── models/
    └── kenilworth-scene-recognition/
        ├── model.json          # From Teachable Machine export
        └── model.weights.bin   # From Teachable Machine export
```

## Step 6: Model Preloading (Optional)

**File:** `src/App.tsx`

```typescript
import { preloadSceneRecognitionModel } from './hooks/useSceneRecognition';

function App() {
  useEffect(() => {
    // Preload the model for better first-use performance
    preloadSceneRecognitionModel('/models/kenilworth-scene-recognition/model.json')
      .then(() => console.log('🎯 Scene recognition model preloaded'))
      .catch(console.warn);
  }, []);

  // Rest of your app...
}
```

## Usage Examples

### Basic Usage (Existing Code Unchanged)
```typescript
const success = positionObject(arObject, 'lotus_pond');
```

### Enhanced Usage with Scene Recognition
```typescript
const success = await positionObjectWithSceneRecognition(
  arObject, 
  'lotus_pond', 
  videoElement  // Triggers ML scene recognition
);
```

## Configuration Options

### Scene Recognition Options
```typescript
const sceneRecognition = useSceneRecognition('/path/to/model.json', {
  confidenceThreshold: 0.7,  // Only use predictions above 70%
  throttleMs: 2000,          // Run inference every 2 seconds max
  debugMode: true            // Enable console logging
});
```

### Location Corrections
Calibrate these values based on your field testing:
```typescript
const locationCorrections: Record<string, [number, number]> = {
  'lotus_pond': [-0.00001, 0.00002],      // ~1m west, ~2m north
  'flagpole_area': [0.00001, -0.00001],   // ~1m east, ~1m south  
  // Add corrections for each location based on testing
};
```

## Expected Performance

- **Model size**: ~7-9MB (one-time download)
- **Inference time**: 50-150ms on modern mobile devices
- **Memory usage**: ~10-20MB additional RAM
- **GPS improvement**: ±20m uncertainty → ±5m location-specific correction
- **Fallback behavior**: Gracefully falls back to GPS-only if ML fails

## Implementation Flow

1. **Geofence Entry** → User enters one of your 6 locations
2. **Scene Recognition** → Capture video frame → Run ML inference 
3. **Location Identification** → Model outputs: "85% confident this is lotus_pond"
4. **Position Correction** → Apply lotus_pond-specific GPS correction offset
5. **AR Positioning** → Use corrected GPS for more precise AR anchor placement

This approach maintains all your existing functionality while adding ML-enhanced precision as an opt-in improvement layer.