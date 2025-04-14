import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Category from '../models/Category';

dotenv.config();

const categories = [
    {category: 'Math'},
    {category: 'Programming'},
    {category: 'Fitness'},
    {category: 'Music'},
    {category: 'Photography'},
    {category: 'Sports'},
    {category: 'Financial'},
    {category: 'Design'},
];

const MONGO_URI = process.env.MONGO_URI || '';
console.log(MONGO_URI);

mongoose
    .connect(MONGO_URI)
    .then(async () => {
        await Category.deleteMany(); // optional: clear old data
        await Category.insertMany(categories);
        console.log('Categories seeded!');
        process.exit();
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
