class HttpError extends Error {
  constructor(statusCode, code, message) {
    super(message || code);
    this.name = "HttpError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

module.exports = {
  HttpError,
};
