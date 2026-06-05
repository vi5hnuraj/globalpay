// backend/routes/pay.js
import express from 'express';
import { paymentsWrite, paymentsRead } from '../controllers/paymentsController.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

// POST /pay/paymentWrite
router.post('/paymentWrite', authMiddleware, paymentsWrite);

// GET /pay/paymentRead
router.get('/paymentRead', authMiddleware, paymentsRead);

export default router;
