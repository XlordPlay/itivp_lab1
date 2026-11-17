const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const Message = require('../mongo/models/Message');
const { setIo } = require('./notify');

const ROOMS = [
  { id: 'family', name: 'Семейный бюджет', description: 'Общие траты и планы семьи' },
  { id: 'vacation', name: 'Копим на отпуск', description: 'Цель — 3 000 Br к июню' },
  { id: 'support', name: 'Поддержка', description: 'Вопросы по приложению' },
];

const HISTORY_LIMIT = 50;
const MAX_LENGTH = 1000;
const RATE_WINDOW_MS = 5000;
const RATE_LIMIT = 5;

const online = new Map();

function displayName(email) {
  const local = String(email).split('@')[0];
  return local.charAt(0).toUpperCase() + local.slice(1);
}

function presence() {
  return [...online.values()].map(({ id, name, email }) => ({ id, name, email }));
}

function dmRoom(a, b) {
  return `dm:${Math.min(a, b)}:${Math.max(a, b)}`;
}

function cleanText(text) {
  if (typeof text !== 'string') return null;
  const value = text.trim();
  if (!value || value.length > MAX_LENGTH) return null;
  return value;
}

function allowMessage(socket) {
  const now = Date.now();
  socket.data.sent = (socket.data.sent || []).filter((time) => now - time < RATE_WINDOW_MS);
  if (socket.data.sent.length >= RATE_LIMIT) return false;
  socket.data.sent.push(now);
  return true;
}

async function history(room) {
  const list = await Message.find({ room }).sort({ createdAt: -1 }).limit(HISTORY_LIMIT);
  return list.reverse().map((m) => m.toClient());
}

function authenticate(socket, next) {
  try {
    const payload = jwt.verify(socket.handshake.auth?.token, process.env.JWT_SECRET);
    socket.data.user = { id: payload.id, email: payload.email, name: displayName(payload.email) };
    next();
  } catch {
    next(new Error('unauthorized'));
  }
}

function attachRealtime(server) {
  const io = new Server(server, { cors: { origin: '*' }, maxHttpBufferSize: 1e5 });
  setIo(io);
  io.use(authenticate);

  io.on('connection', (socket) => {
    const user = socket.data.user;
    const reply = (ack) => (typeof ack === 'function' ? ack : () => {});

    socket.join(`user:${user.id}`);
    const entry = online.get(user.id) || { ...user, sockets: new Set() };
    const isFirstTab = entry.sockets.size === 0;
    entry.sockets.add(socket.id);
    online.set(user.id, entry);

    socket.emit('hello', { me: user, rooms: ROOMS, online: presence() });
    if (isFirstTab) socket.broadcast.emit('user:online', { user, at: new Date() });
    io.emit('presence', presence());

    socket.on('room:join', async (roomId, ack) => {
      const done = reply(ack);
      const room = ROOMS.find((r) => r.id === roomId);
      if (!room) return done({ ok: false, error: 'Такой комнаты нет' });
      try {
        const previous = socket.data.room;
        if (previous && previous !== room.id) {
          socket.leave(`room:${previous}`);
          socket.to(`room:${previous}`).emit('room:system', { room: previous, text: `Пользователь ${user.name} вышел из комнаты`, at: new Date() });
        }
        socket.join(`room:${room.id}`);
        socket.data.room = room.id;
        if (previous !== room.id) {
          socket.to(`room:${room.id}`).emit('room:system', { room: room.id, text: `Пользователь ${user.name} вошёл в комнату`, at: new Date() });
        }
        done({ ok: true, history: await history(room.id) });
      } catch (err) {
        done({ ok: false, error: err.message });
      }
    });

    socket.on('room:leave', () => {
      const room = socket.data.room;
      if (!room) return;
      socket.leave(`room:${room}`);
      socket.data.room = null;
      socket.to(`room:${room}`).emit('room:system', { room, text: `Пользователь ${user.name} вышел из комнаты`, at: new Date() });
    });

    socket.on('dm:open', async (userId, ack) => {
      const done = reply(ack);
      try {
        done({ ok: true, history: await history(dmRoom(user.id, Number(userId))) });
      } catch (err) {
        done({ ok: false, error: err.message });
      }
    });

    socket.on('message:send', async (payload, ack) => {
      const done = reply(ack);
      const text = cleanText(payload?.text);
      const room = payload?.room;
      if (!text) return done({ ok: false, error: `Сообщение должно содержать от 1 до ${MAX_LENGTH} символов` });
      if (socket.data.room !== room) return done({ ok: false, error: 'Сначала войдите в комнату' });
      if (!allowMessage(socket)) return done({ ok: false, error: 'Слишком часто. Подождите пару секунд' });
      try {
        const message = (await Message.create({ room, from: user, text })).toClient();
        io.to(`room:${room}`).emit('message:new', message);
        done({ ok: true, message });
      } catch (err) {
        done({ ok: false, error: err.message });
      }
    });

    socket.on('message:private', async (payload, ack) => {
      const done = reply(ack);
      const text = cleanText(payload?.text);
      const to = Number(payload?.to);
      if (!text) return done({ ok: false, error: `Сообщение должно содержать от 1 до ${MAX_LENGTH} символов` });
      if (!Number.isInteger(to) || to === user.id) return done({ ok: false, error: 'Некорректный получатель' });
      if (!allowMessage(socket)) return done({ ok: false, error: 'Слишком часто. Подождите пару секунд' });
      try {
        const message = (await Message.create({ room: dmRoom(user.id, to), from: user, to, text })).toClient();
        io.to(`user:${to}`).to(`user:${user.id}`).emit('message:private', message);
        done({ ok: true, message });
      } catch (err) {
        done({ ok: false, error: err.message });
      }
    });

    socket.on('typing', ({ room, to, typing } = {}) => {
      const event = { user, typing: Boolean(typing), room: room || null, dm: to ? user.id : null };
      if (to) socket.volatile.to(`user:${Number(to)}`).emit('typing', event);
      else if (room && socket.data.room === room) socket.volatile.to(`room:${room}`).emit('typing', event);
    });

    socket.on('disconnect', (reason) => {
      if (socket.data.room) {
        socket.to(`room:${socket.data.room}`).emit('typing', { user, typing: false, room: socket.data.room, dm: null });
      }
      const current = online.get(user.id);
      if (!current) return;
      current.sockets.delete(socket.id);
      if (current.sockets.size === 0) {
        online.delete(user.id);
        io.emit('user:offline', { user, reason, at: new Date() });
      }
      io.emit('presence', presence());
    });
  });

  return io;
}

module.exports = { attachRealtime, ROOMS, displayName };
