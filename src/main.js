import * as THREE from 'three';
import './style.css';
import {
  HIJAIYAH_LETTERS,
  MAKHRAJ_CATEGORIES,
  CONFUSION_PAIRS,
  getLetterById,
  getSifatExplanation,
} from './data/hijaiyahData.js';
import { SceneManager } from './scene/SceneManager.js';
import { OuterHeadShell } from './scene/OuterHeadShell.js';
import { TongueMesh } from './scene/TongueMesh.js';
import { LipsMesh } from './scene/LipsMesh.js';
import { VocalTract } from './scene/VocalTract.js';
import { MakhrajHighlighter } from './scene/MakhrajHighlighter.js';
import { AirflowParticles } from './scene/AirflowParticles.js';
import { AnatomicalLabels } from './scene/AnatomicalLabels.js';
import { ArticulationController } from './scene/ArticulationController.js';
import { AudioManager } from './audio/AudioManager.js';
import { VoiceRecorder } from './audio/VoiceRecorder.js';
import { ProgressStore } from './learning/ProgressStore.js';
import { QuizManager } from './learning/QuizManager.js';

// ============================================================================
// 0. WebGL Guard, Offline PWA Service Worker & Shared Asset LoadingManager
// ============================================================================
const loadingScreen = document.getElementById('loading-screen');
const loadingBar = document.getElementById('loading-bar');
const loadingStatus = document.getElementById('loading-status');
const webglFallback = document.getElementById('webgl-fallback');
const metaThemeColor = document.getElementById('meta-theme-color');

if (
  'serviceWorker' in navigator &&
  window.location.hostname !== 'localhost' &&
  window.location.hostname !== '127.0.0.1'
) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

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
  setTimeout(() => loadingScreen.classList.add('done'), 220);
};

loadingManager.onProgress = (_url, loaded, total) => {
  const pct = total > 0 ? Math.min(99, Math.round((loaded / total) * 100)) : 50;
  loadingBar.style.width = `${Math.max(12, pct)}%`;
  loadingStatus.textContent = `Memuat — ${pct}%`;
};
loadingManager.onLoad = () => {
  finishLoading();
  sceneManager.requestShadowUpdate(true);
};
loadingManager.onError = () => finishLoading();
setTimeout(() => finishLoading(), 6500);

// ============================================================================
// 1. Initialize 1:1 3D Learning Stage & Subsystems
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
const tongue = new TongueMesh(headGroup, vocalTract.sagittalClipPlane);
const lips = new LipsMesh(headGroup, vocalTract.sagittalClipPlane);
const highlighter = new MakhrajHighlighter(headGroup);
const airflow = new AirflowParticles(headGroup);
const controller = new ArticulationController();
const audioManager = new AudioManager();
const voiceRecorder = new VoiceRecorder();

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
  theme: savedPrefs.theme === 'dark' ? 'dark' : 'light',
  autoCamera: savedPrefs.autoCamera,
  slowMotion: false,
  loopPractice: false,
  compareMorphActive: false,
  viewMode: savedPrefs.viewMode,
  clipX: savedPrefs.clipX,
  opacity: savedPrefs.opacity,
};

let loopTimer = null;
let compareMorphTimer = null;
let compareMorphGroup = null;
let compareMorphIdx = 0;

// ============================================================================
// 3. DOM Elements
// ============================================================================
const elToast = document.getElementById('toast');
const elFilters = document.getElementById('makhraj-filters');
const elStrip = document.getElementById('hijaiyah-strip');
const elWelcomeStrip = document.getElementById('welcome-strip');
const btnStartAlif = document.getElementById('btn-start-alif');
const btnDismissWelcome = document.getElementById('btn-dismiss-welcome');

// Organ Explorer (clickable 3D pins)
const elOrganExplorer = document.getElementById('organ-explorer');
const elOeTitle = document.getElementById('oe-title');
const elOeSub = document.getElementById('oe-sub');
const elOeRole = document.getElementById('oe-role');
const elOeLetters = document.getElementById('oe-letters');
const btnCloseOe = document.getElementById('btn-close-oe');

const elChar = document.getElementById('active-char');
const elPhonetic = document.getElementById('active-phonetic');
const elActiveIndex = document.getElementById('active-index');
const elBadge = document.getElementById('active-makhraj-badge');
const btnMarkMastered = document.getElementById('btn-mark-mastered');
const elMasteryLabel = document.getElementById('mastery-pill-label');
const elSifat = document.getElementById('active-sifat');
const elSifatHint = document.getElementById('sifat-hint');
const elSifatDef = document.getElementById('sifat-def');
const elOrganMover = document.getElementById('organ-mover');
const elOrganTarget = document.getElementById('organ-target');
const elHowTo = document.getElementById('active-howto');
const elMistake = document.getElementById('active-mistake');

// Tahsin Harakat & Quranic Example
const elDrillChips = document.getElementById('drill-chips');
const elQuranArabic = document.getElementById('quran-arabic');
const elQuranLatin = document.getElementById('quran-latin');
const elQuranSurah = document.getElementById('quran-surah');

// Voice Recorder UI
const btnRecord = document.getElementById('btn-record');
const elRecordLabel = document.getElementById('btn-record-label');
const btnPlayMine = document.getElementById('btn-play-mine');
const btnAbAudio = document.getElementById('btn-ab-audio');
const elMicMeterWrap = document.getElementById('mic-meter-wrap');
const elMicMeterFill = document.getElementById('mic-meter-fill');

// Compare & A/B 3D Morph UI
const elComparePairs = document.getElementById('compare-pairs');
const elCompareDiff = document.getElementById('compare-diff');
const btnCompareMorph = document.getElementById('btn-compare-morph');

// Progress & Curriculum
const elProgressEncouragement = document.getElementById('progress-encouragement');
const elProgressLabel = document.getElementById('progress-label');
const elProgressFill = document.getElementById('progress-fill');
const btnOpenCurriculum = document.getElementById('btn-open-curriculum');

const elMobileChar = document.getElementById('mobile-char');
const elMobilePhonetic = document.getElementById('mobile-phonetic');
const elMobileMakhraj = document.getElementById('mobile-makhraj');
const btnMobilePlay = document.getElementById('btn-mobile-play');
const btnMobileDrawer = document.getElementById('btn-mobile-drawer');
const btnCloseDrawer = document.getElementById('btn-close-drawer');

const btnPlay = document.getElementById('btn-play');
const elPlayLabel = document.getElementById('btn-play-label');
const btnLoop = document.getElementById('btn-loop');
const btnSlowMo = document.getElementById('btn-slowmo');
const btnHeroPrev = document.getElementById('btn-hero-prev');
const btnHeroNext = document.getElementById('btn-hero-next');
const btnPrev = document.getElementById('btn-prev-letter');
const btnNext = document.getElementById('btn-next-letter');
const btnLetterGrid = document.getElementById('btn-letter-grid');
const btnTheme = document.getElementById('btn-theme');
const iconMoon = document.getElementById('icon-moon');
const iconSun = document.getElementById('icon-sun');
const elThemeLabel = document.getElementById('theme-label');
const btnFocus3D = document.getElementById('btn-focus-3d');
const btnShare = document.getElementById('btn-share');
const btnResetProgress = document.getElementById('btn-reset-progress');

// Studio Quick-Bar
const qbtnFocus = document.getElementById('qbtn-focus');
const qbtnSlice = document.getElementById('qbtn-slice');
const qbtnAirflow = document.getElementById('qbtn-airflow');
const qbtnLabels = document.getElementById('qbtn-labels');

const tabButtons = document.querySelectorAll('.panel-tabs button');
const viewLearn = document.getElementById('view-learn');
const viewControls = document.getElementById('view-controls');
const viewQuiz = document.getElementById('view-quiz');

// Quiz elements
const quizModeButtons = document.querySelectorAll('#quiz-mode-buttons button');
const quizScopeButtons = document.querySelectorAll('#quiz-scope-buttons button');
const elQuizQuestionCard = document.getElementById('quiz-question-card');
const elQuizSummaryCard = document.getElementById('quiz-summary-card');
const elQuizMystery = document.getElementById('quiz-mystery-glyph');
const elQuizPrompt = document.getElementById('quiz-prompt');
const elQuizOptions = document.getElementById('quiz-options');
const elQuizFeedback = document.getElementById('quiz-feedback');
const elQuizFeedbackTitle = document.getElementById('quiz-feedback-title');
const elQuizFeedbackBody = document.getElementById('quiz-feedback-body');
const btnQuizReplay = document.getElementById('btn-quiz-replay');
const btnQuizNext = document.getElementById('btn-quiz-next');
const elQRound = document.getElementById('q-stat-round');
const elQCorrect = document.getElementById('q-stat-correct');
const elQStreak = document.getElementById('q-stat-streak');
const elSummaryScore = document.getElementById('summary-score');
const elSummaryCaption = document.getElementById('summary-caption');
const elSummaryMissedWrap = document.getElementById('summary-missed-wrap');
const elSummaryMissedList = document.getElementById('summary-missed-list');
const btnQuizNewRound = document.getElementById('btn-quiz-new-round');

// Controls & Layer Dissection
const sliderCutaway = document.getElementById('slider-cutaway');
const valCutaway = document.getElementById('val-cutaway');
const sliderOpacity = document.getElementById('slider-opacity');
const valOpacity = document.getElementById('val-opacity');

const chkLayerLips = document.getElementById('chk-layer-lips');
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

// Modals
const gridModal = document.getElementById('grid-modal');
const gridBody = document.getElementById('makhraj-grid-body');
const gridSearchInput = document.getElementById('grid-search-input');
const btnCloseGrid = document.getElementById('btn-close-grid');

const curriculumModal = document.getElementById('curriculum-modal');
const elCurrMastered = document.getElementById('curr-mastered');
const elCurrLearned = document.getElementById('curr-learned');
const elCurrAccuracy = document.getElementById('curr-accuracy');
const elCurrMakhrajList = document.getElementById('curr-makhraj-list');
const btnCloseCurriculum = document.getElementById('btn-close-curriculum');
const btnCurrCloseBottom = document.getElementById('btn-curr-close-bottom');
const btnCurrPracticeWeak = document.getElementById('btn-curr-practice-weak');

const helpModal = document.getElementById('help-modal');
const btnHelpModal = document.getElementById('btn-help-modal');
const btnCloseHelp = document.getElementById('btn-close-help');
const btnHelpDone = document.getElementById('btn-help-done');

const infoModal = document.getElementById('info-modal');
const btnInfoModal = document.getElementById('btn-info-modal');
const btnCloseModal = document.getElementById('btn-close-modal');

// Initialize clickable 3D Organ Labels with Organ Explorer callback
const anatomicalLabels = new AnatomicalLabels(labelsLayer, headGroup, {
  onSelectOrgan: (organ) => openOrganExplorer(organ),
});

let toastTimer = null;
function showToast(msg) {
  elToast.textContent = msg;
  elToast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => elToast.classList.remove('show'), 2400);
}

// ============================================================================
// 4. Organ Explorer (Click Any 3D Organ Pin -> Jump to Its Letters!)
// ============================================================================
function openOrganExplorer(organ) {
  elOeTitle.textContent = organ.label;
  elOeSub.textContent = organ.sub;
  elOeRole.textContent = organ.role;
  elOeLetters.innerHTML = '';

  organ.letters.forEach((id) => {
    const l = getLetterById(id);
    const btn = document.createElement('button');
    btn.className = `oe-letter-btn ${l.id === state.activeLetter.id ? 'active' : ''}`;
    btn.innerHTML = `<span class="ar">${l.char}</span><span>${l.phonetic.split(' ')[0]}</span>`;
    btn.onclick = () => {
      if (state.activeTab === 'quiz') switchTab('learn');
      selectLetter(l, { playAudio: true });
      elOeLetters.querySelectorAll('.oe-letter-btn').forEach((b) =>
        b.classList.toggle('active', b === btn)
      );
    };
    elOeLetters.appendChild(btn);
  });

  elOrganExplorer.classList.remove('hidden');
}

function closeOrganExplorer() {
  elOrganExplorer.classList.add('hidden');
}

// ============================================================================
// 5. Dual Monochrome Studio Theme (Soft Light Default <-> Matte Dark Toggle)
// ============================================================================
function applyTheme(theme, persist = true) {
  const isLight = theme === 'light';
  state.theme = isLight ? 'light' : 'dark';
  document.documentElement.dataset.theme = state.theme;
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', isLight ? '#e8e8e2' : '#101010');
  }

  iconMoon.classList.toggle('hidden', !isLight);
  iconSun.classList.toggle('hidden', isLight);
  if (elThemeLabel) elThemeLabel.textContent = isLight ? 'Gelap' : 'Terang';

  sceneManager.setTheme(state.theme);
  outerHead.setTheme(state.theme);
  airflow.setTheme(state.theme);
  highlighter.setTheme(state.theme);

  if (persist) store.updatePref('theme', state.theme);
}

// ============================================================================
// 6. Practice Loop & Live A/B 3D Morph Comparison Controllers
// ============================================================================
function stopPracticeLoop() {
  state.loopPractice = false;
  btnLoop.classList.remove('active');
  clearTimeout(loopTimer);
  loopTimer = null;
}

function scheduleNextLoop() {
  clearTimeout(loopTimer);
  if (!state.loopPractice || state.activeTab === 'quiz') return;
  const delay = state.slowMotion ? 3400 : 2250;
  loopTimer = setTimeout(() => {
    if (!state.loopPractice || state.activeTab === 'quiz') return;
    triggerPronounce(state.activeLetter);
    scheduleNextLoop();
  }, delay);
}

function togglePracticeLoop() {
  if (state.loopPractice) {
    stopPracticeLoop();
    showToast('Mode ulang dimatikan');
  } else {
    stopCompareMorph();
    state.loopPractice = true;
    btnLoop.classList.add('active');
    triggerPronounce(state.activeLetter);
    scheduleNextLoop();
    showToast(`Mengulang huruf ${state.activeLetter.phonetic} secara berkala`);
  }
}

function stopCompareMorph() {
  state.compareMorphActive = false;
  clearInterval(compareMorphTimer);
  compareMorphTimer = null;
  compareMorphGroup = null;
  btnCompareMorph.classList.remove('active');
  btnCompareMorph.textContent = 'Animasi A ↔ B';
}

function toggleCompareMorph() {
  if (state.compareMorphActive) {
    stopCompareMorph();
    showToast('Animasi perbandingan dihentikan');
    return;
  }

  const group = CONFUSION_PAIRS.find((g) => g.letters.includes(state.activeLetter.id));
  if (!group) return;

  stopPracticeLoop();
  state.compareMorphActive = true;
  compareMorphGroup = group;
  compareMorphIdx = Math.max(0, group.letters.indexOf(state.activeLetter.id));
  btnCompareMorph.classList.add('active');
  btnCompareMorph.textContent = 'Hentikan A ↔ B';
  showToast(`Membandingkan gerakan 3D: ${group.label}`);

  const stepMorph = () => {
    if (!state.compareMorphActive || !compareMorphGroup) return;
    compareMorphIdx = (compareMorphIdx + 1) % compareMorphGroup.letters.length;
    const nextLetter = getLetterById(compareMorphGroup.letters[compareMorphIdx]);
    selectLetter(nextLetter, { playAudio: true, keepMorph: true });
  };

  compareMorphTimer = setInterval(stepMorph, state.slowMotion ? 3100 : 2200);
}

// ============================================================================
// 7. On-Device Voice Practice Recorder UI
// ============================================================================
function updateVoiceUI(letterId = state.activeLetter.id) {
  const hasRec = voiceRecorder.hasRecording(letterId);
  btnPlayMine.classList.toggle('hidden', !hasRec);
  btnAbAudio.classList.toggle('hidden', !hasRec);
  btnRecord.classList.toggle('recording', voiceRecorder.isRecording);
  elMicMeterWrap.classList.toggle('hidden', !voiceRecorder.isRecording);
  elRecordLabel.textContent = voiceRecorder.isRecording
    ? 'Berhenti Rekam'
    : hasRec
    ? 'Rekam Ulang'
    : 'Rekam Suaramu';
}

async function handleRecordToggle() {
  if (voiceRecorder.isRecording) {
    voiceRecorder.stop();
    updateVoiceUI();
    return;
  }

  stopPracticeLoop();
  stopCompareMorph();
  audioManager.stop();
  const targetId = state.activeLetter.id;

  const started = await voiceRecorder.start(targetId, {
    maxDurationMs: 4000,
    onComplete: (_url, finishedId) => {
      updateVoiceUI(state.activeLetter.id);
      if (finishedId === state.activeLetter.id) {
        showToast('Rekaman tersimpan. Klik "Bandingkan" untuk cek pelafalanmu!');
      }
    },
    onError: (msg) => {
      updateVoiceUI();
      showToast(msg);
    },
  });

  if (started) {
    updateVoiceUI(targetId);
  }
}

async function handlePlayMine() {
  const url = voiceRecorder.getRecordingUrl(state.activeLetter.id);
  if (!url) return;
  stopPracticeLoop();
  stopCompareMorph();
  btnPlayMine.classList.add('playing');
  await audioManager.playRecordingUrl(url, {
    onEnd: () => btnPlayMine.classList.remove('playing'),
  });
}

async function handleCompareAudioAB() {
  const url = voiceRecorder.getRecordingUrl(state.activeLetter.id);
  if (!url) return;
  stopPracticeLoop();
  stopCompareMorph();

  btnAbAudio.classList.add('playing');
  showToast('1. Contoh pelafalan → 2. Suaramu');
  controller.triggerPronunciation();
  await audioManager.playLetter(state.activeLetter, { slowMotion: state.slowMotion });
  await new Promise((r) => setTimeout(r, 320));
  await audioManager.playRecordingUrl(url, {
    onEnd: () => btnAbAudio.classList.remove('playing'),
  });
  btnAbAudio.classList.remove('playing');
}

// ============================================================================
// 8. Mastery, Progress, Curriculum Modal, Filters & Searchable Peta 29
// ============================================================================
function updateMasteryPillUI() {
  const mastered = store.isMastered(state.activeLetter.id);
  btnMarkMastered.classList.toggle('mastered', mastered);
  elMasteryLabel.textContent = mastered ? 'Sudah Paham' : 'Tandai Paham';
}

function updateProgressUI() {
  const masteredCount = store.getMasteredCount();
  const learnedCount = store.getLearnedCount();
  const total = HIJAIYAH_LETTERS.length;
  elProgressLabel.textContent = `${masteredCount} / ${total} dikuasai`;
  elProgressFill.style.width = `${Math.round((masteredCount / total) * 100)}%`;

  if (masteredCount === 0 && learnedCount === 0) {
    elProgressEncouragement.textContent = 'Progres Belajar — Yuk mulai!';
  } else if (masteredCount < 10) {
    elProgressEncouragement.textContent = `${learnedCount} huruf dilatih · terus semangat!`;
  } else if (masteredCount < 20) {
    elProgressEncouragement.textContent = 'Sudah makin mantap!';
  } else if (masteredCount < total) {
    elProgressEncouragement.textContent = 'Tinggal sedikit lagi dikuasai semua!';
  } else {
    elProgressEncouragement.textContent = 'MasyaAllah, semua 29 huruf dikuasai!';
  }

  elStrip.querySelectorAll('.letter-tile').forEach((tile) => {
    tile.classList.toggle('learned', store.isLearned(tile.dataset.id));
    tile.classList.toggle('mastered', store.isMastered(tile.dataset.id));
  });
  updateMasteryPillUI();
}

function openCurriculumModal() {
  const masteredCount = store.getMasteredCount();
  const learnedCount = store.getLearnedCount();
  const qStats = store.getQuizStats();
  const acc = qStats.total > 0 ? Math.round((qStats.correct / qStats.total) * 100) : 0;

  elCurrMastered.textContent = `${masteredCount} / ${HIJAIYAH_LETTERS.length}`;
  elCurrLearned.textContent = `${learnedCount} / ${HIJAIYAH_LETTERS.length}`;
  elCurrAccuracy.textContent = qStats.total > 0 ? `${acc}%` : '—';

  elCurrMakhrajList.innerHTML = '';
  Object.values(MAKHRAJ_CATEGORIES).forEach((cat) => {
    const letters = HIJAIYAH_LETTERS.filter(
      (l) => l.makhraj === cat.id || l.secondaryMakhraj === cat.id
    );
    const done = letters.filter((l) => store.isMastered(l.id)).length;
    const pct = Math.round((done / letters.length) * 100);

    const row = document.createElement('div');
    row.className = 'curr-row';
    row.innerHTML = `
      <div class="curr-row-head">
        <strong>${cat.friendlyName} (${cat.name})</strong>
        <small>${done} / ${letters.length} dikuasai</small>
      </div>
      <div class="progress-track">
        <div class="progress-fill" style="width:${pct}%"></div>
      </div>
    `;
    elCurrMakhrajList.appendChild(row);
  });

  curriculumModal.classList.remove('hidden');
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
    btn.textContent = cat.friendlyName || cat.name;
    btn.title = `${cat.friendlyName} (${cat.name} · ${cat.arabic}) — ${cat.subtitle}`;
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
    btn.title = `${letter.phonetic} (${letter.char}) — ${cat.friendlyName} (${cat.name})`;
    btn.innerHTML = `
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

function renderMakhrajGridModal(query = '') {
  gridBody.innerHTML = '';
  const q = query.trim().toLowerCase();
  let totalMatches = 0;

  Object.values(MAKHRAJ_CATEGORIES).forEach((cat) => {
    const letters = HIJAIYAH_LETTERS.filter((l) => {
      const inCat = l.makhraj === cat.id || l.secondaryMakhraj === cat.id;
      if (!inCat) return false;
      if (!q) return true;
      return (
        l.phonetic.toLowerCase().includes(q) ||
        l.id.toLowerCase().includes(q) ||
        l.char.includes(q) ||
        cat.name.toLowerCase().includes(q) ||
        (cat.friendlyName || '').toLowerCase().includes(q)
      );
    });
    if (letters.length === 0) return;
    totalMatches += letters.length;

    const group = document.createElement('section');
    group.className = 'grid-group';
    group.innerHTML = `
      <div class="grid-group-head">
        <div class="grid-group-title">
          <strong>${cat.friendlyName || cat.name}</strong>
          <span class="ar-sub">${cat.name} (${cat.arabic})</span>
        </div>
        <small>${letters.length} huruf</small>
      </div>
    `;
    const tiles = document.createElement('div');
    tiles.className = 'grid-tiles';
    letters.forEach((letter) => {
      const btn = document.createElement('button');
      btn.className = 'grid-tile';
      if (letter.id === state.activeLetter.id) btn.classList.add('active');
      if (store.isMastered(letter.id)) btn.classList.add('learned');
      btn.innerHTML = `
        <span class="gt-ar">${letter.char}</span>
        <span class="gt-latin">${letter.phonetic.split(' ')[0]}</span>
      `;
      btn.title = `${letter.phonetic} — ${letter.subMakhraj}`;
      btn.onclick = () => {
        gridModal.classList.add('hidden');
        if (state.activeTab === 'quiz') switchTab('learn');
        selectLetter(letter, { playAudio: true });
      };
      tiles.appendChild(btn);
    });
    group.appendChild(tiles);
    gridBody.appendChild(group);
  });

  if (totalMatches === 0) {
    const empty = document.createElement('div');
    empty.className = 'grid-empty';
    empty.textContent = `Tidak ditemukan huruf yang cocok dengan "${query}". Coba ketik "Dhad", "Qaf", atau "Sin".`;
    gridBody.appendChild(empty);
  }
}

function openMakhrajGridModal() {
  gridSearchInput.value = '';
  renderMakhrajGridModal('');
  gridModal.classList.remove('hidden');
  setTimeout(() => gridSearchInput.focus(), 60);
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
    tile.classList.toggle('mastered', store.isMastered(letter.id));
  });
}

function renderCompareButtons(activeLetter) {
  elComparePairs.innerHTML = '';
  const matchingGroup = CONFUSION_PAIRS.find((g) => g.letters.includes(activeLetter.id));

  if (matchingGroup) {
    btnCompareMorph.classList.remove('hidden');
    elCompareDiff.textContent = matchingGroup.diffNote || matchingGroup.desc;
    elCompareDiff.classList.remove('hidden');

    matchingGroup.letters.forEach((id) => {
      const l = getLetterById(id);
      const btn = document.createElement('button');
      btn.className = `compare-btn ${l.id === activeLetter.id ? 'active' : ''}`;
      btn.innerHTML = `<span class="ar">${l.char}</span> <span>${l.phonetic.split(' ')[0]}</span>`;
      btn.onclick = () => selectLetter(l, { playAudio: true });
      elComparePairs.appendChild(btn);
    });
  } else {
    btnCompareMorph.classList.add('hidden');
    elCompareDiff.classList.add('hidden');

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
// 9. Core Letter Selection, Tahsin Drills & Pronunciation
// ============================================================================
function updateCutawayUI(xVal, persist = true) {
  state.clipX = xVal;
  sliderCutaway.value = xVal;
  outerHead.setClipX(xVal);
  const enableInternalCut =
    (state.viewMode === 'xray-cut' || state.viewMode === 'solid-cut') && xVal < 0.75;
  vocalTract.setCutaway(enableInternalCut, xVal);
  sceneManager.requestShadowUpdate(true);

  const isSagittal = xVal <= 0.14;
  if (isSagittal) valCutaway.textContent = 'Terbuka (Tengah)';
  else if (xVal >= 1.1) valCutaway.textContent = 'Tertutup Utuh';
  else valCutaway.textContent = `${Math.round(((xVal + 0.35) / 1.8) * 100)}%`;

  qbtnSlice.classList.toggle('active', isSagittal);
  qbtnSlice.textContent = isSagittal ? 'Belah Samping' : 'Kepala Utuh';

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
  airflow.setConfig(letter.airflow, letter.id);
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

const DRILL_LABELS = ['Fathah', 'Kasrah', 'Dhammah', 'Sukun'];
const ALIF_DRILL_LABELS = ['Mad 1', 'Mad 2', 'Mad 3', 'Mad 4'];

function selectLetter(letter, { playAudio = false, updateUrl = true, keepMorph = false } = {}) {
  stopPracticeLoop();
  if (!keepMorph) stopCompareMorph();
  if (voiceRecorder.isRecording) voiceRecorder.stop();

  state.activeLetter = letter;
  const cat = MAKHRAJ_CATEGORIES[letter.makhraj];

  applyLetterTo3D(letter, { triggerPulse: playAudio, concealLabels: false });
  if (updateUrl) syncUrlDeepLink(letter.id);

  elChar.textContent = letter.char;
  elPhonetic.textContent = letter.phonetic;
  elActiveIndex.textContent = `${letter.order} / ${HIJAIYAH_LETTERS.length}`;
  elBadge.textContent = letter.secondaryMakhraj
    ? `${cat.friendlyName} + Rongga Hidung`
    : `${cat.friendlyName} · ${cat.name}`;

  const pair = letter.organPair || ['Organ Aktif', letter.subMakhraj];
  elOrganMover.textContent = pair[0];
  elOrganTarget.textContent = pair[1];

  elHowTo.textContent = letter.howTo;
  elMistake.textContent = letter.mistakeWarning;

  // Render Tahsin Harakat Drills + Quranic Word Example
  const drills = letter.drills || [];
  const labels = letter.id === 'alif' ? ALIF_DRILL_LABELS : DRILL_LABELS;
  elDrillChips.innerHTML = '';
  drills.forEach((d, idx) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'drill-chip';
    chip.title = `Latih bacaan ${labels[idx] || ''}: ${d}`;
    chip.innerHTML = `<span class="dc-ar">${d}</span><span class="dc-lbl">${labels[idx] || ''}</span>`;
    chip.onclick = () => triggerPronounce(letter);
    elDrillChips.appendChild(chip);
  });

  if (letter.quranExample) {
    elQuranArabic.textContent = letter.quranExample.arabic;
    elQuranLatin.textContent = letter.quranExample.latin;
    elQuranSurah.textContent = letter.quranExample.surah;
  }

  elMobileChar.textContent = letter.char;
  elMobilePhonetic.textContent = letter.phonetic;
  elMobileMakhraj.textContent = `${cat.friendlyName} · ${cat.name}`;

  // Interactive plain-language Sifatul Huruf chips
  elSifat.innerHTML = '';
  elSifatDef.classList.add('hidden');
  elSifatDef.innerHTML = '';
  elSifatHint.classList.remove('hidden');

  letter.sifat.forEach((s) => {
    const explanation = getSifatExplanation(s);
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'sifat-chip';
    chip.textContent = s;
    chip.title = `${s}: ${explanation}`;
    chip.onclick = () => {
      const wasActive = chip.classList.contains('active');
      elSifat.querySelectorAll('.sifat-chip').forEach((c) => c.classList.remove('active'));
      if (wasActive) {
        elSifatDef.classList.add('hidden');
        elSifatHint.classList.remove('hidden');
      } else {
        chip.classList.add('active');
        elSifatHint.classList.add('hidden');
        elSifatDef.innerHTML = `<strong>${s}:</strong> ${explanation}`;
        elSifatDef.classList.remove('hidden');
      }
    };
    elSifat.appendChild(chip);
  });

  updateMasteryPillUI();
  updateVoiceUI(letter.id);
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

function setPlayingUI(isPlaying) {
  btnPlay.classList.toggle('playing', isPlaying);
  elPlayLabel.textContent = isPlaying ? 'Memutar...' : 'Dengarkan';
}

function triggerPronounce(letter = state.activeLetter) {
  controller.triggerPronunciation();
  setPlayingUI(true);
  if (state.activeTab !== 'quiz') {
    store.markLearned(letter.id);
    updateProgressUI();
  }
  audioManager.playLetter(letter, {
    slowMotion: state.slowMotion,
    onEnd: () => setPlayingUI(false),
  });
}

// ============================================================================
// 10. Structured Adaptive Quiz Engine (10-Question Rounds + Summary)
// ============================================================================
function updateQuizStatsUI() {
  const stats = store.getQuizStats();
  const displayIdx = Math.min(quizManager.roundSize, quizManager.roundIndex + 1);
  elQRound.textContent = `${displayIdx} / ${quizManager.roundSize}`;
  elQCorrect.textContent = stats.correct;
  elQStreak.textContent = stats.streak;
}

function showQuizRoundSummary() {
  const summary = quizManager.getRoundSummary();
  elQuizQuestionCard.classList.add('hidden');
  elQuizSummaryCard.classList.remove('hidden');

  elSummaryScore.textContent = `${summary.correct} / ${summary.total}`;
  if (summary.accuracy >= 90) {
    elSummaryCaption.textContent = `Akurasi ${summary.accuracy}% — Luar biasa! Pelafalanmu sangat mantap.`;
  } else if (summary.accuracy >= 70) {
    elSummaryCaption.textContent = `Akurasi ${summary.accuracy}% — Bagus sekali, terus latih huruf yang mirip!`;
  } else {
    elSummaryCaption.textContent = `Akurasi ${summary.accuracy}% — Tidak apa-apa, yuk ulangi huruf di bawah dalam 3D!`;
  }

  if (summary.missedLetters.length > 0) {
    elSummaryMissedWrap.classList.remove('hidden');
    elSummaryMissedList.innerHTML = '';
    summary.missedLetters.forEach((l) => {
      const btn = document.createElement('button');
      btn.className = 'compare-btn';
      btn.innerHTML = `<span class="ar">${l.char}</span> <span>${l.phonetic.split(' ')[0]}</span>`;
      btn.onclick = () => {
        switchTab('learn');
        selectLetter(l, { playAudio: true });
      };
      elSummaryMissedList.appendChild(btn);
    });
  } else {
    elSummaryMissedWrap.classList.add('hidden');
  }
}

function loadNextQuizQuestion(playSound = true) {
  stopPracticeLoop();
  stopCompareMorph();

  if (quizManager.isRoundComplete()) {
    showQuizRoundSummary();
    return;
  }

  elQuizSummaryCard.classList.add('hidden');
  elQuizQuestionCard.classList.remove('hidden');

  const q = quizManager.nextQuestion(store.masteredSet);
  state.activeLetter = q.letter;
  updateQuizStatsUI();

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
  elMobilePhonetic.textContent = q.mode === 'letter' ? 'Tebak Huruf 3D' : q.letter.phonetic;
  elMobileMakhraj.textContent = 'Latihan Kuis';

  updateDockFilter();

  if (playSound) {
    audioManager.playLetter(q.letter, { slowMotion: state.slowMotion });
  }
}

function handleQuizAnswer(selectedValue) {
  const res = quizManager.submitAnswer(selectedValue);
  if (!res) return;

  const { isCorrect, question, roundComplete } = res;
  const letter = question.letter;
  const cat = MAKHRAJ_CATEGORIES[letter.makhraj];

  store.recordQuizResult(isCorrect);
  if (isCorrect) store.markMastered(letter.id);
  else store.markLearned(letter.id);

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
    ? `Tepat sekali — ${letter.phonetic} (${letter.char}) dari ${cat.friendlyName}`
    : `Hampir tepat! Jawabannya ${letter.phonetic} (${letter.char}) dari ${cat.friendlyName}`;
  elQuizFeedbackBody.textContent = `${letter.howTo}`;
  elQuizFeedback.classList.remove('hidden');

  btnQuizNext.textContent = roundComplete
    ? 'Lihat Ringkasan Sesi'
    : 'Lanjut ke Soal Berikutnya';
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
    stopPracticeLoop();
    stopCompareMorph();
    closeOrganExplorer();
    quizManager.resetRound();
    updateQuizStatsUI();
    loadNextQuizQuestion(true);
  } else if (prevTab === 'quiz') {
    selectLetter(state.activeLetter, { playAudio: false });
  }
}

// ============================================================================
// 11. Wire Up All Controls, Voice Practice, Curriculum & Shortcuts
// ============================================================================
tabButtons.forEach((btn) => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

btnCloseOe.addEventListener('click', closeOrganExplorer);

// Tap 3D canvas to close open mobile bottom sheet or organ explorer smoothly
container.addEventListener('pointerdown', () => {
  if (document.body.classList.contains('mobile-sheet-open')) {
    document.body.classList.remove('mobile-sheet-open');
    btnMobileDrawer.setAttribute('aria-expanded', 'false');
  }
});

btnDismissWelcome.addEventListener('click', () => {
  elWelcomeStrip.classList.add('hidden');
  store.updatePref('welcomeDismissed', true);
});

btnStartAlif.addEventListener('click', () => {
  elWelcomeStrip.classList.add('hidden');
  store.updatePref('welcomeDismissed', true);
  selectLetter(getLetterById('alif'), { playAudio: true });
});

btnMarkMastered.addEventListener('click', () => {
  const nowMastered = store.toggleMastered(state.activeLetter.id);
  updateProgressUI();
  showToast(
    nowMastered
      ? `Huruf ${state.activeLetter.phonetic} (${state.activeLetter.char}) ditandai sudah dikuasai`
      : `Tanda dikuasai pada ${state.activeLetter.phonetic} dibatalkan`
  );
});

btnCompareMorph.addEventListener('click', toggleCompareMorph);
btnRecord.addEventListener('click', handleRecordToggle);
btnPlayMine.addEventListener('click', handlePlayMine);
btnAbAudio.addEventListener('click', handleCompareAudioAB);

btnOpenCurriculum.addEventListener('click', openCurriculumModal);
btnCloseCurriculum.addEventListener('click', () => curriculumModal.classList.add('hidden'));
btnCurrCloseBottom.addEventListener('click', () => curriculumModal.classList.add('hidden'));
curriculumModal.addEventListener('click', (e) => {
  if (e.target === curriculumModal) curriculumModal.classList.add('hidden');
});
btnCurrPracticeWeak.addEventListener('click', () => {
  curriculumModal.classList.add('hidden');
  quizScopeButtons.forEach((b) =>
    b.classList.toggle('active', b.dataset.qscope === 'unmastered')
  );
  quizManager.setScope('unmastered');
  switchTab('quiz');
});

btnTheme.addEventListener('click', () => {
  const next = state.theme === 'light' ? 'dark' : 'light';
  applyTheme(next, true);
  showToast(next === 'light' ? 'Beralih ke Mode Terang' : 'Beralih ke Mode Gelap');
});

quizModeButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    quizModeButtons.forEach((b) => b.classList.toggle('active', b === btn));
    quizManager.setMode(btn.dataset.qmode);
    loadNextQuizQuestion(true);
  });
});

quizScopeButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    quizScopeButtons.forEach((b) => b.classList.toggle('active', b === btn));
    quizManager.setScope(btn.dataset.qscope);
    loadNextQuizQuestion(true);
  });
});

btnQuizReplay.addEventListener('click', () => {
  if (!quizManager.currentQuestion) return;
  controller.triggerPronunciation();
  audioManager.playLetter(quizManager.currentQuestion.letter, { slowMotion: state.slowMotion });
});

btnQuizNext.addEventListener('click', () => loadNextQuizQuestion(true));
btnQuizNewRound.addEventListener('click', () => {
  quizManager.resetRound();
  loadNextQuizQuestion(true);
});

btnPlay.addEventListener('click', () => triggerPronounce());
btnLoop.addEventListener('click', () => togglePracticeLoop());

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
  if (state.loopPractice) scheduleNextLoop();
  showToast(state.slowMotion ? 'Mode lambat 0.5x aktif' : 'Kecepatan kembali normal');
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
btnHeroPrev.addEventListener('click', () => stepLetter(-1));
btnHeroNext.addEventListener('click', () => stepLetter(1));

btnLetterGrid.addEventListener('click', openMakhrajGridModal);
btnCloseGrid.addEventListener('click', () => gridModal.classList.add('hidden'));
gridModal.addEventListener('click', (e) => {
  if (e.target === gridModal) gridModal.classList.add('hidden');
});
gridSearchInput.addEventListener('input', (e) => {
  renderMakhrajGridModal(e.target.value);
});

btnHelpModal.addEventListener('click', () => helpModal.classList.remove('hidden'));
btnCloseHelp.addEventListener('click', () => helpModal.classList.add('hidden'));
btnHelpDone.addEventListener('click', () => helpModal.classList.add('hidden'));
helpModal.addEventListener('click', (e) => {
  if (e.target === helpModal) helpModal.classList.add('hidden');
});

function applyViewMode(mode, persist = true) {
  state.viewMode = mode;
  viewModeButtons.forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
  outerHead.setViewMode(mode);

  const internalCut = (mode === 'xray-cut' || mode === 'solid-cut') && state.clipX < 0.75;
  vocalTract.setCutaway(internalCut, state.clipX);
  if (persist) store.updatePref('viewMode', mode);
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
  if (!visible) closeOrganExplorer();
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

chkLayerLips.addEventListener('change', (e) => {
  lips.setVisible(e.target.checked);
  sceneManager.requestShadowUpdate(true);
  store.updatePref('layerLips', e.target.checked);
});
chkLayerJaw.addEventListener('change', (e) => {
  vocalTract.setLayerVisible('jaw', e.target.checked);
  sceneManager.requestShadowUpdate(true);
  store.updatePref('layerJaw', e.target.checked);
});
chkLayerPharynx.addEventListener('change', (e) => {
  vocalTract.setLayerVisible('pharynx', e.target.checked);
  sceneManager.requestShadowUpdate(true);
  store.updatePref('layerPharynx', e.target.checked);
});
chkLayerNasal.addEventListener('change', (e) => {
  vocalTract.setLayerVisible('nasal', e.target.checked);
  store.updatePref('layerNasal', e.target.checked);
});
chkLayerTongue.addEventListener('change', (e) => {
  tongue.setVisible(e.target.checked);
  sceneManager.requestShadowUpdate(true);
  store.updatePref('layerTongue', e.target.checked);
});

qbtnFocus.addEventListener('click', () => {
  const preset = state.activeLetter?.cameraPreset || 'side';
  setActiveCamPreset(preset);
  showToast(`Kamera diarahkan ke titik huruf ${state.activeLetter.phonetic}`);
});
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
  if (e.target.tagName === 'INPUT') {
    if (e.key === 'Escape') gridModal.classList.add('hidden');
    return;
  }
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
  } else if (e.key === 'g' || e.key === 'G') {
    if (gridModal.classList.contains('hidden')) openMakhrajGridModal();
    else gridModal.classList.add('hidden');
  } else if (e.key === 'r' || e.key === 'R') {
    if (state.activeTab === 'learn') handleRecordToggle();
  } else if (e.key === 'f' || e.key === 'F') {
    const preset = state.activeLetter?.cameraPreset || 'side';
    setActiveCamPreset(preset);
  } else if (e.key === 't' || e.key === 'T') {
    const next = state.theme === 'light' ? 'dark' : 'light';
    applyTheme(next, true);
  } else if (e.key === 'Escape') {
    stopPracticeLoop();
    stopCompareMorph();
    if (voiceRecorder.isRecording) voiceRecorder.stop();
    closeOrganExplorer();
    gridModal.classList.add('hidden');
    curriculumModal.classList.add('hidden');
    helpModal.classList.add('hidden');
    infoModal.classList.add('hidden');
    document.body.classList.remove('focus-3d');
    document.body.classList.remove('mobile-sheet-open');
  }
});

// ============================================================================
// 12. Restore Saved Preferences, Boot & Render Loop
// ============================================================================
function restoreSavedPreferences() {
  applyTheme(state.theme, false);
  if (savedPrefs.welcomeDismissed) {
    elWelcomeStrip.classList.add('hidden');
  }

  sliderOpacity.value = savedPrefs.opacity;
  valOpacity.textContent = `${Math.round(savedPrefs.opacity * 100)}%`;
  outerHead.setOpacity(savedPrefs.opacity);

  chkLayerLips.checked = savedPrefs.layerLips !== false;
  lips.setVisible(chkLayerLips.checked);
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
  if (document.hidden) return;
  const dt = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.getElapsedTime();

  const audioLevel = audioManager.getAudioLevel();
  const pose = controller.update(dt);
  const releaseFactor = controller.getReleaseFactor();

  if (voiceRecorder.isRecording) {
    const micLvl = voiceRecorder.getInputLevel();
    elMicMeterFill.style.width = `${Math.max(8, Math.round(micLvl * 100))}%`;
  }

  const tongueMoved = tongue.updatePose(pose, elapsed, audioLevel);
  const lipsMoved = lips.updatePose(pose, elapsed, audioLevel);
  const tractMoved = vocalTract.updatePose(pose, state.activeLetter, elapsed, audioLevel, releaseFactor);
  if (tongueMoved || lipsMoved || tractMoved) {
    sceneManager.requestShadowUpdate();
  }

  outerHead.applyPose(pose, audioLevel);
  outerHead.update(elapsed);
  highlighter.update(dt, elapsed, sceneManager.camera, audioLevel);
  airflow.update(dt, elapsed, controller.getSpeedMultiplier(), audioLevel, releaseFactor);
  sceneManager.update(dt);
  anatomicalLabels.update(sceneManager.camera, sceneManager.renderer);

  sceneManager.render();
}

animate();
