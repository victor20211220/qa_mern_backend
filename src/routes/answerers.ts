// src/routes/answerers.ts
import express, {Request, Response} from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import {AuthRequest, verifyToken} from '../middleware/authMiddleware';
import Answerer from '../models/Answerer';
import QuestionType from '../models/QuestionType';
import Question from "../models/Question";
import Earning from "../models/Earning";
import Answer from "../models/Answer";
import mongoose from 'mongoose';
import Category from "../models/Category";

const router = express.Router();

// Multer setup for photo upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${Date.now()}-${file.fieldname}${ext}`);
    },
});

const upload = multer({storage});

// GET current answerer's profile
router.get('/me', verifyToken, async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthRequest;

    try {
        const answerer = await Answerer.findById(authReq.user.id).select('-password');
        if (!answerer) {
            res.status(404).json({error: 'Answerer not found'});
            return;
        }

        const [questionsReceived, questionsAnswered, earnings] = await Promise.all([
            Question.countDocuments({answerer_id: answerer._id}),
            Question.countDocuments({answerer_id: answerer._id, status: 1}),
            Earning.aggregate([
                {$match: {answerer_id: answerer._id}},
                {$group: {_id: null, total: {$sum: '$amount'}}},
            ]),
        ]);

        const total_earnings = earnings.length > 0 ? earnings[0].total : 0;

        res.json({
            ...answerer.toObject(),
            total_questions_received: questionsReceived,
            total_questions_answered: questionsAnswered,
            total_earnings,
            response_rate: questionsReceived > 0 ? questionsAnswered / questionsReceived : 0
        });
    } catch (err) {
        res.status(500).json({error: 'Failed to fetch profile'});
    }
});

// UPDATE answerer's profile with photo upload
router.put('/me', verifyToken, upload.single('photo'), async (req: Request, res: Response): Promise<void> => {
    try {
        const authReq = req as AuthRequest;
        const {
            name,
            instagram,
            youtube,
            tiktok,
            expertise,
            bio,
        } = req.body;
        const photo = req.file ? req.file.path : undefined;

        const updateData: any = {
            name,
            instagram,
            youtube,
            tiktok,
            bio,
            expertise: expertise ? JSON.parse(expertise) : [],
        };

        if (photo) {
            const answerer = await Answerer.findById(authReq.user.id);

            // Delete previous photo if it exists
            if (answerer?.photo && fs.existsSync(answerer.photo)) {
                fs.unlink(answerer.photo, (err) => {
                    if (err) console.error('Failed to delete old photo:', err);
                });
            }

            updateData.photo = photo;
        }

        const updated = await Answerer.findByIdAndUpdate(
            authReq.user.id,
            updateData,
            {new: true, runValidators: true}
        ).select('-password');

        // @ts-ignore
        const plain = updated.toObject();
        res.json({...plain});
    } catch (err) {
        res.status(500).json({error: 'Failed to update profile'});
    }
});


// GET all answerers (browsing with pagination + category name)
router.get('/', async (req: Request, res: Response): Promise<void> => {
    try {
        const {name, category_id, page = 1, limit = 10} = req.query;
        const query: any = {};
        const pageNumber = parseInt(page as string);
        const limitNumber = parseInt(limit as string);
        const skip = (pageNumber - 1) * limitNumber;

        if (name) query.name = {$regex: name, $options: 'i'};
        if (category_id) query.category_id = new mongoose.Types.ObjectId(category_id as string);

        const totalCount = await Answerer.countDocuments(query);

        const answerers = await Answerer.aggregate([
            {$match: query},
            {
                $lookup: {
                    from: 'categories',
                    localField: 'category_id',
                    foreignField: '_id',
                    as: 'category',
                },
            },
            {$unwind: {path: '$category', preserveNullAndEmptyArrays: true}},
            {
                $project: {
                    password: 0,
                    'category.__v': 0,
                },
            },
            {$skip: skip},
            {$limit: limitNumber},
        ]);

        // Enrich each answerer with response data
        const enriched = await Promise.all(
            answerers.map(async (a) => {
                const answers = await Answer.aggregate([
                    {
                        $lookup: {
                            from: 'questions',
                            localField: 'question_id',
                            foreignField: '_id',
                            as: 'question',
                        },
                    },
                    {$unwind: '$question'},
                    {
                        $match: {
                            'question.answerer_id': a._id,
                        },
                    },
                    {
                        $project: {
                            response_time_hrs: {
                                $divide: [
                                    {$subtract: ['$created_at', '$question.created_at']},
                                    1000 * 60 * 60,
                                ],
                            },
                        },
                    },
                ]);

                const number_of_questions_answered = answers.length;
                const average_response_time =
                    answers.length > 0
                        ? parseFloat(
                            (
                                answers.reduce((sum, r) => sum + r.response_time_hrs, 0) /
                                answers.length
                            ).toFixed(2)
                        )
                        : 0;

                return {
                    ...a,
                    category_name: a.category?.category || null,
                    number_of_questions_answered,
                    average_response_time,
                };
            })
        );

        res.json({
            total: totalCount,
            answerers: enriched,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({error: 'Failed to fetch answerers'});
    }
});

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
    try {
        const answerer = await Answerer.findById(req.params.id).select('-password');
        if (!answerer) {
            res.status(404).json({error: 'Answerer not found'});
            return;
        }

        // ✅ Get category name
        const category = await Category.findById(answerer.category_id);
        const category_name = category?.category || null;

        // ✅ Enabled question types
        const questionTypes = await QuestionType.find({
            answerer_id: req.params.id,
            enabled: true,
        }).sort({type: 1});

        // ✅ Recent reviews with questioner info
        const reviews = await Answer.aggregate([
            {
                $match: {
                    rate: {$ne: null},
                    review: {$ne: null},
                },
            },
            {
                $lookup: {
                    from: 'questions',
                    localField: 'question_id',
                    foreignField: '_id',
                    as: 'question',
                },
            },
            {$unwind: '$question'},
            {
                $match: {
                    'question.answerer_id': new mongoose.Types.ObjectId(req.params.id),
                },
            },
            {
                $lookup: {
                    from: 'questioners',
                    localField: 'question.questioner_id',
                    foreignField: '_id',
                    as: 'questioner',
                },
            },
            {$unwind: '$questioner'},
            {
                $project: {
                    rate: 1,
                    review: 1,
                    created_at: 1,
                    questioner: {
                        _id: 1,
                        name: 1,
                        photo: 1,
                    },
                },
            },
            {$sort: {created_at: -1}},
            {$limit: 2},
        ]);

        // Calculate number of questions answered and average response time
        const answered = await Answer.aggregate([
            {
                $lookup: {
                    from: 'questions',
                    localField: 'question_id',
                    foreignField: '_id',
                    as: 'question',
                },
            },
            {$unwind: '$question'},
            {
                $match: {
                    'question.answerer_id': new mongoose.Types.ObjectId(req.params.id),
                },
            },
            {
                $project: {
                    response_time_hrs: {
                        $divide: [
                            {$subtract: ['$created_at', '$question.created_at']},
                            1000 * 60 * 60, // convert ms to hours
                        ],
                    },
                },
            },
        ]);

        const number_of_questions_answered = answered.length;
        const average_response_time =
            answered.length > 0
                ? answered.reduce((sum, r) => sum + r.response_time_hrs, 0) / answered.length
                : 0;


        res.json({
            ...answerer.toObject(),
            category_name,
            number_of_questions_answered,
            average_response_time: parseFloat(average_response_time.toFixed(2)),
            questionTypes,
            recent_reviews: reviews,
        });
    } catch (err) {
        res.status(500).json({error: 'Failed to fetch answerer profile'});
    }
});


// src/routes/answerers.ts (add this at the bottom)
router.get('/me/question_stats', verifyToken, async (req: AuthRequest, res: Response) => {
    try {
        const answererId = req.user.id;
        const now = new Date();
        const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

        // Pending questions
        const pendingCount = await Question.countDocuments({
            answerer_id: answererId,
            status: 0,
            paid: true,
        });

        // Answers today
        const answersToday = await Answer.countDocuments({
            created_at: {$gte: todayStart},
            question_id: {$in: await Question.find({answerer_id: answererId}).distinct('_id')},
        });

        // Total earnings today
        const earningsTodayAgg = await Earning.aggregate([
            {
                $match: {
                    answerer_id: new mongoose.Types.ObjectId(answererId),
                    created_at: {$gte: todayStart},
                },
            },
            {
                $group: {
                    _id: null,
                    total: {$sum: '$amount'},
                },
            },
        ]);

        const earningsToday = earningsTodayAgg[0]?.total || 0;


        // Recalculate response rate for the answerer
        const total = await Question.countDocuments({answerer_id: answererId});
        const answered = await Question.countDocuments({answerer_id: answererId, status: 1});
        const responseRate = total > 0 ? answered / total : 0;

        res.json({
            pending_count: pendingCount,
            answers_today: answersToday,
            earnings_today: earningsToday,
            response_rate: responseRate,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({error: 'Failed to fetch stats'});
    }
});


export default router;
