require('dotenv').config();
const bcrypt = require('bcrypt');
const { sequelize, User, Category, Transaction: PgTransaction } = require('../models');
const { connectMongo, mongoose } = require('../mongo/db');
const { Account, Transaction, ImportedTransaction, Budget, Message } = require('../mongo/models');
const { displayName } = require('../realtime');
const { categorySnapshot } = require('../mongo/categories');

const DEMO = { email: 'student@finance.by', password: 'Finance2026!' };
const PARTNER = { email: 'anna@finance.by', password: 'Finance2026!' };
const START = '2026-09-01';
const END = '2026-11-16';

let seed = 20261116;
function rnd() {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}
const pick = (list) => list[Math.floor(rnd() * list.length)];
const between = (a, b) => Math.round((a + rnd() * (b - a)) * 10) / 10;

function* days() {
  for (let d = new Date(`${START}T12:00:00Z`); d <= new Date(`${END}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
    yield new Date(d);
  }
}

const GROCERIES = [
  ['Молоко 3,2%', 2.59], ['Хлеб «Нарочанский»', 1.89], ['Сыр твердый', 12.4], ['Яблоки, кг', 3.2],
  ['Куриное филе', 11.9], ['Гречка', 3.45], ['Яйца, 10 шт', 4.3], ['Бананы, кг', 4.1], ['Кефир', 2.1],
  ['Творог 5%', 3.6], ['Макароны', 2.7], ['Помидоры, кг', 6.9], ['Кофе молотый', 15.8], ['Масло сливочное', 5.4],
];
const PHARMACY = [['Витамин D', 18.5], ['Пластыри', 3.2], ['Капли для носа', 7.9], ['Ибупрофен', 4.6]];

async function ensurePostgres() {
  let user = await User.findOne({ where: { email: DEMO.email } });
  if (!user) {
    user = await User.create({ email: DEMO.email, passwordHash: await bcrypt.hash(DEMO.password, 10) });
    console.log('Создан пользователь', DEMO.email);
  }
  if ((await Category.count()) === 0) {
    const cats = await Category.bulkCreate(['Зарплата', 'Продукты', 'Транспорт', 'Кафе'].map((name) => ({ name })));
    const id = Object.fromEntries(cats.map((c) => [c.name, c.id]));
    await PgTransaction.bulkCreate([
      { type: 'income', amount: 2400, description: 'Зарплата за август', date: '2026-08-31', categoryId: id['Зарплата'] },
      { type: 'expense', amount: 86.4, description: 'Покупка в супермаркете', date: '2026-09-02', categoryId: id['Продукты'] },
      { type: 'expense', amount: 63, description: 'Проездной на месяц', date: '2026-09-01', categoryId: id['Транспорт'] },
    ]);
  }
  return user;
}

function buildTransactions(userId, acc) {
  const list = [];
  const add = (date, type, category, amount, description, { account = acc.card, tags = [], items = [] } = {}) => {
    list.push({ userId, date, type, amount, description, account: account._id, tags, items, category: categorySnapshot(type, category) });
  };

  for (const date of days()) {
    const day = date.getUTCDate();
    const weekday = date.getUTCDay();
    const workday = weekday >= 1 && weekday <= 5;

    if (day === 5) add(date, 'income', 'Зарплата', 2650, 'Зарплата', { tags: ['работа'] });
    if (day === 20) add(date, 'income', 'Зарплата', 1150, 'Аванс', { tags: ['работа'] });
    if (day === 1) add(date, 'expense', 'Жильё', 950, 'Аренда квартиры', { tags: ['ежемесячно'] });
    if (day === 1) add(date, 'expense', 'Транспорт', 63, 'Проездной на метро и автобус', { tags: ['ежемесячно'] });
    if (day === 10) add(date, 'expense', 'Жильё', between(128, 162), 'Коммунальные услуги', { tags: ['ежемесячно'] });
    if (day === 3) add(date, 'expense', 'Связь', 28.9, 'Мобильная связь и интернет', { tags: ['ежемесячно'] });
    if (day === 7) add(date, 'expense', 'Подписки', 9.99, 'Музыкальный сервис', { tags: ['подписка'] });
    if (day === 12) add(date, 'expense', 'Подписки', 14.9, 'Онлайн-кинотеатр', { tags: ['подписка'] });
    if (day === 28) add(date, 'income', 'Проценты', between(9, 14), 'Проценты по вкладу', { account: acc.savings });

    if (workday && rnd() < 0.6) add(date, 'expense', 'Кафе', pick([5.5, 6, 6.5, 7.2]), pick(['Капучино', 'Латте', 'Американо']), { account: acc.cash, tags: ['кофе'] });
    if (workday && rnd() < 0.35) add(date, 'expense', 'Кафе', between(16, 32), 'Обед', { tags: ['обед', 'работа'] });

    if (rnd() < 0.42) {
      const count = 3 + Math.floor(rnd() * 5);
      const items = [];
      for (let i = 0; i < count; i++) {
        const [name, price] = pick(GROCERIES);
        const existing = items.find((it) => it.name === name);
        if (existing) existing.qty += 1;
        else items.push({ name, qty: rnd() < 0.25 ? 2 : 1, price });
      }
      add(date, 'expense', 'Продукты', 1, pick(['Евроопт', 'Гиппо', 'Соседи', 'Санта']), { tags: weekday === 6 ? ['закупка'] : [], items });
    }

    if (rnd() < 0.08) add(date, 'expense', 'Транспорт', between(8, 19), 'Такси', { tags: ['такси'] });
    if (weekday === 5 && rnd() < 0.5) add(date, 'expense', 'Развлечения', pick([18, 24, 36, 45]), pick(['Кино', 'Боулинг', 'Квиз', 'Настолки в антикафе']), { tags: ['выходные'] });
  }

  const d = (s) => new Date(`${s}T12:00:00Z`);
  add(d('2026-09-14'), 'income', 'Фриланс', 420, 'Лендинг для кофейни', { tags: ['фриланс'] });
  add(d('2026-10-17'), 'income', 'Фриланс', 560, 'Верстка интернет-магазина', { tags: ['фриланс'] });
  add(d('2026-11-09'), 'income', 'Фриланс', 380, 'Правки по сайту клиента', { tags: ['фриланс'] });
  add(d('2026-09-30'), 'income', 'Кэшбэк', 14.6, 'Кэшбэк за сентябрь');
  add(d('2026-10-31'), 'income', 'Кэшбэк', 17.3, 'Кэшбэк за октябрь');
  add(d('2026-09-21'), 'expense', 'Одежда', 189, 'Куртка на осень', { tags: ['сезон'] });
  add(d('2026-10-25'), 'expense', 'Одежда', 145, 'Ботинки', { tags: ['сезон'] });
  add(d('2026-10-18'), 'expense', 'Подарки', 85, 'Подарок маме на день рождения', { tags: ['семья'] });
  add(d('2026-11-02'), 'expense', 'Образование', 150, 'Курс по React', { tags: ['учёба'] });
  add(d('2026-09-08'), 'expense', 'Образование', 42, 'Учебники к семестру', { tags: ['учёба'] });
  add(d('2026-10-08'), 'expense', 'Здоровье', 1, 'Аптека', { items: PHARMACY.slice(0, 3).map(([name, price]) => ({ name, qty: 1, price })) });
  add(d('2026-11-13'), 'expense', 'Здоровье', 1, 'Аптека', { items: PHARMACY.slice(1).map(([name, price]) => ({ name, qty: 1, price })) });
  add(d('2026-11-07'), 'expense', 'Развлечения', 120, 'Концерт', { tags: ['выходные'] });
  add(d('2026-11-14'), 'expense', 'Кафе', 64.5, 'Ужин в ресторане', { tags: ['выходные'] });
  return list;
}

async function ensureUser({ email, password }) {
  const existing = await User.findOne({ where: { email } });
  if (existing) return existing;
  console.log('Создан пользователь', email);
  return User.create({ email, passwordHash: await bcrypt.hash(password, 10) });
}

async function ensureChat(student, reset) {
  const anna = await ensureUser(PARTNER);
  if (reset) await Message.deleteMany({});
  else if (await Message.exists({})) return;
  const author = (u) => ({ id: u.id, email: u.email, name: displayName(u.email) });
  const at = (s) => new Date(`2026-11-${s}:00+03:00`);
  const family = [
    [anna, '15T19:02', 'Привет! Я внесла коммуналку за октябрь, 141 Br'],
    [student, '15T19:05', 'Отлично. Тогда в ноябре по «Жилью» осталось совсем немного'],
    [anna, '15T19:06', 'Да, лимит почти исчерпан. Давай в этом месяце без доставки еды'],
    [student, '15T19:08', 'Договорились. Продукты беру по выходным в Евроопте, так дешевле'],
    [anna, '16T09:41', 'Купила подарок маме, 85 Br, запишешь в «Подарки»?'],
  ];
  const vacation = [
    [student, '14T21:10', 'Перевёл 200 Br в копилку'],
    [anna, '14T21:12', 'Супер! Уже 1 525 Br из 3 000'],
  ];
  const docs = [
    ...family.map(([u, time, text]) => ({ room: 'family', from: author(u), text, createdAt: at(time), updatedAt: at(time) })),
    ...vacation.map(([u, time, text]) => ({ room: 'vacation', from: author(u), text, createdAt: at(time), updatedAt: at(time) })),
  ];
  await Message.collection.insertMany(docs);
  console.log(`MongoDB: ${docs.length} сообщений в чатах`);
}

async function main() {
  const ifEmpty = process.argv.includes('--if-empty');
  const reset = process.argv.includes('--reset');
  await sequelize.authenticate();
  await connectMongo();
  const user = await ensurePostgres();
  const userId = user.id;
  await ensureChat(user, reset);

  if (ifEmpty && (await Transaction.exists({ userId }))) {
    console.log('MongoDB уже содержит данные, сид пропущен');
    return;
  }
  if (reset || ifEmpty) {
    await Promise.all([
      Account.deleteMany({ userId }),
      Transaction.deleteMany({ userId }),
      ImportedTransaction.deleteMany({ userId }),
      Budget.deleteMany({ userId }),
    ]);
  }

  const [card, cash, savings] = await Account.create([
    { userId, name: 'Основная карта', kind: 'card', initialBalance: 640, slot: 1 },
    { userId, name: 'Наличные', kind: 'cash', initialBalance: 420, slot: 3 },
    { userId, name: 'Копилка', kind: 'savings', initialBalance: 1500, slot: 7 },
  ]);
  const docs = buildTransactions(userId, { card, cash, savings });

  const prepared = docs.map((d) => new Transaction(d).recalcAmount());
  await Transaction.insertMany(prepared);

  const legacy = await PgTransaction.findAll({ include: Category, order: [['id', 'ASC']] });
  await ImportedTransaction.insertMany(legacy.map((row) => ({
    userId,
    legacyId: row.id,
    type: row.type,
    amount: Number(row.amount),
    date: new Date(`${row.date}T12:00:00Z`),
    description: row.description,
    category: categorySnapshot(row.type, row.Category?.name),
    tags: ['postgres', row.status],
  })));

  const limits = [
    ['Продукты', 420], ['Кафе', 260], ['Транспорт', 110], ['Жильё', 1120],
    ['Развлечения', 160], ['Подписки', 30], ['Одежда', 150], ['Здоровье', 60],
  ].map(([category, limit]) => ({ category, limit }));
  await Budget.create([
    { userId, month: '2026-10', limits },
    { userId, month: '2026-11', limits },
  ]);

  console.log(`MongoDB: ${prepared.length} операций, ${legacy.length} перенесено из PostgreSQL, 3 счета, 2 бюджета для ${DEMO.email}`);
}

main()
  .catch((err) => {
    console.error('Сид не выполнен:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
    await sequelize.close();
  });
