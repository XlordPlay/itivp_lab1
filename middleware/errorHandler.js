class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.name = 'HttpError';
  }
}

function notFoundHandler(req, res, next) {
  next(new HttpError(404, `Маршрут ${req.method} ${req.originalUrl} не найден`));
}

function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Некорректный JSON в теле запроса' });
  }

  const status = err.status || 500;
  const message = status === 500 ? 'Внутренняя ошибка сервера' : err.message;

  if (status === 500) {
    console.error(err);
  }

  res.status(status).json({ error: message });
}

module.exports = { HttpError, notFoundHandler, errorHandler };
