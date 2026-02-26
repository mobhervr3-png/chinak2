import pkg from '@prisma/client';
const { PrismaClient } = pkg;
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, '.env');
dotenv.config({ path: envPath });

const prisma = new PrismaClient({
    log: ['error', 'warn'],
    datasources: {
        db: {
            url: process.env.DATABASE_URL,
        },
    },
});

// Debug log to verify the environment variable is actually reaching the app
console.log('--- DB CONNECTION DEBUG ---');
console.log('DATABASE_URL defined:', !!process.env.DATABASE_URL);
if (process.env.DATABASE_URL) {
    try {
        const maskedUrl = process.env.DATABASE_URL.replace(/:([^@]+)@/, ':****@');
        console.log('Connection URL (masked):', maskedUrl);
    } catch (e) {
        console.log('DATABASE_URL is not a valid URL format');
    }
}
console.log('---------------------------');

export default prisma;
