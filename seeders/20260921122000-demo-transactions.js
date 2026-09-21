'use strict';

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const [categories] = await queryInterface.sequelize.query(
      'SELECT id, name FROM "Categories";'
    );
    const idByName = Object.fromEntries(categories.map((c) => [c.name, c.id]));

    await queryInterface.bulkInsert('Transactions', [
      {
        type: 'income',
        amount: 85000,
        description: 'Зарплата за август',
        date: '2026-08-31',
        status: 'completed',
        categoryId: idByName['Зарплата'],
        createdAt: now,
        updatedAt: now,
      },
      {
        type: 'expense',
        amount: 4200,
        description: 'Покупка в супермаркете',
        date: '2026-09-02',
        status: 'completed',
        categoryId: idByName['Продукты'],
        createdAt: now,
        updatedAt: now,
      },
      {
        type: 'expense',
        amount: 1500,
        description: 'Проездной на месяц',
        date: '2026-09-01',
        status: 'completed',
        categoryId: idByName['Транспорт'],
        createdAt: now,
        updatedAt: now,
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('Transactions', null, {});
  },
};
