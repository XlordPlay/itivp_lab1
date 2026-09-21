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

- `GET/POST /transactions`
- `GET/PUT/DELETE /transactions/:id`
- `GET /categories`

Поля транзакции: `type`, `amount`, `categoryId`, `description`, `date`, `status` (поле `status` добавлено миграцией).
