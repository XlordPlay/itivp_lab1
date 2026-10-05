const jwt = require('jsonwebtoken');
const { HttpError } = require('./errorHandler');

function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const [type, token] = header.split(' ');

  if (type !== 'Bearer' || !token) {
    return next(new HttpError(401, 'Требуется токен'));
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    next(new HttpError(401, 'Невалидный или истекший токен'));
  }
}

module.exports = auth;
