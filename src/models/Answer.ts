import mongoose, {Schema, Document} from 'mongoose';

export interface IAnswer extends Document {
    question_id: mongoose.Types.ObjectId;
    answer: string;
    rate?: number;
    review?: string;
    created_at: Date;
}

const answerSchema = new Schema<IAnswer>({
    question_id: {type: Schema.Types.ObjectId, ref: 'Question', required: true},
    answer: {type: String, required: true},
    rate: {type: Number},
    review: {type: String},
    created_at: {type: Date, default: Date.now},
});

export default mongoose.model<IAnswer>('Answer', answerSchema);
