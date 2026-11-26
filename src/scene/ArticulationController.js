import * as THREE from 'three';

/**
 * ArticulationController — Smooth Parametric Interpolation & Speech Simulation
 *
 * Smoothly interpolates all 13 vocal tract parameters between Hijaiyah letters,
 * and drives an animated pronunciation cycle ("rest -> articulate -> hold peak")
 * synchronized with playback speed (normal 1.0x vs slow-motion 0.5x).
 */

const POSE_KEYS = [
  'tipY',
  'tipZ',
  'bladeY',
  'midY',
  'backY',
  'backZ',
  'sideLift',
  'curl',
  'groove',
  'jawOpen',
  'lipClose',
  'lipRound',
  'lipLabiodental',
  'throatPinch',
];

const REST_POSE = {
  tipY: -0.05,
  tipZ: -0.04,
  bladeY: -0.03,
  midY: -0.02,
  backY: -0.03,
  backZ: 0.0,
  sideLift: 0.0,
  curl: 0.0,
  groove: 0.0,
  jawOpen: 0.16,
  lipClose: 0.15,
  lipRound: 0.0,
  lipLabiodental: 0.0,
  throatPinch: 0.0,
  throatZone: -1,
};

export class ArticulationController {
  constructor() {
    this.currentPose = { ...REST_POSE };
    this.targetLetter = null;

    // Pronunciation pulse cycle when user presses "Ucapkan"
    this._pulseActive = false;
    this._pulseTime = 0;
    this._pulseDuration = 1.65;
    this._releaseFactor = 0;
    this.slowMotion = false;
  }

  setLetter(letter, triggerPulse = false) {
    this.targetLetter = letter;
    this.currentPose.throatZone = letter.pose.throatZone;
    if (triggerPulse) {
      this.triggerPronunciation();
    }
  }

  triggerPronunciation() {
    this._pulseActive = true;
    this._pulseTime = 0;
    this._releaseFactor = 0;
  }

  getReleaseFactor() {
    return this._releaseFactor;
  }

  setSlowMotion(enabled) {
    this.slowMotion = enabled;
  }

  getSpeedMultiplier() {
    return this.slowMotion ? 0.5 : 1.0;
  }

  update(dt) {
    if (!this.targetLetter) return this.currentPose;

    const speedMult = this.getSpeedMultiplier();
    const targetPose = this.targetLetter.pose;

    // During active pronunciation pulse: briefly relax -> ramp emphatically into target pose -> settle
    let emphasis = 1.0;
    if (this._pulseActive) {
      this._pulseTime += dt * speedMult;
      const p = this._pulseTime / this._pulseDuration;

      if (p < 0.20) {
        emphasis = THREE.MathUtils.lerp(1.0, 0.25, p / 0.20);
        this._releaseFactor = 0;
      } else if (p < 0.52) {
        const t = (p - 0.20) / 0.32;
        const ease = 1 - Math.pow(1 - t, 3);
        emphasis = THREE.MathUtils.lerp(0.25, 1.03, ease);
        this._releaseFactor = THREE.MathUtils.smoothstep(p, 0.42, 0.54);
      } else if (p < 0.82) {
        emphasis = 1.02;
        this._releaseFactor = 1.0;
      } else if (p < 1.0) {
        const t = (p - 0.82) / 0.18;
        emphasis = THREE.MathUtils.lerp(1.02, 1.0, t);
        this._releaseFactor = 1.0 - t;
      } else {
        this._pulseActive = false;
        this._releaseFactor = 0;
        emphasis = 1.0;
      }
    } else {
      this._releaseFactor = 0;
    }

    const lerpRate = Math.min(1.0, dt * 8.5 * speedMult);

    for (const key of POSE_KEYS) {
      const restVal = REST_POSE[key];
      const goalVal = restVal + (targetPose[key] - restVal) * emphasis;
      this.currentPose[key] = THREE.MathUtils.lerp(this.currentPose[key], goalVal, lerpRate);
    }
    this.currentPose.throatZone = targetPose.throatZone;

    return this.currentPose;
  }
}
