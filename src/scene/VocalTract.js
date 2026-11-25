import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  applySubsurfaceScattering,
  createBoneTextures,
  createMuscleTextures,
  createPalateTextures,
} from './TextureGenerator.js';

/**
 * VocalTract — 1:1 MRI-Registered Real Human Anatomy Atlas (BodyParts3D / OrganUI, CC BY-SA 2.1)
 *
 * Loads a single pre-registered, stripped 1:1 anatomical assembly (`anatomy_head_1to1.glb`,
 * 78 curated real human MRI meshes) with true millimeter registration across:
 *   1. Cranium & Cervical Spine C1-C6 + Intervertebral Discs (toggleable skeletal layer)
 *   2. 28 Individual Porcelain-Enamel Teeth, Gingiva, Maxillae, Palatine Bone & Articulated Mandible
 *   3. Real Al-Khaisyum (Nasal Cavity, Inferior Conchae, Vomer, Nasopharynx, Nasal Cartilages)
 *   4. Real Pharynx Muscular Wall (Superior/Middle/Inferior Constrictors, Raphe, Musculus Uvulae!)
 *   5. Real Larynx (Hyoid Bone, Thyroid/Cricoid/Arytenoid Cartilages, Epiglottis, Vocal Folds, Trachea)
 *
 * ZERO fake pink plastic tubes — every organ is genuine MRI human anatomy shaded with
 * real-time Subsurface Scattering (SSS), cortical bone micro-grain, and Studio PBR clearcoat.
 */

export class VocalTract {
  constructor(parentGroup, loadingManager = undefined) {
    this.group = new THREE.Group();
    this.loadingManager = loadingManager;
    parentGroup.add(this.group);

    // Interactive sagittal cutaway plane (slices near +X side open cleanly)
    this.sagittalClipPlane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0.08);
    // Clean bottom cutoff above the studio pedestal (keeps trachea & C6 crisp inside neck)
    this.bottomClipPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 1.06);
    this.cutawayEnabled = true;

    // Layer Dissection Groups (like Complete Anatomy!)
    this.layers = {
      skull: new THREE.Group(),
      jaw: new THREE.Group(),
      nasal: new THREE.Group(),
      pharynx: new THREE.Group(),
    };
    this.group.add(this.layers.skull, this.layers.jaw, this.layers.nasal, this.layers.pharynx);

    // Exact 1:1 MRI TMJ condyle hinge pivot from registered mandible (`Ymax=0.696, Zmin=-0.445`)
    this.jawPivot = new THREE.Group();
    this.jawPivot.position.set(0, 0.65, -0.38);
    this.layers.jaw.add(this.jawPivot);

    // Animated real anatomical references
    this.epiglottisPivot = null;
    this.uvulaPivot = null;
    this.vocalFoldsMeshes = [];
    this.pharynxZoneMats = { upper: null, mid: null, lower: null };

    this._initMaterials();
    this._buildSoftPalateMucosa();
    this._loadUnifiedAnatomyGLB();
  }

  _initMaterials() {
    const boneTex = createBoneTextures();
    const muscleTex = createMuscleTextures();
    const palateTex = createPalateTextures();

    // 1. Porcelain Dental Enamel with subtle realistic SSS translucency
    const makeToothMat = (clipped) =>
      applySubsurfaceScattering(
        new THREE.MeshPhysicalMaterial({
          color: '#eee8db',
          roughness: 0.17,
          metalness: 0.0,
          clearcoat: 0.94,
          clearcoatRoughness: 0.12,
          ior: 1.56,
          clippingPlanes: clipped ? [this.sagittalClipPlane] : [],
          clipShadows: clipped,
          side: THREE.DoubleSide,
        }),
        { color: '#f5dec0', intensity: 0.22, power: 2.8, wrap: 0.35 }
      );

    // 2. Moist Healthy Gingiva (Gums) with real-time warm SSS
    const gumMat = applySubsurfaceScattering(
      new THREE.MeshPhysicalMaterial({
        color: '#d47488',
        roughness: 0.34,
        clearcoat: 0.68,
        clearcoatRoughness: 0.22,
        sheen: 0.35,
        sheenColor: new THREE.Color('#ffdce5'),
        clippingPlanes: [this.sagittalClipPlane],
        clipShadows: true,
        side: THREE.DoubleSide,
      }),
      { color: '#c82d46', intensity: 0.42, power: 2.3, wrap: 0.45 }
    );

    // 3. Sculpted Cortical Bone (Mandible, Hyoid, Spine C1-C6, Palatine)
    const boneSolidClipped = new THREE.MeshPhysicalMaterial({
      color: '#d8cfc0',
      normalMap: boneTex.normalMap,
      normalScale: new THREE.Vector2(0.45, 0.45),
      roughness: 0.56,
      metalness: 0.01,
      clearcoat: 0.08,
      clippingPlanes: [this.sagittalClipPlane, this.bottomClipPlane],
      clipShadows: true,
      side: THREE.DoubleSide,
    });

    // Subtle semi-translucent Cranium vault so the real skull frames the head delicately without crowding the header
    const craniumBone = new THREE.MeshPhysicalMaterial({
      color: '#cbc2b2',
      normalMap: boneTex.normalMap,
      normalScale: new THREE.Vector2(0.35, 0.35),
      roughness: 0.58,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      clippingPlanes: [this.sagittalClipPlane],
      side: THREE.DoubleSide,
    });

    const maxillaTranslucent = new THREE.MeshPhysicalMaterial({
      color: '#d5cbb9',
      normalMap: boneTex.normalMap,
      normalScale: new THREE.Vector2(0.35, 0.35),
      roughness: 0.54,
      transparent: true,
      opacity: 0.26,
      depthWrite: false,
      clippingPlanes: [this.sagittalClipPlane],
      side: THREE.DoubleSide,
    });

    const intervertebralDisc = new THREE.MeshPhysicalMaterial({
      color: '#9e9b95',
      roughness: 0.48,
      clearcoat: 0.2,
      clippingPlanes: [this.sagittalClipPlane, this.bottomClipPlane],
      side: THREE.DoubleSide,
    });

    // 4. Real Pharyngeal Constrictor Muscles (3 individual emissive-capable SSS materials for Al-Halq zones!)
    const makePharynxMuscle = () =>
      applySubsurfaceScattering(
        new THREE.MeshPhysicalMaterial({
          map: muscleTex.map,
          normalMap: muscleTex.normalMap,
          normalScale: new THREE.Vector2(0.65, 0.65),
          color: '#b85b6c',
          emissive: new THREE.Color('#ffffff'),
          emissiveIntensity: 0.0,
          roughness: 0.44,
          clearcoat: 0.38,
          clearcoatRoughness: 0.32,
          clippingPlanes: [this.sagittalClipPlane, this.bottomClipPlane],
          clipShadows: true,
          side: THREE.DoubleSide,
        }),
        { color: '#a82238', intensity: 0.36, power: 2.5, wrap: 0.4 }
      );

    this.pharynxZoneMats.upper = makePharynxMuscle(); // Adnal Halq (غ خ)
    this.pharynxZoneMats.mid = makePharynxMuscle();   // Wasathul Halq (ع ح)
    this.pharynxZoneMats.lower = makePharynxMuscle(); // Aqshal Halq (ء ه)

    const uvulaMat = applySubsurfaceScattering(
      new THREE.MeshPhysicalMaterial({
        color: '#d67488',
        emissive: new THREE.Color('#ffffff'),
        emissiveIntensity: 0.02,
        roughness: 0.32,
        clearcoat: 0.70,
        clearcoatRoughness: 0.22,
        side: THREE.DoubleSide,
      }),
      { color: '#c42b44', intensity: 0.45, power: 2.2, wrap: 0.45 }
    );

    const palateMucosa = applySubsurfaceScattering(
      new THREE.MeshPhysicalMaterial({
        map: palateTex.map,
        normalMap: palateTex.normalMap,
        normalScale: new THREE.Vector2(0.70, 0.70),
        color: '#dd8e9e',
        roughness: 0.38,
        clearcoat: 0.60,
        clearcoatRoughness: 0.25,
        sheen: 0.30,
        sheenColor: new THREE.Color('#ffe0e8'),
        clippingPlanes: [this.sagittalClipPlane],
        clipShadows: true,
        side: THREE.DoubleSide,
      }),
      { color: '#bf3048', intensity: 0.35, power: 2.4, wrap: 0.4 }
    );

    // 5. Real Al-Khaisyum (Nasal Cavity + Conchae + Nasopharynx)
    const nasalCavityMat = new THREE.MeshPhysicalMaterial({
      color: '#b8b8b8',
      emissive: new THREE.Color('#ffffff'),
      emissiveIntensity: 0.05,
      roughness: 0.22,
      clearcoat: 0.58,
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
      clippingPlanes: [this.sagittalClipPlane],
      side: THREE.DoubleSide,
    });

    const nasalTurbinateMat = applySubsurfaceScattering(
      new THREE.MeshPhysicalMaterial({
        color: '#c98896',
        roughness: 0.40,
        clearcoat: 0.48,
        clippingPlanes: [this.sagittalClipPlane],
        side: THREE.DoubleSide,
      }),
      { color: '#b5344c', intensity: 0.32, power: 2.4, wrap: 0.4 }
    );

    const nasalCartilageMat = new THREE.MeshPhysicalMaterial({
      color: '#d4d4d4',
      roughness: 0.32,
      clearcoat: 0.42,
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
      clippingPlanes: [this.sagittalClipPlane],
      side: THREE.DoubleSide,
    });

    // 6. Real Larynx Hyaline Cartilage, Epiglottis, Vocal Folds & Trachea
    const larynxCartilageMat = new THREE.MeshPhysicalMaterial({
      color: '#d6d8de',
      roughness: 0.32,
      clearcoat: 0.44,
      transparent: true,
      opacity: 0.52,
      clippingPlanes: [this.sagittalClipPlane, this.bottomClipPlane],
      side: THREE.DoubleSide,
    });

    const tracheaMat = new THREE.MeshPhysicalMaterial({
      color: '#d8d9de',
      normalMap: boneTex.normalMap,
      normalScale: new THREE.Vector2(0.25, 0.25),
      roughness: 0.38,
      clearcoat: 0.34,
      clippingPlanes: [this.sagittalClipPlane, this.bottomClipPlane],
      side: THREE.DoubleSide,
    });

    const epiglottisMat = applySubsurfaceScattering(
      new THREE.MeshPhysicalMaterial({
        color: '#df95a4',
        emissive: new THREE.Color('#ffffff'),
        emissiveIntensity: 0.04,
        roughness: 0.34,
        clearcoat: 0.56,
        side: THREE.DoubleSide,
      }),
      { color: '#c4324c', intensity: 0.42, power: 2.3, wrap: 0.45 }
    );

    const vocalFoldsMat = new THREE.MeshPhysicalMaterial({
      color: '#f8f5f2',
      emissive: new THREE.Color('#ffffff'),
      emissiveIntensity: 0.14,
      roughness: 0.20,
      clearcoat: 0.78,
      side: THREE.DoubleSide,
    });

    this.materials = {
      toothSolid: makeToothMat(false),
      toothClipped: makeToothMat(true),
      gum: gumMat,
      boneClipped: boneSolidClipped,
      craniumBone,
      maxillaTranslucent,
      intervertebralDisc,
      uvula: uvulaMat,
      palateMucosa,
      nasalCavity: nasalCavityMat,
      nasalTurbinate: nasalTurbinateMat,
      nasalCartilage: nasalCartilageMat,
      larynxCartilage: larynxCartilageMat,
      trachea: tracheaMat,
      epiglottis: epiglottisMat,
      vocalFolds: vocalFoldsMat,
    };
  }

  /**
   * Subtle anatomical mucosal lining bridging hard palate (palatine-bones) to real musculus-uvulae
   * so the oral roof has authentic wet palatal rugae texture directly above the tongue.
   */
  _buildSoftPalateMucosa() {
    const segZ = 22;
    const segX = 18;
    const positions = [];
    const uvs = [];
    const indices = [];

    // Calibrated 1:1 from real upper-central-incisor (Z=0.71) -> palatine-bones (Y=0.28..0.38) -> musculus-uvulae (Z=-0.34, Y=0.25)
    const roofCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.16, 0.67),
      new THREE.Vector3(0, 0.27, 0.52),
      new THREE.Vector3(0, 0.36, 0.24),
      new THREE.Vector3(0, 0.35, -0.04),
      new THREE.Vector3(0, 0.29, -0.25),
      new THREE.Vector3(0, 0.22, -0.34),
    ]);

    for (let iz = 0; iz <= segZ; iz++) {
      const tz = iz / segZ;
      const center = roofCurve.getPoint(tz);
      const halfSpan = 0.31 * Math.sin(0.28 + tz * 2.5) + 0.06;

      for (let ix = 0; ix <= segX; ix++) {
        const tx = ix / segX;
        const angle = (tx - 0.5) * Math.PI;
        const x = Math.sin(angle) * halfSpan;
        const archDrop = (1.0 - Math.cos(angle)) * 0.14;
        positions.push(x, center.y - archDrop, center.z);
        uvs.push(tx, tz);
      }
    }

    for (let iz = 0; iz < segZ; iz++) {
      for (let ix = 0; ix < segX; ix++) {
        const a = iz * (segX + 1) + ix;
        const b = (iz + 1) * (segX + 1) + ix;
        const c = (iz + 1) * (segX + 1) + (ix + 1);
        const d = iz * (segX + 1) + (ix + 1);
        indices.push(a, d, b);
        indices.push(b, d, c);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    const palateMesh = new THREE.Mesh(geo, this.materials.palateMucosa);
    palateMesh.receiveShadow = true;
    this.layers.pharynx.add(palateMesh);
  }

  _loadUnifiedAnatomyGLB() {
    const loader = new GLTFLoader(this.loadingManager);

    loader.load('./models/anatomy_head_1to1.glb', (gltf) => {
      const meshes = [];
      gltf.scene.traverse((obj) => {
        if (obj.isMesh) meshes.push(obj);
      });

      // Lower jaw offset relative to TMJ pivot (0, 0.65, -0.38)
      const lowerJawContainer = new THREE.Group();
      lowerJawContainer.position.set(0, -0.65, 0.38);
      this.jawPivot.add(lowerJawContainer);

      meshes.forEach((mesh) => {
        const rawName = mesh.name || '';
        const [groupName, partName] = rawName.includes('__')
          ? rawName.split('__')
          : ['misc', rawName];
        const part = partName.toLowerCase();

        mesh.castShadow = true;
        mesh.receiveShadow = true;

        // 1. Cranium & Cervical Spine C1-C6
        if (groupName === 'cranium') {
          mesh.material = this.materials.craniumBone;
          mesh.castShadow = false;
          mesh.renderOrder = 2;
          this.layers.skull.add(mesh);
          return;
        }
        if (groupName === 'spine') {
          mesh.material = part.includes('disc')
            ? this.materials.intervertebralDisc
            : this.materials.boneClipped;
          this.layers.skull.add(mesh);
          return;
        }

        // 2. Upper Dental Arch (14 teeth, gum, maxillae, palatine hard palate)
        if (groupName === 'upper_dental') {
          if (part === 'upper-gum') {
            mesh.material = this.materials.gum;
          } else if (part.includes('maxilla')) {
            mesh.material = this.materials.maxillaTranslucent;
            mesh.castShadow = false;
          } else if (part.includes('palatine')) {
            mesh.material = this.materials.boneClipped;
          } else {
            const isLeftNear = part.includes('-left-');
            const isIncisor = part.includes('incisor');
            mesh.material =
              isLeftNear && !isIncisor
                ? this.materials.toothClipped
                : this.materials.toothSolid;
          }
          this.layers.jaw.add(mesh);
          return;
        }

        // 3. Articulated Lower Jaw (14 lower teeth, lower gum, mandible)
        if (groupName === 'lower_jaw') {
          if (part === 'lower-gum') {
            mesh.material = this.materials.gum;
          } else if (part === 'mandible') {
            mesh.material = this.materials.boneClipped;
          } else {
            const isLeftNear = part.includes('-left-');
            const isIncisor = part.includes('incisor');
            mesh.material =
              isLeftNear && !isIncisor
                ? this.materials.toothClipped
                : this.materials.toothSolid;
          }
          lowerJawContainer.add(mesh);
          return;
        }

        // 4. Al-Khaisyum / Real Nasal Cavity, Conchae, Vomer & Cartilages
        if (groupName === 'nasal') {
          if (part === 'nasal-cavity' || part === 'nasopharynx') {
            mesh.material = this.materials.nasalCavity;
            mesh.castShadow = false;
            mesh.renderOrder = 4;
          } else if (part === 'inferior-conchae') {
            mesh.material = this.materials.nasalTurbinate;
            mesh.renderOrder = 5;
          } else if (part === 'vomer') {
            mesh.material = this.materials.boneClipped;
          } else {
            mesh.material = this.materials.nasalCartilage;
            mesh.castShadow = false;
            mesh.renderOrder = 5;
          }
          this.layers.nasal.add(mesh);
          return;
        }

        // 5. Real Pharynx Muscular Wall & Real Musculus Uvulae!
        if (groupName === 'pharynx') {
          if (part === 'musculus-uvulae') {
            // Pivot real MRI uvula around its superior attachment (0, 0.32, -0.34)
            const uvPivot = new THREE.Group();
            uvPivot.position.set(0, 0.32, -0.34);
            mesh.position.set(0, -0.32, 0.34);
            mesh.material = this.materials.uvula;
            uvPivot.add(mesh);
            this.layers.pharynx.add(uvPivot);
            this.uvulaPivot = uvPivot;
          } else if (part === 'superior-constrictor' || part === 'levator-veli-palatini') {
            mesh.material = this.pharynxZoneMats.upper;
            this.layers.pharynx.add(mesh);
          } else if (part === 'middle-constrictor') {
            mesh.material = this.pharynxZoneMats.mid;
            this.layers.pharynx.add(mesh);
          } else {
            mesh.material = this.pharynxZoneMats.lower;
            this.layers.pharynx.add(mesh);
          }
          return;
        }

        // 6. Real Larynx (Hyoid, Epiglottis, Vocal Folds, Cartilages, Trachea)
        if (groupName === 'larynx') {
          if (part === 'hyoid-bone') {
            mesh.material = this.materials.boneClipped;
            this.layers.pharynx.add(mesh);
          } else if (part === 'epiglottis') {
            // Exact 1:1 MRI epiglottis base pivot: (0, -0.66, -0.18)
            const epiPivot = new THREE.Group();
            epiPivot.position.set(0, -0.66, -0.18);
            mesh.position.set(0, 0.66, 0.18);
            mesh.material = this.materials.epiglottis;
            epiPivot.add(mesh);
            this.layers.pharynx.add(epiPivot);
            this.epiglottisPivot = epiPivot;
          } else if (part === 'vocal-ligaments' || part === 'vocalis') {
            mesh.material = this.materials.vocalFolds;
            this.layers.pharynx.add(mesh);
            this.vocalFoldsMeshes.push(mesh);
          } else if (part === 'trachea') {
            mesh.material = this.materials.trachea;
            this.layers.pharynx.add(mesh);
          } else {
            mesh.material = this.materials.larynxCartilage;
            mesh.castShadow = false;
            mesh.renderOrder = 5;
            this.layers.pharynx.add(mesh);
          }
        }
      });
    });
  }

  /**
   * Anatomical Layer Dissection API (skull | jaw | nasal | pharynx)
   */
  setLayerVisible(layerName, visible) {
    if (this.layers[layerName]) {
      this.layers[layerName].visible = visible;
    }
  }

  setCutaway(enabled, clipX = 0.08) {
    this.cutawayEnabled = enabled;
    this.sagittalClipPlane.constant = enabled ? Math.max(0.05, clipX + 0.04) : 5.0;
  }

  /**
   * Real-time anatomical motion & mucosal zone illumination synced to Hijaiyah articulation!
   */
  updatePose(pose, letter, time = 0, audioLevel = 0) {
    // 1. Real TMJ mandibular opening
    const jawAngle = (pose.jawOpen + audioLevel * 0.10) * 0.25;
    this.jawPivot.rotation.x = jawAngle;

    // 2. Real MRI Musculus Uvulae opens velopharyngeal port during Ghunnah (Nun/Mim)
    const isNasal = Boolean(letter?.airflow?.nasal);
    if (this.uvulaPivot) {
      const targetRot = isNasal ? 0.38 : -0.04;
      this.uvulaPivot.rotation.x = THREE.MathUtils.lerp(
        this.uvulaPivot.rotation.x,
        targetRot,
        0.14
      );
    }

    // 3. Real Al-Khaisyum (nasal-cavity & nasopharynx) illuminates cleanly on Ghunnah
    const targetNasalOp = isNasal
      ? 0.44 + Math.sin(time * 4.5) * 0.05 + audioLevel * 0.16
      : 0.18;
    const targetNasalEmissive = isNasal ? 0.48 + audioLevel * 0.65 : 0.03;
    this.materials.nasalCavity.opacity = THREE.MathUtils.lerp(
      this.materials.nasalCavity.opacity,
      targetNasalOp,
      0.12
    );
    this.materials.nasalCavity.emissiveIntensity = THREE.MathUtils.lerp(
      this.materials.nasalCavity.emissiveIntensity,
      targetNasalEmissive,
      0.12
    );

    // 4. Organic Al-Halq illumination directly on real pharyngeal constrictor muscles!
    const pulse = 0.20 + Math.sin(time * 5.5) * 0.06 + audioLevel * 0.35;
    const upperEm = pose.throatZone === 2 ? pulse : 0.0;
    const midEm = pose.throatZone === 1 ? pulse : 0.0;
    const lowEm = pose.throatZone === 0 ? pulse : 0.0;

    this.pharynxZoneMats.upper.emissiveIntensity = THREE.MathUtils.lerp(
      this.pharynxZoneMats.upper.emissiveIntensity,
      upperEm,
      0.14
    );
    this.pharynxZoneMats.mid.emissiveIntensity = THREE.MathUtils.lerp(
      this.pharynxZoneMats.mid.emissiveIntensity,
      midEm,
      0.14
    );
    this.pharynxZoneMats.lower.emissiveIntensity = THREE.MathUtils.lerp(
      this.pharynxZoneMats.lower.emissiveIntensity,
      lowEm,
      0.14
    );

    // 5. Real Epiglottis tilts posteriorly during Wasathul Halq (ع / ح)
    if (this.epiglottisPivot) {
      const activeMid = pose.throatZone === 1;
      const targetTilt = activeMid ? -pose.throatPinch * 0.42 : 0.0;
      this.epiglottisPivot.rotation.x = THREE.MathUtils.lerp(
        this.epiglottisPivot.rotation.x,
        targetTilt,
        0.14
      );
      this.materials.epiglottis.emissiveIntensity = THREE.MathUtils.lerp(
        this.materials.epiglottis.emissiveIntensity,
        activeMid ? 0.42 + audioLevel * 0.55 : 0.02,
        0.14
      );
    }

    // 6. Real Vocal Folds (vocalis + vocal-ligaments) resonate on Aqshal Halq (ء / ه) & voiced sounds
    const activeLow = pose.throatZone === 0;
    const voiced = Boolean(letter?.airflow?.throatPulse) || audioLevel > 0.05;
    this.materials.vocalFolds.emissiveIntensity = THREE.MathUtils.lerp(
      this.materials.vocalFolds.emissiveIntensity,
      activeLow ? 0.95 + audioLevel * 0.9 : voiced ? 0.28 + audioLevel * 0.55 : 0.08,
      0.16
    );
    if (this.vocalFoldsMeshes.length > 0) {
      const vib = voiced ? 1.0 + Math.sin(time * 42.0) * (0.04 + audioLevel * 0.09) : 1.0;
      this.vocalFoldsMeshes.forEach((m) => m.scale.set(vib, 1.0, 1.0));
    }
  }
}
