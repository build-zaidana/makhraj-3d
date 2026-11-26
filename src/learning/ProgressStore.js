/**
 * ProgressStore — Safe localStorage persistence for learned & mastered letters,
 * quiz accuracy/streaks, and persistent user preferences.
 */

const STORAGE_KEY = 'makhraj3d_user_state_v1';

const DEFAULT_DATA = {
  learnedIds: [],
  masteredIds: [],
  quiz: {
    correct: 0,
    total: 0,
    streak: 0,
    bestStreak: 0,
  },
  prefs: {
    theme: 'light',
    welcomeDismissed: false,
    viewMode: 'xray-cut',
    clipX: 0.04,
    opacity: 0.72,
    showAirflow: true,
    showLabels: true,
    autoCamera: false,
    bloom: true,
    simpleHead: false,
    layerJaw: true,
    layerPharynx: true,
    layerNasal: true,
    layerTongue: true,
  },
};

export class ProgressStore {
  constructor() {
    this.data = this._load();
    this.learnedSet = new Set(this.data.learnedIds || []);
    this.masteredSet = new Set(this.data.masteredIds || []);
  }

  _load() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return structuredClone(DEFAULT_DATA);
      const parsed = JSON.parse(raw);
      return {
        learnedIds: Array.isArray(parsed.learnedIds) ? parsed.learnedIds : [],
        masteredIds: Array.isArray(parsed.masteredIds) ? parsed.masteredIds : [],
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
      this.data.masteredIds = Array.from(this.masteredSet);
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
    return this.learnedSet.has(letterId) || this.masteredSet.has(letterId);
  }

  getLearnedCount() {
    const union = new Set([...this.learnedSet, ...this.masteredSet]);
    return union.size;
  }

  markMastered(letterId) {
    if (!letterId) return false;
    this.learnedSet.add(letterId);
    if (this.masteredSet.has(letterId)) return false;
    this.masteredSet.add(letterId);
    this._save();
    return true;
  }

  toggleMastered(letterId) {
    if (!letterId) return false;
    if (this.masteredSet.has(letterId)) {
      this.masteredSet.delete(letterId);
      this._save();
      return false;
    }
    this.learnedSet.add(letterId);
    this.masteredSet.add(letterId);
    this._save();
    return true;
  }

  isMastered(letterId) {
    return this.masteredSet.has(letterId);
  }

  getMasteredCount() {
    return this.masteredSet.size;
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
    this.masteredSet.clear();
    this.data.quiz = { ...DEFAULT_DATA.quiz };
    this._save();
  }
}
