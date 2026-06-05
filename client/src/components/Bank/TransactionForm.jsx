import React, { useState, useEffect } from 'react';
import { toast, Toaster } from 'react-hot-toast';
import { FiSend, FiUser, FiArrowRight, FiCreditCard } from 'react-icons/fi';
import api from '../../utils/api';

const TransactionForm = ({ onTransactionSuccess, userData }) => {
  const [formData, setFormData] = useState({
    senderUPI: '',
    receiverUPI: '',
    amount: '',
    network: 'sepolia',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (userData) {
      setFormData(prev => ({ ...prev, senderUPI: userData.globalPayTag || userData.bankDetails?.upiId }));
    }
  }, [userData]);

  const getCurrencySymbol = () => {
    if (formData.network === 'sepolia') return '$';
    const region = userData?.region || userData?.bankDetails?.region;
    if (region === 'Brazil') return 'R$';
    if (region === 'Mexico') return '$';
    return '₹'; // Default India
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.receiverUPI || !formData.amount || Number(formData.amount) <= 0) {
      toast.error('Please enter valid receiver details and amount');
      return;
    }

    const availableBalance = formData.network === 'sepolia' ? (userData?.bankDetails?.usdcBalance || 0) : (userData?.bankDetails?.balance || 0);
    if (Number(formData.amount) > availableBalance) {
      toast.error(`Insufficient balance. You only have $${availableBalance}`);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await api.post(`/money-transfer/create`, formData);
      toast.success('Transaction successful!');
      if (onTransactionSuccess) onTransactionSuccess();
      setFormData({ 
        senderUPI: userData?.globalPayTag || userData?.bankDetails?.upiId, 
        receiverUPI: '', 
        amount: '',
        network: 'sepolia'
      });
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to send transaction');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-zinc-900 border-zinc-800 border-[1px] p-8 rounded-2xl flex-1 shadow-2xl transition-all duration-300">
      
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Quick Transfer</h2>
          <p className="text-zinc-500 text-sm mt-1">Send money instantly via UPI ID or Pay Tag</p>
        </div>
        <div className="bg-amber-500/10 p-3 rounded-xl text-amber-500">
          <FiSend size={24} />
        </div>
      </div>

      {userData?.bankDetails && (
        <div className={`mb-8 p-4 ${formData.network === 'sepolia' ? 'bg-blue-900/20 border-blue-700/50' : 'bg-zinc-800/50 border-zinc-700/50'} border rounded-xl flex items-center justify-between transition-colors`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 ${formData.network === 'sepolia' ? 'bg-blue-800/50 text-blue-400' : 'bg-zinc-700 text-amber-500'} rounded-lg`}>
              <FiCreditCard size={18} />
            </div>
            <div>
              <p className={`text-xs ${formData.network === 'sepolia' ? 'text-blue-300' : 'text-zinc-500'} uppercase font-bold tracking-wider`}>Available Balance</p>
              <p className="text-xl font-bold text-white">${formData.network === 'sepolia' 
                ? Number(userData.bankDetails.usdcBalance).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})
                : Number(userData.bankDetails.balance).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})
              }</p>
            </div>
          </div>
          <div className="text-right">
             <p className={`text-[10px] ${formData.network === 'sepolia' ? 'text-blue-400' : 'text-zinc-500'} font-medium`}>{formData.network === 'sepolia' ? 'Web3 Crypto Vault' : 'Linked Account'}</p>
             <p className={`text-xs ${formData.network === 'sepolia' ? 'text-blue-200' : 'text-zinc-300'}`}>{formData.network === 'sepolia' ? 'Platform USDC' : userData.bankDetails.bankName}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="senderUPI" className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1">Your UPI ID / Pay Tag</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-600">
              <FiUser size={18} />
            </div>
            {userData?.globalPayTag && userData?.bankDetails?.upiId ? (
              <div className="relative w-full">
                <select
                  id="senderUPI"
                  name="senderUPI"
                  value={formData.senderUPI}
                  onChange={handleChange}
                  className="w-full pl-10 pr-10 py-3 rounded-xl bg-zinc-800/50 border border-zinc-700 text-white focus:outline-none focus:border-amber-500 text-sm appearance-none cursor-pointer"
                >
                  <option value={userData.bankDetails.upiId}>Local: {userData.bankDetails.upiId}</option>
                  <option value={userData.globalPayTag}>Global: {userData.globalPayTag}</option>
                </select>
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-zinc-500">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                </div>
              </div>
            ) : (
              <input
                type="text"
                id="senderUPI"
                name="senderUPI"
                value={formData.senderUPI}
                readOnly
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-zinc-800/30 border border-zinc-700 text-zinc-500 focus:outline-none cursor-not-allowed text-sm"
              />
            )}
          </div>
        </div>

        <div>
          <label htmlFor="receiverUPI" className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1">Receiver's UPI ID or Pay Tag</label>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500 group-focus-within:text-amber-500 transition-colors">
              <FiArrowRight size={18} />
            </div>
            <input
              type="text"
              id="receiverUPI"
              name="receiverUPI"
              value={formData.receiverUPI}
              onChange={handleChange}
              autoComplete="off"
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-zinc-800/50 border border-zinc-700 text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-sm"
              placeholder="recipient@paytag"
            />
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3 ml-1">Transfer Network Rail</label>
          <div className="flex bg-zinc-900/50 border border-zinc-800 rounded-xl p-1 relative z-10">
            <button
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, network: 'fiat' }))}
              className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${formData.network === 'fiat' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              Fiat (Local)
            </button>
            <button
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, network: 'sepolia' }))}
              className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${formData.network === 'sepolia' ? 'bg-amber-500/10 text-amber-500 shadow-sm border border-amber-500/20' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              Crypto (Sepolia L2)
            </button>
          </div>
          {formData.network === 'fiat' && (
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-2 ml-1 flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-red-500 inline-block"></span> Domestic transfers only
            </p>
          )}
          {formData.network === 'sepolia' && (
            <p className="text-[10px] text-amber-500 font-bold uppercase tracking-widest mt-2 ml-1 flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-amber-500 inline-block animate-pulse"></span> 
              {formData.senderUPI === userData?.bankDetails?.upiId ? 'Instant Domestic Crypto Routing' : 'Instant Global Crypto Routing'}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="amount" className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1">Amount to Transfer</label>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500 group-focus-within:text-amber-500 transition-colors font-bold">
              {getCurrencySymbol()}
            </div>
            <input
              type="number"
              id="amount"
              name="amount"
              value={formData.amount}
              onChange={handleChange}
              className="w-full pl-8 pr-4 py-3 rounded-xl bg-zinc-800/50 border border-zinc-700 text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-lg font-bold"
              placeholder="0.00"
            />
          </div>
        </div>

        <button 
          type="submit" 
          disabled={isSubmitting}
          className={`w-full py-4 rounded-xl font-bold text-white shadow-lg transition-all transform active:scale-95 flex items-center justify-center gap-2 ${
            isSubmitting 
            ? 'bg-zinc-700 cursor-not-allowed' 
            : 'bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 hover:shadow-amber-500/20'
          }`}
        >
          {isSubmitting ? (
            <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              Confirm Transfer
              <FiSend size={18} />
            </>
          )}
        </button>
      </form>
    </div>
  );
};

export default TransactionForm;