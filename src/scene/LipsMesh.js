import * as THREE from 'three';
import { applySubsurfaceScattering, applySolidCutInterior } from './TextureGenerator.js';

/**
 * LipsMesh — Unified Continuous Sculpted 3D Orbicularis Oris Lip Ring + Solid Sagittal Cut Caps
 *
 * Replaces disconnected tube halves with ONE continuous anatomical lip ring wrapping cleanly
 * around the mouth aperture (upper lip Cupid's bow -> seamless lateral commissures -> lower lip):
 *  - Teardrop anatomical cross-section (rounded outer vermilion crest, smooth inner mucosal wall
 *    hugging closely in front of the real MRI incisors at Z ≈ 0.785)
 *  - Exact procedural solid cross-section caps right on `sagittalClipPlane` so the sliced lip
 *    reads as dense, solid fleshy tissue from EVERY viewing angle (zero hollow tube ends!)
 *  - Calibrated articulation for all 4 Asy-Syafatan letters:
 *      ب / م (lipClose): firm watertight bilabial compression seal
 *      ف (lipLabiodental): lower lip tucks cleanly inward & upward flush onto upper incisor edge
 *      و (lipRound): unified, seamless, rounded protruding "O" lip purse!
 */

const SEG_LOOP = 44;    // Smooth perimeter loop (optimized for 60 FPS)
const SEG_RING = 14;    // Sculpted anatomical lip cross-section

export class LipsMesh {
  constructor(parentGroup, sagittalClipPlane) {
    this.group = new THREE.Group();
    parentGroup.add(this.group);
    this.sagittalClipPlane = sagittalClipPlane;

    this.material = this._createLipMaterial();
    this.capMaterial = applySubsurfaceScattering(
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#9f4353'),
        roughness: 0.46,
        metalness: 0.0,
        clearcoat: 0.32,
        clearcoatRoughness: 0.36,
        side: THREE.DoubleSide,
      }),
      { color: '#8f1e34', intensity: 0.32, power: 2.5, wrap: 0.4 }
    );

    this.geometry = this._createRingGeometry();
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.renderOrder = 3;
    this.group.add(this.mesh);

    // Procedural solid cross-section cap discs right at X = sagittalClipPlane.constant
    this.upperCapGeo = this._createCapGeometry();
    this.lowerCapGeo = this._createCapGeometry();
    this.upperCap = new THREE.Mesh(this.upperCapGeo, this.capMaterial);
    this.lowerCap = new THREE.Mesh(this.lowerCapGeo, this.capMaterial);
    [this.upperCap, this.lowerCap].forEach((c) => {
      c.renderOrder = 4;
      this.group.add(c);
    });
    this._lastSig = null;

    this.updatePose(
      { jawOpen: 0.22, lipClose: 0, lipRound: 0, lipLabiodental: 0 },
      0,
      0
    );
  }

  _createLipMaterial() {
    const mat = applySubsurfaceScattering(
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#cc727f'),
        roughness: 0.38,
        metalness: 0.0,
        clearcoat: 0.52,
        clearcoatRoughness: 0.28,
        sheen: 0.34,
        sheenRoughness: 0.52,
        sheenColor: new THREE.Color('#ffdce2'),
        clippingPlanes: [this.sagittalClipPlane],
        clipShadows: true,
        side: THREE.DoubleSide,
      }),
      { color: '#b52840', intensity: 0.42, power: 2.3, wrap: 0.45 }
    );
    return applySolidCutInterior(mat, { tint: '#9e4050', mixFactor: 0.55, darken: 0.70 });
  }

  _createRingGeometry() {
    const vertCount = (SEG_LOOP + 1) * (SEG_RING + 1);
    const positions = new Float32Array(vertCount * 3);
    const indices = [];

    for (let il = 0; il < SEG_LOOP; il++) {
      for (let ir = 0; ir < SEG_RING; ir++) {
        const a = il * (SEG_RING + 1) + ir;
        const b = (il + 1) * (SEG_RING + 1) + ir;
        const c = (il + 1) * (SEG_RING + 1) + (ir + 1);
        const d = il * (SEG_RING + 1) + (ir + 1);
        indices.push(a, b, d);
        indices.push(b, c, d);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setIndex(indices);
    return geo;
  }

  _createCapGeometry() {
    // Center vertex (0) + SEG_RING perimeter vertices (1..SEG_RING+1)
    const positions = new Float32Array((SEG_RING + 2) * 3);
    const indices = [];
    for (let ir = 0; ir < SEG_RING; ir++) {
      indices.push(0, ir + 1, ir + 2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setIndex(indices);
    return geo;
  }

  setVisible(flag) {
    this.group.visible = flag;
  }

  /**
   * Evaluates lip centerline & sculpted cross-section radii at mouth-loop angle `phi`
   *   phi = 0       -> left commissure (+X)
   *   phi = pi/2    -> upper lip midline (X = 0)
   *   phi = pi      -> right commissure (-X)
   *   phi = 3*pi/2  -> lower lip midline (X = 0)
   */
  _evalLoopPoint(phi, params) {
    const {
      halfWidth,
      jawDropY,
      jawBackZ,
      lipClose,
      lipRound,
      lipLabio,
      breath,
    } = params;

    const cosP = Math.cos(phi); // +1 left corner, 0 midline, -1 right corner
    const sinP = Math.sin(phi); // +1 upper lip, 0 corners, -1 lower lip
    const isUpper = sinP >= 0;
    const absS = Math.abs(cosP); // 0 at midline, 1 at corners
    const centerWeight = Math.max(0, Math.abs(sinP));
    const fullness = Math.pow(centerWeight, 0.72);

    // Slight smooth horizontal curve matching real dental arch
    const x = cosP * halfWidth;
    const cornerY = -0.022 + jawDropY * 0.34;
    const cornerZ = 0.59 + jawBackZ * 0.24;

    let yCenter;
    let zCenter;
    let radY;
    let radZ;

    if (isUpper) {
      const cupidDip =
        -0.008 * Math.exp(-Math.pow(cosP * 6.5, 2.0)) +
        0.006 * Math.exp(-Math.pow((absS - 0.16) * 8.0, 2.0));

      const midY =
        0.072 +
        cupidDip +
        breath +
        lipLabio * 0.030 -
        lipClose * 0.040 +
        lipRound * 0.005;

      const midZ =
        0.816 +
        lipRound * 0.088 +
        lipClose * 0.012 +
        lipLabio * 0.014;

      yCenter = THREE.MathUtils.lerp(cornerY, midY, fullness);
      zCenter = THREE.MathUtils.lerp(cornerZ, midZ, Math.pow(centerWeight, 0.82));

      radY = (0.044 * (1.0 - lipClose * 0.16)) * (0.34 + 0.66 * fullness);
      radZ = (0.044 * (1.0 + lipRound * 0.20)) * (0.40 + 0.60 * fullness);
    } else {
      const openBaseY = -0.056 + jawDropY * 0.84;
      const midY =
        THREE.MathUtils.lerp(
          THREE.MathUtils.lerp(openBaseY, -0.030, lipLabio),
          -0.014,
          lipClose
        ) -
        lipRound * 0.008 -
        breath;

      const openBaseZ = 0.802 + jawBackZ * 0.54;
      const midZ =
        openBaseZ +
        lipRound * 0.092 +
        lipClose * 0.020 -
        lipLabio * 0.068;

      yCenter = THREE.MathUtils.lerp(cornerY, midY, fullness);
      zCenter = THREE.MathUtils.lerp(cornerZ, midZ, Math.pow(centerWeight, 0.82));

      radY = (0.048 * (1.0 - lipClose * 0.14)) * (0.34 + 0.66 * fullness);
      radZ = (0.046 * (1.0 + lipRound * 0.18)) * (0.40 + 0.60 * fullness);
    }

    return { x, yCenter, zCenter, radY, radZ, isUpper, fullness };
  }

  _evalCrossSection(theta, lp, lipClose, lipLabio) {
    const cosT = Math.cos(theta); // +1 outer labial front, -1 inner mucosal side
    const sinT = Math.sin(theta); // +1 superior, -1 inferior

    let dy = sinT * lp.radY;
    let dz = cosT * lp.radZ;

    // Flatten inner mucosal face slightly so it hugs the incisors cleanly instead of looking cylindrical
    if (cosT < 0) {
      dz *= 0.78;
    }

    if (lp.isUpper) {
      if (sinT < 0 && lipClose > 0.05) dy *= 1.0 - lipClose * 0.24;
      if (sinT > 0.15) dz -= sinT * 0.018 * lp.fullness; // Smooth philtrum taper
    } else {
      if (sinT > 0 && lipClose > 0.05) dy *= 1.0 - lipClose * 0.24;
      if (sinT > 0 && lipLabio > 0.1) dz -= sinT * lipLabio * 0.018 * lp.fullness;
      if (sinT < -0.15) dz += sinT * 0.018 * lp.fullness; // Smooth mentolabial taper
    }

    return [lp.yCenter + dy, lp.zCenter + dz];
  }

  _updateCutCap(capGeo, capMesh, phi, clipX, params) {
    const lp = this._evalLoopPoint(phi, params);
    const attr = capGeo.attributes.position;
    const arr = attr.array;

    arr[0] = clipX;
    arr[1] = lp.yCenter;
    arr[2] = lp.zCenter;

    for (let ir = 0; ir <= SEG_RING; ir++) {
      const theta = (ir / SEG_RING) * Math.PI * 2.0;
      const [py, pz] = this._evalCrossSection(theta, lp, params.lipClose, params.lipLabio);
      const idx = (ir + 1) * 3;
      arr[idx] = clipX;
      arr[idx + 1] = py;
      arr[idx + 2] = pz;
    }
    attr.needsUpdate = true;
    capGeo.computeVertexNormals();
    capMesh.visible = true;
  }

  updatePose(pose, _time = 0, audioLevel = 0) {
    const jawOpen = THREE.MathUtils.clamp((pose.jawOpen || 0.22) + audioLevel * 0.08, 0, 1);
    const lipClose = THREE.MathUtils.clamp(pose.lipClose || 0, 0, 1);
    const lipRound = THREE.MathUtils.clamp(pose.lipRound || 0, 0, 1);
    const lipLabio = THREE.MathUtils.clamp(pose.lipLabiodental || 0, 0, 1);
    const clipX = this.sagittalClipPlane ? this.sagittalClipPlane.constant : 5.0;

    // Dirty-check: zero vertex rebuilds or normal recalculations when lips & clip plane are static!
    const q = (v) => Math.round(v * 1500);
    const sig = `${q(jawOpen)}|${q(lipClose)}|${q(lipRound)}|${q(lipLabio)}|${q(clipX)}`;
    if (sig === this._lastSig) return false;
    this._lastSig = sig;

    const breath = 0;

    const halfWidth = 0.34 * (1.0 - lipRound * 0.40);
    const jawAngle = jawOpen * 0.25 * (1.0 - lipClose * 0.85);
    const jawDropY = -Math.sin(jawAngle) * 1.16;
    const jawBackZ = -(1.0 - Math.cos(jawAngle)) * 0.70 - Math.sin(jawAngle) * 0.50;

    const params = {
      halfWidth,
      jawDropY,
      jawBackZ,
      lipClose,
      lipRound,
      lipLabio,
      breath,
    };

    const attr = this.geometry.attributes.position;
    const arr = attr.array;

    for (let il = 0; il <= SEG_LOOP; il++) {
      const phi = (il / SEG_LOOP) * Math.PI * 2.0;
      const lp = this._evalLoopPoint(phi, params);

      for (let ir = 0; ir <= SEG_RING; ir++) {
        const theta = (ir / SEG_RING) * Math.PI * 2.0;
        const [py, pz] = this._evalCrossSection(theta, lp, lipClose, lipLabio);
        const idx = (il * (SEG_RING + 1) + ir) * 3;
        arr[idx] = lp.x;
        arr[idx + 1] = py;
        arr[idx + 2] = pz;
      }
    }

    attr.needsUpdate = true;
    this.geometry.computeVertexNormals();

    // Render watertight procedural solid cut caps right where sagittalClipPlane slices upper & lower lip!
    if (Math.abs(clipX) < halfWidth * 0.94) {
      const ratio = THREE.MathUtils.clamp(clipX / halfWidth, -0.99, 0.99);
      const phiUpper = Math.acos(ratio);                 // Upper lip intersection in (0, pi)
      const phiLower = Math.PI * 2.0 - Math.acos(ratio); // Lower lip intersection in (pi, 2pi)
      this._updateCutCap(this.upperCapGeo, this.upperCap, phiUpper, clipX - 0.001, params);
      this._updateCutCap(this.lowerCapGeo, this.lowerCap, phiLower, clipX - 0.001, params);
    } else {
      this.upperCap.visible = false;
      this.lowerCap.visible = false;
    }
    return true;
  }
}
