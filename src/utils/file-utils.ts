
import fs from 'fs/promises';
import { createReadStream } from 'fs';
import path from 'path';
import * as stream from 'stream';
import { promisify } from 'util';
import { normalizePath } from './ast-utils';

const pipeline = promisify(stream.pipeline);
const LARGE_FILE_THRESHOLD = 5 * 1024 * 1024; // 5MB

/**
 * Checks if a file exists at the given path.
 */
export async function fileExists(filePath: string): Promise<boolean> {
    try {
        await fs.access(normalizePath(filePath));
        return true;
    } catch {
        return false;
    }
}

/**
 * Ensures a directory exists, creating it if necessary.
 */
export async function ensureDir(dirPath: string): Promise<void> {
    try {
        await fs.mkdir(normalizePath(dirPath), { recursive: true });
    } catch (error) {
        // Only ignore EEXIST errors
        if (error instanceof Error && 'code' in error && error.code !== 'EEXIST') {
            throw error;
        }
    }
}

/**
 * Reads a file with appropriate strategy based on size.
 */
export async function readFile(filePath: string): Promise<string> {
    const normalizedPath = normalizePath(filePath);

    try {
        const stats = await fs.stat(normalizedPath);

        if (stats.size > LARGE_FILE_THRESHOLD) {
            return readLargeFile(normalizedPath);
        }

        return fs.readFile(normalizedPath, 'utf-8');
    } catch (error) {
        logger.error(`Error reading file ${normalizedPath}:`, error);
        throw error;
    }
}

/**
 * Reads a large file in chunks to avoid memory issues.
 * Uses proper streaming to avoid loading the entire file into memory.
 */
async function readLargeFile(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        const readStream = createReadStream(filePath, { encoding: 'utf8' });

        readStream.on('data', (chunk) => {
            // Add chunk directly, no need to convert if already buffer
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });

        readStream.on('error', (err) => {
            // Clean up
            readStream.destroy();
            reject(err);
        });

        readStream.on('end', () => {
            // Clean up
            readStream.destroy();
            resolve(Buffer.concat(chunks).toString('utf-8'));
        });

        // Add timeout handling
        const timeout = setTimeout(() => {
            readStream.destroy();
            reject(new Error(`Reading file ${filePath} timed out after 60s`));
        }, 60000); // 60 second timeout

        readStream.on('close', () => {
            clearTimeout(timeout);
        });
    });
}

/**
 * Logger utility with configurable debug level.
 */
export const logger = {
    debug: function (message: string, ...args: any[]) {
        if (this._debug) {
            console.debug(`[CodeGraph] ${message}`, ...args);
        }
    },
    info: function (message: string, ...args: any[]) {
        console.info(`[CodeGraph] ${message}`, ...args);
    },
    warn: function (message: string, ...args: any[]) {
        console.warn(`[CodeGraph] ${message}`, ...args);
    },
    error: function (message: string, ...args: any[]) {
        console.error(`[CodeGraph] ${message}`, ...args);
    },
    _debug: false,
    setDebug: function (debug: boolean) {
        this._debug = debug;
    }
};