// routes/categories.ts
import express, {Request, Response} from 'express';
import Category from '../models/Category';

const router = express.Router();

// GET /api/categories - Get all categories
router.get('/', async (req: Request, res: Response) => {
    try {
        const categories = await Category.find();
        res.json(categories);
    } catch (err) {
        res.status(500).json({error: 'Failed to fetch categories'});
    }
});

export default router;