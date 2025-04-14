// src/routes/educations.ts
import express, {Request, Response} from 'express';
import {verifyToken, AuthRequest} from '../middleware/authMiddleware';
import Education from '../models/Education';

const router = express.Router();

// GET /educations/me - Get all educations for current answerer
router.get('/me', verifyToken, async (req: Request, res: Response): Promise<void> => {
    try {
        const authReq = req as AuthRequest;
        const list = await Education.find({answerer_id: authReq.user.id});
        res.json(list);
    } catch (err) {
        res.status(500).json({error: 'Failed to fetch educations'});
    }
});

// POST /educations - Add a new education
router.post('/', verifyToken, async (req: Request, res: Response): Promise<void> => {
    try {
        const authReq = req as AuthRequest;
        const {title, university, from_year, to_year} = req.body;
        const education = new Education({
            answerer_id: authReq.user.id,
            title,
            university,
            from_year,
            to_year,
        });
        await education.save();
        res.status(201).json(education);
    } catch (err) {
        res.status(500).json({error: 'Failed to create education'});
    }
});

// PUT /educations/:id - Update an education
router.put('/:id', verifyToken, async (req: Request, res: Response): Promise<void> => {
    try {
        const authReq = req as AuthRequest;
        const updated = await Education.findOneAndUpdate(
            {_id: req.params.id, answerer_id: authReq.user.id},
            req.body,
            {new: true}
        );
        res.json(updated);
    } catch (err) {
        res.status(500).json({error: 'Failed to update education'});
    }
});

// DELETE /educations/:id - Delete an education
router.delete('/:id', verifyToken, async (req: Request, res: Response): Promise<void> => {
    try {
        const authReq = req as AuthRequest;
        await Education.findOneAndDelete({_id: req.params.id, answerer_id: authReq.user.id});
        res.status(204).send();
    } catch (err) {
        res.status(500).json({error: 'Failed to delete education'});
    }
});

export default router;
