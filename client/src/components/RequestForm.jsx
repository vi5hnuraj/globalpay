import React, { useState, useEffect } from 'react';
import { toast, Toaster } from 'react-hot-toast';
import api from '../utils/api';
import { FiSend, FiUser, FiDollarSign, FiZap } from 'react-icons/fi';

const RequestForm = () => {
  const [formData, setFormData] = useState({
    receiver: '',
    amount: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const token = localStorage.getItem("token");

  // Dynamic Currency State
  const [region, setRegion] = useState("India");
  const [currencyCode, setCurrencyCode] = useState("inr");
  const [currencySymbol, setCurrencySymbol] = useState("₹");
  const [fallbackRate, setFallbackRate] = useState(83.5);
  
  const [USDCPrice, setUSDCPrice] = useState(0);

  // 🔹 Fetch User Region on Mount
  useEffect(() => {
    const fetchUserRegion = async () => {
      if (!token) return;
      try {
        const userRes = await api.get("/auth/fetchdetail", {
          headers: { Authorization: `Bearer ${token}` }
        });
        const userRegion = userRes.data?.region || "India";
        setRegion(userRegion);
        
        if (userRegion === "Mexico") {
          setCurrencyCode("mxn");
          setCurrencySymbol("$");
          setFallbackRate(17.5);
        } else if (userRegion === "Brazil") {
          setCurrencyCode("brl");
          setCurrencySymbol("R$");
          setFallbackRate(5.1);
        } else {
          setCurrencyCode("inr");
          setCurrencySymbol("₹");
          setFallbackRate(83.5);
        }
      } catch (err) {
        console.warn("Failed to fetch user region:", err);
      }
    };
    fetchUserRegion();
  }, [token]);

  // 🔹 Fetch prices from CoinGecko based on dynamic currency
  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const res = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=usd-coin&vs_currencies=${currencyCode}`
        );
        const data = await res.json();
        setUSDCPrice(data["usd-coin"][currencyCode] || fallbackRate);
      } catch (err) {
        console.warn("Price fetch failed:", err);
        setUSDCPrice(fallbackRate);
      }
    };
    fetchPrice();
  }, [currencyCode, fallbackRate]);

  const cryptoEquivalent = formData.amount ? (Number(formData.amount) / (USDCPrice || fallbackRate)).toFixed(2) : "0.00";

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.receiver || !formData.amount || Number(formData.amount) <= 0) {
      toast.error('Please enter valid receiver details and amount');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await api.post(`/money-transfer/money-requested`, formData);
      toast.success('Invoice sent securely!');
      setFormData({ receiver: '', amount: '' });
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to send request');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-[#0a0a0a] border-zinc-800/50 border p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-blue-500/20 transition-all duration-700"></div>
      <Toaster />
      
      <div className="mb-8 relative z-10">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
            <FiZap className="text-blue-500" size={20} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white tracking-tighter">Request Payment</h2>
            <p className="text-blue-400 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span> Generate Invoice
            </p>
          </div>
        </div>
        <p className="text-zinc-500 text-xs mt-4 leading-relaxed">
          Generate a Crypto-to-Fiat invoice. Your customer will pay in Web3 Crypto, and you will receive local Fiat instantly.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
        <div className="space-y-1.5">
          <label className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest ml-1">Customer PayTag</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <FiUser className="text-zinc-500" />
            </div>
            <input
              type="text"
              name="receiver"
              value={formData.receiver}
              onChange={handleChange}
              className="w-full pl-11 pr-4 py-4 bg-zinc-900/50 border border-zinc-800 outline-none rounded-2xl text-white placeholder-zinc-600 focus:border-blue-500/50 focus:bg-zinc-900 transition-all"
              placeholder="@customer_tag"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest ml-1">Fiat Amount ({currencyCode.toUpperCase()})</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <span className="text-zinc-500 font-bold">{currencySymbol}</span>
            </div>
            <input
              type="number"
              name="amount"
              value={formData.amount}
              onChange={handleChange}
              className="w-full pl-11 pr-4 py-4 bg-zinc-900/50 border border-zinc-800 outline-none rounded-2xl text-white font-medium text-lg placeholder-zinc-600 focus:border-blue-500/50 focus:bg-zinc-900 transition-all"
              placeholder="0.00"
            />
          </div>
          
          {/* Crypto Auto-Conversion Display */}
          <div className="flex items-center justify-between px-2 pt-2">
            <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider">Customer Pays (Web3)</p>
            <div className="flex items-center gap-1.5 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
              <p className="text-blue-400 text-[11px] font-black tracking-tight">≈ {cryptoEquivalent} USDC</p>
            </div>
          </div>
        </div>

        <button 
          type="submit" 
          disabled={isSubmitting || !formData.amount || !formData.receiver}
          className={`w-full py-4 mt-2 rounded-2xl font-black text-sm uppercase tracking-widest text-white shadow-2xl transition-all flex items-center justify-center gap-2 group ${
            isSubmitting || !formData.amount || !formData.receiver
            ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' 
            : 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 hover:scale-[1.02] border border-blue-400/30'
          }`}
        >
          {isSubmitting ? (
            <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              Generate Invoice
              <FiSend size={16} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
            </>
          )}
        </button>
      </form>
    </div>
  );
};

export default RequestForm;
