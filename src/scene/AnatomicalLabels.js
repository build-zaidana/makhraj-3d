import * as THREE from 'three';

/**
 * AnatomicalLabels — Surgical Micro-Dot 3D Callout Pins (Calibrated 1:1 to MRI Landmarks)
 *
 * Keeps the photorealistic 3D anatomy completely unobstructed:
 *  - Inactive organs render as subtle 5px monochrome micro-dots (expanding smoothly on hover)
 *  - Active organ(s) for the current Hijaiyah letter automatically expand into crisp editorial labels
 */

const LANDMARKS = [
  {
    id: 'khaisyum',
    label: 'Al-Khaisyum',
    sub: 'Rongga Hidung',
    pos: new THREE.Vector3(0.0, 0.62, 0.50),
    offset: { x: 10, y: -18 },
    match: (l) => l.secondaryMakhraj === 'alkhaisyum' || l.makhraj === 'alkhaisyum',
  },
  {
    id: 'palate',
    label: 'Langit-langit',
    sub: 'Al-Hanak Al-A\'la',
    pos: new THREE.Vector3(0.0, 0.36, 0.22),
    offset: { x: 10, y: -16 },
    match: (l) => ['jim', 'syin', 'ya', 'kaf', 'ra', 'lam', 'nun'].includes(l.id),
  },
  {
    id: 'incisors',
    label: 'Gigi Seri Atas',
    sub: 'Tsanaya Ulya',
    pos: new THREE.Vector3(0.0, 0.10, 0.76),
    offset: { x: -94, y: -22 },
    match: (l) => ['ta', 'dal', 'tha', 'tsa', 'dzal', 'zha', 'fa'].includes(l.id),
  },
  {
    id: 'molars',
    label: 'Geraham Atas',
    sub: 'Adhras (Makhraj ض)',
    pos: new THREE.Vector3(-0.34, 0.14, 0.32),
    offset: { x: -102, y: -20 },
    onlyWhenActive: true,
    match: (l) => l.id === 'dhad',
  },
  {
    id: 'uvula',
    label: 'Uvula',
    sub: 'Musculus Uvulae',
    pos: new THREE.Vector3(0.0, 0.24, -0.34),
    offset: { x: 12, y: -10 },
    match: (l) => ['qaf', 'kha', 'ghain'].includes(l.id),
  },
  {
    id: 'tongue',
    label: 'Lidah',
    sub: 'Al-Lisan',
    pos: new THREE.Vector3(0.0, 0.08, 0.24),
    offset: { x: -12, y: 12 },
    match: (l) => l.makhraj === 'allisan' && l.id !== 'dhad',
  },
  {
    id: 'epiglottis',
    label: 'Epiglotis',
    sub: 'Wasathul Halq (ع ح)',
    pos: new THREE.Vector3(0.0, -0.42, -0.18),
    offset: { x: 16, y: -6 },
    match: (l) => ['ain', 'ha'].includes(l.id),
  },
  {
    id: 'vocals',
    label: 'Pita Suara',
    sub: 'Aqshal Halq (ء ه)',
    pos: new THREE.Vector3(0.0, -0.74, -0.24),
    offset: { x: 16, y: 8 },
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

    const isFocusOrMobile =
      width < 768 || document.body.classList.contains('focus-3d');
    const rightPad = isFocusOrMobile ? 24 : 368;

    for (const item of this.items) {
      if (item.onlyWhenActive && !item.active) {
        item.el.style.opacity = '0';
        continue;
      }

      this._worldPos.copy(item.pos).applyMatrix4(this.headGroup.matrixWorld);
      this._ndc.copy(this._worldPos).project(camera);

      if (this._ndc.z > 1.0) {
        item.el.style.opacity = '0';
        continue;
      }

      const sx = (this._ndc.x * 0.5 + 0.5) * width;
      const sy = (-this._ndc.y * 0.5 + 0.5) * height;

      const outOfBounds = sx < 16 || sx > width - rightPad || sy < 72 || sy > height - 96;
      if (outOfBounds && !item.active) {
        item.el.style.opacity = '0';
        continue;
      }

      item.el.style.opacity = '1';
      const ox = item.active ? item.offset.x : 0;
      const oy = item.active ? item.offset.y : 0;
      item.el.style.transform = `translate3d(${(sx + ox).toFixed(1)}px, ${(sy + oy).toFixed(1)}px, 0)`;
    }
  }
}
