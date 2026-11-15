const { Schema, model } = require('mongoose');

// Вложенный документ без отдельной коллекции: снимок категории на момент операции
const categorySchema = new Schema(
  {
    name: { type: String, required: true },
    icon: String,
    color: String,
  },
  { _id: false },
);

// Позиция чека. У каждой позиции свой _id, чтобы обновлять ее внутри массива
const itemSchema = new Schema({
  name: { type: String, required: [true, 'Название позиции обязательно'], trim: true, maxlength: 60 },
  qty: { type: Number, default: 1, min: [1, 'Количество не меньше 1'] },
  price: { type: Number, required: true, min: [0, 'Цена не может быть отрицательной'] },
});

const transactionSchema = new Schema(
  {
    userId: { type: Number, required: true },
    type: { type: String, enum: ['income', 'expense'], required: true },
    amount: { type: Number, required: true, min: [0.01, 'Сумма должна быть больше 0'] },
    date: { type: Date, default: Date.now },
    description: { type: String, default: '', trim: true, maxlength: 200 },
    account: { type: Schema.Types.ObjectId, ref: 'Account' },
    category: { type: categorySchema, required: true },
    tags: { type: [String], default: [] },
    items: { type: [itemSchema], default: [] },
    legacyId: Number, // id этой же операции в PostgreSQL (для сравнения моделей)
  },
  { timestamps: true },
);

transactionSchema.index({ userId: 1, date: -1 });
transactionSchema.index({ tags: 1 });

// Метод экземпляра: если есть позиции чека, сумма операции равна их сумме
transactionSchema.methods.recalcAmount = function () {
  if (this.items.length) {
    const total = this.items.reduce((sum, item) => sum + item.qty * item.price, 0);
    this.amount = Math.round(total * 100) / 100;
  }
  return this;
};

transactionSchema.pre('validate', function () {
  this.recalcAmount();
});

// Статический метод: итоги месяца через aggregation pipeline
transactionSchema.statics.monthTotals = function (userId, from, to) {
  return this.aggregate([
    { $match: { userId, date: { $gte: from, $lt: to } } },
    { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } },
  ]);
};

const Transaction = model('Transaction', transactionSchema);
// Операции, перенесенные из PostgreSQL (ЛР2): та же схема, отдельная коллекция
const ImportedTransaction = model('ImportedTransaction', transactionSchema, 'imported_transactions');

module.exports = { Transaction, ImportedTransaction };
