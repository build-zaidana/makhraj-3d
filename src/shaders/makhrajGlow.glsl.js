/**
 * Custom GLSL Shaders: Makhraj Contact Zone Beacon & Pulsing Halo
 * Highlights the active articulation point (Makhraj) with concentric pulse waves
 * and reacts to real-time audio amplitude.
 */

export const makhrajGlowVertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying vec2 vUv;
  varying vec3 vLocalPos;

  void main() {
    vUv = uv;
    vLocalPos = position;
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vViewDir = normalize(-mvPos.xyz);
    gl_Position = projectionMatrix * mvPos;
  }
`;

export const makhrajGlowFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uIntensity;
  uniform float uAudioLevel;

  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying vec2 vUv;
  varying vec3 vLocalPos;

  void main() {
    float ndotv = clamp(abs(dot(normalize(vNormal), normalize(vViewDir))), 0.0, 1.0);
    float fresnel = pow(1.0 - ndotv, 1.8);
    float core = pow(ndotv, 2.2);

    // Rhythmic educational pulse + live voice amplitude boost
    float pulse = 0.72 + 0.28 * sin(uTime * 4.5);
    float audioBoost = 1.0 + uAudioLevel * 1.1;

    // Traveling surface shimmer
    float ring = 0.5 + 0.5 * sin(length(vLocalPos) * 28.0 - uTime * 6.0);

    vec3 color = uColor * (1.15 + 0.55 * core + 0.35 * ring) * audioBoost;
    float alpha = (core * 0.55 + fresnel * 0.85) * pulse * uIntensity;

    gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.95));
  }
`;
