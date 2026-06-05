import mongoose from 'mongoose';

const MoneyTransferSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  senderUPI: {
    type: String,
    required: true,
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  receiverUPI: {
    type: String,
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  savedAmount: {
    type: Number,
    default: 0,
  },
  savePercent: {
    type: Number,
    default: 0,
  },
  totalSavedAmount: {
    type: Number,
    default: 0
  },
  network: {
    type: String,
    enum: ['fiat', 'sepolia'],
    default: 'sepolia'
  },
  txHash: {
    type: String,
    default: null
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

const MoneyTransfer = mongoose.model('MoneyTransfer', MoneyTransferSchema);

export default MoneyTransfer;