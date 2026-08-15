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
  playerContainer: document.getElementById('player-container'),
  videoPlaceholder: document.getElementById('video-placeholder'),
  resumeBanner: document.getElementById('resume-banner'),
  btnPlayPause: document.getElementById('btn-playpause'),
  btnBack10: document.getElementById('btn-back10'),
  btnFwd10: document.getElementById('btn-fwd10'),
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
};

const SESSION_STORAGE_KEY = 'encontro-jasmym-sessions-v1';
const PROFILE_STORAGE_KEY = 'encontro-jasmym-profile-v1';
const PROTOCOL_VERSION = 13;

function readJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}

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
    client.send({ type: 'CREATE_ROOM', name, avatar: state.avatar, protocolVersion: PROTOCOL_VERSION });
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
    state.roomCode = message.roomCode;
    state.participantId = message.participantId;
    state.reconnectToken = message.reconnectToken || getReconnectToken(message.roomCode);
    state.reconnectAttempts = 0;
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
  client.on('CHAT_MESSAGE', (message) => {
    if (!activeClient()) return;
    const sender = state.participants.find((person) => person.id === message.participantId);
    addChatMessage(message.from, message.text, false, {
      media: message.media,
      avatar: message.avatar || sender?.avatar || null,
    });
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
  }
  if (peer) {
    els.peerNameDisplay.textContent = peer.name;
    setAvatar(els.peerAvatar, peer.avatar, '❀');
    els.peerAvatar.classList.remove('waiting');
    els.peerStatus.textContent = `${peer.name} está aqui com você`;
  } else {
    els.peerNameDisplay.textContent = 'esperando…';
    setAvatar(els.peerAvatar, null, '❀');
    els.peerAvatar.classList.add('waiting');
    els.peerStatus.textContent = 'esperando a outra pessoa entrar…';
  }
}

function handleRoomState(message, force = false) {
  if (Array.isArray(message.participants)) updateParticipants(message.participants);
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

async function loadVideo(videoType, url, initialState) {
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
  else if (state.player) setConnectionStatus('sincronizado com a sala', 'ok');
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

function updatePlayPauseIcon() {
  if (!state.player) return;
  const playing = state.player.isPlaying();
  els.btnPlayPause.textContent = playing ? 'Ⅱ' : '▶';
  els.btnPlayPause.title = playing ? 'Pausar' : 'Reproduzir';
  els.btnPlayPause.setAttribute('aria-label', els.btnPlayPause.title);
}

function togglePlayback() {
  if (!state.player || !state.sync) return;
  if (state.player.isPlaying()) state.sync.localPause();
  else state.sync.localPlay();
  setTimeout(updatePlayPauseIcon, 150);
}

els.btnPlayPause.addEventListener('click', togglePlayback);
els.resumeBanner.addEventListener('click', () => {
  state.sync?.localPlay();
  setTimeout(updatePlayPauseIcon, 200);
});
els.btnBack10.addEventListener('click', () => {
  if (!state.sync) return;
  state.sync.localSeek(Math.max(0, state.sync.expectedPosition() - 10));
});
els.btnFwd10.addEventListener('click', () => {
  if (!state.sync) return;
  state.sync.localSeek(state.sync.expectedPosition() + 10);
});
els.seekBar.addEventListener('input', () => { state.seekBarBeingDragged = true; });
els.seekBar.addEventListener('change', () => {
  state.sync?.localSeek(Number(els.seekBar.value));
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

function addChatMessage(author, text, mine, { media = null, avatar = null } = {}) {
  els.chatMessages.querySelector('.chat-welcome')?.remove();
  const row = document.createElement('div');
  row.className = `chat-row ${mine ? 'mine' : 'theirs'}`;
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
  els.chatMessages.appendChild(row);
  els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
}

function addSystemMessage(text) {
  const element = document.createElement('div');
  element.className = 'chat-system';
  element.textContent = `❦ ${text}`;
  els.chatMessages.appendChild(element);
  els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
}

els.chatMediaInput.addEventListener('change', async () => {
  const file = els.chatMediaInput.files?.[0];
  if (!file) return;
  try {
    state.pendingMedia = await prepareImage(file, 'chat');
    state.pendingMediaName = file.name;
    els.mediaPreview.src = state.pendingMedia;
    els.mediaPreviewName.textContent = file.type === 'image/gif' ? 'GIF pronto' : file.name;
    els.mediaPreviewBar.classList.remove('hidden');
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
  const sent = state.wsClient?.send({ type: 'CHAT_MESSAGE', text, media });
  if (!sent) return showChatError('A conexão caiu antes de enviar. Tente novamente.');
  addChatMessage(state.myName, text, true, { media, avatar: state.avatar });
  els.chatInput.value = '';
  clearPendingMedia();
});

els.btnToggleChat.addEventListener('click', () => els.chatPanel.classList.add('open'));
els.btnCloseChat.addEventListener('click', () => els.chatPanel.classList.remove('open'));

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
  if (!document.hidden && state.roomCode) {
    if (state.wsClient?.isOpen()) {
      state.wsClient.send({ type: 'REQUEST_STATE' }, { skipIfBusy: true });
      state.sync?.requestTimeSync();
    }
    else scheduleReconnect();
  }
});

window.addEventListener('beforeunload', () => {
  state.closing = true;
  state.sync?.destroy();
});
