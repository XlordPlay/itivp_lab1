const { Transaction } = require('../../mongo/models');
const { HttpError } = require('../../middleware/errorHandler');
const {
  objectId,
  normalizeTags,
  buildPayload,
  findOwnTransaction,
  listTransactions,
  createTransaction,
} = require('../../mongo/services');

const ACCOUNT_FIELDS = 'name kind slot';

// GET /mongo/transactions -> Model.find()
async function list(req, res) {
  res.json(await listTransactions(req.user.id, req.query));
}

// GET /mongo/transactions/:id -> Model.findById()
async function getOne(req, res) {
  const item = await findOwnTransaction(req.user.id, req.params.id);
  res.json(await item.populate('account', ACCOUNT_FIELDS));
}

// POST /mongo/transactions -> Model.create()
async function create(req, res) {
  res.status(201).json(await createTransaction(req.user.id, req.body || {}));
}

// PUT /mongo/transactions/:id -> Model.findByIdAndUpdate(id, body, { new: true })
async function update(req, res) {
  await findOwnTransaction(req.user.id, req.params.id);
  const data = await buildPayload(req.user.id, req.body || {}, true);
  const item = await Transaction.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true })
    .populate('account', ACCOUNT_FIELDS);
  res.json(item);
}

// DELETE /mongo/transactions/:id -> Model.findByIdAndDelete(), возвращает удаленный документ
async function remove(req, res) {
  await findOwnTransaction(req.user.id, req.params.id);
  const deleted = await Transaction.findByIdAndDelete(req.params.id);
  res.json({ message: 'Операция удалена', deleted });
}

// После изменения позиций пересчитываем сумму (метод экземпляра recalcAmount)
async function saveWithTotal(doc) {
  doc.recalcAmount();
  await doc.save();
  return doc.populate('account', ACCOUNT_FIELDS);
}

// POST /mongo/transactions/:id/items -> $push позиции в массив
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

// PATCH /mongo/transactions/:id/items/:itemId
// { delta: 1 } -> $inc по позиционному оператору items.$.qty; иначе $set полей позиции
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

// DELETE /mongo/transactions/:id/items/:itemId -> $pull
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

// POST /mongo/transactions/:id/tags -> $addToSet (без дублей)
async function addTag(req, res) {
  await findOwnTransaction(req.user.id, req.params.id);
  const [tag] = normalizeTags([req.body?.tag]);
  if (!tag) throw new HttpError(400, 'Тег не может быть пустым');
  const doc = await Transaction.findByIdAndUpdate(req.params.id, { $addToSet: { tags: tag } }, { new: true })
    .populate('account', ACCOUNT_FIELDS);
  res.json(doc);
}

// DELETE /mongo/transactions/:id/tags/:tag -> $pull
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
