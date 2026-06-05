import BankDetails from '../models/bank.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import MoneyTransfer from '../models/MoneyTransfer.js';
import requestMoney from '../models/requestMoney.js';
import SystemCache from '../models/SystemCache.js';

const generateUpiId = () => {
  return `upi${crypto.randomBytes(6).toString('hex')}`;
};

export const linking = async (req, res) => {
  try {
    const { upi, metamask } = req.body;
    const userId = req.user.id;
    console.log(userId);
    if (!upi || !metamask) {
      return res.status(400).json({ message: 'UPI and Metamask IDs are required' });
    }

    const r = await requestMoney.create(
      {
        user: userId,
        upi: upi,
        metamask: metamask,
      });

    const updatedUser = await User.findOneAndUpdate(
      { _id: userId },
      {
        $set: {
          upiId: upi,
          metamaskId: metamask,
          requests: r._id,
        },
        kyc: true,
      },
      { new: true }
    );

    await updatedUser.save();
    if (!updatedUser) {
      return res.status(500).json({ message: 'Failed to update user', updatedUser });
    }

    return res.status(200).json({ message: 'Links updated successfully', user: updatedUser });

  } catch (error) {
    const { bid } = req.body;
    await BankDetails.deleteOne({ _id: bid });
    return res.status(500).json({ message: 'Server updating error: ' + error });
  }
};

export const addBankDetails = async (req, res) => {
  const { bankName, ifscCode, accountHolder, accountAddress, accountType, amount, region, customPayTag } = req.body;
  const userId = req.user.id;

  try {
    // Convert local currency to USDC at deposit time
    const exchangeRates = { India: 83, Brazil: 5.1, Mexico: 17.5 };
    const rate = exchangeRates[region] || 83;
    const usdcBalance = parseFloat((Number(amount) / rate).toFixed(4));

    let bankDetails = await BankDetails.findOne({ user: userId });
    let finalUpiId;

    if (bankDetails) {
      // Update existing
      bankDetails.bankName = bankName;
      bankDetails.ifscCode = ifscCode;
      bankDetails.accountHolder = accountHolder;
      bankDetails.accountAddress = accountAddress;
      bankDetails.accountType = accountType;
      bankDetails.amount = amount;
      bankDetails.region = region || '';
      bankDetails.usdcBalance = usdcBalance;
      if (customPayTag) {
        bankDetails.upiId = customPayTag.toLowerCase();
      }
      finalUpiId = bankDetails.upiId;
      await bankDetails.save();
    } else {
      // Create new
      finalUpiId = customPayTag ? customPayTag.toLowerCase() : generateUpiId();
      bankDetails = new BankDetails({
        user: userId,
        bankName,
        ifscCode,
        accountHolder,
        accountAddress,
        accountType,
        amount,
        upiId: finalUpiId,
        region: region || '',
        usdcBalance,
      });
      await bankDetails.save();
    }

    // Attach upiId to User model, but do NOT set KYC to true (that happens in Web3 KYC)
    await User.findByIdAndUpdate(userId, { upiId: finalUpiId });

    return res.status(201).json({ message: 'Bank details added successfully', upiId: finalUpiId, id: bankDetails._id, usdcBalance });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

export const getAllUsers = async (req, res) => {
  try {
    const usersWithBankAccounts = await BankDetails.find().distinct('user');

    const users = await User.find({ _id: { $in: usersWithBankAccounts } }).select('name');
    const bankDetails = await BankDetails.find({ user: { $in: usersWithBankAccounts } });
    const usersWithDetails = users.map(user => {
      const userBankDetails = bankDetails.find(detail => detail.user.toString() === user._id.toString());
      const userDetails = {
        _id: user._id,
        name: user.name,
        bankDetails: userBankDetails ? {
          accountNumber: userBankDetails.accountNumber,
          bankName: userBankDetails.bankName,
          branchName: userBankDetails.branchName,
          ifscCode: userBankDetails.ifscCode,
          upiId: userBankDetails.upiId,
          balance: userBankDetails.amount,
          createdAt: userBankDetails.createdAt,
          updatedAt: userBankDetails.updatedAt
        } : null
      };

      return userDetails;
    });

    res.json(usersWithDetails);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
}


export const getLoggedUserDetails = async (req, res) => {
  try {
    const userId = req.user.id;
    const userWithBankAccount = await BankDetails.findOne({ user: userId });

    if (!userWithBankAccount) {
      return res.status(404).json({ msg: 'No bank details found for this user' });
    }

    const user = await User.findById(userId).select('name globalPayTag metamaskId internalWalletAddress');

    // Fetch Live Exchange Rates with DB Caching to prevent slow page loads and scale across servers
    let rate = 83.5; // Fallback rate
    const region = userWithBankAccount.region || 'India';

    let cacheDoc = await SystemCache.findOne({ key: 'exchangeRates' });
    let rates = cacheDoc ? cacheDoc.data : null;

    if (!cacheDoc || Date.now() - new Date(cacheDoc.updatedAt).getTime() > 3600000) {
      try {
        const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
        const data = await response.json();
        rates = data.rates;

        // Update or create cache doc
        await SystemCache.findOneAndUpdate(
          { key: 'exchangeRates' },
          { data: rates, updatedAt: new Date() },
          { upsert: true, new: true }
        );
      } catch (apiErr) {
        console.error("Failed to fetch live exchange rates:", apiErr);
      }
    }

    if (rates) {
      if (region === 'India' && rates.INR) rate = rates.INR;
      else if (region === 'Brazil' && rates.BRL) rate = rates.BRL;
      else if (region === 'Mexico' && rates.MXN) rate = rates.MXN;
      else if (rates[region]) rate = rates[region];
    }

    const storedUsdc = userWithBankAccount.usdcBalance || 0;
    const computedUsdc = parseFloat((Number(userWithBankAccount.amount) / rate).toFixed(4));
    let usdcBalance = storedUsdc > 0 ? storedUsdc : computedUsdc;

    // Fetch the REAL Crypto Balance from the Blockchain Vault
    let onChainBalance = 0;
    try {
      const fs = await import('fs');
      const { ethers } = await import('ethers');

      if (fs.existsSync('./contractData.json')) {
        const contractData = JSON.parse(fs.readFileSync('./contractData.json', 'utf8'));
        const rpcUrl = process.env.SEPOLIA_RPC_URL;

        if (rpcUrl) {
          const provider = new ethers.JsonRpcProvider(rpcUrl);
          const contract = new ethers.Contract(contractData.address, contractData.abi, provider);

          if (user.internalWalletAddress) {
            const rawBalance = await contract.balanceOf(user.internalWalletAddress);
            onChainBalance = parseFloat(ethers.formatUnits(rawBalance, 18));
          }
        }
      }
    } catch (blockchainErr) {
      console.error("Failed to fetch on-chain balance:", blockchainErr);
    }

    const userDetails = {
      _id: user._id,
      name: user.name,
      globalPayTag: user.globalPayTag,
      metamaskId: user.metamaskId,
      internalWalletAddress: user.internalWalletAddress,
      bankDetails: {
        bankName: userWithBankAccount.bankName,
        ifscCode: userWithBankAccount.ifscCode,
        upiId: userWithBankAccount.upiId,
        balance: userWithBankAccount.amount, // Fiat Balance
        usdcBalance: onChainBalance, // Crypto Balance
        region,
        createdAt: userWithBankAccount.createdAt,
        updatedAt: userWithBankAccount.updatedAt,
      }
    };

    res.json(userDetails);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};
export const addFiatMoney = async (req, res) => {
  const { amount } = req.body;
  const userId = req.user.id;

  try {
    const bankDetails = await BankDetails.findOne({ user: userId });
    if (!bankDetails) {
      return res.status(404).json({ msg: 'Bank details not found for this user. Please complete Bank KYC first.' });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ msg: 'Invalid amount' });
    }

    // Amount comes in as standard USD units from the UI, so we need to convert it to the local currency amount stored in the DB
    const exchangeRates = { India: 83.5, Brazil: 5.1, Mexico: 17.5 };
    const rate = exchangeRates[bankDetails.region] || 83.5;

    // Add the local currency equivalent to the fiat balance
    const localAmount = amount * rate;
    bankDetails.amount = Number(bankDetails.amount) + localAmount;

    await bankDetails.save();

    res.json({ msg: `Successfully added ${amount} USD to your Fiat Account`, newBalance: bankDetails.amount });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error while adding funds');
  }
};

export const swapToCrypto = async (req, res) => {
  const { amount } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ msg: 'Invalid amount' });

  try {
    const userId = req.user.id;
    const userWithBankAccount = await BankDetails.findOne({ user: userId });
    const user = await User.findById(userId);

    if (!userWithBankAccount || !user) {
      return res.status(404).json({ msg: 'User or bank account not found' });
    }

    if (!user.internalWalletAddress) {
      return res.status(400).json({ msg: 'Internal Web3 Vault not found. Please complete Web3 Identity Verification or contact support.' });
    }

    const exchangeRates = { India: 83.5, Brazil: 5.1, Mexico: 17.5 };
    const rate = exchangeRates[userWithBankAccount.region || 'India'] || 83.5;
    const localAmount = amount * rate;

    if (userWithBankAccount.amount < localAmount) {
      return res.status(400).json({ msg: `Insufficient Fiat balance. You need ${localAmount} local currency to mint ${amount} pUSDC.` });
    }
    // Mint to Web3 Vault (Crypto) first
    try {
      const fs = await import('fs');
      const { ethers } = await import('ethers');

      if (fs.existsSync('./contractData.json')) {
        const contractData = JSON.parse(fs.readFileSync('./contractData.json', 'utf8'));
        const rpcUrl = process.env.SEPOLIA_RPC_URL;
        const privateKey = process.env.TREASURY_PRIVATE_KEY;

        if (rpcUrl && privateKey) {
          const provider = new ethers.JsonRpcProvider(rpcUrl);
          const wallet = new ethers.Wallet(privateKey, provider);

          // --- SPONSORED GAS RELAYER FEATURE ---
          // The platform pays the gas fees for the user to provide a seamless Web2-to-Web3 onboarding experience.
          // We check the Treasury balance first to prevent crash due to insufficient funds.
          const treasuryBalance = await provider.getBalance(wallet.address);
          if (treasuryBalance < ethers.parseEther("0.001")) {
            return res.status(503).json({ msg: 'Sponsored Gas Relayer is temporarily out of funds. Please try again later.' });
          }

          const contract = new ethers.Contract(contractData.address, contractData.abi, wallet);

          const tokenAmount = ethers.parseUnits(amount.toString(), 18);
          // Calling depositFiat acts as the minting mechanism from the Treasury
          const tx = await contract.depositFiat(user.internalWalletAddress, tokenAmount);
          await tx.wait(); // Wait for confirmation on the blockchain
        }
      }
    } catch (blockchainErr) {
      console.error("Failed to mint crypto tokens on Vault:", blockchainErr);
      return res.status(500).json({ msg: 'Blockchain transaction failed. Fiat balance was not deducted.' });
    }



    // Only deduct from MongoDB (Fiat) if blockchain transaction was successful
    userWithBankAccount.amount = Number(userWithBankAccount.amount) - localAmount;
    await userWithBankAccount.save();

    // Log the transaction in the ledger
    const bridgeTx = new Transaction({
      userId: userId,
      amount: localAmount,
      currency: userWithBankAccount.region || 'India',
      category: 'Investment',
      description: `Two-Way Bridge: Converted $${amount} to Global pUSDC`,
      transactionType: 'debit',
    });
    await bridgeTx.save();

    // Log in the MoneyTransfer Activity Log
    const moneyTransfer = new MoneyTransfer({
      sender: userId,
      senderUPI: user.globalPayTag || userWithBankAccount.upiId,
      receiver: userId,
      receiverUPI: 'Two-Way Bridge (Mint pUSDC)',
      amount: amount, // Logging the USD amount for bridging
      network: 'sepolia',
      txHash: 'bridge-mint' // placeholder to trigger the badge
    });
    await moneyTransfer.save();

    res.json({ msg: `Successfully bridged $${amount} to Web3 Crypto Vault` });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error during swap');
  }
};

export const swapToFiat = async (req, res) => {
  const { amount } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ msg: 'Invalid amount' });

  try {
    const userId = req.user.id;
    const userWithBankAccount = await BankDetails.findOne({ user: userId });
    const user = await User.findById(userId);

    if (!userWithBankAccount || !user) {
      return res.status(404).json({ msg: 'User or bank account not found' });
    }

    if (!user.metamaskId) {
      return res.status(400).json({ msg: 'Web3 Wallet not found.' });
    }

    // Burn from Web3 Vault (Crypto) First
    try {
      const fs = await import('fs');
      const { ethers } = await import('ethers');

      if (fs.existsSync('./contractData.json')) {
        const contractData = JSON.parse(fs.readFileSync('./contractData.json', 'utf8'));
        const rpcUrl = process.env.SEPOLIA_RPC_URL;
        const privateKey = process.env.TREASURY_PRIVATE_KEY;

        if (rpcUrl && privateKey) {
          const provider = new ethers.JsonRpcProvider(rpcUrl);
          const wallet = new ethers.Wallet(privateKey, provider);

          // --- SPONSORED GAS RELAYER FEATURE ---
          const treasuryBalance = await provider.getBalance(wallet.address);
          if (treasuryBalance < ethers.parseEther("0.001")) {
            return res.status(503).json({ msg: 'Sponsored Gas Relayer is temporarily out of funds. Please try again later.' });
          }

          const contract = new ethers.Contract(contractData.address, contractData.abi, wallet);

          // Verify on-chain balance before attempting to burn
          const rawBalance = await contract.balanceOf(user.internalWalletAddress);
          const onChainBalance = parseFloat(ethers.formatUnits(rawBalance, 18));

          if (onChainBalance < amount) {
            return res.status(400).json({ msg: 'Insufficient Crypto balance on Web3 Vault' });
          }

          const tokenAmount = ethers.parseUnits(amount.toString(), 18);
          // Call the new withdrawFiat function
          const tx = await contract.withdrawFiat(user.internalWalletAddress, tokenAmount);
          await tx.wait(); // Wait for confirmation
        }
      } else {
        return res.status(500).json({ msg: 'Smart Contract configuration missing' });
      }
    } catch (blockchainErr) {
      console.error("Failed to withdraw crypto tokens from Vault:", blockchainErr);
      return res.status(500).json({ msg: 'Blockchain transaction failed. Cannot complete off-ramp.' });
    }

    const exchangeRates = { India: 83.5, Brazil: 5.1, Mexico: 17.5 };
    const rate = exchangeRates[userWithBankAccount.region || 'India'] || 83.5;
    const localAmount = amount * rate;

    // If blockchain burn was successful, credit MongoDB (Fiat)
    userWithBankAccount.amount = Number(userWithBankAccount.amount) + localAmount;
    await userWithBankAccount.save();

    // Log the transaction in the ledger
    const offrampTx = new Transaction({
      userId: userId,
      amount: localAmount,
      currency: userWithBankAccount.region || 'India',
      category: 'Investment',
      description: `Two-Way Bridge: Withdrew ${amount} pUSDC to Fiat`,
      transactionType: 'credit',
    });
    await offrampTx.save();

    // Log in the MoneyTransfer Activity Log
    const moneyTransfer = new MoneyTransfer({
      sender: userId,
      senderUPI: 'Two-Way Bridge (Burn pUSDC)',
      receiver: userId,
      receiverUPI: user.globalPayTag || userWithBankAccount.upiId,
      amount: amount, 
      network: 'sepolia',
      txHash: 'bridge-burn'
    });
    await moneyTransfer.save();

    res.json({ msg: `Successfully off-ramped ${amount} pUSDC back to Domestic Fiat Account` });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error during swap-to-fiat');
  }
};