// src/routes/answers.ts
import express, {Request, Response} from 'express';
import {verifyToken, AuthRequest} from '../middleware/authMiddleware';
import Answer from '../models/Answer';
import Question from '../models/Question';
import QuestionType from '../models/QuestionType';
import Answerer from '../models/Answerer';
import Earning from '../models/Earning';
import {sendAnswerNotificationToQuestioner, sendReviewNotificationToAnswerer} from "../utils/helpers";

const router = express.Router();

// POST /answers/:questionId - Answer a question
router.post('/:questionId', verifyToken, async (req: Request, res: Response): Promise<void> => {
    try {
        const authReq = req as AuthRequest;
        const {answer} = req.body;
        const {questionId} = req.params;

        const question = await Question.findById(questionId);
        if (!question) {
            res.status(404).json({error: 'Question not found'});
            return;
        }
        if (question.answerer_id.toString() !== authReq.user.id) {
            res.status(403).json({error: 'Not authorized to answer this question'});
            return;
        }

        const questionType = await QuestionType.findById(question.question_type_id);
        if (!questionType) {
            res.status(400).json({error: 'Question type not found'});
            return;
        }

        const deadline = new Date(question.created_at);
        deadline.setHours(deadline.getHours() + questionType.response_time);
        const now = new Date();

        if (now > deadline) {
            await Question.findByIdAndUpdate(questionId, {status: 2});
            res.status(400).json({error: 'This question is already expired'});
            return;
        }

        const newAnswer = new Answer({
            question_id: questionId,
            answer,
            created_at: now,
        });
        await newAnswer.save();

        // Update question status to answered
        await Question.findByIdAndUpdate(questionId, {status: 1});

        // Add earning
        await Earning.create({
            answerer_id: question.answerer_id,
            amount: questionType.price,
            created_at: now,
        });

        // Recalculate response rate for the answerer
        /*const total = await Question.countDocuments({answerer_id: question.answerer_id});
        const answered = await Question.countDocuments({answerer_id: question.answerer_id, status: 1});
        const rate = total > 0 ? answered / total : 0;
        await Answerer.findByIdAndUpdate(question.answerer_id, {response_rate: rate});*/
        await sendAnswerNotificationToQuestioner(newAnswer);

        res.status(201).json(newAnswer);
    } catch (err) {
        res.status(500).json({error: 'Failed to submit answer'});
    }
});

// POST /answers/:answerId/review - Rate and review an answer
router.post('/:answerId/review', verifyToken, async (req: Request, res: Response): Promise<void> => {
    try {
        const authReq = req as AuthRequest;
        const {rate, review} = req.body;
        const {answerId} = req.params;

        const answer = await Answer.findById(answerId);
        if (!answer) {
            console.log('❌ Answer not found');
            res.status(404).json({error: 'Answer not found'});
            return;
        }

        const question = await Question.findById(answer.question_id);
        if (!question || question.questioner_id.toString() !== authReq.user.id) {
            console.log('🚫 Not authorized - not your question');
            res.status(403).json({error: 'Not authorized to review this answer'});
            return;
        }

        answer.rate = rate;
        answer.review = review;
        await answer.save();

        // update answerer's rating and number of reviews
        const answererId = question.answerer_id;
        const allAnswers = await Answer.find({}).populate('question_id');
        const ratedAnswers = allAnswers.filter(a => a.rate != null && (a.question_id as any).answerer_id.toString() === answererId.toString());

        const number_of_reviews = ratedAnswers.length;
        const rating =
            number_of_reviews > 0
                ? ratedAnswers.reduce((acc, cur) => acc + (cur.rate || 0), 0) / number_of_reviews
                : 0;

        await Answerer.findByIdAndUpdate(answererId, {
            number_of_reviews,
            rating,
        });

        console.log('✅ Review saved and answerer updated:', answer);
        await sendReviewNotificationToAnswerer(question);

        res.json(answer);
    } catch (err) {
        console.error('❌ Review failed:', err);
        res.status(500).json({error: 'Failed to submit review'});
    }
});

export default router;
