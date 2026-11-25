/**
 * Custom GLSL Shaders: Volumetric Airflow & Sound Wave Particles
 * Renders soft glowing sprites along oral, nasal (Al-Khaisyum), and throat (Al-Halq) paths.
 */

export const airflowParticleVertexShader = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aColor;

  varying float vAlpha;
  varying vec3 vColor;

  uniform float uPixelRatio;

  void main() {
    vAlpha = aAlpha;
    vColor = aColor;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uPixelRatio * (180.0 / max(-mvPosition.z, 0.5));
    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const airflowParticleFragmentShader = /* glsl */ `
  varying float vAlpha;
  varying vec3 vColor;

  void main() {
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);
    if (dist > 0.5) discard;

    // Soft glowing radial Gaussian falloff with bright inner core
    float soft = smoothstep(0.5, 0.05, dist);
    float core = smoothstep(0.24, 0.0, dist);

    vec3 finalColor = mix(vColor, vec3(1.0), core * 0.55);
    float finalAlpha = soft * vAlpha;

    gl_FragColor = vec4(finalColor, finalAlpha);
  }
`;
