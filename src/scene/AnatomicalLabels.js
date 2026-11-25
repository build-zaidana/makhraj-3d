import * as THREE from 'three';

/**
 * AnatomicalLabels — Crisp 3D-Projected Interactive Organ Callout Pins
 *
 * Projects exact 3D anatomical landmark positions inside headGroup into 2D screen space
 * so learners immediately recognize every real BodyParts3D organ (Al-Khaisyum, Palate,
 * Incisors, Upper Molars, Uvula, Tongue, Epiglottis, Vocal Folds).
 */

const LANDMARKS = [
  {
    id: 'khaisyum',
    label: 'Al-Khaisyum',
    sub: 'Rongga Hidung',
    pos: new THREE.Vector3(0.0, 0.64, 0.42),
    offset: { x: -12, y: -22 },
    color: '#ffffff',
    match: (l) => l.secondaryMakhraj === 'alkhaisyum' || l.makhraj === 'alkhaisyum',
  },
  {
    id: 'palate',
    label: 'Langit-langit',
    sub: 'Al-Hanak Al-A\'la',
    pos: new THREE.Vector3(0.0, 0.39, 0.30),
    offset: { x: 10, y: -18 },
    color: '#e5e5e5',
    match: (l) => ['jim', 'syin', 'ya', 'kaf', 'ra', 'lam', 'nun'].includes(l.id),
  },
  {
    id: 'incisors',
    label: 'Gigi Seri Atas',
    sub: 'Tsanaya Ulya',
    pos: new THREE.Vector3(0.0, 0.08, 0.80),
    offset: { x: -82, y: -28 },
    color: '#ffffff',
    match: (l) => ['ta', 'dal', 'tha', 'tsa', 'dzal', 'zha', 'fa'].includes(l.id),
  },
  {
    id: 'molars',
    label: 'Geraham Atas',
    sub: 'Adhras (Makhraj ض)',
    pos: new THREE.Vector3(-0.38, 0.09, 0.28),
    offset: { x: -95, y: -26 },
    color: '#ffffff',
    onlyWhenActive: true,
    match: (l) => l.id === 'dhad',
  },
  {
    id: 'uvula',
    label: 'Uvula',
    sub: 'Anak Tekak',
    pos: new THREE.Vector3(0.0, 0.14, -0.25),
    offset: { x: 16, y: -14 },
    color: '#d4d4d4',
    match: (l) => ['qaf', 'kha', 'ghain'].includes(l.id),
  },
  {
    id: 'tongue',
    label: 'Lidah',
    sub: 'Al-Lisan',
    pos: new THREE.Vector3(0.0, 0.06, 0.22),
    offset: { x: -16, y: 12 },
    color: '#ffffff',
    match: (l) => l.makhraj === 'allisan' && l.id !== 'dhad',
  },
  {
    id: 'epiglottis',
    label: 'Epiglotis',
    sub: 'Wasathul Halq (ع ح)',
    pos: new THREE.Vector3(0.0, -0.35, -0.36),
    offset: { x: 24, y: -6 },
    color: '#ffffff',
    match: (l) => ['ain', 'ha'].includes(l.id),
  },
  {
    id: 'vocals',
    label: 'Pita Suara',
    sub: 'Aqshal Halq (ء ه)',
    pos: new THREE.Vector3(0.0, -0.74, -0.40),
    offset: { x: 24, y: 10 },
    color: '#ffffff',
    match: (l) => ['hamzah', 'haa', 'alif'].includes(l.id),
  },
];

export class AnatomicalLabels {
  constructor(layerEl, headGroup) {
    this.layerEl = layerEl;
    this.headGroup = headGroup;
    this.visible = true;
    this._worldPos = new THREE.Vector3();
    this._ndc = new THREE.Vector3();

    this.items = LANDMARKS.map((lm) => {
      const el = document.createElement('div');
      el.className = 'anat-pin';
      el.style.setProperty('--pin-color', lm.color);
      el.innerHTML = `
        <span class="pin-dot"></span>
        <span class="pin-tag">
          <strong>${lm.label}</strong>
          <small>${lm.sub}</small>
        </span>
      `;
      this.layerEl.appendChild(el);
      return { ...lm, el, active: false };
    });
  }

  setLetter(letter) {
    this.items.forEach((item) => {
      item.active = Boolean(letter && item.match(letter));
      item.el.classList.toggle('active', item.active);
    });
  }

  setVisible(flag) {
    this.visible = flag;
    this.layerEl.style.display = flag ? 'block' : 'none';
  }

  update(camera, renderer) {
    if (!this.visible) return;
    const width = renderer.domElement.clientWidth;
    const height = renderer.domElement.clientHeight;
    if (!width || !height) return;

    this.headGroup.updateWorldMatrix(true, false);

    for (const item of this.items) {
      if (item.onlyWhenActive && !item.active) {
        item.el.style.opacity = '0';
        item.el.style.pointerEvents = 'none';
        continue;
      }

      this._worldPos.copy(item.pos).applyMatrix4(this.headGroup.matrixWorld);
      this._ndc.copy(this._worldPos).project(camera);

      // Hide if behind camera
      if (this._ndc.z > 1.0) {
        item.el.style.opacity = '0';
        continue;
      }

      const sx = (this._ndc.x * 0.5 + 0.5) * width;
      const sy = (-this._ndc.y * 0.5 + 0.5) * height;

      // Respect open side panel on desktop, full viewport on mobile or Focus 3D mode
      const isFocusOrMobile =
        width < 768 || document.body.classList.contains('focus-3d');
      const rightPad = isFocusOrMobile ? 28 : 360;
      const outOfBounds = sx < 18 || sx > width - rightPad || sy < 72 || sy > height - 96;
      if (outOfBounds && !item.active) {
        item.el.style.opacity = '0';
        continue;
      }

      item.el.style.opacity = item.active ? '1' : '0.68';
      item.el.style.transform = `translate3d(${(sx + item.offset.x).toFixed(1)}px, ${(sy + item.offset.y).toFixed(1)}px, 0)`;
    }
  }
}
