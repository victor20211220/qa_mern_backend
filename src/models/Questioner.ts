import mongoose, {Schema, Document} from 'mongoose';

export interface IQuestioner extends Document {
    name: string;
    email: string;
    password: string;
    photo?: string;
    email_verified: boolean;
    email_verification_token: string;
}

const questionerSchema = new Schema<IQuestioner>({
    name: {type: String, required: true},
    email: {type: String, required: true, unique: true},
    password: {type: String},
    photo: {type: String}, // optional
    email_verified: {type: Boolean, default: false},
    email_verification_token: {type: String}
});

export default mongoose.model<IQuestioner>('Questioner', questionerSchema);
