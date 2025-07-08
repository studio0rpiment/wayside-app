uniform vec3 baseColor;
uniform float opacity;
uniform float colorVariation;

varying float vAge;
varying float vNormalizedAge;
varying float vColorSeed;
varying float vFadeOpacity;

void main() {
  vec2 center = gl_PointCoord - 0.5;
  float dist = length(center);
  
  if (dist > 0.5) {
    discard;
  }
  
  // Use color variation like the original
  vec3 smokeColor = mix(vec3(0.4, 0.4, 0.4), baseColor, vColorSeed * 0.7);
  
  // Use the pre-calculated fade opacity
  float centerFade = 1.0 - (dist * 2.0);
  float finalAlpha = vFadeOpacity * centerFade * opacity;
  
  gl_FragColor = vec4(smokeColor, finalAlpha);
}