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
  btnLeaveRoom: document.getElementById('btn-leave-room'),
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
  fullscreenGestureHint: document.getElementById('fullscreen-gesture-hint'),
  btnExitFullscreen: document.getElementById('btn-exit-fullscreen'),
  btnDiscussMoment: document.getElementById('btn-discuss-moment'),
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
  replyPreviewBar: document.getElementById('reply-preview-bar'),
  replyPreviewText: document.getElementById('reply-preview-text'),
  btnCancelReply: document.getElementById('btn-cancel-reply'),
  chatError: document.getElementById('chat-error'),
  btnToggleChat: document.getElementById('btn-toggle-chat'),
  btnCloseChat: document.getElementById('btn-close-chat'),
  btnNotifications: document.getElementById('btn-notifications'),
  notificationIcon: document.getElementById('notification-icon'),
  chatNotificationDot: document.getElementById('chat-notification-dot'),
  btnAttentionPing: document.getElementById('btn-attention-ping'),
  settingsModal: document.getElementById('settings-modal'),
  btnCloseSettings: document.getElementById('btn-close-settings'),
  themeSelect: document.getElementById('theme-select'),
  btnSettingsChat: document.getElementById('btn-settings-chat'),
  btnSettingsFullscreen: document.getElementById('btn-settings-fullscreen'),
  btnSettingsPip: document.getElementById('btn-settings-pip'),
  reconnectModal: document.getElementById('reconnect-modal'),
  reconnectMessage: document.getElementById('reconnect-message'),
  btnReconnectNow: document.getElementById('btn-reconnect-now'),
  btnSkipReconnect: document.getElementById('btn-skip-reconnect'),
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
  reconnectChoiceTimer: null,
  reconnectAttempts: 0,
  pendingRejoin: null,
  landingBusy: false,
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
  theme: 'encontro',
  replyTo: null,
  notificationsEnabled: false,
  unreadChatCount: 0,
  chatArrivalActive: false,
  chatArrivalTimer: null,
  readMessageIds: new Set(),
  hiddenMessageIds: new Set(),
  attentionToastTimer: null,
  fullscreenHintTimer: null,
  audioContext: null,
};

const SESSION_STORAGE_KEY = 'encontro-jasmym-sessions-v1';
const PROFILE_STORAGE_KEY = 'encontro-jasmym-profile-v1';
const UI_STORAGE_KEY = 'encontro-jasmym-ui-v15';
const HIDDEN_CHAT_STORAGE_KEY = 'encontro-jasmym-hidden-chat-v14';
const PROTOCOL_VERSION = 16;
const DEFAULT_VIDEO_PLACEHOLDER_HTML = els.videoPlaceholder.innerHTML;

function readJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}

function saveUiPreferences() {
  try {
    localStorage.setItem(UI_STORAGE_KEY, JSON.stringify({
      neutralMode: state.neutralMode,
      theme: state.theme,
      notificationsEnabled: state.notificationsEnabled,
    }));
  } catch {
    // Preferências continuam válidas até a aba ser fechada.
  }
}

function applyNeutralMode() {
  state.neutralMode = state.theme === 'neutral';
  document.body.classList.toggle('neutral-mode', state.neutralMode);
  document.body.dataset.theme = state.theme;
  document.querySelectorAll('[data-neutral]').forEach((element) => {
    if (!element.dataset.defaultHtml) element.dataset.defaultHtml = element.innerHTML;
    element.innerHTML = state.neutralMode ? element.dataset.neutral : element.dataset.defaultHtml;
  });
  document.title = state.neutralMode ? 'Sala de filmes' : 'Encontro de Jasmym e Lívia';
  if (els.btnNeutralMode) {
    els.btnNeutralMode.classList.toggle('active', state.theme !== 'encontro');
    els.btnNeutralMode.textContent = '⚙ configurações';
  }
  if (els.themeSelect) els.themeSelect.value = state.theme;
}

function notificationIsSupported() {
  return 'Notification' in window;
}

function updateNotificationButton() {
  if (!els.btnNotifications) return;
  const enabled = state.notificationsEnabled && notificationIsSupported() && Notification.permission === 'granted';
  if (els.notificationIcon) els.notificationIcon.textContent = enabled ? '🔔' : '🔕';
  els.btnNotifications.classList.toggle('active', enabled);
  els.btnNotifications.title = enabled ? 'Desativar notificações neste aparelho' : 'Ativar notificações neste aparelho';
  els.btnNotifications.setAttribute('aria-label', els.btnNotifications.title);
}

function updateUnreadBadge() {
  const count = Math.max(0, state.unreadChatCount);
  els.chatUnreadBadge.textContent = count > 99 ? '99+' : String(count);
  els.chatUnreadBadge.classList.toggle('hidden', count === 0);
  const showVisualAlert = count > 0 || state.chatArrivalActive;
  els.chatNotificationDot?.classList.toggle('hidden', !showVisualAlert);
  els.btnNotifications?.classList.toggle('has-unread', showVisualAlert);
}

function showChatArrivalAlert() {
  state.chatArrivalActive = true;
  els.btnNotifications?.classList.add('message-arrived');
  clearTimeout(state.chatArrivalTimer);
  updateUnreadBadge();
  state.chatArrivalTimer = setTimeout(() => {
    state.chatArrivalActive = false;
    els.btnNotifications?.classList.remove('message-arrived');
    updateUnreadBadge();
  }, 3200);
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
state.theme = savedUiPreferences.theme || (savedUiPreferences.neutralMode ? 'neutral' : 'encontro');
state.notificationsEnabled = Boolean(savedUiPreferences.notificationsEnabled);
applyNeutralMode();
updateNotificationButton();
updateUnreadBadge();

function readSessions() { return readJson(SESSION_STORAGE_KEY, {}); }

function saveRoomSession(roomCode, reconnectToken, participantId) {
  if (!roomCode || !reconnectToken) return;
  const sessions = readSessions();
  sessions[roomCode] = { reconnectToken, participantId, name: state.myName, savedAt: Date.now() };
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessions));
}

function getReconnectToken(roomCode) {
  return readSessions()[roomCode]?.reconnectToken || null;
}

function clearRoomSession(roomCode) {
  if (!roomCode) return;
  try {
    const sessions = readSessions();
    delete sessions[roomCode];
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    // Se o navegador não permitir gravar agora, a saída ainda vale nesta aba.
  }
}

function setLandingBusy(button, busy) {
  const buttons = [els.btnCreateRoom, els.btnJoinRoom];
  state.landingBusy = busy;
  buttons.forEach((item) => {
    if (!item.dataset.defaultHtml) item.dataset.defaultHtml = item.innerHTML;
    item.disabled = busy;
    if (busy && item === button) item.textContent = 'Conectando…';
    if (!busy) item.innerHTML = item.dataset.defaultHtml;
  });
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
  if (state.landingBusy) return;
  const name = els.createName.value.trim();
  if (!name) return showLandingError('Escreva seu nome antes de criar a sala.');
  hideLandingError();
  state.closing = false;
  state.myName = name;
  setLandingBusy(els.btnCreateRoom, true);
  try {
    const client = await ensureConnected();
    const sent = client.send({ type: 'CREATE_ROOM', name, avatar: state.avatar, soloMode: state.soloMode, protocolVersion: PROTOCOL_VERSION });
    if (!sent) throw new Error('A conexão caiu antes de criar a sala.');
  } catch (error) {
    setLandingBusy(null, false);
    showLandingError(error.message || 'Não foi possível conectar ao servidor.');
  }
});

els.btnJoinRoom.addEventListener('click', async () => {
  if (state.landingBusy) return;
  const name = els.joinName.value.trim();
  const roomCode = els.joinCode.value.trim().toUpperCase();
  if (!name) return showLandingError('Escreva seu nome antes de entrar.');
  if (!roomCode) return showLandingError('Digite o código da sala.');
  hideLandingError();
  state.closing = false;
  state.myName = name;
  setLandingBusy(els.btnJoinRoom, true);
  try {
    const client = await ensureConnected();
    const sent = client.send({
      type: 'JOIN_ROOM',
      name,
      avatar: state.avatar,
      soloMode: state.soloMode,
      roomCode,
      reconnectToken: getReconnectToken(roomCode),
      protocolVersion: PROTOCOL_VERSION,
    });
    if (!sent) throw new Error('A conexão caiu antes de entrar na sala.');
  } catch (error) {
    setLandingBusy(null, false);
    showLandingError(error.message || 'Não foi possível conectar ao servidor.');
  }
});

function attachRoomListeners(client) {
  const activeClient = () => state.wsClient === client;

  const entered = (message) => {
    if (!activeClient()) return;
    setLandingBusy(null, false);
    const enteringAnotherRoom = state.roomCode !== message.roomCode;
    state.roomCode = message.roomCode;
    state.participantId = message.participantId;
    state.reconnectToken = message.reconnectToken || getReconnectToken(message.roomCode);
    state.reconnectAttempts = 0;
    loadHiddenMessagesForRoom();
    if (enteringAnotherRoom) {
      state.readMessageIds.clear();
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
    markVisibleIncomingMessagesRead();
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
      replyTo: message.replyTo,
      readBy: message.readBy,
    });
    if (!mine && row) {
      showChatArrivalAlert();
      maybeMarkChatUnread();
      showNativeNotification('Nova mensagem', `${message.from || 'A outra pessoa'} enviou uma mensagem.`);
      markChatMessageRead(message.id, message.participantId);
    }
  });
  client.on('CHAT_READ', ({ messageId, readBy }) => {
    if (!activeClient() || !messageId) return;
    if (Array.isArray(readBy) && readBy.some((id) => id && id !== state.participantId)) {
      state.readMessageIds.add(messageId);
    }
    updateChatMessageReadStatus(messageId, readBy);
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
    setLandingBusy(null, false);
    showLandingError(message || 'Essa sala já tem duas pessoas.');
  });
  client.on('ERROR', ({ message }) => {
    if (!activeClient()) return;
    if (!state.roomCode) setLandingBusy(null, false);
    if (state.roomCode) showChatError(message || 'Algo deu errado.');
    else showLandingError(message || 'Algo deu errado.');
  });
  client.on('DISCONNECTED', () => {
    if (!activeClient() || state.closing) return;
    if (!state.roomCode) setLandingBusy(null, false);
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

function handlePlayerEnded(player) {
  if (state.player !== player) return;
  updatePlayPauseIcon();
  if (!state.soloMode && state.sync?.expectsPlayback()) {
    // O fim também precisa virar uma pausa oficial. Sem isso, o relógio da
    // sala continua avançando e pode mandar o player de volta ao fim do vídeo.
    state.sync.localPause();
  }
  setConnectionStatus('vídeo terminou', 'ok');
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
  let endAlreadyReported = false;
  player.onStateChange?.(({ type }) => {
    if (type === 'play') endAlreadyReported = false;
    if (type === 'ended' && !endAlreadyReported) {
      endAlreadyReported = true;
      handlePlayerEnded(player);
    }
  });
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

function fullscreenIsActive() {
  return document.body.classList.contains('cinema-mode')
    || Boolean(document.fullscreenElement || document.webkitFullscreenElement);
}

function shouldUseCinemaMode() {
  return matchMedia('(max-width: 720px), (pointer: coarse)').matches;
}

function hideFullscreenGestureHint() {
  clearTimeout(state.fullscreenHintTimer);
  state.fullscreenHintTimer = null;
  els.fullscreenGestureHint?.classList.add('hidden');
}

function showFullscreenGestureHint(duration = 3000) {
  if (!fullscreenIsActive() || !els.fullscreenGestureHint) return;
  clearTimeout(state.fullscreenHintTimer);
  els.fullscreenGestureHint.classList.remove('hidden');
  if (duration > 0) {
    state.fullscreenHintTimer = setTimeout(hideFullscreenGestureHint, duration);
  }
}

function updateFullscreenButton() {
  const fullscreen = fullscreenIsActive();
  els.btnFullscreen.textContent = fullscreen ? '⤢' : '⛶';
  els.btnFullscreen.title = fullscreen ? 'Sair da tela cheia' : 'Tela cheia';
  els.btnFullscreen.setAttribute('aria-label', els.btnFullscreen.title);
}

async function exitFullscreenView() {
  const hadCinemaMode = document.body.classList.contains('cinema-mode');
  document.body.classList.remove('cinema-mode');
  hideFullscreenGestureHint();
  try {
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      if (document.exitFullscreen) await document.exitFullscreen();
      else document.webkitExitFullscreen?.();
    }
  } catch {
    if (!hadCinemaMode) showChatError('Não foi possível sair da tela cheia agora.');
  } finally {
    updateFullscreenButton();
  }
}

async function toggleFullscreen() {
  if (fullscreenIsActive()) {
    await exitFullscreenView();
    return;
  }
  // No celular o modo cinema ocupa toda a viewport, mas continua na página:
  // assim o gesto pode revelar o chat sem tocar no relógio do vídeo.
  if (shouldUseCinemaMode()) {
    document.body.classList.add('cinema-mode');
    updateFullscreenButton();
    showFullscreenGestureHint();
    return;
  }
  try {
    if (els.videoWrapper.requestFullscreen) {
      await els.videoWrapper.requestFullscreen();
      showFullscreenGestureHint();
      return;
    }
  } catch {
    // Alguns navegadores não liberam a API de tela cheia. O modo cinema
    // mantém o mesmo visual e os controles de gesto funcionando.
  }
  document.body.classList.add('cinema-mode');
  updateFullscreenButton();
  showFullscreenGestureHint();
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
const handleFullscreenChange = () => {
  updateFullscreenButton();
  if (fullscreenIsActive()) showFullscreenGestureHint();
  else hideFullscreenGestureHint();
};
document.addEventListener('fullscreenchange', handleFullscreenChange);
document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

function videoWrapperIsFullscreen() {
  return document.body.classList.contains('cinema-mode')
    || document.fullscreenElement === els.videoWrapper
    || document.webkitFullscreenElement === els.videoWrapper;
}

let fullscreenSwipe = null;
els.videoWrapper.addEventListener('pointerdown', (event) => {
  if (!videoWrapperIsFullscreen() || event.target.closest?.('button, input, select, textarea, a')) return;
  fullscreenSwipe = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
  try { els.videoWrapper.setPointerCapture?.(event.pointerId); } catch { /* navegador já capturou ou recusou */ }
  // Tocar no vídeo em tela cheia só revela a dica; não altera play/pause nem
  // dispara uma sincronização antiga por acidente.
  event.preventDefault();
});
els.videoWrapper.addEventListener('pointerup', async (event) => {
  if (!fullscreenSwipe || fullscreenSwipe.pointerId !== event.pointerId) return;
  const deltaX = event.clientX - fullscreenSwipe.x;
  const deltaY = event.clientY - fullscreenSwipe.y;
  fullscreenSwipe = null;
  try {
    if (els.videoWrapper.hasPointerCapture?.(event.pointerId)) els.videoWrapper.releasePointerCapture?.(event.pointerId);
  } catch { /* a captura pode ter sido liberada pelo navegador */ }
  if (deltaX <= -48 && Math.abs(deltaX) > Math.abs(deltaY)) {
    hideFullscreenGestureHint();
    if (document.body.classList.contains('cinema-mode')) {
      openChat({ focus: false });
    } else {
      await exitFullscreenView();
      openChat({ focus: false });
    }
  } else if (Math.abs(deltaX) < 12 && Math.abs(deltaY) < 12) {
    showFullscreenGestureHint(2200);
  }
  event.preventDefault();
});
els.videoWrapper.addEventListener('pointercancel', () => { fullscreenSwipe = null; });
els.btnExitFullscreen?.addEventListener('click', (event) => {
  event.stopPropagation();
  exitFullscreenView();
});
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

function removeRoomFromAddress() {
  const url = new URL(location.href);
  url.searchParams.delete('sala');
  history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}

function leaveCurrentRoom() {
  if (!state.roomCode) return;
  const previousName = state.myName;
  const client = state.wsClient;
  const roomCode = state.roomCode;
  state.closing = true;
  clearTimeout(state.reconnectTimer);
  clearTimeout(state.reconnectChoiceTimer);
  clearTimeout(state.progressTimer);
  clearRoomSession(roomCode);
  client?.send({ type: 'LEAVE_ROOM' });
  client?.disconnect();
  state.wsClient = null;
  state.sync?.destroy();
  state.player?.destroy();
  state.sync = null;
  state.player = null;
  state.playerLoadId += 1;
  state.currentVideoUrl = null;
  state.currentVideoType = null;
  state.pendingVideoState = null;
  state.loadingVideoUrl = null;
  state.roomCode = null;
  state.participantId = null;
  state.reconnectToken = null;
  state.participants = [];
  state.soloMode = false;
  state.hiddenMessageIds = new Set();
  state.myName = '';
  els.playerContainer.replaceChildren();
  els.videoPlaceholder.innerHTML = DEFAULT_VIDEO_PLACEHOLDER_HTML;
  els.videoPlaceholder.classList.remove('hidden');
  els.resumeBanner.classList.add('hidden');
  els.chatMessages.replaceChildren();
  showChatWelcomeState();
  closeChat();
  clearPendingMedia();
  clearReplyTo();
  updateParticipants([]);
  updatePlayerUtilityButtons();
  setConnectionStatus('sincronização pronta', 'ok');
  els.createName.value = previousName;
  els.joinName.value = previousName;
  els.screenRoom.classList.add('hidden');
  els.screenLanding.classList.remove('hidden');
  document.querySelector('.tab-btn[data-tab="create"]')?.click();
  removeRoomFromAddress();
  state.closing = false;
}

els.btnLeaveRoom.addEventListener('click', leaveCurrentRoom);

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

function peerHasReadMessage(readBy) {
  return Array.isArray(readBy) && readBy.some((id) => id && id !== state.participantId);
}

function updateChatMessageReadStatus(messageId, readBy = []) {
  if (!messageId) return;
  if (peerHasReadMessage(readBy)) state.readMessageIds.add(messageId);
  const row = findChatMessageRow(messageId);
  if (!row || !row.classList.contains('mine')) return;
  const status = row.querySelector('.chat-message-status');
  if (!status) return;
  const seen = state.readMessageIds.has(messageId) || peerHasReadMessage(readBy);
  status.textContent = seen ? '✓✓ Visto' : '✓ Enviada';
  status.classList.toggle('seen', seen);
}

function markChatMessageRead(messageId, participantId) {
  if (!messageId || participantId === state.participantId || document.hidden || !chatIsOpenOnThisScreen()) return;
  const row = findChatMessageRow(messageId);
  if (!row || row.dataset.readReceiptSent === 'true') return;
  row.dataset.readReceiptSent = 'true';
  state.wsClient?.send({ type: 'CHAT_READ', messageId });
}

function markVisibleIncomingMessagesRead() {
  if (document.hidden || !chatIsOpenOnThisScreen()) return;
  els.chatMessages.querySelectorAll('.chat-row.theirs[data-message-id]').forEach((row) => {
    markChatMessageRead(row.dataset.messageId, row.dataset.participantId);
  });
}

function removeChatMessage(messageId) {
  if (!messageId) return;
  state.readMessageIds.delete(messageId);
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
      replyTo: message.replyTo,
      readBy: message.readBy,
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

function openChatMessageMenu(trigger, { messageId, mine, row, author, text }) {
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

  addAction('Responder', () => setReplyTo({ id: messageId, from: author, text }));
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

function addChatMessage(author, text, mine, { id = null, participantId = null, media = null, avatar = null, replyTo = null, readBy = [] } = {}) {
  if (id) {
    const existing = findChatMessageRow(id);
    if (existing) {
      updateChatMessageReadStatus(id, readBy);
      return existing;
    }
    if (state.hiddenMessageIds.has(id)) return null;
  }
  removeChatEmptyStates();
  const row = document.createElement('div');
  row.className = `chat-row ${mine ? 'mine' : 'theirs'}`;
  if (id) row.dataset.messageId = id;
  if (participantId) row.dataset.participantId = participantId;
  row.appendChild(createAvatarElement(avatar, mine ? '✿' : '❀'));

  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble';
  const authorElement = document.createElement('span');
  authorElement.className = 'chat-author';
  authorElement.textContent = author;
  bubble.appendChild(authorElement);
  if (replyTo && (replyTo.id || replyTo.from || replyTo.text)) {
    const quote = document.createElement('div');
    quote.className = 'chat-reply-quote';
    quote.textContent = `${replyTo.from || 'Mensagem'}: ${replyTo.text || 'mídia'}`;
    bubble.appendChild(quote);
  }
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
  if (mine && id) {
    const status = document.createElement('span');
    status.className = 'chat-message-status';
    bubble.appendChild(status);
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
    menuButton.addEventListener('click', () => openChatMessageMenu(menuButton, { messageId: id, mine, row, author, text }));
    actions.appendChild(menuButton);
    row.appendChild(actions);
  }
  els.chatMessages.appendChild(row);
  if (mine && id) updateChatMessageReadStatus(id, readBy);
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

function setReplyTo(replyTo) {
  state.replyTo = replyTo;
  els.replyPreviewText.textContent = `Respondendo a ${replyTo.from}: ${replyTo.text || 'mídia'}`;
  els.replyPreviewBar.classList.remove('hidden');
  els.chatInput.focus();
}

function clearReplyTo() { state.replyTo = null; els.replyPreviewBar.classList.add('hidden'); }
els.btnCancelReply.addEventListener('click', clearReplyTo);
els.btnRemoveMedia.addEventListener('click', clearPendingMedia);

els.chatForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const text = els.chatInput.value.trim();
  const media = state.pendingMedia;
  if (!text && !media) return;
  const messageId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const replyTo = state.replyTo;
  const sent = state.wsClient?.send({ type: 'CHAT_MESSAGE', messageId, text, media, replyTo });
  if (!sent) return showChatError('A conexão caiu antes de enviar. Tente novamente.');
  els.chatInput.value = '';
  clearPendingMedia();
  clearReplyTo();
});

function openChat({ focus = true } = {}) {
  els.chatPanel.classList.add('open');
  clearUnreadChat();
  markVisibleIncomingMessagesRead();
  if (focus) setTimeout(() => els.chatInput.focus(), 120);
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

els.btnNeutralMode.addEventListener('click', () => els.settingsModal.classList.remove('hidden'));
els.btnCloseSettings.addEventListener('click', () => els.settingsModal.classList.add('hidden'));
els.settingsModal.addEventListener('click', (event) => { if (event.target === els.settingsModal) els.settingsModal.classList.add('hidden'); });
els.themeSelect.addEventListener('change', () => { state.theme = els.themeSelect.value; saveUiPreferences(); applyNeutralMode(); });
els.btnSettingsChat.addEventListener('click', () => { openChat(); els.settingsModal.classList.add('hidden'); });
els.btnSettingsFullscreen.addEventListener('click', () => { els.btnFullscreen.click(); els.settingsModal.classList.add('hidden'); });
els.btnSettingsPip.addEventListener('click', () => { els.btnPip.click(); els.settingsModal.classList.add('hidden'); });

function formatMomentTime(seconds) { return formatTime(Math.floor(seconds || 0)); }
els.btnDiscussMoment.addEventListener('click', () => {
  const time = formatMomentTime(state.player?.getCurrentTime?.());
  els.chatInput.value = `Sobre ${time}: `;
  const video = state.player?.video;
  if (video && video.readyState >= 2) {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = Math.min(640, video.videoWidth || 640);
      canvas.height = Math.round(canvas.width * ((video.videoHeight || 360) / (video.videoWidth || 640)));
      canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
      setPendingMedia(canvas.toDataURL('image/jpeg', .78), `Trecho ${time}`);
    } catch { showChatError('Este vídeo não permite capturar a imagem; o minuto foi inserido na mensagem.'); }
  } else if (state.currentVideoType === 'youtube') {
    showChatError('O YouTube bloqueia captura automática; o minuto foi inserido na mensagem.');
  }
  openChat();
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
  const presets = [34, 50, 68];
  let preset = 0;
  let activePointerId = null;
  let moved = false;
  let startY = 0;
  let startHeight = 0;
  handle.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    activePointerId = event.pointerId;
    moved = false;
    startY = event.clientY;
    startHeight = els.chatPanel.getBoundingClientRect().height;
    try { handle.setPointerCapture?.(event.pointerId); } catch { /* segue funcionando dentro do puxador */ }
    event.preventDefault();
  });
  handle.addEventListener('pointermove', (event) => {
    if (activePointerId !== event.pointerId) return;
    const delta = startY - event.clientY;
    if (Math.abs(delta) > 6) moved = true;
    const viewportHeight = window.visualViewport?.height || innerHeight;
    const height = Math.min(viewportHeight * .75, Math.max(190, startHeight + delta));
    els.chatPanel.style.setProperty('--chat-height', `${Math.round(height)}px`);
    event.preventDefault();
  });
  const finishResize = (event) => {
    if (activePointerId !== event.pointerId) return;
    try {
      if (handle.hasPointerCapture?.(event.pointerId)) handle.releasePointerCapture?.(event.pointerId);
    } catch { /* o navegador já liberou a captura */ }
    activePointerId = null;
    if (!moved) {
      preset = (preset + 1) % presets.length;
      els.chatPanel.style.setProperty('--chat-height', `${presets[preset]}dvh`);
    }
  };
  handle.addEventListener('pointerup', finishResize);
  handle.addEventListener('pointercancel', finishResize);
})();

document.addEventListener('visibilitychange', () => {
  if (document.hidden && state.roomCode) saveRoomSession(state.roomCode, state.reconnectToken, state.participantId);
  if (!document.hidden && chatIsOpenOnThisScreen()) {
    clearUnreadChat();
    markVisibleIncomingMessagesRead();
  }
  if (!document.hidden && state.roomCode) {
    if (state.wsClient?.isOpen()) {
      state.wsClient.send({ type: 'REQUEST_STATE' }, { skipIfBusy: true });
      state.sync?.requestTimeSync();
    }
    else scheduleReconnect();
  }
});

function findRecentRoomSession() {
  const now = Date.now();
  const sessions = readSessions();
  const recent = Object.entries(sessions)
    .filter(([, value]) => value?.reconnectToken && value?.name && now - Number(value.savedAt || 0) < 7 * 60_000)
    .sort(([, a], [, b]) => Number(b.savedAt || 0) - Number(a.savedAt || 0));
  if (!recent.length) return null;
  const requestedCode = roomFromUrl?.toUpperCase();
  if (requestedCode) return recent.find(([roomCode]) => roomCode === requestedCode) || null;
  return recent[0];
}

function dismissReconnectChoice() {
  clearTimeout(state.reconnectChoiceTimer);
  state.reconnectChoiceTimer = null;
  state.pendingRejoin = null;
  els.reconnectModal.classList.add('hidden');
}

function joinPendingRoom() {
  const pending = state.pendingRejoin;
  if (!pending) return;
  dismissReconnectChoice();
  document.querySelector('.tab-btn[data-tab="join"]')?.click();
  els.joinName.value = pending.session.name;
  els.joinCode.value = pending.roomCode;
  els.btnJoinRoom.click();
}

function skipPendingRoom() {
  const pending = state.pendingRejoin;
  if (pending) clearRoomSession(pending.roomCode);
  if (pending?.roomCode === roomFromUrl?.toUpperCase()) removeRoomFromAddress();
  dismissReconnectChoice();
}

function showReconnectChoice(roomCode, session) {
  state.pendingRejoin = { roomCode, session };
  const mobile = matchMedia('(max-width: 720px)').matches;
  els.reconnectMessage.textContent = mobile
    ? 'Reconectando automaticamente em um instante. Se preferir, cancele agora.'
    : 'Você saiu há menos de 7 minutos. Escolha se quer voltar para esta sala.';
  els.btnReconnectNow.textContent = mobile ? 'Entrar agora' : 'Reconectar';
  els.btnSkipReconnect.textContent = mobile ? 'Cancelar' : 'Ficar fora';
  els.reconnectModal.classList.remove('hidden');
  if (mobile) state.reconnectChoiceTimer = setTimeout(joinPendingRoom, 1400);
}

function autoRejoinRecentRoom() {
  if (state.roomCode || state.pendingRejoin) return;
  const recent = findRecentRoomSession();
  if (!recent) return;
  const [roomCode, session] = recent;
  showReconnectChoice(roomCode, session);
}

els.btnReconnectNow.addEventListener('click', joinPendingRoom);
els.btnSkipReconnect.addEventListener('click', skipPendingRoom);
setTimeout(autoRejoinRecentRoom, 180);

updateFullscreenButton();

window.addEventListener('beforeunload', () => {
  state.closing = true;
  if (state.roomCode) saveRoomSession(state.roomCode, state.reconnectToken, state.participantId);
  state.sync?.destroy();
});

window.addEventListener('pagehide', () => {
  if (state.roomCode) saveRoomSession(state.roomCode, state.reconnectToken, state.participantId);
});
