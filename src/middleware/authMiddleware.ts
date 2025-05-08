import {NextFunction, Request, Response} from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

export interface AuthRequest extends Request {
    user?: any;
}

export const verifyToken = (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({error: 'No token provided'});
        return;
    }

    const token = authHeader.split(' ')[1];

    try {
        (req as AuthRequest).user = jwt.verify(token, JWT_SECRET);
        next();
    } catch (err) {
        res.status(403).json({error: 'Invalid or expired token'});
    }
};
