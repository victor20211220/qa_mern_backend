import mongoose, { Schema, Document } from 'mongoose';

export interface IQuestionType extends Document {
  type: number; // 0: text, 1: multiple-choice, 2: picture
  price: number;
  number_of_choice_options?: number;
  number_of_picture_options?: number;
  response_time: number;
  enabled: boolean;
  answerer_id: mongoose.Types.ObjectId;
}

const questionTypeSchema = new Schema<IQuestionType>({
  type: { type: Number, required: true }, // 0: text, 1: multiple-choice, 2: picture
  price: { type: Number, required: true },
  number_of_choice_options: { type: Number, default: 2 },
  number_of_picture_options: { type: Number, default: 2 },
  response_time: { type: Number, default: 24 },
  enabled: { type: Boolean, default: false },
  answerer_id: { type: Schema.Types.ObjectId, ref: 'Answerer', required: true },
});

export default mongoose.model<IQuestionType>('QuestionType', questionTypeSchema);
