/**
 * AudioManager — Reliable Offline Hijaiyah Pronunciation Engine + Live Amplitude Sync
 *
 * Features:
 *  - Monotonic playback sequence token prevents overlapping audio on rapid clicks
 *  - Plays 29 verified native Arabic recordings from public/audio/*.mp3 via Web Audio API
 *  - Supports slow-motion playback (0.75x) synced to 3D animation
 *  - Supports playback of user-recorded Blob URLs for side-by-side self-comparison
 *  - Streams live RMS amplitude [0..1] to animate 3D vocal folds, beacon, and airflow
 */

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.analyser = null;
    this.dataArray = null;
    this.bufferCache = new Map();
    this.activeSource = null;
    this.activeHtmlAudio = null;
    this.isPlaying = false;
    this.muted = false;
    this._fallbackLevel = 0;
    this._playSeq = 0;
  }

  _ensureContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.72;
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      this.analyser.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  stop() {
    this._playSeq += 1;
    if (this.activeSource) {
      try {
        this.activeSource.onended = null;
        this.activeSource.stop();
      } catch {
        // Ignore already-stopped node
      }
      try {
        this.activeSource.disconnect();
      } catch {
        // Ignore disconnect error
      }
      this.activeSource = null;
    }
    if (this.activeHtmlAudio) {
      try {
        this.activeHtmlAudio.pause();
        this.activeHtmlAudio.currentTime = 0;
      } catch {
        // Ignore HTML audio stop error
      }
      this.activeHtmlAudio = null;
    }
    if (window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore speech cancel error
      }
    }
    this.isPlaying = false;
    this._fallbackLevel = 0;
  }

  async playLetter(letter, { slowMotion = false, onEnd = null } = {}) {
    if (this.muted || !letter) {
      if (onEnd) onEnd();
      return false;
    }
    this.stop();
    const seq = this._playSeq;

    const ctx = this._ensureContext();
    const url = `./audio/${letter.audioFile}`;

    if (ctx) {
      try {
        let buffer = this.bufferCache.get(url);
        if (!buffer) {
          const resp = await fetch(url);
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          const arrayBuf = await resp.arrayBuffer();
          if (seq !== this._playSeq) return false;
          buffer = await ctx.decodeAudioData(arrayBuf);
          this.bufferCache.set(url, buffer);
        }

        if (seq !== this._playSeq) return false;

        return await new Promise((resolve) => {
          const source = ctx.createBufferSource();
          source.buffer = buffer;
          source.playbackRate.value = slowMotion ? 0.75 : 1.0;
          source.connect(this.analyser);

          this.activeSource = source;
          this.isPlaying = true;

          source.onended = () => {
            if (this.activeSource === source) {
              this.activeSource = null;
              this.isPlaying = false;
            }
            if (onEnd) onEnd();
            resolve(true);
          };

          source.start(0);
        });
      } catch (err) {
        if (seq !== this._playSeq) return false;
        console.warn(`Audio MP3 load failed for ${url}, falling back to SpeechSynthesis:`, err);
      }
    }

    // Fallback: Web Speech API Arabic (ar-SA)
    if (window.speechSynthesis && seq === this._playSeq) {
      return await new Promise((resolve) => {
        const utter = new SpeechSynthesisUtterance(letter.ttsText || letter.char);
        utter.lang = 'ar-SA';
        utter.rate = slowMotion ? 0.65 : 0.9;
        this.isPlaying = true;
        this._fallbackLevel = 0.6;
        utter.onend = () => {
          if (seq === this._playSeq) {
            this.isPlaying = false;
            this._fallbackLevel = 0;
          }
          if (onEnd) onEnd();
          resolve(true);
        };
        utter.onerror = () => {
          if (seq === this._playSeq) {
            this.isPlaying = false;
            this._fallbackLevel = 0;
          }
          if (onEnd) onEnd();
          resolve(false);
        };
        window.speechSynthesis.speak(utter);
      });
    }

    if (onEnd) onEnd();
    return false;
  }

  /**
   * Plays a locally recorded user Blob URL (never leaves the device).
   */
  async playRecordingUrl(blobUrl, { onEnd = null } = {}) {
    if (!blobUrl) {
      if (onEnd) onEnd();
      return false;
    }
    this.stop();
    const seq = this._playSeq;

    return await new Promise((resolve) => {
      const audio = new Audio(blobUrl);
      this.activeHtmlAudio = audio;
      this.isPlaying = true;
      this._fallbackLevel = 0.5;

      const finish = (ok) => {
        if (this.activeHtmlAudio === audio) {
          this.activeHtmlAudio = null;
          this.isPlaying = false;
          this._fallbackLevel = 0;
        }
        if (onEnd) onEnd();
        resolve(ok);
      };

      audio.onended = () => finish(true);
      audio.onerror = () => finish(false);
      audio.play().catch(() => {
        if (seq === this._playSeq) finish(false);
      });
    });
  }

  getAudioLevel() {
    if (!this.isPlaying) return 0;
    if (this.analyser && this.dataArray && this.activeSource) {
      this.analyser.getByteTimeDomainData(this.dataArray);
      let sumSq = 0;
      for (let i = 0; i < this.dataArray.length; i++) {
        const v = (this.dataArray[i] - 128) / 128;
        sumSq += v * v;
      }
      const rms = Math.sqrt(sumSq / this.dataArray.length);
      return Math.min(1.0, rms * 3.8);
    }
    return this._fallbackLevel;
  }
}
