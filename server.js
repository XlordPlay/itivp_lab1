require('dotenv').config();
const express = require('express');
const swaggerUi = require('swagger-ui-express');
const { sequelize } = require('./models');
const transactionRoutes = require('./routes/transaction.routes');
const categoryRoutes = require('./routes/category.routes');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const openapi = require('./docs/openapi');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    name: 'Personal Finance API',
    description: 'REST API системы учета личных финансов',
    resource: '/transactions',
    categories: '/categories',
    docs: '/docs',
  });
});

app.get('/openapi.json', (req, res) => {
  res.json(openapi);
});

app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapi, { customSiteTitle: 'Personal Finance API' }));
app.use('/categories', categoryRoutes);
app.use('/transactions', transactionRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

sequelize.authenticate().then(() => {
  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}).catch((err) => {
  console.error('Не удалось подключиться к БД:', err.message);
  process.exit(1);
});
