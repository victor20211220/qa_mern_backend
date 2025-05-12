// src/routes/auth.ts
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import Answerer from '../models/Answerer';
import Questioner from '../models/Questioner';
import {v4 as uuidv4} from 'uuid';
import {CLIENT_ORIGIN, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, sendEmail, SERVER_URL} from '../utils/helpers';
import DefaultConfig from '../models/DefaultQuestionTypesConfiguration';
import QuestionType from '../models/QuestionType';
import passport from 'passport';
import {Strategy as GoogleStrategy} from 'passport-google-oauth20';
import {Strategy as FacebookStrategy} from 'passport-facebook';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import {Types} from 'mongoose';


dotenv.config();
const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

// ======================= ANSWERER =======================

// @ts-ignore
router.post('/answerer/register', async (req, res): Promise<void> => {
    try {
        const {name, email, password, category_id, instagram, youtube, tiktok} = req.body;
        const existing = await Answerer.findOne({email});
        if (existing) {
            res.status(409).json({error: 'Email already in use'});
            return;
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const token = uuidv4();
        const createData: any = {
            name,
            email,
            password: hashedPassword,
            instagram,
            youtube,
            tiktok,
            email_verification_token: token,
            email_verified: false,
        };
        if (category_id) {
            createData.category_id = category_id;
        }
        const answerer = new Answerer(createData);
        await answerer.save();

        if (answerer) await createDefaultQuestionTypesForAnswerer(answerer._id as Types.ObjectId);

        const verifyUrl = `${CLIENT_ORIGIN}/verify-email?token=${token}&type=answerer`;
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

const createDefaultQuestionTypesForAnswerer = async (id: string | Types.ObjectId) => {
    // Create default question types for new answerer
    const configs = await DefaultConfig.find();

    for (const config of configs) {
        const newType = new QuestionType({
            answerer_id: id,
            type: config.type,
            price: config.price,
            response_time: config.response_time,
            number_of_choice_options: config.number_of_choice_options,
            number_of_picture_options: config.number_of_picture_options,
            enabled: true,
        });

        await newType.save();
    }
}


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

        const verifyUrl = `${CLIENT_ORIGIN}/verify-email?token=${token}&type=questioner`;
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

        if (type === 'answerer') {
            // Create default question types for new answerer
            const configs = await DefaultConfig.find();

            for (const config of configs) {
                const newType = new QuestionType({
                    answerer_id: user._id,
                    type: config.type,
                    price: config.price,
                    response_time: config.response_time,
                    number_of_choice_options: config.number_of_choice_options,
                    number_of_picture_options: config.number_of_picture_options,
                    enabled: true,
                });

                await newType.save();
            }
        }

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
    const link = `${CLIENT_ORIGIN}/reset-password?token=${token}`;

    await sendEmail({
        to: email,
        subject: 'Reset your password',
        html: `<p>Click to reset your password: <a href="${link}">Here</a></p>`,
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
        const decoded = jwt.verify(token, JWT_SECRET!) as { id: string; role: string };

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

passport.use('google-answerer', new GoogleStrategy({
    clientID: GOOGLE_CLIENT_ID!,
    clientSecret: GOOGLE_CLIENT_SECRET!,
    callbackURL: `${SERVER_URL}/api/auth/google/callback/answerer`
}, async (accessToken, refreshToken, profile, done) => {
    const {email, name, picture} = profile._json;
    let user = await Answerer.findOne({email});
    if (!user) {
        const createData: any = {
            name,
            email,
            email_verified: true
        }
        if (picture) {
            createData.photo = await downloadAndSaveSocialPhoto(picture, "google");
        }

        user = new Answerer(createData);
        await user.save();

        if (user) await createDefaultQuestionTypesForAnswerer(user._id as Types.ObjectId);
    }
    done(null, user);
}));

router.get('/google/answerer',
    passport.authenticate('google-answerer', {scope: ['profile', 'email']}));

router.get('/google/callback/answerer',
    passport.authenticate('google-answerer', {
        session: false,
        failureRedirect: `${CLIENT_ORIGIN}/login`
    }),
    (req, res) => {
        const user = req.user as any;
        const token = jwt.sign({id: user._id, type: 'answerer'}, JWT_SECRET);
        res.redirect(`${CLIENT_ORIGIN}/?token=${token}&type=answerer`);
    });

passport.use('google-questioner', new GoogleStrategy({
    clientID: GOOGLE_CLIENT_ID!,
    clientSecret: GOOGLE_CLIENT_SECRET!,
    callbackURL: `${SERVER_URL}/api/auth/google/callback/questioner`
}, async (_accessToken, _refreshToken, profile, done) => {
    const {email, name, picture} = profile._json;

    let user = await Questioner.findOne({email});
    if (!user) {
        const createData: any = {
            name,
            email,
            email_verified: true
        }
        if (picture) {
            createData.photo = await downloadAndSaveSocialPhoto(picture, "google");
        }

        user = new Questioner(createData);
        await user.save();
    }

    done(null, user);
}));

router.get('/google/questioner',
    passport.authenticate('google-questioner', {scope: ['profile', 'email']}));

router.get('/google/callback/questioner',
    passport.authenticate('google-questioner', {
        session: false,
        failureRedirect: `${CLIENT_ORIGIN}/login`
    }),
    (req, res) => {
        const user = req.user as any;
        const token = jwt.sign({id: user._id, type: 'questioner'}, JWT_SECRET);
        res.redirect(`${CLIENT_ORIGIN}/?token=${token}&type=questioner`);
    });

// src/config/passport.ts
const FACEBOOK_CLIENT_ID = process.env.FACEBOOK_CLIENT_ID;
const FACEBOOK_CLIENT_SECRET = process.env.FACEBOOK_CLIENT_SECRET;

router.get('/facebook/callback/answerer', async (req, res) => {
    try {
        const {code} = req.query;

        // Step 1: Exchange code for access token
        const tokenRes = await axios.get('https://graph.facebook.com/v19.0/oauth/access_token', {
            params: {
                client_id: FACEBOOK_CLIENT_ID,
                client_secret: FACEBOOK_CLIENT_SECRET,
                redirect_uri: `${SERVER_URL}/api/auth/facebook/callback/answerer`,
                code,
            }
        });

        const accessToken = tokenRes.data.access_token;

        // Step 2: Get user profile
        const profileRes = await axios.get(`https://graph.facebook.com/me`, {
            params: {
                access_token: accessToken,
                fields: 'id,name,email,picture',
            }
        });

        const profile = profileRes.data;
        const email = profile.email || `${profile.id}@facebook.com`;

        let user = await Answerer.findOne({email});
        if (!user) {
            const createData:any =  {
                name: profile.name,
                email,
                email_verified: true,
            };
            const photo = profile.picture?.data?.url;
            if (photo) {
                createData.photo = await downloadAndSaveSocialPhoto(photo, "facebook");
            }
            user = new Answerer(createData);
            await user.save();
        }

        const token = jwt.sign({id: user._id, type: 'answerer'}, JWT_SECRET);
        res.redirect(`${CLIENT_ORIGIN}/?token=${token}&type=answerer`);
    } catch (err) {
        console.error('Facebook login error:', err);
        res.redirect(`${CLIENT_ORIGIN}/login`);
    }
});

router.get('/facebook/callback/questioner', async (req, res) => {
    try {
        const {code} = req.query;

        // Step 1: Exchange code for access token
        const tokenRes = await axios.get('https://graph.facebook.com/v19.0/oauth/access_token', {
            params: {
                client_id: FACEBOOK_CLIENT_ID,
                client_secret: FACEBOOK_CLIENT_SECRET,
                redirect_uri: `${SERVER_URL}/api/auth/facebook/callback/questioner`,
                code,
            }
        });

        const accessToken = tokenRes.data.access_token;

        // Step 2: Get user profile
        const profileRes = await axios.get(`https://graph.facebook.com/me`, {
            params: {
                access_token: accessToken,
                fields: 'id,name,email,picture',
            }
        });

        const profile = profileRes.data;
        const email = profile.email || `${profile.id}@facebook.com`;

        let user = await Questioner.findOne({email});
        if (!user) {
            const createData:any =  {
                name: profile.name,
                email,
                email_verified: true,
            };
            const photo = profile.picture?.data?.url;
            if (photo) {
                createData.photo = await downloadAndSaveSocialPhoto(photo, "facebook");
            }
            user = new Questioner(createData);
            await user.save();
        }

        const token = jwt.sign({id: user._id, type: 'questioner'}, JWT_SECRET);
        res.redirect(`${CLIENT_ORIGIN}/?token=${token}&type=questioner`);
    } catch (err) {
        console.error('Facebook login error:', err);
        res.redirect(`${CLIENT_ORIGIN}/login`);
    }
});




const downloadAndSaveSocialPhoto = async (val: string = "", social: string) => {
    // download and save profile image
    const photo = `${Date.now()}-${social}.jpg`;
    const res = await axios.get(val, {responseType: 'stream'});
    const writer = fs.createWriteStream(path.join('uploads', photo));
    res.data.pipe(writer);
    return `uploads\\${photo}`;
}

export default router;