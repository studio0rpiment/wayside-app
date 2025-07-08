uniform float time;
uniform float sizeMultiplier;
uniform vec3 windDirection;
uniform float windSpeed;
uniform float turbulenceStrength;

attribute float isActive;
attribute float startTime;
attribute float lifetime;
attribute vec3 velocity;
attribute float size;
attribute float windFactor;
attribute float colorSeed;

varying float vNormalizedAge;
varying float vAge;           // NEW
varying float vColorSeed;     // NEW  
varying float vFadeOpacity;   // NEW

void main() {
  if (isActive < 0.5) {
    gl_Position = vec4(0.0, 0.0, 10000.0, 1.0);
    gl_PointSize = 0.0;
    vNormalizedAge = 0.0;
    vAge = 0.0;           // NEW
    vColorSeed = 0.0;     // NEW
    vFadeOpacity = 0.0;   // NEW
    return;
  }
  
  float particleAge = time - startTime;
  float normalizedAge = particleAge / lifetime;
  
  if (normalizedAge < -0.01 || normalizedAge > 1.01) {
    gl_Position = vec4(0.0, 0.0, 10000.0, 1.0);
    gl_PointSize = 0.0;
    vNormalizedAge = 0.0;
    vAge = 0.0;
    vColorSeed = 0.0;
    vFadeOpacity = 0.0;
    return;
  }
  
  normalizedAge = clamp(normalizedAge, 0.0, 1.0);
  
  // NEW: Set all varyings
  vNormalizedAge = normalizedAge;
  vAge = particleAge;
  vColorSeed = colorSeed;
  vFadeOpacity = sin(normalizedAge * 3.14159);
  
  // Movement + wind
  vec3 pos = position + velocity * particleAge * 0.2;
  pos += windDirection * windSpeed * particleAge * windFactor;
  
  // NEW: Add expansion effect
  float expansionFactor = normalizedAge * 0.6;
  pos.xz *= (1.0 + expansionFactor);
  
  // Add turbulence
  float turbulence = sin(pos.x * 0.1 + time) * cos(pos.z * 0.1 + time * 0.7);
  pos.x += turbulence * turbulenceStrength * normalizedAge;
  pos.z += turbulence * turbulenceStrength * normalizedAge * 0.5;
  
  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  
  // NEW: More sophisticated size calculation
  float baseSize = size * sizeMultiplier;
  float sizeScale = sin(normalizedAge * 3.14159) + 0.5;
  float distanceScale = 300.0 / max(-mvPosition.z, 1.0);
  gl_PointSize = max(baseSize * sizeScale * distanceScale, 5.0);
}