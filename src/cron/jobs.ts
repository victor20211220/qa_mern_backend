// cron/jobs.ts
import cron from 'node-cron';
import Question from '../models/Question';
import QuestionType from '../models/QuestionType';
import Answer from '../models/Answer';
import Answerer from '../models/Answerer';
import Stripe from "stripe";

// Run every hour
cron.schedule('0 * * * *', async () => {
    console.log('🔄 Running scheduled job...');

    const now = new Date();

    const questions = await Question.find({status: 0, paid: true}); // only pending

    for (const q of questions) {
        const questionType = await QuestionType.findById(q.question_type_id);
        if (!questionType) continue;

        const deadline = new Date(q.created_at);
        const durationMs = questionType.response_time * 60 * 60 * 1000; // hours to ms
        deadline.setTime(deadline.getTime() + durationMs);

        const answer = await Answer.findOne({question_id: q._id});

        if (!answer && now > deadline) {
            await Question.findByIdAndUpdate(q._id, {status: 2});
            console.log(`⛔ Question ${q._id} expired (unanswered)`);

            if (q.payment_intent_id) {
                try {
                    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
                    await stripe.refunds.create({
                        payment_intent: q.payment_intent_id,
                        reason: 'requested_by_customer'
                    });
                    console.log(`💸 Refunded payment for question ${q._id}`);
                } catch (refundErr) {
                    console.error(`❌ Failed to refund question ${q._id}`);
                }
            }
        }
    }

    // Update response rate for all answerers
    /*const allAnswerers = await Answerer.find({});
    for (const a of allAnswerers) {
        const total = await Question.countDocuments({answerer_id: a._id});
        const answered = await Question.countDocuments({answerer_id: a._id, status: 1});
        const rate = total > 0 ? answered / total : 0;
        await Answerer.findByIdAndUpdate(a._id, {response_rate: rate});
    }*/

    console.log('✅ Cron job finished.');
});
