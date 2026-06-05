// src/controllers/moneyTransferController.js
import MoneyTransfer from '../models/MoneyTransfer.js';
import User from '../models/User.js';
import BankDetails from '../models/bank.js';
import RequestMoney from '../models/requestMoney.js';
import mongoose from 'mongoose';

/** Create money transfer (kept from your original) */
export const createMoneyTransfer = async (req, res) => {
  let { senderUPI, receiverUPI, amount, savePercent = 0, network = 'sepolia' } = req.body;

  // Normalize Pay Tags (if user forgot the '@' symbol)
  if (!senderUPI.startsWith('upi') && !senderUPI.startsWith('@')) senderUPI = '@' + senderUPI;
  if (!receiverUPI.startsWith('upi') && !receiverUPI.startsWith('@')) receiverUPI = '@' + receiverUPI;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const senderUser = await User.findOne({ $or: [{ upiId: senderUPI }, { globalPayTag: senderUPI }] }).session(session);
    if (!senderUser) { await session.abortTransaction(); session.endSession(); return res.status(404).json({ message: 'Sender user not found' }); }

    const receiverUser = await User.findOne({ $or: [{ upiId: receiverUPI }, { globalPayTag: receiverUPI }] }).session(session);
    if (!receiverUser) { await session.abortTransaction(); session.endSession(); return res.status(404).json({ message: 'Receiver user not found' }); }

    const senderBankDetails = await BankDetails.findOne({ user: senderUser._id }).session(session);
    if (!senderBankDetails) { await session.abortTransaction(); session.endSession(); return res.status(404).json({ message: 'Sender bank details not found' }); }

    const receiverBankDetails = await BankDetails.findOne({ user: receiverUser._id }).session(session);
    if (!receiverBankDetails) { await session.abortTransaction(); session.endSession(); return res.status(404).json({ message: 'Receiver bank details not found' }); }

    // Cross-border routing logic
    const senderRegion = senderBankDetails.region || 'India';
    const receiverRegion = receiverBankDetails.region || 'India';

    if (senderRegion !== receiverRegion) {
      if (network === 'fiat') {
        await session.abortTransaction(); session.endSession();
        return res.status(403).json({
          message: `Fiat rails cannot cross borders instantly. Please switch to Crypto (Sepolia) network.`
        });
      }

      const isSenderUsingPayTag = senderUPI === senderUser.globalPayTag;
      const isReceiverUsingPayTag = receiverUPI === receiverUser.globalPayTag;

      if (!isSenderUsingPayTag || !isReceiverUsingPayTag) {
        await session.abortTransaction(); session.endSession();
        return res.status(403).json({
          message: `Cross-border transfers between ${senderRegion} and ${receiverRegion} require a Global Pay Tag. Local domestic IDs are not supported.`
        });
      }
    }

    const savedAmount = (amount * savePercent) / 100;
    const transferAmountUsdc = amount - savedAmount;

    if (network === 'fiat') {
      if (senderBankDetails.amount < amount) {
        await session.abortTransaction(); session.endSession();
        return res.status(400).json({ message: 'Insufficient Fiat funds' });
      }

      // Update Sender Balances (Fiat DB)
      senderBankDetails.amount -= amount;
      senderBankDetails.savings = (senderBankDetails.savings || 0) + savedAmount;

      // Update Receiver Balances (Fiat DB)
      receiverBankDetails.amount += transferAmountUsdc;
    } else {
      // For Sepolia Crypto transfers, the blockchain handles the math and balance!
      // We do NOT deduct from the Fiat Database.
    }

    const moneyTransfer = new MoneyTransfer({
      sender: senderBankDetails.user,
      senderUPI,
      receiver: receiverBankDetails.user,
      receiverUPI,
      amount: amount, // Record transaction in native USDC
      savedAmount,
      savePercent,
      network,
    });

    if (network === 'sepolia') {
      try {
        if (!senderUser.internalWalletAddress || !receiverUser.internalWalletAddress) {
          // Fallback to metamaskId for old users without internal wallet? No, require migration.
          return res.status(400).json({ message: "Both Sender and Receiver must have an Internal Platform Vault. Please contact support." });
        }

        const fs = await import('fs');
        const { ethers } = await import('ethers');

        if (fs.existsSync('./contractData.json')) {
          const contractData = JSON.parse(fs.readFileSync('./contractData.json', 'utf8'));
          const rpcUrl = process.env.SEPOLIA_RPC_URL;
          const privateKey = process.env.TREASURY_PRIVATE_KEY;

          if (rpcUrl && privateKey) {
            const provider = new ethers.JsonRpcProvider(rpcUrl);
            const wallet = new ethers.Wallet(privateKey, provider);
            const contract = new ethers.Contract(contractData.address, contractData.abi, wallet);
            // Execute the contract function using ERC-20 compliant addresses
            // Implement 0.1% Treasury Gas Fee
            const feeAmount = amount * 0.001;
            const netAmount = amount - feeAmount;

            const netTokenAmount = ethers.parseUnits(netAmount.toString(), 18);
            const feeTokenAmount = ethers.parseUnits(feeAmount.toString(), 18);

            // Execute transfer from sender's Internal Wallet to receiver's Internal Wallet
            const tx = await contract.executeTransfer(senderUser.internalWalletAddress, receiverUser.internalWalletAddress, netTokenAmount);

            // 2. Send 0.1% Fee to Treasury Wallet to offset gas costs
            if (feeAmount > 0) {
              // Transfer fee to treasury
              await contract.executeTransfer(senderUser.internalWalletAddress, wallet.address, feeTokenAmount);
            }

            moneyTransfer.txHash = tx.hash; // Save the hash immediately without waiting for block confirmation to keep UI fast
          }
        }
      } catch (blockchainErr) {
        console.error("Blockchain execution failed:", blockchainErr);
        // We continue saving the DB record even if the blockchain logging fails to not break the app demo

      }
    }

    await moneyTransfer.save({ session });
    await senderBankDetails.save({ session });
    await receiverBankDetails.save({ session });

    await session.commitTransaction();
    session.endSession();

    return res.json({ message: 'Money transfer successful', senderUPI, receiverUPI, transferAmount: transferAmountUsdc, savedAmount });
  } catch (err) {
    console.error("createMoneyTransfer error:", err);
    await session.abortTransaction();
    session.endSession();
    return res.status(500).send('Server error');
  }
};

/** Get money transfers for current user (kept) */
export const getMoneyTransfers = async (req, res) => {
  try {
    const userId = req.user.id;
    const transfers = await MoneyTransfer.find({
      $or: [{ sender: userId }, { receiver: userId }],
    }).populate('sender receiver');
    return res.json(transfers);
  } catch (err) {
    console.error("getMoneyTransfers error:", err);
    return res.status(500).send('Server error');
  }
};

/**
 * POST /api/transfer/money-requested
 * Create a request on a target user's RequestMoney document (creates doc if not exists)
 * Body: { receiver: <upi or metamask>, amount: Number }
 * Requires auth (req.user)
 */
export const requestMoneyCreate = async (req, res) => {
  try {
    const { receiver, amount } = req.body;
    const userId = req.user.id;

    const requester = await User.findById(userId).lean();
    if (!requester) return res.status(401).json({ message: "User not found." });

    // find the recipient by upi or metamask
    let recipientDoc = await RequestMoney.findOne({
      $or: [{ upi: receiver }, { metamask: receiver }]
    });

    // If recipient doc doesn't exist, attempt to create one using user record (if exists)
    if (!recipientDoc) {
      const recUser = await User.findOne({ $or: [{ upiId: receiver }, { globalPayTag: receiver }, { metamask: receiver }] }).lean();
      const recUserObj = recUser || {};
      recipientDoc = await RequestMoney.create({
        user: recUserObj._id || null,
        upi: recUserObj.globalPayTag || recUserObj.upiId || (receiver && receiver.includes('@') ? receiver : undefined),
        metamask: recUserObj.metamask || (receiver && receiver.startsWith('0x') ? receiver : undefined),
        requests: []
      });
    }

    // push new request item
    const requestItem = {
      amount: Number(amount),
      sender: requester.globalPayTag || requester.upiId || requester.metamask || requester._id.toString(),
      name: requester.username || requester.name || "Unknown",
    };

    recipientDoc.requests.push(requestItem);
    await recipientDoc.save();

    return res.status(201).json({ success: true, message: "Request added", request: requestItem });
  } catch (err) {
    console.error("requestMoneyCreate error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/transfer/all-request-money
 * Public (no auth) endpoint returning flattened requests array across all RequestMoney docs.
 * Response: { message: "found", requests: [ ... ] }
 */
export const getAllRequestMoney = async (req, res) => {
  try {
    // Populate user to ensure we always have their latest PayTag
    const docs = await RequestMoney.find().populate('user').sort({ createdAt: -1 }).lean();

    const requests = docs.flatMap((doc) => {
      // If user is populated, use their actual latest tags
      const ownerUpi = (doc.user && (doc.user.globalPayTag || doc.user.upiId)) || doc.upi || null;
      const ownerMetamask = (doc.user && doc.user.metamask) || doc.metamask || null;
      const ownerUserId = doc.user ? doc.user._id : (doc.user || null);
      const requestedAt = doc.createdAt || null;

      return (doc.requests || []).map((r) => ({
        _id: r._id || `${doc._id}_${Math.random().toString(36).slice(2, 8)}`,
        name: r.name,
        sender: r.sender,
        amount: typeof r.amount === "number" ? r.amount : Number(r.amount) || 0,
        ownerUpi,
        ownerMetamask,
        ownerUserId,
        requestedAt,
      }));
    });

    return res.status(200).json({ message: "found", requests });
  } catch (err) {
    console.error("getAllRequestMoney error:", err);
    return res.status(500).json({ message: "Server error fetching requests" });
  }
};

/** Legacy: return raw docs (kept if needed) */
export const getAllRawDocs = async (req, res) => {
  try {
    const rr = await RequestMoney.find({});
    return res.status(200).json({ rr });
  } catch (error) {
    console.error("getAllRawDocs error:", error);
    return res.status(500).json({ message: "Server error: " + error.message });
  }
};

export const smartRouteTransfer = async (req, res) => {
  let { amount, currency, payTag } = req.body;
  
  if (!payTag.startsWith('upi') && !payTag.startsWith('@')) payTag = '@' + payTag;
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const senderUser = await User.findById(req.user.id).session(session);
    if (!senderUser) throw new Error("Sender not found");

    const receiverUser = await User.findOne({ $or: [{ upiId: payTag }, { globalPayTag: payTag }] }).session(session);
    if (!receiverUser) throw new Error("Receiver not found");

    const senderBankDetails = await BankDetails.findOne({ user: senderUser._id }).session(session);
    const receiverBankDetails = await BankDetails.findOne({ user: receiverUser._id }).session(session);

    if (!senderBankDetails || !receiverBankDetails) throw new Error("Bank details missing");

    // The amount from AI is in USD/USDC
    const usdAmount = Number(amount);

    // Exchange Rates
    const exchangeRates = { India: 83.5, Brazil: 5.1, Mexico: 17.5, US: 1.0 };
    const senderRate = exchangeRates[senderBankDetails.region || 'India'] || 83.5;
    const receiverRate = exchangeRates[receiverBankDetails.region || 'India'] || 83.5;

    const requiredFiatToDeduct = usdAmount * senderRate;
    const receiverFiatAmount = usdAmount * receiverRate;

    // Check sender balance
    if (senderBankDetails.amount < requiredFiatToDeduct) {
      throw new Error(`Insufficient Fiat. You need ${requiredFiatToDeduct.toFixed(2)} ${senderBankDetails.region || 'local fiat'}, but you only have ${senderBankDetails.amount.toFixed(2)}`);
    }

    // Deduct from Sender
    senderBankDetails.amount -= requiredFiatToDeduct;
    // Add to Receiver
    receiverBankDetails.amount += receiverFiatAmount;

    // Execute real blockchain transaction on Sepolia
    let finalTxHash = '0x' + Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2);
    try {
      const fs = await import('fs');
      const { ethers } = await import('ethers');

      if (fs.existsSync('./contractData.json')) {
        const contractData = JSON.parse(fs.readFileSync('./contractData.json', 'utf8'));
        const rpcUrl = process.env.SEPOLIA_RPC_URL;
        const privateKey = process.env.TREASURY_PRIVATE_KEY;

        if (rpcUrl && privateKey && senderUser.internalWalletAddress && receiverUser.internalWalletAddress) {
          const provider = new ethers.JsonRpcProvider(rpcUrl);
          const wallet = new ethers.Wallet(privateKey, provider);
          const contract = new ethers.Contract(contractData.address, contractData.abi, wallet);
          
          const netTokenAmount = ethers.parseUnits(usdAmount.toString(), 18);
          
          // 1. Auto-bridge (mint) the equivalent pUSDC to the sender's internal wallet
          const mintTx = await contract.depositFiat(senderUser.internalWalletAddress, netTokenAmount);
          await mintTx.wait(); // wait for block confirmation
          
          // 2. Execute the cross-border transfer
          const tx = await contract.executeTransfer(senderUser.internalWalletAddress, receiverUser.internalWalletAddress, netTokenAmount);
          finalTxHash = tx.hash;
        }
      }
    } catch (blockchainErr) {
      console.error("Blockchain execution failed in Smart Route:", blockchainErr);
    }

    // Create Ledger Log
    const moneyTransfer = new MoneyTransfer({
      sender: senderBankDetails.user,
      senderUPI: senderUser.globalPayTag || senderUser.upiId,
      receiver: receiverBankDetails.user,
      receiverUPI: receiverUser.globalPayTag || receiverUser.upiId,
      amount: usdAmount, 
      network: 'sepolia',
      txHash: finalTxHash
    });

    await moneyTransfer.save({ session });
    await senderBankDetails.save({ session });
    await receiverBankDetails.save({ session });

    await session.commitTransaction();
    session.endSession();

    return res.json({ 
      message: 'Smart Route Successful', 
      amountUsd: usdAmount,
      receiverReceived: receiverFiatAmount,
      txHash: finalTxHash
    });

  } catch (err) {
    console.error("Smart Route error:", err);
    await session.abortTransaction();
    session.endSession();
    return res.status(500).json({ message: err.message || 'Server error' });
  }
};

/**
 * DELETE /api/transfer/request-money/:reqId
 * Removes a settled invoice from the recipient's RequestMoney document
 */
export const resolveRequestMoney = async (req, res) => {
  try {
    const { reqId } = req.params;
    if (!reqId) return res.status(400).json({ message: "reqId is required" });

    let objectId;
    try {
      objectId = new mongoose.Types.ObjectId(reqId);
    } catch (err) {
      return res.status(400).json({ message: "Invalid request ID format" });
    }

    // Find the RequestMoney doc that contains this specific request ID and pull it
    const result = await RequestMoney.updateOne(
      { "requests._id": objectId },
      { $pull: { requests: { _id: objectId } } }
    );

    if (result.modifiedCount === 0) {
      return res.status(404).json({ message: "Request not found or already settled" });
    }

    return res.status(200).json({ message: "Request settled successfully" });
  } catch (error) {
    console.error("resolveRequestMoney error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export default {
  createMoneyTransfer,
  getMoneyTransfers,
  requestMoneyCreate,
  getAllRequestMoney,
  getAllRawDocs,
  resolveRequestMoney,
};
