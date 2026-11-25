import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createPalateTextures } from './TextureGenerator.js';

/**
 * VocalTract — Real Open-Source Human Anatomy Assembly (BodyParts3D / OrganUI, CC BY-SA 2.1)
 *
 * Combines three curated high-detail MRI-derived anatomical GLB models with
 * premium physical PBR materials (clearcoat wet mucosa, porcelain dental enamel,
 * sculpted bone, luminous glass Al-Khaisyum, pearlescent hyaline cartilage):
 *  1. teeth.glb  -> All 28 individual teeth, upper/lower gums, maxillae, & articulated mandible!
 *  2. nose.glb   -> Real 3D nasal cavity (Al-Khaisyum), inferior conchae, nasopharynx, palatine bone!
 *  3. larynx.glb -> Hyoid bone, epiglottis, thyroid/cricoid/arytenoid cartilages, vocal folds, trachea!
 * Plus a smooth wet-PBR soft-palate/uvula & translucent pharynx cutaway bridge.
 */

export class VocalTract {
  constructor(parentGroup, loadingManager = undefined) {
    this.group = new THREE.Group();
    this.loadingManager = loadingManager;
    parentGroup.add(this.group);

    // Interactive sagittal clipping plane (slices near +X side open for side cutaway inspection)
    this.sagittalClipPlane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0.14);
    // Floor clipping plane so lower trachea ends neatly inside the X-Ray neck above the pedestal
    this.bottomClipPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0.98);

    this.cutawayEnabled = true;

    const palateTex = createPalateTextures();

    // Premium Studio PBR Materials (utilizing RoomEnvironment IBL reflections!)
    this.materials = {
      // Porcelain-enamel anatomical teeth (balanced studio albedo so every cusp reads sharp!)
      toothSolid: new THREE.MeshPhysicalMaterial({
        color: '#ebe4d5',
        roughness: 0.20,
        metalness: 0.0,
        clearcoat: 0.85,
        clearcoatRoughness: 0.16,
        ior: 1.54,
        side: THREE.DoubleSide,
      }),
      toothClipped: new THREE.MeshPhysicalMaterial({
        color: '#ebe4d5',
        roughness: 0.20,
        metalness: 0.0,
        clearcoat: 0.85,
        clearcoatRoughness: 0.16,
        ior: 1.54,
        clippingPlanes: [this.sagittalClipPlane],
        clipShadows: true,
        side: THREE.DoubleSide,
      }),

      // Moist healthy gingiva (gums)
      gum: new THREE.MeshPhysicalMaterial({
        color: '#e58398',
        roughness: 0.36,
        metalness: 0.0,
        clearcoat: 0.62,
        clearcoatRoughness: 0.24,
        sheen: 0.35,
        sheenColor: new THREE.Color('#ffdbe4'),
        clippingPlanes: [this.sagittalClipPlane],
        clipShadows: true,
        side: THREE.DoubleSide,
      }),

      // Sculpted ivory bone (maxilla, mandible, palatine, hyoid)
      boneClipped: new THREE.MeshPhysicalMaterial({
        color: '#d4cab8',
        roughness: 0.54,
        metalness: 0.02,
        clearcoat: 0.10,
        clippingPlanes: [this.sagittalClipPlane],
        clipShadows: true,
        side: THREE.DoubleSide,
      }),
      boneSoftTranslucent: new THREE.MeshPhysicalMaterial({
        color: '#d4cab8',
        roughness: 0.50,
        transparent: true,
        opacity: 0.30,
        depthWrite: false,
        clippingPlanes: [this.sagittalClipPlane],
        side: THREE.DoubleSide,
      }),
      hyoidBone: new THREE.MeshPhysicalMaterial({
        color: '#ded5c5',
        roughness: 0.45,
        clearcoat: 0.15,
        side: THREE.DoubleSide,
      }),

      // Wet mucosa soft palate & uvula
      palate: new THREE.MeshPhysicalMaterial({
        map: palateTex.map,
        normalMap: palateTex.normalMap,
        normalScale: new THREE.Vector2(0.75, 0.75),
        color: '#f0a6b5',
        roughness: 0.38,
        clearcoat: 0.58,
        clearcoatRoughness: 0.26,
        sheen: 0.32,
        sheenColor: new THREE.Color('#ffe0e8'),
        clippingPlanes: [this.sagittalClipPlane],
        clipShadows: true,
        side: THREE.DoubleSide,
      }),
      uvula: new THREE.MeshPhysicalMaterial({
        color: '#e88da1',
        roughness: 0.34,
        clearcoat: 0.65,
        clearcoatRoughness: 0.22,
        side: THREE.DoubleSide,
      }),

      // Al-Khaisyum (real anatomical nasal cavity & nasopharynx) — frosted silver-smoke glass
      nasalCavity: new THREE.MeshPhysicalMaterial({
        color: '#a3a3a3',
        emissive: new THREE.Color('#ffffff'),
        emissiveIntensity: 0.08,
        roughness: 0.25,
        clearcoat: 0.55,
        transparent: true,
        opacity: 0.30,
        depthWrite: false,
        clippingPlanes: [this.sagittalClipPlane],
        side: THREE.DoubleSide,
      }),
      nasalTurbinate: new THREE.MeshPhysicalMaterial({
        color: '#c9a6b0',
        emissive: new THREE.Color('#525252'),
        emissiveIntensity: 0.06,
        roughness: 0.42,
        clearcoat: 0.35,
        transparent: true,
        opacity: 0.65,
        clippingPlanes: [this.sagittalClipPlane],
        side: THREE.DoubleSide,
      }),
      noseCartilage: new THREE.MeshPhysicalMaterial({
        color: '#d4d4d4',
        roughness: 0.30,
        clearcoat: 0.45,
        transparent: true,
        opacity: 0.24,
        depthWrite: false,
        clippingPlanes: [this.sagittalClipPlane],
        side: THREE.DoubleSide,
      }),

      // Al-Halq (real anatomical larynx, epiglottis, vocal folds, trachea)
      larynxCartilage: new THREE.MeshPhysicalMaterial({
        color: '#d4d4d4',
        roughness: 0.34,
        metalness: 0.02,
        clearcoat: 0.40,
        transparent: true,
        opacity: 0.50,
        clippingPlanes: [this.sagittalClipPlane, this.bottomClipPlane],
        side: THREE.DoubleSide,
      }),
      trachea: new THREE.MeshPhysicalMaterial({
        color: '#dadada',
        roughness: 0.38,
        clearcoat: 0.32,
        clippingPlanes: [this.sagittalClipPlane, this.bottomClipPlane],
        side: THREE.DoubleSide,
      }),
      epiglottis: new THREE.MeshPhysicalMaterial({
        color: '#f2a2b4',
        emissive: new THREE.Color('#fb7185'),
        emissiveIntensity: 0.18,
        roughness: 0.34,
        clearcoat: 0.55,
        side: THREE.DoubleSide,
      }),
      vocalFolds: new THREE.MeshPhysicalMaterial({
        color: '#fff4f6',
        emissive: new THREE.Color('#fb7185'),
        emissiveIntensity: 0.32,
        roughness: 0.22,
        clearcoat: 0.72,
        side: THREE.DoubleSide,
      }),

      // Subtle posterior pharyngeal mucosa wall
      pharynxWall: new THREE.MeshPhysicalMaterial({
        color: '#d27c92',
        roughness: 0.46,
        clearcoat: 0.35,
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
        clippingPlanes: [this.sagittalClipPlane, this.bottomClipPlane],
        side: THREE.DoubleSide,
      }),
    };

    // Articulated Jaw Pivot aligned to real BodyParts3D TMJ condyles
    this.jawPivot = new THREE.Group();
    this.jawPivot.position.set(0, 0.645, -0.303);
    this.group.add(this.jawPivot);

    // References to animated real anatomical meshes once GLBs load
    this.epiglottisPivot = null;
    this.vocalFoldsMeshes = [];
    this.throatRings = [];

    this._buildSoftPalateAndPharynxBridge();
    this._loadAnatomicalModels();
  }

  /**
   * Builds the smooth wet-mucosa Hard/Soft Palate vault + Uvula + 3 subtle Al-Halq zone rings
   * that seamlessly connect the real maxilla/palatine bone to the real nasopharynx & larynx.
   */
  _buildSoftPalateAndPharynxBridge() {
    // Vaulted mucosal soft palate & hard palate lining
    const segZ = 24;
    const segX = 20;
    const positions = [];
    const uvs = [];
    const indices = [];

    const roofCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.16, 0.72), // Alveolar ridge behind upper incisors
      new THREE.Vector3(0, 0.28, 0.56), // Anterior hard palate
      new THREE.Vector3(0, 0.38, 0.28), // Mid hard palate dome
      new THREE.Vector3(0, 0.36, 0.02), // Hard/soft palate junction
      new THREE.Vector3(0, 0.28, -0.18), // Soft palate velum
      new THREE.Vector3(0, 0.16, -0.27), // Base of uvula
    ]);

    for (let iz = 0; iz <= segZ; iz++) {
      const tz = iz / segZ;
      const center = roofCurve.getPoint(tz);
      const halfSpan = 0.36 * Math.sin(0.28 + tz * 2.5) + 0.06;

      for (let ix = 0; ix <= segX; ix++) {
        const tx = ix / segX;
        const angle = (tx - 0.5) * Math.PI;
        const x = Math.sin(angle) * halfSpan;
        const archDrop = (1.0 - Math.cos(angle)) * 0.18;
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

    const palateGeo = new THREE.BufferGeometry();
    palateGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    palateGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    palateGeo.setIndex(indices);
    palateGeo.computeVertexNormals();

    this.palateMesh = new THREE.Mesh(palateGeo, this.materials.palate);
    this.palateMesh.receiveShadow = true;
    this.group.add(this.palateMesh);

    // Sculpted Uvula (Anak Tekak) swinging smoothly for Nasal Ghunnah
    this.uvulaPivot = new THREE.Group();
    this.uvulaPivot.position.set(0, 0.20, -0.23);
    this.group.add(this.uvulaPivot);

    const uvulaGeo = new THREE.CapsuleGeometry(0.042, 0.11, 10, 18);
    this.uvulaMesh = new THREE.Mesh(uvulaGeo, this.materials.uvula);
    this.uvulaMesh.position.set(0, -0.065, -0.025);
    this.uvulaMesh.rotation.x = 0.28;
    this.uvulaMesh.castShadow = true;
    this.uvulaPivot.add(this.uvulaMesh);

    // Subtle translucent posterior pharyngeal airway wall connecting nasopharynx to larynx
    const pharynxCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.34, -0.34),
      new THREE.Vector3(0, 0.02, -0.40),
      new THREE.Vector3(0, -0.40, -0.43),
      new THREE.Vector3(0, -0.95, -0.43),
    ]);
    const pharynxGeo = new THREE.TubeGeometry(pharynxCurve, 28, 0.215, 24, false);
    const pharynxMesh = new THREE.Mesh(pharynxGeo, this.materials.pharynxWall);
    pharynxMesh.renderOrder = 3;
    this.group.add(pharynxMesh);

    // 3 Delicate Luminous Al-Halq Level Rings:
    // 0: Aqshal Halq (Bawah: ء ه), 1: Wasathul Halq (Tengah: ع ح), 2: Adnal Halq (Atas: غ خ)
    const ringCoords = [
      { y: -0.73, z: -0.42, r: 0.23 },
      { y: -0.35, z: -0.41, r: 0.23 },
      { y: 0.04, z: -0.35, r: 0.22 },
    ];
    ringCoords.forEach(({ y, z, r }) => {
      const geo = new THREE.TorusGeometry(r, 0.010, 12, 48);
      const mat = new THREE.MeshStandardMaterial({
        color: '#a3a3a3',
        emissive: new THREE.Color('#ffffff'),
        emissiveIntensity: 0.12,
        roughness: 0.25,
        transparent: true,
        opacity: 0.34,
      });
      const ring = new THREE.Mesh(geo, mat);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(0, y, z);
      this.group.add(ring);
      this.throatRings.push(ring);
    });
  }

  _loadAnatomicalModels() {
    const loader = new GLTFLoader(this.loadingManager);

    // ------------------------------------------------------------------------
    // 1. REAL BODYPARTS3D TEETH, GUMS, MAXILLAE & ARTICULATED MANDIBLE
    // ------------------------------------------------------------------------
    loader.load('./models/teeth.glb', (gltf) => {
      const scale = 0.525;
      const offsetY = 0.32;
      const offsetZ = 0.18;

      const upperGroup = new THREE.Group();
      upperGroup.scale.setScalar(scale);
      upperGroup.position.set(0, offsetY, offsetZ);
      this.group.add(upperGroup);

      // Lower container positioned cleanly relative to TMJ jawPivot (0, 0.645, -0.303)
      const lowerGroup = new THREE.Group();
      lowerGroup.scale.setScalar(scale);
      lowerGroup.position.set(0, offsetY - 0.645, offsetZ - -0.303);
      this.jawPivot.add(lowerGroup);

      const meshes = [];
      gltf.scene.traverse((obj) => {
        if (obj.isMesh) meshes.push(obj);
      });

      meshes.forEach((mesh) => {
        const name = (mesh.name || '').toLowerCase();
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        const isLower = name.startsWith('lower-') || name === 'mandible';
        const isLeftNearSide = name.includes('-left-') || name.startsWith('left-');
        const isIncisor = name.includes('central-incisor') || name.includes('lateral-incisor');

        if (name === 'upper-gum' || name === 'lower-gum') {
          mesh.material = this.materials.gum;
        } else if (name === 'right-maxilla' || name === 'left-maxilla') {
          // Keep far maxilla subtle translucent ivory & clip near maxilla cleanly so teeth & nasal vault shine
          mesh.material = this.materials.boneSoftTranslucent;
          mesh.castShadow = false;
        } else if (name === 'mandible') {
          mesh.material = this.materials.boneClipped;
        } else {
          // 28 individual anatomical teeth!
          // Near-side (+X left) canines/premolars/molars obey sagittal clip so side view opens cleanly,
          // while front incisors stay solid & ALL 28 teeth show solid in Dhad / Front views!
          mesh.material =
            isLeftNearSide && !isIncisor
              ? this.materials.toothClipped
              : this.materials.toothSolid;
        }

        if (isLower) {
          lowerGroup.add(mesh);
        } else {
          upperGroup.add(mesh);
        }
      });
    });

    // ------------------------------------------------------------------------
    // 2. REAL BODYPARTS3D NASAL CAVITY (AL-KHAISYUM), CONCHAE & NASOPHARYNX
    // ------------------------------------------------------------------------
    loader.load('./models/nose.glb', (gltf) => {
      const noseGroup = new THREE.Group();
      // Tucked cleanly inside facecap.glb's sculpted nose bridge & above hard palate
      noseGroup.scale.setScalar(0.455);
      noseGroup.position.set(0, 0.85, 0.24);
      this.group.add(noseGroup);

      const keepMeshes = new Set([
        'nasal-cavity',
        'nasopharynx',
        'inferior-conchae',
        'palatine-bones',
      ]);

      const meshes = [];
      gltf.scene.traverse((obj) => {
        if (obj.isMesh) meshes.push(obj);
      });

      meshes.forEach((mesh) => {
        const name = (mesh.name || '').toLowerCase();
        if (!keepMeshes.has(name)) return;

        if (name === 'nasal-cavity' || name === 'nasopharynx') {
          mesh.material = this.materials.nasalCavity;
          mesh.renderOrder = 4;
        } else if (name === 'inferior-conchae') {
          mesh.material = this.materials.nasalTurbinate;
          mesh.renderOrder = 5;
        } else if (name === 'palatine-bones') {
          mesh.material = this.materials.boneClipped;
          mesh.receiveShadow = true;
        } else {
          mesh.material = this.materials.noseCartilage;
          mesh.renderOrder = 6;
        }
        noseGroup.add(mesh);
      });
    });

    // ------------------------------------------------------------------------
    // 3. REAL BODYPARTS3D LARYNX, HYOID, EPIGLOTTIS, VOCAL FOLDS & TRACHEA (AL-HALQ)
    // ------------------------------------------------------------------------
    loader.load('./models/larynx.glb', (gltf) => {
      const larynxGroup = new THREE.Group();
      larynxGroup.scale.setScalar(0.68);
      larynxGroup.position.set(0, -1.16, -0.42);
      this.group.add(larynxGroup);

      const keepMeshes = new Set([
        'hyoid-bone',
        'thyroid-cartilage',
        'cricoid-cartilage',
        'epiglottis',
        'arytenoid-cartilages',
        'corniculate-cuneiform-cartilages',
        'vocal-ligaments',
        'vocalis',
        'trachea',
      ]);

      const meshes = [];
      gltf.scene.traverse((obj) => {
        if (obj.isMesh) meshes.push(obj);
      });

      meshes.forEach((mesh) => {
        const name = (mesh.name || '').toLowerCase();
        if (!keepMeshes.has(name)) return;

        mesh.castShadow = true;
        mesh.receiveShadow = true;

        if (name === 'hyoid-bone') {
          mesh.material = this.materials.hyoidBone;
          larynxGroup.add(mesh);
        } else if (name === 'epiglottis') {
          // Wrap epiglottis around its anatomical base pivot (y=0.74, z=0.14 in larynx space)
          // so it tilts realistically backward during ع and ح (Wasathul Halq)!
          const pivot = new THREE.Group();
          pivot.position.set(0, 0.74, 0.14);
          mesh.position.set(0, -0.74, -0.14);
          mesh.material = this.materials.epiglottis;
          pivot.add(mesh);
          larynxGroup.add(pivot);
          this.epiglottisPivot = pivot;
        } else if (name === 'vocal-ligaments' || name === 'vocalis') {
          mesh.material = this.materials.vocalFolds;
          larynxGroup.add(mesh);
          this.vocalFoldsMeshes.push(mesh);
        } else if (name === 'trachea') {
          mesh.material = this.materials.trachea;
          larynxGroup.add(mesh);
        } else {
          // Translucent pearlescent laryngeal cartilages so glowing vocal cords stay visible inside!
          mesh.material = this.materials.larynxCartilage;
          mesh.castShadow = false;
          mesh.renderOrder = 5;
          larynxGroup.add(mesh);
        }
      });
    });
  }

  /**
   * Syncs internal sagittal cutaway clipping plane with the user's Cutaway slider.
   */
  setCutaway(enabled, clipX = 0.14) {
    this.cutawayEnabled = enabled;
    // Offset slightly +0.06 so central incisors & midline stay crisp and solid
    this.sagittalClipPlane.constant = enabled ? Math.max(0.06, clipX + 0.06) : 5.0;
  }

  /**
   * Animates the real anatomical mandible hinge, uvula, Al-Khaisyum glow,
   * epiglottis tilt, and vocal folds resonance in real time!
   */
  updatePose(pose, letter, time = 0, audioLevel = 0) {
    // 1. Real anatomical mandible & 14 lower teeth TMJ hinge rotation
    const jawAngle = (pose.jawOpen + audioLevel * 0.11) * 0.28;
    this.jawPivot.rotation.x = jawAngle;

    // 2. Soft Palate / Uvula swings open when Nasal Ghunnah is active (Nun/Mim)
    const isNasal = Boolean(letter?.airflow?.nasal);
    const targetUvulaRot = isNasal ? 0.55 : -0.05;
    this.uvulaPivot.rotation.x = THREE.MathUtils.lerp(
      this.uvulaPivot.rotation.x,
      targetUvulaRot,
      0.14
    );

    // 3. Real Al-Khaisyum (nasal-cavity & nasopharynx) illuminates bright silver-white on Ghunnah
    const targetNasalOp = isNasal
      ? 0.52 + Math.sin(time * 5.0) * 0.06 + audioLevel * 0.18
      : 0.22;
    const targetNasalEmissive = isNasal ? 0.65 + audioLevel * 0.85 : 0.06;
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

    // 4. Al-Halq 3-level luminous rings
    this.throatRings.forEach((ring, idx) => {
      const active = pose.throatZone === idx;
      const targetEmissive = active
        ? 1.8 + Math.sin(time * 6.5) * 0.45 + audioLevel * 1.4
        : 0.14;
      const targetScale = active ? 1.04 + Math.sin(time * 7.0) * 0.035 : 0.98;
      ring.material.emissiveIntensity = THREE.MathUtils.lerp(
        ring.material.emissiveIntensity,
        targetEmissive,
        0.15
      );
      ring.material.opacity = THREE.MathUtils.lerp(
        ring.material.opacity,
        active ? 0.92 : 0.24,
        0.15
      );
      ring.scale.setScalar(targetScale);
    });

    // 5. Real Epiglottis tilts posteriorly on ع and ح (Wasathul Halq)
    if (this.epiglottisPivot) {
      const activeMidThroat = pose.throatZone === 1;
      const targetTilt = activeMidThroat ? -pose.throatPinch * 0.46 : 0.0;
      this.epiglottisPivot.rotation.x = THREE.MathUtils.lerp(
        this.epiglottisPivot.rotation.x,
        targetTilt,
        0.14
      );
      const epiEmissive = activeMidThroat ? 1.05 + audioLevel * 0.9 : 0.14;
      this.materials.epiglottis.emissiveIntensity = THREE.MathUtils.lerp(
        this.materials.epiglottis.emissiveIntensity,
        epiEmissive,
        0.14
      );
    }

    // 6. Real Vocal Folds (vocalis + vocal-ligaments) glow & micro-vibrate on ء / ه & voiced sounds!
    const activeLowThroat = pose.throatZone === 0;
    const voiced = Boolean(letter?.airflow?.throatPulse) || audioLevel > 0.05;
    const vocalEmissive = activeLowThroat
      ? 1.5 + audioLevel * 1.3
      : voiced
        ? 0.45 + audioLevel * 0.9
        : 0.18;
    this.materials.vocalFolds.emissiveIntensity = THREE.MathUtils.lerp(
      this.materials.vocalFolds.emissiveIntensity,
      vocalEmissive,
      0.16
    );
    if (this.vocalFoldsMeshes.length > 0) {
      const vib = voiced ? 1.0 + Math.sin(time * 42.0) * (0.04 + audioLevel * 0.10) : 1.0;
      this.vocalFoldsMeshes.forEach((m) => {
        m.scale.set(vib, 1.0, 1.0);
      });
    }
  }
}
