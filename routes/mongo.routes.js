const express = require('express');
const transactions = require('../controllers/mongo/transactions.controller');
const accounts = require('../controllers/mongo/accounts.controller');
const insights = require('../controllers/mongo/insights.controller');

const router = express.Router();

router.get('/categories', insights.categories);
router.get('/stats', insights.stats);
router.get('/compare/:legacyId', insights.compare);

router.get('/transactions', transactions.list);
router.post('/transactions', transactions.create);
router.get('/transactions/:id', transactions.getOne);
router.put('/transactions/:id', transactions.update);
router.delete('/transactions/:id', transactions.remove);

router.post('/transactions/:id/items', transactions.addItem);
router.patch('/transactions/:id/items/:itemId', transactions.updateItem);
router.delete('/transactions/:id/items/:itemId', transactions.removeItem);
router.post('/transactions/:id/tags', transactions.addTag);
router.delete('/transactions/:id/tags/:tag', transactions.removeTag);

router.get('/accounts', accounts.list);
router.post('/accounts', accounts.create);
router.put('/accounts/:id', accounts.update);
router.delete('/accounts/:id', accounts.remove);

router.get('/budgets/:month', insights.budget);
router.put('/budgets/:month', insights.replaceBudget);
router.patch('/budgets/:month/limits/:category', insights.patchLimit);
router.delete('/budgets/:month/limits/:category', insights.removeLimit);

module.exports = router;
