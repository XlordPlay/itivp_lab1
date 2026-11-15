# Personal Finance API

Система учета личных финансов. ЛР2: PostgreSQL + Sequelize.

## Запуск

```bash
cp .env.example .env
docker compose up -d
npm install
npx sequelize-cli db:migrate
npx sequelize-cli db:seed:all
npm run dev
```

Swagger: http://localhost:3000/docs

## Маршруты

- `POST /auth/register`, `POST /auth/login`
- `GET/POST /transactions` (параметры `limit`, `offset`, `search`)
- `GET/PUT/DELETE /transactions/:id`
- `GET /categories`

Маршруты `/transactions` требуют заголовок `Authorization: Bearer <token>`.

Поля транзакции: `type`, `amount`, `categoryId`, `description`, `date`, `status` (поле `status` добавлено миграцией).

## Клиент (ЛР5)

React-приложение в папке `client` работает с этим API через axios: вход по JWT, CRUD операций с оптимистичным обновлением, серверный поиск с debounce и отменой запросов (AbortController).

```bash
cd client
cp .env.example .env
npm install
npm run dev
```

Приложение: http://localhost:5173. Сервер должен быть запущен на http://localhost:3000.
Пользователя можно создать запросом `POST /auth/register` (пароль: от 8 символов, заглавная буква, цифра, спецсимвол).
`VITE_API_DELAY` в `client/.env` добавляет задержку к каждому запросу, чтобы увидеть индикаторы загрузки.
