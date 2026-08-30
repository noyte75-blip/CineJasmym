// Sincronização v14: servidor autoritativo + relógio monotônico + ciclos
// adaptativos. Quando o vídeo está pausado ou a aba está oculta, o trabalho e
// as mensagens diminuem automaticamente.
//
// O vídeo continua sendo carregado diretamente da fonte. Pelo WebSocket passam
// apenas snapshots pequenos, comandos e amostras de horário. PLAY/PAUSE nunca
// enviam uma posição local; somente SEEK pode mudar o tempo oficial.

class SyncController {
  constructor({ player, wsClient, videoUrl, onUpdate, onNeedsGesture }) {
    this.player = player;
    this.wsClient = wsClient;
    this.videoUrl = videoUrl;
    this.onUpdate = onUpdate || (() => {});
    this.onNeedsGesture = onNeedsGesture || (() => {});
    this.official = null;
    this.receivedAt = 0;
    this.latestRevision = -1;
    this.destroyed = false;
    this.pollTimer = null;
    this.syncTimer = null;
    this.timeSyncTimer = null;
    this.scheduledPlayTimer = null;
    this.gestureCheckTimer = null;
    this.commandSequence = 0;
    this.clockOffsetMs = null;
    this.bestRttMs = Infinity;
    this.lastHardCorrectionAt = 0;
    this.playbackRate = 1;
    this.clockBurstCount = 0;
    this.sessionId = globalThis.crypto?.randomUUID?.()
      || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  _commandId() {
    this.commandSequence += 1;
    return `${this.sessionId}:${this.commandSequence}`;
  }

  _send(type, fields = {}) {
    this.wsClient.send({
      type,
      ...fields,
      protocolVersion: 16,
      intent: 'user-control',
      commandId: this._commandId(),
    });
  }

  replaceConnection(wsClient) {
    this.wsClient = wsClient;
    this.requestTimeSync();
    this.wsClient.send({ type: 'REQUEST_STATE' }, { skipIfBusy: true });
  }

  _now() {
    if (globalThis.performance
      && Number.isFinite(globalThis.performance.timeOrigin)
      && typeof globalThis.performance.now === 'function') {
      return globalThis.performance.timeOrigin + globalThis.performance.now();
    }
    return Date.now();
  }

  _isHidden() {
    return typeof document !== 'undefined' && document.hidden;
  }

  requestTimeSync() {
    if (this.destroyed) return;
    this.wsClient.send(
      { type: 'PING', clientTime: this._now() },
      { skipIfBusy: true },
    );
  }

  updateClockSample({ clientTime, serverNow }) {
    const received = this._now();
    const sent = Number(clientTime);
    const server = Number(serverNow);
    const rtt = received - sent;
    if (!Number.isFinite(sent) || !Number.isFinite(server) || rtt < 0 || rtt > 5000) return;

    // NTP simplificado: o servidor respondeu aproximadamente no meio da ida e
    // volta. A menor latência observada tende a ser a amostra mais confiável.
    const sampleOffset = server - (sent + received) / 2;
    if (!Number.isFinite(this.clockOffsetMs) || rtt <= this.bestRttMs) {
      this.clockOffsetMs = sampleOffset;
      this.bestRttMs = rtt;
    } else if (rtt <= this.bestRttMs + 80) {
      this.clockOffsetMs = (this.clockOffsetMs * 0.85) + (sampleOffset * 0.15);
    }
  }

  estimatedServerNow() {
    return Number.isFinite(this.clockOffsetMs) ? this._now() + this.clockOffsetMs : null;
  }

  expectedPosition() {
    if (!this.official) return 0;
    let position = Number(this.official.position ?? this.official.time) || 0;
    if (!this.official.playing) return Math.max(0, position);

    const snapshotServerNow = Number(this.official.serverNow);
    const changedAt = Number(this.official.changedAt);
    const estimatedNow = this.estimatedServerNow();
    if (Number.isFinite(snapshotServerNow) && Number.isFinite(estimatedNow)) {
      // Se PLAY foi agendado alguns milissegundos no futuro, o relógio só
      // avança a partir de changedAt. Caso contrário, avança desde o snapshot.
      const countingFrom = Number.isFinite(changedAt)
        ? Math.max(snapshotServerNow, changedAt)
        : snapshotServerNow;
      position += Math.max(0, estimatedNow - countingFrom) / 1000;
    } else {
      position += Math.max(0, this._now() - this.receivedAt) / 1000;
    }
    return Math.max(0, position);
  }

  expectsPlayback() {
    return Boolean(this.official?.playing);
  }

  _millisecondsUntilStart() {
    if (!this.official?.playing) return 0;
    const changedAt = Number(this.official.changedAt);
    const estimatedNow = this.estimatedServerNow();
    if (!Number.isFinite(changedAt) || !Number.isFinite(estimatedNow)) return 0;
    return Math.max(0, changedAt - estimatedNow);
  }

  applyAuthoritativeState(videoState, { force = false } = {}) {
    if (this.destroyed || !videoState || videoState.url !== this.videoUrl) return;
    const revision = Number(videoState.revision);
    const serverNow = Number(videoState.serverNow);
    const sameOrOlderSnapshot = Number.isFinite(revision)
      && revision === this.latestRevision
      && serverNow <= Number(this.official?.serverNow || 0);
    if (!force && Number.isFinite(revision)
      && (revision < this.latestRevision || sameOrOlderSnapshot)) return;
    if (Number.isFinite(revision)) this.latestRevision = revision;

    const receivedAt = this._now();
    // Antes do primeiro PONG, esta aproximação já elimina a diferença entre
    // relógios configurados incorretamente nos dois aparelhos.
    if (!Number.isFinite(this.clockOffsetMs) && Number.isFinite(serverNow)) {
      this.clockOffsetMs = serverNow - receivedAt;
    }
    this.official = {
      ...videoState,
      position: Number(videoState.position ?? videoState.time) || 0,
      playing: Boolean(videoState.playing),
    };
    this.receivedAt = receivedAt;
    this._reconcile(force);
    this.onUpdate(this.official);
  }

  _setPlaybackRate(rate) {
    const normalized = Number.isFinite(rate) ? rate : 1;
    if (Math.abs(normalized - this.playbackRate) < 0.001) return;
    if (typeof this.player.setPlaybackRate === 'function') {
      const applied = this.player.setPlaybackRate(normalized);
      if (applied !== false) this.playbackRate = normalized;
    }
  }

  _resetPlaybackRate() {
    this._setPlaybackRate(1);
  }

  _scheduleGestureCheck() {
    if (this.gestureCheckTimer) return;
    this.gestureCheckTimer = setTimeout(() => {
      this.gestureCheckTimer = null;
      if (this.destroyed) return;
      this.onNeedsGesture(this.expectsPlayback() && !this.player.isPlaying());
    }, 900);
  }

  _reconcile(force = false) {
    if (this.destroyed || !this.official || !this.player.getDuration()) return;
    const target = this.expectedPosition();
    const local = this.player.getCurrentTime();
    const signedDrift = target - local;
    const drift = Math.abs(signedDrift);
    const untilStart = this._millisecondsUntilStart();

    if (untilStart > 25) {
      this._resetPlaybackRate();
      if (drift > CONFIG.SYNC_DEAD_BAND || force) this.player.seekTo(target);
      if (this.player.isPlaying()) this.player.pause();
      this.onNeedsGesture(false);
      clearTimeout(this.scheduledPlayTimer);
      this.scheduledPlayTimer = setTimeout(
        () => this._reconcile(true),
        Math.min(untilStart + 10, 2000),
      );
      return;
    }

    clearTimeout(this.scheduledPlayTimer);
    this.scheduledPlayTimer = null;

    if (!this.official.playing) {
      this._resetPlaybackRate();
      clearTimeout(this.gestureCheckTimer);
      this.gestureCheckTimer = null;
      this.onNeedsGesture(false);
      if (drift > CONFIG.SYNC_DEAD_BAND || force) this.player.seekTo(target);
      if (this.player.isPlaying()) this.player.pause();
      return;
    }

    if (!this.player.isPlaying()) {
      this._resetPlaybackRate();
      if (drift > CONFIG.SYNC_DEAD_BAND || force) this.player.seekTo(target);
      this.player.play();
      this._scheduleGestureCheck();
      return;
    }

    clearTimeout(this.gestureCheckTimer);
    this.gestureCheckTimer = null;
    this.onNeedsGesture(false);

    // Enquanto a fonte está sem dados, não fazemos novos saltos. Seek durante
    // buffering descartaria parte do que já foi carregado e deixaria o vídeo
    // ainda mais lento. Assim que o player voltar, a próxima rodada corrige.
    if (typeof this.player.isBuffering === 'function' && this.player.isBuffering()) {
      this._resetPlaybackRate();
      return;
    }

    const now = this._now();
    if (drift > CONFIG.SYNC_HARD_THRESHOLD && now - this.lastHardCorrectionAt > 1500) {
      // Um seek único é melhor que vários pequenos: corrige rápido e evita que
      // o YouTube fique reiniciando o buffer.
      this._resetPlaybackRate();
      this.player.seekTo(target);
      this.lastHardCorrectionAt = now;
    } else if (drift > CONFIG.SYNC_RATE_THRESHOLD) {
      const adjustment = CONFIG.SYNC_RATE_ADJUSTMENT;
      this._setPlaybackRate(signedDrift > 0 ? 1 + adjustment : 1 - adjustment);
    } else {
      this._resetPlaybackRate();
    }
  }

  localPlay() {
    if (this.destroyed) return;
    if (this.expectsPlayback()) {
      // Retomada local após bloqueio de autoplay: usa o tempo oficial, sem
      // enviar outro PLAY e sem afetar o vídeo da outra pessoa.
      this._reconcile(true);
      this.onNeedsGesture(false);
      return;
    }

    // O servidor agenda o início por uma fração de segundo para os dois
    // navegadores começarem juntos. Não damos play local antes do ACK.
    this.onNeedsGesture(false);
    this._send('PLAY');
  }

  localPause() {
    if (this.destroyed) return;
    this._resetPlaybackRate();
    this.player.pause();
    this.onNeedsGesture(false);
    this._send('PAUSE');
  }

  localSeek(position) {
    if (this.destroyed || !Number.isFinite(position)) return;
    const safePosition = Math.max(0, position);
    this._resetPlaybackRate();
    this.player.seekTo(safePosition);
    this._send('SEEK', {
      position: safePosition,
    });
  }

  notifyVideoChange(videoType, url) {
    this._send('CHANGE_VIDEO', { videoType, url });
  }

  _scheduleReconcile(delay = null) {
    clearTimeout(this.syncTimer);
    if (this.destroyed) return;
    const nextDelay = delay ?? (this._isHidden()
      ? CONFIG.BACKGROUND_SYNC_INTERVAL_MS
      : this.expectsPlayback()
        ? CONFIG.SYNC_CHECK_INTERVAL_MS
        : CONFIG.PAUSED_SYNC_INTERVAL_MS);
    this.syncTimer = setTimeout(() => {
      this._reconcile();
      this._scheduleReconcile();
    }, nextDelay);
  }

  _scheduleStatePoll(delay = null) {
    clearTimeout(this.pollTimer);
    if (this.destroyed) return;
    const nextDelay = delay ?? (this._isHidden()
      ? CONFIG.BACKGROUND_STATE_POLL_INTERVAL_MS
      : this.expectsPlayback()
        ? CONFIG.PLAYING_STATE_POLL_INTERVAL_MS
        : CONFIG.PAUSED_STATE_POLL_INTERVAL_MS);
    this.pollTimer = setTimeout(() => {
      this.wsClient.send({ type: 'REQUEST_STATE' }, { skipIfBusy: true });
      this._scheduleStatePoll();
    }, nextDelay);
  }

  _scheduleTimeSync(delay = null) {
    clearTimeout(this.timeSyncTimer);
    if (this.destroyed) return;
    const initialDelays = [0, 500, 1500];
    const nextDelay = delay ?? (this.clockBurstCount < initialDelays.length
      ? initialDelays[this.clockBurstCount]
      : CONFIG.TIME_SYNC_INTERVAL_MS);
    this.timeSyncTimer = setTimeout(() => {
      this.requestTimeSync();
      this.clockBurstCount += 1;
      this._scheduleTimeSync();
    }, nextDelay);
  }

  startPolling() {
    this.stopPolling();
    this.clockBurstCount = 0;
    this.wsClient.send({ type: 'REQUEST_STATE' }, { skipIfBusy: true });
    this._scheduleReconcile(0);
    this._scheduleStatePoll();
    this._scheduleTimeSync(0);
  }

  stopPolling() {
    clearTimeout(this.pollTimer);
    clearTimeout(this.syncTimer);
    clearTimeout(this.timeSyncTimer);
    this.pollTimer = null;
    this.syncTimer = null;
    this.timeSyncTimer = null;
  }

  destroy() {
    this.destroyed = true;
    this.stopPolling();
    this._resetPlaybackRate();
    clearTimeout(this.scheduledPlayTimer);
    clearTimeout(this.gestureCheckTimer);
  }
}
