function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    next(error);
    return;
  }

  const statusCode = error.statusCode || 500;
  let details;

  if (error.code === "invalid_request" && error.message) {
    try {
      details = JSON.parse(error.message);
    } catch {
      details = undefined;
    }
  }

  res.status(statusCode).json({
    error: error.code || "internal_error",
    ...(details ? { details } : {}),
  });
}

module.exports = {
  errorHandler,
};
