import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { createPedestalTextures } from './TextureGenerator.js';

/**
 * Curated Camera Presets framed cleanly in the open left-center canvas
 * (never obscured by the right frosted-glass learning panel).
 */
export const CAMERA_PRESETS = {
  side: {
    pos: new THREE.Vector3(4.55, 0.24, 0.82),
    target: new THREE.Vector3(0.0, 0.06, -0.22),
    label: 'Samping (Sagital)',
  },
  throat: {
    pos: new THREE.Vector3(3.55, -0.28, 0.14),
    target: new THREE.Vector3(0.0, -0.36, -0.40),
    label: 'Tenggorokan (Al-Halq)',
  },
  lips: {
    pos: new THREE.Vector3(2.42, 0.12, 2.86),
    target: new THREE.Vector3(0.28, 0.02, 0.44),
    label: 'Bibir & Gigi Depan',
  },
  dhad: {
    pos: new THREE.Vector3(0.38, 1.46, 3.32),
    target: new THREE.Vector3(0.32, 0.12, 0.16),
    label: '3D Geraham (Khusus ض)',
  },
  front: {
    pos: new THREE.Vector3(0.16, 0.24, 4.38),
    target: new THREE.Vector3(0.38, 0.08, 0.0),
    label: 'Depan 360°',
  },
};

export class SceneManager {
  constructor(container) {
    this.container = container;

    // Pure neutral charcoal-black studio backdrop (zero blue tint)
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#090909');
    this.scene.fog = new THREE.FogExp2('#090909', 0.042);

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    const aspect = width / height;
    this.isMobile = width < 768;
    const isPortrait = aspect < 0.85;

    this.camera = new THREE.PerspectiveCamera(isPortrait ? 50 : 36, aspect, 0.05, 45);
    if (isPortrait) {
      this.camera.position.set(4.50, 0.18, 0.85);
    } else {
      this.camera.position.copy(CAMERA_PRESETS.side.pos);
    }

    // WebGL2 Renderer with soft shadows, stencil buffer (for solid cut caps) & ACES filmic tone mapping
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      stencil: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.isMobile ? 1.25 : 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = true;
    this._shadowCooldown = 0;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.localClippingEnabled = true;

    container.appendChild(this.renderer.domElement);

    // Studio IBL Reflections (PMREM RoomEnvironment) -> makes enamel, bone & wet tissue look cinematic!
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    pmremGenerator.compileEquirectangularShader();
    const envTexture = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = envTexture;
    this.scene.environmentIntensity = 0.58;
    pmremGenerator.dispose();

    // MSAA Post-Processing Pipeline: RenderPass -> Subtle Selective UnrealBloomPass -> OutputPass
    this.bloomEnabled = true;
    this._setupPostProcessing(width, height);

    // OrbitControls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.065;
    this.controls.minDistance = 1.6;
    this.controls.maxDistance = 8.2;
    this.controls.maxPolarAngle = Math.PI * 0.85;
    this.controls.target.copy(
      isPortrait ? new THREE.Vector3(0.0, 0.04, 0.18) : CAMERA_PRESETS.side.target
    );

    this._camTransition = null;
    this.controls.addEventListener('start', () => {
      this._camTransition = null;
    });

    // Root assembly for head shell + real anatomical vocal tract
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 0.16, 0);
    this.scene.add(this.headGroup);

    this._setupLighting();
    this._setupPedestal();

    window.addEventListener('resize', () => this.onResize());
  }

  _setupPostProcessing(width, height) {
    const pixelRatio = Math.min(window.devicePixelRatio, this.isMobile ? 1.25 : 1.5);
    const renderTarget = new THREE.WebGLRenderTarget(
      Math.floor(width * pixelRatio),
      Math.floor(height * pixelRatio),
      {
        type: THREE.HalfFloatType,
        stencilBuffer: true,
        samples: 2, // Balanced 2x MSAA for fast 60 FPS dark-mode selective bloom
      }
    );

    this.composer = new EffectComposer(this.renderer, renderTarget);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);

    // Tasteful HDR-only selective bloom — glows ONLY emissive X-Ray rims, beacons & particles
    // while keeping anatomical enamel teeth, bone, and cartilage razor-sharp!
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      0.26, // strength
      0.38, // radius
      1.05  // HDR threshold (zero white washout on teeth/bone!)
    );
    this.composer.addPass(this.bloomPass);

    this.outputPass = new OutputPass();
    this.composer.addPass(this.outputPass);
  }

  _setupLighting() {
    // 1. Neutral studio hemisphere fill (pure grayscale spectrum)
    this.hemiLight = new THREE.HemisphereLight('#f5f5f5', '#171717', 0.65);
    this.scene.add(this.hemiLight);

    // 2. Primary neutral studio Key Light casting crisp soft shadows (adaptive map size for mobile)
    this.keyLight = new THREE.DirectionalLight('#ffffff', 1.38);
    this.keyLight.position.set(4.2, 5.4, 3.8);
    this.keyLight.castShadow = true;
    const shadowSize = this.isMobile ? 512 : 1024;
    this.keyLight.shadow.mapSize.width = shadowSize;
    this.keyLight.shadow.mapSize.height = shadowSize;
    this.keyLight.shadow.camera.near = 1.0;
    this.keyLight.shadow.camera.far = 16.0;
    const d = 3.0;
    this.keyLight.shadow.camera.left = -d;
    this.keyLight.shadow.camera.right = d;
    this.keyLight.shadow.camera.top = d;
    this.keyLight.shadow.camera.bottom = -d;
    this.keyLight.shadow.bias = -0.0003;
    this.keyLight.shadow.normalBias = 0.02;
    this.scene.add(this.keyLight);

    // 3. Neutral silver-white Rim Light from rear-left
    this.rimLight = new THREE.DirectionalLight('#e5e5e5', 1.05);
    this.rimLight.position.set(-4.0, 2.8, -3.6);
    this.scene.add(this.rimLight);

    // 4. Neutral soft front bounce fill
    this.fillLight = new THREE.DirectionalLight('#d4d4d4', 0.55);
    this.fillLight.position.set(1.8, -0.6, 4.2);
    this.scene.add(this.fillLight);

    // 5. Dynamic Oral Cavity Point Light (neutral pure white following active Makhraj point)
    this.makhrajLight = new THREE.PointLight('#ffffff', 1.25, 2.6, 1.7);
    this.makhrajLight.position.set(0.28, 0.22, 0.35);
    this.headGroup.add(this.makhrajLight);
  }

  _setupPedestal() {
    const { map, normalMap } = createPedestalTextures();

    // Matte architectural obsidian-graphite turntable platform
    const topGeo = new THREE.CylinderGeometry(1.78, 1.94, 0.14, 72);
    const topMat = new THREE.MeshStandardMaterial({
      map,
      normalMap,
      normalScale: new THREE.Vector2(0.85, 0.85),
      roughness: 0.42,
      metalness: 0.32,
    });
    this.pedestal = new THREE.Mesh(topGeo, topMat);
    this.pedestal.position.set(0, -1.50, -0.18);
    this.pedestal.receiveShadow = true;
    this.scene.add(this.pedestal);
    this._darkPedestalMat = topMat;
    this._lightPedestalMat = new THREE.MeshStandardMaterial({
      color: '#deded9',
      normalMap,
      normalScale: new THREE.Vector2(0.42, 0.42),
      roughness: 0.62,
      metalness: 0.06,
    });

    // Hairline monochrome bezel ring
    const ringGeo = new THREE.TorusGeometry(1.79, 0.010, 14, 84);
    const ringMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#e5e5e5'),
      transparent: true,
      opacity: 0.48,
    });
    this.pedestalRing = new THREE.Mesh(ringGeo, ringMat);
    this.pedestalRing.rotation.x = Math.PI / 2;
    this.pedestalRing.position.set(0, -1.425, -0.18);
    this.scene.add(this.pedestalRing);

    // Pure neutral matte studio floor receiving far shadows
    const floorGeo = new THREE.CircleGeometry(18, 64);
    const floorMat = new THREE.MeshStandardMaterial({
      color: '#070707',
      roughness: 0.92,
      metalness: 0.04,
    });
    this.floor = new THREE.Mesh(floorGeo, floorMat);
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.position.y = -1.575;
    this.floor.receiveShadow = true;
    this.scene.add(this.floor);
    this.isLightTheme = false;
  }

  setTheme(theme) {
    const isLight = theme === 'light';
    this.isLightTheme = isLight;
    if (isLight) {
      this.scene.background.set('#e8e8e2');
      this.scene.fog.color.set('#e8e8e2');
      this.scene.fog.density = 0.026;
      this.scene.environmentIntensity = 0.60;
      this.renderer.toneMappingExposure = 1.02;

      this.hemiLight.color.set('#ffffff');
      this.hemiLight.groundColor.set('#c8c8c2');
      this.hemiLight.intensity = 0.96;
      this.keyLight.intensity = 1.44;
      this.rimLight.intensity = 0.64;
      this.fillLight.intensity = 0.64;
      this.makhrajLight.intensity = 0.72;

      this._lightPedestalMat.color.set('#d2d2cc');
      this.pedestal.material = this._lightPedestalMat;
      this.pedestalRing.material.color.set('#2e2e2e');
      this.pedestalRing.material.opacity = 0.40;
      this.floor.material.color.set('#deded7');

      this.bloomPass.strength = 0.05;
      this.bloomPass.threshold = 1.38;
    } else {
      this.scene.background.set('#101010');
      this.scene.fog.color.set('#101010');
      this.scene.fog.density = 0.038;
      this.scene.environmentIntensity = 0.58;
      this.renderer.toneMappingExposure = 1.08;

      this.hemiLight.color.set('#f5f5f5');
      this.hemiLight.groundColor.set('#1c1c1c');
      this.hemiLight.intensity = 0.70;
      this.keyLight.intensity = 1.38;
      this.rimLight.intensity = 1.05;
      this.fillLight.intensity = 0.58;
      this.makhrajLight.intensity = 1.25;

      this.pedestal.material = this._darkPedestalMat;
      this.pedestalRing.material.color.set('#e5e5e5');
      this.pedestalRing.material.opacity = 0.48;
      this.floor.material.color.set('#0b0b0b');

      this.bloomPass.strength = 0.24;
      this.bloomPass.threshold = 1.05;
    }
  }

  setBloomEnabled(enabled) {
    this.bloomEnabled = enabled;
  }

  focusPreset(presetKey, duration = 0.78) {
    const preset = CAMERA_PRESETS[presetKey] || CAMERA_PRESETS.side;
    const isPortrait = this.camera.aspect < 0.85;
    const endPos = preset.pos.clone();
    const endTarget = preset.target.clone();
    if (isPortrait) {
      // Center framing cleanly on narrow portrait screens (no desktop right sidebar offset)
      endTarget.x = 0.0;
      if (presetKey === 'side') endTarget.z = 0.16;
      endPos.multiplyScalar(1.12);
    }
    this._camTransition = {
      startPos: this.camera.position.clone(),
      endPos,
      startTarget: this.controls.target.clone(),
      endTarget,
      elapsed: 0,
      duration,
    };
  }

  setMakhrajLight(positionVec3, hexColor) {
    this._targetLightPos = positionVec3.clone();
    this._targetLightColor = new THREE.Color(hexColor);
  }

  update(dt) {
    if (this._camTransition) {
      this._camTransition.elapsed += dt;
      const t = Math.min(this._camTransition.elapsed / this._camTransition.duration, 1.0);
      const ease = 1 - Math.pow(1 - t, 3);
      this.camera.position.lerpVectors(this._camTransition.startPos, this._camTransition.endPos, ease);
      this.controls.target.lerpVectors(this._camTransition.startTarget, this._camTransition.endTarget, ease);
      if (t >= 1.0) this._camTransition = null;
    }

    if (this._targetLightPos) {
      const desired = this._targetLightPos.clone().add(new THREE.Vector3(0.32, 0.14, 0.18));
      this.makhrajLight.position.lerp(desired, Math.min(1, dt * 7));
    }
    if (this._targetLightColor) {
      this.makhrajLight.color.lerp(this._targetLightColor, Math.min(1, dt * 6));
      if (!this.isLightTheme) {
        this.pedestalRing.material.color.lerp(this._targetLightColor, Math.min(1, dt * 5));
      }
    }

    this.controls.update();
  }

  requestShadowUpdate(immediate = false) {
    if (immediate) {
      this.renderer.shadowMap.needsUpdate = true;
      this._shadowCooldown = 0;
      return;
    }
    if (this._shadowCooldown <= 0) {
      this.renderer.shadowMap.needsUpdate = true;
      this._shadowCooldown = 3; // Refresh shadow map at ~20Hz while organs animate, 0Hz when idle/orbiting!
    }
  }

  render() {
    if (this._shadowCooldown > 0) this._shadowCooldown -= 1;
    // Direct native hardware-antialiased render in Light Mode (skips 10-pass Bloom + HalfFloat FBO overhead!)
    if (this.bloomEnabled && !this.isLightTheme) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  onResize() {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    const aspect = width / height;
    const isPortrait = aspect < 0.85;
    const pixelRatio = Math.min(window.devicePixelRatio, width < 768 ? 1.25 : 1.5);

    this.camera.fov = isPortrait ? 52 : 36;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    if (isPortrait && Math.abs(this.controls.target.z + 0.30) < 0.05) {
      // Recenter desktop side offset cleanly if user resizes into portrait mobile view
      this.controls.target.set(0.0, 0.14, 0.16);
    }
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(pixelRatio);
    this.composer.setSize(width, height);
    this.composer.setPixelRatio(pixelRatio);
    this.bloomPass.resolution.set(width, height);
  }
}
