import React, { useState, useRef, useEffect } from 'react';
import { FiMessageSquare, FiSend, FiX, FiZap, FiCheckCircle } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import api from '../../utils/api';
import axios from 'axios';

const AiRemittanceAgent = ({ user, refreshData }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'ai',
      text: "👋 Hi! I'm your AI Remittance Agent. I can help you send money instantly across the globe using stablecoins. Try saying: 'Send 50 USD to @carlos_br'",
    }
  ]);
  
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = async (e) => {
    if (e) e.preventDefault();
    if (!input.trim()) return;

    const userMessage = { id: Date.now(), sender: 'user', text: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    try {
      const systemPrompt = `
You are an AI Remittance Agent.
Extract the transaction intent from the user's message.
Respond ONLY with a valid JSON object, no markdown, no other text.

If the user wants to send or transfer money, return:
{
  "intent": "smart-route",
  "amount": "100", // exact amount as string
  "currency": "USD", // extracted currency, default to USD if not specified
  "payTag": "@username" // extracted pay tag
}
If they are just saying hello or asking a general question, return:
{
  "intent": "chat",
  "reply": "Your conversational reply here"
}
      `;

      const response = await axios.post(
        'https://api.x.ai/v1/chat/completions',
        { 
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage.text }
          ],
          model: "grok-2-latest"
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_XAI_API_KEY || 'dummy_key'}`
          }
        }
      );

      const responseText = response.data.choices[0].message.content;
      const cleanedText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      
      let parsed = null;
      try {
        parsed = JSON.parse(cleanedText);
      } catch (jsonErr) {
        console.error("Failed to parse xAI response as JSON", cleanedText);
      }

      setIsTyping(false);

      if (parsed && (parsed.intent === 'transfer' || parsed.intent === 'smart-route') && parsed.amount && parsed.payTag) {
        setMessages(prev => [...prev, {
          id: Date.now() + 1,
          sender: 'ai',
          text: `🤖 **Smart Route Found!**\n\nI will execute a 4-step atomic transaction to pay ${parsed.payTag}:\n1. Deduct ${parsed.amount} ${parsed.currency || 'USD'} from your local bank.\n2. Auto-bridge into pUSDC via Sepolia (Zero Gas Fees).\n3. Send globally in 12 seconds.\n4. Auto-Offramp the pUSDC into ${parsed.payTag}'s local bank account.\n\nShould I execute this Smart Route now?`,
          isAction: true,
          transactionData: { amount: parsed.amount, currency: parsed.currency || 'USD', payTag: parsed.payTag }
        }]);
      } else if (parsed && parsed.intent === 'chat') {
        setMessages(prev => [...prev, {
          id: Date.now() + 1,
          sender: 'ai',
          text: parsed.reply
        }]);
      } else {
        setMessages(prev => [...prev, {
          id: Date.now() + 1,
          sender: 'ai',
          text: "I didn't quite catch that. Try saying something like 'Send 100 to @username'."
        }]);
      }
    } catch (error) {
      setIsTyping(false);
      console.error("xAI Error:", error.response?.data || error.message || error);
      
      // Fallback for Hackathon Demo if API fails
      const match = userMessage.text.match(/(?:send|transfer|pay)\s*[\$₹]?\s*(\d+(?:\.\d+)?)[a-z\s.,]*(@\w+)/i);
      
      if (match) {
        const amount = match[1];
        const payTag = match[2];
        
        setMessages(prev => [...prev, {
          id: Date.now() + 1,
          sender: 'ai',
          text: `🤖 **Smart Route Found!**\n\nI will execute a 4-step atomic transaction to pay ${payTag}:\n1. Deduct ${amount} USD from your local bank.\n2. Auto-bridge into pUSDC via Sepolia (Zero Gas Fees).\n3. Send globally in 12 seconds.\n4. Auto-Offramp the pUSDC into ${payTag}'s local bank account.\n\nShould I execute this Smart Route now?`,
          isAction: true,
          transactionData: { amount, currency: 'USD', payTag }
        }]);
      } else {
        setMessages(prev => [...prev, {
          id: Date.now() + 1,
          sender: 'ai',
          text: "I'm having trouble connecting to my AI brain right now. Please check your API quotas."
        }]);
      }
    }
  };

  const executeTransaction = async (data, messageId) => {
    if (!user) {
      toast.error('User data not found. Please log in.');
      return;
    }

    // Convert string amount to number
    const txData = {
      amount: data.amount,
      payTag: data.payTag,
      receiverUPI: data.payTag,
      senderUPI: user.globalPayTag || user.upiId || 'unknown'
    };

    // Optimistically update UI to show processing
    setMessages(prev => prev.map(m => 
      m.id === messageId ? { ...m, isAction: false, text: m.text + '\n\n⏳ Processing on-chain...' } : m
    ));

    try {
      await api.post('/payment/smart-route', txData);
      
      setMessages(prev => prev.map(m => 
        m.id === messageId ? { ...m, text: m.text.replace('\n\n⏳ Processing on-chain...', '') } : m
      ));

      setMessages(prev => [...prev, {
        id: Date.now(),
        sender: 'ai',
        text: `✅ Success! ${data.amount} ${data.currency} was successfully bridged and auto-deposited into ${data.payTag}'s local fiat bank account.`,
        isSuccess: true
      }]);

      if (refreshData) refreshData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Transaction failed');
      setMessages(prev => [...prev, {
        id: Date.now(),
        sender: 'ai',
        text: `❌ Transaction failed: ${err.response?.data?.message || 'Insufficient balance or invalid Pay Tag.'}`
      }]);
    }
  };

  return (
    <>
      {/* Floating Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-purple-600 to-amber-500 rounded-full flex items-center justify-center text-white shadow-2xl hover:scale-110 transition-transform z-50 animate-bounce group"
      >
        {isOpen ? <FiX size={24} /> : <FiZap size={24} className="group-hover:animate-pulse" />}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-96 max-w-[calc(100vw-3rem)] h-[500px] bg-black/60 backdrop-blur-2xl border border-zinc-800/80 rounded-[2rem] shadow-[0_0_50px_-12px_rgba(168,85,247,0.3)] flex flex-col z-50 overflow-hidden font-sans animate-fadeIn">
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-600/20 to-amber-500/20 p-5 border-b border-white/5 flex items-center justify-between backdrop-blur-md">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-500 to-amber-500 p-[1px] shadow-lg">
                <div className="w-full h-full bg-black/80 rounded-[15px] flex items-center justify-center">
                  <FiZap className="text-amber-400" size={18} />
                </div>
              </div>
              <div>
                <h3 className="text-white font-black text-sm tracking-wide">AI Agent</h3>
                <p className="text-emerald-400 text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.8)]"></span> Online
                </p>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5 scrollbar-none">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[85%] p-4 text-sm shadow-lg ${
                  msg.sender === 'user' 
                    ? 'bg-gradient-to-br from-amber-500 to-amber-600 text-zinc-950 rounded-[1.5rem] rounded-br-sm font-bold' 
                    : msg.isSuccess 
                      ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-100 rounded-[1.5rem] rounded-bl-sm' 
                      : 'bg-zinc-800/50 border border-zinc-700/50 text-zinc-200 rounded-[1.5rem] rounded-bl-sm'
                }`}>
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                </div>
                
                {msg.isAction && (
                  <div className="mt-3 flex gap-2">
                    <button 
                      onClick={() => executeTransaction(msg.transactionData, msg.id)}
                      className="bg-purple-500 hover:bg-purple-400 text-white text-xs font-black uppercase tracking-wider px-5 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-lg hover:shadow-purple-500/25"
                    >
                      <FiZap size={14} /> Confirm Transfer
                    </button>
                    <button 
                      onClick={() => setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, isAction: false } : m))}
                      className="bg-zinc-800/50 hover:bg-zinc-700/50 border border-zinc-700/50 text-zinc-400 hover:text-white text-xs font-black uppercase tracking-wider px-5 py-2.5 rounded-xl transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            ))}
            
            {isTyping && (
              <div className="flex items-start">
                <div className="bg-zinc-800/50 border border-zinc-700/50 px-4 py-3 rounded-[1.5rem] rounded-bl-sm flex gap-1.5 shadow-lg">
                  <div className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce"></div>
                  <div className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  <div className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 bg-black/40 border-t border-white/5 backdrop-blur-md">
            <form onSubmit={handleSend} className="relative flex items-center">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type 'Send 100 USDC to @carlos_br'..."
                className="w-full bg-zinc-900/50 border border-zinc-700/50 text-white text-sm rounded-2xl pl-5 pr-14 py-4 focus:outline-none focus:border-purple-500/50 focus:bg-zinc-900 transition-all placeholder:text-zinc-600"
              />
              <button 
                type="submit"
                disabled={!input.trim()}
                className="absolute right-2.5 w-9 h-9 bg-gradient-to-r from-purple-500 to-amber-500 hover:from-purple-400 hover:to-amber-400 disabled:from-zinc-800 disabled:to-zinc-800 disabled:text-zinc-600 text-white rounded-xl flex items-center justify-center transition-all shadow-lg"
              >
                <FiSend size={14} className="ml-0.5" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default AiRemittanceAgent;
