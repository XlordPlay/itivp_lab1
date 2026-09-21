const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Transaction = sequelize.define('Transaction', {
    type: {
      type: DataTypes.ENUM('income', 'expense'),
      allowNull: false,
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: { min: 0.01 },
    },
    description: { type: DataTypes.STRING, defaultValue: '' },
    date: { type: DataTypes.DATEONLY, allowNull: false },
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'completed' },
    categoryId: { type: DataTypes.INTEGER, allowNull: false },
  });

  Transaction.getByType = function (type) {
    return this.findAll({ where: { type }, include: 'Category' });
  };

  return Transaction;
};
