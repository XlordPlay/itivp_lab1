const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { HttpError } = require('../middleware/errorHandler');

function passwordError(password) {
  if (typeof password !== 'string' || password.length < 8) {
    return 'Пароль должен быть не короче 8 символов';
  }
  if (!/[A-Z]/.test(password)) return 'Пароль должен содержать заглавную букву';
  if (!/[0-9]/.test(password)) return 'Пароль должен содержать цифру';
  if (!/[^A-Za-z0-9]/.test(password)) return 'Пароль должен содержать спецсимвол';
  return null;
}

async function register(req, res) {
  const { email, password } = req.body || {};
  if (!email || !password) throw new HttpError(400, 'Email и пароль обязательны');

  const weak = passwordError(password);
  if (weak) throw new HttpError(400, weak);

  const exists = await User.findOne({ where: { email } });
  if (exists) throw new HttpError(400, 'Пользователь с таким email уже есть');

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ email, passwordHash });
  res.status(201).json({ id: user.id, email: user.email });
}

async function login(req, res) {
  const { email, password } = req.body || {};
  if (!email || !password) throw new HttpError(400, 'Email и пароль обязательны');

  const user = await User.findOne({ where: { email } });
  const ok = user && (await bcrypt.compare(password, user.passwordHash));
  if (!ok) throw new HttpError(401, 'Неверный email или пароль');

  const token = jwt.sign(
    { id: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
  res.status(200).json({ token });
}

async function profile(req, res) {
  const user = await User.findByPk(req.user.id, {
    attributes: ['id', 'email', 'createdAt'],
  });
  if (!user) throw new HttpError(404, 'Пользователь не найден');
  res.status(200).json(user);
}

module.exports = { register, login, profile };
