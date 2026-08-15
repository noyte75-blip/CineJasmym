// Wrapper simples sobre WebSocket, com um pequeno sistema de eventos
// (parecido com EventEmitter) para facilitar o uso no resto do app.

class WebSocketClient {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this._listeners = {};
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => resolve();
      this.ws.onerror = () => reject(
        new Error('Não foi possível conectar ao servidor. Confira se o backend está no ar e se WS_URL em config.js está correto.')
      );

      this.ws.onmessage = (event) => {
        let data;
        try {
          data = JSON.parse(event.data);
        } catch (e) {
          return;
        }
        // O backend novo mantém o estado completo em `videoState`.
        // Espalhar os campos também no topo preserva compatibilidade com
        // os controladores antigos sem perder os metadados novos.
        if (data.videoState && typeof data.videoState === 'object') {
          data = { ...data.videoState, ...data, videoState: data.videoState };
        }
        this._emit(data.type, data);
      };

      this.ws.onclose = () => this._emit('DISCONNECTED', {});
    });
  }

  isOpen() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  on(type, callback) {
    (this._listeners[type] ||= []).push(callback);
  }

  off(type, callback) {
    const listeners = this._listeners[type];
    if (!listeners) return;
    this._listeners[type] = listeners.filter((item) => item !== callback);
  }

  disconnect() {
    if (this.ws && this.ws.readyState < WebSocket.CLOSING) {
      this.ws.close(1000, 'Página fechada');
    }
  }

  _emit(type, data) {
    (this._listeners[type] || []).forEach((cb) => cb(data));
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }
}
