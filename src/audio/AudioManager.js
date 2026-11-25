/**
 * AudioManager — Credible Hijaiyah Pronunciation Playback + Live Amplitude Analysis
 *
 * Plays pre-verified native Arabic Qari recordings bundled locally in public/audio/*.mp3
 * via Web Audio API (AudioContext + AnalyserNode) so:
 *  - Works 100% offline during class demos (zero broken CDN links!)
 *  - Supports slow-motion playback speed (0.72x) in sync with Slow-Mo 3D animation
 *  - Feeds real-time RMS voice amplitude back into the 3D shaders & vocal cords!
 *  - Gracefully falls back to Web Speech API (ar-SA) if any file cannot be decoded.
 */

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.analyser = null;
    this.dataArray = null;
    this.bufferCache = new Map();
    this.activeSource = null;
    this.isPlaying = false;
    this.muted = false;
    this._fallbackLevel = 0;
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
      this.ctx.resume();
    }
    return this.ctx;
  }

  stop() {
    if (this.activeSource) {
      try {
        this.activeSource.stop();
      } catch {
        // Ignore already-stopped AudioBufferSourceNode
      }
      this.activeSource.disconnect();
      this.activeSource = null;
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    this.isPlaying = false;
    this._fallbackLevel = 0;
  }

  async playLetter(letter, { slowMotion = false, onEnd = null } = {}) {
    if (this.muted || !letter) return;
    this.stop();

    const ctx = this._ensureContext();
    const url = `./audio/${letter.audioFile}`;

    if (ctx) {
      try {
        let buffer = this.bufferCache.get(url);
        if (!buffer) {
          const resp = await fetch(url);
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          const arrayBuf = await resp.arrayBuffer();
          buffer = await ctx.decodeAudioData(arrayBuf);
          this.bufferCache.set(url, buffer);
        }

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
        };

        source.start(0);
        return;
      } catch (err) {
        console.warn(`Audio MP3 load failed for ${url}, falling back to SpeechSynthesis:`, err);
      }
    }

    // Fallback: Web Speech API Arabic (ar-SA)
    if (window.speechSynthesis) {
      const utter = new SpeechSynthesisUtterance(letter.ttsText || letter.char);
      utter.lang = 'ar-SA';
      utter.rate = slowMotion ? 0.65 : 0.9;
      this.isPlaying = true;
      this._fallbackLevel = 0.6;
      utter.onend = () => {
        this.isPlaying = false;
        this._fallbackLevel = 0;
        if (onEnd) onEnd();
      };
      window.speechSynthesis.speak(utter);
    }
  }

  /**
   * Returns normalized live voice amplitude [0..1] for syncing 3D vocal cords,
   * Makhraj beacon pulse, and airflow particles with the Qari's voice.
   */
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
