import express from 'express';
import { register, login, linking, update, fetchDetail, verifyWeb3KYC } from '../controllers/authController.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

// Public routes
router.post('/register', register);
router.post('/login', login);

// Private routes
router.post('/linking', authMiddleware, linking);
router.put('/update', authMiddleware, update);
router.post('/verify-web3-kyc', authMiddleware, verifyWeb3KYC);

// Fetch user details
// Use GET with query params
router.get('/fetchdetail', authMiddleware, fetchDetail);

export default router;
