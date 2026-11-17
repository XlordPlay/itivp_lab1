const { QueryTypes } = require('sequelize');
const { sequelize } = require('../../models');
const { ImportedTransaction, Budget } = require('../../mongo/models');
const { HttpError } = require('../../middleware/errorHandler');
const { catalog } = require('../../mongo/categories');
const { currentMonth, monthStats, getBudget, setBudgetLimit } = require('../../mongo/services');

async function categories(req, res) {
  res.json(catalog);
}

async function stats(req, res) {
  res.json(await monthStats(req.user.id, req.query.month || currentMonth()));
}

async function budget(req, res) {
  res.json(await getBudget(req.user.id, req.params.month));
}

async function replaceBudget(req, res) {
  const limits = (req.body?.limits || []).map((l) => ({ category: l.category, limit: Number(l.limit) }));
  await Budget.findOneAndUpdate(
    { userId: req.user.id, month: req.params.month },
    { limits },
    { upsert: true, new: true, runValidators: true },
  );
  res.json(await getBudget(req.user.id, req.params.month));
}

async function patchLimit(req, res) {
  res.json(await setBudgetLimit(req.user.id, req.params.month, req.params.category, req.body?.limit));
}

async function removeLimit(req, res) {
  await Budget.updateOne(
    { userId: req.user.id, month: req.params.month },
    { $pull: { limits: { category: req.params.category } } },
  );
  res.json(await getBudget(req.user.id, req.params.month));
}

async function compare(req, res) {
  const legacyId = Number(req.params.legacyId);
  if (!Number.isInteger(legacyId)) throw new HttpError(400, 'legacyId должен быть целым числом');

  const sql = `SELECT t.id, t.type, t.amount, t.description, t.date, t.status,
       t."categoryId", c.name AS "categoryName"
  FROM "Transactions" t
  JOIN "Categories" c ON c.id = t."categoryId"
 WHERE t.id = :id`;
  const rows = await sequelize.query(sql, { replacements: { id: legacyId }, type: QueryTypes.SELECT });
  const document = await ImportedTransaction.findOne({ userId: req.user.id, legacyId });
  if (!rows.length && !document) throw new HttpError(404, `Операция с id=${legacyId} не найдена`);

  res.json({
    postgres: { tables: ['Transactions', 'Categories'], sql, rows },
    mongodb: { collection: 'imported_transactions', document },
  });
}

module.exports = { categories, stats, budget, replaceBudget, patchLimit, removeLimit, compare };
