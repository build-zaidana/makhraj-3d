import * as THREE from 'three';

/**
 * High-Resolution Procedural PBR Texture & Real-Time Subsurface Scattering (SSS) Module
 *
 * Generates 512px-1024px Diffuse, Tangent-Space Normal, and Roughness maps for:
 *  - Organic wet tongue mucosa (central sulcus, circumvallate & filiform micro-papillae)
 *  - Cortical bone micro-porosity (cranium, cervical spine C1-C6, mandible, hyoid)
 *  - Striated pharyngeal muscle fibers (superior/middle/inferior constrictors & soft palate)
 *  - Architectural obsidian-graphite studio pedestal with hairline Rub el Hizb etching
 * Plus a real-time Fast Subsurface Scattering (Barré-Brisebois translucency) material modifier.
 */

function createCanvas(size = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return { canvas, ctx: canvas.getContext('2d') };
}

function heightCanvasToNormalTexture(heightCanvas, strength = 2.0) {
  const w = heightCanvas.width;
  const h = heightCanvas.height;
  const srcCtx = heightCanvas.getContext('2d');
  const srcData = srcCtx.getImageData(0, 0, w, h).data;

  const { canvas: outCanvas, ctx: outCtx } = createCanvas(w);
  const outImg = outCtx.createImageData(w, h);
  const dst = outImg.data;

  const sample = (x, y) => {
    const cx = (x + w) % w;
    const cy = (y + h) % h;
    return srcData[(cy * w + cx) * 4] / 255.0;
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (sample(x + 1, y) - sample(x - 1, y)) * strength;
      const dy = (sample(x, y + 1) - sample(x, y - 1)) * strength;
      const nz = 1.0;
      const len = Math.hypot(dx, dy, nz);

      const idx = (y * w + x) * 4;
      dst[idx] = Math.round(((-dx / len) * 0.5 + 0.5) * 255);
      dst[idx + 1] = Math.round(((-dy / len) * 0.5 + 0.5) * 255);
      dst[idx + 2] = Math.round(((nz / len) * 0.5 + 0.5) * 255);
      dst[idx + 3] = 255;
    }
  }

  outCtx.putImageData(outImg, 0, 0);
  const tex = new THREE.CanvasTexture(outCanvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Injects real-time Fast Subsurface Scattering (wrap lighting + view-dependent
 * backlit translucency) into any MeshPhysicalMaterial / MeshStandardMaterial
 * so organic tongue, gums, muscle, and dental enamel react to light like real tissue.
 */
export function applySubsurfaceScattering(material, {
  color = '#d9384a',
  intensity = 0.42,
  power = 2.4,
  wrap = 0.45,
} = {}) {
  const sssCol = new THREE.Color(color);
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSssColor = { value: sssCol };
    shader.uniforms.uSssIntensity = { value: intensity };
    shader.uniforms.uSssPower = { value: power };
    shader.uniforms.uSssWrap = { value: wrap };

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform vec3 uSssColor;
        uniform float uSssIntensity;
        uniform float uSssPower;
        uniform float uSssWrap;`
      )
      .replace(
        '#include <lights_fragment_end>',
        `#include <lights_fragment_end>
        // Real-time Fast Subsurface Scattering (wrap diffuse + grazing rim translucency)
        vec3 sssViewDir = normalize(vViewPosition);
        float sssFresnel = pow(1.0 - clamp(abs(dot(normal, sssViewDir)), 0.0, 1.0), uSssPower);
        vec3 sssKeyDir = normalize(vec3(0.58, 0.72, 0.48));
        float sssWrapLight = clamp((dot(normal, sssKeyDir) + uSssWrap) / (1.0 + uSssWrap), 0.0, 1.0);
        float sssBack = pow(clamp(dot(sssViewDir, -normalize(sssKeyDir + normal * 0.45)), 0.0, 1.0), 3.0);
        reflectedLight.directDiffuse += uSssColor * (sssWrapLight * 0.24 + sssFresnel * 0.55 + sssBack * 0.65) * uSssIntensity;`
      );
  };
  material.customProgramCacheKey = () => `sss_${color}_${intensity}_${power}`;
  return material;
}

/**
 * Shades interior back-faces (!gl_FrontFacing) exposed by the sagittal clipping plane
 * with warm, matte solid cross-section tone so sliced bones, gums & lips look solid,
 * never like hollow paper shells. Safely chains onto existing onBeforeCompile (e.g. SSS).
 */
export function applySolidCutInterior(material, {
  tint = '#b9ac96',
  mixFactor = 0.42,
  darken = 0.68,
} = {}) {
  const prevCompile = material.onBeforeCompile;
  const prevKey = material.customProgramCacheKey ? material.customProgramCacheKey() : 'base';
  const cutCol = new THREE.Color(tint);

  material.onBeforeCompile = (shader, renderer) => {
    if (prevCompile) prevCompile(shader, renderer);
    shader.uniforms.uCutInteriorCol = { value: cutCol };
    shader.uniforms.uCutInteriorMix = { value: mixFactor };
    shader.uniforms.uCutInteriorDark = { value: darken };

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform vec3 uCutInteriorCol;
        uniform float uCutInteriorMix;
        uniform float uCutInteriorDark;`
      )
      .replace(
        '#include <dithering_fragment>',
        `if (!gl_FrontFacing) {
          gl_FragColor.rgb = mix(gl_FragColor.rgb * uCutInteriorDark, uCutInteriorCol, uCutInteriorMix);
        }
        #include <dithering_fragment>`
      );
  };
  material.customProgramCacheKey = () => `${prevKey}_cut_${tint}_${mixFactor}_${darken}`;
  return material;
}

/**
 * Organic 512x512 tongue PBR textures (median sulcus, papillae micro-relief, moist sheen).
 */
export function createTongueTextures() {
  const size = 512;
  const { canvas: diffCanvas, ctx: diffCtx } = createCanvas(size);
  const { canvas: heightCanvas, ctx: hCtx } = createCanvas(size);
  const { canvas: roughCanvas, ctx: rCtx } = createCanvas(size);

  const grad = diffCtx.createLinearGradient(0, 0, size, 0);
  grad.addColorStop(0.0, '#b0485c');
  grad.addColorStop(0.18, '#ca6074');
  grad.addColorStop(0.45, '#d67084');
  grad.addColorStop(0.50, '#ac465b'); // median dorsal sulcus
  grad.addColorStop(0.55, '#d67084');
  grad.addColorStop(0.82, '#ca6074');
  grad.addColorStop(1.0, '#b0485c');
  diffCtx.fillStyle = grad;
  diffCtx.fillRect(0, 0, size, size);

  const vGrad = diffCtx.createLinearGradient(0, 0, 0, size);
  vGrad.addColorStop(0.0, 'rgba(95, 24, 38, 0.48)');
  vGrad.addColorStop(0.35, 'rgba(148, 46, 66, 0.14)');
  vGrad.addColorStop(0.75, 'rgba(248, 198, 208, 0.08)');
  vGrad.addColorStop(1.0, 'rgba(255, 212, 222, 0.18)');
  diffCtx.fillStyle = vGrad;
  diffCtx.fillRect(0, 0, size, size);

  hCtx.fillStyle = '#808080';
  hCtx.fillRect(0, 0, size, size);

  rCtx.fillStyle = '#525252';
  rCtx.fillRect(0, 0, size, size);

  // Median sulcus groove
  const sulcusGrad = hCtx.createLinearGradient(size * 0.45, 0, size * 0.55, 0);
  sulcusGrad.addColorStop(0.0, 'rgba(128,128,128,0)');
  sulcusGrad.addColorStop(0.5, 'rgba(32,32,32,0.88)');
  sulcusGrad.addColorStop(1.0, 'rgba(128,128,128,0)');
  hCtx.fillStyle = sulcusGrad;
  hCtx.fillRect(size * 0.45, 0, size * 0.10, size);

  // V-shaped circumvallate papillae near posterior third (subtle diffuse + normal relief)
  for (let i = -4; i <= 4; i++) {
    const px = size * 0.5 + i * 32;
    const py = size * 0.30 + Math.abs(i) * 14;
    diffCtx.beginPath();
    diffCtx.arc(px, py, 6.2, 0, Math.PI * 2);
    diffCtx.fillStyle = 'rgba(130, 42, 58, 0.20)';
    diffCtx.fill();
    diffCtx.beginPath();
    diffCtx.arc(px, py, 4.2, 0, Math.PI * 2);
    diffCtx.fillStyle = 'rgba(232, 165, 178, 0.24)';
    diffCtx.fill();

    hCtx.beginPath();
    hCtx.arc(px, py, 6.5, 0, Math.PI * 2);
    hCtx.fillStyle = 'rgba(225,225,225,0.52)';
    hCtx.fill();
  }

  let seed = 1337;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  for (let i = 0; i < 2800; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 0.9 + rand() * 2.1;
    const alpha = 0.04 + rand() * 0.07;

    diffCtx.fillStyle = rand() > 0.42 ? `rgba(250, 218, 224, ${alpha})` : `rgba(125, 34, 52, ${alpha})`;
    diffCtx.beginPath();
    diffCtx.arc(x, y, r, 0, Math.PI * 2);
    diffCtx.fill();

    hCtx.fillStyle = `rgba(215, 215, 215, ${0.14 + rand() * 0.18})`;
    hCtx.beginPath();
    hCtx.arc(x, y, r * 1.1, 0, Math.PI * 2);
    hCtx.fill();

    rCtx.fillStyle = `rgba(115, 115, 115, ${0.10 + rand() * 0.14})`;
    rCtx.beginPath();
    rCtx.arc(x, y, r, 0, Math.PI * 2);
    rCtx.fill();
  }

  const map = new THREE.CanvasTexture(diffCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.ClampToEdgeWrapping;
  map.wrapT = THREE.ClampToEdgeWrapping;

  const normalMap = heightCanvasToNormalTexture(heightCanvas, 2.3);
  const roughnessMap = new THREE.CanvasTexture(roughCanvas);

  return { map, normalMap, roughnessMap };
}

/**
 * Cortical bone organic micro-grain normal & roughness maps (cranium, spine, mandible).
 */
export function createBoneTextures() {
  const size = 256;
  const { canvas: heightCanvas, ctx: hCtx } = createCanvas(size);

  hCtx.fillStyle = '#808080';
  hCtx.fillRect(0, 0, size, size);

  let seed = 9001;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  // Subtle organic bone mineral grain & fine pores
  for (let i = 0; i < 1600; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const rx = 1 + rand() * 5;
    const ry = 0.8 + rand() * 2.5;
    const shade = rand() > 0.5 ? 150 : 108;
    hCtx.fillStyle = `rgba(${shade},${shade},${shade},0.22)`;
    hCtx.beginPath();
    hCtx.ellipse(x, y, rx, ry, rand() * Math.PI, 0, Math.PI * 2);
    hCtx.fill();
  }

  const normalMap = heightCanvasToNormalTexture(heightCanvas, 1.3);
  normalMap.repeat.set(3, 3);
  return { normalMap };
}

/**
 * Striated anatomical pharyngeal & soft-palate muscle fiber texture + normal map.
 */
export function createMuscleTextures() {
  const size = 256;
  const { canvas: diffCanvas, ctx: diffCtx } = createCanvas(size);
  const { canvas: heightCanvas, ctx: hCtx } = createCanvas(size);

  diffCtx.fillStyle = '#b45869';
  diffCtx.fillRect(0, 0, size, size);

  hCtx.fillStyle = '#808080';
  hCtx.fillRect(0, 0, size, size);

  let seed = 777;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  // Fine striated myofibril bands
  for (let y = 0; y < size; y += 3) {
    const alpha = 0.08 + rand() * 0.14;
    diffCtx.fillStyle = rand() > 0.5 ? `rgba(230,145,160,${alpha})` : `rgba(110,36,52,${alpha})`;
    diffCtx.fillRect(0, y, size, 1.5);

    const hVal = rand() > 0.5 ? 168 : 96;
    hCtx.fillStyle = `rgba(${hVal},${hVal},${hVal},0.35)`;
    hCtx.fillRect(0, y, size, 1.8);
  }

  const map = new THREE.CanvasTexture(diffCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(2, 2);

  const normalMap = heightCanvasToNormalTexture(heightCanvas, 1.6);
  normalMap.repeat.set(2, 2);
  return { map, normalMap };
}

/**
 * Palatal mucosa rugae PBR textures (512x512).
 */
export function createPalateTextures() {
  const size = 512;
  const { canvas: diffCanvas, ctx: diffCtx } = createCanvas(size);
  const { canvas: heightCanvas, ctx: hCtx } = createCanvas(size);

  const baseGrad = diffCtx.createLinearGradient(0, 0, 0, size);
  baseGrad.addColorStop(0.0, '#de9aa8');
  baseGrad.addColorStop(0.65, '#ce7e91');
  baseGrad.addColorStop(1.0, '#bc6b7f');
  diffCtx.fillStyle = baseGrad;
  diffCtx.fillRect(0, 0, size, size);

  hCtx.fillStyle = '#808080';
  hCtx.fillRect(0, 0, size, size);

  for (let i = 0; i < 6; i++) {
    const y = 42 + i * 32;
    diffCtx.strokeStyle = 'rgba(176, 74, 96, 0.25)';
    diffCtx.lineWidth = 7;
    diffCtx.beginPath();
    diffCtx.moveTo(40, y + 12);
    diffCtx.quadraticCurveTo(size * 0.5, y - 16, size - 40, y + 12);
    diffCtx.stroke();

    hCtx.strokeStyle = 'rgba(215, 215, 215, 0.55)';
    hCtx.lineWidth = 8;
    hCtx.beginPath();
    hCtx.moveTo(40, y + 12);
    hCtx.quadraticCurveTo(size * 0.5, y - 16, size - 40, y + 12);
    hCtx.stroke();
  }

  const map = new THREE.CanvasTexture(diffCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.ClampToEdgeWrapping;
  map.wrapT = THREE.ClampToEdgeWrapping;

  const normalMap = heightCanvasToNormalTexture(heightCanvas, 1.8);
  return { map, normalMap };
}

/**
 * Monochrome obsidian-graphite studio pedestal with hairline Rub el Hizb etching (1024x1024).
 */
export function createPedestalTextures() {
  const size = 1024;
  const { canvas: diffCanvas, ctx } = createCanvas(size);
  const { canvas: heightCanvas, ctx: hCtx } = createCanvas(size);

  const cx = size / 2;
  const cy = size / 2;

  const bg = ctx.createRadialGradient(cx, cy, 30, cx, cy, size * 0.5);
  bg.addColorStop(0.0, '#1c1c1c');
  bg.addColorStop(0.55, '#121212');
  bg.addColorStop(0.92, '#0a0a0a');
  bg.addColorStop(1.0, '#070707');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);

  hCtx.fillStyle = '#808080';
  hCtx.fillRect(0, 0, size, size);

  const drawEtching = (targetCtx, strokePrimary, strokeAccent, scaleW) => {
    targetCtx.save();
    targetCtx.translate(cx, cy);

    targetCtx.strokeStyle = strokePrimary;
    [130, 210, 295, 385, 456, 480].forEach((r, idx) => {
      targetCtx.lineWidth = (idx === 4 ? 3.2 : 1.5) * scaleW;
      targetCtx.beginPath();
      targetCtx.arc(0, 0, r, 0, Math.PI * 2);
      targetCtx.stroke();
    });

    [220, 320].forEach((sq, idx) => {
      targetCtx.strokeStyle = idx === 0 ? strokeAccent : strokePrimary;
      targetCtx.lineWidth = (idx === 0 ? 2.0 : 1.5) * scaleW;
      for (let rot = 0; rot < 2; rot++) {
        targetCtx.save();
        targetCtx.rotate((rot * Math.PI) / 4);
        targetCtx.strokeRect(-sq / 2, -sq / 2, sq, sq);
        targetCtx.restore();
      }
    });

    targetCtx.strokeStyle = strokePrimary;
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      const major = i % 6 === 0;
      const r1 = major ? 414 : 434;
      const r2 = 452;
      targetCtx.lineWidth = (major ? 2.2 : 1.1) * scaleW;
      targetCtx.beginPath();
      targetCtx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
      targetCtx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
      targetCtx.stroke();
    }

    targetCtx.restore();
  };

  drawEtching(ctx, 'rgba(255, 255, 255, 0.13)', 'rgba(255, 255, 255, 0.22)', 1.0);
  drawEtching(hCtx, '#c4c4c4', '#dedede', 1.3);

  const map = new THREE.CanvasTexture(diffCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;

  const normalMap = heightCanvasToNormalTexture(heightCanvas, 1.8);
  return { map, normalMap };
}
