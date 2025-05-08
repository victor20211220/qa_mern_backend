// routes/withdrawals.ts
import express, {Request, Response} from 'express';
import Withdrawal from '../models/Withdrawal';
import {AuthRequest, verifyToken} from '../middleware/authMiddleware';
import multer from 'multer';

const router = express.Router();
const upload = multer(); // no file saving, just parse fields

//Create a withdrawal (answerer auth required)
router.post('/', verifyToken, upload.none(), async (req: Request, res: Response): Promise<void> => {
    try {
        const authReq = req as AuthRequest;
        if (authReq.user.type !== 'answerer') {
            res.status(403).json({error: 'Unauthorized'});
            return;
        }

        const {
            amount, bank_name, routing_number, bank_address, account_number, account_type
        } = req.body;
        console.log(amount);

        const withdrawal = new Withdrawal({
            answerer_id: authReq.user.id,
            amount,
            bank_name,
            routing_number,
            bank_address,
            account_number,
            account_type,
        });

        await withdrawal.save();
        res.status(201).json({message: 'Withdrawal request submitted', withdrawal});
    } catch (err) {
        console.log(err);
        res.status(500).json({error: 'Failed to request withdrawal'});
    }
});

// GET /withdrawals - Public list with pagination, answerer + earnings
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 3;
        const skip = (page - 1) * limit;

        const total = await Withdrawal.countDocuments();

        const withdrawals = await Withdrawal.aggregate([
            {
                $lookup: {
                    from: 'answerers',
                    localField: 'answerer_id',
                    foreignField: '_id',
                    as: 'answerer',
                },
            },
            {$unwind: '$answerer'},
            {
                $lookup: {
                    from: 'earnings',
                    localField: 'answerer_id',
                    foreignField: 'answerer_id',
                    as: 'earnings',
                },
            },
            {
                $addFields: {
                    total_earnings: {$sum: '$earnings.amount'},
                },
            },
            {
                $project: {
                    earnings: 0,
                    'answerer.password': 0,
                },
            },
            {$sort: {created_at: -1}},
            {$skip: skip},
            {$limit: limit},
        ]);

        res.json({withdrawals, total});
    } catch (err) {
        console.error('❌ Failed to fetch withdrawals:', err);
        res.status(500).json({error: 'Failed to fetch withdrawals'});
    }
});

export default router;
