import {
  HIJAIYAH_LETTERS,
  MAKHRAJ_CATEGORIES,
  CONFUSION_PAIRS,
  getLetterById,
} from '../data/hijaiyahData.js';

/**
 * QuizManager — Adaptive Tajwid & Makharijul Huruf Practice Engine
 *
 * Modes:
 *  - 'letter'  : Animates the 3D vocal tract + plays audio while hiding the letter
 *  - 'makhraj' : Shows the letter + animates 3D + asks which organ/makhraj produces it
 *
 * Scopes:
 *  - 'all'        : All 29 Hijaiyah letters
 *  - 'confusing'  : Curated commonly confused letters (ح/ه/خ, ت/ط/د, س/ص/ث, د/ض, ذ/ز/ظ, ق/ك, ع/ء, ب/ف/م)
 *  - 'unmastered' : Smart adaptive focus on letters the learner has not mastered yet
 */

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const CONFUSING_ID_SET = new Set(CONFUSION_PAIRS.flatMap((p) => p.letters));

export class QuizManager {
  constructor() {
    this.mode = 'letter'; // 'letter' | 'makhraj'
    this.scope = 'all';   // 'all' | 'confusing' | 'unmastered'
    this.currentQuestion = null;
    this.lastLetterId = null;

    // 10-question structured practice session tracking
    this.roundSize = 10;
    this.roundIndex = 0;
    this.roundCorrect = 0;
    this.roundMissed = [];
  }

  setMode(mode) {
    this.mode = mode === 'makhraj' ? 'makhraj' : 'letter';
    this.resetRound();
  }

  setScope(scope) {
    this.scope = ['all', 'confusing', 'unmastered'].includes(scope) ? scope : 'all';
    this.resetRound();
  }

  resetRound() {
    this.roundIndex = 0;
    this.roundCorrect = 0;
    this.roundMissed = [];
  }

  isRoundComplete() {
    return this.roundIndex >= this.roundSize;
  }

  getRoundSummary() {
    const uniqueMissed = Array.from(new Set(this.roundMissed)).map((id) => getLetterById(id));
    return {
      total: this.roundSize,
      correct: this.roundCorrect,
      accuracy: Math.round((this.roundCorrect / this.roundSize) * 100),
      missedLetters: uniqueMissed,
    };
  }

  nextQuestion(masteredSet = null) {
    let candidates = HIJAIYAH_LETTERS;
    if (this.scope === 'confusing') {
      candidates = HIJAIYAH_LETTERS.filter((l) => CONFUSING_ID_SET.has(l.id));
    } else if (this.scope === 'unmastered' && masteredSet) {
      const unmastered = HIJAIYAH_LETTERS.filter((l) => !masteredSet.has(l.id));
      if (unmastered.length > 0) candidates = unmastered;
    }

    const pool =
      candidates.length > 1
        ? candidates.filter((l) => l.id !== this.lastLetterId)
        : candidates;
    const letter = pool[Math.floor(Math.random() * pool.length)];
    this.lastLetterId = letter.id;

    if (this.mode === 'makhraj') {
      const correctCat = MAKHRAJ_CATEGORIES[letter.makhraj];
      const allCats = Object.values(MAKHRAJ_CATEGORIES);
      const distractors = shuffle(
        allCats.filter((c) => c.id !== correctCat.id && c.id !== letter.secondaryMakhraj)
      ).slice(0, 3);

      const options = shuffle([correctCat, ...distractors]).map((cat) => ({
        value: cat.id,
        label: cat.friendlyName || cat.name,
        sub: `${cat.name} (${cat.arabic})`,
        isArabic: false,
      }));

      this.currentQuestion = {
        mode: 'makhraj',
        letter,
        prompt: `Dari bagian mana suara huruf ${letter.phonetic} (${letter.char}) keluar?`,
        correctValue: correctCat.id,
        options,
        answered: false,
        selectedValue: null,
      };
      return this.currentQuestion;
    }

    // Mode 'letter': smart confusing distractors
    const distractorIds = new Set();
    const pairGroup = CONFUSION_PAIRS.find((g) => g.letters.includes(letter.id));
    if (pairGroup) {
      pairGroup.letters.forEach((id) => {
        if (id !== letter.id) distractorIds.add(id);
      });
    }
    const sameMakhraj = shuffle(
      HIJAIYAH_LETTERS.filter((l) => l.id !== letter.id && l.makhraj === letter.makhraj)
    );
    for (const candidate of sameMakhraj) {
      if (distractorIds.size >= 3) break;
      distractorIds.add(candidate.id);
    }
    const others = shuffle(HIJAIYAH_LETTERS.filter((l) => l.id !== letter.id));
    for (const candidate of others) {
      if (distractorIds.size >= 3) break;
      distractorIds.add(candidate.id);
    }

    const distractorLetters = Array.from(distractorIds)
      .slice(0, 3)
      .map((id) => getLetterById(id));

    const options = shuffle([letter, ...distractorLetters]).map((l) => ({
      value: l.id,
      label: l.char,
      sub: l.phonetic.split(' ')[0],
      isArabic: true,
    }));

    this.currentQuestion = {
      mode: 'letter',
      letter,
      prompt: 'Amati posisi lidah, aliran udara, dan dengarkan suaranya. Huruf apakah ini?',
      correctValue: letter.id,
      options,
      answered: false,
      selectedValue: null,
    };
    return this.currentQuestion;
  }

  submitAnswer(value) {
    if (!this.currentQuestion || this.currentQuestion.answered) return null;
    this.currentQuestion.answered = true;
    this.currentQuestion.selectedValue = value;
    const isCorrect = value === this.currentQuestion.correctValue;
    this.roundIndex += 1;
    if (isCorrect) {
      this.roundCorrect += 1;
    } else {
      this.roundMissed.push(this.currentQuestion.letter.id);
    }
    return {
      isCorrect,
      question: this.currentQuestion,
      roundComplete: this.isRoundComplete(),
    };
  }
}
