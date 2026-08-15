// Player para vídeos do YouTube, usando a IFrame Player API oficial.
// Não faz nenhum tipo de bypass de restrições do YouTube — apenas usa
// a API pública para controlar play/pause/seek.

let youtubeApiPromise = null;

function loadYouTubeApi() {
  if (youtubeApiPromise) return youtubeApiPromise;

  youtubeApiPromise = new Promise((resolve, reject) => {
    if (window.YT && window.YT.Player) {
      resolve(window.YT);
      return;
    }
    const previousReady = window.onYouTubeIframeAPIReady;
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    tag.onerror = () => {
      youtubeApiPromise = null;
      reject(new Error('Não foi possível carregar o player do YouTube. Verifique a conexão ou bloqueadores do navegador.'));
    };
    document.head.appendChild(tag);

    window.onYouTubeIframeAPIReady = () => {
      if (typeof previousReady === 'function') previousReady();
      resolve(window.YT);
    };
  });

  return youtubeApiPromise;
}

function extractYouTubeId(url) {
  const patterns = [
    /youtu\.be\/([a-zA-Z0-9_-]{6,})/,
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{6,})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{6,})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{6,})/,
  ];
  for (const p of patterns) {
    const match = url.match(p);
    if (match) return match[1];
  }
  return null;
}

class YoutubePlayer extends PlayerInterface {
  static type = 'youtube';

  constructor(container) {
    super(container);
    this.player = null;
    this.container.innerHTML = '<div class="youtube-mount"></div>';
    this.mountEl = this.container.querySelector('.youtube-mount');
    this._ready = false;
    this._playingIntent = false;
    this._playerState = -1;
  }

  async load(url) {
    const videoId = extractYouTubeId(url);
    if (!videoId) throw new Error('Link do YouTube inválido.');

    const YT = await loadYouTubeApi();

    if (this.player) {
      this.player.loadVideoById(videoId);
      return;
    }

    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (callback, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        callback(value);
      };
      const timeout = setTimeout(() => {
        finish(reject, new Error('O player do YouTube demorou demais para carregar. Tente novamente.'));
      }, 15000);

      this.player = new YT.Player(this.mountEl, {
        videoId,
        playerVars: {
          autoplay: 0,
          playsinline: 1,
          rel: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          iv_load_policy: 3,
        },
        events: {
          onReady: () => {
            this._ready = true;
            finish(resolve);
          },
          onError: (event) => {
            const messages = {
              2: 'O link ou ID do vídeo é inválido.',
              5: 'O YouTube não conseguiu reproduzir este vídeo em HTML5.',
              100: 'O vídeo não existe ou foi removido.',
              101: 'O dono do vídeo não permite reprodução em outros sites.',
              150: 'O dono do vídeo não permite reprodução em outros sites.',
            };
            finish(reject, new Error(messages[event.data] || 'O YouTube recusou o carregamento deste vídeo.'));
          },
          onStateChange: (event) => {
            this._playerState = event.data;
            if (event.data === YT.PlayerState.PLAYING) this._playingIntent = true;
            if (
              event.data === YT.PlayerState.PAUSED
              || event.data === YT.PlayerState.ENDED
              || event.data === YT.PlayerState.CUED
            ) {
              this._playingIntent = false;
            }
            // BUFFERING mantém a intenção anterior. Assim o heartbeat não
            // informa "pausado" só porque o YouTube está carregando dados.
          },
        },
      });
    });
  }

  play() {
    this._playingIntent = true;
    this.player?.playVideo();
  }
  pause() {
    this._playingIntent = false;
    this.player?.pauseVideo();
  }

  seekTo(seconds) {
    this.player?.seekTo(seconds, true);
  }

  getCurrentTime() { return this._ready ? (this.player?.getCurrentTime() || 0) : 0; }
  getDuration() { return this._ready ? (this.player?.getDuration() || 0) : 0; }
  isPlaying() {
    if (!this._ready) return false;
    const state = this.player?.getPlayerState();
    return state === 1 || (state === 3 && this._playingIntent); // 1 = PLAYING, 3 = BUFFERING
  }
  isBuffering() { return this._playerState === 3; }
  setPlaybackRate(rate) {
    if (!this._ready || !this.player?.setPlaybackRate) return false;
    const available = this.player.getAvailablePlaybackRates?.() || [1];
    const target = available.find((value) => Math.abs(value - rate) < 0.01);
    // O YouTube normalmente oferece degraus grandes (0.75/1.25). Usá-los para
    // corrigir poucos milissegundos deixaria o vídeo claramente lento/rápido.
    // Sem uma taxa fina disponível, aguardamos o limite de correção por seek.
    if (!Number.isFinite(target)) return false;
    this.player.setPlaybackRate(target);
    return true;
  }
  destroy() { this.player?.destroy(); }
}
