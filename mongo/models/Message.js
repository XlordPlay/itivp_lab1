const { Schema, model } = require('mongoose');

const authorSchema = new Schema(
  {
    id: { type: Number, required: true },
    name: { type: String, required: true },
    email: String,
  },
  { _id: false },
);

const messageSchema = new Schema(
  {
    room: { type: String, required: true },
    from: { type: authorSchema, required: true },
    to: { type: Number, default: null },
    text: { type: String, required: true, trim: true, maxlength: [1000, 'Сообщение длиннее 1000 символов'] },
  },
  { timestamps: true },
);

messageSchema.index({ room: 1, createdAt: -1 });

messageSchema.methods.toClient = function () {
  return {
    id: String(this._id),
    room: this.room,
    from: this.from,
    to: this.to,
    text: this.text,
    createdAt: this.createdAt,
  };
};

module.exports = model('Message', messageSchema);
