// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { 
  ThirdwebProvider, 
  metamaskWallet, 
  coinbaseWallet, 
  walletConnect, 
  trustWallet, 
  rainbowWallet 
} from '@thirdweb-dev/react';
import { InjectedWallet } from '@thirdweb-dev/wallets';
import { BrowserRouter as Router } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Sepolia } from "@thirdweb-dev/chains"; // <-- Import chain

// ✅ Add this at the top for Buffer
import { Buffer } from 'buffer';
window.Buffer = Buffer; // Makes Buffer globally available

// Custom OKX Wallet support for Thirdweb v3
const okxWallet = () => {
  return {
    id: "okx",
    meta: {
      name: "OKX Wallet",
      iconURL: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4MCIgaGVpZ2h0PSI4MCIgdmlld0JveD0iMCAwIDgwIDgwIiBmaWxsPSJub25lIj4KICA8cmVjdCB3aWR0aD0iODAiIGhlaWdodD0iODAiIHJ4PSIxNiIgZmlsbD0iYmxhY2siIC8+CiAgPGcgZmlsbD0id2hpdGUiPgogICAgPHJlY3QgeD0iMjAiIHk9IjIwIiB3aWR0aD0iMTIiIGhlaWdodD0iMTIiIHJ4PSIyIiAvPgogICAgPHJlY3QgeD0iNDgiIHk9IjIwIiB3aWR0aD0iMTIiIGhlaWdodD0iMTIiIHJ4PSIyIiAvPgogICAgPHJlY3QgeD0iMzQiIHk9IjM0IiB3aWR0aD0iMTIiIGhlaWdodD0iMTIiIHJ4PSIyIiAvPgogICAgPHJlY3QgeD0iMjAiIHk9IjQ4IiB3aWR0aD0iMTIiIGhlaWdodD0iMTIiIHJ4PSIyIiAvPgogICAgPHJlY3QgeD0iNDgiIHk9IjQ4IiB3aWR0aD0iMTIiIGhlaWdodD0iMTIiIHJ4PSIyIiAvPgogIDwvZz4KPC9zdmc+",
      urls: {
        chrome: "https://chrome.google.com/webstore/detail/okx-wallet/mcohilncgoniichbnelnoooodjgainph",
      }
    },
    create(walletOptions) {
      return new InjectedWallet({
        ...walletOptions,
        walletId: "okx"
      });
    },
    isInstalled() {
      return !!window.okxwallet || (!!window.ethereum && !!window.ethereum.isOkxWallet);
    }
  };
};

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')).render(
  <QueryClientProvider client={queryClient}>
    <ThirdwebProvider 
      clientId={import.meta.env.VITE_THIRDWEB_CLIENT_ID} 
      activeChain={Sepolia}
      supportedWallets={[
        metamaskWallet(),
        okxWallet(),
        coinbaseWallet(),
        walletConnect(),
        trustWallet(),
        rainbowWallet()
      ]}
    >
      <Router
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <App />
      </Router>
    </ThirdwebProvider>
  </QueryClientProvider>
);
