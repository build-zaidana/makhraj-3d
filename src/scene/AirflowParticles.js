import * as THREE from 'three';
import {
  airflowParticleVertexShader,
  airflowParticleFragmentShader,
} from '../shaders/airflowParticle.glsl.js';

/**
 * AirflowParticles — Custom GLSL Volumetric Airflow & Sound Wave System
 *
 * Visualizes invisible Tajwid physics that static 2D charts cannot convey:
 *  - Hams (breath stream): fast luminous sky-cyan particles escaping lips
 *  - Jahr (voiced steady stream): warm emerald-teal flow
 *  - Qalqalah (echo/bounce): rhythmic amber burst wave at release point
 *  - Safir (whistling sibilant): concentrated high-velocity cyan jet through teeth
 *  - Ghunnah (Al-Khaisyum): distinct glowing violet stream curving up through nasal cavity!
 */

const PARTICLE_COUNT = 160;

const MODE_COLORS = {
  open: new THREE.Color('#e5e5e5'),     // Clean off-white (Al-Jauf)
  hams: new THREE.Color('#ffffff'),     // Bright crisp white (Hams breath)
  jahr: new THREE.Color('#a3a3a3'),     // Mid silver-gray (Jahr voiced)
  qalqalah: new THREE.Color('#f5f5f5'), // High-contrast pearl white (Qalqalah bounce)
  safir: new THREE.Color('#ffffff'),    // Razor pure white jet (Safir whistle)
  throat: new THREE.Color('#d4d4d4'),   // Light silver (Al-Halq resonance)
  ghunnah: new THREE.Color('#ffffff'),  // Luminous white stream through Al-Khaisyum
};

export class AirflowParticles {
  constructor(parentGroup) {
    this.group = new THREE.Group();
    parentGroup.add(this.group);

    // Smooth anatomical curves for Oral Airflow and Nasal Ghunnah Airflow
    this.oralCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.92, -0.44), // Lower throat (Aqshal Halq)
      new THREE.Vector3(0, -0.38, -0.42), // Mid throat (Wasathul Halq)
      new THREE.Vector3(0, 0.14, -0.26),  // Behind soft palate
      new THREE.Vector3(0, 0.24, 0.18),   // Over tongue arch
      new THREE.Vector3(0, 0.08, 0.68),   // Between teeth
      new THREE.Vector3(0, 0.0, 1.05),    // Through lips
      new THREE.Vector3(0, -0.04, 1.52),  // Dispersing out in front
    ]);

    this.nasalCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.90, -0.44), // Lower throat
      new THREE.Vector3(0, -0.28, -0.43), // Pharynx up
      new THREE.Vector3(0, 0.28, -0.36),  // Nasopharynx behind velum
      new THREE.Vector3(0, 0.60, 0.14),   // Nasal cavity (Al-Khaisyum!)
      new THREE.Vector3(0, 0.52, 0.60),   // Anterior nasal passage
      new THREE.Vector3(0, 0.34, 0.96),   // Nostrils exit
      new THREE.Vector3(0, 0.22, 1.38),   // Outward nasal resonance
    ]);

    // Particle state arrays
    this.positions = new Float32Array(PARTICLE_COUNT * 3);
    this.sizes = new Float32Array(PARTICLE_COUNT);
    this.alphas = new Float32Array(PARTICLE_COUNT);
    this.colors = new Float32Array(PARTICLE_COUNT * 3);

    this.meta = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      this.meta.push({
        t: i / PARTICLE_COUNT,
        speedJitter: 0.78 + (i % 7) * 0.07,
        radialAngle: (i * 2.39996) % (Math.PI * 2), // Golden angle spread
        radialDist: 0.02 + ((i * 17) % 10) * 0.0085,
        isNasalSlot: i % 2 === 0, // Half of particles route into nasal cavity when Ghunnah is active
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
    this._tmpPt = new THREE.Vector3();
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

    const baseColor = MODE_COLORS[this.config.mode] || MODE_COLORS.open;
    const nasalColor = MODE_COLORS.ghunnah;
    const speed = (this.config.speed || 1.0) * 0.42 * speedMultiplier * (1.0 + audioLevel * 0.9);
    const isQalqalah = this.config.mode === 'qalqalah';
    const isSafir = this.config.mode === 'safir';

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const m = this.meta[i];
      m.t = (m.t + dt * speed * m.speedJitter) % 1.0;

      const useNasal = this.config.nasal && m.isNasalSlot;
      const curve = useNasal ? this.nasalCurve : this.oralCurve;
      curve.getPoint(m.t, this._tmpPt);

      // Spread behavior: Safir stays razor-narrow through teeth, then fans out past lips
      let spread = m.radialDist;
      if (isSafir && m.t > 0.55 && m.t < 0.84) {
        spread *= 0.35;
      } else if (m.t > 0.80) {
        spread *= 1.0 + (m.t - 0.80) * 8.0;
      }

      // Qalqalah rhythmic elastic bounce pulse near exit
      if (isQalqalah) {
        const bounce = Math.sin(elapsedTime * 7.5 + m.t * 8.0) * 0.04;
        this._tmpPt.z += bounce;
      }

      const swirl = elapsedTime * 1.8 + m.radialAngle + m.t * 4.5;
      this.positions[i * 3] = this._tmpPt.x + Math.cos(swirl) * spread;
      this.positions[i * 3 + 1] = this._tmpPt.y + Math.sin(swirl) * spread;
      this.positions[i * 3 + 2] = this._tmpPt.z;

      // Smooth fade in at throat & fade out past lips/nostrils
      const fadeIn = THREE.MathUtils.smoothstep(m.t, 0.0, 0.14);
      const fadeOut = 1.0 - THREE.MathUtils.smoothstep(m.t, 0.82, 1.0);
      this.alphas[i] = fadeIn * fadeOut * (0.58 + audioLevel * 0.42);

      // Particle size responds to audio & mode
      this.sizes[i] = (useNasal ? 0.52 : isSafir ? 0.38 : 0.48) * (0.75 + 0.5 * fadeOut) * (1.0 + audioLevel * 0.6);

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
