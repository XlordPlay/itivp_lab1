const { Account, Transaction } = require('../../mongo/models');
const { HttpError } = require('../../middleware/errorHandler');
const { objectId, listAccounts } = require('../../mongo/services');

function pick(body) {
  const data = {};
  for (const key of ['name', 'kind', 'initialBalance', 'slot']) {
    if (body[key] !== undefined) data[key] = body[key];
  }
  return data;
}

async function list(req, res) {
  res.json(await listAccounts(req.user.id));
}

async function create(req, res) {
  const account = await Account.create({ ...pick(req.body || {}), userId: req.user.id });
  res.status(201).json({ ...account.toObject(), balance: account.initialBalance, count: 0 });
}

async function update(req, res) {
  objectId(req.params.id);
  const account = await Account.findOneAndUpdate(
    { _id: req.params.id, userId: req.user.id },
    pick(req.body || {}),
    { new: true, runValidators: true },
  );
  if (!account) throw new HttpError(404, 'Счет не найден');
  const withBalance = (await listAccounts(req.user.id)).find((a) => String(a._id) === String(account._id));
  res.json(withBalance);
}

async function remove(req, res) {
  objectId(req.params.id);
  const removedTransactions = await Transaction.countDocuments({ account: req.params.id, userId: req.user.id });
  const account = await Account.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
  if (!account) throw new HttpError(404, 'Счет не найден');
  res.json({ message: 'Счет удален', deleted: account, removedTransactions });
}

module.exports = { list, create, update, remove };
