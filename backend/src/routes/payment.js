import express from 'express';
import { createCheckoutSession, verifySession } from '../controllers/paymentController.js';
import { createMoneyTransfer, getMoneyTransfers, smartRouteTransfer } from '../controllers/moneyTransferController.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/create-checkout-session', authMiddleware, createCheckoutSession);
router.post('/verify-session', authMiddleware, verifySession);
router.post('/money-transfer/create', authMiddleware, createMoneyTransfer);
router.post('/smart-route', authMiddleware, smartRouteTransfer);

export default router;
