// backend/models/payments.js
import mongoose from "mongoose";

const paymentsSchema = new mongoose.Schema({
  date: { 
    type: Date, 
    required: true, 
    default: Date.now
  },
  toUPI: { 
    type: String, 
    required: true,
    trim: true
  },
  keyword: { 
    type: String, 
    required: false,
    trim: true,
    default: ""
  },
  amount: { 
    type: Number, 
    required: true,
    min: 0
  },
  sender: { 
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  coin: { 
    type: String, 
    required: true,
    enum: ["USDC", "OTHER"],
    default: "USDC"
  },
  txHash: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

const Payments = mongoose.model("Payments", paymentsSchema);

export default Payments;
