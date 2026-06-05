import React, { useState } from "react";
import { GrRadial, GrRadialSelected } from "react-icons/gr";
import { FiFileText, FiClock, FiShield, FiX, FiCheckCircle } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import api from "../utils/api";

const Reqpay = ({ name, sender, amount, isSentByMe, reqId }) => {
  const [paytoggle, setPaytoggle] = useState(false);
  const [paythrough, setPaythrough] = useState("metamask");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  const navigate = useNavigate();

  const payHandler = () => {
    if (isSentByMe) return;
    setMsg(null);
    setPaytoggle(true);
  };
  const closeHandler = () => {
    if (!loading) {
      setPaytoggle(false);
      setMsg(null);
    }
  };
  const paythroughHandler = (type) => setPaythrough(type);

  const confirmPay = async () => {
    setMsg(null);

    if (!sender) {
      setMsg({ type: "error", text: "Receiver address/UPI missing" });
      return;
    }

    const numericAmount = Number(amount) || 0;
    if (numericAmount <= 0) {
      setMsg({ type: "error", text: "Invalid amount" });
      return;
    }

    setLoading(true);

    try {
      const userRes = await api.get("/auth/fetchdetail");
      const user = userRes?.data;

      if (!user || !user._id) {
        setMsg({ type: "error", text: "You must be logged in to pay." });
        setLoading(false);
        return;
      }

      if (paythrough === "metamask") {
        if (!user.metamask) {
          setMsg({ type: "error", text: "Please link your MetaMask in profile before paying with crypto." });
          setLoading(false);
          return;
        }

        const query = new URLSearchParams({
          upi: sender,
          amount: String(numericAmount),
          prefillFromRequest: "true",
          reqId: reqId || "",
        }).toString();

        setLoading(false);
        setPaytoggle(false);
        navigate(`/cryptupi?${query}`);
        return;
      }

      if (paythrough === "upi") {
        const payload = {
          date: new Date().toISOString(),
          to: sender, 
          amt: numericAmount,
          sender: user._id,
          keyword: "request_payment",
          coin: "UPI",
        };

        const writeRes = await api.post("/pay/paymentWrite", payload);

        if (writeRes && (writeRes.status === 200 || writeRes.status === 201)) {
          setMsg({ type: "success", text: "Payment recorded successfully." });
          setTimeout(() => {
            setPaytoggle(false);
            setMsg(null);
          }, 1100);
        } else {
          setMsg({ type: "error", text: `Unexpected server response (${writeRes?.status})` });
        }
        setLoading(false);
        return;
      }

      setMsg({ type: "error", text: "Unknown payment method." });
    } catch (err) {
      console.error("Reqpay confirmPay error:", err);
      const message = err?.response?.data?.message || err.message || "Payment failed";
      setMsg({ type: "error", text: message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className={`bg-[#0a0a0a] border-zinc-800/50 border p-5 rounded-2xl w-full max-w-4xl mx-auto shadow-lg relative overflow-hidden group mb-4 transition-all ${isSentByMe ? 'hover:border-emerald-500/30' : 'hover:border-blue-500/30'}`}>
        <div className={`absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl -mr-8 -mt-8 transition-all duration-700 ${isSentByMe ? 'bg-emerald-500/5 group-hover:bg-emerald-500/10' : 'bg-blue-500/5 group-hover:bg-blue-500/10'}`}></div>
        
        <div className="flex justify-between items-center relative z-10 w-full">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${isSentByMe ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-blue-500/10 border-blue-500/20'}`}>
              <FiFileText className={isSentByMe ? "text-emerald-500" : "text-blue-500"} size={20} />
            </div>
            <div className="flex flex-col">
              <p className="text-white font-bold text-lg">{name === "Unknown" ? (isSentByMe ? "Requested Payment" : "Pending Invoice") : name}</p>
              <p className="text-zinc-500 text-xs font-medium tracking-wide flex items-center gap-1.5 mt-0.5">
                {isSentByMe ? <FiCheckCircle className="text-emerald-400" /> : <FiClock className="text-blue-400" />}
                {isSentByMe ? "To: " : "From: "} {sender}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-0.5">Amount Due</p>
              <p className="font-black text-2xl text-white tracking-tight">{amount}</p>
            </div>
            
            {isSentByMe ? (
              <button 
                disabled
                className="px-8 py-3.5 bg-zinc-900 text-zinc-500 rounded-xl font-bold text-sm uppercase tracking-widest border border-zinc-800 cursor-not-allowed"
              >
                Awaiting
              </button>
            ) : (
              <button 
                onClick={payHandler} 
                disabled={loading}
                className="px-8 py-3.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white rounded-xl font-bold text-sm uppercase tracking-widest shadow-lg transition-all hover:-translate-y-0.5 border border-blue-400/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Settle
              </button>
            )}
          </div>
        </div>
      </div>

      {paytoggle && !isSentByMe && (
        <div className="fixed inset-0 flex items-center justify-center backdrop-blur-md z-50 bg-black/60 p-4">
          <div className="bg-[#0a0a0a] border border-zinc-800 rounded-[2.5rem] w-full max-w-sm shadow-2xl relative overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="absolute top-0 left-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -ml-16 -mt-16"></div>
            
            <button onClick={closeHandler} className="absolute top-6 right-6 text-zinc-500 hover:text-white transition-colors z-20">
              <FiX size={24} />
            </button>

            <div className="p-8 relative z-10 flex flex-col items-center">
              <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 mb-4">
                <FiShield className="text-blue-500" size={28} />
              </div>
              
              <h3 className="text-xl font-black text-white tracking-tighter">Authorize Payment</h3>
              <p className="text-zinc-400 text-sm mt-1 mb-6 text-center">Settling invoice for {sender}</p>

              <div className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 text-center mb-6">
                <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-1">Total Due</p>
                <p className="text-4xl font-black text-white tracking-tighter">{amount}</p>
              </div>

              <div className="w-full space-y-3 mb-8">
                <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest ml-1 mb-2">Selected Method</p>
                
                <div
                  className="flex items-center justify-between p-4 rounded-xl border bg-blue-500/10 border-blue-500/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-500/20">
                      <span className="font-bold text-white text-xs">🦊</span>
                    </div>
                    <p className="font-bold text-sm text-white">MetaMask (Web3)</p>
                  </div>
                  <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center border-blue-500">
                    <div className="w-2.5 h-2.5 bg-blue-500 rounded-full" />
                  </div>
                </div>
              </div>

              {msg && (
                <div className="mb-4 w-full p-3 rounded-lg bg-zinc-900/80 border border-zinc-800 text-center">
                  <p className={`text-sm font-bold ${msg.type === "error" ? "text-red-400" : "text-emerald-400"}`}>{msg.text}</p>
                </div>
              )}

              <button
                onClick={confirmPay}
                disabled={loading}
                className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-2xl transition-all flex items-center justify-center gap-2 ${
                  loading
                  ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' 
                  : 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 hover:-translate-y-0.5 text-white border border-blue-400/30'
                }`}
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-zinc-500 border-t-white rounded-full animate-spin" />
                ) : (
                  "Confirm Payment"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Reqpay;
