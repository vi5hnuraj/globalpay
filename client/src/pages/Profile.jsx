import React, { useState, useEffect } from 'react';
import { Link } from "react-router-dom";
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip } from 'chart.js';
import { FaUserCircle, FaEdit, FaCheckCircle, FaSignOutAlt, FaUniversity, FaShieldAlt } from 'react-icons/fa';
import { FiArrowUpRight, FiArrowDownLeft, FiSend, FiDownload, FiCopy, FiCheck } from 'react-icons/fi';
import moment from 'moment';
import api from '../utils/api';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

const Profile = () => {
  // User data
  const [name, setName] = useState("User");
  const [email, setEmail] = useState("");
  const [mob, setMob] = useState("..");
  const [dob, setDob] = useState("..");
  const [bankName, setBankName] = useState("..");
  const [kyc, setKyc] = useState(false);
  const [balance, setBalance] = useState(0);       // raw local currency (e.g. rupees)
  const [liveRate, setLiveRate] = useState(83.5);  // USD per local unit
  const [region, setRegion] = useState('');
  const [usdcBalance, setUsdcBalance] = useState(0);
  const [upiId, setUpiId] = useState("");
  const [walletAddr, setWalletAddr] = useState("");
  const [externalWallet, setExternalWallet] = useState("");
  const [globalPayTag, setGlobalPayTag] = useState("");
  const [box, setBox] = useState(false);
  const [copied, setCopied] = useState("");

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(""), 1500);
  };

  // Transaction data
  const [transactions, setTransactions] = useState([]);

  // Crypto / Payment data
  const [payments, setPayments] = useState([]);

  const token = localStorage.getItem("token");

  const fetchUser = async () => {
    if (!token) return;
    try {
      const res = await api.get("/auth/fetchdetail");
      const d = res.data;
      if (!d) return;
      setEmail(d.email || "..");
      setName(d.username || d.email?.split('@')[0] || "User");
      setMob(d.mobile || "..");
      setDob(d.dob || "..");
      setKyc(d.kyc || false);
      setWalletAddr(d.internalWalletAddress || "Not Generated");
      setExternalWallet(d.metamaskId || d.metamask || "Not Connected");
      setGlobalPayTag(d.globalPayTag || "");
    } catch (err) {
      console.error("Failed to fetch user details:", err);
    }
  };

  const fetchBankDetails = async () => {
    if (!token) return;
    try {
      const res = await api.get("/bank/user-details");
      const data = res.data;
      const bd = data?.bankDetails;
      // Grab wallets from top-level response if not already set
      if (data?.metamaskId) setExternalWallet(data.metamaskId);
      if (data?.internalWalletAddress) setWalletAddr(data.internalWalletAddress);
      if (bd) {
        if (bd.balance !== undefined) setBalance(Number(bd.balance));
        if (bd.usdcBalance !== undefined) setUsdcBalance(Number(bd.usdcBalance));
        if (bd.upiId) setUpiId(bd.upiId);
        if (bd.bankName) setBankName(bd.bankName);
        if (bd.region) {
          setRegion(bd.region);
          // Fetch live exchange rate based on region
          try {
            const rateRes = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
            const rateData = await rateRes.json();
            const currencyMap = { India: 'INR', Brazil: 'BRL', Mexico: 'MXN' };
            const code = currencyMap[bd.region] || 'INR';
            if (rateData.rates[code]) setLiveRate(rateData.rates[code]);
          } catch (_) { /* use fallback */ }
        }
      }
    } catch (err) {
      console.error("Failed to fetch bank details:", err);
    }
  };

  const fetchTransactions = async () => {
    if (!token) return;
    try {
      const res = await api.get("/money-transfer");
      setTransactions(res.data || []);
    } catch (err) {
      console.error("Failed to fetch transactions:", err);
    }
  };

  const fetchPayments = async () => {
    if (!token) return;
    try {
      const res = await api.get("/pay/paymentRead");
      setPayments(res.data || []);
    } catch (err) {
      console.error("Failed to fetch payments:", err);
    }
  };

  useEffect(() => {
    fetchUser();
    fetchBankDetails();
    fetchTransactions();
    fetchPayments();
  }, [token]);

  const logoutHandler = () => {
    localStorage.removeItem("token");
    window.location.href = "/";
  };

  const toggleBox = () => setBox(!box);

  const updateProfile = async () => {
    try {
      await api.put("/auth/update", { name, mob, dob });
      setBox(false);
      fetchUser();
    } catch (err) {
      console.error("Update failed:", err);
    }
  };

  // Chart data for send/receive
  const validIds = [upiId, globalPayTag].filter(Boolean);
  const sentTxs = transactions.filter(t => validIds.includes(t.senderUPI)).slice(-8);
  const receivedTxs = transactions.filter(t => validIds.includes(t.receiverUPI)).slice(-8);
  const totalSent = sentTxs.reduce((s, t) => s + Number(t.amount), 0);
  const totalReceived = receivedTxs.reduce((s, t) => s + Number(t.amount), 0);

  // Combine all transactions sorted by date for the chart
  const baseTxs = [...transactions].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)).slice(-8);
  const chartTxs = [];
  
  baseTxs.forEach((t) => {
    const isSent = validIds.includes(t.senderUPI);
    const isReceived = validIds.includes(t.receiverUPI);

    if (isSent) {
      chartTxs.push({ ...t, isSent: true });
    }
    if (isReceived) {
      chartTxs.push({ ...t, isSent: false });
    }
  });

  const chartData = {
    labels: chartTxs.map(t => moment(t.timestamp).format('DD MMM')),
    datasets: [
      {
        label: 'Amount',
        data: chartTxs.map(t => Number(t.amount)),
        backgroundColor: chartTxs.map(t => t.isSent ? 'rgba(251, 146, 60, 0.85)' : 'rgba(139, 92, 246, 0.85)'),
        borderRadius: 6,
        barThickness: 14,
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { backgroundColor: '#000', titleFont: { size: 10, weight: '900' }, bodyFont: { size: 12 }, padding: 10, displayColors: false, callbacks: { label: (c) => `$${c.raw.toFixed(2)}` } } },
    scales: {
      y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#52525b', font: { size: 9, weight: '700' }, callback: v => `$${v}` } },
      x: { grid: { display: false }, ticks: { color: '#52525b', font: { size: 9, weight: '700' } } }
    }
  };

  // Crypto summary
  const totalCryptoTx = payments.length;
  const totalCryptoValue = payments.reduce((s, p) => s + Number(p.amount || 0), 0);

  return (
    <div 
      className="min-h-screen bg-cover bg-center bg-no-repeat relative font-sans"
      style={{ backgroundImage: "url('/cryp.jpg')" }}
    >
      <div className="absolute inset-0 bg-black/60"></div>

      <div className="relative z-10 max-w-[1400px] mx-auto p-4 md:p-8 lg:p-12">

        {/* ========== 2x2 GRID ========== */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* ─── CARD 1: User Profile ─── */}
          <div className="relative bg-[#0c0c0c]/80 backdrop-blur-xl border border-zinc-800/60 rounded-[2rem] p-8 shadow-2xl overflow-hidden">
            <div className="flex justify-between items-start mb-6">
              <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.25em]">Profile</p>
              <button onClick={toggleBox} className="p-2 bg-zinc-800/60 hover:bg-zinc-700 rounded-xl text-zinc-400 hover:text-amber-500 transition-all border border-zinc-700/40">
                <FaEdit size={14} />
              </button>
            </div>

            <div className="flex items-center gap-5 mb-8">
              <div className="relative">
                <div className="w-16 h-16 bg-gradient-to-br from-zinc-800 to-zinc-900 rounded-full flex items-center justify-center border-2 border-zinc-700/50 shadow-xl">
                  <FaUserCircle className="text-zinc-600 text-5xl" />
                </div>
                {kyc && (
                  <div className="absolute -bottom-1 -right-1 bg-amber-500 p-1 rounded-full border-2 border-[#0c0c0c] text-[#0c0c0c]">
                    <FaCheckCircle size={8} />
                  </div>
                )}
              </div>
              <div>
                <h2 className="text-xl font-black text-white tracking-tight">{name}</h2>
                <p className="text-zinc-500 text-xs mt-0.5">{email}</p>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex justify-between items-center py-2 border-b border-zinc-800/40">
                <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Email</span>
                <span className="text-zinc-300 text-sm font-semibold truncate ml-4 text-right">{email}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-zinc-800/40">
                <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">UPI ID</span>
                <span className="text-zinc-300 text-sm font-semibold truncate ml-4 text-right">{upiId || 'Not Linked'}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-zinc-800/40">
                <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Region</span>
                <span className="text-zinc-300 text-sm font-semibold truncate ml-4 text-right">{region || 'Not Selected'}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-zinc-800/40">
                <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Pay Tag</span>
                {kyc ? (
                  <span className="text-amber-400 text-sm font-black bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    {globalPayTag}
                  </span>
                ) : (
                  <span className="text-zinc-600 text-[10px] font-bold uppercase tracking-widest bg-zinc-800/50 px-2 py-0.5 rounded">
                    Complete Web3 KYC
                  </span>
                )}
              </div>
            </div>

            <div className="flex gap-3 mt-auto">
              <Link to="/KYC" className="flex-1 flex items-center justify-center gap-2 bg-zinc-800/40 hover:bg-zinc-800 py-3 rounded-xl border border-zinc-700/30 transition-all">
                <FaShieldAlt className={kyc ? "text-emerald-500" : "text-amber-500"} size={12} />
                <span className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">{kyc ? "Verified" : "Verify KYC"}</span>
              </Link>
              <button onClick={logoutHandler} className="flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white px-5 py-3 rounded-xl border border-red-500/10 transition-all">
                <FaSignOutAlt size={12} />
                <span className="text-[10px] font-black uppercase tracking-widest">Sign Out</span>
              </button>
            </div>

            {/* Edit Overlay */}
            {box && (
              <div className="absolute inset-0 bg-[#0a0a0a]/95 backdrop-blur-2xl z-50 flex flex-col p-8 rounded-[2rem]">
                <div className="flex justify-between items-center mb-8">
                  <h4 className="text-white font-black uppercase tracking-widest text-xs">Update Details</h4>
                  <button onClick={toggleBox} className="text-zinc-500 hover:text-white text-lg">✕</button>
                </div>
                <div className="space-y-4 flex-1">
                  <div>
                    <label className="text-[9px] text-zinc-600 font-black uppercase tracking-widest ml-1">Full Name</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full py-3 px-4 bg-zinc-900 border border-zinc-800 rounded-xl text-white text-sm font-semibold outline-none focus:border-amber-500 transition-all mt-1" />
                  </div>
                </div>
                <button onClick={updateProfile} className="w-full bg-amber-500 text-zinc-950 py-4 rounded-xl font-black uppercase tracking-widest mt-6 shadow-xl shadow-amber-500/20 active:scale-95 transition-all">
                  Save Information
                </button>
              </div>
            )}
          </div>

          {/* ─── CARD 2: Bank Details (visible after KYC) ─── */}
          <div className="relative bg-[#0c0c0c]/80 backdrop-blur-xl border border-zinc-800/60 rounded-[2rem] p-8 shadow-2xl overflow-hidden">
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.25em] mb-6">Bank Details</p>

            {kyc ? (
              <>
                {/* Domestic Fiat Account */}
                <div className="bg-gradient-to-br from-zinc-800/50 to-zinc-900/50 rounded-2xl p-5 border border-zinc-700/30 mb-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center border border-amber-500/20">
                        <FaUniversity className="text-amber-500" size={16} />
                      </div>
                      <div>
                        <p className="text-white font-bold text-sm">{bankName}</p>
                        <p className="text-zinc-500 text-[10px]">Domestic Fiat Account</p>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-zinc-500 text-[9px] font-black uppercase tracking-widest">Available Balance</p>
                    <h3 className="text-3xl font-black text-white tracking-tighter">
                      ${(balance / liveRate).toFixed(2)}
                    </h3>
                  </div>
                </div>

                {/* Web3 Crypto Vault */}
                <div className="bg-gradient-to-br from-blue-900/40 to-indigo-900/40 rounded-2xl p-5 border border-blue-700/30 mb-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center border border-blue-500/20">
                        <div className="text-blue-500 font-bold italic text-sm">W3</div>
                      </div>
                      <div>
                        <p className="text-white font-bold text-sm">Platform USDC</p>
                        <p className="text-blue-300 text-[10px]">Web3 Crypto Vault</p>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-blue-400 text-[9px] font-black uppercase tracking-widest">On-Chain Balance</p>
                    <h3 className="text-3xl font-black text-white tracking-tighter">
                      {usdcBalance.toFixed(2)} pUSDC
                    </h3>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-zinc-800/40 group/copy">
                    <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Internal Platform Vault</span>
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-300 text-xs font-semibold truncate max-w-[160px]">{walletAddr}</span>
                      <button onClick={() => copyToClipboard(walletAddr, 'wallet')} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-600 hover:text-amber-500 transition-all">
                        {copied === 'wallet' ? <FiCheck size={12} className="text-emerald-500" /> : <FiCopy size={12} />}
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-zinc-800/40 group/copy">
                    <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Web3 Connected Wallet</span>
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-300 text-xs font-semibold truncate max-w-[160px]">{externalWallet}</span>
                      <button onClick={() => copyToClipboard(externalWallet, 'extwallet')} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-600 hover:text-amber-500 transition-all">
                        {copied === 'extwallet' ? <FiCheck size={12} className="text-emerald-500" /> : <FiCopy size={12} />}
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-zinc-800/40 group/copy">
                    <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">UPI ID</span>
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-300 text-sm font-semibold">{upiId}</span>
                      <button onClick={() => copyToClipboard(upiId, 'upi')} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-600 hover:text-amber-500 transition-all">
                        {copied === 'upi' ? <FiCheck size={12} className="text-emerald-500" /> : <FiCopy size={12} />}
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-[280px] text-center">
                <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center mb-4 border border-amber-500/20">
                  <FaShieldAlt className="text-amber-500" size={24} />
                </div>
                <p className="text-zinc-400 text-sm font-bold mb-1">KYC Verification Required</p>
                <p className="text-zinc-600 text-xs mb-6">Complete verification to view bank details</p>
                <Link to="/KYC" className="bg-amber-500 text-zinc-950 px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-amber-500/20 hover:shadow-amber-500/40 transition-all">
                  Verify Now
                </Link>
              </div>
            )}
          </div>

          {/* ─── CARD 3: Transaction Graph (Send & Receive) ─── */}
          <div className="relative bg-[#0c0c0c]/80 backdrop-blur-xl border border-zinc-800/60 rounded-[2rem] p-8 shadow-2xl overflow-hidden">
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.25em] mb-2">Spendings</p>

            {kyc ? (
              <>
                <div className="flex items-baseline gap-3 mb-1">
                  <h3 className="text-3xl font-black text-white tracking-tighter">${totalSent.toFixed(2)}</h3>
                </div>

                <div className="flex items-center gap-4 mb-6">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm bg-orange-400"></div>
                    <span className="text-zinc-500 text-[9px] font-bold uppercase tracking-widest">Sent ${totalSent.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm bg-violet-500"></div>
                    <span className="text-zinc-500 text-[9px] font-bold uppercase tracking-widest">Received ${totalReceived.toFixed(2)}</span>
                  </div>
                </div>

                <div className="h-[220px]">
                  <Bar data={chartData} options={chartOptions} />
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-[280px] text-center">
                <FiSend className="text-zinc-700 text-5xl mb-4" />
                <p className="text-zinc-500 text-xs font-bold">Complete KYC to view transaction graph</p>
              </div>
            )}
          </div>

          {/* ─── CARD 4: UPI to Crypto Transactions ─── */}
          <div className="relative bg-[#0c0c0c]/80 backdrop-blur-xl border border-zinc-800/60 rounded-[2rem] p-8 shadow-2xl overflow-hidden">
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.25em] mb-2">Wallet Transactions</p>

            {kyc ? (
              <>
                <div className="flex items-baseline justify-between mb-6">
                  <h3 className="text-3xl font-black text-white tracking-tighter">${totalCryptoValue.toFixed(2)}</h3>
                  <span className="text-emerald-500 text-[10px] font-black bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                    {totalCryptoTx} Txns
                  </span>
                </div>

                <div className="space-y-3 overflow-y-auto max-h-[260px] pr-1 custom-scrollbar">
                  {payments.length > 0 ? (
                    [...payments].reverse().slice(0, 8).map((p, i) => (
                      <div key={i} className="flex items-center justify-between py-3 px-4 bg-zinc-900/40 rounded-xl border border-zinc-800/30 hover:border-zinc-700/50 transition-all">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-emerald-500/10 rounded-lg flex items-center justify-center text-emerald-500 border border-emerald-500/10">
                            <FiArrowUpRight size={16} />
                          </div>
                          <div>
                            <p className="text-white text-xs font-bold">{p.crypto || 'Crypto'}</p>
                            <div className="flex items-center gap-2">
                              <p className="text-zinc-600 text-[9px] font-bold">{p.timestamp ? moment(p.timestamp).format('DD MMM, hh:mm A') : 'Recent'}</p>
                              {p.txHash && (
                                <a 
                                  href={`https://sepolia.etherscan.io/tx/${p.txHash}`} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-[9px] font-bold text-blue-400 hover:text-blue-300 underline"
                                >
                                  View on Etherscan
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                        <p className="text-white text-sm font-black">${Number(p.amount || 0).toFixed(2)}</p>
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <FiDownload className="text-zinc-700 text-3xl mb-3" />
                      <p className="text-zinc-600 text-[10px] font-bold uppercase tracking-widest">No wallet transactions yet</p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-[280px] text-center">
                <FiArrowUpRight className="text-zinc-700 text-5xl mb-4" />
                <p className="text-zinc-500 text-xs font-bold">Complete KYC to view wallet activity</p>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default Profile;
