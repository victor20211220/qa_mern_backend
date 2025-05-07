import mongoose, {Schema, Document} from 'mongoose';

export interface IQuestion extends Document {
    question_type_id: mongoose.Types.ObjectId;
    question: string;
    choices?: string[];
    pictures?: string[];
    questioner_id: mongoose.Types.ObjectId;
    answerer_id: mongoose.Types.ObjectId;
    created_at: Date;
    status: number;
    paid: boolean;
    payment_intent_id: string;
}

const questionSchema = new Schema<IQuestion>({
    question_type_id: {type: Schema.Types.ObjectId, ref: 'QuestionType', required: true},
    question: {type: String, required: true},
    choices: {type: [String], default: []},
    pictures: {type: [String], default: []},
    questioner_id: {type: Schema.Types.ObjectId, ref: 'Questioner', required: true},
    answerer_id: {type: Schema.Types.ObjectId, ref: 'Answerer', required: true},
    created_at: {type: Date, default: Date.now},
    status: {type: Number, default: 3}, // 0: pending, 1: answered, 2: expired, 3: not paid
    paid: {type: Boolean, default: false},
    payment_intent_id: { type: String },
});

export default mongoose.model<IQuestion>('Question', questionSchema);
