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
    log: ['query', 'error', 'warn'],
});

async function testConnection() {
    try {
        await prisma.$connect();
        console.log('--- DATABASE CONNECTED SUCCESSFULLY ---');
    } catch (error) {
        console.error('--- DATABASE CONNECTION ERROR DETAILS ---');
        console.error('Message:', error.message);
        console.error('Code:', error.code);
        console.error('Environment DATABASE_URL:', process.env.DATABASE_URL ? 'DEFINED' : 'UNDEFINED');
        if (process.env.DATABASE_URL) {
            const url = new URL(process.env.DATABASE_URL);
            console.log('DB Host:', url.hostname);
            console.log('DB Port:', url.port);
        }
    }
}

testConnection();

export default prisma;
