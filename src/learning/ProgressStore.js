/**
 * ProgressStore — Safe localStorage persistence for learned letters, quiz stats, and view preferences.
 */

const STORAGE_KEY = 'makhraj3d_user_state_v1';

const DEFAULT_DATA = {
  learnedIds: [],
  quiz: {
    correct: 0,
    total: 0,
    streak: 0,
    bestStreak: 0,
  },
  prefs: {
    viewMode: 'xray-cut',
    clipX: 0.04,
    opacity: 0.78,
    showAirflow: true,
    showLabels: true,
    autoCamera: false,
    bloom: true,
    simpleHead: false,
  },
};

export class ProgressStore {
  constructor() {
    this.data = this._load();
    this.learnedSet = new Set(this.data.learnedIds || []);
  }

  _load() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return structuredClone(DEFAULT_DATA);
      const parsed = JSON.parse(raw);
      return {
        learnedIds: Array.isArray(parsed.learnedIds) ? parsed.learnedIds : [],
        quiz: { ...DEFAULT_DATA.quiz, ...(parsed.quiz || {}) },
        prefs: { ...DEFAULT_DATA.prefs, ...(parsed.prefs || {}) },
      };
    } catch {
      return structuredClone(DEFAULT_DATA);
    }
  }

  _save() {
    try {
      this.data.learnedIds = Array.from(this.learnedSet);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      // Ignore storage quota or private-mode restrictions
    }
  }

  markLearned(letterId) {
    if (!letterId || this.learnedSet.has(letterId)) return false;
    this.learnedSet.add(letterId);
    this._save();
    return true;
  }

  isLearned(letterId) {
    return this.learnedSet.has(letterId);
  }

  getLearnedCount() {
    return this.learnedSet.size;
  }

  recordQuizResult(isCorrect) {
    this.data.quiz.total += 1;
    if (isCorrect) {
      this.data.quiz.correct += 1;
      this.data.quiz.streak += 1;
      if (this.data.quiz.streak > this.data.quiz.bestStreak) {
        this.data.quiz.bestStreak = this.data.quiz.streak;
      }
    } else {
      this.data.quiz.streak = 0;
    }
    this._save();
    return { ...this.data.quiz };
  }

  getQuizStats() {
    return { ...this.data.quiz };
  }

  getPrefs() {
    return { ...this.data.prefs };
  }

  updatePref(key, value) {
    this.data.prefs[key] = value;
    this._save();
  }

  resetProgress() {
    this.learnedSet.clear();
    this.data.quiz = { ...DEFAULT_DATA.quiz };
    this._save();
  }
}
