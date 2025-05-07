import mongoose from 'mongoose';
import dotenv from 'dotenv';
import DefaultConfig from '../models/DefaultQuestionTypesConfiguration';

dotenv.config();

const data = [
    {type: 0, price: 10, number_of_choice_options: 0, number_of_picture_options: 0, response_time: 4},
    {type: 1, price: 10, number_of_choice_options: 4, number_of_picture_options: 0, response_time: 4},
    {type: 2, price: 10, number_of_choice_options: 0, number_of_picture_options: 4, response_time: 4},
];

mongoose.connect(process.env.MONGO_URI!).then(async () => {
    await DefaultConfig.deleteMany();
    await DefaultConfig.insertMany(data);
    console.log('✅ Default Question Types seeded.');
    process.exit();
}).catch(err => {
    console.error(err);
    process.exit(1);
});
