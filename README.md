# Сальдо — учет личных финансов

Курсовой проект по дисциплине «Интернет-технологии и веб-программирование».

- **API**: Node.js + Express 5.
- **Базы**: PostgreSQL (Sequelize) для пользователей и операций ЛР2–ЛР5, MongoDB (Mongoose) для данных ЛР6.
- **Клиент**: React + Vite.
- **ИИ-ассистент**: OpenRouter.

## Запуск в Docker (ЛР6)

```bash
cp .env.example .env        # при желании вставьте OPENROUTER_API_KEY
docker compose up -d --build
```

| Сервис | Адрес |
|---|---|
| Клиент «Сальдо» | http://localhost:5173 |
| API и Swagger | http://localhost:3000, http://localhost:3000/docs |
| mongo-express (просмотр MongoDB) | http://localhost:8082 |
| MongoDB | `mongodb://finance:finance@localhost:27018/finance?authSource=admin` |
| PostgreSQL | `postgres://postgres:postgres@localhost:5432/finance` |

При первом старте контейнер `api` выполняет три шага:
1. применяет миграции PostgreSQL;
2. создает демо-пользователя;
3. наполняет MongoDB данными за сентябрь–ноябрь 2026.

Вход в демо-аккаунт: `student@finance.by` / `Finance2026!`.

Пересоздать демо-данные: `docker compose exec api node scripts/seed-mongo.js --reset`.

## ИИ-ассистент

Ключ берется с https://openrouter.ai/keys. Укажите его в `.env`:

```
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=openai/gpt-4o-mini
```

После этого перезапустите API: `docker compose up -d api`.

Ассистент работает через tool calling:
- читает операции, итоги месяца, счета и бюджет;
- добавляет операции, в том числе с позициями чека;
- меняет лимиты бюджета.

## Чат и уведомления в реальном времени (ЛР7)

Socket.IO работает на том же порту, что и API (3000). Подключение проверяет JWT: клиент передает токен в `auth.token`.

Для проверки откройте http://localhost:5173 в двух разных браузерах (или в обычном окне и окне инкогнито) и войдите под разными пользователями:

- `student@finance.by` / `Finance2026!`
- `anna@finance.by` / `Finance2026!`

Что умеет раздел «Чат»:
- комнаты «Семейный бюджет», «Копим на отпуск» и «Поддержка»;
- личные сообщения: нажмите на пользователя в списке «В сети»;
- индикатор «печатает…» и подтверждение доставки (галочка);
- уведомления о подключении и отключении пользователей;
- история сообщений в MongoDB (коллекция `messages`).

Синхронизация: если открыть «Операции» в двух вкладках одного пользователя и добавить операцию в одной, вторая получит событие `transaction:changed` и обновится сама.

Основные события:

| Событие | Кто отправляет | Назначение |
|---|---|---|
| `room:join` (с подтверждением) | клиент | войти в комнату и получить историю |
| `message:send` (с подтверждением) | клиент | сообщение в комнату |
| `message:new` | сервер | новое сообщение для всей комнаты |
| `message:private` (с подтверждением) | клиент и сервер | личное сообщение |
| `typing` | клиент и сервер | кто-то набирает текст |
| `user:online`, `user:offline`, `presence` | сервер | кто в сети |
| `transaction:changed` | сервер | изменилась операция в другой вкладке |

Код сервера лежит в `realtime/`, модель сообщения — в `mongo/models/Message.js`, клиент — в `client/src/realtime.jsx` и `client/src/pages/Chat.jsx`.

## Локальный запуск без Docker

```bash
docker compose up -d db mongo mongo-express
npm install
npx sequelize-cli db:migrate
node scripts/seed-mongo.js
npm run dev

cd client && cp .env.example .env && npm install && npm run dev
```

## Маршруты

PostgreSQL (ЛР2–ЛР5):
- `POST /auth/register`, `POST /auth/login`;
- `GET/POST /transactions` (параметры `limit`, `offset`, `search`), `GET/PUT/DELETE /transactions/:id`;
- `GET /categories`.

MongoDB (ЛР6, нужен заголовок `Authorization: Bearer <token>`):
- `GET/POST /mongo/transactions`, `GET/PUT/DELETE /mongo/transactions/:id`;
- `POST /mongo/transactions/:id/items` (`$push`), `PATCH …/items/:itemId` (`$inc` по `items.$.qty`), `DELETE …/items/:itemId` (`$pull`);
- `POST /mongo/transactions/:id/tags` (`$addToSet`), `DELETE …/tags/:tag`;
- `GET/POST /mongo/accounts`, `PUT/DELETE /mongo/accounts/:id` (каскадное удаление операций);
- `GET /mongo/stats?month=YYYY-MM` (aggregation pipeline);
- `GET/PUT /mongo/budgets/:month`, `PATCH/DELETE /mongo/budgets/:month/limits/:category` (`arrayFilters`);
- `GET /mongo/compare/:legacyId` — одна операция в PostgreSQL и в MongoDB;
- `POST /ai/chat`, `GET /ai/status`.

Модели Mongoose лежат в `mongo/models`, общая логика — в `mongo/services.js`, агент — в `ai/`.
