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
    { name: 'Auth', description: 'Регистрация и вход' },
    { name: 'Transactions', description: 'CRUD финансовых операций' },
    { name: 'Categories', description: 'Категории (1:N с транзакциями)' },
  ],
  paths: {
    '/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Регистрация',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/AuthInput' },
              example: { email: 'user@mail.com', password: 'Secret1!' },
            },
          },
        },
        responses: {
          201: { description: 'Пользователь создан' },
          400: { $ref: '#/components/responses/BadRequest' },
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Вход, выдача JWT',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/AuthInput' },
              example: { email: 'user@mail.com', password: 'Secret1!' },
            },
          },
        },
        responses: {
          200: { description: 'Токен' },
          401: { description: 'Неверные данные' },
        },
      },
    },
    '/profile': {
      get: {
        tags: ['Auth'],
        summary: 'Текущий пользователь',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Профиль' },
          401: { description: 'Нет или плохой токен' },
        },
      },
    },
    '/categories': {
      get: {
        tags: ['Categories'],
        summary: 'Список категорий',
        responses: {
          200: {
            description: 'Категории',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/Category' } },
              },
            },
          },
        },
      },
    },
    '/transactions': {
      get: {
        tags: ['Transactions'],
        security: [{ bearerAuth: [] }],
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
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', example: 10 },
            description: 'Пагинация: сколько записей вернуть',
          },
          {
            name: 'offset',
            in: 'query',
            schema: { type: 'integer', example: 0 },
            description: 'Пагинация: сколько записей пропустить',
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
        security: [{ bearerAuth: [] }],
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
                    categoryId: 4,
                    description: 'Обед в столовой',
                    date: '2026-09-08',
                    status: 'completed',
                  },
                },
                income: {
                  summary: 'Доход',
                  value: {
                    type: 'income',
                    amount: 15000,
                    categoryId: 1,
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
        security: [{ bearerAuth: [] }],
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
        security: [{ bearerAuth: [] }],
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
                categoryId: 2,
                description: 'Покупка в супермаркете (обновлено)',
                date: '2026-09-02',
                status: 'completed',
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
        security: [{ bearerAuth: [] }],
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
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
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
      AuthInput: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', example: 'user@mail.com' },
          password: { type: 'string', example: 'Secret1!' },
        },
      },
      TransactionType: {
        type: 'string',
        enum: ['income', 'expense'],
      },
      Category: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 2 },
          name: { type: 'string', example: 'Продукты' },
        },
      },
      Transaction: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          type: { $ref: '#/components/schemas/TransactionType' },
          amount: { type: 'number', exclusiveMinimum: 0, example: 4200 },
          description: { type: 'string', example: 'Покупка в супермаркете' },
          date: { type: 'string', format: 'date', example: '2026-09-02' },
          status: { type: 'string', example: 'completed' },
          categoryId: { type: 'integer', example: 2 },
          Category: { $ref: '#/components/schemas/Category' },
        },
      },
      TransactionInput: {
        type: 'object',
        required: ['type', 'amount', 'categoryId'],
        properties: {
          type: { $ref: '#/components/schemas/TransactionType' },
          amount: { type: 'number', exclusiveMinimum: 0, example: 890 },
          categoryId: { type: 'integer', example: 4 },
          description: { type: 'string', example: 'Обед в столовой' },
          date: { type: 'string', format: 'date', example: '2026-09-08' },
          status: { type: 'string', example: 'completed' },
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
