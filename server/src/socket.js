const { authenticateSocket } = require("./middleware/authenticate");

function registerSocket(io, { config }) {
  if (config.disableRealtime) {
    return;
  }

  io.use(authenticateSocket(config));

  io.on("connection", (socket) => {
    const userId = socket.data.auth.sub;
    socket.join(`user:${userId}`);
  });
}

module.exports = {
  registerSocket,
};
