// src/routes/moneyTransferRoutes.js
import express from 'express';
import moneyTransferController from '../controllers/moneyTransferController.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/create', authMiddleware, moneyTransferController.createMoneyTransfer);
router.get('/', authMiddleware, moneyTransferController.getMoneyTransfers);
router.post('/money-requested', authMiddleware, moneyTransferController.requestMoneyCreate);

// legacy raw docs
router.get('/request', moneyTransferController.getAllRawDocs);

// IMPORTANT: public, returns flattened { message, requests }
router.get('/all-request-money', moneyTransferController.getAllRequestMoney);

router.delete('/request-money/:reqId', moneyTransferController.resolveRequestMoney);

export default router;
