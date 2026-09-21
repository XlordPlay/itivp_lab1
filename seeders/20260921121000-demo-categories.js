'use strict';

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    await queryInterface.bulkInsert('Categories', [
      { name: 'Зарплата', createdAt: now, updatedAt: now },
      { name: 'Продукты', createdAt: now, updatedAt: now },
      { name: 'Транспорт', createdAt: now, updatedAt: now },
      { name: 'Кафе', createdAt: now, updatedAt: now },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('Categories', null, {});
  },
};
