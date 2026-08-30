const els = {
  screenLanding: document.getElementById('screen-landing'),
  screenRoom: document.getElementById('screen-room'),
  tabBtns: document.querySelectorAll('.tab-btn'),
  panelCreate: document.getElementById('panel-create'),
  panelJoin: document.getElementById('panel-join'),
  createName: document.getElementById('create-name'),
  joinName: document.getElementById('join-name'),
  joinCode: document.getElementById('join-code'),
  btnCreateRoom: document.getElementById('btn-create-room'),
  btnJoinRoom: document.getElementById('btn-join-room'),
  landingError: document.getElementById('landing-error'),
  profileInput: document.getElementById('profile-photo-input'),
  profilePreview: document.getElementById('profile-preview'),
  profilePlaceholder: document.getElementById('profile-placeholder'),
  myAvatar: document.getElementById('my-avatar'),
  peerAvatar: document.getElementById('peer-avatar'),
  myNameDisplay: document.getElementById('my-name-display'),
  peerNameDisplay: document.getElementById('peer-name-display'),
  peerStatus: document.getElementById('peer-status'),
  roomCodeDisplay: document.getElementById('room-code-display'),
  btnCopyLink: document.getElementById('btn-copy-link'),
  btnNeutralMode: document.getElementById('btn-neutral-mode'),
  chatUnreadBadge: document.getElementById('chat-unread-badge'),
  videoWrapper: document.getElementById('video-wrapper'),
  playerContainer: document.getElementById('player-container'),
  videoPlaceholder: document.getElementById('video-placeholder'),
  resumeBanner: document.getElementById('resume-banner'),
  btnPlayPause: document.getElementById('btn-playpause'),
  btnBack10: document.getElementById('btn-back10'),
  btnFwd10: document.getElementById('btn-fwd10'),
  btnSoloMode: document.getElementById('btn-solo-mode'),
  btnPip: document.getElementById('btn-pip'),
  btnFullscreen: document.getElementById('btn-fullscreen'),
  seekBar: document.getElementById('seek-bar'),
  timeDisplay: document.getElementById('time-display'),
  syncDot: document.getElementById('sync-dot'),
  syncStatus: document.getElementById('sync-status'),
  videoForm: document.getElementById('video-form'),
  videoTypeSelect: document.getElementById('video-type-select'),
  videoUrlInput: document.getElementById('video-url-input'),
  chatPanel: document.getElementById('chat-panel'),
  chatMessages: document.getElementById('chat-messages'),
  chatForm: document.getElementById('chat-form'),
  chatInput: document.getElementById('chat-input'),
  chatMediaInput: document.getElementById('chat-media-input'),
  mediaPreviewBar: document.getElementById('media-preview-bar'),
  mediaPreview: document.getElementById('media-preview'),
  mediaPreviewName: document.getElementById('media-preview-name'),
  btnRemoveMedia: document.getElementById('btn-remove-media'),
  chatError: document.getElementById('chat-error'),
  btnToggleChat: document.getElementById('btn-toggle-chat'),
  btnCloseChat: document.getElementById('btn-close-chat'),
  btnNotifications: document.getElementById('btn-notifications'),
  btnAttentionPing: document.getElementById('btn-attention-ping'),
  btnClearChatForMe: document.getElementById('btn-clear-chat-for-me'),
  btnOpenGif: document.getElementById('btn-open-gif'),
  gifPicker: document.getElementById('gif-picker'),
  btnCloseGif: document.getElementById('btn-close-gif'),
  gifSearchForm: document.getElementById('gif-search-form'),
  gifSearchInput: document.getElementById('gif-search-input'),
  gifPickerStatus: document.getElementById('gif-picker-status'),
  gifResults: document.getElementById('gif-results'),
  attentionToast: document.getElementById('attention-toast'),
  attentionToastText: document.getElementById('attention-toast-text'),
  myPersonBadge: document.querySelector('.person-badge'),
  peerPersonBadge: document.querySelector('.peer-person'),
};

const state = {
  myName: '',
  avatar: null,
  roomCode: null,
  participantId: null,
  participants: [],
  wsClient: null,
  reconnectToken: null,
  reconnectTimer: null,
  reconnectAttempts: 0,
  closing: false,
  player: null,
  sync: null,
  currentVideoUrl: null,
  currentVideoType: null,
  pendingVideoState: null,
  loadingVideoUrl: null,
  playerLoadId: 0,
  seekBarBeingDragged: false,
  progressTimer: null,
  pendingMedia: null,
  pendingMediaName: '',
  soloMode: false,
  neutralMode: false,
  notificationsEnabled: false,
  unreadChatCount: 0,
  hiddenMessageIds: new Set(),
  attentionToastTimer: null,
  audioContext: null,
};

const SESSION_STORAGE_KEY = 'encontro-jasmym-sessions-v1';
const PROFILE_STORAGE_KEY = 'encontro-jasmym-profile-v1';
const UI_STORAGE_KEY = 'encontro-jasmym-ui-v14';
const HIDDEN_CHAT_STORAGE_KEY = 'encontro-jasmym-hidden-chat-v14';
const PROTOCOL_VERSION = 15;

function readJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}

function saveUiPreferences() {
  try {
    localStorage.setItem(UI_STORAGE_KEY, JSON.stringify({
      neutralMode: state.neutralMode,
      notificationsEnabled: state.notificationsEnabled,
    }));
  } catch {
    // Preferências continuam válidas até a aba ser fechada.
  }
}

function applyNeutralMode() {
  document.body.classList.toggle('neutral-mode', state.neutralMode);
  document.querySelectorAll('[data-neutral]').forEach((element) => {
    if (!element.dataset.defaultHtml) element.dataset.defaultHtml = element.innerHTML;
    element.innerHTML = state.neutralMode ? element.dataset.neutral : element.dataset.defaultHtml;
  });
  document.title = state.neutralMode ? 'Sala de filmes' : 'Encontro de Jasmym e Lívia';
  if (els.btnNeutralMode) {
    els.btnNeutralMode.classList.toggle('active', state.neutralMode);
    els.btnNeutralMode.setAttribute('aria-pressed', String(state.neutralMode));
    els.btnNeutralMode.textContent = state.neutralMode ? '◑ modo normal' : '◐ modo neutro';
  }
}

function notificationIsSupported() {
  return 'Notification' in window;
}

function updateNotificationButton() {
  if (!els.btnNotifications) return;
  const enabled = state.notificationsEnabled && notificationIsSupported() && Notification.permission === 'granted';
  els.btnNotifications.textContent = enabled ? '🔔' : '🔕';
  els.btnNotifications.classList.toggle('active', enabled);
  els.btnNotifications.title = enabled ? 'Desativar notificações neste aparelho' : 'Ativar notificações neste aparelho';
  els.btnNotifications.setAttribute('aria-label', els.btnNotifications.title);
}

function updateUnreadBadge() {
  const count = Math.max(0, state.unreadChatCount);
  els.chatUnreadBadge.textContent = count > 99 ? '99+' : String(count);
  els.chatUnreadBadge.classList.toggle('hidden', count === 0);
}

function chatIsOpenOnThisScreen() {
  return !matchMedia('(max-width: 720px)').matches || els.chatPanel.classList.contains('open');
}

function clearUnreadChat() {
  state.unreadChatCount = 0;
  updateUnreadBadge();
}

function maybeMarkChatUnread() {
  if (!document.hidden && chatIsOpenOnThisScreen()) return;
  state.unreadChatCount += 1;
  updateUnreadBadge();
}

function showNativeNotification(title, body) {
  if (!document.hidden || !state.notificationsEnabled || !notificationIsSupported() || Notification.permission !== 'granted') return;
  try { new Notification(title, { body }); } catch { /* navegador bloqueou */ }
}

function getAttentionAudioContext() {
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) return null;
  try {
    return state.audioContext ||= new AudioCtor();
  } catch {
    return null;
  }
}

function unlockAttentionSound() {
  const context = getAttentionAudioContext();
  if (!context || context.state === 'running') return;
  const resume = context.resume?.();
  if (resume?.then) resume.catch(() => {});
}

function playAttentionSound() {
  const context = getAttentionAudioContext();
  if (!context) return;

  const play = () => {
    if (context.state !== 'running') return;
    try {
      const startAt = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(660, startAt);
      oscillator.frequency.exponentialRampToValueAtTime(880, startAt + .13);
      gain.gain.setValueAtTime(.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(.09, startAt + .02);
      gain.gain.exponentialRampToValueAtTime(.0001, startAt + .28);
    oscillator.connect(gain).connect(context.destination);
      oscillator.start(startAt);
      oscillator.stop(startAt + .29);
    } catch {
      // O alerta visual continua disponível quando áudio automático é bloqueado.
    }
  };

  if (context.state === 'running') {
    play();
    return;
  }
  const resume = context.resume?.();
  if (resume?.then) resume.then(play).catch(() => {});
}

document.addEventListener('pointerdown', unlockAttentionSound, { passive: true });
document.addEventListener('keydown', unlockAttentionSound);

function showAttention(from = 'A outra pessoa') {
  els.attentionToastText.textContent = `${from} chamou sua atenção.`;
  els.attentionToast.classList.remove('hidden');
  clearTimeout(state.attentionToastTimer);
  state.attentionToastTimer = setTimeout(() => els.attentionToast.classList.add('hidden'), 4200);
  navigator.vibrate?.([70, 40, 120]);
  playAttentionSound();
  showNativeNotification('Chamando você', `${from} chamou sua atenção na sala.`);
}

function loadHiddenMessagesForRoom() {
  const saved = readJson(HIDDEN_CHAT_STORAGE_KEY, {});
  state.hiddenMessageIds = new Set(Array.isArray(saved[state.roomCode]) ? saved[state.roomCode] : []);
}

function saveHiddenMessagesForRoom() {
  if (!state.roomCode) return;
  try {
    const saved = readJson(HIDDEN_CHAT_STORAGE_KEY, {});
    saved[state.roomCode] = [...state.hiddenMessageIds].slice(-300);
    localStorage.setItem(HIDDEN_CHAT_STORAGE_KEY, JSON.stringify(saved));
  } catch {
    // Ocultar mensagens ainda vale durante a sessão atual.
  }
}

const savedUiPreferences = readJson(UI_STORAGE_KEY, {});
state.neutralMode = Boolean(savedUiPreferences.neutralMode);
state.notificationsEnabled = Boolean(savedUiPreferences.notificationsEnabled);
applyNeutralMode();
updateNotificationButton();
updateUnreadBadge();

function readSessions() { return readJson(SESSION_STORAGE_KEY, {}); }

function saveRoomSession(roomCode, reconnectToken, participantId) {
  if (!roomCode || !reconnectToken) return;
  const sessions = readSessions();
  sessions[roomCode] = { reconnectToken, participantId, name: state.myName };
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessions));
}

function getReconnectToken(roomCode) {
  return readSessions()[roomCode]?.reconnectToken || null;
}

function showLandingError(message) {
  els.landingError.textContent = message;
  els.landingError.classList.remove('hidden');
}

function hideLandingError() { els.landingError.classList.add('hidden'); }

function showChatError(message) {
  els.chatError.textContent = message;
  els.chatError.classList.remove('hidden');
  setTimeout(() => els.chatError.classList.add('hidden'), 3500);
}

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value || '';
  return div.innerHTML;
}

function setAvatar(element, dataUrl, fallback = '✿') {
  element.textContent = dataUrl ? '' : fallback;
  element.style.backgroundImage = dataUrl ? `url("${dataUrl}")` : '';
  element.classList.toggle('has-photo', Boolean(dataUrl));
}

function updateProfilePreview() {
  if (state.avatar) {
    els.profilePreview.src = state.avatar;
    els.profilePreview.classList.remove('hidden');
    els.profilePlaceholder.classList.add('hidden');
  } else {
    els.profilePreview.classList.add('hidden');
    els.profilePlaceholder.classList.remove('hidden');
  }
}

async function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
    reader.readAsDataURL(file);
  });
}

async function compressStillImage(file, { maxSide, quality }) {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('Formato de imagem inválido.'));
      image.src = objectUrl;
    });
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/webp', quality);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function prepareImage(file, purpose) {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowed.includes(file.type)) throw new Error('Use uma imagem JPG, PNG, WebP ou GIF.');
  if (file.size > 8 * 1024 * 1024) throw new Error('A imagem original deve ter no máximo 8 MB.');

  if (file.type === 'image/gif') {
    const maxGif = purpose === 'avatar' ? 100 * 1024 : 350 * 1024;
    if (file.size > maxGif) throw new Error(`O GIF deve ter no máximo ${purpose === 'avatar' ? '100 KB' : '350 KB'}.`);
    return fileToDataUrl(file);
  }

  const dataUrl = await compressStillImage(file, purpose === 'avatar'
    ? { maxSide: 160, quality: 0.78 }
    : { maxSide: 900, quality: 0.74 });
  const limit = purpose === 'avatar' ? 130_000 : 520_000;
  if (dataUrl.length > limit) throw new Error('A imagem ficou grande demais mesmo após a redução.');
  return dataUrl;
}

els.profileInput.addEventListener('change', async () => {
  const file = els.profileInput.files?.[0];
  if (!file) return;
  try {
    state.avatar = await prepareImage(file, 'avatar');
    try {
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify({ avatar: state.avatar }));
    } catch {
      // A foto ainda funciona nesta sessão mesmo se o navegador estiver sem
      // espaço para mantê-la após fechar a página.
    }
    updateProfilePreview();
    setAvatar(els.myAvatar, state.avatar);
    if (state.roomCode) state.wsClient?.send({ type: 'AVATAR_UPDATE', avatar: state.avatar });
  } catch (error) {
    showLandingError(error.message);
  } finally {
    els.profileInput.value = '';
  }
});

state.avatar = readJson(PROFILE_STORAGE_KEY, {})?.avatar || null;
updateProfilePreview();

els.tabBtns.forEach((button) => {
  button.addEventListener('click', () => {
    els.tabBtns.forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    const creating = button.dataset.tab === 'create';
    els.panelCreate.classList.toggle('hidden', !creating);
    els.panelJoin.classList.toggle('hidden', creating);
    hideLandingError();
  });
});

const roomFromUrl = new URLSearchParams(location.search).get('sala');
if (roomFromUrl) {
  document.querySelector('.tab-btn[data-tab="join"]').click();
  els.joinCode.value = roomFromUrl.toUpperCase();
}

async function ensureConnected() {
  if (state.wsClient?.isOpen()) return state.wsClient;
  if (!CONFIG.WS_URL || CONFIG.WS_URL.includes('SEU-BACKEND-AQUI')) {
    throw new Error('O endereço do servidor ainda não foi configurado em config.js.');
  }
  const client = new WebSocketClient(CONFIG.WS_URL);
  await client.connect();
  state.wsClient = client;
  attachRoomListeners(client);
  return client;
}

els.btnCreateRoom.addEventListener('click', async () => {
  const name = els.createName.value.trim();
  if (!name) return showLandingError('Escreva seu nome antes de criar a sala.');
  hideLandingError();
  state.myName = name;
  try {
    const client = await ensureConnected();
    client.send({ type: 'CREATE_ROOM', name, avatar: state.avatar, soloMode: state.soloMode, protocolVersion: PROTOCOL_VERSION });
  } catch (error) {
    showLandingError(error.message || 'Não foi possível conectar ao servidor.');
  }
});

els.btnJoinRoom.addEventListener('click', async () => {
  const name = els.joinName.value.trim();
  const roomCode = els.joinCode.value.trim().toUpperCase();
  if (!name) return showLandingError('Escreva seu nome antes de entrar.');
  if (!roomCode) return showLandingError('Digite o código da sala.');
  hideLandingError();
  state.myName = name;
  try {
    const client = await ensureConnected();
    client.send({
      type: 'JOIN_ROOM',
      name,
      avatar: state.avatar,
      soloMode: state.soloMode,
      roomCode,
      reconnectToken: getReconnectToken(roomCode),
      protocolVersion: PROTOCOL_VERSION,
    });
  } catch (error) {
    showLandingError(error.message || 'Não foi possível conectar ao servidor.');
  }
});

function attachRoomListeners(client) {
  const activeClient = () => state.wsClient === client;

  const entered = (message) => {
    if (!activeClient()) return;
    const enteringAnotherRoom = state.roomCode !== message.roomCode;
    state.roomCode = message.roomCode;
    state.participantId = message.participantId;
    state.reconnectToken = message.reconnectToken || getReconnectToken(message.roomCode);
    state.reconnectAttempts = 0;
    loadHiddenMessagesForRoom();
    if (enteringAnotherRoom) {
      els.chatMessages.replaceChildren();
      showChatWelcomeState();
    }
    state.sync?.replaceConnection(client);
    saveRoomSession(state.roomCode, state.reconnectToken, state.participantId);
    enterRoomScreen();
    const inviteUrl = new URL(location.href);
    inviteUrl.searchParams.set('sala', state.roomCode);
    history.replaceState({}, '', inviteUrl);
    handleRoomState(message, true);
    client.send({ type: 'REQUEST_STATE' }, { skipIfBusy: true });
  };

  client.on('ROOM_CREATED', entered);
  client.on('JOINED', entered);
  client.on('ROOM_STATE', (message) => activeClient() && handleRoomState(message));
  client.on('STATE', (message) => activeClient() && handleRoomState(message));
  client.on('HEARTBEAT', (message) => activeClient() && handleRoomState(message));
  client.on('COMMAND_ACK', (message) => activeClient() && handleRoomState(message));
  client.on('PONG', (message) => {
    if (activeClient()) state.sync?.updateClockSample(message);
  });

  // Compatibilidade curta durante a ordem de deploy backend → frontend.
  ['PLAY', 'PAUSE', 'SEEK', 'CHANGE_VIDEO'].forEach((type) => {
    client.on(type, (message) => activeClient() && handleRoomState(message));
  });

  client.on('PEER_JOINED', ({ participant, participants }) => {
    if (!activeClient()) return;
    if (participants) updateParticipants(participants);
    addSystemMessage(`${participant?.name || 'A outra pessoa'} entrou na sala.`);
  });
  client.on('PEER_LEFT', ({ participants }) => {
    if (!activeClient()) return;
    if (participants) updateParticipants(participants);
    addSystemMessage('A outra pessoa saiu. O vídeo continua neste mesmo tempo.');
  });
  client.on('CHAT_HISTORY', (message) => {
    if (!activeClient() || (message.roomCode && message.roomCode !== state.roomCode)) return;
    renderChatHistory(message.messages);
  });
  client.on('CHAT_MESSAGE', (message) => {
    if (!activeClient()) return;
    const sender = state.participants.find((person) => person.id === message.participantId);
    const mine = message.participantId === state.participantId;
    const row = addChatMessage(message.from, message.text, mine, {
      id: message.id,
      participantId: message.participantId,
      media: message.media,
      avatar: message.avatar || sender?.avatar || null,
    });
    if (!mine && row) {
      maybeMarkChatUnread();
      showNativeNotification('Nova mensagem', `${message.from || 'A outra pessoa'} enviou uma mensagem.`);
    }
  });
  client.on('CHAT_DELETE', ({ messageId }) => {
    if (!activeClient()) return;
    removeChatMessage(messageId);
  });
  client.on('ATTENTION_PING', ({ from }) => {
    if (!activeClient()) return;
    showAttention(from || 'A outra pessoa');
  });
  client.on('SOLO_MODE', ({ participantId, active, from, participants }) => {
    if (!activeClient()) return;
    if (participants) updateParticipants(participants);
    if (participantId !== state.participantId) {
      addSystemMessage(active ? `${from || 'A outra pessoa'} entrou no modo solo.` : `${from || 'A outra pessoa'} voltou a assistir em conjunto.`);
    }
  });
  client.on('ROOM_FULL', ({ message }) => {
    if (!activeClient()) return;
    showLandingError(message || 'Essa sala já tem duas pessoas.');
  });
  client.on('ERROR', ({ message }) => {
    if (!activeClient()) return;
    if (state.roomCode) showChatError(message || 'Algo deu errado.');
    else showLandingError(message || 'Algo deu errado.');
  });
  client.on('DISCONNECTED', () => {
    if (!activeClient() || state.closing) return;
    setConnectionStatus('reconectando…', 'warning');
    scheduleReconnect();
  });
}

function enterRoomScreen() {
  els.screenLanding.classList.add('hidden');
  els.screenRoom.classList.remove('hidden');
  els.roomCodeDisplay.textContent = state.roomCode;
  els.myNameDisplay.textContent = state.myName || 'Você';
  setAvatar(els.myAvatar, state.avatar);
}

function updateParticipants(participants = []) {
  state.participants = participants;
  const me = participants.find((person) => person.id === state.participantId);
  const peer = participants.find((person) => person.id !== state.participantId);
  if (me) {
    els.myNameDisplay.textContent = me.name;
    setAvatar(els.myAvatar, me.avatar || state.avatar);
    els.myPersonBadge?.classList.toggle('solo', Boolean(me.soloMode));
  }
  if (peer) {
    els.peerNameDisplay.textContent = peer.name;
    setAvatar(els.peerAvatar, peer.avatar, '❀');
    els.peerAvatar.classList.remove('waiting');
    els.peerPersonBadge?.classList.toggle('solo', Boolean(peer.soloMode));
    els.peerStatus.textContent = peer.soloMode ? `${peer.name} está em modo solo` : `${peer.name} está aqui com você`;
  } else {
    els.peerNameDisplay.textContent = 'esperando…';
    setAvatar(els.peerAvatar, null, '❀');
    els.peerAvatar.classList.add('waiting');
    els.peerPersonBadge?.classList.remove('solo');
    els.peerStatus.textContent = 'esperando a outra pessoa entrar…';
  }
}

function handleRoomState(message, force = false) {
  if (Array.isArray(message.participants)) updateParticipants(message.participants);
  if (state.soloMode) return;
  const videoState = message.videoState || (message.url ? message : null);
  if (!videoState?.url) return;
  if (!videoState.position && Number.isFinite(videoState.time)) videoState.position = videoState.time;
  state.pendingVideoState = videoState;

  if (state.currentVideoUrl !== videoState.url) {
    loadVideo(videoState.videoType || videoState.type || 'youtube', videoState.url, videoState);
  } else if (state.sync) {
    state.sync.applyAuthoritativeState(videoState, { force });
  }
}

function updateSoloModeButton() {
  els.btnSoloMode.classList.toggle('active', state.soloMode);
  els.btnSoloMode.title = state.soloMode ? 'Voltar a assistir junto' : 'Assistir em modo solo neste aparelho';
  els.btnSoloMode.setAttribute('aria-label', els.btnSoloMode.title);
}

function updatePlayerUtilityButtons() {
  const nativeVideo = state.currentVideoType === 'html5' && state.player?.video;
  els.btnPip.disabled = !nativeVideo || !document.pictureInPictureEnabled;
  els.btnPip.title = els.btnPip.disabled
    ? 'Picture in Picture disponível para MP4 e WebM neste navegador'
    : 'Abrir Picture in Picture';
  updateSoloModeButton();
}

async function loadVideo(videoType, url, initialState, { solo = false } = {}) {
  state.pendingVideoState = initialState || state.pendingVideoState;
  if (state.loadingVideoUrl === url) return;
  const loadId = ++state.playerLoadId;
  state.loadingVideoUrl = url;
  els.videoPlaceholder.classList.add('hidden');
  setConnectionStatus('carregando o vídeo…', 'working');

  state.sync?.destroy();
  state.player?.destroy();
  state.sync = null;
  state.player = null;
  state.currentVideoUrl = null;

  const PlayerClass = videoType === 'youtube' ? YoutubePlayer : Html5Player;
  const player = new PlayerClass(els.playerContainer);
  try {
    await player.load(url);
  } catch (error) {
    player.destroy();
    if (loadId === state.playerLoadId) state.loadingVideoUrl = null;
    showVideoError(error.message || 'Não foi possível carregar esse vídeo.');
    return;
  }
  if (loadId !== state.playerLoadId) return player.destroy();

  state.player = player;
  state.currentVideoUrl = url;
  state.currentVideoType = videoType;
  state.loadingVideoUrl = null;
  updatePlayerUtilityButtons();

  if (solo) {
    state.pendingVideoState = null;
    showResumePrompt(false);
    startProgressLoop();
    setConnectionStatus('modo solo neste aparelho', 'warning');
    return;
  }

  state.sync = new SyncController({
    player,
    wsClient: state.wsClient,
    videoUrl: url,
    onUpdate: updatePlayPauseIcon,
    onNeedsGesture: showResumePrompt,
  });
  const newestState = state.pendingVideoState?.url === url ? state.pendingVideoState : initialState;
  if (newestState) state.sync.applyAuthoritativeState(newestState, { force: true });
  state.pendingVideoState = null;
  state.sync.startPolling();
  startProgressLoop();
  updateSoloModeButton();
  setConnectionStatus('sincronizado com a sala', 'ok');
}

function showVideoError(message) {
  els.videoPlaceholder.classList.remove('hidden');
  els.videoPlaceholder.innerHTML = `<div class="placeholder-flower">!</div><p>${escapeHtml(message)}</p>`;
  setConnectionStatus('erro ao carregar', 'error');
}

function showResumePrompt(show) {
  els.resumeBanner.classList.toggle('hidden', !show);
  els.btnPlayPause.classList.toggle('resume-needed', show);
  if (show) setConnectionStatus('toque para liberar o vídeo neste aparelho', 'warning');
  else if (state.player) setConnectionStatus(state.soloMode ? 'modo solo neste aparelho' : 'sincronizado com a sala', state.soloMode ? 'warning' : 'ok');
}

function setConnectionStatus(text, kind = 'ok') {
  els.syncStatus.textContent = text;
  els.syncDot.className = `sync-dot ${kind}`;
}

function scheduleReconnect() {
  clearTimeout(state.reconnectTimer);
  if (!state.roomCode || state.closing) return;
  const delay = Math.min(8000, 800 * (2 ** state.reconnectAttempts));
  state.reconnectAttempts += 1;
  state.reconnectTimer = setTimeout(reconnectRoom, delay);
}

async function reconnectRoom() {
  if (!state.roomCode || state.closing) return;
  try {
    const client = new WebSocketClient(CONFIG.WS_URL);
    await client.connect();
    state.wsClient = client;
    attachRoomListeners(client);
    client.send({
      type: 'JOIN_ROOM',
      roomCode: state.roomCode,
      name: state.myName,
      avatar: state.avatar,
      soloMode: state.soloMode,
      reconnectToken: state.reconnectToken || getReconnectToken(state.roomCode),
      protocolVersion: PROTOCOL_VERSION,
    });
  } catch {
    scheduleReconnect();
  }
}

els.videoForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const url = els.videoUrlInput.value.trim();
  const videoType = els.videoTypeSelect.value;
  if (!url) return;
  if (videoType === 'html5' && !/\.(mp4|webm)(\?.*)?$/i.test(url)) {
    return showVideoError('Esse link não parece ser um MP4 ou WebM direto.');
  }
  if (state.soloMode) {
    loadVideo(videoType, url, null, { solo: true });
    els.videoUrlInput.value = '';
    return;
  }
  state.wsClient?.send({
    type: 'CHANGE_VIDEO',
    videoType,
    url,
    protocolVersion: PROTOCOL_VERSION,
    intent: 'user-control',
    commandId: `${Date.now()}-change-video`,
  });
  els.videoUrlInput.value = '';
});

function setSoloMode(active) {
  if (!state.player) return showChatError('Escolha um vídeo antes de usar o modo solo.');
  if (active === state.soloMode) return;

  if (active) {
    const position = state.sync?.expectedPosition();
    const shouldPlay = state.sync?.expectsPlayback();
    if (Number.isFinite(position)) state.player.seekTo(position);
    state.sync?.destroy();
    state.sync = null;
    state.soloMode = true;
    if (shouldPlay) state.player.play();
    state.wsClient?.send({ type: 'SOLO_MODE', active: true });
    const me = state.participants.find((person) => person.id === state.participantId);
    if (me) {
      me.soloMode = true;
      updateParticipants(state.participants);
    }
    updateSoloModeButton();
    setConnectionStatus('modo solo neste aparelho', 'warning');
    return;
  }

  state.soloMode = false;
  state.player.pause();
  state.sync?.destroy();
  state.sync = null;
  // Força a troca de volta para a fonte e o relógio oficiais da sala, mesmo
  // quando a pessoa escolheu o mesmo vídeo durante o modo solo.
  state.currentVideoUrl = null;
  state.currentVideoType = null;
  state.pendingVideoState = null;
  state.wsClient?.send({ type: 'SOLO_MODE', active: false });
  const me = state.participants.find((person) => person.id === state.participantId);
  if (me) {
    me.soloMode = false;
    updateParticipants(state.participants);
  }
  state.wsClient?.send({ type: 'REQUEST_STATE' }, { skipIfBusy: true });
  updateSoloModeButton();
  setConnectionStatus('voltando para a reprodução conjunta…', 'working');
}

function updateFullscreenButton() {
  const fullscreen = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
  els.btnFullscreen.textContent = fullscreen ? '⛶' : '⛶';
  els.btnFullscreen.title = fullscreen ? 'Sair da tela cheia' : 'Tela cheia';
  els.btnFullscreen.setAttribute('aria-label', els.btnFullscreen.title);
}

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      if (document.exitFullscreen) await document.exitFullscreen();
      else document.webkitExitFullscreen?.();
      return;
    }
    if (els.videoWrapper.requestFullscreen) {
      await els.videoWrapper.requestFullscreen();
      return;
    }
    // Safari em alguns iPhones usa apenas o fullscreen nativo do elemento de vídeo.
    state.player?.video?.webkitEnterFullscreen?.();
  } catch {
    showChatError('A tela cheia não está disponível neste navegador.');
  }
}

async function togglePictureInPicture() {
  const video = state.currentVideoType === 'html5' ? state.player?.video : null;
  if (!video || !document.pictureInPictureEnabled) {
    return showChatError('Picture in Picture funciona com vídeos MP4 ou WebM neste navegador.');
  }
  try {
    if (document.pictureInPictureElement) await document.exitPictureInPicture();
    else await video.requestPictureInPicture();
  } catch {
    showChatError('Não foi possível abrir o Picture in Picture agora.');
  }
}

function updatePlayPauseIcon() {
  if (!state.player) return;
  const playing = state.player.isPlaying();
  els.btnPlayPause.textContent = playing ? 'Ⅱ' : '▶';
  els.btnPlayPause.title = playing ? 'Pausar' : 'Reproduzir';
  els.btnPlayPause.setAttribute('aria-label', els.btnPlayPause.title);
}

function togglePlayback() {
  if (!state.player) return;
  if (state.soloMode) {
    if (state.player.isPlaying()) state.player.pause();
    else state.player.play();
    setTimeout(updatePlayPauseIcon, 150);
    return;
  }
  if (!state.sync) return;
  if (state.player.isPlaying()) state.sync.localPause();
  else state.sync.localPlay();
  setTimeout(updatePlayPauseIcon, 150);
}

els.btnPlayPause.addEventListener('click', togglePlayback);
els.btnSoloMode.addEventListener('click', () => setSoloMode(!state.soloMode));
els.btnFullscreen.addEventListener('click', toggleFullscreen);
els.btnPip.addEventListener('click', togglePictureInPicture);
document.addEventListener('fullscreenchange', updateFullscreenButton);
document.addEventListener('webkitfullscreenchange', updateFullscreenButton);
els.resumeBanner.addEventListener('click', () => {
  state.sync?.localPlay();
  setTimeout(updatePlayPauseIcon, 200);
});
els.btnBack10.addEventListener('click', () => {
  if (state.soloMode && state.player) return state.player.seekTo(Math.max(0, state.player.getCurrentTime() - 10));
  if (!state.sync) return;
  state.sync.localSeek(Math.max(0, state.sync.expectedPosition() - 10));
});
els.btnFwd10.addEventListener('click', () => {
  if (state.soloMode && state.player) return state.player.seekTo(state.player.getCurrentTime() + 10);
  if (!state.sync) return;
  state.sync.localSeek(state.sync.expectedPosition() + 10);
});
els.seekBar.addEventListener('input', () => { state.seekBarBeingDragged = true; });
els.seekBar.addEventListener('change', () => {
  if (state.soloMode) state.player?.seekTo(Number(els.seekBar.value));
  else state.sync?.localSeek(Number(els.seekBar.value));
  state.seekBarBeingDragged = false;
});

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

function startProgressLoop() {
  clearTimeout(state.progressTimer);
  const updateProgress = () => {
    if (!state.player) return;
    const actual = state.player.getCurrentTime();
    const current = state.sync?.expectsPlayback() && !state.player.isPlaying()
      ? state.sync.expectedPosition()
      : actual;
    const duration = state.player.getDuration();
    if (!state.seekBarBeingDragged) {
      els.seekBar.max = duration || Math.max(1, current);
      els.seekBar.value = Math.min(current || 0, duration || current || 0);
    }
    els.timeDisplay.textContent = `${formatTime(current)} / ${formatTime(duration)}`;
    updatePlayPauseIcon();
    state.progressTimer = setTimeout(updateProgress, document.hidden ? 2000 : 400);
  };
  updateProgress();
}

els.btnCopyLink.addEventListener('click', async () => {
  const link = `${location.origin}${location.pathname}?sala=${state.roomCode}`;
  try {
    await navigator.clipboard.writeText(link);
    const oldText = els.btnCopyLink.innerHTML;
    els.btnCopyLink.textContent = 'link copiado ✿';
    setTimeout(() => { els.btnCopyLink.innerHTML = oldText; }, 1800);
  } catch {
    prompt('Copie o link da sala:', link);
  }
});

function createAvatarElement(avatar, fallback = '✿') {
  const element = document.createElement('span');
  element.className = 'message-avatar';
  setAvatar(element, avatar, fallback);
  return element;
}

function removeChatEmptyStates() {
  els.chatMessages.querySelectorAll('.chat-welcome, .chat-empty-local').forEach((element) => element.remove());
}

function showChatWelcomeState() {
  if (els.chatMessages.querySelector('.chat-row, .chat-welcome, .chat-empty-local')) return;
  const element = document.createElement('div');
  element.className = 'chat-welcome';
  const icon = document.createElement('span');
  icon.textContent = '❀';
  const text = document.createElement('p');
  text.textContent = 'Mensagens, fotos e GIFs aparecem aqui.';
  element.append(icon, text);
  els.chatMessages.appendChild(element);
}

function showChatEmptyState() {
  if (els.chatMessages.querySelector('.chat-row') || els.chatMessages.querySelector('.chat-empty-local')) return;
  els.chatMessages.querySelector('.chat-welcome')?.remove();
  const element = document.createElement('div');
  element.className = 'chat-empty-local';
  element.textContent = 'As mensagens foram ocultadas somente nesta tela.';
  els.chatMessages.appendChild(element);
}

function findChatMessageRow(messageId) {
  if (!messageId) return null;
  return [...els.chatMessages.querySelectorAll('.chat-row[data-message-id]')]
    .find((row) => row.dataset.messageId === messageId) || null;
}

function removeChatMessage(messageId) {
  if (!messageId) return;
  findChatMessageRow(messageId)?.remove();
  if (!els.chatMessages.querySelector('.chat-row') && !els.chatMessages.querySelector('.chat-empty-local')) {
    showChatWelcomeState();
  }
}

function renderChatHistory(messages) {
  const history = Array.isArray(messages) ? messages : [];
  els.chatMessages.replaceChildren();
  let visibleMessages = 0;
  for (const message of history) {
    if (!message || typeof message !== 'object') continue;
    const sender = state.participants.find((person) => person.id === message.participantId);
    const row = addChatMessage(message.from, message.text, message.participantId === state.participantId, {
      id: message.id,
      participantId: message.participantId,
      media: message.media,
      avatar: message.avatar || sender?.avatar || null,
    });
    if (row) visibleMessages += 1;
  }
  if (!visibleMessages) {
    if (history.length) showChatEmptyState();
    else showChatWelcomeState();
  }
}

function deleteChatMessageForMe(messageId, row) {
  if (messageId) {
    state.hiddenMessageIds.add(messageId);
    saveHiddenMessagesForRoom();
  }
  row?.remove();
  showChatEmptyState();
}

function openChatMessageMenu(trigger, { messageId, mine, row }) {
  document.querySelectorAll('.chat-message-menu-panel').forEach((element) => element.remove());
  const panel = document.createElement('div');
  panel.className = 'chat-message-menu-panel';

  const addAction = (label, callback, danger = false) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    if (danger) button.classList.add('danger');
    button.addEventListener('click', () => {
      panel.remove();
      callback();
    });
    panel.appendChild(button);
  };

  addAction('Apagar para mim', () => deleteChatMessageForMe(messageId, row));
  if (mine) {
    addAction('Apagar para todos', () => {
      const sent = state.wsClient?.send({ type: 'CHAT_DELETE', messageId });
      if (!sent) showChatError('A conexão caiu antes de apagar a mensagem.');
    }, true);
  }

  const rect = trigger.getBoundingClientRect();
  document.body.appendChild(panel);
  const panelWidth = panel.getBoundingClientRect().width;
  panel.style.top = `${Math.max(8, rect.bottom + 4)}px`;
  panel.style.left = `${Math.max(8, Math.min(innerWidth - panelWidth - 8, rect.right - panelWidth))}px`;
  const dismiss = (event) => {
    if (panel.contains(event.target) || event.target === trigger) return;
    panel.remove();
    document.removeEventListener('pointerdown', dismiss, true);
  };
  setTimeout(() => document.addEventListener('pointerdown', dismiss, true), 0);
}

function addChatMessage(author, text, mine, { id = null, participantId = null, media = null, avatar = null } = {}) {
  if (id) {
    const existing = findChatMessageRow(id);
    if (existing) return existing;
    if (state.hiddenMessageIds.has(id)) return null;
  }
  removeChatEmptyStates();
  const row = document.createElement('div');
  row.className = `chat-row ${mine ? 'mine' : 'theirs'}`;
  if (id) row.dataset.messageId = id;
  row.appendChild(createAvatarElement(avatar, mine ? '✿' : '❀'));

  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble';
  const authorElement = document.createElement('span');
  authorElement.className = 'chat-author';
  authorElement.textContent = author;
  bubble.appendChild(authorElement);
  if (media) {
    const image = document.createElement('img');
    image.className = 'chat-media';
    image.src = media;
    image.alt = `Imagem enviada por ${author}`;
    bubble.appendChild(image);
  }
  if (text) {
    const paragraph = document.createElement('p');
    paragraph.textContent = text;
    bubble.appendChild(paragraph);
  }
  row.appendChild(bubble);
  if (id) {
    const actions = document.createElement('div');
    actions.className = 'chat-message-actions';
    const menuButton = document.createElement('button');
    menuButton.type = 'button';
    menuButton.className = 'chat-message-menu';
    menuButton.textContent = '⋯';
    menuButton.title = 'Opções da mensagem';
    menuButton.setAttribute('aria-label', 'Opções da mensagem');
    menuButton.addEventListener('click', () => openChatMessageMenu(menuButton, { messageId: id, mine, row }));
    actions.appendChild(menuButton);
    row.appendChild(actions);
  }
  els.chatMessages.appendChild(row);
  els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
  return row;
}

function addSystemMessage(text) {
  removeChatEmptyStates();
  const element = document.createElement('div');
  element.className = 'chat-system';
  element.textContent = `❦ ${text}`;
  els.chatMessages.appendChild(element);
  els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
}

function setPendingMedia(media, label) {
  state.pendingMedia = media;
  state.pendingMediaName = label;
  els.mediaPreview.src = media;
  els.mediaPreviewName.textContent = label;
  els.mediaPreviewBar.classList.remove('hidden');
}

els.chatMediaInput.addEventListener('change', async () => {
  const file = els.chatMediaInput.files?.[0];
  if (!file) return;
  try {
    const media = await prepareImage(file, 'chat');
    setPendingMedia(media, file.type === 'image/gif' ? 'GIF pronto' : file.name);
  } catch (error) {
    showChatError(error.message);
  } finally {
    els.chatMediaInput.value = '';
  }
});

function clearPendingMedia() {
  state.pendingMedia = null;
  state.pendingMediaName = '';
  els.mediaPreview.removeAttribute('src');
  els.mediaPreviewBar.classList.add('hidden');
}
els.btnRemoveMedia.addEventListener('click', clearPendingMedia);

els.chatForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const text = els.chatInput.value.trim();
  const media = state.pendingMedia;
  if (!text && !media) return;
  const messageId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const sent = state.wsClient?.send({ type: 'CHAT_MESSAGE', messageId, text, media });
  if (!sent) return showChatError('A conexão caiu antes de enviar. Tente novamente.');
  addChatMessage(state.myName, text, true, { id: messageId, participantId: state.participantId, media, avatar: state.avatar });
  els.chatInput.value = '';
  clearPendingMedia();
});

function openChat() {
  els.chatPanel.classList.add('open');
  clearUnreadChat();
  setTimeout(() => els.chatInput.focus(), 120);
}

function closeChat() { els.chatPanel.classList.remove('open'); }

els.btnToggleChat.addEventListener('click', openChat);
els.btnCloseChat.addEventListener('click', () => els.chatPanel.classList.remove('open'));

els.btnClearChatForMe.addEventListener('click', () => {
  if (!confirm('Apagar todas as mensagens somente desta tela? A outra pessoa continuará vendo as mensagens.')) return;
  els.chatMessages.querySelectorAll('.chat-row[data-message-id]').forEach((row) => {
    if (row.dataset.messageId) state.hiddenMessageIds.add(row.dataset.messageId);
  });
  els.chatMessages.replaceChildren();
  saveHiddenMessagesForRoom();
  showChatEmptyState();
});

els.btnNotifications.addEventListener('click', async () => {
  if (!notificationIsSupported()) return showChatError('Este navegador não oferece notificações.');
  if (Notification.permission === 'granted') {
    state.notificationsEnabled = !state.notificationsEnabled;
  } else {
    const permission = await Notification.requestPermission();
    state.notificationsEnabled = permission === 'granted';
    if (!state.notificationsEnabled) showChatError('As notificações não foram autorizadas neste aparelho.');
  }
  saveUiPreferences();
  updateNotificationButton();
});

els.btnAttentionPing.addEventListener('click', () => {
  const sent = state.wsClient?.send({ type: 'ATTENTION_PING' });
  if (!sent) showChatError('A conexão caiu antes de enviar o aviso.');
});

els.btnNeutralMode.addEventListener('click', () => {
  state.neutralMode = !state.neutralMode;
  saveUiPreferences();
  applyNeutralMode();
});

function openGifPicker() {
  els.gifPicker.classList.remove('hidden');
  els.gifPickerStatus.textContent = CONFIG.GIPHY_API_KEY?.trim()
    ? 'Pesquise uma reação para escolher um GIF.'
    : 'A busca de GIFs precisa de uma chave do GIPHY em config.js.';
  setTimeout(() => els.gifSearchInput.focus(), 0);
}

function closeGifPicker() { els.gifPicker.classList.add('hidden'); }

function renderGifResults(gifs) {
  els.gifResults.replaceChildren();
  for (const gif of gifs) {
    const media = gif.images?.fixed_width_small?.url || gif.images?.fixed_width?.url || gif.images?.original?.url;
    if (!media || !media.startsWith('https://')) continue;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'gif-result';
    button.title = 'Enviar este GIF';
    const image = document.createElement('img');
    image.src = media;
    image.alt = gif.title || 'GIF';
    image.loading = 'lazy';
    button.appendChild(image);
    button.addEventListener('click', () => {
      setPendingMedia(media, 'GIF da web');
      closeGifPicker();
      els.chatInput.focus();
    });
    els.gifResults.appendChild(button);
  }
  if (!els.gifResults.childElementCount) els.gifPickerStatus.textContent = 'Nenhum GIF seguro foi encontrado para essa busca.';
}

async function searchGifs() {
  const query = els.gifSearchInput.value.trim();
  if (!query) return;
  const apiKey = CONFIG.GIPHY_API_KEY?.trim();
  if (!apiKey) return openGifPicker();
  els.gifPickerStatus.textContent = 'Pesquisando GIFs…';
  els.gifResults.replaceChildren();
  try {
    const params = new URLSearchParams({
      api_key: apiKey,
      q: query,
      limit: String(Math.min(25, Math.max(1, CONFIG.GIPHY_LIMIT || 18))),
      rating: CONFIG.GIPHY_RATING || 'g',
      lang: 'pt',
      bundle: 'messaging_non_clips',
    });
    const response = await fetch(`https://api.giphy.com/v1/gifs/search?${params}`);
    if (!response.ok) throw new Error('A busca de GIFs falhou.');
    const payload = await response.json();
    const gifs = Array.isArray(payload.data) ? payload.data : [];
    els.gifPickerStatus.textContent = gifs.length ? 'Toque em um GIF para anexá-lo à mensagem.' : 'Nenhum GIF foi encontrado.';
    renderGifResults(gifs);
  } catch {
    els.gifPickerStatus.textContent = 'Não foi possível pesquisar GIFs agora. Confira a chave e a conexão.';
  }
}

els.btnOpenGif.addEventListener('click', openGifPicker);
els.btnCloseGif.addEventListener('click', closeGifPicker);
els.gifPicker.addEventListener('click', (event) => { if (event.target === els.gifPicker) closeGifPicker(); });
els.gifSearchForm.addEventListener('submit', (event) => { event.preventDefault(); searchGifs(); });
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !els.gifPicker.classList.contains('hidden')) closeGifPicker();
});

(function setupChatResize() {
  const handle = document.getElementById('chat-resize-handle');
  if (!handle) return;
  const presets = [32, 52, 84];
  let preset = 0;
  let dragging = false;
  let moved = false;
  let startY = 0;
  let startHeight = 0;
  handle.addEventListener('pointerdown', (event) => {
    dragging = true;
    moved = false;
    startY = event.clientY;
    startHeight = els.chatPanel.getBoundingClientRect().height;
    handle.setPointerCapture?.(event.pointerId);
  });
  addEventListener('pointermove', (event) => {
    if (!dragging) return;
    const delta = startY - event.clientY;
    if (Math.abs(delta) > 6) moved = true;
    const vh = Math.min(92, Math.max(24, ((startHeight + delta) / innerHeight) * 100));
    els.chatPanel.style.setProperty('--chat-height', `${vh}vh`);
  });
  addEventListener('pointerup', () => {
    if (!dragging) return;
    dragging = false;
    if (!moved) {
      preset = (preset + 1) % presets.length;
      els.chatPanel.style.setProperty('--chat-height', `${presets[preset]}vh`);
    }
  });
})();

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && chatIsOpenOnThisScreen()) clearUnreadChat();
  if (!document.hidden && state.roomCode) {
    if (state.wsClient?.isOpen()) {
      state.wsClient.send({ type: 'REQUEST_STATE' }, { skipIfBusy: true });
      state.sync?.requestTimeSync();
    }
    else scheduleReconnect();
  }
});

updateFullscreenButton();

window.addEventListener('beforeunload', () => {
  state.closing = true;
  state.sync?.destroy();
});
