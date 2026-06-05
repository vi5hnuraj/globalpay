import React, { useEffect, useState } from 'react';
import BankCard from '../components/Bank/BankCard';
import UserInfo from '../components/Bank/UserInfo';
import TransactionForm from '../components/Bank/TransactionForm';
import TransactionHistory from '../components/Bank/TransactionHistory';
import BarGraph from '../components/Bank/BarGraph';
import BridgePanel from '../components/Bank/BridgePanel';
import api from '../utils/api';
import ScannerComponent from '../components/Bank/ScannerComponent';

function MainTransaction() {
  const [userData, setUserData] = useState(null);
  const [transactions, setTransactions] = useState([]);

  const fetchUserData = async () => {
    try {
      const response = await api.get(`/bank/user-details`);
      setUserData(response.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchTransactions = async () => {
    try {
      const response = await api.get(`/money-transfer`);
      setTransactions(response.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchUserData();
    fetchTransactions();
  }, []);

  const refreshData = () => {
    fetchUserData();
    fetchTransactions();
  };

  return (
    <>
      <div className="bg-black text-zinc-200 min-h-screen p-6">

        <div className="mx-auto">
          <div className="flex gap-6 items-center mb-6">
            {userData && (
              <>
                <BankCard userData={userData} />
                <UserInfo userData={userData} transactions={transactions} />
                <ScannerComponent userData={userData} />
              </>
            )}
          </div>
          {userData && userData.bankDetails && (
            <BridgePanel />
          )}
          <div className="flex space-x-6 items-stretch">
            <TransactionForm onTransactionSuccess={refreshData} userData={userData} />
            <TransactionHistory transactions={transactions} userData={userData} />
          </div>
          <div className="flex space-x-6 mt-6">
            <BarGraph title="Amount Sent" transactions={transactions} type="sent" userData={userData} />
            <BarGraph title="Amount Received" transactions={transactions} type="received" userData={userData} />
          </div>
        </div>
      </div>
    </>
  );
}

export default MainTransaction;