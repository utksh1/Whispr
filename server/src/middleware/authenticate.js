const { extractBearerToken, verifyToken } = require("../services/tokens");
const { HttpError } = require("../errors");

function authenticateRequest(config) {
  return (req, res, next) => {
    try {
      const token = extractBearerToken(req.headers.authorization);
      const payload = verifyToken(token, config);

      req.auth = payload;
      next();
    } catch (error) {
      next(error);
    }
  };
}

function authenticateSocket(config) {
  return (socket, next) => {
    try {
      const authToken =
        socket.handshake.auth?.token || extractBearerToken(socket.handshake.headers.authorization);

      if (!authToken) {
        throw new HttpError(401, "missing_token");
      }

      socket.data.auth = verifyToken(authToken, config);
      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = {
  authenticateRequest,
  authenticateSocket,
};
