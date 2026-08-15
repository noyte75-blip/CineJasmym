// Contrato comum para qualquer player de vídeo.
//
// Para adicionar suporte a um novo tipo de vídeo no futuro (ex: Vimeo,
// Twitch, etc.), basta criar uma nova classe que implemente estes
// mesmos métodos. O resto do sistema (sync.js, app.js) nunca precisa
// saber qual player está sendo usado por baixo dos panos.
//
// Métodos que toda implementação DEVE ter:
//
//   async load(url)          -> carrega um vídeo a partir de uma URL
//   play()                   -> dá play
//   pause()                  -> dá pause
//   seekTo(seconds)          -> pula para uma posição (em segundos)
//   getCurrentTime()         -> retorna a posição atual (em segundos)
//   getDuration()            -> retorna a duração total (em segundos)
//   isPlaying()               -> retorna true/false
//   isBuffering()             -> informa se a fonte está carregando (opcional)
//   setPlaybackRate(rate)     -> ajuste temporário fino (opcional)
//   destroy()                -> remove o player da tela
//   onStateChange(callback)  -> chama callback({type, time}) quando o
//                                usuário LOCAL interage (play/pause/seek)
//
// "type" identifica o player no protocolo de eventos: 'youtube' | 'html5'

class PlayerInterface {
  constructor(container) {
    if (new.target === PlayerInterface) {
      throw new Error('PlayerInterface é abstrata, use uma implementação concreta.');
    }
    this.container = container;
    this._stateChangeCallback = null;
  }

  onStateChange(callback) {
    this._stateChangeCallback = callback;
  }

  _emit(type, extra = {}) {
    if (this._stateChangeCallback) {
      this._stateChangeCallback({ type, time: this.getCurrentTime(), ...extra });
    }
  }

  async load(_url) { throw new Error('load() não implementado'); }
  play() { throw new Error('play() não implementado'); }
  pause() { throw new Error('pause() não implementado'); }
  seekTo(_seconds) { throw new Error('seekTo() não implementado'); }
  getCurrentTime() { throw new Error('getCurrentTime() não implementado'); }
  getDuration() { throw new Error('getDuration() não implementado'); }
  isPlaying() { throw new Error('isPlaying() não implementado'); }
  isBuffering() { return false; }
  setPlaybackRate(_rate) { return false; }
  destroy() { /* opcional */ }
}
