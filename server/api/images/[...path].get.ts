import { createReadStream } from 'node:fs';
import { resolve, extname } from 'node:path';
import { stat } from 'node:fs/promises';

const CONTENT_TYPES: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mov': 'video/quicktime'
};

export default defineEventHandler(async (event) => {
    const pathParam = event.context.params?.path as string;
    if (!pathParam) {
        throw createError({ statusCode: 404, statusMessage: 'Not Found' });
    }

    const filePath = resolve(process.cwd(), 'data', 'temp', pathParam.replace(/\.\.(?:\\|\/)/g, ''));
    const info = await stat(filePath);
    if (!info.isFile()) {
        throw createError({ statusCode: 404, statusMessage: 'Not Found' });
    }

    const ext = extname(filePath).toLowerCase();
    const type = CONTENT_TYPES[ext];
    if (type) {
        event.node.res.setHeader('Content-Type', type);
    }

    const stream = createReadStream(filePath);
    event.node.res.setHeader('Content-Length', info.size.toString());
    return stream;
});
