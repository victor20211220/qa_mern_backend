import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import Question, {IQuestion} from "../models/Question";
import Answerer from "../models/Answerer";
import QuestionType from "../models/QuestionType";
import {IAnswer} from "../models/Answer";
import Questioner from "../models/Questioner";

const logPath = path.join(__dirname, '../../mails.log');
const errorLogPath = path.join(__dirname, '../../errors.log');

interface EmailPayload {
    to: string;
    subject: string;
    html: string;
}

export const isLocal = process.env.NODE_ENV !== 'production';
export const sendEmail = async ({to, subject, html}: EmailPayload) => {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] TO: ${to} | SUBJECT: ${subject}\n${html}\n\n`;


    // Always log emails
    fs.appendFileSync(logPath, logEntry);

    if (isLocal) {
        console.log('📭 Email logged (not sent in dev)');
        return;
    }

    console.log('SMTP_USER:', process.env.SMTP_USER);
    console.log('SMTP_PASS:', process.env.SMTP_PASS);
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: true,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
        logger: true, // logs full SMTP communication
        debug: true,  // extra debug output
    });

    await transporter.sendMail({
        from: process.env.SMTP_FROM,
        to,
        subject,
        html,
    }).then(info => {
        console.log('✅ Email sent:', info);
    }).catch(error => {
        console.error('❌ Email failed:', error);
        fs.appendFileSync(errorLogPath, `[${new Date().toISOString()}] ❌ Email failed: ${error}\n\n`);
    });
};


export const sendQuestionNotificationToAnswerer = async (question: IQuestion) => {
    if (!question) {
        return;
    }
    const answerer = await Answerer.findById(question.answerer_id);
    const questionType = await QuestionType.findById(question.question_type_id);
    const responseTime = questionType?.response_time || 24; // fallback
    if (answerer) {
        await sendEmail({
            to: answerer.email,
            subject: 'New Question Assigned to You',
            html: `
                    <p>Hi ${answerer.name},</p>
                    <p>You have received a new question:</p>
                    <blockquote>${question.question}</blockquote>
                    <p>Please answer it within <strong>${responseTime} hour(s)</strong>.</p>
                    <p><a href="${process.env.CLIENT_ORIGIN}/influencer/view-question?question_id=${question._id}">Click here to answer</a></p>
                  `,
        });
    }
}


export const sendAnswerNotificationToQuestioner = async (answer: IAnswer) => {
    try {
        const question = await Question.findById(answer.question_id);
        if (!question) return;

        const questioner = await Questioner.findById(question.questioner_id);
        if (!questioner) return;

        const answerer = await Answerer.findById(question.answerer_id);
        if (!answerer) return;

        const subject = `Your question has been answered by ${answerer.name}`;
        const link = `${process.env.CLIENT_ORIGIN}/questioner/view-question?question_id=${question._id}`;

        await sendEmail({
            to: questioner.email,
            subject,
            html: `
        <p>Hi ${questioner.name},</p>
        <p>Your question has just been answered by ${answerer.name}:</p>
        <blockquote>${answer.answer}</blockquote>
        <p>You can now rate and review the answer:</p>
        <a href="${link}">Review this answer</a>
      `,
        });
    } catch (err) {
        console.error('❌ Failed to send answer notification to questioner:', err);
    }
};

export const sendReviewNotificationToAnswerer = async (question: IQuestion) => {
    try {
        const answerer = await Answerer.findById(question.answerer_id);
        const questioner = await Questioner.findById(question.questioner_id);

        if (!answerer || !questioner || !answerer.email_verified) return;

        const subject = `You received a new review from ${questioner.name}`;
        const link = `${process.env.CLIENT_ORIGIN}/influencer/view-question?question_id=${question._id}`;

        await sendEmail({
            to: answerer.email,
            subject,
            html: `
        <p>Hi ${answerer.name},</p>
        <p>${questioner.name} has left a new review on your answer:</p>
        <p><a href="${link}">Click here to view the review</a></p>
      `,
        });
    } catch (err) {
        console.error('❌ Failed to send review notification to answerer:', err);
    }
};

