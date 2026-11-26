/**
 * Custom GLSL Shaders: Fine-Mist Aerodynamic Airflow & Acoustic Streamlines
 * Renders silky, subtle, clinical-grade micro-particles (never chunky cotton balls).
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
    gl_PointSize = aSize * uPixelRatio * (105.0 / max(-mvPosition.z, 0.5));
    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const airflowParticleFragmentShader = /* glsl */ `
  uniform float uCoreWhite;

  varying float vAlpha;
  varying vec3 vColor;

  void main() {
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);
    if (dist > 0.5) discard;

    // Ultra-silky exponential Gaussian mist profile
    float mist = exp(-dist * dist * 16.0);
    float core = smoothstep(0.22, 0.0, dist);

    vec3 finalColor = mix(vColor, vec3(1.0), core * uCoreWhite);
    float finalAlpha = mist * vAlpha;

    gl_FragColor = vec4(finalColor, finalAlpha);
  }
`;
