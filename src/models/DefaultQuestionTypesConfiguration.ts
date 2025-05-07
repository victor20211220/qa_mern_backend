import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  type: { type: Number, required: true },
  price: { type: Number, required: true },
  number_of_choice_options: { type: Number, default: 0 },
  number_of_picture_options: { type: Number, default: 0 },
  response_time: { type: Number, required: true },
});

export default mongoose.model('DefaultQuestionTypesConfiguration', schema);
