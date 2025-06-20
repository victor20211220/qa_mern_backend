// src/routes/answerers.ts
import express, {Request, Response} from 'express';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import {promisify} from 'util';
import https from 'https';
import http from 'http';

const router = express.Router();
const writeFileAsync = promisify(fs.writeFile);

// Helper function to download files
async function downloadFile(url: string, dest: string): Promise<void> {
    const mod = url.startsWith('https') ? https : http;

    return new Promise((resolve, reject) => {
        mod.get(url, (response) => {
            const fileStream = fs.createWriteStream(dest);
            response.pipe(fileStream);
            fileStream.on('finish', resolve);
            fileStream.on('error', reject);
        });
    });
}


// Process the assets and replace URLs with local paths
async function processAssets(content: string, pattern: RegExp, baseUrl: string, type: string): Promise<string> {
    const matches = [...content.matchAll(pattern)];

    for (const match of matches) {
        const relativeUrl = match[1];
        const assetUrl = `${baseUrl}/${relativeUrl}`;
        const fileName = path.basename(relativeUrl);
        const localFilePath = path.join(__dirname, '../../uploads', fileName);

        // Download the asset to local server storage
        try {
            await downloadFile(assetUrl, localFilePath);

            // Replace the asset URL in the content with the local file path
            const localAssetUrl = `uploads/${fileName}`;
            content = content.replace(relativeUrl, localAssetUrl);
        } catch (error) {
            console.error(`Error downloading ${assetUrl}:`, error);
        }
    }

    return content;
}

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
        // Get the base URL (i.e., the origin of the target URL)
        const baseUrl = new URL(targetUrl).origin;

        // Get the page content
        let content = response.data;

        // Regex patterns for common asset types (CSS, JS, etc.)
        const assetPatterns = [
            {pattern: /href="\/([^"]+\.css)"/g, type: 'css'},
            {pattern: /component-url="\/([^"]+)"/g, type: 'component'},
            {pattern: /renderer-url="\/([^"]+)"/g, type: 'renderer'},
        ];

        // Loop through each pattern and handle the asset downloading and content replacement
        for (const {pattern, type} of assetPatterns) {
            content = await processAssets(content, pattern, baseUrl, type);
        }

        // Strip X-Frame-Options headers if they exist
        res.send(content.replace(/X-Frame-Options.*;/gi, ''));
    } catch (error) {
        console.error('Error fetching URL:', error);
        res.status(500).send('Error fetching the content');
    }
});

export default router;
