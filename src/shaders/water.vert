uniform float time;
uniform float sizeMultiplier;

attribute float size;

varying vec3 vColor;

void main() {
    vColor = color;
    
    vec3 pos = position;
    
    // Base wave animation (your existing waves)
    float waveHeight = sin(pos.x * 0.1 + time * 2.0) * cos(pos.z * 0.1 + time * 2.0) * 0.1;
    
    // ✅ NEW: Add gentle eddies and turbulence
    
    // Create circular eddies at different scales
    float eddy1 = sin(length(pos.xz - vec2(10.0, 15.0)) * 0.3 - time * 0.8) * 0.05;
    float eddy2 = sin(length(pos.xz - vec2(-20.0, -10.0)) * 0.4 - time * 0.6) * 0.015;
    float eddy3 = sin(length(pos.xz - vec2(25.0, -25.0)) * 0.2 - time * 1.2) * 0.025;
    
    // Add small-scale turbulence
    float turbulence = sin(pos.x * 0.8 + time * 1.5) * cos(pos.z * 0.7 + time * 1.8) * 0.012;
    float microTurbulence = sin(pos.x * 2.0 + time * 3.0) * sin(pos.z * 1.8 + time * 2.5) * 0.004;
    
    // Combine all motions
    pos.y += waveHeight + eddy1 + eddy2 + eddy3 + turbulence + microTurbulence;
    
    // ✅ Optional: Add very subtle horizontal drift (like gentle current)
    float currentDrift = sin(time * 0.3) * 0.01;
    pos.x += currentDrift;
    pos.z += cos(time * 0.4) * 0.008;
    
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = size * sizeMultiplier * (300.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
}