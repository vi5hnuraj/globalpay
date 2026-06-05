import React, { useState, useEffect } from 'react';
import { chip, visa } from '../../assets';
import { FiRefreshCw, FiArrowRight } from 'react-icons/fi';
import api from '../../utils/api';
import { toast, Toaster } from 'react-hot-toast';

const BankCard = ({ userData }) => {
  const [liveRate, setLiveRate] = useState(null);
  const [bridgeAmount, setBridgeAmount] = useState('');
  const [isBridging, setIsBridging] = useState(false);
  const [showBridge, setShowBridge] = useState(false);
  const [isAddFundsOpen, setIsAddFundsOpen] = useState(false);
  const [addFundsAmount, setAddFundsAmount] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const region = userData?.bankDetails?.region || 'India';
  const currencyMap = { India: 'INR', Brazil: 'BRL', Mexico: 'MXN', France: 'EUR' };
  const symbolMap = { India: '₹', Brazil: 'R$', Mexico: '$', France: '€' };
  const localCurrency = currencyMap[region] || 'INR';
  const localSymbol = symbolMap[region] || '₹';

  useEffect(() => {
    const fetchRate = async () => {
      try {
        const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
        const data = await response.json();
        
        const region = userData?.bankDetails?.region || 'India';
        const currencyMap = { India: 'INR', Brazil: 'BRL', Mexico: 'MXN' };
        const currencyCode = currencyMap[region] || 'INR';
        
        setLiveRate(data.rates[currencyCode]);
      } catch (err) {
        console.error('Failed to fetch live rates:', err);
        const fallbackRates = { India: 83.5, Brazil: 5.15, Mexico: 17.5 };
        const region = userData?.bankDetails?.region || 'India';
        setLiveRate(fallbackRates[region] || 83.5);
      }
    };
    
    if (userData?.bankDetails) {
      fetchRate();
    }
  }, [userData]);

  const handleAddFunds = async () => {
    if (!addFundsAmount || isNaN(addFundsAmount) || Number(addFundsAmount) <= 0) {
      toast.error('Enter a valid amount to deposit');
      return;
    }
    setIsAdding(true);
    const toastId = toast.loading('Redirecting to Stripe Checkout...');
    try {
      const res = await api.post('/payment/create-checkout-session', { amount: Number(addFundsAmount) });
      if (res.data.url) {
        window.location.href = res.data.url; // Redirect to Stripe
      } else {
        toast.error('Failed to get checkout URL', { id: toastId });
        setIsAdding(false);
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.msg || 'Deposit failed', { id: toastId });
      setIsAdding(false);
    }
  };

  const handleBridge = async () => {
    if (!bridgeAmount || isNaN(bridgeAmount) || Number(bridgeAmount) <= 0) {
      toast.error('Enter a valid amount to bridge');
      return;
    }

    setIsBridging(true);
    const toastId = toast.loading('Connecting to Ethereum Sepolia...');
    
    try {
      await api.post('/bank/swap-to-crypto', { amount: Number(bridgeAmount) });
      toast.success('Bridge Successful! pUSDC Minted.', { id: toastId });
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.msg || 'Bridge failed', { id: toastId });
    } finally {
      setIsBridging(false);
      setBridgeAmount('');
    }
  };

  if (!userData || !userData.bankDetails) return <div>Loading...</div>;

  const { bankName, ifscCode, upiId, balance, usdcBalance } = userData.bankDetails;
  
  const currencySymbols = { India: '₹', Brazil: 'R$', Mexico: '$' };
  const userRegion = region || 'India';
  const sym = currencySymbols[userRegion] || '₹';

  const currentRate = liveRate || 83.5;
  const fiatBalance = Number(balance).toFixed(2);
  const cryptoBalance = Number(usdcBalance).toFixed(2);

  return (
    <div className="flex flex-col gap-4">
      <Toaster />
      <div className="flex gap-4">
        {/* Domestic Fiat Account */}
        <div className="bg-gradient-to-r font-mono from-zinc-800 border-2 border-zinc-700 to-zinc-900 p-6 h-80 w-[340px] rounded-lg relative shadow-lg">
          <div className="absolute top-4 right-4">
            <button 
              onClick={() => setIsAddFundsOpen(true)}
              className="bg-zinc-700 hover:bg-zinc-600 text-xs font-bold px-3 py-1.5 rounded-lg text-white transition-all shadow-md"
            >
              + Add Funds
            </button>
          </div>
          <div className="text-white mt-4">
            <p className="text-sm text-zinc-400 font-bold tracking-widest uppercase mb-4">Domestic Fiat Account</p>
            <p className="text-xl font-medium truncate">{bankName}</p>
            <p className="text-sm mt-1 text-zinc-400 truncate w-full">{ifscCode}</p>
            <p className="text-sm mt-1 text-zinc-400 truncate w-full">UPI: {upiId}</p>
            
            <div className="text-xl font-bold text-amber-400 mt-6 flex items-center gap-2">
              <p>Balance: {sym}{fiatBalance} <span className="text-sm text-zinc-500">{userRegion === 'Mexico' ? 'MXN' : userRegion === 'Brazil' ? 'BRL' : 'INR'}</span></p>
            </div>
            <p className="text-xs text-zinc-500 mt-1">For Local Domestic Routing</p>
          </div>
          <div className="absolute bottom-4 left-6">
            <img src={visa} alt="Visa Logo" className="w-16" />
          </div>
          <div className="absolute bottom-4 right-2">
            <img src={chip} alt="Chip Logo" className="w-16" />
          </div>
        </div>

        {/* Web3 Crypto Vault */}
        <div className="bg-gradient-to-r font-mono from-blue-900 border-2 border-blue-700 to-indigo-900 p-6 h-80 w-[340px] rounded-lg relative shadow-lg">
          <div className="text-white mt-4">
            <p className="text-sm text-blue-300 font-bold tracking-widest uppercase mb-4">Web3 Crypto Vault</p>
            <p className="text-xl font-medium truncate">ERC-20 Platform USDC</p>
            <p className="text-sm mt-1 text-blue-200 truncate">
              {userData.internalWalletAddress 
                ? `Vault: ${userData.internalWalletAddress.slice(0, 6)}...${userData.internalWalletAddress.slice(-4)}` 
                : `Tag: ${userData.globalPayTag || upiId}`}
            </p>
            
            <div className="text-xl font-bold text-blue-400 mt-6 flex items-center gap-2">
              <p>Balance: {cryptoBalance} pUSDC</p>
            </div>
            <p className="text-xs text-blue-300 mt-1">For Instant Global Routing</p>
          </div>
          <div className="absolute bottom-4 left-6">
            <div className="text-blue-500 font-bold italic text-xl">WEB3</div>
          </div>
          <div className="absolute bottom-4 right-2">
            <img src={chip} alt="Chip Logo" className="w-16 opacity-80" />
          </div>
        </div>
      </div>

      {/* Add Funds Modal */}
      {isAddFundsOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-zinc-900 border border-zinc-700 p-6 rounded-2xl w-96 shadow-2xl relative">
            <button 
              onClick={() => setIsAddFundsOpen(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white"
            >
              ✕
            </button>
            <h2 className="text-xl font-bold text-white mb-2">Deposit Fiat Money</h2>
            <p className="text-zinc-400 text-sm mb-6">Instantly top up your domestic fiat account.</p>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs text-zinc-500 font-bold uppercase tracking-widest block mb-2">Amount ({localCurrency})</label>
                <div className="relative">
                  <span className="absolute left-4 top-3 text-zinc-400 font-bold">{localSymbol}</span>
                  <input 
                    type="number" 
                    value={addFundsAmount}
                    onChange={(e) => setAddFundsAmount(e.target.value)}
                    className="w-full bg-black/50 border border-zinc-700 rounded-xl py-3 pl-8 pr-4 text-white focus:outline-none focus:border-amber-500 font-mono"
                    placeholder="100.00"
                  />
                </div>
              </div>


              <button 
                onClick={handleAddFunds}
                disabled={isAdding}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-black text-lg py-4 rounded-xl mt-4 transition-all disabled:opacity-50"
              >
                {isAdding ? 'Processing...' : 'Confirm Deposit'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default BankCard;