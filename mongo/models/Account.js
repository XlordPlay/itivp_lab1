const { Schema, model } = require('mongoose');

const accountSchema = new Schema(
  {
    userId: { type: Number, required: true, index: true },
    name: { type: String, required: [true, 'Название счета обязательно'], trim: true, maxlength: 40 },
    kind: { type: String, enum: ['card', 'cash', 'savings'], default: 'card' },
    initialBalance: { type: Number, default: 0 },
    slot: { type: Number, min: 1, max: 8, default: 1 },
  },
  { timestamps: true },
);

// Каскадное удаление: при удалении счета удаляются все его операции
accountSchema.pre('findOneAndDelete', async function () {
  const account = await this.model.findOne(this.getFilter());
  if (account) await model('Transaction').deleteMany({ account: account._id });
});

module.exports = model('Account', accountSchema);
