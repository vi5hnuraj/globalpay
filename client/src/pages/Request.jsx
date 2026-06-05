// src/pages/Request.jsx
import React, { useEffect, useState } from "react";
import Reqpay from "../components/Reqpay";
import api from "../utils/api"; // correct path based on your project

// Try to find a "requests" array inside arbitrary nested objects/arrays.
// Returns the first array that looks like request items (objects having name/sender/amount keys).
const findRequestsArray = (obj, depth = 6, seen = new WeakSet()) => {
  if (!obj || depth <= 0) return null;
  if (typeof obj !== "object") return null;
  if (seen.has(obj)) return null;
  seen.add(obj);

  if (Array.isArray(obj)) {
    const arr = obj;
    // quick heuristic: check if items look like requests
    const matches = arr.filter((it) => {
      if (!it || typeof it !== "object") return false;
      return ("name" in it) || ("sender" in it) || ("amount" in it) || ("amt" in it);
    });
    if (matches.length > 0) return arr;
    // otherwise search inside array items
    for (const it of arr) {
      const found = findRequestsArray(it, depth - 1, seen);
      if (found) return found;
    }
    return null;
  }

  // obj is plain object: check common keys first
  const candidates = ["requests", "data", "docs", "items", "list"];
  for (const key of candidates) {
    if (obj[key]) {
      const maybe = findRequestsArray(obj[key], depth - 1, seen);
      if (maybe) return maybe;
    }
  }

  // fallback: search all properties
  for (const key of Object.keys(obj)) {
    try {
      const val = obj[key];
      if (val && typeof val === "object") {
        const found = findRequestsArray(val, depth - 1, seen);
        if (found) return found;
      }
    } catch (e) {
      // ignore circular or stringify issues
    }
  }

  return null;
};

const sanitizeItem = (item, idx) => {
  if (!item || typeof item !== "object") {
    return {
      _id: `req_${Date.now()}_${idx}`,
      name: "Unknown",
      sender: "Unknown",
      amount: 0,
    };
  }
  return {
    _id: item._id || item.id || `req_${Date.now()}_${idx}`,
    name: item.name || item.requesterName || item.username || "Unknown",
    sender: item.sender || item.from || item.ownerUpi || item.ownerMetamask || "Unknown",
    amount: item.amount || item.amt || item.value || 0,
    ownerUpi: item.ownerUpi,
    ownerMetamask: item.ownerMetamask,
  };
};

const Request = () => {
  const [data, setData] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      setError(null);

      try {
        // Fetch logged in user to filter their requests
        let currentUser = null;
        try {
          const userRes = await api.get("/auth/fetchdetail");
          currentUser = userRes.data;
        } catch (e) {
          console.warn("Could not fetch current user to filter requests");
        }

        const res = await api.get("/money-transfer/all-request-money");
        console.log("[Request] raw response:", res.status, res.data);

        if (!mounted) return;

        // Try simple shapes first
        let arr = null;
        if (Array.isArray(res.data)) arr = res.data;
        else if (Array.isArray(res.data.requests)) arr = res.data.requests;
        else if (res.data.money && Array.isArray(res.data.money.requests)) arr = res.data.money.requests;
        else if (res.data.docs && Array.isArray(res.data.docs)) arr = res.data.docs.flatMap(d => d.requests || []);
        else {
          // Robust fallback: search recursively inside res.data and res.data.money
          arr = findRequestsArray(res.data) || findRequestsArray(res.data?.money) || [];
        }

        const normalized = (arr || []).map((it, i) => sanitizeItem(it, i));

        // Filter the requests if we have a logged in user
        const filtered = currentUser ? normalized.filter(req => {
          const isOwner = req.ownerUpi === currentUser.upiId || req.ownerUpi === currentUser.globalPayTag || req.ownerMetamask === currentUser.metamask;
          const isSender = req.sender === currentUser.upiId || req.sender === currentUser.globalPayTag || req.sender === currentUser.metamask || req.sender === currentUser._id;
          return isOwner || isSender;
        }).map(req => {
          const isSentByMe = req.sender === currentUser.upiId || req.sender === currentUser.globalPayTag || req.sender === currentUser.metamask || req.sender === currentUser._id;
          return {
            ...req,
            isSentByMe,
            // If it's sent by me, the "sender" field in the UI actually represents the recipient (who owes me money)
            displaySender: isSentByMe ? (req.ownerUpi || req.ownerMetamask || "Unknown") : req.sender
          };
        }) : normalized.map(req => ({...req, isSentByMe: false, displaySender: req.sender}));

        setData(filtered);
      } catch (err) {
        console.error("[Request] fetch error:", err);
        setError("Failed to load requests — check console/network.");
        setData([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, []);

  if (loading) {
    return (
      <div className="h-screen w-full bg-black text-white flex items-center justify-center">
        <p className="text-gray-400 text-lg">Loading request history...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen w-full bg-black text-white flex items-center justify-center">
        <p className="text-red-400 text-lg">{error}</p>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-screen w-full bg-black text-white flex items-center justify-center">
        <p className="text-gray-400 text-xl">No pending invoices.</p>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-black text-white p-5 border-t border-zinc-800">
      <div className="mb-6 max-w-4xl mx-auto flex items-center justify-between">
        <h2 className="text-xl font-bold text-white tracking-wide">Inbox</h2>
      </div>
      {data.map((elem) => (
        <Reqpay 
          key={elem._id} 
          name={elem.name} 
          sender={elem.displaySender} 
          amount={elem.amount} 
          isSentByMe={elem.isSentByMe}
          reqId={elem._id}
        />
      ))}
    </div>
  );
};

export default Request;
