// src/routes/questions.ts
import express, {Request, Response, NextFunction} from 'express';
import multer from 'multer';
import path from 'path';
import mongoose from 'mongoose';
import {verifyToken, AuthRequest} from '../middleware/authMiddleware';
import Question, {IQuestion} from '../models/Question';
import QuestionType from '../models/QuestionType';
import Stripe from 'stripe';
import bodyParser from 'body-parser';
import Answer from "../models/Answer";
import {isLocal, sendQuestionNotificationToAnswerer} from "../utils/helpers";

const router = express.Router();

// Multer for picture uploads
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

// POST /questions - Ask a question
router.post('/', verifyToken, upload.array('pictures'), async (req: Request, res: Response): Promise<void> => {
    try {
        const authReq = req as AuthRequest;
        const {
            question_type_id,
            question,
            choices,
            answerer_id
        } = req.body;

        if (!mongoose.Types.ObjectId.isValid(question_type_id)) {
            res.status(400).json({error: 'Invalid question_type_id format'});
            return;
        }

        const questionType = await QuestionType.findById(question_type_id);
        if (!questionType || !questionType.enabled) {
            res.status(400).json({error: 'Invalid or disabled question type'});
            return;
        }

        const pictures = req.files ? (req.files as Express.Multer.File[]).map(file => file.path) : [];
        const newQuestion = new Question({
            question_type_id,
            question,
            choices: choices ? JSON.parse(choices) : [],
            pictures,
            questioner_id: authReq.user.id,
            answerer_id,
            created_at: new Date(),
            paid: isLocal
        });

        await newQuestion.save();
        const newQuestionId = String(newQuestion._id);

        if(isLocal){ //test
            await sendQuestionNotificationToAnswerer(newQuestion);
        }

        //Create Stripe session
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
        let clientRedirectUrl = `${process.env.CLIENT_ORIGIN}/questioner/ask-question?answerer_id=${answerer_id}&question_type_id=${question_type_id}`;
        clientRedirectUrl = `${process.env.CLIENT_ORIGIN}/questioner/my-questions`;

        const session = await stripe.checkout.sessions.create({
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {name: 'Ask a Question'},
                        unit_amount: req.body.price * 100, // Stripe uses cents
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            success_url: `${clientRedirectUrl}?payment=success`,
            cancel_url: `${clientRedirectUrl}?payment=cancel`,
            metadata: {
                question_id: newQuestionId
            },
            payment_intent_data: {
                metadata: {
                    question_id: newQuestionId
                }
            }
        });
        res.json({url: session.url});
    } catch (err) {
        console.error('❌ Question creation failed:', err);
        res.status(500).json({error: 'Failed to create question'});
    }
});

// GET /questions/asked - Paginated, filtered questioner's own questions
router.get('/asked', verifyToken, async (req: Request, res: Response): Promise<void> => {
    try {
        const authReq = req as AuthRequest;
        const {page = 1, limit = 10, status} = req.query;

        const pageNumber = parseInt(page as string, 10);
        const limitNumber = parseInt(limit as string, 10);
        const skip = (pageNumber - 1) * limitNumber;

        const filter: any = {
            questioner_id: authReq.user.id,
            paid: true
        };
        if (status) {
            filter.status = parseInt(status as string);
        }

        const totalCount = await Question.countDocuments(filter);

        const questions = await Question.find(filter)
            .sort({created_at: -1})
            .skip(skip)
            .limit(limitNumber)
            .populate({
                path: 'answerer_id',
                select: 'name photo category_id',
                populate: {
                    path: 'category_id',
                    select: 'category',
                }
            });

        const results = await Promise.all(
            questions.map(async (q) => {
                const answer = await Answer.findOne({question_id: q._id});
                const obj = q.toObject() as any;

                // Flatten category name
                if (obj.answerer_id?.category_id?.category) {
                    obj.answerer_id.category_name = obj.answerer_id.category_id.category;
                    delete obj.answerer_id.category_id;
                }

                return {
                    ...obj,
                    answer: answer?.toObject() || null,
                };
            })
        );

        res.json({
            total: totalCount,
            questions: results,
        });
    } catch (err) {
        console.error('❌ Failed to fetch asked questions:', err);
        res.status(500).json({error: 'Failed to fetch asked questions'});
    }
});


// GET /questions/received - Answerer's received questions
router.get('/received', verifyToken, async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthRequest;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 3;
        const skip = (page - 1) * limit;

        const matchStage: any = {
            answerer_id: new mongoose.Types.ObjectId(authReq.user.id),
            paid: true
        };

        // Optional filter by status (0 = pending, 1 = answered, 2 = expired)
        if (req.query.status !== undefined) {
            matchStage.status = parseInt(req.query.status as string);
        }

        const questions = await Question.aggregate([
            {$match: matchStage},
            {$sort: {created_at: -1}},
            {
                $lookup: {
                    from: 'answers',
                    localField: '_id',
                    foreignField: 'question_id',
                    as: 'answer',
                },
            },
            {
                $lookup: {
                    from: 'questioners',
                    localField: 'questioner_id',
                    foreignField: '_id',
                    as: 'questioner',
                },
            },
            {$unwind: {path: '$questioner', preserveNullAndEmptyArrays: true}},
            {$unwind: {path: '$answer', preserveNullAndEmptyArrays: true}},
            {$skip: skip},
            {$limit: limit},
        ]);

        const total = await Question.countDocuments(matchStage);

        res.json({questions, total});
    } catch (err) {
        res.status(500).json({error: 'Failed to fetch received questions', details: err});
    }
});


// GET /questions/:id - Full populated question details
router.get('/:id', verifyToken, async (req: Request, res: Response): Promise<void> => {
    try {
        const question = await Question.findById(req.params.id)
            .populate({
                path: 'questioner_id',
                select: 'name photo',
            })
            .populate({
                path: 'question_type_id',
                select: 'type',
            })
            .populate({
                path: 'answerer_id',
                select: 'name photo category_id',
                populate: {
                    path: 'category_id',
                    select: 'category',
                },
            });

        if (!question) {
            res.status(404).json({error: 'Question not found'});
            return;
        }

        // Find the associated answer
        const answer = await Answer.findOne({question_id: question._id});
        const q = question.toObject() as any;

        // Flatten category name from answerer
        const categoryName = q.answerer_id?.category_id?.category || null;
        if (q.answerer_id?.category_id) {
            q.answerer_id.category_name = categoryName;
            delete q.answerer_id.category_id;
        }

        res.json({
            ...q,
            answer: answer?.toObject() || null,
        });
    } catch (err) {
        console.error('❌ Error fetching question:', err);
        res.status(500).json({error: 'Failed to fetch question'});
    }
});

export default router;