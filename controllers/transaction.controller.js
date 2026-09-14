const Transaction = require('../models/transaction.model');
const { HttpError } = require('../middleware/errorHandler');

function parseId(param) {
  const id = Number(param);
  if (!Number.isInteger(id) || id <= 0) {
    throw new HttpError(400, 'Параметр id должен быть положительным целым числом');
  }
  return id;
}

function getTransactions(req, res) {
  const { type, category } = req.query;
  const items = Transaction.getAll({ type, category });
  res.status(200).json(items);
}

function getTransactionById(req, res) {
  const id = parseId(req.params.id);
  const item = Transaction.getById(id);

  if (!item) {
    throw new HttpError(404, `Транзакция с id=${id} не найдена`);
  }

  res.status(200).json(item);
}

function createTransaction(req, res) {
  const validationError = Transaction.validate(req.body);
  if (validationError) {
    throw new HttpError(400, validationError);
  }

  const item = Transaction.create(req.body);
  res.status(201).json(item);
}

function updateTransaction(req, res) {
  const id = parseId(req.params.id);
  const validationError = Transaction.validate(req.body);
  if (validationError) {
    throw new HttpError(400, validationError);
  }

  const item = Transaction.update(id, req.body);
  if (!item) {
    throw new HttpError(404, `Транзакция с id=${id} не найдена`);
  }

  res.status(200).json(item);
}

function deleteTransaction(req, res) {
  const id = parseId(req.params.id);
  const deleted = Transaction.remove(id);

  if (!deleted) {
    throw new HttpError(404, `Транзакция с id=${id} не найдена`);
  }

  res.status(200).json({ message: `Транзакция с id=${id} удалена` });
}

module.exports = {
  getTransactions,
  getTransactionById,
  createTransaction,
  updateTransaction,
  deleteTransaction,
};
