// Player para vídeos HTML5 diretos (.mp4, .webm)

class Html5Player extends PlayerInterface {
  static type = 'html5';

  constructor(container) {
    super(container);
    this.video = document.createElement('video');
    this.video.className = 'video-element';
    this.video.controls = false; // controles são os nossos, para manter tudo sincronizado
    this.video.playsInline = true;
    this.video.preload = 'auto';
    this.container.innerHTML = '';
    this.container.appendChild(this.video);

    // Só emite eventos quando a ação vem do usuário local, não de uma
    // aplicação remota (ver flag _applyingRemote em sync.js).
    this.video.addEventListener('play', () => this._emit('play'));
    this.video.addEventListener('pause', () => this._emit('pause'));
    this.video.addEventListener('seeked', () => this._emit('seek'));
  }

  async load(url) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('O vídeo demorou demais para carregar.')), 15000);
      const finish = (callback, value) => {
        clearTimeout(timeout);
        callback(value);
      };
      this.video.src = url;
      this.video.load();
      this.video.addEventListener('loadedmetadata', () => finish(resolve), { once: true });
      this.video.addEventListener('error', () => finish(reject, new Error('Esse link de vídeo não pôde ser aberto.')), { once: true });
    });
  }

  play() { this.video.play().catch(() => {}); }
  pause() { this.video.pause(); }
  seekTo(seconds) { this.video.currentTime = seconds; }
  getCurrentTime() { return this.video.currentTime || 0; }
  getDuration() { return this.video.duration || 0; }
  isPlaying() { return !this.video.paused && !this.video.ended; }
  isBuffering() { return !this.video.paused && (this.video.seeking || this.video.readyState < 3); }
  setPlaybackRate(rate) {
    this.video.playbackRate = Math.max(0.9, Math.min(1.1, rate));
    return true;
  }
  destroy() { this.video.pause(); this.video.src = ''; }
}
