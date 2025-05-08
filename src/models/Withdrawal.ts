import mongoose, { Schema } from 'mongoose';

const WithdrawalSchema = new Schema({
  answerer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Answerer', required: true },
  amount: { type: Number, required: true },
  bank_name: { type: String, required: true },
  routing_number: { type: String },
  bank_address: { type: String },
  account_number: { type: String },
  account_type: { type: String },
  created_at: { type: Date, default: Date.now },
});

export default mongoose.model('Withdrawal', WithdrawalSchema);
