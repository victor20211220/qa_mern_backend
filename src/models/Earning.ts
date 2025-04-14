import mongoose, { Schema, Document } from 'mongoose';

export interface IEarning extends Document {
  answerer_id: mongoose.Types.ObjectId;
  amount: number;
  created_at: Date;
}

const earningSchema = new Schema<IEarning>({
  answerer_id: { type: Schema.Types.ObjectId, ref: 'Answerer', required: true },
  amount: { type: Number, required: true },
  created_at: { type: Date, default: Date.now },
});

export default mongoose.model<IEarning>('Earning', earningSchema);
