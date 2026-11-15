const catalog = require('../shared/categories.json');

// Снимок категории для вложенного документа: название, иконка и цвет из каталога
function categorySnapshot(type, name) {
  const list = catalog[type] || catalog.expense;
  const found = list.find((c) => c.name.toLowerCase() === String(name || '').toLowerCase())
    || list.find((c) => c.name === 'Прочее');
  return { name: found.name, icon: found.icon, color: catalog.palette[found.slot] };
}

module.exports = { catalog, categorySnapshot };
