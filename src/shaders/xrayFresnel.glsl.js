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

    // Fresnel Rim Effect: edges glow bright, front-facing surface stays transparent
    float ndotv = clamp(abs(dot(N, V)), 0.0, 1.0);
    float fresnel = pow(1.0 - ndotv, uFresnelPower);

    // Subtle futuristic medical/educational horizontal scanlines
    float scan = sin(vWorldPos.y * 42.0 - uTime * 2.2) * 0.5 + 0.5;
    float scanBoost = mix(1.0, 0.85 + 0.30 * scan, uScanlineIntensity);

    // Soft glowing highlight right along the sagittal slice edge
    float cutDist = abs(vWorldPos.x - uClipX);
    float cutEdge = (uEnableClip > 0.5) ? smoothstep(0.065, 0.0, cutDist) : 0.0;

    // Back-face subtle interior tint (helps orient the far half of the head)
    float backFaceDim = gl_FrontFacing ? 1.0 : 0.65;

    vec3 baseCol = mix(uColor, uRimColor, fresnel) * scanBoost * backFaceDim;
    baseCol = mix(baseCol, uCutColor, cutEdge * 0.92);

    // Keep center very clear so internal tongue/teeth stay crisp, glow at silhouette & cut edge
    float alpha = (0.06 + fresnel * 0.78) * uOpacity * backFaceDim;
    alpha = max(alpha, cutEdge * 0.88 * uOpacity);
    alpha = clamp(alpha, 0.0, 0.92);

    gl_FragColor = vec4(baseCol, alpha);
  }
`;
