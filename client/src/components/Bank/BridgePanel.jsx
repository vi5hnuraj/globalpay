import React, { useState } from 'react';
import { FiArrowRight, FiArrowLeft, FiRepeat } from 'react-icons/fi';
import api from '../../utils/api';
import { toast, Toaster } from 'react-hot-toast';

const BridgePanel = () => {
  const [bridgeAmount, setBridgeAmount] = useState('');
  const [isBridging, setIsBridging] = useState(false);
  const [direction, setDirection] = useState('fiatToCrypto'); // 'fiatToCrypto' or 'cryptoToFiat'

  const handleBridge = async () => {
    if (!bridgeAmount || isNaN(bridgeAmount) || Number(bridgeAmount) <= 0) {
      toast.error('Enter a valid amount to bridge');
      return;
    }

    setIsBridging(true);
    const toastId = toast.loading('Connecting to Ethereum Sepolia...');
    
    try {
      if (direction === 'fiatToCrypto') {
        await api.post('/bank/swap-to-crypto', { amount: Number(bridgeAmount) });
        toast.success('Bridge Successful! pUSDC Minted.', { id: toastId });
      } else {
        await api.post('/bank/swap-to-fiat', { amount: Number(bridgeAmount) });
        toast.success('Off-Ramp Successful! pUSDC Burned and Fiat Credited.', { id: toastId });
      }
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

  const toggleDirection = () => {
    setDirection(prev => prev === 'fiatToCrypto' ? 'cryptoToFiat' : 'fiatToCrypto');
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex items-center justify-between shadow-lg mb-6">
      <div className="flex items-center gap-4">
        <div>
          <p className="text-sm text-zinc-400 font-bold tracking-widest uppercase">Two-Way Bridge</p>
          <p className="text-xs text-zinc-500 mt-1">
            {direction === 'fiatToCrypto' 
              ? 'Convert Domestic Fiat to Global pUSDC' 
              : 'Withdraw Global pUSDC to Domestic Fiat'}
          </p>
        </div>
        
        <button 
          onClick={toggleDirection}
          className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-amber-500 rounded-full transition-colors ml-4"
          title="Switch Direction"
        >
          <FiRepeat size={16} />
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative">
          <span className="absolute left-3 top-2.5 text-zinc-500 font-bold">
            {direction === 'fiatToCrypto' ? '$' : 'pUSDC'}
          </span>
          <input 
            type="number" 
            placeholder="0.00" 
            value={bridgeAmount}
            onChange={(e) => setBridgeAmount(e.target.value)}
            className={`bg-zinc-800 border border-zinc-700 rounded-lg py-2 ${direction === 'fiatToCrypto' ? 'pl-7 w-32' : 'pl-[75px] w-40'} pr-4 text-white focus:outline-none focus:border-amber-500`}
          />
        </div>
        <button 
          onClick={handleBridge}
          disabled={isBridging}
          className={`font-bold py-2 px-4 rounded-lg flex items-center gap-2 transition-all disabled:opacity-50 ${
            direction === 'fiatToCrypto' 
              ? 'bg-amber-500 hover:bg-amber-400 text-zinc-950' 
              : 'bg-blue-600 hover:bg-blue-500 text-white'
          }`}
        >
          {isBridging ? 'Bridging...' : (direction === 'fiatToCrypto' ? 'Mint pUSDC' : 'Withdraw Fiat')} 
          {direction === 'fiatToCrypto' ? <FiArrowRight /> : <FiArrowLeft />}
        </button>
      </div>
    </div>
  );
};

export default BridgePanel;
