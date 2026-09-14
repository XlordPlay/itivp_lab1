const transactions = [
  {
    id: 1,
    type: 'income',
    amount: 85000,
    category: 'Зарплата',
    description: 'Зарплата за август',
    date: '2026-08-31',
  },
  {
    id: 2,
    type: 'expense',
    amount: 4200,
    category: 'Продукты',
    description: 'Покупка в супермаркете',
    date: '2026-09-02',
  },
  {
    id: 3,
    type: 'expense',
    amount: 1500,
    category: 'Транспорт',
    description: 'Проездной на месяц',
    date: '2026-09-01',
  },
];

let nextId = 4;

const ALLOWED_TYPES = ['income', 'expense'];

function getAll({ type, category } = {}) {
  return transactions.filter((item) => {
    if (type && item.type !== type) return false;
    if (category && item.category.toLowerCase() !== String(category).toLowerCase()) {
      return false;
    }
    return true;
  });
}

function getById(id) {
  return transactions.find((item) => item.id === id) || null;
}

function create(data) {
  const transaction = {
    id: nextId++,
    type: data.type,
    amount: data.amount,
    category: data.category,
    description: data.description || '',
    date: data.date || new Date().toISOString().slice(0, 10),
  };
  transactions.push(transaction);
  return transaction;
}

function update(id, data) {
  const index = transactions.findIndex((item) => item.id === id);
  if (index === -1) return null;

  const updated = {
    id,
    type: data.type,
    amount: data.amount,
    category: data.category,
    description: data.description || '',
    date: data.date || transactions[index].date,
  };
  transactions[index] = updated;
  return updated;
}

function remove(id) {
  const index = transactions.findIndex((item) => item.id === id);
  if (index === -1) return false;
  transactions.splice(index, 1);
  return true;
}

function validate(data, { partial = false } = {}) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return 'Тело запроса должно быть JSON-объектом';
  }

  const required = ['type', 'amount', 'category'];
  if (!partial) {
    for (const field of required) {
      if (data[field] === undefined || data[field] === null || data[field] === '') {
        return `Поле "${field}" обязательно`;
      }
    }
  }

  if (data.type !== undefined && !ALLOWED_TYPES.includes(data.type)) {
    return 'Поле "type" должно быть "income" или "expense"';
  }

  if (data.amount !== undefined) {
    if (typeof data.amount !== 'number' || Number.isNaN(data.amount) || data.amount <= 0) {
      return 'Поле "amount" должно быть положительным числом';
    }
  }

  if (data.category !== undefined && typeof data.category !== 'string') {
    return 'Поле "category" должно быть строкой';
  }

  if (data.description !== undefined && typeof data.description !== 'string') {
    return 'Поле "description" должно быть строкой';
  }

  if (data.date !== undefined && (typeof data.date !== 'string' || Number.isNaN(Date.parse(data.date)))) {
    return 'Поле "date" должно быть корректной датой (YYYY-MM-DD)';
  }

  return null;
}

module.exports = {
  getAll,
  getById,
  create,
  update,
  remove,
  validate,
};
