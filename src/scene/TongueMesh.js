import * as THREE from 'three';
import { createTongueTextures } from './TextureGenerator.js';

/**
 * TongueMesh — High-Resolution Sculpted Procedural Deformable 3D Tongue
 *
 * 44x52 smooth anatomical loft along a dynamic 6-point Catmull-Rom spline,
 * rendered with wet-mucosa MeshPhysicalMaterial (clearcoat + velvety sheen +
 * 512x512 procedural diffuse/normal/roughness maps) and aligned precisely inside
 * the real BodyParts3D dental arches (teeth.glb) and above the hyoid bone (larynx.glb).
 */

const SEGMENTS_U = 44;
const SEGMENTS_V = 52;

export class TongueMesh {
  constructor(parentGroup) {
    this.group = new THREE.Group();
    parentGroup.add(this.group);

    const { map, normalMap, roughnessMap } = createTongueTextures();

    this.geometry = this._createLoftGeometry();
    this.material = new THREE.MeshPhysicalMaterial({
      map,
      normalMap,
      normalScale: new THREE.Vector2(0.75, 0.75),
      roughnessMap,
      color: new THREE.Color('#f47c90'),
      roughness: 0.42,
      metalness: 0.0,
      clearcoat: 0.72,
      clearcoatRoughness: 0.22,
      sheen: 0.45,
      sheenRoughness: 0.55,
      sheenColor: new THREE.Color('#ffd6e0'),
      side: THREE.DoubleSide,
    });

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
    const breath = Math.sin(time * 2.1) * 0.006;
    const trill =
      pose.curl > 0.5 ? Math.sin(time * 28.0) * 0.015 * (0.4 + audioLevel * 1.4) : 0;
    const jawDrop = (pose.jawOpen - 0.22) * 0.14;

    // Spine calibrated to taper cleanly above hyoid bone -> real BodyParts3D oral vault & incisors
    this._ctrlPts[0].set(0, -0.36, -0.22);
    this._ctrlPts[1].set(0, -0.14 + pose.backY * 0.40, -0.18 - pose.backY * 0.05);
    this._ctrlPts[2].set(0, 0.03 + pose.backY * 0.88 + breath, -0.02 - pose.backY * 0.06);
    this._ctrlPts[3].set(0, 0.05 + pose.midY * 0.92 - jawDrop * 0.32 + breath, 0.24);
    this._ctrlPts[4].set(
      0,
      0.01 + pose.bladeY * 0.82 - jawDrop * 0.42 + trill * 0.5,
      0.48 + pose.tipZ * 0.34
    );
    this._ctrlPts[5].set(
      0,
      -0.02 + pose.tipY * 0.92 + pose.curl * 0.055 - jawDrop * 0.28 + trill,
      0.70 + pose.tipZ * 0.85 - pose.curl * 0.05
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

      // Silky rounded tip taper + smooth closed organic root taper (no blunt cut at hyoid!)
      const tipCap = Math.pow(Math.max(0, 1.0 - Math.pow(v, 5.2)), 0.46);
      const baseTaper = Math.pow(Math.min(1, v * 4.5), 0.55);

      // Lateral flare along Hafatul Lisan (touches real BodyParts3D upper molars at ±0.35 on Dhad!)
      const sideEnvelope = Math.sin(THREE.MathUtils.clamp((v - 0.16) / 0.74, 0, 1) * Math.PI);
      const halfWidth =
        (0.22 * baseTaper * (1.0 - 0.42 * Math.pow(v, 1.7)) +
          pose.sideLift * 0.145 * sideEnvelope) *
        tipCap;

      // Plump anatomical body thinning gracefully towards both smooth root and nimble tip
      const halfHeight = (0.142 * (1.0 - 0.58 * v) + 0.026) * tipCap * baseTaper;

      for (let iu = 0; iu <= SEGMENTS_U; iu++) {
        const theta = (iu / SEGMENTS_U) * Math.PI * 2.0;
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);

        let localX = cosT * halfWidth;
        let localUp = sinT * halfHeight;

        // Subtle anatomical keel underneath (sublingual floor) & rounded dorsal arch
        if (sinT < 0) {
          localUp *= 0.78;
        } else {
          // Slight flattened broad dorsum characteristic of human tongue
          localUp *= 0.92 + 0.12 * Math.cos(cosT * Math.PI * 0.5);
        }

        // Anatomical median sulcus + deeper sibilant air-channel groove for Sin/Shad/Zay
        if (sinT > 0.08) {
          const centerFactor = Math.exp(-Math.pow(cosT * 2.5, 2.0));
          const grooveDepth = (0.018 + pose.groove * 0.055 * sideEnvelope) * sinT;
          localUp -= centerFactor * grooveDepth;
        }

        // Lateral edge elevation for Dhad (Hafatul Lisan pressing against upper molars!)
        if (pose.sideLift > 0.01) {
          const edgeFactor = Math.pow(Math.abs(cosT), 2.1);
          localUp += edgeFactor * pose.sideLift * 0.135 * sideEnvelope;
        }

        // Subtle upward apex scoop for Ra'
        if (pose.curl > 0.01 && v > 0.78) {
          const tipFactor = (v - 0.78) / 0.22;
          localUp += tipFactor * tipFactor * pose.curl * 0.042;
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
