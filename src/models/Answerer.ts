import mongoose, {Schema, Document} from 'mongoose';

export interface IAnswerer extends Document {
    name: string;
    email: string;
    password: string;
    category_id: mongoose.Types.ObjectId;
    photo?: string;
    number_of_reviews: number;
    rating: number;
    instagram?: string;
    youtube?: string;
    tiktok?: string;
    expertise?: string[];
    bio?: string;
    expert_topics?: string;
    email_verified: boolean;
    email_verification_token: string;
}

const answererSchema = new Schema<IAnswerer>({
    name: {type: String, required: true},
    email: {type: String, required: true, unique: true},
    password: {type: String},
    category_id: {type: Schema.Types.ObjectId, ref: 'Category'},
    photo: {type: String},
    number_of_reviews: {type: Number, default: 0},
    rating: {type: Number, default: 0.0},
    instagram: {type: String},
    youtube: {type: String},
    tiktok: {type: String},
    expertise: {type: [String], default: []},
    bio: {type: String},
    expert_topics: {type: String},
    email_verified: {type: Boolean, default: false},
    email_verification_token: {type: String}
});

export default mongoose.model<IAnswerer>('Answerer', answererSchema);
