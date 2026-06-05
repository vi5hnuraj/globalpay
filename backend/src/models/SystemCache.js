import mongoose from 'mongoose';

const systemCacheSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  data: { type: mongoose.Schema.Types.Mixed },
  updatedAt: { type: Date, default: Date.now }
});

export default mongoose.model('SystemCache', systemCacheSchema);
