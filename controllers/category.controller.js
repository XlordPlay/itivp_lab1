const { Category } = require('../models');

async function getCategories(req, res) {
  const items = await Category.findAll({ order: [['id', 'ASC']] });
  res.status(200).json(items);
}

module.exports = { getCategories };
