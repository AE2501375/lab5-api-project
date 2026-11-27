/**
 * Real-time push over WebSocket (Socket.IO).
 * server.js calls attach(io) at start-up; services call notifyUser() after a
 * transaction has committed. Each logged-in user joins the private room
 * `user:<id>`, so a notification only reaches its owner.
 */
let io = null;

function attach(socketServer) {
  io = socketServer;
}

/**
 * @param {number} userId
 * @param {string} event e.g. 'notification:new'
 * @param {object} payload
 */
function notifyUser(userId, event, payload) {
  if (!io) return; // sockets not running (e.g. tests) - the row in `notifications` is still saved
  io.to(`user:${userId}`).emit(event, payload);
}

module.exports = { attach, notifyUser };
