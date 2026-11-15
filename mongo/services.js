const { isValidObjectId } = require('mongoose');
const { Account, Transaction, Budget } = require('./models');
const { categorySnapshot } = require('./categories');
const { HttpError } = require('../middleware/errorHandler');

const MONTH_RE = /^\d{4}-\d{2}$/;

function objectId(value, label = 'id') {
  if (!isValidObjectId(value)) throw new HttpError(400, `Некорректный ${label}: ${value}`);
  return value;
}

// «Сегодня» по часовому поясу пользователя (по умолчанию Минск), а не по UTC
function today() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: process.env.TZ_USER || 'Europe/Minsk' }).format(new Date());
}

function currentMonth() {
  return today().slice(0, 7);
}

// Границы месяца [from, to) в UTC
function monthRange(month = currentMonth()) {
  if (!MONTH_RE.test(month)) throw new HttpError(400, 'Месяц в формате ГГГГ-ММ');
  const [y, m] = month.split('-').map(Number);
  return { from: new Date(Date.UTC(y, m - 1, 1)), to: new Date(Date.UTC(y, m, 1)), days: new Date(Date.UTC(y, m, 0)).getUTCDate() };
}

function shiftMonth(month, delta) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

// Дата операции хранится как полдень UTC выбранного дня, чтобы не зависеть от часового пояса
function parseDate(value) {
  if (!value) return undefined;
  const day = String(value).slice(0, 10);
  const date = new Date(`${day}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) throw new HttpError(400, 'Некорректная дата');
  return date;
}

function normalizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  return [...new Set(tags.map((t) => String(t).trim().toLowerCase().replace(/^#/, '')).filter(Boolean))].slice(0, 10);
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

// Приводит тело запроса к полям документа. partial = true для обновления
async function buildPayload(userId, body, partial = false) {
  const data = {};
  const type = body.type ?? (partial ? undefined : 'expense');
  if (type !== undefined) {
    if (!['income', 'expense'].includes(type)) throw new HttpError(400, 'type должен быть income или expense');
    data.type = type;
  }
  if (body.category !== undefined || !partial) {
    const name = typeof body.category === 'object' ? body.category?.name : body.category;
    data.category = categorySnapshot(type || 'expense', name);
  }
  if (body.amount !== undefined) data.amount = Number(body.amount);
  if (body.description !== undefined) data.description = String(body.description);
  if (body.date !== undefined) data.date = parseDate(body.date);
  if (body.tags !== undefined) data.tags = normalizeTags(body.tags);
  if (body.items !== undefined) {
    data.items = (body.items || []).map((i) => ({ name: i.name, qty: Number(i.qty) || 1, price: Number(i.price) }));
    if (data.items.length) data.amount = round2(data.items.reduce((s, i) => s + i.qty * i.price, 0));
  }
  if (body.account !== undefined) {
    if (body.account) {
      objectId(body.account, 'id счета');
      const exists = await Account.exists({ _id: body.account, userId });
      if (!exists) throw new HttpError(400, 'Счет не найден');
      data.account = body.account;
    } else {
      data.account = null;
    }
  }
  return data;
}

async function findOwnTransaction(userId, id) {
  objectId(id);
  const item = await Transaction.findById(id);
  if (!item || item.userId !== userId) throw new HttpError(404, `Операция ${id} не найдена`);
  return item;
}

// Список операций: фильтры и пагинация через цепочку Query
async function listTransactions(userId, query = {}) {
  const q = Transaction.find({ userId });
  if (query.type) q.where('type').equals(query.type);
  if (query.account) q.where('account').equals(objectId(query.account, 'id счета'));
  if (query.tag) q.where('tags').equals(String(query.tag).toLowerCase()); // поле-массив содержит значение
  if (query.category) q.where('category.name').equals(query.category); // поиск по вложенному полю
  if (query.month) {
    const { from, to } = monthRange(query.month);
    q.where('date').gte(from).lt(to);
  }
  if (query.search) {
    const re = new RegExp(String(query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    q.or([{ description: re }, { 'category.name': re }, { tags: re }, { 'items.name': re }]);
  }
  const limit = Math.min(Number(query.limit) || 200, 500);
  const offset = Number(query.offset) || 0;
  return q.sort({ date: -1, createdAt: -1 }).skip(offset).limit(limit).populate('account', 'name kind slot');
}

async function createTransaction(userId, body) {
  const data = await buildPayload(userId, body);
  const created = await Transaction.create({ ...data, userId });
  return created.populate('account', 'name kind slot');
}

// Итоги месяца, разбивка по категориям, по дням и по тегам
async function monthStats(userId, month = currentMonth()) {
  const { from, to, days } = monthRange(month);
  const match = { userId, date: { $gte: from, $lt: to } };
  const prev = monthRange(shiftMonth(month, -1));

  const [totals, prevTotals, byCategory, byDay, tags] = await Promise.all([
    Transaction.monthTotals(userId, from, to),
    Transaction.monthTotals(userId, prev.from, prev.to),
    Transaction.aggregate([
      { $match: { ...match, type: 'expense' } },
      { $group: { _id: '$category.name', total: { $sum: '$amount' }, count: { $sum: 1 }, icon: { $first: '$category.icon' } } },
      { $sort: { total: -1 } },
    ]),
    Transaction.aggregate([
      { $match: match },
      { $group: { _id: { day: { $dayOfMonth: '$date' }, type: '$type' }, total: { $sum: '$amount' } } },
    ]),
    Transaction.aggregate([
      { $match: match },
      { $unwind: '$tags' },
      { $group: { _id: '$tags', count: { $sum: 1 }, total: { $sum: '$amount' } } },
      { $sort: { count: -1, total: -1 } },
      { $limit: 10 },
    ]),
  ]);

  const sum = (list, type) => round2(list.find((t) => t._id === type)?.total || 0);
  const income = sum(totals, 'income');
  const expense = sum(totals, 'expense');
  const daily = Array.from({ length: days }, (_, i) => ({ day: i + 1, income: 0, expense: 0 }));
  for (const row of byDay) daily[row._id.day - 1][row._id.type] = round2(row.total);

  return {
    month,
    income,
    expense,
    balance: round2(income - expense),
    count: totals.reduce((s, t) => s + t.count, 0),
    previous: { month: shiftMonth(month, -1), income: sum(prevTotals, 'income'), expense: sum(prevTotals, 'expense') },
    byCategory: byCategory.map((c) => ({ category: c._id, total: round2(c.total), count: c.count, icon: c.icon })),
    daily,
    tags: tags.map((t) => ({ tag: t._id, count: t.count, total: round2(t.total) })),
  };
}

// Счета с балансами (aggregation по операциям)
async function listAccounts(userId) {
  const [accounts, sums] = await Promise.all([
    Account.find({ userId }).sort({ createdAt: 1 }).lean(),
    Transaction.aggregate([
      { $match: { userId, account: { $ne: null } } },
      {
        $group: {
          _id: '$account',
          income: { $sum: { $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0] } },
          expense: { $sum: { $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0] } },
          count: { $sum: 1 },
        },
      },
    ]),
  ]);
  return accounts.map((a) => {
    const s = sums.find((x) => String(x._id) === String(a._id)) || { income: 0, expense: 0, count: 0 };
    return { ...a, balance: round2(a.initialBalance + s.income - s.expense), count: s.count };
  });
}

// Бюджет месяца с фактическими расходами по каждой категории
async function getBudget(userId, month = currentMonth()) {
  const { from, to } = monthRange(month);
  const [budget, spent] = await Promise.all([
    Budget.findOne({ userId, month }).lean(),
    Transaction.aggregate([
      { $match: { userId, type: 'expense', date: { $gte: from, $lt: to } } },
      { $group: { _id: '$category.name', total: { $sum: '$amount' } } },
    ]),
  ]);
  const limits = (budget?.limits || []).map((l) => ({
    ...l,
    spent: round2(spent.find((s) => s._id === l.category)?.total || 0),
  }));
  return { month, _id: budget?._id, limits };
}

// Обновление элемента массива через arrayFilters, либо добавление нового элемента
async function setBudgetLimit(userId, month, category, limit) {
  monthRange(month);
  const value = Number(limit);
  if (!(value >= 0)) throw new HttpError(400, 'Лимит должен быть числом не меньше 0');
  const updated = await Budget.updateOne(
    { userId, month, 'limits.category': category },
    { $set: { 'limits.$[l].limit': value } },
    { arrayFilters: [{ 'l.category': category }], runValidators: true },
  );
  if (!updated.matchedCount) {
    await Budget.updateOne({ userId, month }, { $push: { limits: { category, limit: value } } }, { upsert: true, runValidators: true });
  }
  return getBudget(userId, month);
}

module.exports = {
  objectId,
  today,
  currentMonth,
  monthRange,
  shiftMonth,
  normalizeTags,
  buildPayload,
  findOwnTransaction,
  listTransactions,
  createTransaction,
  monthStats,
  listAccounts,
  getBudget,
  setBudgetLimit,
};
