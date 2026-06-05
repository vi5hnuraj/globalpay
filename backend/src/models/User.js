import mongoose from 'mongoose';
const { Schema, model } = mongoose;

const UserSchema = new Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String },
  preferredCurrency: { type: String, default: 'USD' },
  age: { type: Number },
  dob: { type: Date },
  address: { type: String },
  status: { type: String },
  mobile: { type: String },
  metamaskId: { type: String, default: "" },
  internalWalletAddress: { type: String, default: "" },
  walletPrivateKey: { type: String, default: "" },
  externalWallet: { type: String, default: "" },
  upiId: { type: String, default: "" },
  kyc: { type: Boolean, default: false },
  global_verified: { type: Boolean, default: false },
  kycProvider: { type: String, default: "" },
  globalPayTag: { type: String, default: "" },
  region: { type: String, default: "" },
  bankDetails: {
    accountNumber: { type: String, default: "" },
    ifsc: { type: String, default: "" },
    bankName: { type: String, default: "" },
  },
}, {
  timestamps: true
});

const User = model('User', UserSchema);

export default User;
