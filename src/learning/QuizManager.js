import {
  HIJAIYAH_LETTERS,
  MAKHRAJ_CATEGORIES,
  CONFUSION_PAIRS,
  getLetterById,
} from '../data/hijaiyahData.js';

/**
 * QuizManager — Interactive Tajwid & Makharijul Huruf Practice Engine
 *
 * Two modes:
 *  - 'letter'  : Animates the 3D vocal tract + plays audio while hiding the letter;
 *                student identifies the letter from 4 curated confusing choices.
 *  - 'makhraj' : Shows the letter + animates 3D + plays audio;
 *                student identifies the primary Makhraj category.
 */

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export class QuizManager {
  constructor() {
    this.mode = 'letter'; // 'letter' | 'makhraj'
    this.currentQuestion = null;
    this.lastLetterId = null;
  }

  setMode(mode) {
    this.mode = mode === 'makhraj' ? 'makhraj' : 'letter';
  }

  nextQuestion() {
    // Pick a letter different from the previous one
    const pool = HIJAIYAH_LETTERS.filter((l) => l.id !== this.lastLetterId);
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
        label: cat.name,
        sub: cat.subtitle,
        isArabic: false,
      }));

      this.currentQuestion = {
        mode: 'makhraj',
        letter,
        prompt: `Di mana makhraj utama huruf ${letter.phonetic} (${letter.char})?`,
        correctValue: correctCat.id,
        options,
        answered: false,
        selectedValue: null,
      };
      return this.currentQuestion;
    }

    // Mode 'letter': prefer smart confusing distractors so practice genuinely sharpens perception!
    const distractorIds = new Set();
    const pairGroup = CONFUSION_PAIRS.find((g) => g.letters.includes(letter.id));
    if (pairGroup) {
      pairGroup.letters.forEach((id) => {
        if (id !== letter.id) distractorIds.add(id);
      });
    }
    // Fill remaining distractors from same makhraj first, then random letters
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
    return {
      isCorrect,
      question: this.currentQuestion,
    };
  }
}
