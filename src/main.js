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
import { ProgressStore } from './learning/ProgressStore.js';
import { QuizManager } from './learning/QuizManager.js';

// ============================================================================
// 0. WebGL Availability Guard & Shared Asset LoadingManager
// ============================================================================
const loadingScreen = document.getElementById('loading-screen');
const loadingBar = document.getElementById('loading-bar');
const loadingStatus = document.getElementById('loading-status');
const webglFallback = document.getElementById('webgl-fallback');

function hasWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

if (!hasWebGL()) {
  loadingScreen.classList.add('done');
  webglFallback.classList.remove('hidden');
  throw new Error('WebGL not supported');
}

const loadingManager = new THREE.LoadingManager();
let loadingFinished = false;
const finishLoading = () => {
  if (loadingFinished) return;
  loadingFinished = true;
  loadingBar.style.width = '100%';
  loadingStatus.textContent = 'Siap — 100%';
  setTimeout(() => loadingScreen.classList.add('done'), 200);
};

loadingManager.onProgress = (_url, loaded, total) => {
  const pct = total > 0 ? Math.min(99, Math.round((loaded / total) * 100)) : 50;
  loadingBar.style.width = `${Math.max(12, pct)}%`;
  loadingStatus.textContent = `Memuat anatomi MRI 3D — ${pct}%`;
};
loadingManager.onLoad = () => finishLoading();
loadingManager.onError = () => finishLoading();
setTimeout(() => finishLoading(), 6500);

// ============================================================================
// 1. Initialize 1:1 MRI 3D Studio Stage & Subsystems
// ============================================================================
const container = document.getElementById('canvas-container');
const labelsLayer = document.getElementById('labels-layer');

const store = new ProgressStore();
const savedPrefs = store.getPrefs();
const quizManager = new QuizManager();

const sceneManager = new SceneManager(container);
const headGroup = sceneManager.headGroup;

const outerHead = new OuterHeadShell(headGroup, sceneManager.renderer, loadingManager);
const vocalTract = new VocalTract(headGroup, loadingManager);
const tongue = new TongueMesh(headGroup);
const highlighter = new MakhrajHighlighter(headGroup);
const airflow = new AirflowParticles(headGroup);
const anatomicalLabels = new AnatomicalLabels(labelsLayer, headGroup);
const controller = new ArticulationController();
const audioManager = new AudioManager();

// ============================================================================
// 2. Application State (with Deep-Link `?huruf=` Support)
// ============================================================================
const urlParams = new URLSearchParams(window.location.search);
const initialHurufParam = urlParams.get('huruf');
const initialLetter = initialHurufParam
  ? getLetterById(initialHurufParam.toLowerCase())
  : getLetterById('ta');

const state = {
  activeLetter: initialLetter,
  activeFilter: 'all',
  activeTab: 'learn', // 'learn' | 'controls' | 'quiz'
  autoCamera: savedPrefs.autoCamera,
  slowMotion: false,
  viewMode: savedPrefs.viewMode,
  clipX: savedPrefs.clipX,
  opacity: savedPrefs.opacity,
};

// ============================================================================
// 3. DOM Elements
// ============================================================================
const elToast = document.getElementById('toast');
const elFilters = document.getElementById('makhraj-filters');
const elStrip = document.getElementById('hijaiyah-strip');
const elChar = document.getElementById('active-char');
const elPhonetic = document.getElementById('active-phonetic');
const elBadge = document.getElementById('active-makhraj-badge');
const elSubMakhraj = document.getElementById('active-submakhraj');
const elSifat = document.getElementById('active-sifat');
const elHowTo = document.getElementById('active-howto');
const elMistake = document.getElementById('active-mistake');
const elComparePairs = document.getElementById('compare-pairs');
const elCompareCaption = document.getElementById('compare-caption');

const elProgressLabel = document.getElementById('progress-label');
const elProgressFill = document.getElementById('progress-fill');

const elMobileChar = document.getElementById('mobile-char');
const elMobilePhonetic = document.getElementById('mobile-phonetic');
const elMobileMakhraj = document.getElementById('mobile-makhraj');
const btnMobilePlay = document.getElementById('btn-mobile-play');
const btnMobileDrawer = document.getElementById('btn-mobile-drawer');
const btnCloseDrawer = document.getElementById('btn-close-drawer');

const btnPlay = document.getElementById('btn-play');
const btnSlowMo = document.getElementById('btn-slowmo');
const btnPrev = document.getElementById('btn-prev-letter');
const btnNext = document.getElementById('btn-next-letter');
const btnFocus3D = document.getElementById('btn-focus-3d');
const btnShare = document.getElementById('btn-share');
const btnResetProgress = document.getElementById('btn-reset-progress');

// Studio Quick-Dissection Bar (Desktop Bottom-Left)
const qbtnSkull = document.getElementById('qbtn-skull');
const qbtnAirflow = document.getElementById('qbtn-airflow');
const qbtnLabels = document.getElementById('qbtn-labels');
const qbtnSlice = document.getElementById('qbtn-slice');

const tabButtons = document.querySelectorAll('.panel-tabs button');
const viewLearn = document.getElementById('view-learn');
const viewControls = document.getElementById('view-controls');
const viewQuiz = document.getElementById('view-quiz');

// Quiz elements
const quizModeButtons = document.querySelectorAll('#quiz-mode-buttons button');
const elQuizMystery = document.getElementById('quiz-mystery-glyph');
const elQuizPrompt = document.getElementById('quiz-prompt');
const elQuizOptions = document.getElementById('quiz-options');
const elQuizFeedback = document.getElementById('quiz-feedback');
const elQuizFeedbackTitle = document.getElementById('quiz-feedback-title');
const elQuizFeedbackBody = document.getElementById('quiz-feedback-body');
const btnQuizReplay = document.getElementById('btn-quiz-replay');
const btnQuizNext = document.getElementById('btn-quiz-next');
const elQCorrect = document.getElementById('q-stat-correct');
const elQTotal = document.getElementById('q-stat-total');
const elQStreak = document.getElementById('q-stat-streak');

// Controls & Layer Dissection elements
const sliderCutaway = document.getElementById('slider-cutaway');
const valCutaway = document.getElementById('val-cutaway');
const sliderOpacity = document.getElementById('slider-opacity');
const valOpacity = document.getElementById('val-opacity');

const chkLayerSkull = document.getElementById('chk-layer-skull');
const chkLayerJaw = document.getElementById('chk-layer-jaw');
const chkLayerPharynx = document.getElementById('chk-layer-pharynx');
const chkLayerNasal = document.getElementById('chk-layer-nasal');
const chkLayerTongue = document.getElementById('chk-layer-tongue');

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

let toastTimer = null;
function showToast(msg) {
  elToast.textContent = msg;
  elToast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => elToast.classList.remove('show'), 2200);
}

// ============================================================================
// 4. Progress, Filters & 29-Letter Hijaiyah Dock
// ============================================================================
function updateProgressUI() {
  const count = store.getLearnedCount();
  const total = HIJAIYAH_LETTERS.length;
  elProgressLabel.textContent = `${count} / ${total} huruf`;
  elProgressFill.style.width = `${Math.round((count / total) * 100)}%`;

  elStrip.querySelectorAll('.letter-tile').forEach((tile) => {
    tile.classList.toggle('learned', store.isLearned(tile.dataset.id));
  });
}

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
      if (match && state.activeTab !== 'quiz') {
        selectLetter(match, { playAudio: false });
      }
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
    btn.onclick = () => {
      if (state.activeTab === 'quiz') switchTab('learn');
      selectLetter(letter, { playAudio: true });
    };
    elStrip.appendChild(btn);
  });
}

function updateDockFilter() {
  const hideActiveInQuiz =
    state.activeTab === 'quiz' &&
    quizManager.currentQuestion &&
    quizManager.currentQuestion.mode === 'letter' &&
    !quizManager.currentQuestion.answered;

  elStrip.querySelectorAll('.letter-tile').forEach((tile) => {
    const letter = getLetterById(tile.dataset.id);
    const matches =
      state.activeFilter === 'all' ||
      letter.makhraj === state.activeFilter ||
      letter.secondaryMakhraj === state.activeFilter;
    tile.classList.toggle('dimmed', !matches);
    tile.classList.toggle('active', !hideActiveInQuiz && letter.id === state.activeLetter.id);
    tile.classList.toggle('learned', store.isLearned(letter.id));
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
// 5. Core Letter Selection, Dissection Sync & Pronunciation
// ============================================================================
function updateCutawayUI(xVal, persist = true) {
  state.clipX = xVal;
  sliderCutaway.value = xVal;
  outerHead.setClipX(xVal);
  const enableInternalCut =
    (state.viewMode === 'xray-cut' || state.viewMode === 'solid-cut') && xVal < 0.75;
  vocalTract.setCutaway(enableInternalCut, xVal);

  const isSagittal = xVal <= 0.14;
  if (isSagittal) valCutaway.textContent = 'Sagital (Tengah)';
  else if (xVal >= 1.1) valCutaway.textContent = 'Utuh';
  else valCutaway.textContent = `${Math.round(((xVal + 0.35) / 1.8) * 100)}%`;

  qbtnSlice.classList.toggle('active', isSagittal);
  qbtnSlice.textContent = isSagittal ? 'Sagital' : 'Utuh';

  if (persist) store.updatePref('clipX', xVal);
}

function setActiveCamPreset(presetKey) {
  sceneManager.focusPreset(presetKey);
  camPresetButtons.forEach((b) =>
    b.classList.toggle('active', b.dataset.preset === presetKey)
  );
}

function syncUrlDeepLink(letterId) {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('huruf', letterId);
    window.history.replaceState({}, '', url);
  } catch {
    // Ignore history API errors
  }
}

function applyLetterTo3D(letter, { triggerPulse = false, concealLabels = false } = {}) {
  const cat = MAKHRAJ_CATEGORIES[letter.makhraj];
  controller.setLetter(letter, triggerPulse);
  highlighter.setLetter(letter);
  airflow.setConfig(letter.airflow);
  anatomicalLabels.setLetter(concealLabels ? null : letter);
  sceneManager.setMakhrajLight(
    new THREE.Vector3(...letter.focusPoint),
    cat.color
  );

  // Preserve user's camera angle, cutaway slice, X-Ray opacity & layers across letters!
  if (state.autoCamera) {
    setActiveCamPreset(letter.cameraPreset || 'side');
  }
}

function selectLetter(letter, { playAudio = false, updateUrl = true } = {}) {
  state.activeLetter = letter;
  const cat = MAKHRAJ_CATEGORIES[letter.makhraj];

  applyLetterTo3D(letter, { triggerPulse: playAudio, concealLabels: false });
  if (updateUrl) syncUrlDeepLink(letter.id);

  elChar.textContent = letter.char;
  elPhonetic.textContent = letter.phonetic;
  elBadge.textContent = letter.secondaryMakhraj
    ? `${cat.name} + Khaisyum`
    : cat.name;

  elSubMakhraj.textContent = letter.subMakhraj;
  elHowTo.textContent = letter.howTo;
  elMistake.textContent = letter.mistakeWarning;

  elMobileChar.textContent = letter.char;
  elMobilePhonetic.textContent = letter.phonetic;
  elMobileMakhraj.textContent = cat.name;

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
    triggerPronounce(letter);
  }
}

function triggerPronounce(letter = state.activeLetter) {
  controller.triggerPronunciation();
  btnPlay.classList.add('playing');
  if (state.activeTab !== 'quiz') {
    store.markLearned(letter.id);
    updateProgressUI();
  }
  audioManager.playLetter(letter, {
    slowMotion: state.slowMotion,
    onEnd: () => btnPlay.classList.remove('playing'),
  });
  setTimeout(() => {
    if (!audioManager.isPlaying) {
      btnPlay.classList.remove('playing');
    }
  }, state.slowMotion ? 2200 : 1400);
}

// ============================================================================
// 6. Interactive Quiz Mode
// ============================================================================
function updateQuizStatsUI() {
  const stats = store.getQuizStats();
  elQCorrect.textContent = stats.correct;
  elQTotal.textContent = stats.total;
  elQStreak.textContent = stats.streak;
}

function loadNextQuizQuestion(playSound = true) {
  const q = quizManager.nextQuestion();
  state.activeLetter = q.letter;

  applyLetterTo3D(q.letter, {
    triggerPulse: true,
    concealLabels: q.mode === 'letter',
  });

  elQuizMystery.textContent = q.mode === 'letter' ? '?' : q.letter.char;
  elQuizPrompt.textContent = q.prompt;
  elQuizFeedback.classList.add('hidden');
  btnQuizNext.classList.add('hidden');

  elQuizOptions.innerHTML = '';
  q.options.forEach((opt) => {
    const btn = document.createElement('button');
    btn.className = 'quiz-opt';
    btn.dataset.val = opt.value;
    btn.innerHTML = `
      <span class="opt-main ${opt.isArabic ? 'arabic' : ''}">${opt.label}</span>
      <span class="opt-sub">${opt.sub}</span>
    `;
    btn.onclick = () => handleQuizAnswer(opt.value);
    elQuizOptions.appendChild(btn);
  });

  elMobileChar.textContent = q.mode === 'letter' ? '?' : q.letter.char;
  elMobilePhonetic.textContent = q.mode === 'letter' ? 'Kuis Tebak Huruf' : q.letter.phonetic;
  elMobileMakhraj.textContent = 'Mode Latihan';

  updateDockFilter();

  if (playSound) {
    audioManager.playLetter(q.letter, { slowMotion: state.slowMotion });
  }
}

function handleQuizAnswer(selectedValue) {
  const res = quizManager.submitAnswer(selectedValue);
  if (!res) return;

  const { isCorrect, question } = res;
  const letter = question.letter;
  const cat = MAKHRAJ_CATEGORIES[letter.makhraj];

  store.recordQuizResult(isCorrect);
  if (isCorrect) store.markLearned(letter.id);
  updateQuizStatsUI();
  updateProgressUI();

  elQuizMystery.textContent = letter.char;
  anatomicalLabels.setLetter(letter);
  updateDockFilter();

  elQuizOptions.querySelectorAll('.quiz-opt').forEach((btn) => {
    btn.disabled = true;
    const val = btn.dataset.val;
    if (val === question.correctValue) {
      btn.classList.add('correct');
    } else if (val === selectedValue && !isCorrect) {
      btn.classList.add('wrong');
    } else {
      btn.classList.add('faded');
    }
  });

  elQuizFeedbackTitle.textContent = isCorrect
    ? `Benar — ${letter.phonetic} (${letter.char}) · ${cat.name}`
    : `Kurang tepat — Jawaban: ${letter.phonetic} (${letter.char}) · ${cat.name}`;
  elQuizFeedbackBody.textContent = `${letter.subMakhraj}. ${letter.howTo}`;
  elQuizFeedback.classList.remove('hidden');
  btnQuizNext.classList.remove('hidden');
}

function switchTab(tabName) {
  const prevTab = state.activeTab;
  state.activeTab = tabName;
  tabButtons.forEach((b) => {
    const active = b.dataset.tab === tabName;
    b.classList.toggle('active', active);
    b.setAttribute('aria-selected', String(active));
  });

  viewLearn.classList.toggle('hidden', tabName !== 'learn');
  viewControls.classList.toggle('hidden', tabName !== 'controls');
  viewQuiz.classList.toggle('hidden', tabName !== 'quiz');

  if (tabName === 'quiz') {
    updateQuizStatsUI();
    loadNextQuizQuestion(true);
  } else if (prevTab === 'quiz') {
    selectLetter(state.activeLetter, { playAudio: false });
  }
}

// ============================================================================
// 7. Wire Up Tabs, Layer Dissection, Studio Quick-Bar & Shortcuts
// ============================================================================
tabButtons.forEach((btn) => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

quizModeButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    quizModeButtons.forEach((b) => b.classList.toggle('active', b === btn));
    quizManager.setMode(btn.dataset.qmode);
    loadNextQuizQuestion(true);
  });
});

btnQuizReplay.addEventListener('click', () => {
  if (!quizManager.currentQuestion) return;
  controller.triggerPronunciation();
  audioManager.playLetter(quizManager.currentQuestion.letter, { slowMotion: state.slowMotion });
});

btnQuizNext.addEventListener('click', () => loadNextQuizQuestion(true));

btnPlay.addEventListener('click', () => triggerPronounce());
btnMobilePlay.addEventListener('click', () => {
  if (state.activeTab === 'quiz' && quizManager.currentQuestion) {
    controller.triggerPronunciation();
    audioManager.playLetter(quizManager.currentQuestion.letter, { slowMotion: state.slowMotion });
  } else {
    triggerPronounce();
  }
});

btnMobileDrawer.addEventListener('click', () => {
  const open = document.body.classList.toggle('mobile-sheet-open');
  btnMobileDrawer.setAttribute('aria-expanded', String(open));
});

btnCloseDrawer.addEventListener('click', () => {
  document.body.classList.remove('mobile-sheet-open');
  btnMobileDrawer.setAttribute('aria-expanded', 'false');
});

btnSlowMo.addEventListener('click', () => {
  state.slowMotion = !state.slowMotion;
  btnSlowMo.classList.toggle('active', state.slowMotion);
  controller.setSlowMotion(state.slowMotion);
});

btnFocus3D.addEventListener('click', () => {
  document.body.classList.toggle('focus-3d');
});

btnShare.addEventListener('click', async () => {
  const url = new URL(window.location.href);
  url.searchParams.set('huruf', state.activeLetter.id);
  const shareUrl = url.toString();
  try {
    await navigator.clipboard.writeText(shareUrl);
    showToast(`Tautan huruf ${state.activeLetter.phonetic} (${state.activeLetter.char}) disalin`);
  } catch {
    showToast(shareUrl);
  }
});

btnResetProgress.addEventListener('click', () => {
  store.resetProgress();
  updateProgressUI();
  updateQuizStatsUI();
  showToast('Progres belajar direset');
});

const stepLetter = (delta) => {
  if (state.activeTab === 'quiz') switchTab('learn');
  const idx = HIJAIYAH_LETTERS.findIndex((l) => l.id === state.activeLetter.id);
  const nextIdx = (idx + delta + HIJAIYAH_LETTERS.length) % HIJAIYAH_LETTERS.length;
  selectLetter(HIJAIYAH_LETTERS[nextIdx], { playAudio: true });
};

btnPrev.addEventListener('click', () => stepLetter(1));
btnNext.addEventListener('click', () => stepLetter(-1));

function applyViewMode(mode, persist = true) {
  state.viewMode = mode;
  viewModeButtons.forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
  outerHead.setViewMode(mode);

  const internalCut = (mode === 'xray-cut' || mode === 'solid-cut') && state.clipX < 0.75;
  vocalTract.setCutaway(internalCut, state.clipX);
  if (persist) store.updatePref('viewMode', mode);
}

function setSkullLayer(visible, persist = true) {
  chkLayerSkull.checked = visible;
  vocalTract.setLayerVisible('skull', visible);
  qbtnSkull.classList.toggle('active', visible);
  if (persist) store.updatePref('layerSkull', visible);
}

function setAirflowVisible(visible, persist = true) {
  chkAirflow.checked = visible;
  airflow.setVisible(visible);
  qbtnAirflow.classList.toggle('active', visible);
  if (persist) store.updatePref('showAirflow', visible);
}

function setLabelsVisible(visible, persist = true) {
  chkLabels.checked = visible;
  anatomicalLabels.setVisible(visible);
  qbtnLabels.classList.toggle('active', visible);
  if (persist) store.updatePref('showLabels', visible);
}

viewModeButtons.forEach((btn) => {
  btn.addEventListener('click', () => applyViewMode(btn.dataset.mode, true));
});

sliderCutaway.addEventListener('input', (e) => {
  updateCutawayUI(parseFloat(e.target.value), true);
});

sliderOpacity.addEventListener('input', (e) => {
  const v = parseFloat(e.target.value);
  state.opacity = v;
  outerHead.setOpacity(v);
  valOpacity.textContent = `${Math.round(v * 100)}%`;
  store.updatePref('opacity', v);
});

// Anatomical Layer Dissection Toggles
chkLayerSkull.addEventListener('change', (e) => setSkullLayer(e.target.checked, true));
chkLayerJaw.addEventListener('change', (e) => {
  vocalTract.setLayerVisible('jaw', e.target.checked);
  store.updatePref('layerJaw', e.target.checked);
});
chkLayerPharynx.addEventListener('change', (e) => {
  vocalTract.setLayerVisible('pharynx', e.target.checked);
  store.updatePref('layerPharynx', e.target.checked);
});
chkLayerNasal.addEventListener('change', (e) => {
  vocalTract.setLayerVisible('nasal', e.target.checked);
  store.updatePref('layerNasal', e.target.checked);
});
chkLayerTongue.addEventListener('change', (e) => {
  tongue.setVisible(e.target.checked);
  store.updatePref('layerTongue', e.target.checked);
});

// Bottom-left Quick-Dissection Buttons
qbtnSkull.addEventListener('click', () => setSkullLayer(!chkLayerSkull.checked, true));
qbtnAirflow.addEventListener('click', () => setAirflowVisible(!chkAirflow.checked, true));
qbtnLabels.addEventListener('click', () => setLabelsVisible(!chkLabels.checked, true));
qbtnSlice.addEventListener('click', () => {
  const currentlySagittal = state.clipX <= 0.14;
  updateCutawayUI(currentlySagittal ? 1.25 : 0.04, true);
});

chkAirflow.addEventListener('change', (e) => setAirflowVisible(e.target.checked, true));
chkLabels.addEventListener('change', (e) => setLabelsVisible(e.target.checked, true));
chkAutoCam.addEventListener('change', (e) => {
  state.autoCamera = e.target.checked;
  store.updatePref('autoCamera', e.target.checked);
});
chkBloom.addEventListener('change', (e) => {
  sceneManager.setBloomEnabled(e.target.checked);
  store.updatePref('bloom', e.target.checked);
});
chkSimpleHead.addEventListener('change', (e) => {
  outerHead.setModelStyle(e.target.checked);
  store.updatePref('simpleHead', e.target.checked);
});

camPresetButtons.forEach((btn) => {
  btn.addEventListener('click', () => setActiveCamPreset(btn.dataset.preset));
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
    if (state.activeTab === 'quiz' && quizManager.currentQuestion) {
      controller.triggerPronunciation();
      audioManager.playLetter(quizManager.currentQuestion.letter, { slowMotion: state.slowMotion });
    } else {
      triggerPronounce();
    }
  } else if (e.code === 'ArrowLeft') {
    stepLetter(1);
  } else if (e.code === 'ArrowRight') {
    stepLetter(-1);
  } else if (e.key === 'Escape') {
    infoModal.classList.add('hidden');
    document.body.classList.remove('focus-3d');
    document.body.classList.remove('mobile-sheet-open');
  }
});

// ============================================================================
// 8. Restore Saved Preferences, Boot & Render Loop
// ============================================================================
function restoreSavedPreferences() {
  sliderOpacity.value = savedPrefs.opacity;
  valOpacity.textContent = `${Math.round(savedPrefs.opacity * 100)}%`;
  outerHead.setOpacity(savedPrefs.opacity);

  setSkullLayer(savedPrefs.layerSkull, false);
  chkLayerJaw.checked = savedPrefs.layerJaw;
  vocalTract.setLayerVisible('jaw', savedPrefs.layerJaw);
  chkLayerPharynx.checked = savedPrefs.layerPharynx;
  vocalTract.setLayerVisible('pharynx', savedPrefs.layerPharynx);
  chkLayerNasal.checked = savedPrefs.layerNasal;
  vocalTract.setLayerVisible('nasal', savedPrefs.layerNasal);
  chkLayerTongue.checked = savedPrefs.layerTongue;
  tongue.setVisible(savedPrefs.layerTongue);

  setAirflowVisible(savedPrefs.showAirflow, false);
  setLabelsVisible(savedPrefs.showLabels, false);
  chkAutoCam.checked = savedPrefs.autoCamera;
  chkBloom.checked = savedPrefs.bloom;
  sceneManager.setBloomEnabled(savedPrefs.bloom);
  chkSimpleHead.checked = savedPrefs.simpleHead;
  outerHead.setModelStyle(savedPrefs.simpleHead);

  applyViewMode(savedPrefs.viewMode, false);
  updateCutawayUI(savedPrefs.clipX, false);
}

renderFilterPills();
renderHijaiyahDock();
restoreSavedPreferences();
updateProgressUI();
updateQuizStatsUI();
selectLetter(state.activeLetter, { playAudio: false, updateUrl: Boolean(initialHurufParam) });

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
