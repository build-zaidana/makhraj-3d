import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import {
  xrayFresnelVertexShader,
  xrayFresnelFragmentShader,
} from '../shaders/xrayFresnel.glsl.js';

/**
 * OuterHeadShell:
 * Loads the open-source CC0 stylized human head (facecap.glb with 52 ARKit blendshapes)
 * using local MeshoptDecoder + KTX2Loader (100% offline-ready!) and renders it with our
 * custom X-Ray Fresnel + Sagittal Clipping GLSL shader.
 * Also includes a clean, sculpted stylized fallback head option ("Kepala Simpel").
 */
export class OuterHeadShell {
  constructor(parentGroup, renderer, loadingManager = undefined) {
    this.group = new THREE.Group();
    this.renderer = renderer;
    this.loadingManager = loadingManager;
    parentGroup.add(this.group);

    this.xrayUniforms = {
      uColor: { value: new THREE.Color('#525252') },
      uRimColor: { value: new THREE.Color('#f5f5f5') },
      uCutColor: { value: new THREE.Color('#ffffff') },
      uFresnelPower: { value: 2.25 },
      uOpacity: { value: 0.78 },
      uTime: { value: 0 },
      uClipX: { value: 0.04 },
      uEnableClip: { value: 1.0 },
      uScanlineIntensity: { value: 0.22 },
    };

    // Custom GLSL X-Ray Fresnel ShaderMaterial (morph-target compatible!)
    this.xrayMaterial = new THREE.ShaderMaterial({
      uniforms: this.xrayUniforms,
      vertexShader: xrayFresnelVertexShader,
      fragmentShader: xrayFresnelFragmentShader,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.NormalBlending,
    });

    // Subtle solid friendly clay material for "Kulit" cutaway toggle
    this.solidClipPlane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0.04);
    this.solidMaterial = new THREE.MeshStandardMaterial({
      color: '#e9c5a8',
      roughness: 0.62,
      metalness: 0.02,
      side: THREE.DoubleSide,
      clippingPlanes: [this.solidClipPlane],
      clipShadows: true,
    });

    this.eyeMaterial = new THREE.ShaderMaterial({
      uniforms: {
        ...this.xrayUniforms,
        uColor: { value: new THREE.Color('#737373') },
        uRimColor: { value: new THREE.Color('#e5e5e5') },
        uOpacity: { value: 0.38 },
      },
      vertexShader: xrayFresnelVertexShader,
      fragmentShader: xrayFresnelFragmentShader,
      transparent: true,
      depthWrite: false,
      side: THREE.FrontSide,
    });

    this.glbContainer = null;
    this.faceMesh = null;
    this.eyeMeshes = [];
    this.morphDict = {};
    this.viewMode = 'xray-cut'; // 'xray-cut' | 'xray-full' | 'solid-cut' | 'hidden'
    this.useProceduralFallback = false;

    this._buildStylizedFallback();
    this._loadFaceCapGLB();
  }

  /**
   * Builds a clean, friendly sculpted stylized profile head as an optional simple shell
   * (and seamless fallback while facecap.glb decodes).
   */
  _buildStylizedFallback() {
    this.fallbackGroup = new THREE.Group();

    // Smooth unified Lathe silhouette wrapping cleanly around the full vocal tract
    const profile = [
      new THREE.Vector2(0.01, 2.08),
      new THREE.Vector2(0.45, 2.04),
      new THREE.Vector2(0.84, 1.82),
      new THREE.Vector2(1.06, 1.38),
      new THREE.Vector2(1.10, 0.85),
      new THREE.Vector2(1.02, 0.25),
      new THREE.Vector2(0.88, -0.25),
      new THREE.Vector2(0.62, -0.58),
      new THREE.Vector2(0.56, -0.85),
      new THREE.Vector2(0.64, -1.25),
    ];
    const headGeo = new THREE.LatheGeometry(profile, 48);
    // Elongate slightly along Z so face extends cleanly past teeth & lips
    headGeo.scale(0.88, 1.0, 1.06);
    const headMesh = new THREE.Mesh(headGeo, this.xrayMaterial);
    headMesh.position.set(0, 0.06, -0.05);
    headMesh.renderOrder = 10;
    this.fallbackGroup.add(headMesh);

    // Friendly soft rounded nose bridge (no sharp inverted cone!)
    const noseGeo = new THREE.CapsuleGeometry(0.11, 0.22, 8, 16);
    const noseMesh = new THREE.Mesh(noseGeo, this.xrayMaterial);
    noseMesh.position.set(0, 0.44, 1.06);
    noseMesh.rotation.x = -0.35;
    noseMesh.renderOrder = 10;
    this.fallbackGroup.add(noseMesh);

    this.fallbackMeshes = [headMesh, noseMesh];
    this.group.add(this.fallbackGroup);
  }

  _loadFaceCapGLB() {
    const loader = new GLTFLoader(this.loadingManager);
    loader.setMeshoptDecoder(MeshoptDecoder);

    if (this.renderer) {
      const ktx2Loader = new KTX2Loader(this.loadingManager);
      ktx2Loader.setTranscoderPath('./basis/');
      ktx2Loader.detectSupport(this.renderer);
      loader.setKTX2Loader(ktx2Loader);
    }

    loader.load(
      './models/facecap.glb',
      (gltf) => {
        const root = gltf.scene;
        // Calibrated 1:1 onto our MRI-registered skull (incisors Z=0.78, cranium Y=2.32, nose Z=0.97)
        // No artificial cylinder neck needed since real MRI C1-C6 spine, pharynx & trachea frame the neck!
        root.scale.setScalar(1.42);
        root.position.set(0, 0.55, -0.02);

        root.traverse((obj) => {
          if (!obj.isMesh) return;
          const parentName = (obj.parent?.name || obj.name || '').toLowerCase();

          if (parentName.includes('teeth')) {
            // Hide static GLB teeth so our articulated stylized dental arches shine cleanly
            obj.visible = false;
            return;
          }

          if (parentName.includes('eye')) {
            obj.material = this.eyeMaterial;
            obj.renderOrder = 9;
            this.eyeMeshes.push(obj);
            return;
          }

          // Main head mesh with 52 ARKit morph targets!
          this.faceMesh = obj;
          this.morphDict = obj.morphTargetDictionary || {};
          obj.material = this.xrayMaterial;
          obj.renderOrder = 10;
          obj.castShadow = false;
          obj.receiveShadow = false;
        });

        this.glbContainer = new THREE.Group();
        this.glbContainer.add(root);
        this.group.add(this.glbContainer);

        if (!this.useProceduralFallback) {
          this.fallbackGroup.visible = false;
        }
        this.setViewMode(this.viewMode);
      },
      undefined,
      (err) => {
        console.warn('facecap.glb failed to load; keeping stylized procedural head:', err);
        this.fallbackGroup.visible = true;
      }
    );
  }

  /**
   * Switches visual mode:
   * - 'xray-cut'  : X-Ray Fresnel + Sagittal Clipping Plane (default — clearest!)
   * - 'xray-full' : Full 360° X-Ray Fresnel Vision (no slice)
   * - 'solid-cut' : Solid friendly skin + Sagittal Cutaway
   * - 'hidden'    : Hide outer head to focus 100% on vocal tract organs
   */
  setViewMode(mode) {
    this.viewMode = mode;

    const showShell = mode !== 'hidden';
    if (this.glbContainer) this.glbContainer.visible = showShell && !this.useProceduralFallback;
    if (this.fallbackGroup) {
      this.fallbackGroup.visible = showShell && (this.useProceduralFallback || !this.glbContainer);
    }

    const isSolid = mode === 'solid-cut';
    const enableClip = mode === 'xray-cut' || mode === 'solid-cut';
    this.xrayUniforms.uEnableClip.value = enableClip ? 1.0 : 0.0;

    const activeMat = isSolid ? this.solidMaterial : this.xrayMaterial;
    if (this.faceMesh) {
      this.faceMesh.material = activeMat;
      this.faceMesh.castShadow = isSolid;
      this.faceMesh.receiveShadow = isSolid;
    }
    if (this.neckExtMesh) {
      this.neckExtMesh.material = activeMat;
      this.neckExtMesh.castShadow = isSolid;
    }
    this.fallbackMeshes.forEach((m) => {
      m.material = activeMat;
      m.castShadow = isSolid;
    });
    this.eyeMeshes.forEach((m) => {
      m.visible = showShell && !isSolid;
    });
  }

  setOpacity(value) {
    this.xrayUniforms.uOpacity.value = value;
    this.eyeMaterial.uniforms.uOpacity.value = value * 0.52;
  }

  setClipX(xValue) {
    this.xrayUniforms.uClipX.value = xValue;
    this.solidClipPlane.constant = xValue;
  }

  setModelStyle(useFallback) {
    this.useProceduralFallback = useFallback;
    this.setViewMode(this.viewMode);
  }

  /**
   * Drives facecap.glb's real ARKit morph targets in sync with Hijaiyah articulation!
   */
  applyPose(pose, audioLevel = 0) {
    if (!this.faceMesh || !this.faceMesh.morphTargetInfluences) return;
    const inf = this.faceMesh.morphTargetInfluences;
    const setMorph = (name, val) => {
      const idx = this.morphDict[name];
      if (idx !== undefined) {
        inf[idx] = THREE.MathUtils.clamp(val, 0, 1);
      }
    };

    const dynamicJaw = THREE.MathUtils.clamp(pose.jawOpen + audioLevel * 0.14, 0, 1);
    setMorph('jawOpen', dynamicJaw * 0.85);
    setMorph('mouthClose', pose.lipClose * 0.85);
    setMorph('mouthPress_L', pose.lipClose * 0.7);
    setMorph('mouthPress_R', pose.lipClose * 0.7);

    // Waw rounded/protruded lips
    setMorph('mouthPucker', pose.lipRound * 0.9);
    setMorph('mouthFunnel', pose.lipRound * 0.65);

    // Fa labiodental: tuck lower lip toward upper front teeth
    setMorph('mouthRollLower', pose.lipLabiodental * 0.95);
    setMorph('mouthUpperUp_L', pose.lipLabiodental * 0.3);
    setMorph('mouthUpperUp_R', pose.lipLabiodental * 0.3);

    // Subtle friendly neutral warmth
    setMorph('mouthSmile_L', 0.10 * (1 - pose.lipRound));
    setMorph('mouthSmile_R', 0.10 * (1 - pose.lipRound));
  }

  update(elapsedTime) {
    this.xrayUniforms.uTime.value = elapsedTime;
  }
}
