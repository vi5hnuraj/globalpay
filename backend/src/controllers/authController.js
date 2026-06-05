import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { JWT_SECRET } from '../config/config.js';

// ==================== Register a new user ====================
export const register = async (req, res) => {
  const { email, password, name } = req.body;

  try {
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user
    const newUser = new User({ email, password: hashedPassword, name });
    await newUser.save();

    // Generate JWT
    const payload = { user: { id: newUser.id } };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

    res.status(201).json({ token });
  } catch (err) {
    console.error("Register error:", err.message);
    res.status(500).json({ message: 'Server error during registration' });
  }
};

// ==================== User login ====================
export const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid Credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid Credentials' });

    const payload = { user: { id: user.id } };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

    res.status(200).json({ token });
  } catch (err) {
    console.error("Login error:", err.message);
    res.status(500).json({ message: 'Server error during login' });
  }
};

// ==================== Link UPI, Metamask, Bank ====================
export const linking = async (req, res) => {
  try {
    const { upi, metamask, bankDetails, region } = req.body;
    const user = req.user; // from authMiddleware
    if (!user) return res.status(401).json({ message: 'Unauthorized' });

    // Update user info
    user.upiId = upi || user.upiId;
    user.metamaskId = metamask || user.metamaskId;
    user.bankDetails = bankDetails || user.bankDetails;
    user.kyc = true; // mark KYC as completed
    if (region) user.region = region; // save region (India/Brazil/Mexico)

    const updatedUser = await user.save();
    res.status(200).json({ message: 'Links updated successfully', user: updatedUser });
  } catch (error) {
    console.error("Linking error:", error.message);
    res.status(500).json({ message: 'Server error while updating links' });
  }
};

// ==================== Update user details ====================
export const update = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: 'Unauthorized' });

    const { name, mob, age, dob, address, status } = req.body;

    user.name = name || user.name;
    user.mobile = mob || user.mobile;
    user.age = age || user.age;
    user.dob = dob || user.dob;
    user.address = address || user.address;
    user.status = status || user.status;

    const updatedUser = await user.save();
    res.status(200).json({ message: 'User updated successfully', user: updatedUser });
  } catch (error) {
    console.error("Update error:", error.message);
    res.status(500).json({ message: 'Server error while updating user' });
  }
};

// ==================== Fetch user details ====================
// ==================== Fetch user details ====================
export const fetchDetail = async (req, res) => {
  try {
    const { waddr, email, upi } = req.query;

    let user;

    if (waddr) {
      user = await User.findOne({ metamaskId: waddr }).select('-password');
    } else if (email) {
      user = await User.findOne({ email }).select('-password');
    } else if (upi) {
      user = await User.findOne({ $or: [{ upiId: upi }, { globalPayTag: upi }] }).select('-password');
    } else {
      // fallback: use logged-in user id from JWT
      user = await User.findById(req.user.id).select('-password');
    }

    if (!user) return res.status(404).json({ message: 'User not found' });

    // Auto-generate global PayTag dynamically for legacy users, without mutating the DB
    let displayPayTag = user.globalPayTag;
    if (user.global_verified && !displayPayTag) {
      const regionCode = user.region ? user.region.toLowerCase().slice(0, 2) : 'gl';
      const baseName = user.name ? user.name.toLowerCase().replace(/\s+/g, '') : 'user';
      displayPayTag = `@${baseName}_${regionCode}`;
    }

    const { default: BankDetails } = await import('../models/bank.js');
    const bankDetailsRecord = await BankDetails.findOne({ user: user._id });

    // Send full user including _id
    res.status(200).json({
      _id: user._id,            // <-- added _id
      username: user.name,
      email: user.email,
      metamask: user.metamaskId,
      internalWalletAddress: user.internalWalletAddress,
      externalWallet: user.externalWallet,
      upi: user.upiId,
      bankDetails: bankDetailsRecord || user.bankDetails,
      kyc: user.kyc,
      kycProvider: user.kycProvider,
      global_verified: user.global_verified,
      globalPayTag: displayPayTag,
      region: bankDetailsRecord ? bankDetailsRecord.region : user.region,
      mobile: user.mobile,
      age: user.age,
      dob: user.dob,
      address: user.address,
      status: user.status,
    });
  } catch (error) {
    console.error("Fetch detail error:", error.message);
    res.status(500).json({ message: 'Server error while fetching user details' });
  }
};

// ==================== Verify Web3 KYC ====================
export const verifyWeb3KYC = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: 'Unauthorized' });

    const { kycProvider, walletAddress } = req.body;

    user.global_verified = true;
    user.kyc = true; // Fully verified
    user.kycProvider = kycProvider || 'Gitcoin';

    if (walletAddress) {
      user.metamaskId = walletAddress; // Store the connected wallet
    }

    // Auto-generate global PayTag if not already present
    if (!user.globalPayTag) {
      const regionCode = user.region ? user.region.toLowerCase().slice(0, 2) : 'gl';
      const baseName = user.name ? user.name.toLowerCase().replace(/\s+/g, '') : 'user';
      user.globalPayTag = `@${baseName}_${regionCode}`;
    }

    // Generate Internal Platform Vault
    if (!user.internalWalletAddress) {
      const { ethers } = await import('ethers');
      const wallet = ethers.Wallet.createRandom();
      user.internalWalletAddress = wallet.address;
      user.walletPrivateKey = wallet.privateKey;
    }

    const updatedUser = await user.save();

    // KYC Airdrop logic placeholder
    try {
      // Internal wallet generation bypassed since user provides their external Metamask

      // 2. Airdrop Removed for Production Security
      // Balances start at 0. Users must use the Fiat Bridge to obtain pUSDC.
    } catch (airdropErr) {
      console.error("Failed to execute Web3 airdrop:", airdropErr);
      // We don't fail the whole KYC process if the airdrop fails
    }

    res.status(200).json({ message: 'Web3 KYC verified successfully. Web3 Wallet generated.', user: updatedUser });
  } catch (error) {
    console.error("verifyWeb3KYC error:", error.message);
    res.status(500).json({ message: 'Server error during Web3 verification' });
  }
};
