import * as THREE from 'three';
import {
  makhrajGlowVertexShader,
  makhrajGlowFragmentShader,
} from '../shaders/makhrajGlow.glsl.js';
import { MAKHRAJ_CATEGORIES } from '../data/hijaiyahData.js';

/**
 * MakhrajHighlighter — Custom GLSL Energy Beacon & Pulse Rings
 *
 * Visually pinpoints the exact anatomical contact point (Makhraj) inside the 3D mouth:
 *  - Primary beacon at the letter's focusPoint
 *  - Bilateral twin beacon on the opposite molar for ض (Dhad — Hafatul Lisan!)
 *  - Secondary violet beacon inside Al-Khaisyum for Ghunnah letters (ن and م)
 */
export class MakhrajHighlighter {
  constructor(parentGroup) {
    this.group = new THREE.Group();
    parentGroup.add(this.group);

    this.primaryUniforms = {
      uColor: { value: new THREE.Color('#ffffff') },
      uTime: { value: 0 },
      uIntensity: { value: 0.95 },
      uAudioLevel: { value: 0 },
    };

    this.secondaryUniforms = {
      uColor: { value: new THREE.Color('#d4d4d4') },
      uTime: { value: 0 },
      uIntensity: { value: 0.0 },
      uAudioLevel: { value: 0 },
    };

    const makeBeacon = (uniforms, radius = 0.115) => {
      const container = new THREE.Group();

      const sphereGeo = new THREE.SphereGeometry(radius, 24, 24);
      const sphereMat = new THREE.ShaderMaterial({
        uniforms,
        vertexShader: makhrajGlowVertexShader,
        fragmentShader: makhrajGlowFragmentShader,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
      });
      const sphere = new THREE.Mesh(sphereGeo, sphereMat);
      sphere.renderOrder = 15;
      container.add(sphere);

      // Expanding animated pulse halo ring
      const ringGeo = new THREE.RingGeometry(radius * 1.05, radius * 1.32, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: uniforms.uColor.value,
        transparent: true,
        opacity: 0.65,
        side: THREE.DoubleSide,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.renderOrder = 15;
      container.add(ring);

      return { container, sphere, ring, ringMat };
    };

    this.primary = makeBeacon(this.primaryUniforms, 0.078);
    this.mirrorDhad = makeBeacon(this.primaryUniforms, 0.074);
    this.secondary = makeBeacon(this.secondaryUniforms, 0.086);

    this.group.add(this.primary.container, this.mirrorDhad.container, this.secondary.container);
    this.mirrorDhad.container.visible = false;
    this.secondary.container.visible = false;

    this._targetPos = new THREE.Vector3(0, 0.05, 0.05);
    this._targetColor = new THREE.Color('#ffffff');
    this._currentPos = this._targetPos.clone();
    this._showMirror = false;
    this._showSecondary = false;
  }

  setLetter(letter) {
    const cat = MAKHRAJ_CATEGORIES[letter.makhraj] || MAKHRAJ_CATEGORIES.allisan;
    this._targetPos.set(letter.focusPoint[0], letter.focusPoint[1], letter.focusPoint[2]);
    this._targetColor.set(cat.color);

    // Special 3D highlight for Dhad (ض): show BOTH left and right lateral tongue-molar contact zones!
    this._showMirror = letter.id === 'dhad';
    this.mirrorDhad.container.visible = this._showMirror;

    // Secondary Al-Khaisyum (nasal) glow beacon for Nun & Mim!
    this._showSecondary = letter.secondaryMakhraj === 'alkhaisyum';
    this.secondary.container.visible = this._showSecondary;
    if (this._showSecondary) {
      this.secondary.container.position.set(0, 0.60, 0.46);
    }
  }

  update(dt, elapsedTime, camera, audioLevel = 0) {
    this._currentPos.lerp(this._targetPos, Math.min(1, dt * 8.0));
    this.primary.container.position.copy(this._currentPos);

    if (this._showMirror) {
      this.mirrorDhad.container.position.set(-this._currentPos.x, this._currentPos.y, this._currentPos.z);
    }

    this.primaryUniforms.uColor.value.lerp(this._targetColor, Math.min(1, dt * 7.0));
    this.primary.ringMat.color.copy(this.primaryUniforms.uColor.value);
    this.mirrorDhad.ringMat.color.copy(this.primaryUniforms.uColor.value);

    this.primaryUniforms.uTime.value = elapsedTime;
    this.primaryUniforms.uAudioLevel.value = audioLevel;
    this.secondaryUniforms.uTime.value = elapsedTime;
    this.secondaryUniforms.uAudioLevel.value = audioLevel;
    this.secondaryUniforms.uIntensity.value = this._showSecondary ? 0.95 : 0.0;

    // Billboard pulse rings toward the active camera so they always read crisply from any angle
    const wave = (elapsedTime * 1.15) % 1.0;
    const ringScale = 0.85 + wave * 1.15 + audioLevel * 0.3;
    const ringOpacity = (1.0 - wave) * (0.65 + audioLevel * 0.35);

    [this.primary, this.mirrorDhad, this.secondary].forEach((b) => {
      if (!b.container.visible) return;
      b.ring.quaternion.copy(camera.quaternion);
      b.ring.scale.setScalar(ringScale);
      b.ringMat.opacity = ringOpacity;
    });
  }
}
