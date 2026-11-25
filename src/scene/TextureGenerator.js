import * as THREE from 'three';

/**
 * High-Resolution Procedural PBR Texture Generator (512x512)
 * Generates crisp Diffuse, Tangent-Space Normal, and Roughness maps for:
 *  - Organic velvety tongue mucosa (central sulcus, stylized micro-papillae, wet sheen)
 *  - Soft palate & uvula tissue (subtle anatomical rugae ridges)
 *  - Luxury Islamic 8-point Rub el Hizb dark-sapphire & gold studio pedestal
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
 * Generates premium warm-coral organic tongue PBR textures (512x512 diffuse, normal, roughness).
 */
export function createTongueTextures() {
  const size = 512;
  const { canvas: diffCanvas, ctx: diffCtx } = createCanvas(size);
  const { canvas: heightCanvas, ctx: hCtx } = createCanvas(size);
  const { canvas: roughCanvas, ctx: rCtx } = createCanvas(size);

  // Subtle multi-stop lateral & sulcus color variation
  const grad = diffCtx.createLinearGradient(0, 0, size, 0);
  grad.addColorStop(0.0, '#c85066');
  grad.addColorStop(0.18, '#df697e');
  grad.addColorStop(0.45, '#e87a8d');
  grad.addColorStop(0.50, '#c24d63'); // anatomical median sulcus
  grad.addColorStop(0.55, '#e87a8d');
  grad.addColorStop(0.82, '#df697e');
  grad.addColorStop(1.0, '#c85066');
  diffCtx.fillStyle = grad;
  diffCtx.fillRect(0, 0, size, size);

  // Root-to-tip warmth transition (deeper crimson at pharyngeal root, friendly soft coral at tip)
  const vGrad = diffCtx.createLinearGradient(0, 0, 0, size);
  vGrad.addColorStop(0.0, 'rgba(120, 28, 48, 0.42)');
  vGrad.addColorStop(0.35, 'rgba(170, 52, 74, 0.10)');
  vGrad.addColorStop(0.75, 'rgba(255, 198, 210, 0.08)');
  vGrad.addColorStop(1.0, 'rgba(255, 215, 224, 0.22)');
  diffCtx.fillStyle = vGrad;
  diffCtx.fillRect(0, 0, size, size);

  // Height & roughness bases
  hCtx.fillStyle = '#808080';
  hCtx.fillRect(0, 0, size, size);

  rCtx.fillStyle = '#5a5a5a'; // Moist glossy base roughness (~0.35)
  rCtx.fillRect(0, 0, size, size);

  // Central anatomical sulcus depression
  const sulcusGrad = hCtx.createLinearGradient(size * 0.45, 0, size * 0.55, 0);
  sulcusGrad.addColorStop(0.0, 'rgba(128,128,128,0)');
  sulcusGrad.addColorStop(0.5, 'rgba(35,35,35,0.85)');
  sulcusGrad.addColorStop(1.0, 'rgba(128,128,128,0)');
  hCtx.fillStyle = sulcusGrad;
  hCtx.fillRect(size * 0.45, 0, size * 0.10, size);

  // Subtle V-shaped sulcus terminalis (circumvallate papillae zone near back third)
  hCtx.strokeStyle = 'rgba(225,225,225,0.45)';
  hCtx.lineWidth = 4;
  for (let i = -4; i <= 4; i++) {
    const px = size * 0.5 + i * 32;
    const py = size * 0.30 + Math.abs(i) * 14;
    hCtx.beginPath();
    hCtx.arc(px, py, 6, 0, Math.PI * 2);
    hCtx.fillStyle = 'rgba(220,220,220,0.42)';
    hCtx.fill();
  }

  // Fine deterministic micro-papillae texture for organic studio realism
  let seed = 1337;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  for (let i = 0; i < 2200; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 1.0 + rand() * 2.4;
    const alpha = 0.04 + rand() * 0.07;

    diffCtx.fillStyle = rand() > 0.4 ? `rgba(255, 224, 232, ${alpha})` : `rgba(145, 38, 60, ${alpha})`;
    diffCtx.beginPath();
    diffCtx.arc(x, y, r, 0, Math.PI * 2);
    diffCtx.fill();

    hCtx.fillStyle = `rgba(210, 210, 210, ${0.14 + rand() * 0.18})`;
    hCtx.beginPath();
    hCtx.arc(x, y, r * 1.1, 0, Math.PI * 2);
    hCtx.fill();

    rCtx.fillStyle = `rgba(120, 120, 120, ${0.12 + rand() * 0.15})`;
    rCtx.beginPath();
    rCtx.arc(x, y, r, 0, Math.PI * 2);
    rCtx.fill();
  }

  const map = new THREE.CanvasTexture(diffCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.ClampToEdgeWrapping;
  map.wrapT = THREE.ClampToEdgeWrapping;

  const normalMap = heightCanvasToNormalTexture(heightCanvas, 2.2);
  const roughnessMap = new THREE.CanvasTexture(roughCanvas);

  return { map, normalMap, roughnessMap };
}

/**
 * Generates refined soft palate / palatal rugae PBR textures (512x512).
 */
export function createPalateTextures() {
  const size = 512;
  const { canvas: diffCanvas, ctx: diffCtx } = createCanvas(size);
  const { canvas: heightCanvas, ctx: hCtx } = createCanvas(size);

  const baseGrad = diffCtx.createLinearGradient(0, 0, 0, size);
  baseGrad.addColorStop(0.0, '#efb1be');
  baseGrad.addColorStop(0.65, '#e295a8');
  baseGrad.addColorStop(1.0, '#d37e95');
  diffCtx.fillStyle = baseGrad;
  diffCtx.fillRect(0, 0, size, size);

  hCtx.fillStyle = '#808080';
  hCtx.fillRect(0, 0, size, size);

  // Curved transverse palatal rugae ridges in anterior hard palate
  for (let i = 0; i < 6; i++) {
    const y = 42 + i * 32;
    diffCtx.strokeStyle = 'rgba(204, 96, 122, 0.24)';
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
 * Generates a luxury obsidian-sapphire & etched gold/cyan Islamic 8-pointed Rub el Hizb
 * studio pedestal texture + normal map + roughness map (1024x1024).
 */
export function createPedestalTextures() {
  const size = 1024;
  const { canvas: diffCanvas, ctx } = createCanvas(size);
  const { canvas: heightCanvas, ctx: hCtx } = createCanvas(size);

  const cx = size / 2;
  const cy = size / 2;

  const bg = ctx.createRadialGradient(cx, cy, 30, cx, cy, size * 0.5);
  bg.addColorStop(0.0, '#1e1e1e');
  bg.addColorStop(0.55, '#131313');
  bg.addColorStop(0.92, '#0b0b0b');
  bg.addColorStop(1.0, '#070707');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);

  hCtx.fillStyle = '#808080';
  hCtx.fillRect(0, 0, size, size);

  const drawEtching = (targetCtx, strokePrimary, strokeAccent, scaleW) => {
    targetCtx.save();
    targetCtx.translate(cx, cy);

    // Fine concentric orbital rings
    targetCtx.strokeStyle = strokePrimary;
    [130, 210, 295, 385, 456, 480].forEach((r, idx) => {
      targetCtx.lineWidth = (idx === 4 ? 3.5 : 1.8) * scaleW;
      targetCtx.beginPath();
      targetCtx.arc(0, 0, r, 0, Math.PI * 2);
      targetCtx.stroke();
    });

    // Double Rub el Hizb 8-pointed star motif (inner & outer)
    [220, 320].forEach((sq, idx) => {
      targetCtx.strokeStyle = idx === 0 ? strokeAccent : strokePrimary;
      targetCtx.lineWidth = (idx === 0 ? 2.4 : 1.8) * scaleW;
      for (let rot = 0; rot < 2; rot++) {
        targetCtx.save();
        targetCtx.rotate((rot * Math.PI) / 4);
        targetCtx.strokeRect(-sq / 2, -sq / 2, sq, sq);
        targetCtx.restore();
      }
    });

    // Compass precision degree ticks around outer bezel
    targetCtx.strokeStyle = strokePrimary;
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      const major = i % 6 === 0;
      const r1 = major ? 412 : 434;
      const r2 = 452;
      targetCtx.lineWidth = (major ? 2.6 : 1.2) * scaleW;
      targetCtx.beginPath();
      targetCtx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
      targetCtx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
      targetCtx.stroke();
    }

    targetCtx.restore();
  };

  drawEtching(ctx, 'rgba(255, 255, 255, 0.16)', 'rgba(255, 255, 255, 0.28)', 1.0);
  drawEtching(hCtx, '#c4c4c4', '#dedede', 1.4);

  const map = new THREE.CanvasTexture(diffCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;

  const normalMap = heightCanvasToNormalTexture(heightCanvas, 2.0);
  return { map, normalMap };
}
