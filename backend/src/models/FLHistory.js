import mongoose from 'mongoose';

const FLHistorySchema = new mongoose.Schema({
  address: { type: String, required: true },
  date: { type: String },
  token: { type: String },
  loan: { type: String },
  pl: { type: String },
  createdAt: { type: Date, default: Date.now }
});

const FLHistory = mongoose.model('FLHistory', FLHistorySchema);

export default FLHistory;