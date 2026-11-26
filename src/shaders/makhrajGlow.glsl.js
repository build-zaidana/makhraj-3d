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
  uniform float uLightMode;

  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying vec2 vUv;
  varying vec3 vLocalPos;

  void main() {
    float ndotv = clamp(abs(dot(normalize(vNormal), normalize(vViewDir))), 0.0, 1.0);
    float fresnel = pow(1.0 - ndotv, 1.8);
    float core = pow(ndotv, 2.2);

    float pulse = 0.72 + 0.28 * sin(uTime * 4.5);
    float audioBoost = 1.0 + uAudioLevel * 0.95;
    float ring = 0.5 + 0.5 * sin(length(vLocalPos) * 28.0 - uTime * 6.0);

    vec3 darkCol = uColor * (1.15 + 0.55 * core + 0.35 * ring) * audioBoost;
    vec3 lightCol = uColor * (0.95 + 0.15 * ring);
    vec3 color = mix(darkCol, lightCol, uLightMode);

    float darkAlpha = (core * 0.55 + fresnel * 0.85) * pulse * uIntensity;
    float lightAlpha = (core * 0.22 + fresnel * 0.42) * pulse * uIntensity;
    float alpha = mix(darkAlpha, lightAlpha, uLightMode);

    gl_FragColor = vec4(color, clamp(alpha, 0.0, mix(0.95, 0.55, uLightMode)));
  }
`;
