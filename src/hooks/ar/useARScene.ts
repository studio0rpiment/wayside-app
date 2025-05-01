// src/hooks/ar/useARScene.ts
// Keep your existing hook implementation but add a parameter to accept a container element

import { useEffect, useRef, useState, RefObject } from "react";

// Define the return type for the hook
interface UseARSceneResult {
  sceneRef: RefObject<HTMLDivElement | null>;
  isInitialized: boolean;
  error: string | null;
}

// Define the props type for the hook
interface UseARSceneProps {
  markerId: string;
  onMarkerFound: () => void;
  onMarkerLost: () => void;
  patternUrl: string;
  debugMode?: boolean;
  container?: HTMLElement | null; // Type for the container element
}

export function useARScene({
  markerId,
  onMarkerFound,
  onMarkerLost,
  patternUrl,
  debugMode = false,
  container = null, // New parameter to accept container from Portal
}: UseARSceneProps): UseARSceneResult {
  const sceneRef = useRef<HTMLDivElement | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If container is provided, use that instead of sceneRef
    const targetElement = container || sceneRef.current;
    if (!targetElement) return;

    // Rest of your existing implementation...
  }, [markerId, patternUrl, debugMode, onMarkerFound, onMarkerLost, container]);

  return { sceneRef, isInitialized, error };
}