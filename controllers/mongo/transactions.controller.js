const { Transaction } = require('../../mongo/models');
const { HttpError } = require('../../middleware/errorHandler');
const { notifyUser } = require('../../realtime/notify');
const {
  objectId,
  normalizeTags,
  buildPayload,
  findOwnTransaction,
  listTransactions,
  createTransaction,
} = require('../../mongo/services');

const ACCOUNT_FIELDS = 'name kind slot';

function broadcast(req, action, transaction) {
  notifyUser(req.user.id, 'transaction:changed', { action, transaction }, req.get('x-socket-id'));
}

async function list(req, res) {
  res.json(await listTransactions(req.user.id, req.query));
}

async function getOne(req, res) {
  const item = await findOwnTransaction(req.user.id, req.params.id);
  res.json(await item.populate('account', ACCOUNT_FIELDS));
}

async function create(req, res) {
  const created = await createTransaction(req.user.id, req.body || {});
  broadcast(req, 'created', created);
  res.status(201).json(created);
}

async function update(req, res) {
  await findOwnTransaction(req.user.id, req.params.id);
  const data = await buildPayload(req.user.id, req.body || {}, true);
  const item = await Transaction.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true })
    .populate('account', ACCOUNT_FIELDS);
  broadcast(req, 'updated', item);
  res.json(item);
}

async function remove(req, res) {
  await findOwnTransaction(req.user.id, req.params.id);
  const deleted = await Transaction.findByIdAndDelete(req.params.id);
  broadcast(req, 'deleted', deleted);
  res.json({ message: 'Операция удалена', deleted });
}

async function saveWithTotal(doc) {
  doc.recalcAmount();
  await doc.save();
  return doc.populate('account', ACCOUNT_FIELDS);
}

async function addItem(req, res) {
  await findOwnTransaction(req.user.id, req.params.id);
  const { name, qty = 1, price } = req.body || {};
  const doc = await Transaction.findOneAndUpdate(
    { _id: req.params.id },
    { $push: { items: { name, qty: Number(qty), price: Number(price) } } },
    { new: true, runValidators: true },
  );
  res.status(201).json(await saveWithTotal(doc));
}

async function updateItem(req, res) {
  await findOwnTransaction(req.user.id, req.params.id);
  objectId(req.params.itemId, 'id позиции');
  const { delta, name, qty, price } = req.body || {};

  let result;
  if (delta !== undefined) {
    const step = Number(delta);
    result = await Transaction.updateOne(
      { _id: req.params.id, items: { $elemMatch: { _id: req.params.itemId, qty: { $gte: 1 - step } } } },
      { $inc: { 'items.$.qty': step } },
    );
    if (!result.matchedCount) throw new HttpError(400, 'Количество не может стать меньше 1');
  } else {
    const set = {};
    if (name !== undefined) set['items.$.name'] = name;
    if (qty !== undefined) set['items.$.qty'] = Number(qty);
    if (price !== undefined) set['items.$.price'] = Number(price);
    result = await Transaction.updateOne(
      { _id: req.params.id, 'items._id': req.params.itemId },
      { $set: set },
      { runValidators: true },
    );
    if (!result.matchedCount) throw new HttpError(404, 'Позиция не найдена');
  }

  res.json(await saveWithTotal(await Transaction.findById(req.params.id)));
}

async function removeItem(req, res) {
  await findOwnTransaction(req.user.id, req.params.id);
  objectId(req.params.itemId, 'id позиции');
  const doc = await Transaction.findByIdAndUpdate(
    req.params.id,
    { $pull: { items: { _id: req.params.itemId } } },
    { new: true },
  );
  res.json(await saveWithTotal(doc));
}

async function addTag(req, res) {
  await findOwnTransaction(req.user.id, req.params.id);
  const [tag] = normalizeTags([req.body?.tag]);
  if (!tag) throw new HttpError(400, 'Тег не может быть пустым');
  const doc = await Transaction.findByIdAndUpdate(req.params.id, { $addToSet: { tags: tag } }, { new: true })
    .populate('account', ACCOUNT_FIELDS);
  res.json(doc);
}

async function removeTag(req, res) {
  await findOwnTransaction(req.user.id, req.params.id);
  const doc = await Transaction.findByIdAndUpdate(
    req.params.id,
    { $pull: { tags: req.params.tag.toLowerCase() } },
    { new: true },
  ).populate('account', ACCOUNT_FIELDS);
  res.json(doc);
}

module.exports = { list, getOne, create, update, remove, addItem, updateItem, removeItem, addTag, removeTag };
