import * as THREE from 'three';
import {
  airflowParticleVertexShader,
  airflowParticleFragmentShader,
} from '../shaders/airflowParticle.glsl.js';

/**
 * AirflowParticles — Physics-Accurate Makhraj-Aware Aerodynamic Streamlines (320 Particles)
 *
 * Dynamically adapts airflow paths & obstructions to the true anatomy of all 29 Hijaiyah letters:
 *  - Syiddah stops (ء ق ك ج ت د ط ب): air pools & pressurizes behind the exact contact point,
 *    then bursts outward upon pronunciation release (with Qalqalah recoil or Hams puff!)
 *  - Mim (م): oral airway seals completely behind closed lips while ~82% diverts up into Al-Khaisyum!
 *  - Nun (ن): alveolar tip blocks oral center while ~58% flows upward through Al-Khaisyum (Ghunnah)!
 *  - Syin (ش): wide Tafasyi dispersion filling the oral cavity laterally!
 *  - Sin / Shad / Zay (س ص ز): razor-narrow high-velocity Safir jet through median groove!
 *  - Dhad (ض): bilateral Istithalah pressure stream curving outward along inner upper molars (±X)!
 */

const PARTICLE_COUNT = 320;

// Exact stop parameter t along oralCurve for Syiddah / blocked-oral letters
const OBSTRUCTION_T = {
  hamzah: 0.19,
  qaf: 0.49,
  kaf: 0.57,
  jim: 0.64,
  ta: 0.77,
  dal: 0.77,
  tha: 0.77,
  ba: 0.84,
  mim: 0.76,
  nun: 0.74,
};

const MODE_COLORS_DARK = {
  open: new THREE.Color('#e5e5e5'),
  hams: new THREE.Color('#ffffff'),
  jahr: new THREE.Color('#a3a3a3'),
  qalqalah: new THREE.Color('#f5f5f5'),
  safir: new THREE.Color('#ffffff'),
  throat: new THREE.Color('#d4d4d4'),
  ghunnah: new THREE.Color('#ffffff'),
};

const MODE_COLORS_LIGHT = {
  open: new THREE.Color('#404040'),
  hams: new THREE.Color('#171717'),
  jahr: new THREE.Color('#525252'),
  qalqalah: new THREE.Color('#1f1f1f'),
  safir: new THREE.Color('#141414'),
  throat: new THREE.Color('#303030'),
  ghunnah: new THREE.Color('#171717'),
};

export class AirflowParticles {
  constructor(parentGroup) {
    this.group = new THREE.Group();
    parentGroup.add(this.group);

    this.oralCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.96, -0.27), // t=0.00 Upper trachea
      new THREE.Vector3(0, -0.74, -0.24), // t=0.17 Vocal folds (Aqshal Halq)
      new THREE.Vector3(0, -0.42, -0.20), // t=0.33 Epiglottis (Wasathul Halq)
      new THREE.Vector3(0, 0.05, -0.24),  // t=0.50 Oropharynx / Uvula (Adnal Halq & Qaf)
      new THREE.Vector3(0, 0.22, 0.16),   // t=0.66 Mid palate (Jim / Syin / Ya)
      new THREE.Vector3(0, 0.04, 0.68),   // t=0.82 Incisors & Lips
      new THREE.Vector3(0, -0.02, 1.28),  // t=1.00 Outward breath dispersion
    ]);

    this.nasalCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.92, -0.27),
      new THREE.Vector3(0, -0.45, -0.21),
      new THREE.Vector3(0, 0.12, -0.27),
      new THREE.Vector3(0, 0.48, -0.18),
      new THREE.Vector3(0, 0.56, 0.44),
      new THREE.Vector3(0, 0.36, 0.96),
      new THREE.Vector3(0, 0.24, 1.32),
    ]);

    this.positions = new Float32Array(PARTICLE_COUNT * 3);
    this.sizes = new Float32Array(PARTICLE_COUNT);
    this.alphas = new Float32Array(PARTICLE_COUNT);
    this.colors = new Float32Array(PARTICLE_COUNT * 3);

    this.meta = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      this.meta.push({
        t: i / PARTICLE_COUNT,
        speedJitter: 0.82 + (i % 9) * 0.045,
        radialAngle: (i * 2.39996) % (Math.PI * 2),
        radialDist: 0.012 + ((i * 13) % 10) * 0.0055,
        slotRank: (i % 100) / 100, // smooth fraction for variable nasal routing (82% Mim, 58% Nun)
        sideSign: i % 2 === 0 ? 1 : -1,
      });
    }

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1));
    this.geometry.setAttribute('aAlpha', new THREE.BufferAttribute(this.alphas, 1));
    this.geometry.setAttribute('aColor', new THREE.BufferAttribute(this.colors, 3));

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
        uCoreWhite: { value: 0.45 },
      },
      vertexShader: airflowParticleVertexShader,
      fragmentShader: airflowParticleFragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(this.geometry, this.material);
    this.points.renderOrder = 8;
    this.group.add(this.points);

    this.config = { mode: 'open', nasal: false, throatPulse: false, speed: 1.0 };
    this.letterId = 'ta';
    this.visible = true;
    this.isLight = false;
    this._tmpPt = new THREE.Vector3();
  }

  setTheme(theme) {
    this.isLight = theme === 'light';
    this.material.uniforms.uCoreWhite.value = this.isLight ? 0.0 : 0.45;
    this.material.blending = this.isLight ? THREE.NormalBlending : THREE.AdditiveBlending;
    this.material.needsUpdate = true;
  }

  setConfig(airflowConfig, letterId = '') {
    this.config = airflowConfig || { mode: 'open', nasal: false, throatPulse: false, speed: 1.0 };
    if (letterId) this.letterId = letterId;
  }

  setVisible(flag) {
    this.visible = flag;
    this.points.visible = flag;
  }

  update(dt, elapsedTime, speedMultiplier = 1.0, audioLevel = 0, releaseFactor = 0) {
    if (!this.visible) return;

    const palette = this.isLight ? MODE_COLORS_LIGHT : MODE_COLORS_DARK;
    const baseColor = palette[this.config.mode] || palette.open;
    const nasalColor = palette.ghunnah;
    const speed = (this.config.speed || 1.0) * 0.44 * speedMultiplier * (1.0 + audioLevel * 0.85);

    const lid = this.letterId;
    const isQalqalah = this.config.mode === 'qalqalah';
    const isSafir = this.config.mode === 'safir';
    const isTafasyi = lid === 'syin';
    const isDhad = lid === 'dhad';
    const isMim = lid === 'mim';
    const isNun = lid === 'nun';

    // Determine exact nasal split ratio
    const nasalRatio = isMim ? 0.82 : isNun ? 0.58 : this.config.nasal ? 0.5 : 0.0;

    // Obstruction barrier for Syiddah / blocked-oral letters (releases smoothly when speaking!)
    const stopT = OBSTRUCTION_T[lid] || 1.0;
    const isOralBlocked = stopT < 1.0 && !isMim && !isNun;
    const releaseOpen = Math.max(releaseFactor, audioLevel * 1.4);
    const activeMaxOralT =
      isMim || isNun
        ? stopT // On Mim/Nun oral cavity stays closed while air exits nose!
        : isOralBlocked
        ? THREE.MathUtils.lerp(stopT, 1.0, THREE.MathUtils.clamp(releaseOpen, 0, 1))
        : 1.0;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const m = this.meta[i];
      m.t = (m.t + dt * speed * m.speedJitter) % 1.0;

      const useNasal = nasalRatio > 0 && m.slotRank < nasalRatio;
      const curve = useNasal ? this.nasalCurve : this.oralCurve;

      // Map oral particle progression cleanly up to activeMaxOralT (pools & swirls at barrier!)
      let sampleT = m.t;
      let pooled = false;
      if (!useNasal && activeMaxOralT < 0.98) {
        if (m.t > activeMaxOralT) {
          // Pool & gently pressurize just behind the Makhraj contact barrier!
          const excess = (m.t - activeMaxOralT) / Math.max(0.05, 1.0 - activeMaxOralT);
          sampleT = activeMaxOralT - 0.04 * Math.sin(excess * Math.PI);
          pooled = true;
        }
      }

      curve.getPoint(THREE.MathUtils.clamp(sampleT, 0, 1), this._tmpPt);

      let spreadX = m.radialDist;
      let spreadY = m.radialDist;

      if (!useNasal) {
        if (isSafir && sampleT > 0.56 && sampleT < 0.86) {
          // Razor-tight laminar sibilant jet (Sin, Shad, Zay)
          spreadX *= 0.24;
          spreadY *= 0.24;
        } else if (isTafasyi && sampleT > 0.55) {
          // Wide Tafasyi air diffusion filling the mouth on Syin (ش)
          const widen = 1.0 + (sampleT - 0.55) * 4.5;
          spreadX *= widen * 1.45;
          spreadY *= widen * 0.85;
        } else if (isDhad && sampleT > 0.52 && sampleT < 0.86) {
          // Bilateral Istithalah lateral stream pressing toward inner upper molars (±X)!
          const latEnv = Math.sin(((sampleT - 0.52) / 0.34) * Math.PI);
          this._tmpPt.x += m.sideSign * 0.23 * latEnv;
          this._tmpPt.y -= 0.05 * latEnv;
        } else if (pooled) {
          // Pressurized gentle cushion right behind closed lips/tongue
          spreadX *= 1.65;
          spreadY *= 1.35;
        } else if (sampleT > 0.82) {
          const disp = 1.0 + (sampleT - 0.82) * 7.2;
          spreadX *= disp;
          spreadY *= disp;
        }
      } else if (sampleT > 0.84) {
        const disp = 1.0 + (sampleT - 0.84) * 5.8;
        spreadX *= disp;
        spreadY *= disp;
      }

      if (isQalqalah && !useNasal) {
        this._tmpPt.z += Math.sin(elapsedTime * 8.0 + sampleT * 8.0) * (0.025 + releaseOpen * 0.02);
      }

      const swirl = elapsedTime * (pooled ? 2.8 : 1.45) + m.radialAngle + sampleT * 3.8;
      this.positions[i * 3] = this._tmpPt.x + Math.cos(swirl) * spreadX;
      this.positions[i * 3 + 1] = this._tmpPt.y + Math.sin(swirl) * spreadY;
      this.positions[i * 3 + 2] = this._tmpPt.z;

      const fadeIn = THREE.MathUtils.smoothstep(m.t, 0.0, 0.14);
      const fadeOut = 1.0 - THREE.MathUtils.smoothstep(m.t, 0.82, 1.0);
      const baseAlpha = this.isLight ? 0.68 + audioLevel * 0.30 : 0.44 + audioLevel * 0.36;
      const poolBoost = pooled ? 0.72 : 1.0;
      this.alphas[i] = fadeIn * fadeOut * baseAlpha * poolBoost;

      const themeScale = this.isLight ? 1.18 : 1.0;
      this.sizes[i] =
        (useNasal ? 0.22 : isSafir ? 0.16 : isTafasyi ? 0.21 : 0.20) *
        themeScale *
        (0.75 + 0.45 * fadeOut) *
        (1.0 + audioLevel * 0.45);

      const c = useNasal ? nasalColor : baseColor;
      this.colors[i * 3] = c.r;
      this.colors[i * 3 + 1] = c.g;
      this.colors[i * 3 + 2] = c.b;
    }

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.aSize.needsUpdate = true;
    this.geometry.attributes.aAlpha.needsUpdate = true;
    this.geometry.attributes.aColor.needsUpdate = true;
  }
}
