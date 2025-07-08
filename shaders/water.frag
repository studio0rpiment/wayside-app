uniform float opacity;
uniform vec3 baseColor;

varying vec3 vColor;

void main() {
    float distanceToCenter = distance(gl_PointCoord, vec2(0.5));
    if (distanceToCenter > 0.5) discard;
    
    // TEST: Use pure baseColor, ignore everything else
    vec3 finalColor = baseColor;
    
    float alpha = (1.0 - distanceToCenter * 2.0) * opacity;
    
    gl_FragColor = vec4(finalColor, alpha);
}