/**
 * VoiceRecorder — 100% On-Device Privacy-First Microphone Practice Recorder
 *
 * Lets learners record their own pronunciation of any Hijaiyah letter (up to 4s),
 * watch a live volume meter, and immediately compare their voice back-to-back
 * against the native reference recording. Zero data ever leaves the browser.
 */

export class VoiceRecorder {
  constructor() {
    this.recordings = new Map(); // letterId -> blobUrl
    this.mediaRecorder = null;
    this.stream = null;
    this.audioCtx = null;
    this.analyser = null;
    this.dataArray = null;
    this.isRecording = false;
    this._stopTimeout = null;
    this._activeLetterId = null;
  }

  isSupported() {
    return Boolean(
      navigator.mediaDevices &&
        navigator.mediaDevices.getUserMedia &&
        typeof window.MediaRecorder !== 'undefined'
    );
  }

  hasRecording(letterId) {
    return this.recordings.has(letterId);
  }

  getRecordingUrl(letterId) {
    return this.recordings.get(letterId) || null;
  }

  async start(letterId, { maxDurationMs = 4000, onComplete = null, onError = null } = {}) {
    if (!this.isSupported()) {
      if (onError) onError('Browser ini belum mendukung perekaman mikrofon.');
      return false;
    }
    if (this.isRecording) {
      this.stop();
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      this.stream = stream;
      this._activeLetterId = letterId;

      // Live level analyser for gentle monochrome mic meter
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.audioCtx = new AudioCtx();
        const src = this.audioCtx.createMediaStreamSource(stream);
        this.analyser = this.audioCtx.createAnalyser();
        this.analyser.fftSize = 128;
        this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        src.connect(this.analyser);
      }

      const chunks = [];
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : '';

      this.mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: this.mediaRecorder?.mimeType || 'audio/webm' });
        const oldUrl = this.recordings.get(letterId);
        if (oldUrl) URL.revokeObjectURL(oldUrl);
        const url = URL.createObjectURL(blob);
        this.recordings.set(letterId, url);
        this._cleanupStream();
        if (onComplete) onComplete(url, letterId);
      };

      this.mediaRecorder.start();
      this.isRecording = true;

      clearTimeout(this._stopTimeout);
      this._stopTimeout = setTimeout(() => {
        if (this.isRecording) this.stop();
      }, maxDurationMs);

      return true;
    } catch (err) {
      this._cleanupStream();
      const msg =
        err?.name === 'NotAllowedError'
          ? 'Izin mikrofon ditolak. Aktifkan izin mikrofon di browser untuk merekam suara.'
          : 'Mikrofon tidak ditemukan atau sedang dipakai aplikasi lain.';
      if (onError) onError(msg);
      return false;
    }
  }

  stop() {
    clearTimeout(this._stopTimeout);
    this._stopTimeout = null;
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch {
        this._cleanupStream();
      }
    } else {
      this._cleanupStream();
    }
    this.isRecording = false;
  }

  getInputLevel() {
    if (!this.isRecording || !this.analyser || !this.dataArray) return 0;
    this.analyser.getByteTimeDomainData(this.dataArray);
    let sumSq = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      const v = (this.dataArray[i] - 128) / 128;
      sumSq += v * v;
    }
    return Math.min(1.0, Math.sqrt(sumSq / this.dataArray.length) * 4.2);
  }

  _cleanupStream() {
    this.isRecording = false;
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    if (this.audioCtx) {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
      this.analyser = null;
      this.dataArray = null;
    }
  }
}
