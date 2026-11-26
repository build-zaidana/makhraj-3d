/**
 * Custom GLSL Shaders: X-Ray Fresnel Vision + Interactive Sagittal Cutaway
 * Supports optional Three.js morph targets (for facecap.glb ARKit blendshapes)
 * and renders a crisp glowing rim along the clipping slice edge.
 */

export const xrayFresnelVertexShader = /* glsl */ `
  #include <common>
  #include <morphtarget_pars_vertex>

  varying vec3 vNormalWorld;
  varying vec3 vViewDirWorld;
  varying vec3 vWorldPos;
  varying vec3 vLocalPos;

  void main() {
    #include <beginnormal_vertex>
    #include <morphnormal_vertex>
    #include <begin_vertex>
    #include <morphtarget_vertex>

    vec4 worldPosition = modelMatrix * vec4(transformed, 1.0);
    vWorldPos = worldPosition.xyz;
    vLocalPos = transformed;

    mat3 normalMatWorld = mat3(modelMatrix);
    vNormalWorld = normalize(normalMatWorld * objectNormal);
    vViewDirWorld = normalize(cameraPosition - worldPosition.xyz);

    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

export const xrayFresnelFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uRimColor;
  uniform vec3 uCutColor;
  uniform float uFresnelPower;
  uniform float uOpacity;
  uniform float uTime;
  uniform float uClipX;
  uniform float uEnableClip;
  uniform float uScanlineIntensity;
  uniform float uLightMode;

  varying vec3 vNormalWorld;
  varying vec3 vViewDirWorld;
  varying vec3 vWorldPos;
  varying vec3 vLocalPos;

  void main() {
    // Interactive Sagittal Clipping Plane (slices near +X cheek away to inspect mouth)
    if (uEnableClip > 0.5 && vWorldPos.x > uClipX) {
      discard;
    }

    vec3 N = normalize(vNormalWorld);
    if (!gl_FrontFacing) {
      N = -N;
    }
    vec3 V = normalize(vViewDirWorld);

    // Fresnel Rim Effect: edges stand out cleanly while center stays crystal clear
    float ndotv = clamp(abs(dot(N, V)), 0.0, 1.0);
    float fresnel = pow(1.0 - ndotv, uFresnelPower);

    // Subtle scanlines (primarily in dark X-Ray mode; clean frosted glass in light studio mode)
    float scan = sin(vWorldPos.y * 42.0 - uTime * 2.2) * 0.5 + 0.5;
    float scanBoost = mix(1.0, 0.85 + 0.30 * scan, uScanlineIntensity);

    // Crisp contour line along the sagittal cut edge (clearly traces lips & face profile!)
    float cutDist = abs(vWorldPos.x - uClipX);
    float cutEdge = (uEnableClip > 0.5) ? smoothstep(0.058, 0.0, cutDist) : 0.0;

    float backFaceDim = gl_FrontFacing ? 1.0 : mix(0.65, 0.82, uLightMode);

    vec3 baseCol = mix(uColor, uRimColor, fresnel) * scanBoost;
    if (uLightMode < 0.5) {
      baseCol *= backFaceDim;
    }
    baseCol = mix(baseCol, uCutColor, cutEdge * 0.90);

    float darkAlpha = (0.06 + fresnel * 0.76) * uOpacity * backFaceDim;
    float lightAlpha = (0.03 + fresnel * 0.46) * uOpacity * backFaceDim;
    float alpha = mix(darkAlpha, lightAlpha, uLightMode);
    alpha = max(alpha, cutEdge * mix(0.88, 0.72, uLightMode) * uOpacity);
    alpha = clamp(alpha, 0.0, mix(0.92, 0.78, uLightMode));

    gl_FragColor = vec4(baseCol, alpha);
  }
`;
