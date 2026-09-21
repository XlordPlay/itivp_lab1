# Лабораторная работа №2. PostgreSQL и Sequelize

## Цель

Подключить PostgreSQL к Express-приложению учёта личных финансов, заменить массив из ЛР1 на Sequelize CRUD, выполнить миграцию и сиды.

## ORM

ORM (Object-Relational Mapping) связывает таблицы БД с объектами в коде. Вместо SQL пишешь `Transaction.findAll()`. Плюсы: меньше SQL, модели, миграции, связи. Минусы: скрывает детали БД, сложные запросы иногда проще писать на SQL.

Sequelize по умолчанию делает имя таблицы во множественном числе: модель `Transaction` → таблица `Transactions`, `Category` → `Categories`.

## Модели и связь 1:N

Категория имеет много транзакций:

```js
Category.hasMany(Transaction, { foreignKey: 'categoryId' });
Transaction.belongsTo(Category, { foreignKey: 'categoryId' });
```

Миграция `add-status-to-transactions` добавляет колонку `status`.

## Ответы на контрольные вопросы

**1. Что такое ORM? Плюсы и минусы?**  
Слой между объектами JS и таблицами SQL. Плюсы: скорость разработки, модели, миграции. Минусы: оверхед, не все SQL-запросы удобны.

**2. Как Sequelize преобразует названия моделей в имена таблиц?**  
Pluralize + PascalCase: `Transaction` → `Transactions`. Можно задать `tableName` вручную.

**3. Поиск с WHERE?**  
`Transaction.findAll({ where: { type: 'expense' } })`. У нас ещё кастомный метод `Transaction.getByType(type)`.

**4. Что такое миграции?**  
Версии схемы БД в файлах. Можно накатить (`db:migrate`) и откатить (`db:migrate:undo`). Нужны, чтобы схема совпадала у всех и на проде.

**5. Связь один-ко-многим?**  
`Category.hasMany(Transaction)`, `Transaction.belongsTo(Category)` по `categoryId`. Одна категория — много операций.

**6. Пагинация?**  
`findAll({ limit: 10, offset: 0 })`. В API: `GET /transactions?limit=10&offset=0`.

**7. Ошибка уникальности?**  
`SequelizeUniqueConstraintError` (у нас уникально имя категории). В `errorHandler` ловим и отдаём 400: «Запись с такими данными уже существует».

**8. findByPk vs findOne?**  
`findByPk(id)` — по первичному ключу. `findOne({ where: { ... } })` — по любому условию, вернёт первую подходящую.

**9. Кастомный метод модели?**  
Класс-метод: `Transaction.getByType = function (type) { return this.findAll({ where: { type } }); }`

**10. Типы связей?**  
`hasOne`, `belongsTo` (1:1), `hasMany` / `belongsTo` (1:N), `belongsToMany` (N:N через таблицу-связку).

## Выводы

Массив из ЛР1 заменён на PostgreSQL. CRUD идёт через Sequelize, категории связаны с транзакциями 1:N, поле `status` добавлено миграцией, тестовые данные — сидами. Данные переживают перезапуск сервера.
