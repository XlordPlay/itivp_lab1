const express = require('express');
const controller = require('../controllers/transaction.controller');

const router = express.Router();

router.get('/', controller.getTransactions);
router.get('/:id', controller.getTransactionById);
router.post('/', controller.createTransaction);
router.put('/:id', controller.updateTransaction);
router.delete('/:id', controller.deleteTransaction);

module.exports = router;
