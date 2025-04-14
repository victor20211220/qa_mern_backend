// src/routes/auth.ts
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import Answerer from '../models/Answerer';
import Questioner from '../models/Questioner';
import {v4 as uuidv4} from 'uuid';
import {sendEmail} from '../utils/helpers';

dotenv.config();
const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

// ======================= ANSWERER =======================

// @ts-ignore
router.post('/answerer/register', async (req, res): Promise<void> => {
    try {
        const {name, email, password, category_id, hourly_rate, instagram, youtube, tiktok} = req.body;
        const existing = await Answerer.findOne({email});
        if (existing) {
            res.status(409).json({error: 'Email already in use'});
            return;
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const token = uuidv4();
        const answerer = new Answerer({
            name,
            email,
            password: hashedPassword,
            category_id,
            hourly_rate,
            instagram,
            youtube,
            tiktok,
            email_verification_token: token,
            email_verified: false,
        });
        await answerer.save();

        const verifyUrl = `${process.env.CLIENT_ORIGIN}/verify-email?token=${token}&type=answerer`;
        await sendEmail({
            to: email,
            subject: 'Verify your email',
            html: `<p>Hi ${name},</p><p>Please verify your email by clicking <a href="${verifyUrl}">here</a>.</p>`,
        });

        res.status(201).json({message: 'Registered. Check your email to verify.'});
    } catch (err) {
        res.status(500).json({error: 'Registration failed', details: err});
    }
});

router.post('/answerer/login', async (req, res): Promise<void> => {
    try {
        const {email, password} = req.body;
        const user = await Answerer.findOne({email});
        if (!user || !(await bcrypt.compare(password, user.password))) {
            res.status(401).json({error: 'Invalid credentials'});
            return;
        }
        if (!user.email_verified) {
            res.status(403).json({error: 'Please verify your email before logging in.'});
            return;
        }
        const token = jwt.sign({id: user._id, type: 'answerer'}, JWT_SECRET, {expiresIn: '24h'});
        res.json({token});
    } catch (err) {
        res.status(500).json({error: 'Login failed', details: err});
    }
});

// ======================= QUESTIONER =======================

router.post('/questioner/register', async (req, res): Promise<void> => {
    try {
        const {name, email, password} = req.body;
        const existing = await Questioner.findOne({email});
        if (existing) {
            res.status(409).json({error: 'Email already in use'});
            return;
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const token = uuidv4();
        const questioner = new Questioner({
            name,
            email,
            password: hashedPassword,
            email_verification_token: token,
            email_verified: false,
        });
        await questioner.save();

        const verifyUrl = `${process.env.CLIENT_ORIGIN}/verify-email?token=${token}&type=questioner`;
        await sendEmail({
            to: email,
            subject: 'Verify your email',
            html: `<p>Hi ${name},</p><p>Please verify your email by clicking <a href="${verifyUrl}">here</a>.</p>`,
        });
        res.status(201).json({message: 'Registered. Check your email to verify.'});

    } catch (err) {
        res.status(500).json({error: 'Registration failed', details: err});
    }
});

router.post('/questioner/login', async (req, res): Promise<void> => {
    try {
        const {email, password} = req.body;
        const user = await Questioner.findOne({email});
        if (!user || !(await bcrypt.compare(password, user.password))) {
            res.status(401).json({error: 'Invalid credentials'});
            return;
        }

        if (!user.email_verified) {
            res.status(403).json({error: 'Please verify your email before logging in.'});
            return;
        }

        const token = jwt.sign({id: user._id, type: 'questioner'}, JWT_SECRET, {expiresIn: '24h'});
        res.json({token});
    } catch (err) {
        res.status(500).json({error: 'Login failed', details: err});
    }
});

// GET /auth/verify-email?token=...&type=answerer|questioner
router.get('/verify-email', async (req, res): Promise<void> => {
    const {token, type} = req.query;
    try {
        if (!token || !type) {
            res.status(400).send('Missing token or type');
            return;
        }

        let user;

        if (type === 'questioner') {
            user = await Questioner.findOne({email_verification_token: token});
        } else {
            user = await Answerer.findOne({email_verification_token: token});
        }

        if (!user) {
            res.status(400).send('Invalid or expired token.');
            return;
        }

        user.email_verified = true;
        user.email_verification_token = "";
        await user.save();

        res.send('✅ Email verified! You can now login.');
    } catch (err) {
        res.status(500).send('Failed to verify email.');
    }
});

router.post('/forgot-password', async (req, res): Promise<void> => {
    const {email, role} = req.body;
    if (!email || !role) {
        res.status(400).json({error: 'Missing email or role'});
        return;
    }
    let user;
    if (role === 'questioner') {
        user = await Questioner.findOne({email});
    } else {
        user = await Answerer.findOne({email});
    }
    if (!user) {
        res.status(404).json({error: 'User not found'});
        return;
    }

    const token = jwt.sign({id: user._id, role}, JWT_SECRET, {expiresIn: '30m'});
    const link = `${process.env.CLIENT_ORIGIN}/reset-password?token=${token}`;

    await sendEmail({
        to: email,
        subject: 'Reset your password',
        html: `<p>Click to reset your password: <a href="${link}">${link}</a></p>`,
    });
    res.json({message: 'Password reset email sent'});
});

router.post('/reset-password', async (req, res): Promise<void> => {
    const {token, password} = req.body;
    if (!token || !password) {
        res.status(400).json({error: 'Missing token or password'});
        return;
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string; role: string };

        const hashed = await bcrypt.hash(password, 10);

        if (decoded.role === 'answerer') {
            await Answerer.findByIdAndUpdate(decoded.id, {password: hashed});
        } else {
            await Questioner.findByIdAndUpdate(decoded.id, {password: hashed});
        }

        res.json({message: 'Password reset successful'});
    } catch (err) {
        console.error('Reset error:', err);
        res.status(400).json({error: 'Invalid or expired token'});
    }
});


export default router;