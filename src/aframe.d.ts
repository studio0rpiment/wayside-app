// src/types/aframe-minimal.d.ts

// This declares all a-* elements as valid JSX elements
declare namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }