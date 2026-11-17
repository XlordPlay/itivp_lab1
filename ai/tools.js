const { Account } = require('../mongo/models');
const { catalog } = require('../mongo/categories');
const services = require('../mongo/services');
const { notifyUser } = require('../realtime/notify');

const expenseNames = catalog.expense.map((c) => c.name);
const incomeNames = catalog.income.map((c) => c.name);
const monthParam = { type: 'string', description: 'Месяц в формате YYYY-MM' };

const definitions = [
  {
    name: 'list_transactions',
    description: 'Найти операции пользователя. Возвращает до limit последних операций с суммой, датой, категорией, тегами и позициями чека.',
    parameters: {
      type: 'object',
      properties: {
        month: monthParam,
        type: { type: 'string', enum: ['income', 'expense'] },
        category: { type: 'string', description: 'Точное название категории' },
        tag: { type: 'string' },
        search: { type: 'string', description: 'Подстрока в описании, категории, тегах или позициях' },
        limit: { type: 'integer', minimum: 1, maximum: 50 },
      },
    },
  },
  {
    name: 'get_month_summary',
    description: 'Итоги месяца: доходы, расходы, баланс, расходы по категориям, теги и сравнение с прошлым месяцем.',
    parameters: { type: 'object', properties: { month: monthParam }, required: ['month'] },
  },
  {
    name: 'list_accounts',
    description: 'Счета пользователя (карта, наличные, копилка) с текущими балансами.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'get_budget',
    description: 'Лимиты бюджета на месяц по категориям и сколько уже потрачено.',
    parameters: { type: 'object', properties: { month: monthParam }, required: ['month'] },
  },
  {
    name: 'add_transaction',
    description: 'Добавить операцию. Если пользователь перечислил покупки, передай их в items: сумма посчитается из позиций.',
    parameters: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['income', 'expense'] },
        amount: { type: 'number', description: 'Сумма в белорусских рублях, если нет items' },
        category: { type: 'string', enum: [...new Set([...expenseNames, ...incomeNames])] },
        description: { type: 'string' },
        date: { type: 'string', description: 'YYYY-MM-DD, по умолчанию сегодня' },
        account: { type: 'string', description: 'Название счета, например «Основная карта»' },
        tags: { type: 'array', items: { type: 'string' } },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: { name: { type: 'string' }, qty: { type: 'number' }, price: { type: 'number' } },
            required: ['name', 'price'],
          },
        },
      },
      required: ['type', 'category'],
    },
  },
  {
    name: 'set_budget_limit',
    description: 'Установить или изменить лимит бюджета для категории расходов на месяц.',
    parameters: {
      type: 'object',
      properties: { month: monthParam, category: { type: 'string', enum: expenseNames }, limit: { type: 'number' } },
      required: ['month', 'category', 'limit'],
    },
  },
];

function compact(t) {
  return {
    id: String(t._id),
    date: t.date.toISOString().slice(0, 10),
    type: t.type,
    amount: t.amount,
    category: t.category.name,
    description: t.description,
    account: t.account?.name,
    tags: t.tags,
    items: t.items.map((i) => `${i.name} × ${i.qty} по ${i.price}`),
  };
}

const handlers = {
  async list_transactions(userId, args) {
    const items = await services.listTransactions(userId, { ...args, limit: Math.min(args.limit || 20, 50) });
    return { count: items.length, transactions: items.map(compact) };
  },
  get_month_summary: (userId, args) => services.monthStats(userId, args.month),
  async list_accounts(userId) {
    const accounts = await services.listAccounts(userId);
    return accounts.map((a) => ({ id: String(a._id), name: a.name, kind: a.kind, balance: a.balance }));
  },
  async get_budget(userId, args) {
    const budget = await services.getBudget(userId, args.month);
    return {
      month: budget.month,
      limits: budget.limits.map((l) => {
        const percent = l.limit ? Math.round((l.spent / l.limit) * 100) : null;
        return {
          category: l.category,
          limit: l.limit,
          spent: l.spent,
          remaining: Math.round((l.limit - l.spent) * 100) / 100,
          percent,
          status: percent > 100 ? 'превышен' : percent >= 80 ? 'почти исчерпан' : 'в пределах',
        };
      }),
    };
  },
  async add_transaction(userId, args, socketId) {
    let account;
    if (args.account) {
      const re = new RegExp(args.account.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      account = await Account.findOne({ userId, name: re });
    }
    account = account || (await Account.findOne({ userId }).sort({ createdAt: 1 }));
    const created = await services.createTransaction(userId, {
      ...args,
      date: args.date || services.today(),
      account: account?._id ? String(account._id) : undefined,
    });
    notifyUser(userId, 'transaction:changed', { action: 'created', transaction: created }, socketId);
    return { created: compact(created) };
  },
  set_budget_limit: (userId, args) => services.setBudgetLimit(userId, args.month, args.category, args.limit),
};

function describeAction(name, args, result) {
  if (name === 'add_transaction' && result.created) {
    const t = result.created;
    return { kind: 'transaction', text: `${t.type === 'income' ? 'Доход' : 'Расход'} ${t.amount} Br · ${t.category}${t.description ? ` · ${t.description}` : ''}` };
  }
  if (name === 'set_budget_limit') {
    return { kind: 'budget', text: `Лимит «${args.category}» на ${args.month}: ${args.limit} Br` };
  }
  return null;
}

module.exports = { definitions, handlers, describeAction };
