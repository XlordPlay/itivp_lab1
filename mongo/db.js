const mongoose = require('mongoose');

// Подключение к MongoDB. Строка подключения берется из .env (MONGO_URI)
async function connectMongo() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('MongoDB connected');
}

module.exports = { connectMongo, mongoose };
