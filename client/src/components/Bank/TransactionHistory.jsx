import React, { useState } from 'react';
import moment from 'moment';
import { FiArrowUpRight, FiArrowDownLeft, FiClock, FiActivity, FiArrowRight } from 'react-icons/fi';

const TransactionHistory = ({ transactions, userData }) => {
  const [showAll, setShowAll] = useState(false);

  if (!transactions) return (
    <div className="flex-1 bg-[#0a0a0a] border border-zinc-800/50 rounded-3xl flex items-center justify-center">
      <div className="animate-pulse flex flex-col items-center gap-4">
        <div className="w-12 h-12 bg-zinc-800 rounded-full"></div>
        <p className="text-zinc-500 font-black uppercase text-[10px] tracking-widest">Encrypting History...</p>
      </div>
    </div>
  );

  const validIds = [userData?.bankDetails?.upiId, userData?.globalPayTag].filter(Boolean);

  return (
    <div className="bg-[#0a0a0a] border-zinc-800/50 border p-8 rounded-[2.5rem] flex-1 shadow-2xl h-full flex flex-col relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl -mr-16 -mt-16"></div>

      <div className="flex items-center justify-between mb-10 relative z-10">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tighter">Activity Log</h2>
          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mt-1">Transaction Ledger</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="bg-zinc-900 text-zinc-400 text-[10px] font-black uppercase px-4 py-1.5 rounded-full border border-zinc-800 tracking-widest">
            {transactions.length} Total
          </span>
          <div className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-amber-500">
            <FiActivity size={18} />
          </div>
        </div>
      </div>

      <div className="overflow-y-auto pr-3 custom-scrollbar flex-1 relative z-10 space-y-4 max-h-[600px]">
        {transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500 opacity-30 min-h-[300px]">
            <FiClock className="text-6xl mb-4" />
            <p className="font-black uppercase text-xs tracking-[0.3em]">No Data Flow Detected</p>
          </div>
        ) : (
          <div className="space-y-4">
            {(() => {
              const displayTransactions = [];
              [...transactions].reverse().forEach((transaction, index) => {
                const isSent = validIds.includes(transaction.senderUPI);
                const isReceived = validIds.includes(transaction.receiverUPI);

                if (isSent) {
                  displayTransactions.push({ ...transaction, isSent: true, key: `${index}-sent` });
                }
                if (isReceived) {
                  displayTransactions.push({ ...transaction, isSent: false, key: `${index}-received` });
                }
              });

              const visibleTransactions = showAll ? displayTransactions : displayTransactions.slice(0, 4);

              return visibleTransactions.map((t) => {
                const isSent = t.isSent;
                const isBridgeMint = t.receiverUPI?.includes('Two-Way Bridge');
                const isBridgeBurn = t.senderUPI?.includes('Two-Way Bridge');
                
                const displayReceiver = isBridgeMint ? t.receiverUPI : (t.receiver?.globalPayTag || t.receiverUPI);
                const displaySender = isBridgeBurn ? t.senderUPI : (t.sender?.globalPayTag || t.senderUPI);

                return (
                  <div
                    key={t.key}
                    className="group/item bg-zinc-900/30 hover:bg-zinc-900 border border-zinc-800/30 hover:border-zinc-700/50 p-5 rounded-2xl transition-all duration-500 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-5">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 ${isSent ? 'bg-red-500/5 text-red-500 border border-red-500/10 group-hover/item:bg-red-500/10' : 'bg-emerald-500/5 text-emerald-500 border border-emerald-500/10 group-hover/item:bg-emerald-500/10'}`}>
                        {isSent ? <FiArrowUpRight size={24} strokeWidth={2.5} /> : <FiArrowDownLeft size={24} strokeWidth={2.5} />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-zinc-500 text-[9px] font-black uppercase tracking-widest">{isSent ? 'Outgoing' : 'Incoming'}</p>
                          <div className={`w-1 h-1 rounded-full ${isSent ? 'bg-red-500' : 'bg-emerald-500'}`}></div>
                          
                          {/* Network Rail Badge */}
                          {t.txHash ? (
                            <a 
                              href={`https://sepolia.etherscan.io/tx/${t.txHash}`} 
                              target="_blank" 
                              rel="noreferrer"
                              className="ml-2 px-2 py-0.5 rounded text-[8px] font-bold tracking-wider uppercase border border-amber-500/30 text-amber-500 bg-amber-500/10 hover:bg-amber-500/20 transition-colors flex items-center gap-1"
                            >
                              <span className="w-1 h-1 rounded-full bg-amber-500 animate-pulse"></span>
                              Etherscan Verified
                            </a>
                          ) : (
                            <span className="ml-2 px-2 py-0.5 rounded text-[8px] font-bold tracking-wider uppercase border border-blue-500/30 text-blue-500 bg-blue-500/10 flex items-center gap-1">
                              Platform Settled
                            </span>
                          )}
                        </div>
                        <p className="text-white font-black text-lg tracking-tight group-hover/item:text-amber-500 transition-colors flex items-center gap-2 mt-1">
                          {isSent ? (
                            <>To <span className="text-zinc-400 font-medium text-sm">{displayReceiver}</span></>
                          ) : (
                            <>From <span className="text-zinc-400 font-medium text-sm">{displaySender}</span></>
                          )}
                        </p>
                        <div className="flex items-center gap-2 text-zinc-600 text-[10px] mt-1.5 font-bold uppercase tracking-widest">
                          <FiClock size={10} className="text-amber-500/50" />
                          <span>{moment(t.timestamp).format('DD MMM • hh:mm A')}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className={`text-2xl font-black tracking-tighter ${isSent ? 'text-white' : 'text-emerald-500'}`}>
                        {isSent ? '-' : '+'}${Number(t.amount).toFixed(2)}
                      </p>
                      {t.savedAmount > 0 && (
                        <div className="inline-flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 mt-2">
                          <span className="text-[9px] text-emerald-500 font-black uppercase tracking-tighter">
                            Saved: ${t.savedAmount.toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        )}
      </div>

      {transactions.length > 4 && (
        <div className="mt-6 pt-6 border-t border-zinc-800/50 relative z-10">
          <button 
            onClick={() => setShowAll(!showAll)}
            className="w-full py-4 bg-zinc-900 border border-zinc-800 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 hover:text-white transition-all flex items-center justify-center gap-2 group"
          >
            {showAll ? 'View Less' : 'View Complete History'} <FiArrowRight className={`transition-transform ${showAll ? '-rotate-90' : 'group-hover:translate-x-1'}`} />
          </button>
        </div>
      )}
    </div>
  );
};

export default TransactionHistory;