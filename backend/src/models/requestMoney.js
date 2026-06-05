// src/models/requestMoney.js
import mongoose from "mongoose";

// each request entry (one row in the list)
const requestItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },   // who is requesting payment
    sender: { type: String, required: true }, // UPI or wallet of the sender
    amount: { type: Number, required: true }, // must be number
  },
  { _id: true }
);

// parent structure for each user
const requestSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    upi: { type: String },
    metamask: { type: String },

    // array of individual requests received
    requests: { type: [requestItemSchema], default: [] },
  },
  { timestamps: true }
);

const RequestMoney = mongoose.model("RequestMoney", requestSchema);
export default RequestMoney;
