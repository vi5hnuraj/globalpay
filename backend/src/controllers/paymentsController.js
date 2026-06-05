// backend/controllers/paymentsController.js
import Payments from "../models/payments.js";

// Write a new payment
export const paymentsWrite = async (req, res) => {
  try {
    const { date, to, keyword, amt, coin, txHash } = req.body;
    const sender = req.user && req.user.id;

    if (!sender) return res.status(401).json({ message: "Unauthorized: missing user" });
    if (!to || !amt || !coin) return res.status(400).json({ message: "Missing required fields" });

    if (Number(amt) < 0) return res.status(400).json({ message: "Amount cannot be negative" });

    const newPayment = await Payments.create({
      date: date || undefined,
      toUPI: to,
      keyword: keyword || "",
      amount: Number(amt),
      sender,
      coin,
      txHash: txHash || null
    });

    return res.status(201).json(newPayment);
  } catch (error) {
    console.error("Payments Write Error:", error);
    return res.status(500).json({ message: `Payment write failed: ${error.message}` });
  }
};

// Read payments for logged-in user
export const paymentsRead = async (req, res) => {
  try {
    const sender = req.user && req.user.id;
    if (!sender) return res.status(401).json({ message: "Unauthorized: missing user" });

    const payments = await Payments.find({ sender }).sort({ createdAt: -1 });
    return res.status(200).json(payments);
  } catch (error) {
    console.error("Payments Read Error:", error);
    return res.status(500).json({ message: `Payment read failed: ${error.message}` });
  }
};
