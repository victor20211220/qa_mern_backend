// src/routes/answerers.ts
import express, {Request, Response} from 'express';
import axios from "axios";

const router = express.Router();

// GET current answerer's profile
router.get('/', async (req: Request, res: Response): Promise<void> => {
    // Decode the URL from the request path
    const targetUrl = req.query.url as string | undefined;
    if (!targetUrl) {
        res.status(400).send('URL query parameter is required');
        return;
    }

    try {
        // Fetch the content from the target URL
        const response = await axios.get(targetUrl);

        // Set content type and send back the response
        res.set('Content-Type', 'text/html');

        // Strip X-Frame-Options headers if they exist
        res.send(response.data.replace(/X-Frame-Options.*;/gi, ''));
    } catch (error) {
        console.error('Error fetching URL:', error);
        res.status(500).send('Error fetching the content');
    }
});

export default router;
