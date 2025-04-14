import mongoose, {Schema, Document} from 'mongoose';

export interface IEducation extends Document {
    answerer_id: mongoose.Types.ObjectId;
    title: string;
    university: string;
    from_year: number;
    to_year: number;
}

const educationSchema = new Schema<IEducation>({
    answerer_id: {type: Schema.Types.ObjectId, ref: 'Answerer', required: true},
    title: {type: String, required: true},
    university: {type: String, required: true},
    from_year: {type: Number, required: true},
    to_year: {type: Number, required: true},
});

export default mongoose.model<IEducation>('Education', educationSchema);
