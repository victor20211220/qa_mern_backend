// src/routes/questioners.ts
import express, {Request, Response, NextFunction} from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import {verifyToken, AuthRequest} from '../middleware/authMiddleware';
import Questioner from '../models/Questioner';
import Category from "../models/Category";
import Answerer from "../models/Answerer";
import Question from "../models/Question";
import Answer from "../models/Answer";
import fs from "fs";

dotenv.config();
const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

// Multer setup
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

// Get current questioner's profile
router.get('/me', verifyToken, async (req: Request, res: Response): Promise<void> => {
    try {
        const authReq = req as AuthRequest;
        const questioner = await Questioner.findById(authReq.user.id).select('-password');
        if (!questioner) {
            res.status(404).json({error: 'Questioner not found'});
            return;
        }
        res.json(questioner);
    } catch (err) {
        res.status(500).json({error: 'Failed to fetch profile'});
    }
});


// Update Questioner Profile
router.put('/me', verifyToken, upload.single('photo'), async (req: Request, res: Response): Promise<void> => {
    try {
        const authReq = req as AuthRequest;
        const {name} = req.body;
        const photo = req.file ? req.file.path : undefined;

        const updateData: any = {name};

        if (photo) {
            const questioner = await Questioner.findById(authReq.user.id);

            // Delete previous photo if it exists
            if (questioner?.photo && fs.existsSync(questioner.photo)) {
                fs.unlink(questioner.photo, (err) => {
                    if (err) console.error('Failed to delete old photo:', err);
                });
            }

            updateData.photo = photo;
        }

        const updated = await Questioner.findByIdAndUpdate(
            authReq.user.id,
            updateData,
            {new: true, runValidators: true}
        ).select('-password');

        res.json(updated);
    } catch (err) {
        res.status(500).json({error: 'Failed to update profile'});
    }
});

// GET /questioners/homepage_data (requires questioner login)
router.get('/homepage_data', verifyToken, async (req: any, res): Promise<void> => {
    try {
        // Optional: check if logged in user is a questioner
        if (req.user.type !== 'questioner') {
            res.status(403).json({error: 'Only questioners can access this endpoint'});
            return;
        }

        // Popular Categories
        const popular_categories = await Category.aggregate([
            {
                $lookup: {
                    from: 'answerers',
                    localField: '_id',
                    foreignField: 'category_id',
                    as: 'answerers',
                },
            },
            {
                $addFields: {
                    count: {$size: '$answerers'},
                },
            },
            {$sort: {count: -1}},
            {$limit: 6},
            {
                $project: {
                    _id: 1,
                    category: 1,
                    count: 1,
                },
            },
        ]);

        // Featured Answerers
        const featured_answerers = await Answerer.aggregate([
            {
                $sort: {
                    number_of_reviews: -1,
                    rating: -1
                }
            },
            {$limit: 3},
            {
                $lookup: {
                    from: 'categories',
                    localField: 'category_id',
                    foreignField: '_id',
                    as: 'category'
                }
            },
            {
                $unwind: {
                    path: '$category',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $project: {
                    password: 0,
                    'category.__v': 0
                }
            }
        ]);

// Optional: Format response to add category_name directly
        const featured_answerers_formatted = featured_answerers.map(a => ({
            ...a,
            category_name: a.category?.category || null
        }));


        // Recent Questions
        const recent_questions = await Question.aggregate([
            {$sort: {created_at: -1}},
            {$limit: 2},
            {
                $lookup: {
                    from: 'questioners',
                    localField: 'questioner_id',
                    foreignField: '_id',
                    as: 'questioner',
                },
            },
            {$unwind: {path: '$questioner', preserveNullAndEmptyArrays: true}},
            {
                $lookup: {
                    from: 'answers',
                    localField: '_id',
                    foreignField: 'question_id',
                    as: 'answer_count',
                },
            },
            {
                $addFields: {
                    answer_count: {$size: '$answer_count'},
                },
            },
            {
                $project: {
                    _id: 1,
                    question: 1,
                    created_at: 1,
                    questioner: {
                        _id: 1,
                        name: 1,
                        photo: 1,
                    },
                    answer_count: 1,
                },
            },
        ]);

        res.json({popular_categories, featured_answerers: featured_answerers_formatted, recent_questions});
    } catch (err) {
        res.status(500).json({error: 'Failed to load homepage data', details: err});
    }
});

// GET /questioners/me/stats - Stats for questioner
router.get('/me/stats', verifyToken, async (req: Request, res: Response): Promise<void> => {
    try {
        const authReq = req as AuthRequest;
        const questionerId = authReq.user.id;

        // First get all question IDs for the questioner
        const questionIds = await Question.find({questioner_id: questionerId}).distinct('_id');

        const [totalQuestions, totalAnswers, answersToday, totalReviews] = await Promise.all([
            Question.countDocuments({questioner_id: questionerId}),

            Answer.countDocuments({question_id: {$in: questionIds}}),

            Answer.countDocuments({
                question_id: {$in: questionIds},
                created_at: {
                    $gte: new Date(new Date().setHours(0, 0, 0, 0)) // Today at 00:00
                }
            }),

            Answer.countDocuments({
                question_id: {$in: questionIds},
                review: {$exists: true, $ne: ''}
            })
        ]);

        res.json({
            total_questions: totalQuestions,
            total_answers: totalAnswers,
            answers_today: answersToday,
            total_reviews: totalReviews
        });

    } catch (err) {
        console.error('❌ Failed to fetch questioner stats:', err);
        res.status(500).json({error: 'Failed to fetch stats'});
    }
});


export default router;
