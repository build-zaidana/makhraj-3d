import * as THREE from 'three';
import { applySubsurfaceScattering, createTongueTextures } from './TextureGenerator.js';

/**
 * TongueMesh — 1:1 MRI-Proportioned Sculpted Procedural Deformable Tongue (56x64)
 *
 * Calibrated directly into the real BodyParts3D MRI tongue volume:
 *   X in [-0.28, +0.28], Y in [-0.35, +0.18], Z in [-0.20, +0.66]
 * Features real-time Fast Subsurface Scattering (SSS), moist mucosal clearcoat,
 * 512px micro-papillae normal/roughness maps, and an organic sublingual genioglossus
 * base sling anchoring smoothly into the inner chin symphysis of the real mandible.
 */

const SEGMENTS_U = 56;
const SEGMENTS_V = 64;

export class TongueMesh {
  constructor(parentGroup) {
    this.group = new THREE.Group();
    parentGroup.add(this.group);

    const { map, normalMap, roughnessMap } = createTongueTextures();

    this.geometry = this._createLoftGeometry();
    this.material = applySubsurfaceScattering(
      new THREE.MeshPhysicalMaterial({
        map,
        normalMap,
        normalScale: new THREE.Vector2(0.82, 0.82),
        roughnessMap,
        color: new THREE.Color('#de6e82'),
        roughness: 0.36,
        metalness: 0.0,
        clearcoat: 0.78,
        clearcoatRoughness: 0.20,
        sheen: 0.42,
        sheenRoughness: 0.50,
        sheenColor: new THREE.Color('#ffd6df'),
        side: THREE.DoubleSide,
      }),
      { color: '#c8243e', intensity: 0.52, power: 2.2, wrap: 0.5 }
    );

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.group.add(this.mesh);

    this._ctrlPts = [
      new THREE.Vector3(),
      new THREE.Vector3(),
      new THREE.Vector3(),
      new THREE.Vector3(),
      new THREE.Vector3(),
      new THREE.Vector3(),
    ];
    this._curve = new THREE.CatmullRomCurve3(this._ctrlPts, false, 'centripetal', 0.5);
    this._pt = new THREE.Vector3();
    this._tan = new THREE.Vector3();
    this._up = new THREE.Vector3();
    this._right = new THREE.Vector3(1, 0, 0);

    this.updatePose(
      {
        tipY: 0,
        tipZ: 0,
        bladeY: 0,
        midY: 0,
        backY: 0,
        sideLift: 0,
        curl: 0,
        groove: 0,
        jawOpen: 0.22,
      },
      0,
      0
    );
  }

  setVisible(flag) {
    this.group.visible = flag;
  }

  _createLoftGeometry() {
    const vertCount = (SEGMENTS_V + 1) * (SEGMENTS_U + 1);
    const positions = new Float32Array(vertCount * 3);
    const uvs = new Float32Array(vertCount * 2);
    const indices = [];

    for (let iv = 0; iv <= SEGMENTS_V; iv++) {
      const v = iv / SEGMENTS_V;
      for (let iu = 0; iu <= SEGMENTS_U; iu++) {
        const u = iu / SEGMENTS_U;
        const idx = iv * (SEGMENTS_U + 1) + iu;
        uvs[idx * 2] = u;
        uvs[idx * 2 + 1] = v;
      }
    }

    for (let iv = 0; iv < SEGMENTS_V; iv++) {
      for (let iu = 0; iu < SEGMENTS_U; iu++) {
        const a = iv * (SEGMENTS_U + 1) + iu;
        const b = (iv + 1) * (SEGMENTS_U + 1) + iu;
        const c = (iv + 1) * (SEGMENTS_U + 1) + (iu + 1);
        const d = iv * (SEGMENTS_U + 1) + (iu + 1);
        indices.push(a, b, d);
        indices.push(b, c, d);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    return geo;
  }

  updatePose(pose, time = 0, audioLevel = 0) {
    const breath = Math.sin(time * 2.0) * 0.005;
    const trill =
      pose.curl > 0.5 ? Math.sin(time * 28.0) * 0.014 * (0.4 + audioLevel * 1.3) : 0;
    const jawDrop = (pose.jawOpen - 0.22) * 0.13;

    // 6-point Catmull-Rom spine calibrated 1:1 to real MRI tongue volume & surrounding landmarks:
    // Root sits cleanly anterior to epiglottis (Z=-0.125) and superior to hyoid (Y=-0.21..-0.48)
    this._ctrlPts[0].set(0, -0.32, -0.08);
    this._ctrlPts[1].set(0, -0.14 + pose.backY * 0.36, -0.09 - pose.backY * 0.05);
    this._ctrlPts[2].set(0, 0.02 + pose.backY * 0.82 + breath, -0.01 - pose.backY * 0.08);
    this._ctrlPts[3].set(0, 0.05 + pose.midY * 0.86 - jawDrop * 0.28 + breath, 0.20);
    this._ctrlPts[4].set(
      0,
      0.01 + pose.bladeY * 0.76 - jawDrop * 0.36 + trill * 0.5,
      0.42 + pose.tipZ * 0.30
    );
    this._ctrlPts[5].set(
      0,
      -0.02 + pose.tipY * 0.86 + pose.curl * 0.05 - jawDrop * 0.24 + trill,
      0.62 + pose.tipZ * 0.80 - pose.curl * 0.05
    );

    const posAttr = this.geometry.attributes.position;
    const arr = posAttr.array;

    for (let iv = 0; iv <= SEGMENTS_V; iv++) {
      const v = iv / SEGMENTS_V;

      this._curve.getPoint(v, this._pt);
      this._curve.getTangent(v, this._tan).normalize();

      this._up.crossVectors(this._tan, this._right).normalize();
      if (this._up.y < 0 && v > 0.25) {
        this._up.negate();
      }

      // Smooth anatomical closures at both root (v=0) and nimble apex (v=1)
      const tipCap = Math.pow(Math.max(0, 1.0 - Math.pow(v, 5.4)), 0.46);
      const baseTaper = Math.pow(Math.min(1, v * 4.2), 0.52);

      // Lateral spread (Hafatul Lisan reaches inner upper molars at X=+-0.25..0.37 on Dhad!)
      const sideEnvelope = Math.sin(THREE.MathUtils.clamp((v - 0.16) / 0.74, 0, 1) * Math.PI);
      const halfWidth =
        (0.24 * baseTaper * (1.0 - 0.44 * Math.pow(v, 1.7)) +
          pose.sideLift * 0.135 * sideEnvelope) *
        tipCap;

      const halfHeight = (0.145 * (1.0 - 0.58 * v) + 0.025) * tipCap * baseTaper;

      for (let iu = 0; iu <= SEGMENTS_U; iu++) {
        const theta = (iu / SEGMENTS_U) * Math.PI * 2.0;
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);

        let localX = cosT * halfWidth;
        let localUp = sinT * halfHeight;

        if (sinT < 0) {
          // Organic fuller anatomical genioglossus muscular belly tapering smoothly at blade & tip
          const belly = 0.82 + 0.58 * Math.sin(THREE.MathUtils.clamp((v - 0.06) / 0.68, 0, 1) * Math.PI);
          localUp *= belly;
        } else {
          localUp *= 0.90 + 0.14 * Math.cos(cosT * Math.PI * 0.5);
        }

        // Median dorsal sulcus + sibilant groove (Sin, Shad, Zay)
        if (sinT > 0.08) {
          const centerFactor = Math.exp(-Math.pow(cosT * 2.6, 2.0));
          const grooveDepth = (0.017 + pose.groove * 0.052 * sideEnvelope) * sinT;
          localUp -= centerFactor * grooveDepth;
        }

        // Lateral margin elevation toward upper molars (Dhad & Lam)
        if (pose.sideLift > 0.01) {
          const edgeFactor = Math.pow(Math.abs(cosT), 2.1);
          localUp += edgeFactor * pose.sideLift * 0.13 * sideEnvelope;
        }

        // Subtle apex curl for Ra'
        if (pose.curl > 0.01 && v > 0.78) {
          const tipFactor = (v - 0.78) / 0.22;
          localUp += tipFactor * tipFactor * pose.curl * 0.04;
        }

        const idx = (iv * (SEGMENTS_U + 1) + iu) * 3;
        arr[idx] = this._pt.x + localX;
        arr[idx + 1] = this._pt.y + this._up.y * localUp;
        arr[idx + 2] = this._pt.z + this._up.z * localUp;
      }
    }

    posAttr.needsUpdate = true;
    this.geometry.computeVertexNormals();
  }
}
