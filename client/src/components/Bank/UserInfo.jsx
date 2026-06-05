import React from 'react';

const UserInfo = ({ userData, transactions }) => {
  if (!userData || !userData.bankDetails) return <div>Loading...</div>;

  const { name, bankDetails } = userData;
  const { balance, upiId, createdAt, updatedAt } = bankDetails;

  let totalSavedAmount = 0;
  if (transactions) {
    transactions.forEach(transaction => {
      if (transaction.savedAmount) {
        totalSavedAmount += transaction.savedAmount;
      }
    });
  }
  console.log(totalSavedAmount)

  return (
    <div className="bg-zinc-800 font-mono p-6 rounded-lg border-2 border-zinc-700 shadow-md flex flex-col justify-center h-80 w-[400px]">
      <h2 className="text-xl font-bold text-amber-600 mb-6">👋🏻 Hello, {name || 'User'}!</h2>
      <div className="space-y-4">
        <p className="text-sm text-zinc-400 mb-6 leading-relaxed">
          Your global account is active and verified. Send and receive money instantly across borders seamlessly through USD.
        </p>
        <div>
          <p className="text-xs text-zinc-500 uppercase font-bold tracking-wider mb-1">Your Pay Tag</p>
          <p className="text-sm font-medium text-white bg-zinc-900 p-2 rounded border border-zinc-700">{userData.globalPayTag || upiId}</p>
        </div>
        <div className="flex justify-between mt-4">
          <div>
            <p className="text-[10px] text-zinc-500 uppercase font-bold">Created</p>
            <p className="text-xs text-zinc-300">{new Date(createdAt).toLocaleDateString()}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-zinc-500 uppercase font-bold">Last Updated</p>
            <p className="text-xs text-zinc-300">{new Date(updatedAt).toLocaleDateString()}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default UserInfo;