import * as THREE from 'three';
import './style.css';
import {
  HIJAIYAH_LETTERS,
  MAKHRAJ_CATEGORIES,
  CONFUSION_PAIRS,
  getLetterById,
} from './data/hijaiyahData.js';
import { SceneManager } from './scene/SceneManager.js';
import { OuterHeadShell } from './scene/OuterHeadShell.js';
import { TongueMesh } from './scene/TongueMesh.js';
import { VocalTract } from './scene/VocalTract.js';
import { MakhrajHighlighter } from './scene/MakhrajHighlighter.js';
import { AirflowParticles } from './scene/AirflowParticles.js';
import { AnatomicalLabels } from './scene/AnatomicalLabels.js';
import { ArticulationController } from './scene/ArticulationController.js';
import { AudioManager } from './audio/AudioManager.js';

// ============================================================================
// 1. Initialize Premium Studio 3D Stage & Real Anatomical Subsystems
// ============================================================================
const container = document.getElementById('canvas-container');
const labelsLayer = document.getElementById('labels-layer');

const sceneManager = new SceneManager(container);
const headGroup = sceneManager.headGroup;

const outerHead = new OuterHeadShell(headGroup, sceneManager.renderer);
const vocalTract = new VocalTract(headGroup);
const tongue = new TongueMesh(headGroup);
const highlighter = new MakhrajHighlighter(headGroup);
const airflow = new AirflowParticles(headGroup);
const anatomicalLabels = new AnatomicalLabels(labelsLayer, headGroup);
const controller = new ArticulationController();
const audioManager = new AudioManager();

// ============================================================================
// 2. Application State
// ============================================================================
const state = {
  activeLetter: getLetterById('ta'),
  activeFilter: 'all',
  autoCamera: false,
  slowMotion: false,
  viewMode: 'xray-cut',
  clipX: 0.04,
};

// ============================================================================
// 3. DOM Elements
// ============================================================================
const elFilters = document.getElementById('makhraj-filters');
const elStrip = document.getElementById('hijaiyah-strip');
const elChar = document.getElementById('active-char');
const elGlyphWrap = document.getElementById('letter-glyph-wrap');
const elPhonetic = document.getElementById('active-phonetic');
const elBadge = document.getElementById('active-makhraj-badge');
const elSubMakhraj = document.getElementById('active-submakhraj');
const elSifat = document.getElementById('active-sifat');
const elHowTo = document.getElementById('active-howto');
const elMistake = document.getElementById('active-mistake');
const elComparePairs = document.getElementById('compare-pairs');
const elCompareCaption = document.getElementById('compare-caption');

const btnPlay = document.getElementById('btn-play');
const btnSlowMo = document.getElementById('btn-slowmo');
const btnPrev = document.getElementById('btn-prev-letter');
const btnNext = document.getElementById('btn-next-letter');
const btnFocus3D = document.getElementById('btn-focus-3d');

const sliderCutaway = document.getElementById('slider-cutaway');
const valCutaway = document.getElementById('val-cutaway');
const sliderOpacity = document.getElementById('slider-opacity');
const valOpacity = document.getElementById('val-opacity');

const chkAirflow = document.getElementById('chk-airflow');
const chkLabels = document.getElementById('chk-labels');
const chkAutoCam = document.getElementById('chk-autocam');
const chkBloom = document.getElementById('chk-bloom');
const chkSimpleHead = document.getElementById('chk-simple-head');

const viewModeButtons = document.querySelectorAll('#view-mode-buttons button');
const camPresetButtons = document.querySelectorAll('#cam-presets button');

const infoModal = document.getElementById('info-modal');
const btnInfoModal = document.getElementById('btn-info-modal');
const btnCloseModal = document.getElementById('btn-close-modal');

// ============================================================================
// 4. Build Dynamic Filter Pills & 29-Letter Hijaiyah Dock
// ============================================================================
function renderFilterPills() {
  elFilters.innerHTML = '';

  const allPill = document.createElement('button');
  allPill.className = `filter-pill ${state.activeFilter === 'all' ? 'active' : ''}`;
  allPill.textContent = 'Semua (29)';
  allPill.onclick = () => {
    state.activeFilter = 'all';
    renderFilterPills();
    updateDockFilter();
  };
  elFilters.appendChild(allPill);

  Object.values(MAKHRAJ_CATEGORIES).forEach((cat) => {
    const btn = document.createElement('button');
    btn.className = `filter-pill ${state.activeFilter === cat.id ? 'active' : ''}`;
    btn.style.setProperty('--pill-color', cat.color);
    btn.innerHTML = `<i class="dot" style="background:${cat.color}"></i> ${cat.name}`;
    btn.title = `${cat.name} (${cat.arabic}) — ${cat.subtitle}`;
    btn.onclick = () => {
      state.activeFilter = cat.id;
      renderFilterPills();
      updateDockFilter();
      const match = HIJAIYAH_LETTERS.find(
        (l) => l.makhraj === cat.id || l.secondaryMakhraj === cat.id
      );
      if (match) selectLetter(match, { playAudio: false });
    };
    elFilters.appendChild(btn);
  });
}

function renderHijaiyahDock() {
  elStrip.innerHTML = '';
  HIJAIYAH_LETTERS.forEach((letter) => {
    const cat = MAKHRAJ_CATEGORIES[letter.makhraj];
    const btn = document.createElement('button');
    btn.className = 'letter-tile';
    btn.dataset.id = letter.id;
    btn.style.setProperty('--tile-color', cat.color);
    btn.title = `${letter.phonetic} (${letter.char}) — ${cat.name}`;
    btn.innerHTML = `
      <span class="tile-dot"></span>
      <span class="tile-char">${letter.char}</span>
      <span class="tile-latin">${letter.phonetic.split(' ')[0]}</span>
    `;
    btn.onclick = () => selectLetter(letter, { playAudio: true });
    elStrip.appendChild(btn);
  });
}

function updateDockFilter() {
  const tiles = elStrip.querySelectorAll('.letter-tile');
  tiles.forEach((tile) => {
    const letter = getLetterById(tile.dataset.id);
    const matches =
      state.activeFilter === 'all' ||
      letter.makhraj === state.activeFilter ||
      letter.secondaryMakhraj === state.activeFilter;
    tile.classList.toggle('dimmed', !matches);
    tile.classList.toggle('active', letter.id === state.activeLetter.id);
  });
}

function renderCompareButtons(activeLetter) {
  elComparePairs.innerHTML = '';
  const matchingGroup = CONFUSION_PAIRS.find((g) => g.letters.includes(activeLetter.id));

  if (matchingGroup) {
    elCompareCaption.textContent = matchingGroup.desc;
    matchingGroup.letters.forEach((id) => {
      const l = getLetterById(id);
      const btn = document.createElement('button');
      btn.className = `compare-btn ${l.id === activeLetter.id ? 'active' : ''}`;
      btn.innerHTML = `<span class="ar">${l.char}</span> <span>${l.phonetic.split(' ')[0]}</span>`;
      btn.onclick = () => selectLetter(l, { playAudio: true });
      elComparePairs.appendChild(btn);
    });
  } else {
    elCompareCaption.textContent = 'Pasangan populer';
    CONFUSION_PAIRS.slice(0, 4).forEach((pair) => {
      const btn = document.createElement('button');
      btn.className = 'compare-btn';
      btn.innerHTML = `<span class="ar">${pair.label}</span>`;
      btn.title = pair.desc;
      btn.onclick = () => selectLetter(getLetterById(pair.letters[0]), { playAudio: true });
      elComparePairs.appendChild(btn);
    });
  }
}

// ============================================================================
// 5. Core Letter Selection & Pronunciation Synchronization
// ============================================================================
function updateCutawayUI(xVal) {
  state.clipX = xVal;
  sliderCutaway.value = xVal;
  outerHead.setClipX(xVal);
  const enableInternalCut =
    (state.viewMode === 'xray-cut' || state.viewMode === 'solid-cut') && xVal < 0.75;
  vocalTract.setCutaway(enableInternalCut, xVal);

  if (xVal <= 0.12) valCutaway.textContent = 'Sagital (Tengah)';
  else if (xVal >= 1.1) valCutaway.textContent = 'Utuh';
  else valCutaway.textContent = `${Math.round(((xVal + 0.35) / 1.8) * 100)}%`;
}

function setActiveCamPreset(presetKey) {
  sceneManager.focusPreset(presetKey);
  camPresetButtons.forEach((b) =>
    b.classList.toggle('active', b.dataset.preset === presetKey)
  );
}

function selectLetter(letter, { playAudio = false } = {}) {
  state.activeLetter = letter;
  const cat = MAKHRAJ_CATEGORIES[letter.makhraj];

  controller.setLetter(letter, playAudio);
  highlighter.setLetter(letter);
  airflow.setConfig(letter.airflow);
  anatomicalLabels.setLetter(letter);
  sceneManager.setMakhrajLight(
    new THREE.Vector3(...letter.focusPoint),
    cat.color
  );

  // Preserve user's camera angle, cutaway slice, X-Ray opacity & view mode across letters.
  // Only move camera if the user explicitly enabled the optional Auto-Kamera toggle.
  if (state.autoCamera) {
    const preset = letter.cameraPreset || 'side';
    setActiveCamPreset(preset);
  }

  elChar.textContent = letter.char;
  elGlyphWrap.style.background = '#171717';
  elGlyphWrap.style.borderColor = 'rgba(255, 255, 255, 0.24)';
  elPhonetic.textContent = letter.phonetic;
  elBadge.textContent = letter.secondaryMakhraj
    ? `${cat.name} + Khaisyum`
    : cat.name;
  elBadge.style.background = 'rgba(255, 255, 255, 0.08)';
  elBadge.style.color = '#f5f5f5';

  elSubMakhraj.textContent = letter.subMakhraj;
  elHowTo.textContent = letter.howTo;
  elMistake.textContent = letter.mistakeWarning;

  elSifat.innerHTML = letter.sifat
    .map((s) => `<span class="sifat-chip">${s}</span>`)
    .join('');

  renderCompareButtons(letter);
  updateDockFilter();

  const activeTile = elStrip.querySelector(`.letter-tile[data-id="${letter.id}"]`);
  if (activeTile) {
    activeTile.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }

  if (playAudio) {
    triggerPronounce();
  }
}

function triggerPronounce() {
  controller.triggerPronunciation();
  btnPlay.classList.add('playing');
  audioManager.playLetter(state.activeLetter, {
    slowMotion: state.slowMotion,
    onEnd: () => {
      btnPlay.classList.remove('playing');
    },
  });
  setTimeout(() => {
    if (!audioManager.isPlaying) {
      btnPlay.classList.remove('playing');
    }
  }, state.slowMotion ? 2200 : 1400);
}

// ============================================================================
// 6. Wire Up Controls & Keyboard Shortcuts
// ============================================================================
btnPlay.addEventListener('click', () => triggerPronounce());

btnSlowMo.addEventListener('click', () => {
  state.slowMotion = !state.slowMotion;
  btnSlowMo.classList.toggle('active', state.slowMotion);
  controller.setSlowMotion(state.slowMotion);
});

btnFocus3D.addEventListener('click', () => {
  document.body.classList.toggle('focus-3d');
});

const stepLetter = (delta) => {
  const idx = HIJAIYAH_LETTERS.findIndex((l) => l.id === state.activeLetter.id);
  const nextIdx = (idx + delta + HIJAIYAH_LETTERS.length) % HIJAIYAH_LETTERS.length;
  selectLetter(HIJAIYAH_LETTERS[nextIdx], { playAudio: true });
};

btnPrev.addEventListener('click', () => stepLetter(1));
btnNext.addEventListener('click', () => stepLetter(-1));

viewModeButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    const mode = btn.dataset.mode;
    state.viewMode = mode;
    viewModeButtons.forEach((b) => b.classList.toggle('active', b === btn));
    outerHead.setViewMode(mode);

    const internalCut = (mode === 'xray-cut' || mode === 'solid-cut') && state.clipX < 0.75;
    vocalTract.setCutaway(internalCut, state.clipX);
  });
});

sliderCutaway.addEventListener('input', (e) => {
  updateCutawayUI(parseFloat(e.target.value));
});

sliderOpacity.addEventListener('input', (e) => {
  const v = parseFloat(e.target.value);
  outerHead.setOpacity(v);
  valOpacity.textContent = `${Math.round(v * 100)}%`;
});

chkAirflow.addEventListener('change', (e) => {
  airflow.setVisible(e.target.checked);
});

chkLabels.addEventListener('change', (e) => {
  anatomicalLabels.setVisible(e.target.checked);
});

chkAutoCam.addEventListener('change', (e) => {
  state.autoCamera = e.target.checked;
});

chkBloom.addEventListener('change', (e) => {
  sceneManager.setBloomEnabled(e.target.checked);
});

chkSimpleHead.addEventListener('change', (e) => {
  outerHead.setModelStyle(e.target.checked);
});

camPresetButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    setActiveCamPreset(btn.dataset.preset);
  });
});

btnInfoModal.addEventListener('click', () => infoModal.classList.remove('hidden'));
btnCloseModal.addEventListener('click', () => infoModal.classList.add('hidden'));
infoModal.addEventListener('click', (e) => {
  if (e.target === infoModal) infoModal.classList.add('hidden');
});

window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (e.code === 'Space') {
    e.preventDefault();
    triggerPronounce();
  } else if (e.code === 'ArrowLeft') {
    stepLetter(1);
  } else if (e.code === 'ArrowRight') {
    stepLetter(-1);
  } else if (e.key === 'Escape') {
    infoModal.classList.add('hidden');
    document.body.classList.remove('focus-3d');
  }
});

// ============================================================================
// 7. Boot & Real-Time Render Loop
// ============================================================================
renderFilterPills();
renderHijaiyahDock();
updateCutawayUI(state.clipX);
selectLetter(state.activeLetter, { playAudio: false });

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.getElapsedTime();

  const audioLevel = audioManager.getAudioLevel();
  const pose = controller.update(dt);

  tongue.updatePose(pose, elapsed, audioLevel);
  vocalTract.updatePose(pose, state.activeLetter, elapsed, audioLevel);
  outerHead.applyPose(pose, audioLevel);
  outerHead.update(elapsed);
  highlighter.update(dt, elapsed, sceneManager.camera, audioLevel);
  airflow.update(dt, elapsed, controller.getSpeedMultiplier(), audioLevel);
  sceneManager.update(dt);
  anatomicalLabels.update(sceneManager.camera, sceneManager.renderer);

  sceneManager.render();
}

animate();
