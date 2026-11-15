const { Schema, model } = require('mongoose');

const limitSchema = new Schema(
  {
    category: { type: String, required: true },
    limit: { type: Number, required: true, min: [0, 'Лимит не может быть отрицательным'] },
  },
  { _id: false },
);

// Бюджет месяца: один документ с массивом лимитов по категориям
const budgetSchema = new Schema(
  {
    userId: { type: Number, required: true },
    month: { type: String, required: true, match: [/^\d{4}-\d{2}$/, 'Месяц в формате ГГГГ-ММ'] },
    limits: { type: [limitSchema], default: [] },
  },
  { timestamps: true },
);

budgetSchema.index({ userId: 1, month: 1 }, { unique: true });

module.exports = model('Budget', budgetSchema);
