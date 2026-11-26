import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  applySubsurfaceScattering,
  applySolidCutInterior,
  createBoneTextures,
  createMuscleTextures,
  createPalateTextures,
} from './TextureGenerator.js';

/**
 * VocalTract — 1:1 MRI-Registered Makharijul Huruf Anatomy Atlas (BodyParts3D / OrganUI, CC BY-SA 2.1)
 *
 * Loads 54 curated 1:1 MRI speech organs (`anatomy_head_1to1.glb`) with:
 *   1. Volumetric, dynamically moving Hard-to-Soft Palate & Velum (seals nasal passage on oral letters,
 *      drops visibly to open Al-Khaisyum velopharyngeal port during Ghunnah ن / م!)
 *   2. Real Stencil-Buffer Solid Cross-Section Cap on the articulating mandible + solid interior shading
 *      on clipped bone, gums & trachea (eliminates hollow-shell look!)
 *   3. Real Glottal Vocal-Fold Adduction & Abduction (closes tightly on ء Hamzah, opens wide on ه Ha!)
 *   4. Physical Pharyngeal Wall Constriction (middle constrictor contracts on ع/ح, superior on خ/غ!)
 */

const PALATE_SEG_Z = 18;
const PALATE_SEG_X = 12;

export class VocalTract {
  constructor(parentGroup, loadingManager = undefined) {
    this.group = new THREE.Group();
    this.loadingManager = loadingManager;
    parentGroup.add(this.group);

    this.sagittalClipPlane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0.08);
    this.bottomClipPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 1.06);
    this.cutawayEnabled = true;

    this.layers = {
      jaw: new THREE.Group(),
      nasal: new THREE.Group(),
      pharynx: new THREE.Group(),
    };
    this.group.add(this.layers.jaw, this.layers.nasal, this.layers.pharynx);

    // Exact 1:1 MRI TMJ condyle hinge pivot
    this.jawPivot = new THREE.Group();
    this.jawPivot.position.set(0, 0.65, -0.38);
    this.layers.jaw.add(this.jawPivot);

    // Dynamic anatomical animation references
    this.epiglottisPivot = null;
    this.uvulaPivot = null;
    this.vocalFoldEntries = []; // { mesh, basePos }
    this.pharynxUpperMeshes = [];
    this.pharynxMidMeshes = [];
    this.pharynxZoneMats = { upper: null, mid: null, lower: null };

    // Volumetric dynamic palate-velum state
    this.velumOpenState = 0.0; // 0 = lifted (oral seal), 1 = dropped (Ghunnah nasal port open!)
    this.palateGeo = null;
    this._palateOralCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.165, 0.635),
      new THREE.Vector3(0, 0.245, 0.48),
      new THREE.Vector3(0, 0.295, 0.24),
      new THREE.Vector3(0, 0.295, -0.02),
      new THREE.Vector3(0, 0.265, -0.20),
      new THREE.Vector3(0, 0.215, -0.33),
    ]);

    // Stencil solid cross-section cap plane for mandible
    this.mandibleCapPlane = null;
    this.mandibleStencilGroup = null;

    this._initMaterials();
    this._buildDynamicPalateVelum();
    this._loadUnifiedAnatomyGLB();
  }

  _initMaterials() {
    const boneTex = createBoneTextures();
    const muscleTex = createMuscleTextures();
    const palateTex = createPalateTextures();

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
          side: clipped ? THREE.DoubleSide : THREE.FrontSide,
        }),
        { color: '#f5dec0', intensity: 0.22, power: 2.8, wrap: 0.35 }
      );

    const gumMat = applySolidCutInterior(
      applySubsurfaceScattering(
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
      ),
      { tint: '#a64557', mixFactor: 0.46, darken: 0.72 }
    );

    const boneSolidClipped = applySolidCutInterior(
      new THREE.MeshPhysicalMaterial({
        color: '#d8cfc0',
        normalMap: boneTex.normalMap,
        normalScale: new THREE.Vector2(0.45, 0.45),
        roughness: 0.56,
        metalness: 0.01,
        clearcoat: 0.08,
        clippingPlanes: [this.sagittalClipPlane, this.bottomClipPlane],
        clipShadows: true,
        side: THREE.DoubleSide,
      }),
      { tint: '#bcae98', mixFactor: 0.55, darken: 0.68 }
    );

    // Optimized lightweight StandardMaterial for the 85k-tri background pharyngeal constrictors
    // (preserves rich striated normalMap + solid cut interior shading at ~3x lower GPU cost!)
    const makePharynxMuscle = () =>
      applySolidCutInterior(
        new THREE.MeshStandardMaterial({
          map: muscleTex.map,
          normalMap: muscleTex.normalMap,
          normalScale: new THREE.Vector2(0.65, 0.65),
          color: '#b85b6c',
          emissive: new THREE.Color('#ffffff'),
          emissiveIntensity: 0.0,
          roughness: 0.46,
          metalness: 0.0,
          clippingPlanes: [this.sagittalClipPlane, this.bottomClipPlane],
          side: THREE.DoubleSide,
        }),
        { tint: '#7f3342', mixFactor: 0.44, darken: 0.65 }
      );

    this.pharynxZoneMats.upper = makePharynxMuscle();
    this.pharynxZoneMats.mid = makePharynxMuscle();
    this.pharynxZoneMats.lower = makePharynxMuscle();

    const uvulaMat = applySubsurfaceScattering(
      new THREE.MeshPhysicalMaterial({
        color: '#d67488',
        emissive: new THREE.Color('#ffffff'),
        emissiveIntensity: 0.02,
        roughness: 0.32,
        clearcoat: 0.70,
        clearcoatRoughness: 0.22,
        side: THREE.FrontSide,
      }),
      { color: '#c42b44', intensity: 0.45, power: 2.2, wrap: 0.45 }
    );

    const palateMucosa = applySolidCutInterior(
      applySubsurfaceScattering(
        new THREE.MeshPhysicalMaterial({
          map: palateTex.map,
          normalMap: palateTex.normalMap,
          normalScale: new THREE.Vector2(0.70, 0.70),
          color: '#dd8e9e',
          roughness: 0.38,
          clearcoat: 0.58,
          clearcoatRoughness: 0.26,
          sheen: 0.30,
          sheenColor: new THREE.Color('#ffe0e8'),
          clippingPlanes: [this.sagittalClipPlane],
          clipShadows: true,
          side: THREE.DoubleSide,
        }),
        { color: '#bf3048', intensity: 0.35, power: 2.4, wrap: 0.4 }
      ),
      { tint: '#b25b6d', mixFactor: 0.50, darken: 0.74 }
    );

    const nasalCavityMat = new THREE.MeshStandardMaterial({
      color: '#b8b8b8',
      emissive: new THREE.Color('#ffffff'),
      emissiveIntensity: 0.05,
      roughness: 0.32,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      clippingPlanes: [this.sagittalClipPlane],
      side: THREE.DoubleSide,
    });

    const nasalTurbinateMat = new THREE.MeshStandardMaterial({
      color: '#c98896',
      roughness: 0.44,
      clippingPlanes: [this.sagittalClipPlane],
      side: THREE.DoubleSide,
    });

    const nasalCartilageMat = new THREE.MeshStandardMaterial({
      color: '#d4d4d4',
      roughness: 0.38,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      clippingPlanes: [this.sagittalClipPlane],
      side: THREE.DoubleSide,
    });

    const larynxCartilageMat = new THREE.MeshStandardMaterial({
      color: '#d6d8de',
      roughness: 0.36,
      transparent: true,
      opacity: 0.50,
      clippingPlanes: [this.sagittalClipPlane, this.bottomClipPlane],
      side: THREE.DoubleSide,
    });

    const tracheaMat = applySolidCutInterior(
      new THREE.MeshStandardMaterial({
        color: '#d8d9de',
        normalMap: boneTex.normalMap,
        normalScale: new THREE.Vector2(0.25, 0.25),
        roughness: 0.42,
        clippingPlanes: [this.sagittalClipPlane, this.bottomClipPlane],
        side: THREE.DoubleSide,
      }),
      { tint: '#b6b8bf', mixFactor: 0.48, darken: 0.72 }
    );

    const epiglottisMat = applySubsurfaceScattering(
      new THREE.MeshPhysicalMaterial({
        color: '#df95a4',
        emissive: new THREE.Color('#ffffff'),
        emissiveIntensity: 0.04,
        roughness: 0.34,
        clearcoat: 0.56,
        side: THREE.FrontSide,
      }),
      { color: '#c4324c', intensity: 0.42, power: 2.3, wrap: 0.45 }
    );

    const vocalFoldsMat = new THREE.MeshStandardMaterial({
      color: '#f8f5f2',
      emissive: new THREE.Color('#ffffff'),
      emissiveIntensity: 0.14,
      roughness: 0.26,
      side: THREE.FrontSide,
    });

    this.materials = {
      toothSolid: makeToothMat(false),
      toothClipped: makeToothMat(true),
      gum: gumMat,
      boneClipped: boneSolidClipped,
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
   * Builds a CLOSED, VOLUMETRIC 3D Hard-to-Soft Palate & Velum cushion (bottom oral surface
   * + top nasal floor + solid anterior/posterior edge closures) whose rear velum dynamically
   * rises to seal the nasopharynx on oral letters and drops to open Al-Khaisyum on Ghunnah (ن/م)!
   */
  _buildDynamicPalateVelum() {
    const ringCount = (PALATE_SEG_X + 1) * 2; // bottom row (0..segX) + top row (segX+1..2*segX+1)
    const vertCount = (PALATE_SEG_Z + 1) * ringCount;
    const positions = new Float32Array(vertCount * 3);
    const uvs = new Float32Array(vertCount * 2);
    const indices = [];

    for (let iz = 0; iz <= PALATE_SEG_Z; iz++) {
      const tz = iz / PALATE_SEG_Z;
      for (let ix = 0; ix <= PALATE_SEG_X; ix++) {
        const tx = ix / PALATE_SEG_X;
        const botIdx = iz * ringCount + ix;
        const topIdx = iz * ringCount + (PALATE_SEG_X + 1 + ix);
        uvs[botIdx * 2] = tx;
        uvs[botIdx * 2 + 1] = tz;
        uvs[topIdx * 2] = tx;
        uvs[topIdx * 2 + 1] = tz;
      }
    }

    // Bottom oral surface & Top nasal surface
    for (let iz = 0; iz < PALATE_SEG_Z; iz++) {
      for (let ix = 0; ix < PALATE_SEG_X; ix++) {
        const bA = iz * ringCount + ix;
        const bB = (iz + 1) * ringCount + ix;
        const bC = (iz + 1) * ringCount + (ix + 1);
        const bD = iz * ringCount + (ix + 1);
        indices.push(bA, bD, bB, bB, bD, bC);

        const off = PALATE_SEG_X + 1;
        const tA = bA + off;
        const tB = bB + off;
        const tC = bC + off;
        const tD = bD + off;
        indices.push(tA, tB, tD, tB, tC, tD);
      }

      // Close left & right lateral borders
      const lB0 = iz * ringCount;
      const lB1 = (iz + 1) * ringCount;
      const lT0 = lB0 + PALATE_SEG_X + 1;
      const lT1 = lB1 + PALATE_SEG_X + 1;
      indices.push(lB0, lB1, lT0, lB1, lT1, lT0);

      const rB0 = iz * ringCount + PALATE_SEG_X;
      const rB1 = (iz + 1) * ringCount + PALATE_SEG_X;
      const rT0 = rB0 + PALATE_SEG_X + 1;
      const rT1 = rB1 + PALATE_SEG_X + 1;
      indices.push(rB0, rT0, rB1, rB1, rT0, rT1);
    }

    // Close posterior velar free edge (iz = PALATE_SEG_Z) and anterior alveolar edge (iz = 0)
    for (let ix = 0; ix < PALATE_SEG_X; ix++) {
      const fB0 = ix;
      const fB1 = ix + 1;
      const fT0 = fB0 + PALATE_SEG_X + 1;
      const fT1 = fB1 + PALATE_SEG_X + 1;
      indices.push(fB0, fT0, fB1, fB1, fT0, fT1);

      const pBase = PALATE_SEG_Z * ringCount;
      const pB0 = pBase + ix;
      const pB1 = pBase + ix + 1;
      const pT0 = pB0 + PALATE_SEG_X + 1;
      const pT1 = pB1 + PALATE_SEG_X + 1;
      indices.push(pB0, pB1, pT0, pB1, pT1, pT0);
    }

    this.palateGeo = new THREE.BufferGeometry();
    this.palateGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.palateGeo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    this.palateGeo.setIndex(indices);

    this._updatePalateVelum(0.0);

    const palateMesh = new THREE.Mesh(this.palateGeo, this.materials.palateMucosa);
    palateMesh.castShadow = true;
    palateMesh.receiveShadow = true;
    this.layers.pharynx.add(palateMesh);
  }

  /**
   * Deforms the volumetric soft palate / velum smoothly:
   *  velumOpen = 0.0 -> Rear velum elevated & touching nasopharyngeal wall (oral seal)
   *  velumOpen = 1.0 -> Rear velum dropped downward & forward (opens Al-Khaisyum for Ghunnah!)
   */
  _updatePalateVelum(velumOpen) {
    if (!this.palateGeo) return;
    const posAttr = this.palateGeo.attributes.position;
    const arr = posAttr.array;
    const ringCount = (PALATE_SEG_X + 1) * 2;
    const pt = new THREE.Vector3();

    for (let iz = 0; iz <= PALATE_SEG_Z; iz++) {
      const tz = iz / PALATE_SEG_Z;
      this._palateOralCurve.getPoint(tz, pt);

      // Mobile soft palate / velum zone begins smoothly behind the hard/soft junction (tz > 0.56)
      const mobile = THREE.MathUtils.smoothstep(tz, 0.54, 1.0);
      // At velumOpen=0 (oral): lift rear velum slightly back (+0.032 Y, -0.025 Z) to seal nasopharynx
      // At velumOpen=1 (Ghunnah ن/م): drop velum cleanly (-0.048 Y, +0.042 Z) to open nasal port!
      const velumDY = mobile * THREE.MathUtils.lerp(0.028, -0.048, velumOpen);
      const velumDZ = mobile * THREE.MathUtils.lerp(-0.024, 0.044, velumOpen);

      const centerY = pt.y + velumDY;
      const centerZ = pt.z + velumDZ;

      const halfSpan = 0.29 * Math.sin(0.28 + tz * 2.48) + 0.055;
      // Fleshy anatomical thickness: thicker muscular velum (~0.062), tapering neatly at alveolar & uvular tips
      const thickness = 0.032 + 0.036 * Math.sin(tz * Math.PI * 0.92);

      for (let ix = 0; ix <= PALATE_SEG_X; ix++) {
        const tx = ix / PALATE_SEG_X;
        const angle = (tx - 0.5) * Math.PI;
        const x = Math.sin(angle) * halfSpan;
        const archDrop = (1.0 - Math.cos(angle)) * 0.12;

        // Bottom oral surface (preserves exact 1:1 calibrated contact heights!)
        const bIdx = (iz * ringCount + ix) * 3;
        arr[bIdx] = x;
        arr[bIdx + 1] = centerY - archDrop;
        arr[bIdx + 2] = centerZ;

        // Top nasal floor surface (smoother, flatter cranial ceiling of palate)
        const tIdx = (iz * ringCount + (PALATE_SEG_X + 1 + ix)) * 3;
        arr[tIdx] = x * 0.96;
        arr[tIdx + 1] = centerY - archDrop * 0.55 + thickness;
        arr[tIdx + 2] = centerZ + mobile * 0.012;
      }
    }

    posAttr.needsUpdate = true;
    this.palateGeo.computeVertexNormals();
  }

  /**
   * Builds a true WebGL2 Stencil-Buffer Cross-Section Cap for the articulating mandible
   * so slicing the lower jaw in Sagital view renders solid warm trabecular bone instead of a hollow shell!
   */
  _setupMandibleStencilCap(mandibleMesh, lowerJawContainer) {
    const geo = mandibleMesh.geometry;
    const stencilGroup = new THREE.Group();

    const baseStencilMat = {
      depthWrite: false,
      depthTest: false,
      colorWrite: false,
      stencilWrite: true,
      stencilFunc: THREE.AlwaysStencilFunc,
      clippingPlanes: [this.sagittalClipPlane, this.bottomClipPlane],
    };

    const backMat = new THREE.MeshBasicMaterial({
      ...baseStencilMat,
      side: THREE.BackSide,
      stencilFail: THREE.IncrementWrapStencilOp,
      stencilZFail: THREE.IncrementWrapStencilOp,
      stencilZPass: THREE.IncrementWrapStencilOp,
    });
    const backMesh = new THREE.Mesh(geo, backMat);
    backMesh.renderOrder = 1;

    const frontMat = new THREE.MeshBasicMaterial({
      ...baseStencilMat,
      side: THREE.FrontSide,
      stencilFail: THREE.DecrementWrapStencilOp,
      stencilZFail: THREE.DecrementWrapStencilOp,
      stencilZPass: THREE.DecrementWrapStencilOp,
    });
    const frontMesh = new THREE.Mesh(geo, frontMat);
    frontMesh.renderOrder = 1;

    stencilGroup.add(backMesh, frontMesh);
    lowerJawContainer.add(stencilGroup);
    this.mandibleStencilGroup = stencilGroup;

    // Warm matte trabecular cross-section bone cap plane aligned directly onto sagittalClipPlane!
    const capMat = new THREE.MeshStandardMaterial({
      color: '#ccc0aa',
      roughness: 0.72,
      metalness: 0.0,
      clippingPlanes: [this.bottomClipPlane],
      stencilWrite: true,
      stencilRef: 0,
      stencilFunc: THREE.NotEqualStencilFunc,
      stencilFail: THREE.ReplaceStencilOp,
      stencilZFail: THREE.ReplaceStencilOp,
      stencilZPass: THREE.ReplaceStencilOp,
    });
    const capPlane = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.9), capMat);
    capPlane.rotation.y = Math.PI * 0.5; // Normal faces +X (toward sagittal side camera)
    capPlane.position.set(this.sagittalClipPlane.constant, -0.05, 0.12);
    capPlane.renderOrder = 2;
    this.layers.jaw.add(capPlane);
    this.mandibleCapPlane = capPlane;
  }

  _loadUnifiedAnatomyGLB() {
    const loader = new GLTFLoader(this.loadingManager);

    loader.load('./models/anatomy_head_1to1.glb', (gltf) => {
      const meshes = [];
      gltf.scene.traverse((obj) => {
        if (obj.isMesh) meshes.push(obj);
      });

      const lowerJawContainer = new THREE.Group();
      lowerJawContainer.position.set(0, -0.65, 0.38);
      this.jawPivot.add(lowerJawContainer);

      meshes.forEach((mesh) => {
        const rawName = mesh.name || '';
        const [groupName, partName] = rawName.includes('__')
          ? rawName.split('__')
          : ['misc', rawName];
        const part = partName.toLowerCase();

        // Only hero foreground organs (teeth, gums, mandible) cast shadows — skips >130k background shadow tris!
        const isShadowCaster =
          (groupName === 'upper_dental' && !part.includes('palatine')) ||
          groupName === 'lower_jaw';
        mesh.castShadow = isShadowCaster;
        mesh.receiveShadow = true;

        // 1. Upper Dental Arch
        if (groupName === 'upper_dental') {
          if (part === 'upper-gum') {
            mesh.material = this.materials.gum;
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

        // 2. Articulated Lower Jaw + Solid Mandible Stencil Cap
        if (groupName === 'lower_jaw') {
          if (part === 'lower-gum') {
            mesh.material = this.materials.gum;
          } else if (part === 'mandible') {
            mesh.material = this.materials.boneClipped;
            this._setupMandibleStencilCap(mesh, lowerJawContainer);
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

        // 3. Al-Khaisyum / Nasal Cavity
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

        // 4. Real Pharynx Muscular Wall & Real Musculus Uvulae (with physical constriction handles!)
        if (groupName === 'pharynx') {
          if (part === 'musculus-uvulae') {
            const uvPivot = new THREE.Group();
            uvPivot.position.set(0, 0.30, -0.33);
            mesh.position.set(0, -0.30, 0.33);
            mesh.material = this.materials.uvula;
            uvPivot.add(mesh);
            this.layers.pharynx.add(uvPivot);
            this.uvulaPivot = uvPivot;
          } else if (part === 'superior-constrictor' || part === 'levator-veli-palatini') {
            mesh.material = this.pharynxZoneMats.upper;
            this.layers.pharynx.add(mesh);
            if (part === 'superior-constrictor') {
              this.pharynxUpperMeshes.push(mesh);
            }
          } else if (part === 'middle-constrictor') {
            mesh.material = this.pharynxZoneMats.mid;
            this.layers.pharynx.add(mesh);
            this.pharynxMidMeshes.push(mesh);
          } else {
            mesh.material = this.pharynxZoneMats.lower;
            this.layers.pharynx.add(mesh);
          }
          return;
        }

        // 5. Real Larynx (Hyoid, Epiglottis, Real Adducting Vocal Folds, Cartilages, Trachea)
        if (groupName === 'larynx') {
          if (part === 'hyoid-bone') {
            mesh.material = this.materials.boneClipped;
            this.layers.pharynx.add(mesh);
          } else if (part === 'epiglottis') {
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
            const posAttr = mesh.geometry.attributes.position;
            if (posAttr) {
              this.vocalFoldEntries.push({
                mesh,
                basePos: new Float32Array(posAttr.array),
              });
            }
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

  setLayerVisible(layerName, visible) {
    if (this.layers[layerName]) {
      this.layers[layerName].visible = visible;
    }
  }

  setCutaway(enabled, clipX = 0.08) {
    this.cutawayEnabled = enabled;
    const planeConst = enabled ? Math.max(0.05, clipX + 0.04) : 5.0;
    this.sagittalClipPlane.constant = planeConst;

    const showCap = enabled && planeConst < 0.72;
    if (this.mandibleCapPlane) {
      this.mandibleCapPlane.visible = showCap;
      this.mandibleCapPlane.position.x = planeConst - 0.001;
    }
    if (this.mandibleStencilGroup) {
      this.mandibleStencilGroup.visible = showCap;
    }
  }

  /**
   * Real-time anatomical motion across jaw, dynamic velum, epiglottis, physical pharynx squeeze,
   * and true vocal-fold glottal adduction/abduction!
   */
  updatePose(pose, letter, time = 0, audioLevel = 0, releaseFactor = 0) {
    // 1. Real TMJ mandibular opening
    const jawAngle = (pose.jawOpen + audioLevel * 0.10) * 0.25;
    let moved = Math.abs(this.jawPivot.rotation.x - jawAngle) > 0.0005;
    this.jawPivot.rotation.x = jawAngle;

    // 2. Real Volumetric Soft Palate / Velum + Musculus Uvulae motion (Ghunnah ن / م)
    const isNasal = Boolean(letter?.airflow?.nasal);
    const targetVelumOpen = isNasal ? 1.0 : 0.0;
    if (Math.abs(this.velumOpenState - targetVelumOpen) > 0.002) {
      this.velumOpenState = THREE.MathUtils.lerp(this.velumOpenState, targetVelumOpen, 0.14);
      this._updatePalateVelum(this.velumOpenState);
      moved = true;
    }

    if (this.uvulaPivot) {
      const targetRot = isNasal ? 0.34 : -0.22;
      this.uvulaPivot.rotation.x = THREE.MathUtils.lerp(
        this.uvulaPivot.rotation.x,
        targetRot,
        0.14
      );
      this.uvulaPivot.position.y = THREE.MathUtils.lerp(
        this.uvulaPivot.position.y,
        isNasal ? 0.255 : 0.325,
        0.14
      );
      this.uvulaPivot.position.z = THREE.MathUtils.lerp(
        this.uvulaPivot.position.z,
        isNasal ? -0.295 : -0.352,
        0.14
      );
    }

    // 3. Real Al-Khaisyum illumination during Ghunnah
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

    // 4. Physical Pharyngeal Wall Constriction + Mucosal Zone Illumination (Al-Halq)
    const pulse = 0.22 + Math.sin(time * 5.5) * 0.06 + audioLevel * 0.35;
    const activeUpper = pose.throatZone === 2;
    const activeMid = pose.throatZone === 1;
    const activeLow = pose.throatZone === 0;

    this.pharynxZoneMats.upper.emissiveIntensity = THREE.MathUtils.lerp(
      this.pharynxZoneMats.upper.emissiveIntensity,
      activeUpper ? pulse : 0.0,
      0.14
    );
    this.pharynxZoneMats.mid.emissiveIntensity = THREE.MathUtils.lerp(
      this.pharynxZoneMats.mid.emissiveIntensity,
      activeMid ? pulse : 0.0,
      0.14
    );
    this.pharynxZoneMats.lower.emissiveIntensity = THREE.MathUtils.lerp(
      this.pharynxZoneMats.lower.emissiveIntensity,
      activeLow ? pulse : 0.0,
      0.14
    );

    // Physical anterior inward contraction of posterior pharyngeal constrictor walls!
    const upperSqueezeZ = activeUpper ? (pose.throatPinch || 0.5) * 0.052 : 0.0;
    const midSqueezeZ = activeMid ? (pose.throatPinch || 0.7) * 0.068 : 0.0;
    this.pharynxUpperMeshes.forEach((m) => {
      m.position.z = THREE.MathUtils.lerp(m.position.z, upperSqueezeZ, 0.14);
    });
    this.pharynxMidMeshes.forEach((m) => {
      m.position.z = THREE.MathUtils.lerp(m.position.z, midSqueezeZ, 0.14);
    });

    // 5. Real Epiglottis tilts posteriorly during Wasathul Halq (ع / ح)
    if (this.epiglottisPivot) {
      const targetTilt = activeMid ? -pose.throatPinch * 0.44 : 0.0;
      this.epiglottisPivot.rotation.x = THREE.MathUtils.lerp(
        this.epiglottisPivot.rotation.x,
        targetTilt,
        0.14
      );
      this.materials.epiglottis.emissiveIntensity = THREE.MathUtils.lerp(
        this.materials.epiglottis.emissiveIntensity,
        activeMid ? 0.45 + audioLevel * 0.55 : 0.02,
        0.14
      );
    }

    // 6. Real Physical Vocal-Fold Adduction (ء Hamzah tight seal -> sharp release) vs Abduction (ه Ha wide open)!
    const voiced = Boolean(letter?.airflow?.throatPulse) || audioLevel > 0.05;
    this.materials.vocalFolds.emissiveIntensity = THREE.MathUtils.lerp(
      this.materials.vocalFolds.emissiveIntensity,
      activeLow ? 0.95 + audioLevel * 0.9 : voiced ? 0.28 + audioLevel * 0.55 : 0.08,
      0.16
    );

    if (this.vocalFoldEntries.length > 0) {
      let targetSpread = 1.0; // 1.0 = neutral, <0.35 = tightly adducted (Hamzah), >1.65 = wide abducted (Ha)
      if (activeLow && pose.throatPinch > 0.6) {
        // Hamzah (ء): clamp glottis firmly shut, then snap open decisively on pronunciation release!
        targetSpread = releaseFactor > 0.35 ? 1.15 : 0.22;
      } else if (activeLow) {
        // Ha Besar (ه): abduct vocal folds wide open for free breathy Hams!
        targetSpread = 1.72;
      } else if (voiced) {
        targetSpread = 0.72 + Math.sin(time * 46.0) * (0.14 + audioLevel * 0.24);
      }

      if (this._currentGlottisSpread === undefined) this._currentGlottisSpread = 1.0;
      const nextSpread = THREE.MathUtils.lerp(
        this._currentGlottisSpread,
        targetSpread,
        0.22
      );

      // Dirty-check: skip 5,800-tri vertex updates when vocal folds are stationary!
      if (Math.abs(nextSpread - this._currentGlottisSpread) > 0.0025) {
        this._currentGlottisSpread = nextSpread;
        const spread = nextSpread;
        for (const entry of this.vocalFoldEntries) {
          const attr = entry.mesh.geometry.attributes.position;
          const arr = attr.array;
          const base = entry.basePos;
          for (let i = 0; i < arr.length; i += 3) {
            const postWeight = THREE.MathUtils.clamp((-0.14 - base[i + 2]) / 0.20, 0.15, 1.0);
            arr[i] = base[i] * THREE.MathUtils.lerp(1.0, spread, postWeight);
          }
          attr.needsUpdate = true;
        }
      }
    }
    return moved;
  }
}
