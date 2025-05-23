import React from 'react';
import * as THREE from 'three';
import SingleModelExperience from './SingleModelExperience.tsx';

const SHOW_DEBUG_PANEL = true;


interface BC2200ExperienceProps {
  onClose: () => void;
  onNext?: () => void;
  arPosition?: THREE.Vector3;
  arScene?: THREE.Scene;
  arCamera?: THREE.PerspectiveCamera;
  coordinateScale?: number;
  onModelRotate?: (handler: (deltaX: number, deltaY: number) => void) => void;
  onModelScale?: (handler: (scaleFactor: number) => void) => void;
  onModelReset?: (handler: () => void) => void;
  onSwipeUp?: (handler: () => void) => void;
  onSwipeDown?: (handler: () => void) => void;
}

const BC2200Experience: React.FC<BC2200ExperienceProps> = (props) => (
  <SingleModelExperience
    {...props}
    modelPath="models/2200BC_Model.glb"
    experienceName="2200 BC Settlement"
    instructions="Explore the ancient settlement from 2200 BC. Tap continue when ready."
  />
);

export default BC2200Experience;