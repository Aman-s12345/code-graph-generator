import fs from 'fs/promises';
import path from 'path';
import * as stream from 'stream';
import { promisify } from 'util';

const pipeline = promisify(stream.pipeline);


export async function fileExists(filePath: string): Promise<boolean> {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}


export async function ensureDir(dirPath: string): Promise<void> {
    try {
        await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
        if ((error as any).code !== 'EEXIST') {
            throw error;
        }
    }
}


export async function readFile(filePath: string): Promise<string> {

    const stats = await fs.stat(filePath);


    if (stats.size > 5 * 1024 * 1024) {
        return readLargeFile(filePath);
    }

    return fs.readFile(filePath, 'utf-8');
}

/**
 * Read a large file in chunks to avoid memory issues
 */
async function readLargeFile(filePath: string): Promise<string> {
    const chunks: Buffer[] = [];
    const readStream = stream.Readable.from(await fs.readFile(filePath));

    return new Promise((resolve, reject) => {
        readStream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        readStream.on('error', (err) => reject(err));
        readStream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    });
}


export const logger = {
    debug: (message: string, ...args: any[]) => {
        if (logger._debug) {
            console.debug(`[CodeGraph] ${message}`, ...args);
        }
    },
    info: (message: string, ...args: any[]) => {
        console.info(`[CodeGraph] ${message}`, ...args);
    },
    warn: (message: string, ...args: any[]) => {
        console.warn(`[CodeGraph] ${message}`, ...args);
    },
    error: (message: string, ...args: any[]) => {
        console.error(`[CodeGraph] ${message}`, ...args);
    },
    _debug: false,
    setDebug: (debug: boolean) => {
        logger._debug = debug;
    }
};
