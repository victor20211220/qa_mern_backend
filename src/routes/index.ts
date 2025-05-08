// routes/index.ts
import express from 'express';
import authRoutes from './auth';
import answererRoutes from './answerers';
import questionerRoutes from './questioners';
import questionTypeRoutes from './questionTypes';
import questionRoutes from './questions';
import answerRoutes from './answers';
import cronRoutes from './cron';
import educationRoutes from './educations';
import categoryRoutes from './categories';
import withdrawalsRouter from './withdrawals';

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/answerers', answererRoutes);
router.use('/questioners', questionerRoutes);
router.use('/question-types', questionTypeRoutes);
router.use('/questions', questionRoutes);
router.use('/answers', answerRoutes);
router.use('/cron', cronRoutes);
router.use('/educations', educationRoutes);
router.use('/categories', categoryRoutes);
router.use('/withdrawals', withdrawalsRouter);

export default router;