import * as THREE from 'three';

/**
 * AnatomicalLabels — Friendly Interactive 3D Organ Pins (Calibrated 1:1 to MRI Landmarks)
 *
 * Clicking ANY organ pin opens the Organ Explorer showing all Hijaiyah letters articulated
 * at that exact organ so learners can explore organ-first as well as letter-first!
 */

export const ORGAN_LANDMARKS = [
  {
    id: 'khaisyum',
    label: 'Rongga Hidung',
    sub: 'Al-Khaisyum (Dengung)',
    role: 'Jalur keluar suara dengung (ghunnah) yang menyertai huruf Nun dan Mim.',
    letters: ['nun', 'mim'],
    pos: new THREE.Vector3(0.0, 0.62, 0.50),
    offset: { x: 10, y: -18 },
    match: (l) => l.secondaryMakhraj === 'alkhaisyum' || l.makhraj === 'alkhaisyum',
  },
  {
    id: 'palate',
    label: 'Langit-langit',
    sub: 'Atap Rongga Mulut',
    role: 'Atap rongga mulut tempat tengah lidah & ujung lidah bagian gusi bertemu.',
    letters: ['jim', 'syin', 'ya', 'kaf', 'lam', 'nun', 'ra'],
    pos: new THREE.Vector3(0.0, 0.30, 0.18),
    offset: { x: 10, y: -16 },
    match: (l) => ['jim', 'syin', 'ya', 'kaf', 'ra', 'lam', 'nun'].includes(l.id),
  },
  {
    id: 'incisors',
    label: 'Gigi Seri Atas',
    sub: 'Gigi Depan Atas',
    role: 'Pangkal gigi untuk ت د ط, ujung gigi untuk ث ذ ظ, dan bertemu bibir bawah pada ف.',
    letters: ['ta', 'dal', 'tha', 'tsa', 'dzal', 'zha', 'fa'],
    pos: new THREE.Vector3(0.0, 0.11, 0.74),
    offset: { x: -94, y: -22 },
    match: (l) => ['ta', 'dal', 'tha', 'tsa', 'dzal', 'zha', 'fa'].includes(l.id),
  },
  {
    id: 'lower_incisors',
    label: 'Gigi Seri Bawah',
    sub: 'Gigi Depan Bawah',
    role: 'Ujung lidah berada di belakang dinding dalam gigi seri bawah untuk huruf desis (safir).',
    letters: ['sin', 'zay', 'shad'],
    pos: new THREE.Vector3(0.0, -0.08, 0.64),
    offset: { x: -98, y: 12 },
    onlyWhenActive: true,
    match: (l) => ['sin', 'zay', 'shad'].includes(l.id),
  },
  {
    id: 'lips',
    label: 'Dua Bibir',
    sub: 'Asy-Syafatan',
    role: 'Pertemuan kedua bibir (ب م), membulatkan bibir (و), dan bibir bawah ke gigi atas (ف).',
    letters: ['ba', 'mim', 'waw', 'fa'],
    pos: new THREE.Vector3(0.0, -0.01, 0.88),
    offset: { x: -84, y: 10 },
    onlyWhenActive: true,
    match: (l) => ['ba', 'mim', 'waw', 'fa'].includes(l.id),
  },
  {
    id: 'molars',
    label: 'Geraham Atas',
    sub: 'Titik Huruf ض',
    role: 'Dinding dalam geraham atas tempat menempelnya tepi/sisi lidah khusus huruf Dhad (ض).',
    letters: ['dhad'],
    pos: new THREE.Vector3(-0.30, 0.14, 0.30),
    offset: { x: -102, y: -20 },
    onlyWhenActive: true,
    match: (l) => l.id === 'dhad',
  },
  {
    id: 'uvula',
    label: 'Anak Tekak (Uvula)',
    sub: 'Pangkal Langit-langit',
    role: 'Langit-langit lunak di belakang mulut untuk pangkal lidah ق dan tenggorokan atas خ غ.',
    letters: ['qaf', 'kha', 'ghain'],
    pos: new THREE.Vector3(0.0, 0.24, -0.33),
    offset: { x: 12, y: -10 },
    match: (l) => ['qaf', 'kha', 'ghain'].includes(l.id),
  },
  {
    id: 'tongue',
    label: 'Lidah',
    sub: 'Al-Lisan',
    role: 'Organ paling aktif (18 huruf): meliputi pangkal, tengah, tepi, dan ujung lidah.',
    letters: ['qaf', 'kaf', 'jim', 'syin', 'ya', 'dhad', 'lam', 'nun', 'ra', 'ta', 'dal', 'tha', 'sin', 'zay', 'shad', 'tsa', 'dzal', 'zha'],
    pos: new THREE.Vector3(0.0, 0.06, 0.22),
    offset: { x: -12, y: 12 },
    match: (l) => l.makhraj === 'allisan' && l.id !== 'dhad',
  },
  {
    id: 'epiglottis',
    label: 'Tenggorokan Tengah',
    sub: 'Katup Epiglotis (ع ح)',
    role: 'Katup epiglotis menyempit ke dinding tenggorokan belakang pada huruf ع dan ح.',
    letters: ['ain', 'ha'],
    pos: new THREE.Vector3(0.0, -0.40, -0.19),
    offset: { x: 16, y: -6 },
    match: (l) => ['ain', 'ha'].includes(l.id),
  },
  {
    id: 'vocals',
    label: 'Pita Suara',
    sub: 'Tenggorokan Bawah (ء ه)',
    role: 'Pangkal tenggorokan paling bawah tempat keluarnya Hamzah (ء) dan Ha besar (ه).',
    letters: ['hamzah', 'haa', 'alif'],
    pos: new THREE.Vector3(0.0, -0.74, -0.24),
    offset: { x: 16, y: 8 },
    match: (l) => ['hamzah', 'haa', 'alif'].includes(l.id),
  },
];

export class AnatomicalLabels {
  constructor(layerEl, headGroup, { onSelectOrgan = null } = {}) {
    this.layerEl = layerEl;
    this.headGroup = headGroup;
    this.onSelectOrgan = onSelectOrgan;
    this.visible = true;
    this._worldPos = new THREE.Vector3();
    this._ndc = new THREE.Vector3();

    this.items = ORGAN_LANDMARKS.map((lm) => {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'anat-pin';
      el.title = `Klik untuk melihat huruf pada ${lm.label}`;
      el.innerHTML = `
        <span class="pin-dot"></span>
        <span class="pin-tag">
          <strong>${lm.label}</strong>
          <small>${lm.sub}</small>
        </span>
      `;
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.onSelectOrgan) this.onSelectOrgan(lm);
      });
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
    const rightPad = isFocusOrMobile ? 24 : 386;

    for (const item of this.items) {
      if (item.onlyWhenActive && !item.active) {
        item.el.style.opacity = '0';
        item.el.style.pointerEvents = 'none';
        continue;
      }

      this._worldPos.copy(item.pos).applyMatrix4(this.headGroup.matrixWorld);
      this._ndc.copy(this._worldPos).project(camera);

      if (this._ndc.z > 1.0) {
        item.el.style.opacity = '0';
        item.el.style.pointerEvents = 'none';
        continue;
      }

      const sx = (this._ndc.x * 0.5 + 0.5) * width;
      const sy = (-this._ndc.y * 0.5 + 0.5) * height;

      const outOfBounds = sx < 16 || sx > width - rightPad || sy < 72 || sy > height - 96;
      if (outOfBounds && !item.active) {
        item.el.style.opacity = '0';
        item.el.style.pointerEvents = 'none';
        continue;
      }

      item.el.style.opacity = '1';
      item.el.style.pointerEvents = 'auto';
      const ox = item.active ? item.offset.x : 0;
      const oy = item.active ? item.offset.y : 0;
      const clampedX = Math.max(12, Math.min(width - rightPad, sx + ox));
      const clampedY = Math.max(66, Math.min(height - 96, sy + oy));
      item.el.style.transform = `translate3d(${clampedX.toFixed(1)}px, ${clampedY.toFixed(1)}px, 0)`;
    }
  }
}
