let io = null;

function setIo(instance) {
  io = instance;
}

function notifyUser(userId, event, payload, exceptSocketId) {
  if (!io) return;
  const target = io.to(`user:${userId}`);
  (exceptSocketId ? target.except(exceptSocketId) : target).emit(event, payload);
}

module.exports = { setIo, notifyUser };
