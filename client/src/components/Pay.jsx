import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import "../index.css";
import api from "../utils/api";
import { ConnectWallet, useAddress, useSDK } from "@thirdweb-dev/react";
import { ethers } from "ethers";
import { FiUser, FiShoppingBag, FiZap, FiCreditCard } from "react-icons/fi";

const Pay = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [upi, setUpi] = useState(searchParams.get("upi") || "");
  const [option, setOption] = useState(searchParams.get("prefillFromRequest") ? "USDC" : "");
  const [amount, setAmount] = useState(searchParams.get("amount") || "");
  const [keyword, setKeyword] = useState("");
  const [metamaskID, setMetamaskId] = useState("");
  const [loading, setLoading] = useState(false);

  const walletAddress = useAddress();
  const sdk = useSDK();
  const token = localStorage.getItem("token");

  const USDC_CONTRACT = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"; // Circle Sepolia USDC

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

  const cryptoEquivalent = amount ? (Number(amount) / (USDCPrice || fallbackRate)).toFixed(2) : "0.00";

  // 🔹 Payment Handler
  const paymentHandler = async () => {
    try {
      if (!walletAddress) return alert("Please connect your wallet first.");
      if (!token) return alert("You must be logged in to make payments.");
      if (!upi || !option || !amount) return alert("Please fill in all fields.");

      setLoading(true);

      // Fetch sender details
      const userRes = await api.get("/auth/fetchdetail", {
        headers: { Authorization: `Bearer ${token}` },
        params: { waddr: walletAddress },
      });
      const user = userRes.data;
      if (!user || !user._id || !user.metamask) {
        setLoading(false);
        return alert("Sender details not found.");
      }
      setMetamaskId(user.metamask);

      if (walletAddress.toLowerCase() !== user.metamask.toLowerCase()) {
        setLoading(false);
        return alert("This wallet is not linked to your registered UPI account.");
      }

      // Fetch receiver details
      let receiver;
      try {
        const receiverRes = await api.get("/auth/fetchdetail", { params: { upi } });
        receiver = receiverRes.data;
      } catch (err) {
        if (err.response && err.response.status === 404) {
          setLoading(false);
          return alert("Receiver UPI not found or not registered.");
        }
        throw err;
      }

      if (!receiver || !receiver.metamask) {
        setLoading(false);
        return alert("Receiver UPI not linked with any MetaMask wallet.");
      }

      // 🔹 Convert Local Fiat → token amount
      const localFiatToUsd = amount / (USDCPrice || fallbackRate);
      const tokenAmount = ethers.utils.parseUnits(localFiatToUsd.toFixed(6), 6);

      // Confirm transaction
      if (
        !window.confirm(
          `Transaction Details:\nPurpose: ${keyword || "N/A"}\nAmount: ${currencySymbol}${amount} (≈ ${localFiatToUsd.toFixed(2)} USDC)\nReceiver: ${upi}\nProceed?`
        )
      ) {
        setLoading(false);
        return;
      }

      // 🔹 Send token using ethers.js
      const signer = await sdk?.getSigner();
      const contractAddress = USDC_CONTRACT;

      const erc20Abi = [
        "function transfer(address to, uint256 value) public returns (bool)",
      ];
      const tokenContract = new ethers.Contract(contractAddress, erc20Abi, signer);

      const tx = await tokenContract.transfer(receiver.metamask, tokenAmount);
      await tx.wait();

      // 🔹 Record transaction in backend
      await api.post("/pay/paymentWrite", {
        date: new Date().toISOString(),
        to: upi,
        amt: amount,
        sender: user._id,
        keyword,
        coin: option,
        txHash: tx.hash,
      });

      // 🔹 Resolve the request in the inbox if it was settled from there
      const reqId = searchParams.get("reqId");
      if (reqId) {
        try {
          await api.delete(`/money-transfer/request-money/${reqId}`);
        } catch (e) {
          console.error("Failed to resolve request in inbox:", e);
        }
      }

      // Clear form
      setUpi("");
      setAmount("");
      setOption("");
      setKeyword("");

      alert("✅ Payment successful!");
      
      if (searchParams.get("prefillFromRequest")) {
        // Force reset the URL to clear all params completely and bypass React Router cache
        window.location.href = "/cryptupi";
      }
    } catch (err) {
      console.error("Payment error:", err);
      alert(`Unexpected error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#0a0a0a] border-zinc-800/50 border p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl relative overflow-hidden group">
      {/* Decorative Glow */}
      <div className="absolute top-0 left-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -ml-16 -mt-16 group-hover:bg-blue-500/20 transition-all duration-700"></div>
      
      {/* Header */}
      <div className="mb-8 relative z-10 text-center">
        <div className="flex items-center justify-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
            <FiShoppingBag className="text-blue-500" size={24} />
          </div>
        </div>
        <h2 className="text-2xl font-black text-white tracking-tighter mt-3">Secure Checkout</h2>
        <p className="text-blue-400 text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-1 mt-1">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span> Powered by Web3
        </p>
      </div>

      <div className="space-y-4 relative z-10">
        {/* Receiver Input */}
        <div className="space-y-1.5">
          <label className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest ml-1">Merchant UPI / PayTag</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <FiUser className="text-zinc-500" />
            </div>
            <input
              type="text"
              placeholder="e.g., swiggy@merchant"
              value={upi}
              onChange={(e) => setUpi(e.target.value)}
              className="w-full pl-11 pr-4 py-3.5 bg-zinc-900/50 border border-zinc-800 outline-none rounded-2xl text-white placeholder-zinc-600 focus:border-blue-500/50 focus:bg-zinc-900 transition-all"
            />
          </div>
        </div>

        {/* Amount Input */}
        <div className="space-y-1.5">
          <label className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest ml-1">Total Bill ({currencyCode.toUpperCase()})</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <span className="text-zinc-500 font-bold">{currencySymbol}</span>
            </div>
            <input
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full pl-11 pr-4 py-4 bg-zinc-900/50 border border-zinc-800 outline-none rounded-2xl text-white font-black text-xl placeholder-zinc-600 focus:border-blue-500/50 focus:bg-zinc-900 transition-all text-center tracking-tight"
            />
          </div>
          
          {/* Crypto Conversion Display */}
          <div className="flex flex-col items-center justify-center mt-2 p-3 bg-blue-500/5 rounded-xl border border-blue-500/10">
            <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider mb-1">You will pay via MetaMask</p>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
              <p className="text-blue-400 text-sm font-black tracking-tight">≈ {cryptoEquivalent} USDC</p>
            </div>
          </div>
        </div>

        {/* Token Selection & Purpose */}
        <div className="grid grid-cols-2 gap-3">
          <div className="relative">
            <select
              value={option}
              onChange={(e) => setOption(e.target.value)}
              className="w-full pl-3 pr-8 py-3.5 bg-zinc-900/50 border border-zinc-800 outline-none rounded-2xl text-zinc-300 text-sm appearance-none focus:border-blue-500/50 transition-all"
            >
              <option value="">Select Token</option>
              <option value="USDC">USDC (Sepolia)</option>
            </select>
          </div>
          <div className="relative">
            <input
              type="text"
              placeholder="Order Note"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="w-full px-4 py-3.5 bg-zinc-900/50 border border-zinc-800 outline-none rounded-2xl text-white text-sm placeholder-zinc-600 focus:border-blue-500/50 transition-all"
            />
          </div>
        </div>
      </div>

      <div className="mt-8 flex flex-col items-center space-y-4 relative z-10">
        <ConnectWallet 
          theme="dark" 
          btnTitle="Connect Wallet to Pay"
          className="!w-full !rounded-2xl !bg-zinc-800 !border-zinc-700 !font-bold"
        />
        
        <button
          onClick={paymentHandler}
          disabled={loading || !amount || !upi || !option || !walletAddress}
          className={`w-full py-4 rounded-xl font-bold text-sm uppercase tracking-widest text-white shadow-lg transition-all flex items-center justify-center gap-2 ${loading || !amount || !upi || !option || !walletAddress ? 'bg-zinc-600 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600'}`}
        >
          {loading ? (
            <>
              <div className="w-5 h-5 border-2 border-zinc-400 border-t-white rounded-full animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <FiCreditCard size={18} />
              Authorize Payment
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default Pay;
