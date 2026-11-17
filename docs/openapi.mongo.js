const security = [{ bearerAuth: [] }];
const json = (schema, example) => ({ content: { 'application/json': { schema, ...(example && { example }) } } });
const ok = (description, schema) => ({ description, ...json(schema || { type: 'object' }) });
const errors = {
  400: { $ref: '#/components/responses/BadRequest' },
  401: { description: 'Нет токена или токен истек' },
  404: { $ref: '#/components/responses/NotFound' },
};
const id = (name, description) => ({ name, in: 'path', required: true, schema: { type: 'string' }, description });
const month = { name: 'month', in: 'path', required: true, schema: { type: 'string', example: '2026-11' } };

const transactionExample = {
  type: 'expense',
  category: 'Продукты',
  description: 'Евроопт',
  date: '2026-11-16',
  tags: ['закупка'],
  items: [
    { name: 'Молоко 3,2%', qty: 2, price: 2.59 },
    { name: 'Хлеб «Нарочанский»', qty: 1, price: 1.89 },
  ],
};

const paths = {
  '/mongo/transactions': {
    get: {
      tags: ['MongoDB'],
      security,
      summary: 'Список операций (Model.find)',
      parameters: [
        { name: 'month', in: 'query', schema: { type: 'string', example: '2026-11' } },
        { name: 'type', in: 'query', schema: { type: 'string', enum: ['income', 'expense'] } },
        { name: 'tag', in: 'query', schema: { type: 'string', example: 'кофе' }, description: 'Массив tags содержит значение' },
        { name: 'category', in: 'query', schema: { type: 'string' }, description: 'Поиск по вложенному полю category.name' },
        { name: 'search', in: 'query', schema: { type: 'string' } },
        { name: 'account', in: 'query', schema: { type: 'string' }, description: 'ObjectId счета' },
        { name: 'limit', in: 'query', schema: { type: 'integer', example: 5 } },
        { name: 'offset', in: 'query', schema: { type: 'integer', example: 0 } },
      ],
      responses: { 200: ok('Массив документов', { type: 'array', items: { $ref: '#/components/schemas/MongoTransaction' } }), 401: errors[401] },
    },
    post: {
      tags: ['MongoDB'],
      security,
      summary: 'Создать операцию (Model.create)',
      description: 'Категория сохраняется вложенным документом. Если переданы позиции items, сумма считается по ним.',
      requestBody: { required: true, ...json({ $ref: '#/components/schemas/MongoTransactionInput' }, transactionExample) },
      responses: { 201: ok('Созданный документ', { $ref: '#/components/schemas/MongoTransaction' }), 400: errors[400] },
    },
  },
  '/mongo/transactions/{id}': {
    parameters: [id('id', 'ObjectId операции')],
    get: {
      tags: ['MongoDB'],
      security,
      summary: 'Операция по id (Model.findById + populate)',
      responses: { 200: ok('Документ', { $ref: '#/components/schemas/MongoTransaction' }), 400: errors[400], 404: errors[404] },
    },
    put: {
      tags: ['MongoDB'],
      security,
      summary: 'Обновить операцию (Model.findByIdAndUpdate, new: true)',
      requestBody: { required: true, ...json({ $ref: '#/components/schemas/MongoTransactionInput' }, { description: 'Евроопт, вечерняя закупка', tags: ['закупка', 'акция'] }) },
      responses: { 200: ok('Обновленный документ', { $ref: '#/components/schemas/MongoTransaction' }), 400: errors[400], 404: errors[404] },
    },
    delete: {
      tags: ['MongoDB'],
      security,
      summary: 'Удалить операцию (Model.findByIdAndDelete)',
      description: 'Возвращает удаленный документ в поле deleted.',
      responses: { 200: ok('Удаленный документ'), 400: errors[400], 404: errors[404] },
    },
  },
  '/mongo/transactions/{id}/items': {
    parameters: [id('id', 'ObjectId операции')],
    post: {
      tags: ['MongoDB: вложенные массивы'],
      security,
      summary: 'Добавить позицию чека ($push)',
      requestBody: { required: true, ...json({ $ref: '#/components/schemas/Item' }, { name: 'Кефир', qty: 1, price: 2.1 }) },
      responses: { 201: ok('Документ с новой позицией и пересчитанной суммой'), 404: errors[404] },
    },
  },
  '/mongo/transactions/{id}/items/{itemId}': {
    parameters: [id('id', 'ObjectId операции'), id('itemId', 'ObjectId позиции')],
    patch: {
      tags: ['MongoDB: вложенные массивы'],
      security,
      summary: 'Изменить позицию: { delta } → $inc items.$.qty, иначе $set',
      requestBody: { required: true, ...json({ type: 'object', properties: { delta: { type: 'integer' }, name: { type: 'string' }, qty: { type: 'number' }, price: { type: 'number' } } }, { delta: 1 }) },
      responses: { 200: ok('Документ с измененной позицией'), 400: errors[400], 404: errors[404] },
    },
    delete: {
      tags: ['MongoDB: вложенные массивы'],
      security,
      summary: 'Удалить позицию ($pull)',
      responses: { 200: ok('Документ без позиции'), 404: errors[404] },
    },
  },
  '/mongo/transactions/{id}/tags': {
    parameters: [id('id', 'ObjectId операции')],
    post: {
      tags: ['MongoDB: вложенные массивы'],
      security,
      summary: 'Добавить тег без дублей ($addToSet)',
      requestBody: { required: true, ...json({ type: 'object', properties: { tag: { type: 'string' } } }, { tag: 'акция' }) },
      responses: { 200: ok('Документ с тегом'), 400: errors[400], 404: errors[404] },
    },
  },
  '/mongo/transactions/{id}/tags/{tag}': {
    parameters: [id('id', 'ObjectId операции'), id('tag', 'Тег')],
    delete: { tags: ['MongoDB: вложенные массивы'], security, summary: 'Удалить тег ($pull)', responses: { 200: ok('Документ без тега') } },
  },
  '/mongo/accounts': {
    get: { tags: ['MongoDB'], security, summary: 'Счета с балансами (aggregate)', responses: { 200: ok('Массив счетов') } },
    post: {
      tags: ['MongoDB'],
      security,
      summary: 'Создать счет',
      requestBody: { required: true, ...json({ type: 'object' }, { name: 'Карта для путешествий', kind: 'card', initialBalance: 300, slot: 5 }) },
      responses: { 201: ok('Счет') },
    },
  },
  '/mongo/accounts/{id}': {
    parameters: [id('id', 'ObjectId счета')],
    put: { tags: ['MongoDB'], security, summary: 'Переименовать счет', requestBody: json({ type: 'object' }, { name: 'Зарплатная карта' }), responses: { 200: ok('Счет') } },
    delete: { tags: ['MongoDB'], security, summary: 'Удалить счет и его операции (каскад в pre-hook)', responses: { 200: ok('Удаленный счет и число удаленных операций') } },
  },
  '/mongo/stats': {
    get: {
      tags: ['MongoDB'],
      security,
      summary: 'Итоги месяца (aggregation pipeline)',
      parameters: [{ name: 'month', in: 'query', schema: { type: 'string', example: '2026-11' } }],
      responses: { 200: ok('Доходы, расходы, разбивка по категориям, дням и тегам') },
    },
  },
  '/mongo/budgets/{month}': {
    parameters: [month],
    get: { tags: ['MongoDB: вложенные массивы'], security, summary: 'Бюджет месяца с фактом по категориям', responses: { 200: ok('Лимиты') } },
    put: {
      tags: ['MongoDB: вложенные массивы'],
      security,
      summary: 'Заменить массив лимитов (upsert)',
      requestBody: json({ type: 'object' }, { limits: [{ category: 'Кафе', limit: 250 }, { category: 'Продукты', limit: 400 }] }),
      responses: { 200: ok('Лимиты') },
    },
  },
  '/mongo/budgets/{month}/limits/{category}': {
    parameters: [month, id('category', 'Категория, например Кафе')],
    patch: {
      tags: ['MongoDB: вложенные массивы'],
      security,
      summary: 'Изменить лимит категории (arrayFilters) или добавить ($push)',
      requestBody: json({ type: 'object', properties: { limit: { type: 'number' } } }, { limit: 300 }),
      responses: { 200: ok('Лимиты') },
    },
    delete: { tags: ['MongoDB: вложенные массивы'], security, summary: 'Убрать лимит ($pull)', responses: { 200: ok('Лимиты') } },
  },
  '/mongo/compare/{legacyId}': {
    parameters: [{ name: 'legacyId', in: 'path', required: true, schema: { type: 'integer', example: 2 } }],
    get: {
      tags: ['MongoDB'],
      security,
      summary: 'Одна операция в PostgreSQL (JOIN двух таблиц) и в MongoDB (один документ)',
      responses: { 200: ok('Строки SQL и документ'), 404: errors[404] },
    },
  },
  '/mongo/categories': {
    get: { tags: ['MongoDB'], security, summary: 'Каталог категорий', responses: { 200: ok('Категории доходов и расходов') } },
  },
  '/ai/status': {
    get: { tags: ['AI'], security, summary: 'Настроен ли ассистент', responses: { 200: ok('configured, model') } },
  },
  '/ai/chat': {
    post: {
      tags: ['AI'],
      security,
      summary: 'Сообщение ИИ-ассистенту (OpenRouter, tool calling)',
      requestBody: json({ type: 'object' }, { messages: [{ role: 'user', content: 'Сколько я потратил на кафе в ноябре?' }] }),
      responses: { 200: ok('{ reply, actions }'), 503: { description: 'Не задан OPENROUTER_API_KEY' } },
    },
  },
};

const schemas = {
  Item: {
    type: 'object',
    required: ['name', 'price'],
    properties: { _id: { type: 'string' }, name: { type: 'string' }, qty: { type: 'number', minimum: 1 }, price: { type: 'number', minimum: 0 } },
  },
  MongoTransactionInput: {
    type: 'object',
    properties: {
      type: { type: 'string', enum: ['income', 'expense'] },
      amount: { type: 'number' },
      category: { type: 'string', example: 'Продукты' },
      description: { type: 'string' },
      date: { type: 'string', format: 'date' },
      account: { type: 'string', description: 'ObjectId счета' },
      tags: { type: 'array', items: { type: 'string' } },
      items: { type: 'array', items: { $ref: '#/components/schemas/Item' } },
    },
  },
  MongoTransaction: {
    type: 'object',
    properties: {
      _id: { type: 'string', example: '6afa3383bdd2dda5f2b817af' },
      userId: { type: 'integer' },
      type: { type: 'string' },
      amount: { type: 'number' },
      date: { type: 'string', format: 'date-time' },
      description: { type: 'string' },
      account: { type: 'object', properties: { _id: { type: 'string' }, name: { type: 'string' }, kind: { type: 'string' } } },
      category: { type: 'object', properties: { name: { type: 'string' }, icon: { type: 'string' }, color: { type: 'string' } } },
      tags: { type: 'array', items: { type: 'string' } },
      items: { type: 'array', items: { $ref: '#/components/schemas/Item' } },
    },
  },
};

const tags = [
  { name: 'MongoDB', description: 'ЛР6: CRUD через Mongoose' },
  { name: 'MongoDB: вложенные массивы', description: 'Позиции чека, теги и лимиты бюджета внутри документа' },
  { name: 'AI', description: 'ИИ-ассистент поверх данных MongoDB' },
];

module.exports = { paths, schemas, tags };
