import express from 'express';
import { addBankDetails, getAllUsers, linking, swapToCrypto, swapToFiat } from '../controllers/bankcontoller.js';
import authMiddleware from '../middleware/authMiddleware.js';
import { getLoggedUserDetails } from '../controllers/bankcontoller.js';

const router = express.Router();

router.post('/add',authMiddleware, addBankDetails);
router.get('/all-users',authMiddleware, getAllUsers);
router.get('/user-details',authMiddleware, getLoggedUserDetails);
router.post('/linking', authMiddleware,linking);
router.post('/swap-to-crypto', authMiddleware, swapToCrypto);
router.post('/swap-to-fiat', authMiddleware, swapToFiat);

export default router;