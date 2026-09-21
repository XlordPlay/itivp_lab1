const { Transaction, Category } = require('../models');
const { HttpError } = require('../middleware/errorHandler');

function parseId(param) {
  const id = Number(param);
  if (!Number.isInteger(id) || id <= 0) {
    throw new HttpError(400, 'Параметр id должен быть положительным целым числом');
  }
  return id;
}

async function getTransactions(req, res) {
  const { type, limit, offset } = req.query;
  const items = type
    ? await Transaction.getByType(type)
    : await Transaction.findAll({
        include: Category,
        limit: limit ? Number(limit) : undefined,
        offset: offset ? Number(offset) : undefined,
        order: [['id', 'ASC']],
      });
  res.status(200).json(items);
}

async function getTransactionById(req, res) {
  const id = parseId(req.params.id);
  const item = await Transaction.findByPk(id, { include: Category });
  if (!item) throw new HttpError(404, `Транзакция с id=${id} не найдена`);
  res.status(200).json(item);
}

async function createTransaction(req, res) {
  const body = { ...req.body };
  if (!body.date) body.date = new Date().toISOString().slice(0, 10);
  const item = await Transaction.create(body);
  const created = await Transaction.findByPk(item.id, { include: Category });
  res.status(201).json(created);
}

async function updateTransaction(req, res) {
  const id = parseId(req.params.id);
  const [count] = await Transaction.update(req.body, { where: { id } });
  if (!count) throw new HttpError(404, `Транзакция с id=${id} не найдена`);
  const item = await Transaction.findByPk(id, { include: Category });
  res.status(200).json(item);
}

async function deleteTransaction(req, res) {
  const id = parseId(req.params.id);
  const count = await Transaction.destroy({ where: { id } });
  if (!count) throw new HttpError(404, `Транзакция с id=${id} не найдена`);
  res.status(200).json({ message: `Транзакция с id=${id} удалена` });
}

module.exports = {
  getTransactions,
  getTransactionById,
  createTransaction,
  updateTransaction,
  deleteTransaction,
};
