import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Earning from '../models/Earning';  // Make sure the Earning model is correctly imported

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || '';
console.log(MONGO_URI);

mongoose
    .connect(MONGO_URI)
    .then(async () => {
        // Update the `amount` field for all documents in the `earnings` collection
        const result = await Earning.updateMany(
            {},
            [
                { $set: { amount: { $multiply: ['$amount', 0.85] } } }
            ]
        );

        console.log(`${result.modifiedCount} documents updated`);
        process.exit();
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
