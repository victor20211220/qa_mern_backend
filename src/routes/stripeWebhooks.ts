import express from 'express';
import Stripe from 'stripe';
import Question from '../models/Question';
import {sendQuestionNotificationToAnswerer} from "../utils/helpers";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const router = express.Router();

// Must use raw body parser for Stripe signature validation
router.post('/stripe', express.raw({type: 'application/json'}), async (req, res): Promise<void> => {

    try {
        const sig = req.headers['stripe-signature'] as string;
        let event: Stripe.Event;
        event = stripe.webhooks.constructEvent(
            req.body,
            sig!,
            process.env.STRIPE_WEBHOOK_SECRET!
        );
        const session = event.data.object as Stripe.Checkout.Session;
        const questionId = session.metadata?.question_id;
        // Success → keep the question
        if (event.type === 'checkout.session.completed') {
            const question = await Question.findByIdAndUpdate(questionId, {
                paid: true,
                payment_intent_id: session.payment_intent
            });
            if (!question) {
                console.error('❌ Question not found:', questionId);
                res.sendStatus(404); // or just return;
                return;
            }
            console.log(`✅ Payment succeeded for question ${questionId}`);
            await sendQuestionNotificationToAnswerer(question);
        }

        // Expired or canceled → delete the question
        if (
            event.type === 'checkout.session.expired' ||
            event.type === 'checkout.session.async_payment_failed'
        ) {
            if (questionId) {
                await Question.findByIdAndDelete(questionId);
                console.log(`🗑️ Deleted unpaid question: ${questionId}`);
            }
        }
    } catch (err) {
        console.error('Webhook error:', err);
        res.status(400).send(`Webhook Error: ${err}`);
    }
    res.sendStatus(200);
});

export default router;