import React from 'react';
import { Bar } from 'react-chartjs-2';
import moment from 'moment';
import { FiTrendingUp, FiTrendingDown } from 'react-icons/fi';

const BarGraph = ({ title, transactions, type, userData }) => {
  if (!transactions || !userData) return (
    <div className="flex-1 bg-[#0a0a0a] border border-zinc-800/50 rounded-3xl h-[400px] flex items-center justify-center">
       <div className="animate-pulse text-zinc-600 font-black uppercase text-[10px] tracking-widest">Awaiting Data Node...</div>
    </div>
  );

  const validIds = [userData?.bankDetails?.upiId, userData?.globalPayTag].filter(Boolean);

  // Filter transactions based on type
  const filteredTxs = transactions.filter(t => 
    type === 'sent' ? validIds.includes(t.senderUPI) : validIds.includes(t.receiverUPI)
  ).slice(-8); 

  const data = {
    labels: filteredTxs.map(t => moment(t.timestamp).format('DD MMM')),
    datasets: [
      {
        label: title,
        data: filteredTxs.map(t => t.amount),
        backgroundColor: type === 'sent' ? 'rgba(255, 255, 255, 0.9)' : 'rgba(16, 185, 129, 0.9)',
        borderRadius: 12,
        barThickness: 20,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#000',
        titleFont: { size: 12, weight: '900' },
        bodyFont: { size: 14, weight: '700' },
        padding: 16,
        displayColors: false,
        callbacks: {
          label: (context) => `$${context.raw.toFixed(2)}`
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(255, 255, 255, 0.03)' },
        ticks: { color: '#3f3f46', font: { size: 10, weight: '700' }, callback: (v) => `$${v}` }
      },
      x: {
        grid: { display: false },
        ticks: { color: '#3f3f46', font: { size: 10, weight: '700' } }
      }
    }
  };

  const totalAmount = filteredTxs.reduce((sum, t) => sum + Number(t.amount), 0);

  return (
    <div className="bg-[#0a0a0a] border-zinc-800/50 border p-8 rounded-[2.5rem] flex-1 shadow-2xl relative overflow-hidden group transition-all duration-500 hover:border-zinc-700/50">
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em] mb-1">{title}</p>
            <h3 className="text-3xl font-black text-white tracking-tighter">${totalAmount.toFixed(2)}</h3>
          </div>
          <div className={`p-3 rounded-2xl border ${type === 'sent' ? 'bg-red-500/5 border-red-500/10 text-red-500' : 'bg-emerald-500/5 border-emerald-500/10 text-emerald-500'}`}>
            {type === 'sent' ? <FiTrendingDown size={20} /> : <FiTrendingUp size={20} />}
          </div>
        </div>
        
        <div className="h-[250px] mt-4">
          <Bar data={data} options={options} />
        </div>
      </div>
      
      <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-zinc-800/50 to-transparent"></div>
    </div>
  );
}

export default BarGraph;