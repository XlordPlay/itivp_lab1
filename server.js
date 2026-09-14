const express = require('express');
const swaggerUi = require('swagger-ui-express');
const transactionRoutes = require('./routes/transaction.routes');
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
    docs: '/docs',
    openapi: '/openapi.json',
  });
});

app.get('/openapi.json', (req, res) => {
  res.json(openapi);
});

app.use(
  '/docs',
  swaggerUi.serve,
  swaggerUi.setup(openapi, {
    customSiteTitle: 'Personal Finance API',
    swaggerOptions: {
      persistAuthorization: true,
    },
  })
);

app.use('/transactions', transactionRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
