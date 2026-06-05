import React, { useEffect, useRef, useState } from 'react';
import Chart from 'chart.js/auto';
import api from '../utils/api';
import { FiArrowUp, FiActivity, FiDollarSign, FiTrendingUp, FiCreditCard, FiZap, FiGlobe, FiShield, FiCheckCircle } from 'react-icons/fi';
import QRCode from 'qrcode.react';
import { saveAs } from 'file-saver';
import moment from 'moment';
import AiRemittanceAgent from '../components/Bank/AiRemittanceAgent';

const Dashboard = () => {
  const [transactions, setTransactions] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState({
    totalINR: 0,
    usdcPurchased: 0,
    txCount: 0
  });

  const chartRefs = useRef({
    usdc: null
  });

  const downloadQRCode = (transaction) => {
    const canvas = document.getElementById(`qr-code-${transaction._id || transaction.id}`);
    if (!canvas) return;
    canvas.toBlob((blob) => {
      saveAs(blob, `transaction-${transaction._id || transaction.id}.png`);
    });
  };

  const groupPaymentsByDate = (pays) => {
    const grouped = pays.reduce((acc, p) => {
      const dateKey = moment(p.timestamp).format('YYYY-MM-DD');
      if (!acc[dateKey]) acc[dateKey] = { amount: 0 };
      acc[dateKey].amount += p.usdcValue;
      return acc;
    }, {});

    const paddedGrouped = {};
    for (let i = 6; i >= 0; i--) {
      paddedGrouped[moment().subtract(i, 'days').format('YYYY-MM-DD')] = { amount: 0 };
    }

    Object.keys(grouped).forEach(date => {
      if (paddedGrouped[date]) {
        paddedGrouped[date].amount += grouped[date].amount;
      } else {
        paddedGrouped[date] = grouped[date];
      }
    });

    return Object.keys(paddedGrouped)
      .sort((a, b) => moment(a).unix() - moment(b).unix())
      .map((date) => ({
        date: moment(date).format('MMM DD'),
        amount: paddedGrouped[date].amount,
      }));
  };

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Fetch data and live rates in parallel so we do NOT slow down the system
        const [payRes, transferRes, userRes, cachedRate] = await Promise.all([
          api.get('/pay/paymentRead'),
          api.get('/money-transfer'),
          api.get('/auth/fetchdetail'),
          new Promise(async (resolve) => {
            try {
              const cached = localStorage.getItem('exchangeRates');
              const cachedTime = localStorage.getItem('exchangeRatesTime');
              if (cached && cachedTime && (Date.now() - parseInt(cachedTime) < 300000)) {
                return resolve(JSON.parse(cached));
              }
              const rateRes = await axios.get('https://api.exchangerate-api.com/v4/latest/USD');
              localStorage.setItem('exchangeRates', JSON.stringify(rateRes.data.rates));
              localStorage.setItem('exchangeRatesTime', Date.now().toString());
              resolve(rateRes.data.rates);
            } catch (e) {
              resolve({ INR: 83, BRL: 5, MXN: 17 }); // Immediate fallback on failure
            }
          })
        ]);

        const exchangeRates = cachedRate;

        // 1. Process International Cross-Border Payments
        const pays = Array.isArray(payRes.data) ? payRes.data : [];
        const normalizedPays = pays.map((p) => {
          const currency = p.region === 'Brazil' ? 'BRL' : p.region === 'Mexico' ? 'MXN' : 'INR';
          const rate = exchangeRates[currency] || 83;
          const usdcEquivalent = Number(p.amount) / rate;

          return {
            ...p,
            _id: p._id || p.id,
            type: 'International',
            amount: Number(p.amount) || 0,
            usdcValue: usdcEquivalent,
            currency: currency,
            coin: p.coin || 'USDC',
            receiverId: p.toUPI,
            timestamp: p.date || p.createdAt || new Date().toISOString()
          };
        });

        // 2. Process Domestic Fiat & Web3 Crypto Wallet Transfers
        const transfers = Array.isArray(transferRes.data) ? transferRes.data : [];
        const normalizedTransfers = transfers.map((t) => {
          // Domestic transfers natively use the user's region currency
          const currency = userRes.data?.region === 'Brazil' ? 'BRL' : userRes.data?.region === 'Mexico' ? 'MXN' : 'INR';
          const rate = exchangeRates[currency] || 83;
          const usdcEquivalent = t.network === 'sepolia' ? t.amount : Number(t.amount) / rate;
          const fiatAmount = t.network === 'sepolia' ? t.amount * rate : t.amount;

          return {
            ...t,
            _id: t._id || t.id,
            type: t.network === 'sepolia' ? 'Web3 Wallet' : 'Domestic Fiat',
            amount: fiatAmount, // Always store fiat representation for main column
            usdcValue: usdcEquivalent,
            currency: currency,
            coin: t.network === 'sepolia' ? 'USDC (Sepolia)' : 'Fiat',
            receiverId: t.receiverUPI,
            txHash: t.txHash || null,
            timestamp: t.timestamp || t.createdAt || new Date().toISOString()
          };
        });

        // 3. Merge and Chronologically Sort
        const allTransactions = [...normalizedPays, ...normalizedTransfers].sort((a, b) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );

        setTransactions(allTransactions);
        setUser(userRes.data);

        // Calculate real totals across all platform interactions
        const totalFiat = allTransactions.reduce((sum, p) => sum + p.amount, 0);
        const usdc = allTransactions.reduce((sum, p) => sum + p.usdcValue, 0);

        setTotals({
          totalFiat: totalFiat.toFixed(2),
          usdcPurchased: usdc.toFixed(2),
          txCount: allTransactions.length
        });

        setLoading(false);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  useEffect(() => {
    if (!loading && transactions.length >= 0) {
      drawCharts(transactions);
    }
  }, [transactions, loading]);

  const destroyChart = (refName) => {
    if (chartRefs.current[refName]) {
      chartRefs.current[refName].destroy();
      chartRefs.current[refName] = null;
    }
  };

  const drawCharts = (data) => {
    destroyChart('internal');
    destroyChart('external');

    const internalPayments = data.filter(p => p.coin === 'USDC (Sepolia)');
    const externalPayments = data.filter(p => p.coin === 'USDC');
    
    const aggregatedInternal = groupPaymentsByDate(internalPayments).slice(-7);
    const aggregatedExternal = groupPaymentsByDate(externalPayments).slice(-7);

    const commonOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#52525b', font: { size: 10 } }
        },
        x: {
          grid: { display: false },
          ticks: { color: '#52525b', font: { size: 10 } }
        }
      }
    };

    const ctxInternal = document.getElementById('internalChart')?.getContext('2d');
    if (ctxInternal) {
      const gradient = ctxInternal.createLinearGradient(0, 0, 0, 350);
      gradient.addColorStop(0, 'rgba(168, 85, 247, 0.3)'); // purple-500
      gradient.addColorStop(1, 'rgba(168, 85, 247, 0.0)'); 

      chartRefs.current.internal = new Chart(ctxInternal, {
        type: 'line',
        data: {
          labels: aggregatedInternal.map(a => a.date),
          datasets: [{
            data: aggregatedInternal.map(a => a.amount),
            borderColor: '#a855f7',
            backgroundColor: gradient,
            borderWidth: 3,
            tension: 0.4,
            fill: true,
            pointBackgroundColor: '#22d3ee',
            pointBorderColor: '#050117',
            pointBorderWidth: 2,
            pointRadius: 5,
            pointHoverRadius: 7
          }]
        },
        options: {
          ...commonOptions,
          plugins: {
            ...commonOptions.plugins,
            tooltip: {
              backgroundColor: 'rgba(9, 9, 11, 0.9)',
              titleColor: '#a1a1aa',
              bodyColor: '#fff',
              borderColor: 'rgba(168, 85, 247, 0.2)',
              borderWidth: 1,
              padding: 12,
              displayColors: false,
              callbacks: {
                label: function(context) {
                  return context.parsed.y.toFixed(2) + ' pUSDC';
                }
              }
            }
          }
        }
      });
    }

    const ctxExternal = document.getElementById('externalChart')?.getContext('2d');
    if (ctxExternal) {
      const gradient = ctxExternal.createLinearGradient(0, 0, 0, 350);
      gradient.addColorStop(0, 'rgba(34, 211, 238, 0.3)'); // cyan-400
      gradient.addColorStop(1, 'rgba(34, 211, 238, 0.0)'); 

      chartRefs.current.external = new Chart(ctxExternal, {
        type: 'line',
        data: {
          labels: aggregatedExternal.map(a => a.date),
          datasets: [{
            data: aggregatedExternal.map(a => a.amount),
            borderColor: '#22d3ee',
            backgroundColor: gradient,
            borderWidth: 3,
            tension: 0.4,
            fill: true,
            pointBackgroundColor: '#a855f7',
            pointBorderColor: '#050117',
            pointBorderWidth: 2,
            pointRadius: 5,
            pointHoverRadius: 7
          }]
        },
        options: {
          ...commonOptions,
          plugins: {
            ...commonOptions.plugins,
            tooltip: {
              backgroundColor: 'rgba(9, 9, 11, 0.9)',
              titleColor: '#a1a1aa',
              bodyColor: '#fff',
              borderColor: 'rgba(34, 211, 238, 0.2)',
              borderWidth: 1,
              padding: 12,
              displayColors: false,
              callbacks: {
                label: function(context) {
                  return context.parsed.y.toFixed(2) + ' USDC';
                }
              }
            }
          }
        }
      });
    }
  };

  const region = user?.region || user?.bankDetails?.region || 'India';
  const currencySym = region === 'Brazil' ? 'R$' : region === 'Mexico' ? '$' : '₹';
  const currencyCode = region === 'Brazil' ? 'BRL' : region === 'Mexico' ? 'MXN' : 'INR';

  return (
    <div className="min-h-screen bg-[#050117] text-white p-4 md:p-8 font-sans selection:bg-purple-500/30">
      <div className="max-w-[1600px] mx-auto space-y-10">

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 px-2">
          <div>
            <h1 className="text-4xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-500">Dashboard</h1>
          </div>
          
          {/* Display PayTag if verified */}
          {user && user.global_verified && user.globalPayTag && (
            <div className="bg-zinc-900/50 border border-zinc-800/80 px-4 py-2 rounded-xl flex items-center gap-3">
              <span className="text-xs text-zinc-400 font-bold uppercase tracking-widest">Global PayTag</span>
              <span className="text-sm font-black text-purple-400 bg-purple-500/10 px-3 py-1 rounded-lg border border-purple-500/20">
                {user.globalPayTag}
              </span>
            </div>
          )}
        </div>

        {/* Identity & Routing Widget */}
        <div className="bg-zinc-900/50 backdrop-blur-md border border-zinc-800/50 rounded-2xl p-6 shadow-2xl mt-4">
          <h2 className="text-xl font-bold text-white mb-4 tracking-tight flex items-center gap-2">
            <FiShield className="text-purple-400" /> Identity & Routing
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Bank Setup Status */}
            <div className="p-4 rounded-xl border border-zinc-800/80 bg-black/40 flex flex-col justify-between">
              <div>
                <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest mb-1">Bank Setup</p>
                {user?.upi ? (
                  <div>
                    <div className="flex items-center gap-2 text-emerald-400 mb-1">
                      <FiCheckCircle size={16} />
                      <span className="text-sm font-bold">Verified & Linked</span>
                    </div>
                    <p className="text-xs text-zinc-400 font-mono">{user.bankDetails.bankName || 'Local Bank'} • {user.upi}</p>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center gap-2 text-amber-500 mb-1">
                      <FiActivity size={16} />
                      <span className="text-sm font-bold">Action Required</span>
                    </div>
                    <p className="text-xs text-zinc-400 mb-3">Link your local bank to enable deposits.</p>
                    <a href="/KYC" className="inline-block bg-white text-black px-4 py-2 rounded-lg text-xs font-bold hover:bg-zinc-200 transition-colors">
                      Finish Bank Setup
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Web3 Identity Status */}
            <div className="p-4 rounded-xl border border-zinc-800/80 bg-black/40 flex flex-col justify-between">
              <div>
                <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest mb-1">Web3 Identity</p>
                {user?.kyc && user?.metamask ? (
                  <div>
                    <div className="flex items-center gap-2 text-emerald-400 mb-1">
                      <FiCheckCircle size={16} />
                      <span className="text-sm font-bold">Verified ({user.kycProvider || 'Web3'})</span>
                    </div>
                    <p className="text-xs text-zinc-400 font-mono truncate">{user.metamask}</p>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center gap-2 text-amber-500 mb-1">
                      <FiGlobe size={16} />
                      <span className="text-sm font-bold">Action Required</span>
                    </div>
                    <p className="text-xs text-zinc-400 mb-3">Verify identity to unlock global transfers.</p>
                    <a href="/web3-kyc" className="inline-block bg-white text-black px-4 py-2 rounded-lg text-xs font-bold hover:bg-zinc-200 transition-colors">
                      Verify Web3 Identity
                    </a>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { label: `Total Bridged Volume (${currencyCode})`, value: `${currencySym}${totals.totalFiat}`, icon: FiDollarSign, color: 'text-cyan-400 border-cyan-500/20', trend: `${totals.txCount} Conversions` },
            { label: 'Distributed USDC', value: `${totals.usdcPurchased} USDC`, icon: FiTrendingUp, color: 'text-blue-400 border-blue-500/20', trend: 'On-Chain Settled' },
          ].map((stat, i) => (
            <div key={i} className="group bg-zinc-900/30 backdrop-blur-md border border-zinc-800/50 p-4 rounded-2xl hover:border-purple-500/30 transition-all duration-500 shadow-xl relative overflow-hidden">
              <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center border bg-zinc-950/50 ${stat.color}`}>
                    <stat.icon size={16} />
                  </div>
                  <div>
                    <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-0.5">{stat.label}</p>
                    <h3 className="text-xl font-black tracking-tight">{stat.value}</h3>
                  </div>
                </div>
                <div className="text-right hidden sm:block">
                  <p className="text-zinc-400 text-[9px] font-bold uppercase tracking-widest bg-zinc-800/50 border border-zinc-700/50 px-2 py-1 rounded-md">{stat.trend}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Internal Vault Chart */}
          <div className="bg-zinc-900/30 backdrop-blur-md border border-zinc-800/50 p-6 rounded-[2rem] shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-black uppercase tracking-widest text-zinc-400">Internal Vault (pUSDC)</h3>
              <span className="text-[10px] font-bold text-purple-400 bg-purple-500/10 px-2 py-1 rounded-full border border-purple-500/10">7D WINDOW</span>
            </div>
            <div className="h-56 relative">
              <canvas id="internalChart"></canvas>
            </div>
          </div>

          {/* External Wallet Chart */}
          <div className="bg-zinc-900/30 backdrop-blur-md border border-zinc-800/50 p-6 rounded-[2rem] shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-black uppercase tracking-widest text-zinc-400">External Wallet (USDC)</h3>
              <span className="text-[10px] font-bold text-cyan-400 bg-cyan-500/10 px-2 py-1 rounded-full border border-cyan-500/10">7D WINDOW</span>
            </div>
            <div className="h-56 relative">
              <canvas id="externalChart"></canvas>
            </div>
          </div>
        </div>

        {/* Transaction Table */}
        <div className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-2xl font-black tracking-tighter">On-Chain Gateway Ledger</h2>
            <button className="text-zinc-500 text-[10px] font-black uppercase tracking-widest hover:text-white transition-colors">Refresh Nodes</button>
          </div>

          <div className="bg-zinc-900/30 backdrop-blur-md border border-zinc-800/50 rounded-[2.5rem] overflow-hidden shadow-2xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-900/50 border-b border-zinc-800/50">
                  <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-zinc-500">Receiver UPI ID</th>
                  <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-zinc-500">Fiat Bridged</th>
                  <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-zinc-500">Token Purchased</th>
                  <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-zinc-500">Estimated Value</th>
                  <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-zinc-500">Timestamp</th>
                  <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-center">Receipt Key</th>
                  <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-right">Verification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/30">
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={`skeleton-${i}`} className="animate-pulse border-b border-zinc-800/30">
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-zinc-800/50 rounded-xl"></div>
                          <div className="space-y-2">
                            <div className="h-3 w-24 bg-zinc-800/50 rounded-full"></div>
                            <div className="h-2 w-16 bg-zinc-800/50 rounded-full"></div>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6"><div className="h-5 w-16 bg-zinc-800/50 rounded-md"></div></td>
                      <td className="px-8 py-6"><div className="h-5 w-16 bg-zinc-800/50 rounded-full"></div></td>
                      <td className="px-8 py-6"><div className="h-4 w-12 bg-zinc-800/50 rounded-md"></div></td>
                      <td className="px-8 py-6"><div className="h-4 w-20 bg-zinc-800/50 rounded-md"></div></td>
                      <td className="px-8 py-6"><div className="h-8 w-8 bg-zinc-800/50 rounded-lg mx-auto"></div></td>
                      <td className="px-8 py-6 text-right"><div className="h-8 w-20 bg-zinc-800/50 rounded-xl ml-auto"></div></td>
                    </tr>
                  ))
                ) : transactions.length === 0 ? (
                  <tr><td colSpan="7" className="p-20 text-center text-zinc-500 font-black uppercase tracking-[0.3em]">No Transactions Detected</td></tr>
                ) : (
                  transactions.slice(0, 10).map((t) => (
                    <tr key={t._id} className="group hover:bg-white/[0.01] transition-colors">
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center border text-purple-400 ${t.type === 'Web3 Wallet' ? 'border-amber-500/20 text-amber-400' : 'border-purple-500/20'}`}>
                            <FiArrowUp />
                          </div>
                          <div>
                            <p className="text-white font-bold text-sm tracking-tight">{t.receiverId || 'Unknown'}</p>
                            <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mt-0.5">{t.type}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <p className="text-base font-black text-white">
                          ₹{t.amount.toFixed(2)}
                        </p>
                      </td>
                      <td className="px-8 py-6">
                        <span className={`px-3 py-1 bg-zinc-900 border rounded-full text-[9px] font-black uppercase tracking-widest ${t.coin === 'USDC' ? 'text-blue-400 border-blue-500/20' : 'text-amber-400 border-amber-500/20'}`}>
                          {t.coin}
                        </span>
                      </td>
                      <td className="px-8 py-6">
                        <p className="text-emerald-500 text-xs font-bold">{t.usdcValue ? t.usdcValue.toFixed(2) : '0.00'} USDC</p>
                      </td>
                      <td className="px-8 py-6">
                        <p className="text-zinc-500 text-xs font-medium">{moment(t.timestamp).format('MMM DD, HH:mm')}</p>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex justify-center">
                          <QRCode id={`qr-code-${t._id}`} value={JSON.stringify(t)} size={32} bgColor="transparent" fgColor="#6b21a8" />
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        {t.type === 'Domestic Fiat' ? (
                          <span className="inline-block px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-[9px] font-black uppercase text-zinc-500">
                            OFF-CHAIN
                          </span>
                        ) : (
                          <a
                            href={t.txHash ? `https://sepolia.etherscan.io/tx/${t.txHash}` : `https://sepolia.etherscan.io/tx/0x${t._id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-block px-4 py-2 bg-purple-900/20 hover:bg-purple-900/40 border border-purple-500/20 rounded-xl text-[9px] font-black uppercase text-purple-400 hover:text-purple-300 transition-all"
                          >
                            VERIFY TX
                          </a>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <AiRemittanceAgent user={user} refreshData={() => window.location.reload()} />
    </div>
  );
};

export default Dashboard;
