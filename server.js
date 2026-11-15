require('dotenv').config();
const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const { sequelize } = require('./models');
const transactionRoutes = require('./routes/transaction.routes');
const categoryRoutes = require('./routes/category.routes');
const authRoutes = require('./routes/auth');
const mongoRoutes = require('./routes/mongo.routes');
const aiRoutes = require('./routes/ai.routes');
const { connectMongo } = require('./mongo/db');
const auth = require('./middleware/auth');
const { profile } = require('./controllers/auth.controller');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const openapi = require('./docs/openapi');

const app = express();
const port = process.env.PORT || 3000;

// React-клиент работает на другом порту (5173), поэтому браузеру нужен CORS
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    name: 'Personal Finance API',
    description: 'REST API системы учета личных финансов',
    resource: '/transactions',
    categories: '/categories',
    mongo: '/mongo/transactions',
    assistant: '/ai/chat',
    docs: '/docs',
  });
});

app.get('/openapi.json', (req, res) => {
  res.json(openapi);
});

app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapi, { customSiteTitle: 'Personal Finance API' }));
app.use('/auth', authRoutes);
app.get('/profile', auth, profile);
app.use('/categories', categoryRoutes);
app.use('/transactions', auth, transactionRoutes);

// ЛР6: те же финансовые данные в MongoDB (Mongoose) и ИИ-ассистент поверх них
app.use('/mongo', auth, mongoRoutes);
app.use('/ai', auth, aiRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

Promise.all([sequelize.authenticate(), connectMongo()]).then(() => {
  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}).catch((err) => {
  console.error('Не удалось подключиться к БД:', err.message);
  process.exit(1);
});
