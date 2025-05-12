import express, {Application} from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import router from './routes'; // routes/index.ts
import cors from 'cors';
import './cron/jobs';
import stripeWebhooks from "./routes/stripeWebhooks";

dotenv.config();


const app: Application = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || '';
app.set('trust proxy', 1);
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${req.method}] ${req.originalUrl}`);
    next();
});
app.use('/webhooks', stripeWebhooks);

app.use(express.json());
app.use(cors({
    origin: process.env.CLIENT_ORIGIN,
    credentials: true,
}));
app.use('/api', router); // ex: /api/auth/answerer/register
app.use('/public', express.static('public'));
app.use('/uploads', express.static('uploads'));

// Optional health check
app.get('/', (_, res) => {
    res.send('Server is running...');
});


// Connect MongoDB and start server
mongoose
    .connect(MONGO_URI)
    .then(() => {
        console.log('✅ MongoDB connected');
        app.listen(PORT, () => {
            console.log(`🚀 Server listening on http://localhost:${PORT}`);
        });
    })
    .catch((err: Error) => {
        console.error('❌ MongoDB connection error:', err.message);
    });
