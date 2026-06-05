// server.js
import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';

import authRoutes from './src/routes/auth.js';
import bankRoutes from './src/routes/bank.js';
import flashLoanRoutes from './src/routes/flashLoan.js';
import moneyTransferRoutes from './src/routes/moneyTransferRoutes.js';
import transactionRoutes from './src/routes/transactions.js';
import payRoutes from './src/routes/pay.js'; // ✅ Import new pay route
import paymentRoutes from './src/routes/payment.js';

// Load environment variables
dotenv.config();

// Initialize express
const app = express();

// ✅ Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174'], // allow your React dev servers
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true, // important for cookies or token headers
}));

app.use(express.json());

// ✅ Connect to MongoDB
mongoose.connect(process.env.MONGO_URL)
.then(() => console.log('✅ MongoDB connected successfully'))
.catch((err) => {
  console.error('❌ MongoDB connection error:', err.message);
  process.exit(1);
});

// ✅ Debugging Middleware (optional but helpful)
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// ✅ Routes
app.use('/api/auth', authRoutes);
app.use('/api/bank', bankRoutes);
app.use('/api/flashloan', flashLoanRoutes);
app.use('/api/money-transfer', moneyTransferRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/pay', payRoutes); // ✅ Add /pay route
app.use('/api/payment', paymentRoutes);

// ✅ Default route
app.get('/', (req, res) => {
  res.send('Server is running 🚀');
});

// ✅ Start server
const PORT = process.env.PORT || 5550;
app.listen(PORT, () => console.log(`🚀 Server started on port ${PORT}`));
