// src/routes/questionTypes.ts
import express, {Request, Response, NextFunction} from 'express';
import {verifyToken, AuthRequest} from '../middleware/authMiddleware';
import QuestionType from '../models/QuestionType';

const router = express.Router();

// Get all question type settings for the current answerer
router.get('/', verifyToken, async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthRequest;
        const types = await QuestionType.find({answerer_id: authReq.user.id});
        res.json(types);
    } catch (err) {
        res.status(500).json({error: 'Failed to fetch question types'});
    }
});

// Create a new question type
router.post('/', verifyToken, async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthRequest;
        const {
            type,
            price,
            response_time,
            number_of_choice_options,
            number_of_picture_options,
            enabled,
        } = req.body;

        const newType = new QuestionType({
            answerer_id: authReq.user.id,
            type,
            price,
            response_time,
            number_of_choice_options,
            number_of_picture_options,
            enabled: enabled ?? true,
        });

        await newType.save();
        res.status(201).json(newType);
    } catch (err) {
        res.status(500).json({error: 'Failed to create question type'});
    }
});

router.put('/:id', verifyToken, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const authReq = req as AuthRequest;
        const update = req.body;

        const type = await QuestionType.findOneAndUpdate(
            {_id: req.params.id, answerer_id: authReq.user.id},
            update,
            {new: true}
        );

        if (!type) {
            res.status(404).json({error: 'Question type not found'});
            return;
        }

        res.json(type);
    } catch (err) {
        res.status(500).json({error: 'Failed to update question type'});
    }
});

export default router;
