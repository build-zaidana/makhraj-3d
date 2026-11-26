import * as THREE from 'three';
import {
  airflowParticleVertexShader,
  airflowParticleFragmentShader,
} from '../shaders/airflowParticle.glsl.js';

/**
 * AirflowParticles — Fine-Mist Aerodynamic Streamlines (Calibrated 1:1 to MRI Airway)
 *
 * 320 delicate micro-particles flowing smoothly through the exact registered MRI airway:
 *   Trachea -> Vocal Folds (Z=-0.24, Y=-0.74) -> Epiglottis (Z=-0.18, Y=-0.42)
 *   -> Oropharynx (Z=-0.24) -> Over Tongue -> Lips
 * and branching cleanly behind Musculus Uvulae into Nasopharynx & Al-Khaisyum for Ghunnah!
 */

const PARTICLE_COUNT = 320;

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

    // Exact 1:1 MRI registered oral airway centerline
    this.oralCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.96, -0.27), // Upper trachea
      new THREE.Vector3(0, -0.74, -0.24), // Real vocal folds (Aqshal Halq)
      new THREE.Vector3(0, -0.42, -0.20), // Past real epiglottis (Wasathul Halq)
      new THREE.Vector3(0, 0.05, -0.24),  // Oropharynx (Adnal Halq)
      new THREE.Vector3(0, 0.22, 0.16),   // Vault over tongue dorsum
      new THREE.Vector3(0, 0.04, 0.68),   // Through anterior incisors
      new THREE.Vector3(0, -0.02, 1.28),  // Fine outward breath dispersion
    ]);

    // Exact 1:1 MRI registered nasal airway centerline (Al-Khaisyum!)
    this.nasalCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.92, -0.27), // Upper trachea
      new THREE.Vector3(0, -0.45, -0.21), // Mid pharynx
      new THREE.Vector3(0, 0.12, -0.26),  // Behind real musculus uvulae
      new THREE.Vector3(0, 0.48, -0.18),  // Real nasopharynx
      new THREE.Vector3(0, 0.56, 0.44),   // Real Al-Khaisyum nasal cavity
      new THREE.Vector3(0, 0.36, 0.96),   // Nostrils exit
      new THREE.Vector3(0, 0.24, 1.32),   // Fine outward nasal resonance
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
        isNasalSlot: i % 2 === 0,
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

  setConfig(airflowConfig) {
    this.config = airflowConfig || { mode: 'open', nasal: false, throatPulse: false, speed: 1.0 };
  }

  setVisible(flag) {
    this.visible = flag;
    this.points.visible = flag;
  }

  update(dt, elapsedTime, speedMultiplier = 1.0, audioLevel = 0) {
    if (!this.visible) return;

    const palette = this.isLight ? MODE_COLORS_LIGHT : MODE_COLORS_DARK;
    const baseColor = palette[this.config.mode] || palette.open;
    const nasalColor = palette.ghunnah;
    const speed = (this.config.speed || 1.0) * 0.44 * speedMultiplier * (1.0 + audioLevel * 0.85);
    const isQalqalah = this.config.mode === 'qalqalah';
    const isSafir = this.config.mode === 'safir';

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const m = this.meta[i];
      m.t = (m.t + dt * speed * m.speedJitter) % 1.0;

      const useNasal = this.config.nasal && m.isNasalSlot;
      const curve = useNasal ? this.nasalCurve : this.oralCurve;
      curve.getPoint(m.t, this._tmpPt);

      let spread = m.radialDist;
      if (isSafir && m.t > 0.58 && m.t < 0.85) {
        spread *= 0.28;
      } else if (m.t > 0.82) {
        spread *= 1.0 + (m.t - 0.82) * 7.5;
      }

      if (isQalqalah) {
        this._tmpPt.z += Math.sin(elapsedTime * 7.5 + m.t * 8.0) * 0.03;
      }

      const swirl = elapsedTime * 1.4 + m.radialAngle + m.t * 3.8;
      this.positions[i * 3] = this._tmpPt.x + Math.cos(swirl) * spread;
      this.positions[i * 3 + 1] = this._tmpPt.y + Math.sin(swirl) * spread;
      this.positions[i * 3 + 2] = this._tmpPt.z;

      const fadeIn = THREE.MathUtils.smoothstep(m.t, 0.0, 0.14);
      const fadeOut = 1.0 - THREE.MathUtils.smoothstep(m.t, 0.82, 1.0);
      const baseAlpha = this.isLight ? 0.68 + audioLevel * 0.30 : 0.44 + audioLevel * 0.36;
      this.alphas[i] = fadeIn * fadeOut * baseAlpha;

      // Silky refined micro-particle sizing (slightly fuller in light mode for crisp readability)
      const themeScale = this.isLight ? 1.18 : 1.0;
      this.sizes[i] =
        (useNasal ? 0.22 : isSafir ? 0.16 : 0.20) *
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
