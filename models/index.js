require('dotenv').config();
const { Sequelize } = require('sequelize');
const env = process.env.NODE_ENV || 'development';
const config = require('../config/config.js')[env];

const sequelize = new Sequelize(process.env[config.use_env_variable], config);

const db = {
  sequelize,
  Sequelize,
  Category: require('./category')(sequelize),
  Transaction: require('./transaction')(sequelize),
  User: require('./user')(sequelize),
};

db.Category.hasMany(db.Transaction, { foreignKey: 'categoryId' });
db.Transaction.belongsTo(db.Category, { foreignKey: 'categoryId' });

module.exports = db;
