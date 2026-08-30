'use strict';

const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { WebSocketServer, WebSocket } = require('ws');

const PORT = readInteger(process.env.PORT, 8080, 1, 65535);
const ROOM_TTL_MS = readInteger(process.env.ROOM_TTL_MS, 30 * 60_000, 60_000, 24 * 60 * 60_000);
const MAX_MESSAGE_BYTES = readInteger(process.env.MAX_MESSAGE_BYTES, 1_500_000, 64 * 1024, 4 * 1024 * 1024);
const CHAT_HISTORY_LIMIT = readInteger(process.env.CHAT_HISTORY_LIMIT, 100, 10, 300);
const CHAT_HISTORY_MAX_CHARS = readInteger(process.env.CHAT_HISTORY_MAX_CHARS, 6 * 1024 * 1024, 128 * 1024, 20 * 1024 * 1024);
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, 'data');
const ROOMS_FILE = path.join(DATA_DIR, 'rooms.json');
const ALLOWED_ORIGINS = new Set(
  (process.env.ALLOWED_ORIGINS || '').split(',').map((value) => value.trim()).filter(Boolean),
);

const PROTOCOL_VERSION = 16;
// Pequeno tempo para os dois navegadores receberem o PLAY antes de o relógio
// começar a avançar. Isso reduz a diferença inicial sem transmitir o vídeo.
const PLAY_START_DELAY_MS = 700;
const ROOM_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const NAME_MAX_LENGTH = 30;
const CHAT_MAX_LENGTH = 600;
const VIDEO_URL_MAX_LENGTH = 2048;
const AVATAR_MAX_CHARS = 140_000;
const MEDIA_MAX_CHARS = 560_000;
const EXTERNAL_MEDIA_MAX_LENGTH = 2048;
const ATTENTION_COOLDOWN_MS = 20_000;
const CONTROL_TYPES = new Set(['PLAY', 'PAUSE', 'SEEK', 'CHANGE_VIDEO']);
const IMAGE_DATA_URL = /^data:image\/(?:jpeg|png|webp|gif);base64,[a-zA-Z0-9+/=]+$/;
const MESSAGE_ID = /^[a-zA-Z0-9_-]{8,120}$/;

// O servidor é a única autoridade da linha do tempo. Clientes nunca atualizam
// o relógio por heartbeat; eles apenas pedem um snapshot novo.
const rooms = new Map();
const rateLimits = new WeakMap();
let roomsSaveTimer = null;
let lastRoomsPersistedAt = 0;

function readInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

function cleanText(value, maxLength) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, maxLength);
}

function normalizeName(value) {
  return cleanText(value, NAME_MAX_LENGTH) || 'Convidado(a)';
}

function normalizeTime(value) {
  return Number.isFinite(value) ? Math.max(0, Math.min(value, 7 * 24 * 60 * 60)) : null;
}

function normalizeImageDataUrl(value, maxChars) {
  if (typeof value !== 'string' || value.length > maxChars || !IMAGE_DATA_URL.test(value)) return null;
  return value;
}

function normalizeGiphyMediaUrl(value) {
  const raw = cleanText(value, EXTERNAL_MEDIA_MAX_LENGTH);
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.toLowerCase();
    const allowedHost = host === 'i.giphy.com' || /^media\d*\.giphy\.com$/.test(host);
    const mediaPath = /^\/media\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9._-]+)?$/;
    const imagePath = /^\/[a-zA-Z0-9_-]+\.(?:gif|webp)$/i;
    if (parsed.protocol !== 'https:' || !allowedHost || !(mediaPath.test(parsed.pathname) || imagePath.test(parsed.pathname))) {
      return null;
    }
    return parsed.href;
  } catch {
    return null;
  }
}

function normalizeChatMedia(value) {
  return normalizeImageDataUrl(value, MEDIA_MAX_CHARS) || normalizeGiphyMediaUrl(value);
}

function cleanMessageId(value) {
  return typeof value === 'string' && MESSAGE_ID.test(value) ? value : null;
}

function normalizeVideoUrl(value) {
  const raw = cleanText(value, VIDEO_URL_MAX_LENGTH);
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : null;
  } catch {
    return null;
  }
}

function generateRoomCode() {
  let code;
  do {
    code = Array.from({ length: 6 }, () => ROOM_CHARS[crypto.randomInt(ROOM_CHARS.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function createToken() {
  return crypto.randomBytes(24).toString('base64url');
}

function send(ws, data) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
}

function fail(ws, code, message) {
  send(ws, { type: 'ERROR', code, message });
}

function roomFor(ws) {
  return ws.roomCode ? rooms.get(ws.roomCode) : null;
}

function touch(room) {
  room.lastActivityAt = Date.now();
  scheduleRoomsPersistence();
}

function projectedVideoState(room, now = Date.now()) {
  const state = room.videoState;
  let position = state.position;
  if (state.playing) position += Math.max(0, now - state.changedAt) / 1000;
  return {
    videoType: state.videoType,
    url: state.url,
    playing: state.playing,
    position,
    time: position,
    changedAt: state.changedAt,
    serverNow: now,
    revision: state.revision,
  };
}

function publicParticipants(room) {
  return [...room.participants.values()]
    .filter((participant) => participant.ws)
    .sort((a, b) => a.activeSince - b.activeSince)
    .map((participant) => ({
      id: participant.id,
      name: participant.name,
      avatar: participant.avatar,
      soloMode: Boolean(participant.soloMode),
      isLeader: participant.id === room.leaderId,
    }));
}

function activeCount(room, except = null) {
  let count = 0;
  for (const participant of room.participants.values()) {
    if (participant !== except && participant.ws) count += 1;
  }
  return count;
}

function electLeader(room) {
  const active = [...room.participants.values()]
    .filter((participant) => participant.ws)
    .sort((a, b) => (a.activeSince - b.activeSince) || a.id.localeCompare(b.id));
  room.leaderId = active[0]?.id || null;
}

function leaderInfo(room) {
  const participant = room.leaderId ? room.participants.get(room.leaderId) : null;
  return participant?.ws ? { id: participant.id, name: participant.name } : null;
}

function roomState(room, recipient = null, type = 'ROOM_STATE', includeParticipants = true) {
  const videoState = projectedVideoState(room);
  return {
    type,
    roomCode: room.code,
    participantId: recipient?.id || null,
    participants: includeParticipants ? publicParticipants(room) : undefined,
    leader: leaderInfo(room),
    leaderId: room.leaderId,
    isLeader: Boolean(recipient && recipient.id === room.leaderId),
    videoState,
    videoType: videoState.videoType,
    url: videoState.url,
    playing: videoState.playing,
    position: videoState.position,
    time: videoState.position,
    serverNow: videoState.serverNow,
    revision: videoState.revision,
  };
}

function broadcast(room, payload, exceptWs = null) {
  for (const participant of room.participants.values()) {
    if (participant.ws && participant.ws !== exceptWs) send(participant.ws, payload);
  }
}

function broadcastRoomState(room, includeParticipants = false) {
  for (const participant of room.participants.values()) {
    if (participant.ws) send(participant.ws, roomState(room, participant, 'ROOM_STATE', includeParticipants));
  }
}

function rememberCommand(room, commandId) {
  if (!commandId) return;
  room.recentCommands.set(commandId, room.videoState.revision);
  if (room.recentCommands.size > 100) {
    room.recentCommands.delete(room.recentCommands.keys().next().value);
  }
}

function validRoomCode(value) {
  const code = cleanText(value, 6).toUpperCase();
  return code.length === 6 && [...code].every((character) => ROOM_CHARS.includes(character)) ? code : null;
}

function normalizeStoredChatMessage(value) {
  if (!value || typeof value !== 'object') return null;
  const id = cleanMessageId(value.id);
  const participantId = cleanMessageId(value.participantId);
  const text = cleanText(value.text, CHAT_MAX_LENGTH);
  const media = normalizeChatMedia(value.media);
  const replyTo = value.replyTo && typeof value.replyTo === 'object' ? {
    id: cleanMessageId(value.replyTo.id),
    from: normalizeName(value.replyTo.from || 'Mensagem'),
    text: cleanText(value.replyTo.text, 160),
  } : null;
  if (!id || !participantId || (!text && !media)) return null;
  return {
    id,
    text,
    media,
    replyTo: replyTo?.id ? replyTo : null,
    from: normalizeName(value.from),
    participantId,
    sentAt: Number.isFinite(value.sentAt) ? Math.max(0, value.sentAt) : Date.now(),
  };
}

function chatHistory(room) {
  return [...room.chatMessages.values()].map(({ id, text, media, replyTo, from, participantId, sentAt }) => ({
    id,
    text,
    media,
    replyTo,
    from,
    participantId,
    sentAt,
  }));
}

function chatHistoryCost(room) {
  let total = 0;
  for (const message of room.chatMessages.values()) {
    total += message.id.length + message.participantId.length + message.from.length;
    total += message.text.length + (message.media?.length || 0);
  }
  return total;
}

function trimChatHistory(room) {
  while (room.chatMessages.size > CHAT_HISTORY_LIMIT || chatHistoryCost(room) > CHAT_HISTORY_MAX_CHARS) {
    const oldestId = room.chatMessages.keys().next().value;
    if (!oldestId) return;
    room.chatMessages.delete(oldestId);
  }
}

function rememberChatMessage(room, message) {
  room.chatMessages.set(message.id, message);
  trimChatHistory(room);
}

function sendChatHistory(ws, room) {
  send(ws, {
    type: 'CHAT_HISTORY',
    roomCode: room.code,
    messages: chatHistory(room),
  });
}

function serializeRoom(room) {
  const now = Date.now();
  const videoState = projectedVideoState(room, now);
  return {
    code: room.code,
    participants: [...room.participants.values()].map((participant) => ({
      id: participant.id,
      token: participant.token,
      name: participant.name,
      protocolVersion: participant.protocolVersion,
    })),
    videoState: {
      videoType: videoState.videoType,
      url: videoState.url,
      playing: videoState.playing,
      position: videoState.position,
      revision: videoState.revision,
    },
    chatMessages: chatHistory(room),
    createdAt: room.createdAt,
    lastActivityAt: room.lastActivityAt,
  };
}

function persistRooms() {
  if (roomsSaveTimer) {
    clearTimeout(roomsSaveTimer);
    roomsSaveTimer = null;
  }
  let temporaryFile = null;
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    temporaryFile = `${ROOMS_FILE}.${process.pid}.tmp`;
    const payload = JSON.stringify({ version: 1, savedAt: Date.now(), rooms: [...rooms.values()].map(serializeRoom) });
    fs.writeFileSync(temporaryFile, payload, { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(temporaryFile, ROOMS_FILE);
    lastRoomsPersistedAt = Date.now();
  } catch (error) {
    if (temporaryFile) {
      try { fs.unlinkSync(temporaryFile); } catch { /* arquivo temporário já não existe */ }
    }
    console.error('Não foi possível salvar as salas:', error.message);
  }
}

function scheduleRoomsPersistence() {
  if (roomsSaveTimer) return;
  const delay = Math.max(1_000, 30_000 - (Date.now() - lastRoomsPersistedAt));
  roomsSaveTimer = setTimeout(() => {
    roomsSaveTimer = null;
    persistRooms();
  }, delay);
  roomsSaveTimer.unref();
}

function hydrateParticipant(value, now) {
  if (!value || typeof value !== 'object') return null;
  const id = cleanMessageId(value.id);
  const token = typeof value.token === 'string' && /^[a-zA-Z0-9_-]{16,128}$/.test(value.token) ? value.token : null;
  if (!id || !token) return null;
  return {
    id,
    token,
    name: normalizeName(value.name),
    avatar: null,
    protocolVersion: Number.isInteger(value.protocolVersion) ? value.protocolVersion : 0,
    ws: null,
    activeSince: null,
    disconnectedAt: now,
    soloMode: false,
    lastAttentionAt: 0,
  };
}

function hydrateRoom(value, now) {
  if (!value || typeof value !== 'object') return null;
  const code = validRoomCode(value.code);
  const savedLastActivityAt = Number(value.lastActivityAt);
  if (!code || !Number.isFinite(savedLastActivityAt) || now - savedLastActivityAt > ROOM_TTL_MS) return null;

  const participants = new Map();
  for (const rawParticipant of Array.isArray(value.participants) ? value.participants.slice(0, 2) : []) {
    const participant = hydrateParticipant(rawParticipant, now);
    if (participant && !participants.has(participant.id)) participants.set(participant.id, participant);
  }
  if (!participants.size) return null;

  const rawVideoState = value.videoState && typeof value.videoState === 'object' ? value.videoState : {};
  const url = normalizeVideoUrl(rawVideoState.url);
  const videoState = {
    videoType: url ? cleanText(rawVideoState.videoType, 30) || 'youtube' : null,
    url,
    playing: Boolean(url && rawVideoState.playing),
    position: normalizeTime(rawVideoState.position) ?? 0,
    changedAt: now,
    revision: Number.isSafeInteger(rawVideoState.revision) && rawVideoState.revision >= 0 ? rawVideoState.revision : 0,
  };
  const room = {
    code,
    participants,
    leaderId: null,
    recentCommands: new Map(),
    chatMessages: new Map(),
    videoState,
    createdAt: Number.isFinite(value.createdAt) ? value.createdAt : now,
    lastActivityAt: savedLastActivityAt,
  };
  for (const rawMessage of Array.isArray(value.chatMessages) ? value.chatMessages : []) {
    const message = normalizeStoredChatMessage(rawMessage);
    if (message && !room.chatMessages.has(message.id)) room.chatMessages.set(message.id, message);
  }
  trimChatHistory(room);
  return room;
}

function loadRooms() {
  let stored;
  try {
    stored = JSON.parse(fs.readFileSync(ROOMS_FILE, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') console.error('Não foi possível carregar as salas:', error.message);
    return;
  }
  const candidates = Array.isArray(stored?.rooms) ? stored.rooms : [];
  const now = Date.now();
  let loaded = 0;
  for (const candidate of candidates) {
    const room = hydrateRoom(candidate, now);
    if (room && !rooms.has(room.code)) {
      rooms.set(room.code, room);
      loaded += 1;
    }
  }
  if (loaded !== candidates.length) persistRooms();
  if (loaded) console.log(`${loaded} sala(s) e seus históricos restaurados.`);
}

function allowMessage(ws, bytes) {
  const now = Date.now();
  let limit = rateLimits.get(ws);
  if (!limit || now - limit.startedAt >= 10_000) {
    limit = { startedAt: now, count: 0, bytes: 0 };
    rateLimits.set(ws, limit);
  }
  limit.count += 1;
  limit.bytes += bytes;
  return limit.count <= 120 && limit.bytes <= 3_500_000;
}

function makeParticipant(msg) {
  return {
    id: crypto.randomUUID(),
    token: createToken(),
    name: normalizeName(msg.name),
    avatar: normalizeImageDataUrl(msg.avatar, AVATAR_MAX_CHARS),
    protocolVersion: Number.isInteger(msg.protocolVersion) ? msg.protocolVersion : 0,
    ws: null,
    activeSince: null,
    disconnectedAt: null,
    soloMode: msg.soloMode === true,
    lastAttentionAt: 0,
  };
}

function attachParticipant(ws, room, participant) {
  participant.ws = ws;
  participant.activeSince = Date.now();
  participant.disconnectedAt = null;
  ws.roomCode = room.code;
  ws.participantId = participant.id;
  electLeader(room);
  touch(room);
}

function handleCreateRoom(ws, msg) {
  if (ws.roomCode) return fail(ws, 'ALREADY_IN_ROOM', 'Você já está em uma sala.');
  const roomCode = generateRoomCode();
  const participant = makeParticipant(msg);
  const now = Date.now();
  const room = {
    code: roomCode,
    participants: new Map([[participant.id, participant]]),
    leaderId: null,
    recentCommands: new Map(),
    chatMessages: new Map(),
    videoState: {
      videoType: null,
      url: null,
      playing: false,
      position: 0,
      changedAt: now,
      revision: 0,
    },
    createdAt: now,
    lastActivityAt: now,
  };
  rooms.set(roomCode, room);
  attachParticipant(ws, room, participant);
  persistRooms();
  send(ws, {
    ...roomState(room, participant, 'ROOM_CREATED'),
    reconnectToken: participant.token,
    name: participant.name,
  });
  sendChatHistory(ws, room);
}

function safeTokenMatch(participant, token) {
  if (typeof token !== 'string' || token.length !== participant.token.length) return false;
  return crypto.timingSafeEqual(Buffer.from(participant.token), Buffer.from(token));
}

function handleJoinRoom(ws, msg) {
  if (ws.roomCode) return fail(ws, 'ALREADY_IN_ROOM', 'Você já está em uma sala.');
  const roomCode = cleanText(msg.roomCode, 6).toUpperCase();
  const room = rooms.get(roomCode);
  if (!room) return fail(ws, 'ROOM_NOT_FOUND', 'Sala não encontrada. Confira o código.');

  let participant = [...room.participants.values()].find((item) => safeTokenMatch(item, msg.reconnectToken));
  if (participant) {
    if (!participant.ws && activeCount(room, participant) >= 2) {
      return send(ws, { type: 'ROOM_FULL', message: 'A sala já tem duas pessoas conectadas.' });
    }
    if (participant.ws && participant.ws !== ws) participant.ws.close(4001, 'Perfil reconectado');
    participant.name = normalizeName(msg.name || participant.name);
    participant.avatar = normalizeImageDataUrl(msg.avatar, AVATAR_MAX_CHARS) || participant.avatar;
    participant.protocolVersion = Number.isInteger(msg.protocolVersion) ? msg.protocolVersion : participant.protocolVersion;
    participant.soloMode = msg.soloMode === true;
  } else {
    if (activeCount(room) >= 2) return send(ws, { type: 'ROOM_FULL', message: 'A sala já tem duas pessoas.' });
    participant = makeParticipant(msg);
    room.participants.set(participant.id, participant);
  }

  attachParticipant(ws, room, participant);
  persistRooms();
  send(ws, {
    ...roomState(room, participant, 'JOINED'),
    reconnectToken: participant.token,
  });
  sendChatHistory(ws, room);
  broadcast(room, {
    type: 'PEER_JOINED',
    participant: {
      id: participant.id,
      name: participant.name,
      avatar: participant.avatar,
      soloMode: Boolean(participant.soloMode),
    },
    participants: publicParticipants(room),
    leader: leaderInfo(room),
  }, ws);
}

function commitVideoCommand(room, msg) {
  const now = Date.now();
  const current = projectedVideoState(room, now);
  let changedAt = now;
  if (msg.type === 'CHANGE_VIDEO') {
    const url = normalizeVideoUrl(msg.url);
    if (!url) return false;
    room.videoState.videoType = cleanText(msg.videoType, 30) || 'youtube';
    room.videoState.url = url;
    room.videoState.playing = false;
    room.videoState.position = 0;
  } else if (msg.type === 'PLAY') {
    // PLAY repetido é idempotente. Em especial, não antecipa um PLAY que já
    // estava agendado e não cria uma nova oscilação na linha do tempo.
    if (room.videoState.playing) return true;
    room.videoState.position = current.position;
    room.videoState.playing = true;
    changedAt = now + PLAY_START_DELAY_MS;
  } else if (msg.type === 'PAUSE') {
    room.videoState.position = current.position;
    room.videoState.playing = false;
  } else if (msg.type === 'SEEK') {
    const position = normalizeTime(msg.position ?? msg.time);
    if (position === null) return false;
    const scheduledPlay = room.videoState.playing && room.videoState.changedAt > now;
    room.videoState.position = position;
    // SEEK altera apenas a posição. Um snapshot antigo do cliente nunca pode
    // mudar play/pause por acidente.
    room.videoState.playing = current.playing;
    if (scheduledPlay) changedAt = room.videoState.changedAt;
  } else {
    return false;
  }
  room.videoState.changedAt = changedAt;
  room.videoState.revision += 1;
  touch(room);
  return true;
}

function handleRoomMessage(ws, msg) {
  const room = roomFor(ws);
  const participant = room?.participants.get(ws.participantId);
  if (!room || !participant || participant.ws !== ws) {
    return fail(ws, 'NOT_IN_ROOM', 'Entre em uma sala antes de enviar ações.');
  }

  if (msg.type === 'REQUEST_STATE' || msg.type === 'HEARTBEAT' || msg.type === 'LEADER_HEARTBEAT') {
    touch(room);
    const state = roomState(room, participant, msg.type === 'REQUEST_STATE' ? 'STATE' : 'HEARTBEAT', false);
    state.authoritative = true;
    return send(ws, state);
  }
  if (msg.type === 'PING') {
    return send(ws, { type: 'PONG', clientTime: msg.clientTime ?? null, serverNow: Date.now() });
  }
  if (msg.type === 'AVATAR_UPDATE') {
    const avatar = normalizeImageDataUrl(msg.avatar, AVATAR_MAX_CHARS);
    if (!avatar) return fail(ws, 'INVALID_AVATAR', 'A foto de perfil não pôde ser enviada.');
    participant.avatar = avatar;
    touch(room);
    return broadcastRoomState(room, true);
  }
  if (msg.type === 'ATTENTION_PING') {
    const now = Date.now();
    const remaining = ATTENTION_COOLDOWN_MS - (now - participant.lastAttentionAt);
    if (remaining > 0) {
      return fail(ws, 'ATTENTION_COOLDOWN', `Espere ${Math.ceil(remaining / 1000)} segundos para chamar de novo.`);
    }
    participant.lastAttentionAt = now;
    touch(room);
    return broadcast(room, {
      type: 'ATTENTION_PING',
      participantId: participant.id,
      from: participant.name,
      sentAt: now,
    }, ws);
  }
  if (msg.type === 'SOLO_MODE') {
    participant.soloMode = msg.active === true;
    touch(room);
    return broadcast(room, {
      type: 'SOLO_MODE',
      participantId: participant.id,
      active: participant.soloMode,
      from: participant.name,
      participants: publicParticipants(room),
    }, ws);
  }
  if (msg.type === 'CHAT_MESSAGE') {
    const text = cleanText(msg.text ?? msg.message, CHAT_MAX_LENGTH);
    const media = normalizeChatMedia(msg.media);
    if (!text && !media) return fail(ws, 'INVALID_CHAT', 'A mensagem está vazia.');
    const messageId = cleanMessageId(msg.messageId) || crypto.randomUUID();
    if (room.chatMessages.has(messageId)) return fail(ws, 'DUPLICATE_CHAT', 'Essa mensagem já foi enviada.');
    const chatMessage = {
      id: messageId,
      text,
      media,
      replyTo: msg.replyTo && typeof msg.replyTo === 'object' ? {
        id: cleanMessageId(msg.replyTo.id),
        from: normalizeName(msg.replyTo.from || 'Mensagem'),
        text: cleanText(msg.replyTo.text, 160),
      } : null,
      from: participant.name,
      participantId: participant.id,
      sentAt: Date.now(),
    };
    rememberChatMessage(room, chatMessage);
    touch(room);
    persistRooms();
    return broadcast(room, {
      type: 'CHAT_MESSAGE',
      ...chatMessage,
    }, ws);
  }
  if (msg.type === 'CHAT_DELETE') {
    const messageId = cleanMessageId(msg.messageId);
    if (!messageId) return fail(ws, 'INVALID_MESSAGE_ID', 'A mensagem não pôde ser identificada.');
    const stored = room.chatMessages.get(messageId);
    if (!stored) return fail(ws, 'MESSAGE_NOT_FOUND', 'Essa mensagem não está mais disponível para apagar.');
    if (stored.participantId !== participant.id) return fail(ws, 'CHAT_DELETE_FORBIDDEN', 'Só quem enviou pode apagar para todos.');
    room.chatMessages.delete(messageId);
    touch(room);
    persistRooms();
    return broadcast(room, {
      type: 'CHAT_DELETE',
      messageId,
      participantId: participant.id,
    });
  }

  if (!CONTROL_TYPES.has(msg.type)) return;
  const commandId = cleanText(msg.commandId || msg.actionId, 160) || null;
  if (commandId && room.recentCommands.has(commandId)) {
    const snapshot = projectedVideoState(room);
    return send(ws, {
      type: 'COMMAND_ACK',
      commandId,
      duplicate: true,
      revision: snapshot.revision,
      videoState: snapshot,
    });
  }
  if (!commitVideoCommand(room, msg)) return fail(ws, 'INVALID_ACTION', 'A ação de vídeo é inválida.');
  persistRooms();

  const snapshot = projectedVideoState(room);
  rememberCommand(room, commandId);
  send(ws, {
    type: 'COMMAND_ACK',
    commandId,
    revision: snapshot.revision,
    videoState: snapshot,
  });
  // Uma mensagem autoritativa para cada cliente é suficiente. Antes, o peer
  // recebia o evento legado e outro ROOM_STATE com a mesma mudança.
  broadcast(room, {
    type: 'ROOM_STATE',
    videoState: snapshot,
    videoType: snapshot.videoType,
    url: snapshot.url,
    playing: snapshot.playing,
    position: snapshot.position,
    time: snapshot.position,
    serverNow: snapshot.serverNow,
    revision: snapshot.revision,
  }, ws);
}

function leaveRoom(ws, { forgetParticipant = false } = {}) {
  const room = roomFor(ws);
  const participant = room?.participants.get(ws.participantId);
  if (!room || !participant || participant.ws !== ws) return;
  participant.ws = null;
  participant.disconnectedAt = Date.now();
  participant.activeSince = null;
  ws.roomCode = null;
  ws.participantId = null;
  if (forgetParticipant) room.participants.delete(participant.id);
  electLeader(room);
  touch(room);
  persistRooms();
  broadcast(room, {
    type: 'PEER_LEFT',
    participantId: participant.id,
    participants: publicParticipants(room),
    leader: leaderInfo(room),
  });
}

loadRooms();

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && (req.url === '/' || req.url === '/health')) {
    res.writeHead(200, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
    });
    return res.end(JSON.stringify({
      ok: true,
      service: 'encontro-jasmym-livia-backend',
      protocolVersion: PROTOCOL_VERSION,
      rooms: rooms.size,
    }));
  }
  res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: false, error: 'Not found' }));
});

const wss = new WebSocketServer({
  server,
  maxPayload: MAX_MESSAGE_BYTES,
  verifyClient: ({ origin }) => ALLOWED_ORIGINS.size === 0 || !origin || ALLOWED_ORIGINS.has(origin),
});

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.roomCode = null;
  ws.participantId = null;
  ws.on('pong', () => { ws.isAlive = true; });
  ws.on('error', (error) => console.error('Erro WebSocket:', error.message));
  ws.on('message', (raw, isBinary) => {
    if (isBinary) return fail(ws, 'BINARY_NOT_SUPPORTED', 'Envie mensagens em JSON.');
    if (!allowMessage(ws, raw.length)) return ws.close(1008, 'Limite de mensagens excedido');
    let msg;
    try {
      msg = JSON.parse(raw.toString('utf8'));
    } catch {
      return fail(ws, 'INVALID_JSON', 'Mensagem JSON inválida.');
    }
    if (!msg || typeof msg !== 'object' || Array.isArray(msg) || typeof msg.type !== 'string') {
      return fail(ws, 'INVALID_MESSAGE', 'A mensagem precisa ter um tipo.');
    }
    if (msg.type === 'CREATE_ROOM') return handleCreateRoom(ws, msg);
    if (msg.type === 'JOIN_ROOM') return handleJoinRoom(ws, msg);
    if (msg.type === 'LEAVE_ROOM') return leaveRoom(ws, { forgetParticipant: true });
    handleRoomMessage(ws, msg);
  });
  ws.on('close', () => leaveRoom(ws));
});

const heartbeatTimer = setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    ws.ping();
  }
}, 30_000);
heartbeatTimer.unref();

const cleanupTimer = setInterval(() => {
  const now = Date.now();
  let changed = false;
  for (const [roomCode, room] of rooms) {
    for (const [id, participant] of room.participants) {
      if (!participant.ws && participant.disconnectedAt && now - participant.disconnectedAt > ROOM_TTL_MS) {
        room.participants.delete(id);
        changed = true;
      }
    }
    if (room.participants.size === 0 || now - room.lastActivityAt > ROOM_TTL_MS) {
      rooms.delete(roomCode);
      changed = true;
    }
  }
  if (changed) persistRooms();
}, 60_000);
cleanupTimer.unref();

function shutdown(signal) {
  console.log(`${signal}: encerrando servidor...`);
  clearInterval(heartbeatTimer);
  clearInterval(cleanupTimer);
  persistRooms();
  for (const ws of wss.clients) ws.close(1001, 'Servidor reiniciando');
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend v${PROTOCOL_VERSION} ouvindo na porta ${PORT}`);
});
