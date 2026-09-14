const openapi = {
  openapi: '3.0.3',
  info: {
    title: 'Personal Finance API',
    version: '1.0.0',
    description:
      'REST API системы учета личных финансов. Ресурс `transactions` — доходы и расходы.',
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Локальный сервер',
    },
  ],
  tags: [
    {
      name: 'Transactions',
      description: 'CRUD финансовых операций',
    },
  ],
  paths: {
    '/transactions': {
      get: {
        tags: ['Transactions'],
        summary: 'Список транзакций',
        description: 'Можно фильтровать через query string.',
        parameters: [
          {
            name: 'type',
            in: 'query',
            schema: { $ref: '#/components/schemas/TransactionType' },
            description: 'Фильтр по типу: income или expense',
          },
          {
            name: 'category',
            in: 'query',
            schema: { type: 'string', example: 'Продукты' },
            description: 'Фильтр по категории',
          },
        ],
        responses: {
          200: {
            description: 'Список транзакций',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Transaction' },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Transactions'],
        summary: 'Создать транзакцию',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/TransactionInput' },
              examples: {
                expense: {
                  summary: 'Расход',
                  value: {
                    type: 'expense',
                    amount: 890,
                    category: 'Кафе',
                    description: 'Обед в столовой',
                    date: '2026-09-08',
                  },
                },
                income: {
                  summary: 'Доход',
                  value: {
                    type: 'income',
                    amount: 15000,
                    category: 'Фриланс',
                    description: 'Оплата за проект',
                  },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Транзакция создана',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Transaction' },
              },
            },
          },
          400: { $ref: '#/components/responses/BadRequest' },
        },
      },
    },
    '/transactions/{id}': {
      get: {
        tags: ['Transactions'],
        summary: 'Транзакция по id',
        parameters: [{ $ref: '#/components/parameters/TransactionId' }],
        responses: {
          200: {
            description: 'Найденная транзакция',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Transaction' },
              },
            },
          },
          400: { $ref: '#/components/responses/BadRequest' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
      put: {
        tags: ['Transactions'],
        summary: 'Полностью обновить транзакцию',
        parameters: [{ $ref: '#/components/parameters/TransactionId' }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/TransactionInput' },
              example: {
                type: 'expense',
                amount: 5100,
                category: 'Продукты',
                description: 'Покупка в супермаркете (обновлено)',
                date: '2026-09-02',
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Обновлённая транзакция',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Transaction' },
              },
            },
          },
          400: { $ref: '#/components/responses/BadRequest' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
      delete: {
        tags: ['Transactions'],
        summary: 'Удалить транзакцию',
        parameters: [{ $ref: '#/components/parameters/TransactionId' }],
        responses: {
          200: {
            description: 'Транзакция удалена',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/DeleteMessage' },
                example: { message: 'Транзакция с id=3 удалена' },
              },
            },
          },
          400: { $ref: '#/components/responses/BadRequest' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
  },
  components: {
    parameters: {
      TransactionId: {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'integer', minimum: 1, example: 1 },
        description: 'Идентификатор транзакции',
      },
    },
    schemas: {
      TransactionType: {
        type: 'string',
        enum: ['income', 'expense'],
      },
      Transaction: {
        type: 'object',
        required: ['id', 'type', 'amount', 'category', 'description', 'date'],
        properties: {
          id: { type: 'integer', example: 1 },
          type: { $ref: '#/components/schemas/TransactionType' },
          amount: { type: 'number', exclusiveMinimum: 0, example: 4200 },
          category: { type: 'string', example: 'Продукты' },
          description: { type: 'string', example: 'Покупка в супермаркете' },
          date: { type: 'string', format: 'date', example: '2026-09-02' },
        },
      },
      TransactionInput: {
        type: 'object',
        required: ['type', 'amount', 'category'],
        properties: {
          type: { $ref: '#/components/schemas/TransactionType' },
          amount: { type: 'number', exclusiveMinimum: 0, example: 890 },
          category: { type: 'string', example: 'Кафе' },
          description: { type: 'string', example: 'Обед в столовой' },
          date: {
            type: 'string',
            format: 'date',
            example: '2026-09-08',
            description: 'Если не передать, подставится сегодняшняя дата',
          },
        },
      },
      Error: {
        type: 'object',
        required: ['error'],
        properties: {
          error: { type: 'string', example: 'Транзакция с id=999 не найдена' },
        },
      },
      DeleteMessage: {
        type: 'object',
        required: ['message'],
        properties: {
          message: { type: 'string' },
        },
      },
    },
    responses: {
      BadRequest: {
        description: 'Неверные данные запроса',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: { error: 'Поле "amount" обязательно' },
          },
        },
      },
      NotFound: {
        description: 'Ресурс не найден',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: { error: 'Транзакция с id=999 не найдена' },
          },
        },
      },
    },
  },
};

module.exports = openapi;
