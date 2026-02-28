import vanillaPuppeteer from 'puppeteer-core';
import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

const puppeteer = puppeteerExtra.addExtra(vanillaPuppeteer);
puppeteer.use(StealthPlugin());

import fs from 'fs';
import path from 'path';
import os from 'os';
import { exec as execCallback } from 'child_process';
import { promisify } from 'util';
const exec = promisify(execCallback);
import dotenv from 'dotenv';
import OpenAI from 'openai'; // Use OpenAI SDK for DeepInfra
import readline from 'readline';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import prisma from '../prismaClient.js'; // Use central prisma client

// Load .env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, '..', '.env'); // server/.env
dotenv.config({ path: envPath });

// --- SAFETY CHECK: PREVENT RUNNING IN PRODUCTION BY ACCIDENT ---
if (process.env.NODE_ENV === 'production' && process.env.ALLOW_SCRAPER_IN_PROD !== 'true') {
    console.error('CRITICAL: Scraper is BLOCKED in production environment.');
    console.error('To run this script on the server, set ALLOW_SCRAPER_IN_PROD=true in your environment variables.');
    process.exit(1);
}

// --- FIX DATABASE CONNECTION POOL ---
// Enforce connection limit to prevent "MaxClientsInSessionMode" error
if (process.env.DATABASE_URL) {
    try {
        const url = new URL(process.env.DATABASE_URL);
        // Use port 5432 for direct connection if using scraper locally to avoid pgbouncer issues
        if (url.port === '6543') {
            url.port = '5432';
            console.log('Adjusting DATABASE_URL port from 6543 to 5432 for local scraper stability.');
        }
        // Use minimal connections (1) for this single-threaded scraper to avoid exhausting the pool
        url.searchParams.set('connection_limit', '1'); 
        process.env.DATABASE_URL = url.toString();
    } catch (e) {
        console.warn('Warning: Could not parse DATABASE_URL to set connection_limit');
    }
}

// Use central prisma client
// const prisma = new PrismaClient();

// --- DeepInfra Embedding Service ---
const deepinfra = new OpenAI({
    baseURL: 'https://api.deepinfra.com/v1/openai',
    apiKey: process.env.DEEPINFRA_API_KEY,
});

async function generateEmbedding(productId) {
    if (!process.env.DEEPINFRA_API_KEY) {
        console.log('Skipping embedding: DEEPINFRA_API_KEY not found');
        return;
    }

    try {
        const product = await prisma.product.findUnique({
            where: { id: productId },
            select: { name: true, specs: true }
        });

        if (!product) return;

        const specsText = typeof product.specs === 'string' ? product.specs : JSON.stringify(product.specs || '');
        const textToEmbed = `${product.name} ${specsText}`.trim().substring(0, 1000);
        console.log(`Generating embedding for Product ${productId} (using google/embeddinggemma-300m, truncating to 384d)...`);

        // Use a timeout for the embedding generation to prevent hanging
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

        try {
            const response = await deepinfra.embeddings.create({
                model: 'google/embeddinggemma-300m', 
                input: textToEmbed,
            }, { signal: controller.signal });

            clearTimeout(timeoutId);

            let embedding = response.data[0].embedding;
            
            // Truncate embedding if it exceeds 384 dimensions (e.g. 768d -> 384d)
            if (embedding.length > 384) {
                console.log(`⚠️ Truncating embedding from ${embedding.length}d to 384d to match DB schema.`);
                embedding = embedding.slice(0, 384);
            }

            // Update the product with the embedding vector
            // Note: We use executeRaw because Prisma doesn't natively support pgvector well in standard methods
            await prisma.$executeRawUnsafe(
                'UPDATE "Product" SET embedding = $1::vector WHERE id = $2',
                embedding,
                productId
            );

            console.log(`✅ Embedding generated and saved for Product ${productId}`);
        } catch (apiError) {
            clearTimeout(timeoutId);
            throw apiError;
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            console.error(`❌ Embedding generation timed out for Product ${productId} after 30s.`);
        } else {
            console.error(`❌ Embedding generation failed for Product ${productId}:`, error.message);
        }
        if (error.message?.includes('allow_list')) {
            console.error('⚠️ Supabase IP Blocked (Embedding Task). Check Network Restrictions.');
        }
    }
}

// Global flag for page errors (e.g. 424/403)
let hasPageError = false;

// --- DATABASE SCHEMA HEALING ---
async function ensureDatabaseSchema() {
    // Skip schema check entirely in the scraper as requested/to avoid connection issues
    console.log('Skipping schema check for stability...');
    return;
    
    try {
        console.log('Checking database schema...');
        // Retry logic for initial connection
        let retries = 3;
        while (retries > 0) {
            try {
                const columns = await prisma.$queryRawUnsafe(`
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_name = 'Product' AND column_name = 'scrapedReviews';
                `);
                
                if (columns.length === 0) {
                    console.log('Adding missing "scrapedReviews" column...');
                    await prisma.$executeRawUnsafe(`ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "scrapedReviews" JSONB;`);
                    console.log('Schema update attempted.');
                } else {
                    console.log('Schema OK: "scrapedReviews" column exists.');
                }
                break; // Success
            } catch (e) {
                console.warn(`Schema check failed (attempt ${4-retries}/3): ${e.message}`);
                retries--;
                if (retries === 0) {
                    console.warn('Skipping schema check after multiple failures (non-fatal).');
                } else {
                    console.log(`Waiting 1s before retry (Attempt ${4-retries}/3)...`);
                    await new Promise(r => setTimeout(r, 1000));
                }
            }
        }
    } catch (e) {
        console.warn('Schema check/fix failed (non-fatal):', e.message);
    }
}

// --- EDIBLE ITEM FILTERING CONFIGURATION ---
const EDIBLE_KEYWORDS = [
    "食品", "零食", "蔬果", "罐头", "饮料", "糖果", "饼干", "调料", "茶", "酒", 
    "肉", "蛋", "奶", "油", "米", "面", "果冻", "巧克力", "咖啡", "food", "snack", 
    "nut", "can", "drink", "candy", "biscuit", "seasoning", "tea", "wine", 
    "meat", "egg", "milk", "oil", "rice", "noodle", "jelly", "chocolate", "coffee",
    "吃", "喝", "味", "香", "甜", "辣", "咸", "酸", "苦" // General taste/eating words
];

// Stricter list for immediate rejection
const STRICT_EDIBLE_KEYWORDS = [
    "食品", "零食", "蔬果", "罐头", "饮料", "糖果", "饼干", "调料", "茶叶", "酒水", 
    "鲜肉", "鸡蛋", "牛奶", "食用油", "大米", "面粉", "果冻", "巧克力", "咖啡豆",
    "保健品", "维生素", "钙片", "酵素", "益生菌" // Supplements
];

// Helper to delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper for random delay (User requested randomization)
const randomDelay = (min, max) => {
    const ms = Math.floor(Math.random() * (max - min + 1) + min);
    return new Promise(resolve => setTimeout(resolve, ms));
};

// Helper: Human-like Smooth Slide Scroll
const humanScroll = async (page, distance, options = {}) => {
    const {
        steps = Math.floor(Math.random() * 15) + 20, // 20-35 steps (smoother)
        minStepDelay = 10,
        maxStepDelay = 40,
        variance = 0.1 // 10% distance variance
    } = options;

    await page.evaluate(async (dist, steps, min, max, vari) => {
        const vh = window.innerHeight;
        // If distance not provided, default to 0.8 screen height
        const targetDist = dist || (vh * 0.8);
        
        // Add randomness to total distance
        const actualDistance = targetDist * (1 + (Math.random() * vari * 2 - vari));
        const stepSize = actualDistance / steps;

        for (let i = 0; i < steps; i++) {
            // Irregular step size (mimic thumb drag acceleration/deceleration)
            // Start slow, speed up, end slow (Ease-in-out-ish)
            // Simplified: just some random variance per step
            const currentStep = stepSize * (0.9 + Math.random() * 0.2); 
            
            window.scrollBy(0, currentStep);
            
            // Random delay
            const delay = Math.floor(Math.random() * (max - min + 1)) + min;
            await new Promise(r => setTimeout(r, delay));
        }
    }, distance, steps, minStepDelay, maxStepDelay, variance);
};

// --- OpenAI / DeepInfra Setup ---
const DEEPINFRA_API_KEY = 'PH4r4lox3jZBlFQROJ78bdaaLnuUKvNB'; // Hardcoded as requested
const MODEL_4B = 'google/gemma-3-4b-it';
const MODEL_12B = 'google/gemma-3-12b-it';

const openai = new OpenAI({
    baseURL: 'https://api.deepinfra.com/v1/openai',
    apiKey: DEEPINFRA_API_KEY,
    timeout: 120000, // Increased to 120 seconds for large batch processing (30+ items)
    maxRetries: 2
});

// --- Constants ---
const USER_AGENTS = [
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36'
];

// Helper to get random user agent
function getRandomUserAgent() {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// Function to find Chrome executable
function getExecutablePath() {
    if (process.env.PDD_CHROME_PATH && fs.existsSync(process.env.PDD_CHROME_PATH)) {
        return process.env.PDD_CHROME_PATH;
    }

    const paths = [
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
        process.env.LOCALAPPDATA + "\\Google\\Chrome\\Application\\chrome.exe"
    ];

    for (const p of paths) {
        if (fs.existsSync(p)) return p;
    }
    
    console.error("Chrome executable not found. Please install Chrome or set PDD_CHROME_PATH.");
    process.exit(1);
}

// Allow URL to be passed via command line argument
let cliUrl = process.argv[2];
let layoutMode = process.argv[3] === '1' ? 'vertical-4' : 'grid-2x2';

// Handle case where URL and mode are passed as a single quoted string (e.g. from batch "set /p")
if (cliUrl && cliUrl.includes(' ')) {
    const parts = cliUrl.trim().split(/\s+/);
    cliUrl = parts[0];
    if (parts.length > 1 && parts[1] === '1') {
        layoutMode = 'vertical-4';
    }
}

if (layoutMode === 'vertical-4') {
    console.log('Using Vertical Layout Mode (1 item/row, 4 items/screen)');
}

let CATEGORY_URL = cliUrl && cliUrl.startsWith('http') 
    ? cliUrl 
    : 'https://mobile.pinduoduo.com/?lastTabItemID=16'; 

if (cliUrl) {
    console.log('Using URL from command line:', cliUrl);
} else {
    console.log('Using default/hardcoded URL.');
}

const TARGET_PRODUCT_COUNT = 999999; // Effectively infinite
const OUTPUT_FILE = path.join(__dirname, '..', 'pinduoduo-products.json'); 
const PAGE_LOAD_TIMEOUT = 60000;

// Global flag for graceful shutdown
let isRunning = true;
process.on('SIGINT', () => {
    console.log('\nReceived SIGINT. Stopping scraper gracefully...');
    isRunning = false;
});

// Helper: Ask question in terminal
function askQuestion(query) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    return new Promise(resolve => rl.question(query, ans => {
        rl.close();
        resolve(ans);
    }));
}

// Mobile Emulation (Pixel 7-ish)
async function applyMobileEmulation(page) {
    await page.setUserAgent(getRandomUserAgent());
    await page.setViewport({
        width: 412,
        height: 915,
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2.6
    });
}

// Safe goto wrapper with retries
async function safeGoto(page, url, options = {}, retries = 2) {
    for (let i = 0; i <= retries; i++) {
        try {
            if (!isRunning) return null;
            const response = await page.goto(url, options);
            if (response && response.status() >= 400) {
                 // Check for 429
                 if (response.status() === 429) {
                     console.log(`[SafeGoto] Hit 429 on attempt ${i+1}. Waiting longer...`);
                     await delay(5000 * (i + 1));
                     throw new Error('Rate Limited');
                 }
                 // Other errors might be temporary
            }
            return response;
        } catch (e) {
            console.log(`[SafeGoto] Attempt ${i+1} failed for ${url}: ${e.message}`);
            if (i === retries) {
                console.error(`[SafeGoto] Giving up on ${url}`);
                // return null; // Don't crash, just return null
                throw e; // Let caller decide
            }
            await delay(2000 * (i + 1));
        }
    }
}

// Check if element exists
async function elementExists(page, selector, timeout = 1000) {
    try {
        await page.waitForSelector(selector, { timeout });
        return true;
    } catch (e) {
        return false;
    }
}

// Scroll down slowly and human-like with NOISE
async function autoScroll(page, maxScrolls = 20) {
    try {
        let scrolls = 0;
        let previousHeight = 0;
        
        while (scrolls < maxScrolls) {
            if (!isRunning) break;
            
            // 1. Random Scroll Up (Noise) - 20% chance
            if (Math.random() < 0.2 && scrolls > 1) {
                const upDist = Math.floor(Math.random() * 200 + 100);
                // console.log(`[Noise] Scrolling UP by ${upDist}px`);
                await page.evaluate((dist) => window.scrollBy(0, -dist), upDist);
                await randomDelay(1000, 2000);
            }

            // 2. Normal Scroll Down
            // Random scroll distance between 200 and 500
            const distance = Math.floor(Math.random() * (500 - 200 + 1) + 200);
            
            await page.evaluate((dist) => {
                window.scrollBy(0, dist);
            }, distance);
            
            scrolls++;
            
            // 3. Random Long Pause (Noise) - 5% chance
            if (Math.random() < 0.05) {
                console.log('[Noise] User distraction... pausing for 10s+');
                await randomDelay(10000, 15000);
            } else {
                // Normal pause between scrolls (500ms to 1500ms)
                const pause = Math.floor(Math.random() * (1500 - 500 + 1) + 500);
                await new Promise(r => setTimeout(r, pause));
            }
            
            // Check if we reached the bottom (height didn't change for a few scrolls)
            const newHeight = await page.evaluate('document.body.scrollHeight');
            if (newHeight === previousHeight && scrolls > 5) {
                // Try one big scroll to see if it triggers load
                 await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
                 await new Promise(r => setTimeout(r, 2000));
                 const checkHeight = await page.evaluate('document.body.scrollHeight');
                 if (checkHeight === newHeight) {
                     console.log('Reached bottom of page or no more content loading.');
                     break;
                 }
            }
            previousHeight = newHeight;
        }
    } catch (e) {
        console.log('Auto-scroll error:', e.message);
    }
}

// --- Translation Function ---
async function translateText(text, context = 'general', extraInfo = '', targetModel = MODEL_12B, backupModel = MODEL_4B) {
    if (!text || !text.trim()) return '';
    // Skip if already looks Arabic (basic check)
    if (/[\u0600-\u06FF]/.test(text) && text.length > text.length * 0.5) return text;

    let systemContent = `You are a professional translator. Translate the following product text from Chinese/English to Arabic. 
                    
    CRITICAL RULES:
    1. Return ONLY the Arabic translation, no explanations.
    2. If the text is a brand name or technical term (e.g., "mAh", "V", "W", "kg", "g", "mm", "cm"), keep it in English. NEVER translate "mAh" as "متر مكعب".
    3. REMOVE all marketing promises, guarantees, and return policies (e.g., "free use 30 days", "10 years guarantee", "7 days return", "official warranty"). DO NOT include these in the translation.
    4. DO NOT include any delivery promises, shipping times, or dates (e.g., "Delivered in 48 hours", "2024", "Fast Shipping"). REMOVE these phrases completely.`;

    if (context === 'product_name') {
        systemContent = `You are a professional translator for the Iraqi market. 
        Your task is to translate the following product name to Arabic.

        INPUT:
        "${text}"

        RULES:
        1. Translate the product name to simple, clear Arabic.
        2. DO NOT use flowery or overly formal language (avoid "literary" translation).
        3. Keep Brand Names and Model Numbers in English (e.g., "Midea", "Xiaomi").
        4. STRICTLY AVOID REPETITION.
        5. Return ONLY the Arabic name. No explanations.`;
    } else if (context === 'option') {
        systemContent = `Translate this product variant/option name to descriptive Arabic.
        - "2件套" -> "طقم قطعتين"
        - "黑色" -> "أسود"
        - "至尊款：全屋净化恒湿【澎湃丰盈大雾】" -> "الإصدار الفاخر: تنقية وترطيب كامل المنزل [ضباب كثيف]"
        
        CRITICAL RULES:
        1. Return ONLY the translation. NO extra text, no layout fragments (like "a", "b", "c").
        2. Ensure you translate the full meaning, including technical specs or features mentioned in brackets.
        3. DO NOT split words or translate single layout letters.
        4. If the text is a single non-meaningful character or layout fragment, return an empty string.
        5. Keep numbers and units (mAh, V, W, kg, etc.) in English. NEVER translate "mAh" as "متر مكعب".
        6. REMOVE all marketing phrases, guarantees, and return policies (e.g., "free use 30 days", "10 years warranty", "returns allowed").
        7. MANDATORY: The output MUST be in Arabic. DO NOT leave any Chinese characters in the output.
        8. REMOVE any Russian/Cyrillic characters.
        9. If the text is garbage/random characters, return an empty string.`;
    }

    const tryTranslate = async (model) => {
        let attempts = context === 'option' ? 3 : 1;
        let lastError;

        for (let i = 0; i < attempts; i++) {
            try {
                const response = await openai.chat.completions.create({
                    model: model,
                    messages: [
                        {
                            role: "system",
                            content: systemContent
                        },
                        {
                            role: "user",
                            content: text
                        }
                    ],
                    temperature: 0.3,
                    max_tokens: 1000
                });
                let content = response.choices[0].message.content.trim();
                content = content.replace(/```/g, ''); // Remove code blocks markers
                
                // Cleanup: Remove explanations if the model ignores the "ONLY" rule
                const explanationMarkers = ['---', '**Explanation', '**Rationale', 'Note:', 'Explanation:'];
                for (const marker of explanationMarkers) {
                    if (content.includes(marker)) {
                        content = content.split(marker)[0].trim();
                    }
                }
                
                if (content.includes('\n')) {
                     const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
                     if (lines.length > 0) {
                         content = lines[0];
                     }
                }

                content = content.replace(/[\u0400-\u04FF\u0500-\u052F]/g, '').trim();
                content = content.replace(/^[-/]+|[-/]+$/g, '').trim();
                let finalContent = content.replace(/^["']|["']$/g, '').trim();

                // If context is 'option', verify no Chinese remains
                if (context === 'option' && /[\u4e00-\u9fa5]/.test(finalContent)) {
                    console.warn(`[AI] Attempt ${i+1} for option translation still contains Chinese: ${finalContent}. Retrying...`);
                    continue; 
                }

                return finalContent;
            } catch (e) {
                console.error(`AI Error in tryTranslate (${model}) attempt ${i+1}:`, e.message);
                lastError = e;
            }
        }
        throw lastError || new Error("Translation failed after multiple attempts");
    };

    try {
        return await tryTranslate(targetModel);
    } catch (error) {
        console.warn(`Translation failed with ${targetModel}, trying backup ${backupModel}...`);
        try {
            return await tryTranslate(backupModel);
        } catch (backupError) {
            console.error('Translation error (both models failed):', backupError.message);
            // For reviews, it's okay to return original text if translation fails
            if (context === 'review') {
                return text;
            }
            // For other contexts (like options), if it's still Chinese, we've tried our best but failed
            return text; 
        }
    }
}

// --- Batch Translation Function ---
async function batchTranslate(texts, context = 'option', targetModel = MODEL_12B, backupModel = MODEL_4B) {
    if (!texts || texts.length === 0) return [];
    
    // Filter out empty or already Arabic strings to save tokens
    const needsTranslation = texts.map((text, index) => ({
        text: text || '',
        index,
        skip: !text || !text.trim() || (/[\u0600-\u06FF]/.test(text) && text.length > text.length * 0.5)
    }));

    const toTranslate = needsTranslation.filter(item => !item.skip);
    if (toTranslate.length === 0) return texts;

    const systemContent = context === 'option' 
        ? `Translate these product variant/option names to descriptive Arabic.
           Return a JSON object with a key "translations" containing an array of strings in the same order.
           - Return ONLY the JSON object.
           - Ensure you translate the full meaning, including technical specs or features mentioned in brackets.
           - "黑色" -> "أسود"
           - "至尊款：全屋净化恒湿【澎湃丰盈大雾】" -> "الإصدار الفاخر: تنقية وترطيب كامل المنزل [ضباب كثيف]"
           - DO NOT translate or return layout fragments (like "a", "b", "c" or Arabic equivalents).
           - DO NOT split words or translate single layout letters.
           - DO NOT return individual Arabic letters like "ا", "ل", "س" as separate options.
           - If an option is a single non-meaningful character, return an empty string for it.
           - Keep brand names and technical units (mAh, V, W, kg, etc.) in English. NEVER translate "mAh" as "متر مكعب".
           - REMOVE all marketing promises, guarantees, and return policies (e.g., "30 days free use", "10 years guarantee", "return policy").
           - REMOVE delivery promises or dates.
           - MANDATORY: All translations MUST be in Arabic. DO NOT leave any Chinese characters in the JSON values.`
        : `Translate these product reviews to natural Iraqi Arabic.
           Return a JSON object with a key "translations" containing an array of strings in the same order.
           - Return ONLY the JSON object.`;

    const tryBatch = async (model) => {
        let attempts = context === 'option' ? 3 : 1;
        let lastError;

        for (let i = 0; i < attempts; i++) {
            try {
                console.log(`[AI] Sending batch request (${model}) attempt ${i+1} with ${toTranslate.length} items...`);
                
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('AI Request Timeout (Manual)')), 110000)
                );

                const responsePromise = openai.chat.completions.create({
                    model: model,
                    messages: [
                        { role: "system", content: systemContent },
                        { role: "user", content: JSON.stringify(toTranslate.map(item => item.text)) }
                    ],
                    response_format: { type: "json_object" },
                    temperature: 0.3
                });

                const response = await Promise.race([responsePromise, timeoutPromise]);

                let content = response.choices[0].message.content.trim();
                let results;
                try {
                    const parsed = JSON.parse(content);
                    results = parsed.translations || (Array.isArray(parsed) ? parsed : Object.values(parsed)[0]);
                } catch (e) {
                    console.warn(`[AI] Failed to parse JSON response: ${e.message}`);
                    results = content.split('\n').map(l => l.replace(/^[0-9.-]+\s*/, '').trim());
                }
                
                if (results && Array.isArray(results)) {
                    // Check if any options still contain Chinese
                    if (context === 'option') {
                        const stillHasChinese = results.some(r => r && /[\u4e00-\u9fa5]/.test(r));
                        if (stillHasChinese) {
                            console.warn(`[AI] Batch translation attempt ${i+1} still contains Chinese. Retrying...`);
                            continue;
                        }
                    }
                    console.log(`[AI] Successfully extracted ${results.length} translations.`);
                    return results;
                } else {
                    console.warn(`[AI] Extracted results is not an array:`, results);
                    continue;
                }
            } catch (e) {
                console.error(`AI Error in tryBatch (${model}) attempt ${i+1}:`, e.message);
                lastError = e;
            }
        }
        throw lastError || new Error("Batch translation failed after multiple attempts");
    };

    try {
        const translatedValues = await tryBatch(targetModel);
        
    // Reconstruct the full array in original order
    const finalResults = [...texts];
    let translateIdx = 0;
    needsTranslation.forEach((item, i) => {
        if (!item.skip) {
            const translated = (translatedValues && translatedValues[translateIdx]) ? translatedValues[translateIdx] : item.text;
            finalResults[i] = (translated && translated.trim()) ? translated : item.text;
            translateIdx++;
        }
    });
    return finalResults;
    } catch (error) {
        console.warn(`Batch translation failed with ${targetModel}, trying backup ${backupModel}: ${error.message}`);
        try {
            const translatedValues = await tryBatch(backupModel);
            const finalResults = [...texts];
            let translateIdx = 0;
            needsTranslation.forEach((item, i) => {
                if (!item.skip) {
                    const translated = (translatedValues && translatedValues[translateIdx]) ? translatedValues[translateIdx] : item.text;
                    finalResults[i] = (translated && translated.trim()) ? translated : item.text;
                    translateIdx++;
                }
            });
            return finalResults;
        } catch (backupError) {
            console.warn(`Batch translation failed with backup as well, falling back to individual: ${backupError.message}`);
            // Individual fallback will also use the retry logic now
            return Promise.all(texts.map(t => translateText(t, context, '', targetModel, backupModel)));
        }
    }
}

// --- Description Formatter ---
async function formatDescriptionToKV(text) {
    if (!text || !text.trim()) return {};
    
    const prompt = `
    Analyze the following product description text and extract key-value pairs.
    Text: "${text}"
    
    Return a valid JSON object where keys are the attribute names (translated to Arabic) and values are the attribute values (translated to Arabic).
    
    CRITICAL RULES:
    1. Keep technical units (mAh, V, W, kg, etc.) in English. NEVER translate "mAh" as "متر مكعب".
    2. Translate general terms to clear Arabic.
    
    Example input: "Color: Red, Size: XL, Battery: 5000mAh"
    Example output: {"اللون": "أحمر", "المقاس": "XL", "البطارية": "5000mAh"}
    
    Return ONLY the raw JSON object.
    `;

    const tryFormat = async (model) => {
        const response = await openai.chat.completions.create({
            model: model,
            messages: [
                {
                    role: "system",
                    content: "You are an AI assistant that extracts structured data from text. Output valid JSON only."
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            temperature: 0.3,
            max_tokens: 1000
        });
        
        let content = response.choices[0].message.content.trim();
        if (content.startsWith('```json')) {
            content = content.replace(/^```json/, '').replace(/```$/, '');
        } else if (content.startsWith('```')) {
            content = content.replace(/^```/, '').replace(/```$/, '');
        }
        return JSON.parse(content);
    };

    try {
        return await tryFormat(MODEL_12B);
    } catch (error) {
        console.warn(`Description formatting failed with ${MODEL_12B}, trying backup ${MODEL_4B}...`);
        try {
            return await tryFormat(MODEL_4B);
        } catch (e) {
            console.error('Description formatting error:', e.message);
            // Fallback: return simple object with full text
            return { "وصف": text };
        }
    }
}

// --- AI Metadata Generation ---
async function generateAiMetadata(productName, description) {
    const prompt = `
    Analyze the following product (Name: "${productName}", Description: "${description}") and generate metadata in JSON format.
    The output must be a valid JSON object with the following structure:
    {
       "synonyms": ["synonym1", "synonym2", "synonym3"], 
       "market_tags": ["tag1", "tag2", "tag3"], 
       "category_suggestion": "category_name" 
    }
    Generate 3-5 synonyms in Arabic, 3-5 market tags in Arabic, and 1 category suggestion in Arabic.
    Return ONLY the raw JSON object, no markdown, no code blocks.
    `;

    const tryGenerate = async (model) => {
        const response = await openai.chat.completions.create({
            model: model,
            messages: [
                {
                    role: "system",
                    content: "You are an AI assistant that analyzes products and generates metadata in JSON format. Output valid JSON only."
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            temperature: 0.5,
            max_tokens: 500
        });
        
        let content = response.choices[0].message.content.trim();
        // Strip markdown code blocks if present
        if (content.startsWith('```json')) {
            content = content.replace(/^```json/, '').replace(/```$/, '');
        } else if (content.startsWith('```')) {
            content = content.replace(/^```/, '').replace(/```$/, '');
        }
        return JSON.parse(content);
    };

    try {
        // console.log(`Generating metadata with ${MODEL_12B}...`);
        return await tryGenerate(MODEL_12B);
    } catch (error) {
        console.warn(`Metadata generation failed with ${MODEL_12B}, trying backup ${MODEL_4B}...`);
        try {
            return await tryGenerate(MODEL_4B);
        } catch (backupError) {
            console.error('Metadata generation error:', backupError.message);
            return {}; // Return empty object on failure
        }
    }
}

// --- Check if Edible ---
function isEdible(text) {
    if (!text) return false;
    const lower = text.toLowerCase();
    
    // Check strict list first
    for (const kw of STRICT_EDIBLE_KEYWORDS) {
        if (lower.includes(kw)) return true;
    }
    
    // Check general list (maybe require word boundaries or combination?)
    // For now, simple inclusion
    for (const kw of EDIBLE_KEYWORDS) {
        if (lower.includes(kw)) return true;
    }
    return false;
}

// --- URL Helpers (Global Scope) ---
const getGoodsIdFromUrl = (url) => {
    if (!url) return null;
    try {
        const parsed = new URL(String(url));
        const goodsId = parsed.searchParams.get('goods_id');
        if (!goodsId) return null;
        return { goodsId, parsed };
    } catch (e) {
        return null;
    }
};

const normalizeProductUrl = (url) => {
    const info = getGoodsIdFromUrl(url);
    if (!info) return url || null;
    const { goodsId, parsed } = info;
    if (parsed.hostname === 'm.pinduoduo.com' && parsed.pathname.startsWith('/home')) {
        return `https://mobile.pinduoduo.com/goods.html?goods_id=${goodsId}`;
    }
    return String(url);
};

const isProductUrl = (url) => {
    const info = getGoodsIdFromUrl(url);
    if (!info) return false;
    const { parsed } = info;
    const path = parsed.pathname || '';
    if (parsed.hostname === 'm.pinduoduo.com' && path.startsWith('/home')) return true;
    if (path.includes('goods.html') || path.includes('goods_detail')) return true;
    if (path.includes('/goods')) return true;
    return false;
};

// --- Database Insertion (Aligned with pinduoduo-scraper2.js) ---
async function saveProductToDb(productData) {
    try {
        // 0. Clean Data (Remove skuId globally first)
        if (productData.generated_options && Array.isArray(productData.generated_options)) {
            productData.generated_options = productData.generated_options.map(opt => {
                const { skuId, ...rest } = opt;
                return rest;
            });
        }

        // 2. Save to Database (Prisma)
        console.log('Checking database for existing product...');
        
        // Ensure productData.url is present before querying
        if (!productData.url) {
            console.error('Save Error: productData.url is missing. Cannot check for duplicates.');
            return;
        }

        let existingProduct = null;
        try {
            existingProduct = await prisma.product.findFirst({
                where: { purchaseUrl: productData.url }
            });
        } catch (dbErr) {
            console.error(`\n❌ Database Query Error (findFirst): ${dbErr.message}`);
            
            if (dbErr.message.includes('allow_list')) {
                console.error('\n⚠️ SUPABASE CONNECTION BLOCKED!');
                console.error('The scraper is running from an IP address not allowed by your Supabase project.');
                console.error('To fix this:');
                console.error('1. Go to Supabase Dashboard -> Settings -> Database');
                console.error('2. Scroll to "Network Restrictions"');
                console.error('3. Add your current IP address (or allow all IPs for testing).');
                console.error('4. Alternatively, use a local database or run the scraper on Render.\n');
            }
            
            throw dbErr; // Rethrow to stop the scraper gracefully
        }

        if (existingProduct) {
            console.log(`Skipping duplicate in DB (ID: ${existingProduct.id})`);
            return;
        }

        console.log('Inserting into database...');

        // --- PROCESSING OPTIONS (Aligned with scraper2) ---
        // Filter out Chinese characters from options
        const containsChinese = (str) => /[\u4e00-\u9fa5]/.test(str);
        
        // 1. Filter & Deduplicate
        const seenOptionTexts = new Set();
        let validOptions = (productData.generated_options || []).filter(opt => {
            const text = (opt.color || '') + ' ' + (opt.sizes ? opt.sizes.join(' ') : '');
            
            // Check Duplicates (based on raw text)
            const uniqueKey = text.trim();
            if (seenOptionTexts.has(uniqueKey)) {
                // console.log(`Skipping duplicate option from source: ${text}`);
                return false;
            }
            seenOptionTexts.add(uniqueKey);

            return true;
        });

        // Update the source data to reflect the filtered list (so the JSON in DB is also clean)
        productData.generated_options = validOptions;

        // 2. Process unique colors and sizes for DB structure
        const colors = new Map(); // value -> original
        const sizes = new Map();  // value -> original

        for (const opt of validOptions) {
            if (opt.color) {
                const colorValue = opt.color;
                if (!colors.has(colorValue)) colors.set(colorValue, opt.originalColor || colorValue);
            }

            if (opt.sizes && Array.isArray(opt.sizes)) {
                opt.sizes.forEach(s => {
                    const original = (s === opt.sizes[0] && opt.originalSize) ? opt.originalSize : s;
                    if (!sizes.has(s)) sizes.set(s, original);
                });
            }
        }

        // Prepare Data for DB
        const colorValues = Array.from(colors.keys());
        const originalColorValues = Array.from(colors.values());
        
        // Build Options Array for Prisma
        const optionsCreateData = [];
        if (colorValues.length > 0) {
            optionsCreateData.push({
                name: 'اللون',
                values: JSON.stringify(colorValues),
                originalValues: JSON.stringify(originalColorValues)
            });
        }
        // Add Size option if we ever extract sizes
        if (sizes.size > 0) {
            optionsCreateData.push({
                name: 'المقاس',
                values: JSON.stringify(Array.from(sizes.keys())),
                originalValues: JSON.stringify(Array.from(sizes.values()))
            });
        }

        // Helper function for profit calculation
        const calculateFinalPrice = (base) => {
            const price = Number(base) || 0;
            if (price <= 0) return 0;
            // Add 15% profit margin per user's request (scraper-only)
            const priceWithMargin = price * 1.15;
            const final = Math.ceil(priceWithMargin / 10) * 10;
            console.log(`[DEBUG] Price Calculation: Raw IQD ${price} -> +15% Margin = ${priceWithMargin.toFixed(1)} -> Final = ${final}`);
            return final;
        };

        // Build Variants Array for Prisma
        const variantsCreateData = [];
        const seenCombinations = new Set();

        for (const opt of validOptions) {
             const color = opt.color;
             const variantImg = opt.thumbnail || productData.main_images[0] || '';
             
             let variantPrice = parseFloat(opt.price) || parseFloat(productData.general_price) || 0;
             const variantCny = opt.cnyPrice || 0;
             
             if (opt.sizes && Array.isArray(opt.sizes) && opt.sizes.length > 0) {
                 for (const size of opt.sizes) {
                     const comboKey = `${color}|${size}`;
                     if (seenCombinations.has(comboKey)) continue;
                     seenCombinations.add(comboKey);

                     const finalIqd = calculateFinalPrice(variantPrice);
                     console.log(`[DEBUG] Variant: "${color}" - "${size}" | CNY: ${variantCny} -> IQD (Converted + 15%): ${finalIqd}`);

                     variantsCreateData.push({
                        combination: JSON.stringify({ "اللون": color, "المقاس": size }),
                        price: finalIqd,
                        basePriceIQD: variantPrice,
                        image: variantImg,
                        weight: 0,
                        height: 0,
                        length: 0,
                        width: 0,
                        isPriceCombined: false
                     });
                 }
             } else {
                 const comboKey = `${color}`;
                 if (seenCombinations.has(comboKey)) continue;
                 seenCombinations.add(comboKey);

                 const finalIqd = calculateFinalPrice(variantPrice);
                 console.log(`[DEBUG] Variant: "${color}" | CNY: ${variantCny} -> IQD (Converted + 15%): ${finalIqd}`);

                 variantsCreateData.push({
                    combination: JSON.stringify({ "اللون": color }),
                    price: finalIqd,
                    basePriceIQD: variantPrice,
                    image: variantImg,
                    weight: 0,
                    height: 0,
                    length: 0,
                    width: 0,
                    isPriceCombined: false
                 });
             }
        }

        // Create Product
        let newProduct;
        try {
            newProduct = await prisma.product.create({
                data: {
                    name: productData.product_name,
                    price: calculateFinalPrice(productData.general_price),
                    basePriceIQD: parseFloat(productData.general_price) || 0,
                    image: productData.main_images && productData.main_images.length > 0 ? productData.main_images[0] : '',
                    purchaseUrl: productData.url,
                    specs: JSON.stringify(productData.product_details),
                    aiMetadata: productData.aiMetadata || {},
                    scrapedReviews: productData.scrapedReviews ? productData.scrapedReviews.map(rev => ({
                        name: rev.name,
                        photos: rev.photos || [],
                        comment: rev.comment
                    })) : [],
                    generated_options: productData.generated_options || [], // Store full options JSON
                    isAirRestricted: false,
                    isActive: true,
                    status: 'PUBLISHED',
                    
                    // Create Options inline
                    options: {
                        create: optionsCreateData
                    },
                    // Create Variants inline
                    variants: {
                        create: variantsCreateData
                    }
                }
            });
            console.log(`Product created: ID ${newProduct.id}`);
        } catch (createErr) {
            console.error(`\n❌ Database Creation Error: ${createErr.message}`);
            if (createErr.message.includes('allow_list')) {
                console.error('⚠️ Supabase IP Blocked (Product Creation). Scraper cannot save to DB.');
                throw createErr;
            }
            return; // Fail on this product
        }

        // Create Product Images (Gallery)
        if (newProduct && productData.main_images && productData.main_images.length > 0) {
            try {
                await prisma.productImage.createMany({
                    data: productData.main_images.map((url, i) => ({
                        productId: newProduct.id,
                        url: url,
                        order: i,
                        type: "GALLERY"
                    }))
                });
            } catch (imgErr) {
                console.error(`\n❌ Error creating product images: ${imgErr.message}`);
                // Don't throw here, the product is already created
            }
        }

        // Create Description Images
        if (productData.product_desc_imgs && productData.product_desc_imgs.length > 0) {
            await prisma.productImage.createMany({
                data: productData.product_desc_imgs.map((url, i) => ({
                    productId: newProduct.id,
                    url: url,
                    order: i + 100,
                    type: "DESCRIPTION"
                }))
            });
        }

        console.log(`✅ Successfully inserted into DB! Product ID: ${newProduct.id}`);

        // Trigger embedding generation (Non-blocking as requested to avoid scraper delay)
        generateEmbedding(newProduct.id).catch(err => {
            console.error(`Background embedding generation error for product ${newProduct.id}:`, err.message);
        });

    } catch (e) {
        console.error('Save Error:', e.message);
    }
}

// Cookie Management
const COOKIES_DIR = path.join(__dirname, '..', 'cookies');
let currentCookieFile = null;

// Ensure cookies directory exists
if (!fs.existsSync(COOKIES_DIR)) {
    fs.mkdirSync(COOKIES_DIR, { recursive: true });
}

function getRandomCookieFile() {
    try {
        const files = fs.readdirSync(COOKIES_DIR).filter(f => f.endsWith('.json'));
        if (files.length === 0) return null;
        const randomFile = files[Math.floor(Math.random() * files.length)];
        return path.join(COOKIES_DIR, randomFile);
    } catch (e) {
        console.error('Error reading cookies directory:', e.message);
        return null;
    }
}

async function saveCookies(page) {
    if (!currentCookieFile) return;
    try {
        const cookies = await page.cookies();
        fs.writeFileSync(currentCookieFile, JSON.stringify(cookies, null, 2));
        // console.log(`Cookies saved to ${path.basename(currentCookieFile)}`);
    } catch (e) {
        console.error('Failed to save cookies:', e.message);
    }
}

async function loadCookies(page) {
    // Clear current cookies first to ensure a clean slate for the new account
    try {
        const client = await page.target().createCDPSession();
        await client.send('Network.clearBrowserCookies');
        // console.log('Cleared existing cookies.');
    } catch (e) {
        console.error('Failed to clear existing cookies:', e.message);
    }

    currentCookieFile = getRandomCookieFile();
    if (currentCookieFile && fs.existsSync(currentCookieFile)) {
        try {
            const cookies = JSON.parse(fs.readFileSync(currentCookieFile));
            await page.setCookie(...cookies);
            console.log(`[COOKIE-ROTATION] Loaded ${cookies.length} cookies from ${path.basename(currentCookieFile)}.`);
        } catch (e) {
            console.error('Failed to load cookies:', e.message);
        }
    } else {
        console.log('No cookie files found in server/cookies/. Proceeding without cookies.');
    }
}

async function rotateCookies(page) {
    console.log('\n🔄 [COOKIE-ROTATION] Rotating cookies due to 403/424 or Captcha...');
    await loadCookies(page);
    hasPageError = false; // Reset the flag
    
    // After rotation, try to navigate back to the target URL
    console.log('🔄 [COOKIE-ROTATION] Navigating back to target URL...');
    await page.evaluate((url) => window.location.href = url, CATEGORY_URL);
    await randomDelay(5000, 10000); // Wait for load
}

// Browser Creation
async function createBrowser(useGuest = false, initialUrl = null) {
    const executablePath = getExecutablePath();
    const userDataDir = process.env.PDD_USER_DATA_DIR || path.join(os.homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'User Data');
    const debugPort = 9222;
    // const useGuest = process.env.PDD_GUEST === '1'; // Removed duplicate declaration

    // 0. Try to CONNECT to an existing browser first (The "Connect-or-Launch" Pattern)
    // Skip connection attempt if we strictly want a Guest (incognito-like) session
    if (!useGuest) {
        try {
            console.log(`Trying to connect to existing Chrome on port ${debugPort}...`);
            const browser = await puppeteer.connect({
                browserURL: `http://127.0.0.1:${debugPort}`,
                defaultViewport: null
            });
            console.log('✅ Successfully connected to existing Chrome instance!');
            return browser;
        } catch (e) {
            console.log('Could not connect to existing instance (it might be closed or not running with debug port). Launching new one...');
        }
    }

    // Check if Chrome is running and locked - STRICT CLEAN SLATE PROTOCOL
    // DISABLED: User explicitly requested to remove aggressive kill checks
    /* 
    if (process.env.PDD_AUTO_KILL_CHROME === '1') {
        console.log('🛡️ Initiating Strict Clean Slate Protocol (PDD_AUTO_KILL_CHROME=1)...');
        // ... (existing commented out code) ...
    }
    */
    
    // SMART CLEANUP: If no Chrome process is running, but lock file exists, delete it.
    try {
        const { stdout } = await exec('tasklist /FI "IMAGENAME eq chrome.exe" /FO CSV /NH');
        const isRunning = stdout.includes('chrome.exe');
        
        if (!isRunning) {
            const lockFile = path.join(userDataDir, 'SingletonLock');
            if (fs.existsSync(lockFile)) {
                console.log('⚠️ No Chrome process running, but "SingletonLock" found. Deleting stale lock file...');
                try { fs.unlinkSync(lockFile); } catch(e) {}
            }
        }
    } catch (e) {
        // Ignore errors checking process list (e.g. permission issues)
    }

    // 3. Detect Best Profile (if not specified)
    let profileDir = process.env.PDD_PROFILE_DIR;
    
    // User Override: If user specifically asked for "Profile 3" (or any other), prioritize that.
    // In this case, we hardcode "Profile 3" as a fallback if env var isn't set, per user request.
    if (!profileDir) {
        // console.log('No PDD_PROFILE_DIR set. Defaulting to "Profile 3" as requested.');
        profileDir = 'Profile 3'; 
    }

    if (!profileDir && false) { // Disable auto-detection for now since user wants specific profile
        try {
            console.log('Detecting best profile (largest History file)...');
            const localStatePath = path.join(userDataDir, 'Local State');
            if (fs.existsSync(localStatePath)) {
                const stateData = JSON.parse(fs.readFileSync(localStatePath, 'utf8'));
                const profiles = stateData.profile.info_cache || {};
                
                let bestProfile = 'Default';
                let maxSize = -1;
                
                for (const pName of Object.keys(profiles)) {
                    const historyPath = path.join(userDataDir, pName, 'History');
                    try {
                        if (fs.existsSync(historyPath)) {
                            const stats = fs.statSync(historyPath);
                            if (stats.size > maxSize) {
                                maxSize = stats.size;
                                bestProfile = pName;
                            }
                        }
                    } catch(e) {}
                }
                
                if (maxSize > 0) {
                    console.log(`Auto-selected profile: "${bestProfile}" (History size: ${(maxSize/1024/1024).toFixed(2)} MB)`);
                    profileDir = bestProfile;
                } else {
                    console.log('Could not determine best profile by History size. Defaulting to "Default".');
                    profileDir = 'Default';
                }
            }
        } catch (e) {
            console.warn('Profile detection failed:', e.message);
            profileDir = 'Default';
        }
    }

    // const useGuest = process.env.PDD_GUEST === '1'; // Removed duplicate declaration
    
    const args = [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-infobars',
        '--window-position=0,0',
        '--ignore-certificate-errors',
        '--ignore-certificate-errors-spki-list',
        '--disable-blink-features=AutomationControlled', // Critical for anti-detection
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36',
        '--lang=zh-CN,zh',
        `--remote-debugging-port=${debugPort}`, // Enable Debug Port for future connections
        '--proxy-server=http://192.168.2.150:7890' // Use local VPN/Proxy
    ];
    
    console.log('Using Proxy: http://192.168.2.150:7890');
    
    // Immediate Navigation: Add URL to args
    if (initialUrl) {
        args.push(initialUrl);
    }

    if (useGuest) {
        args.push('--guest');
        console.log('Launching in GUEST mode (no profile).');
    } else {
        console.log(`Launching with User Data Dir: ${userDataDir}`);
        // Puppeteer adds --user-data-dir automatically if userDataDir option is set
        // But we explicitly add it here just in case we need to ensure it matches
        // Actually, Puppeteer's default behavior is robust. 
        // We will rely on Puppeteer's userDataDir option mostly, but let's keep it clean.
        
        console.log(`Using Profile Directory: ${profileDir}`);
        args.push(`--profile-directory=${profileDir}`);
    }

    try {
        return await puppeteer.launch({
            executablePath,
            headless: false,
            defaultViewport: null,
            protocolTimeout: 600000,
            userDataDir: useGuest ? undefined : userDataDir,
            args: args
        });
    } catch (e) {
        // IGNORE "already running" error and try to connect
        // This handles cases where Puppeteer thinks the process failed but it actually launched
        // or when it conflicts with an existing process but we can still connect.
        if (e.message.includes('user data directory is already in use') || e.message.includes('already running') || e.code === 0) {
            console.log('⚠️ Puppeteer detected "Already Running" error. Assuming browser is active and trying to connect...');
            
            // Retry connecting multiple times (wait for browser to be ready)
            for (let attempt = 1; attempt <= 5; attempt++) {
                console.log(`   Connection Attempt ${attempt}/5...`);
                await randomDelay(2000, 5000); // Wait 2s between attempts
                
                try {
                    const browser = await puppeteer.connect({
                        browserURL: `http://127.0.0.1:${debugPort}`,
                        defaultViewport: null
                    });
                    console.log('✅ Successfully connected to the running instance (after ignoring launch error)!');
                    return browser;
                } catch (connErr) {
                    // console.log(`   Attempt ${attempt} failed: ${connErr.message}`);
                }
            }
            
            console.error('❌ Failed to connect to the browser after multiple attempts.');
            
            // Last Resort: If we can't connect, maybe it's a stale lock file and no browser is running.
            // Check process list again, if no chrome.exe, delete lock and RETRY LAUNCH.
            try {
                const { stdout } = await exec('tasklist /FI "IMAGENAME eq chrome.exe" /FO CSV /NH');
                if (!stdout.includes('chrome.exe')) {
                     console.log('⚠️ No Chrome process found running. This might be a stale SingletonLock.');
                     console.log('🗑️ Deleting SingletonLock and Retrying Launch...');
                     
                     // Delete known lock files
                     const lockFiles = ['SingletonLock', 'SingletonCookie', 'SingletonSocket'];
                     for (const file of lockFiles) {
                        const lockPath = path.join(userDataDir, file);
                        if (fs.existsSync(lockPath)) {
                            try { fs.unlinkSync(lockPath); } catch(e) {}
                        }
                     }
                     
                     // Recursive retry (one level deep ideally, but here just launch)
                     return await puppeteer.launch({
                        executablePath,
                        headless: false,
                        defaultViewport: null,
                        protocolTimeout: 600000,
                        userDataDir: useGuest ? undefined : userDataDir,
                        args: args
                    });
                }
            } catch (retryErr) {
                console.error('Last resort retry failed:', retryErr.message);
            }

            console.error('   This usually means the browser is running but NOT with "--remote-debugging-port=9222".');
            console.error('   Please CLOSE all Chrome windows manually and try running the script again.');
        }
        throw e;
    }
}

// Scrape Single Product
async function scrapeProduct(page, url) {
    console.log(`Analyzing product page: ${url}`);
    
    // --- DUPLICATE CHECK (User Request) ---
    // Check if product is already scraped BEFORE starting the heavy scraping process
    const goodsInfo = getGoodsIdFromUrl(url);
    if (goodsInfo && goodsInfo.goodsId) {
        try {
            const existing = await prisma.product.findFirst({
                where: {
                    purchaseUrl: {
                        contains: `goods_id=${goodsInfo.goodsId}`
                    }
                },
                select: { id: true }
            });

            if (existing) {
                console.log(`[Duplicate Check] Product with goods_id ${goodsInfo.goodsId} already exists in DB (ID: ${existing.id}). Skipping scrape.`);
                return null; // Caller will handle this by navigating back
            }
        } catch (dbErr) {
            console.warn(`[Duplicate Check] DB Error checking for duplicate: ${dbErr.message}`);
            if (dbErr.message.includes('allow_list')) {
                console.error('⚠️ Supabase IP Blocked (Duplicate Check). Scraper cannot query DB.');
                throw dbErr; // Stop if blocked
            }
            console.log('Proceeding with scrape anyway (DB might be temporary down)...');
        }
    }

    try {
        // 1. Initial "Reading" Pause
        console.log('Simulating human reading...');
        await randomDelay(1000, 3000);

        // 2. Extract Basic Info (Name, Images, Description)
        const basicData = await page.evaluate(() => {
            const getText = (sel) => {
                const el = document.querySelector(sel);
                return el ? el.innerText.trim() : '';
            };
            const getSrc = (sel) => document.querySelector(sel)?.src || '';
            const getAllSrc = (sel) => Array.from(document.querySelectorAll(sel)).map(img => img.src).filter(src => src);

            // Strict Name Extraction from .tLYIg_Ju inside .Vrv3bF_E (if possible) or just .tLYIg_Ju
            // User requested: "translate it based on the name in that span class only(tLYIg_Ju enable-select)"
            // "this span class is inside this span class (Vrv3bF_E)"
            let product_name = '';
            const parentSpan = document.querySelector('.Vrv3bF_E');
            if (parentSpan) {
                const targetSpan = parentSpan.querySelector('.tLYIg_Ju');
                if (targetSpan) {
                    product_name = targetSpan.innerText.trim();
                }
            }
            
            // Fallback to direct selector if parent not found
            if (!product_name) {
                product_name = getText('.tLYIg_Ju');
            }
            
            console.log('[DEBUG] RAW EXTRACTED NAME:', product_name);
            
            // Improved Image Extraction Strategy
            let main_images = [];
            const seenImages = new Set();

            const addImage = (src) => {
                if (!src || !src.startsWith('http')) return;
                // Clean URL
                let cleanSrc = src.split('?')[0];
                if (seenImages.has(cleanSrc)) return;
                
                // Filter out icons/avatars
                if (cleanSrc.includes('avatar') || cleanSrc.includes('icon') || cleanSrc.includes('coupon') || cleanSrc.includes('video-snapshot')) return;

                seenImages.add(cleanSrc);
                main_images.push(cleanSrc);
            };

            // Strategy 0: Priority UniqID (Highest Priority - User Request)
            // Look for .PPuOGFfM with data-uniqid, sort by ID (1, 2, 3...)
            const uniqIdImages = [];
            const uniqIdElements = document.querySelectorAll('.PPuOGFfM');
            
            uniqIdElements.forEach(el => {
                const uniqId = el.getAttribute('data-uniqid');
                if (uniqId) {
                     let imgSrc = '';
                     const imgEl = el.tagName === 'IMG' ? el : el.querySelector('img');
                     
                     if (imgEl) {
                         imgSrc = imgEl.src;
                         // Fallback to data-src if src is missing or base64
                         if (!imgSrc || imgSrc.startsWith('data:')) {
                             imgSrc = imgEl.getAttribute('data-src');
                         }
                     }
                     
                     if (imgSrc) {
                         const idNum = parseInt(uniqId, 10);
                         if (!isNaN(idNum)) {
                             uniqIdImages.push({ src: imgSrc, id: idNum });
                         }
                     }
                }
            });
            
            // Sort by ID ascending (1, 2, 3...) to ensure "1" (or lowest) comes first
            uniqIdImages.sort((a, b) => a.id - b.id);
            
            if (uniqIdImages.length > 0) {
                 uniqIdImages.forEach(item => addImage(item.src));
            }

            // Strategy 1: User's Selector (High Priority if present)
            // Try both nested img and direct img match
            const userImages = getAllSrc('.QFNLpbqP img');
            if (userImages.length > 0) {
                userImages.forEach(addImage);
            } else {
                 const userImagesDirect = getAllSrc('.QFNLpbqP');
                 userImagesDirect.forEach(addImage);
            }

            // Strategy 2: Common Slider Containers
            if (main_images.length === 0) {
                const sliderSelectors = [
                    '.goods-slider img',
                    '.swiper-slide img',
                    '.swiper-container img',
                    '.banner-slider img',
                    '.slick-slide img',
                    '#main > div > div:first-child img' // Often the first div is the slider
                ];
                const sliderImages = getAllSrc(sliderSelectors.join(', '));
                sliderImages.forEach(addImage);
            }

            // Strategy 3: Top-Area Large Images (Fallback)
            if (main_images.length === 0) {
                const allImgs = Array.from(document.querySelectorAll('img'));
                allImgs.forEach(img => {
                    const rect = img.getBoundingClientRect();
                    // Must be in top 60% of viewport and reasonably large
                    if (rect.top < window.innerHeight * 0.6 && img.naturalWidth > 300) {
                        if (img.naturalHeight > 0) {
                            const aspect = img.naturalWidth / img.naturalHeight;
                            // Avoid wide banners (> 2.2) or tall thin strips (< 0.4)
                            if (aspect > 2.2 || aspect < 0.4) return;
                        }
                        addImage(img.src);
                    }
                });
            }

            const descriptionText = getText('.jvsKAdEs');
            
            // Extract Main Page Price
            let mainPagePrice = 0;
            try {
                // Look for elements starting with currency symbol
                // We prioritize elements that look like the main price (usually large font, near top)
                // But simple traversal often works as main price is early in DOM or visually prominent
                const allElements = Array.from(document.querySelectorAll('span, div, p'));
                for (const el of allElements) {
                     // Check if leaf node (no children)
                     if (el.children.length === 0 && el.innerText) {
                         const txt = el.innerText.trim();
                         // Match "¥ 10.5" or "￥10.5" at start of string
                         const match = txt.match(/^(?:¥|￥)\s*(\d+(?:\.\d+)?)/);
                         if (match) {
                             const p = parseFloat(match[1]);
                             if (p > 0) {
                                 mainPagePrice = p;
                                 break; // First match is usually the main price
                             }
                         }
                     }
                }
            } catch (e) {}

            return {
                product_name,
                main_images,
                descriptionText,
                mainPagePrice
            };
        });

        console.log(`Scraped Basic Data: ${basicData.product_name ? basicData.product_name.substring(0, 20) : ''}...`);

        // 3. Interaction for Generated Options
        console.log('Starting Option Extraction Sequence...');
        
        // Get actual viewport dimensions from the browser
        const dimensions = await page.evaluate(() => {
            return {
                width: window.innerWidth,
                height: window.innerHeight
            };
        });
        
        const vw = dimensions.width;
        const vh = dimensions.height;
        console.log(`Detected Viewport: ${vw}x${vh}`);

        // Step 1: Click "Buy" / "Options" Button (Red Button)
        // Strategy: Try to find the element containing "发起拼单" (Group Buy) or "购买" (Buy) first.
        // If not found, use coordinate fallback (Adjusted to 85% width for the red button).
        
        console.log('Attempting to click Red Buy Button...');
        
        // Strategy: Force Geometric Click based on User Instruction
        // "okay from the bottom center, go 300px to the right and click"
        // Center X = 50% (0.5) + 300px
        
        // Humanize Coordinates: Center + (270 to 300)
        const xOffset = 270 + Math.random() * 30; // Random between 270 and 300
        const xTarget = (vw * 0.5) + xOffset;
        const yTarget = vh * (0.97 + Math.random() * 0.02); // 97% - 99% Height
        
        console.log(`[GEOMETRIC CLICK] Target: (${xTarget.toFixed(1)}, ${yTarget.toFixed(1)}) [Center + ~270-300px, ~98% H]`);
        
        // Method 1: Mouse Click
        await page.mouse.move(xTarget, yTarget);
        await page.mouse.down();
        await randomDelay(150, 250); // Slightly longer press
        await page.mouse.up();
        
        // Method 2: Touch Tap (Removed to avoid double-clicking)
        // try {
        //         if (page.touchscreen) {
        //             console.log('Attempting Touch Tap...');
        //             await page.touchscreen.tap(xTarget, yTarget);
        //         }
        // } catch(e) {}
        
        await randomDelay(3000, 6000);

        // Step 2: Click Thumbnail/Group Buy (Geometric: Center - 300px X, Center Y)
        // User requested change: 300px offset, 5px randomization, show dot
        const xBase = (vw * 0.5) - 300;
        const yBase = vh * 0.5;
        
        // Add 5px randomization (+/- 5px)
        const x2 = xBase + (Math.random() * 10 - 5);
        const y2 = yBase + (Math.random() * 10 - 5);
        
        console.log(`Clicking Thumbnail at (${x2.toFixed(1)}, ${y2.toFixed(1)}) [Center - 300px X, Center Y]...`);
        
        // Show visual indicator (Blue Dot for Thumbnail)
        await page.evaluate((x, y) => {
            const el = document.createElement('div');
            el.style.position = 'fixed';
            el.style.left = x + 'px';
            el.style.top = y + 'px';
            el.style.width = '20px';
            el.style.height = '20px';
            el.style.backgroundColor = 'blue';
            el.style.borderRadius = '50%';
            el.style.zIndex = '999999';
            el.style.pointerEvents = 'none';
            el.style.border = '2px solid white';
            document.body.appendChild(el);
            setTimeout(() => el.remove(), 2000);
        }, x2, y2);
        
        await page.mouse.move(x2, y2);
        await page.mouse.down();
        await randomDelay(100, 200);
        await page.mouse.up();
        console.log('Waiting 3 seconds after thumbnail click...');
        await randomDelay(3000, 6000);

        // Step 3: Extract Options from .TpUpcNRp
        const generated_options = await page.evaluate(() => {
            const options = [];
            // Target the specific UL provided by the user for reliability
            const container = document.querySelector('ul.IENSVgAB');
            const items = container ? container.querySelectorAll('li') : document.querySelectorAll('.TpUpcNRp');
            
            console.log('[AI-Scraper] Found ' + items.length + ' items with class .TpUpcNRp');
            items.forEach((item, index) => {
                // Image is inside .PQoZYCec
                let imgEl = item.querySelector('.PQoZYCec img');
                if (!imgEl) {
                    const el = item.querySelector('.PQoZYCec');
                    if (el && el.tagName === 'IMG') imgEl = el;
                }

                // Name is specifically in .U63Kdv8C
                const textEl = item.querySelector('.U63Kdv8C');
                // Price is specifically in .nvN5jV0G span
                const priceSpan = item.querySelector('.nvN5jV0G span') || item.querySelector('.nvN5jV0G');
                
                const thumbnail = imgEl ? imgEl.src : '';
                const rawText = textEl ? textEl.innerText.trim() : '';
                let price = 0;
                let cnyPrice = 0;
                let colorName = rawText;

                // 1. Extract Price (Prioritize .nvN5jV0G)
                if (priceSpan) {
                    const priceText = priceSpan.innerText.trim().replace(/[¥￥\s]/g, '');
                    const parsedPrice = parseFloat(priceText);
                    if (!isNaN(parsedPrice)) {
                        cnyPrice = parsedPrice;
                        // IQD Conversion: 200 IQD/CNY (Raw IQD, no profit margin yet)
                        const rawIqd = parsedPrice * 200;
                        price = rawIqd;
                        console.log(`[DEBUG-Browser] Extracted Option Price: CNY ${parsedPrice} -> Raw IQD ${rawIqd}`);
                    }
                }
                
                // Fallback Price Logic if first attempt failed
                if (price === 0) {
                    const priceElFallback = item.querySelector('.RITrraU3') || item.querySelector('.O8fR8K8O');
                    const rawPriceText = priceElFallback ? priceElFallback.innerText.trim() : rawText;

                    const priceRegex = /(?:¥|￥)\s*(\d+(?:\.\d+)?)/;
                    const priceMatch = rawPriceText.match(priceRegex);
                    
                    if (priceMatch) {
                         const rawCny = parseFloat(priceMatch[1]);
                         cnyPrice = rawCny;
                         // IQD Conversion: 200 IQD/CNY
                         const rawIqd = rawCny * 200;
                         price = rawIqd;
                         console.log(`[DEBUG-Browser] Extracted Fallback Price (Regex): CNY ${rawCny} -> Raw IQD ${rawIqd}`);
                    } else {
                        let cleanText = rawPriceText.replace(/已拼\s*[\d.]+\s*[万+]?件/g, ''); 
                        cleanText = cleanText.replace(/[\d.]+\s*sold/ig, '');
                        const allNumbers = cleanText.match(/[\d.]+/g);
                        if (allNumbers && allNumbers.length > 0) {
                            const rawCny = parseFloat(allNumbers[allNumbers.length - 1]);
                            cnyPrice = rawCny;
                            // IQD Conversion: 200 IQD/CNY
                            const rawIqd = rawCny * 200;
                            price = rawIqd;
                            console.log(`[DEBUG-Browser] Extracted Fallback Price (Numbers): CNY ${rawCny} -> Raw IQD ${rawIqd}`);
                        }
                    }
                }

                // 2. Clean Color Name
                // Remove "券后" and anything after it
                if (colorName.includes('券后')) {
                    colorName = colorName.split('券后')[0].trim();
                }

                // Remove the price from the end of the string if it exists
                colorName = colorName.replace(/[-]?\s*[\d.]+$/, '').trim();

                // Normalize spaces
                colorName = colorName.replace(/\s+/g, ' ').trim();

                // FILTER: Ignore options that are just single English letters or numbers or garbage
                // But ALLOW single Chinese characters like "白" (White), "黑" (Black)
                const hasChinese = /[\u4e00-\u9fa5]/.test(colorName);
                
                if (colorName.length <= 1 && !hasChinese) {
                    console.log(`[DEBUG] Skipping invalid non-Chinese short option: "${colorName}"`);
                    return;
                }
                
                // If it's a single Chinese character, it's likely a valid color (White, Black, etc.)
                // But if it's NO characters (empty), skip
                if (!colorName || colorName.length === 0) return;

                // DEDUPLICATE: Skip if this color name already exists in our list
                if (options.some(o => o.color === colorName)) {
                    console.log(`[DEBUG-Browser] Skipping duplicate option: "${colorName}"`);
                    return;
                }

                options.push({
                    color: colorName,
                    sizes: [],
                    price: price,
                    cnyPrice: cnyPrice,
                    thumbnail: thumbnail
                });
            });
            return options;
        });

        console.log(`✅ Collected ${generated_options.length} options`);
        
        // Step 4: Close Options (Tap Top Part)
        const xTop = vw * 0.5;
        const yTop = vh * 0.1; // Very top (10% height)
        console.log(`Closing options (Click 1 at ${xTop}, ${yTop})...`);
        await page.mouse.click(xTop, yTop);
        await randomDelay(2000, 5000);
        console.log(`Closing options (Click 2 at ${xTop}, ${yTop})...`);
        await page.mouse.click(xTop, yTop);
        await randomDelay(3000, 6000);

        // --- 5. REVIEWS SCRAPING ---
        let scrapedReviews = [];
        try {
            console.log('--- Starting Reviews Scraping Sequence ---');
            
            // 1. Click "商品评价" (Product Reviews)
            // Strategy: Try multiple selectors provided by user
            // Selectors: .VoYGP4Rl (original), .Oi_xBKes, .e9rzVEAe, .F2MXl7Xc, .IpR_6z4r
            const reviewSelectors = ['.VoYGP4Rl', '.Oi_xBKes', '.e9rzVEAe', '.F2MXl7Xc', '.IpR_6z4r'];
            let reviewsPageOpened = false;
            const preReviewsUrl = page.url(); // Capture current URL

            for (const selector of reviewSelectors) {
                if (reviewsPageOpened) break;

                try {
                    const reviewsBtn = await page.$(selector);
                    if (reviewsBtn) {
                        console.log(`Found reviews button candidate (${selector}). Clicking...`);
                        await reviewsBtn.click();
                        await randomDelay(3000, 6000); // Wait for reviews page to load
                        
                        // Verify Navigation: Check if URL changed or we are on a reviews-like page
                        const currentUrl = page.url();
                        const hasNavigated = currentUrl !== preReviewsUrl;
                        
                        if (hasNavigated || currentUrl.includes('comment') || currentUrl.includes('reviews')) {
                             console.log(`Navigated to reviews page using ${selector}. Proceeding with scraping...`);
                             reviewsPageOpened = true;
                        } else {
                            console.log(`⚠️ Clicked ${selector} but URL did not change. Trying next candidate...`);
                        }
                    }
                } catch (err) {
                    console.log(`Error attempting selector ${selector}: ${err.message}`);
                }
            }

            if (reviewsPageOpened) {
                // 2. Slow Scroll (Human-like slide) - 3 Screens
                console.log('Scrolling reviews page (Human-like slide)...');
                for (let i = 0; i < 3; i++) {
                    await page.evaluate(async () => {
                        const distance = window.innerHeight;
                        const steps = 30; // More steps, faster
                        const stepDistance = distance / steps;
                        for (let j = 0; j < steps; j++) {
                            window.scrollBy(0, stepDistance);
                            // 20-40ms delay for "slide" feel
                            await new Promise(resolve => setTimeout(resolve, 20 + Math.random() * 20)); 
                        }
                    });
                    await randomDelay(800, 1500); // Shorter pause between slides
                }
                
                // 3. Collect Reviews Data
                console.log('Extracting review data...');
                scrapedReviews = await page.evaluate(() => {
                    const reviews = [];
                    const reviewItems = document.querySelectorAll('.LFMbudEX'); // Review Container
                    
                    reviewItems.forEach(item => {
                        // User Name
                        const userEl = item.querySelector('.BQX0_Yxu');
                        const userName = userEl ? userEl.innerText.trim() : 'Anonymous';

                        // Review Text
                        const textEl = item.querySelector('.QznBag3Z');
                        const content = textEl ? textEl.innerText.trim() : '';

                        // SKU Info (What she bought)
                        const skuEl = item.querySelector('.qnRmJ_Uy');
                        const skuInfo = skuEl ? skuEl.innerText.trim() : '';

                        // Images
                        const imgEls = item.querySelectorAll('.db85mmgV img');
                        const images = [];
                        imgEls.forEach(img => {
                            if (img.src) images.push(img.src);
                        });

                        if (content || images.length > 0) {
                            reviews.push({
                                name: userName,
                                comment: content + (skuInfo ? ` (Option: ${skuInfo})` : ''),
                                photos: images,
                            });
                        }
                    });
                    return reviews;
                });
                console.log(`[DEBUG] Collected ${scrapedReviews.length} reviews.`);

                // 4. Go Back to Product Page
                console.log(`Going back to product page (looping goBack)...`);
                
                let backAttempts = 0;
                const maxBackAttempts = 2; // Reduced from 4 to 2 (Anti-Spam)
                let onProduct = false;

                while (backAttempts < maxBackAttempts) {
                    try {
                        console.log(`[Nav] Back Attempt ${backAttempts + 1}...`);
                        await page.goBack();
                        await randomDelay(2000, 3500);
                        
                        const currentUrl = page.url();
                        const onReviews = currentUrl.includes('comment') || currentUrl.includes('reviews');
                        // isProductUrl is available globally
                        onProduct = isProductUrl(currentUrl) && !onReviews;
                        
                        if (onProduct) {
                            console.log('[Nav] Successfully returned to product page via goBack().');
                            break;
                        } else {
                            console.log(`[Nav] Still on ${currentUrl} (Not Product).`);
                        }
                    } catch (e) {
                        console.log(`[Nav] goBack() error: ${e.message}`);
                    }
                    backAttempts++;
                }

                if (!onProduct) {
                     console.log(`[Nav] Failed to return via goBack. Forcing navigation to ${preReviewsUrl}...`);
                     try {
                        // Use location.href via evaluate to potentially avoid some puppeteer overhead, 
                        // but page.goto is standard. 
                        // If we force navigation, we accept we might have history stack issues, 
                        // but we tried our best to go back.
                        await page.goto(preReviewsUrl, { waitUntil: 'domcontentloaded' });
                        await randomDelay(3000, 5000);
                     } catch (e) {
                        console.log(`[Nav] Force navigation failed: ${e.message}`);
                     }
                }

            } else {
                console.log('Could not find any "商品评价" button or failed to navigate. Skipping reviews.');
            }

        } catch (err) {
            console.error('Error scraping reviews:', err.message);
            // Non-fatal, continue with product data
        }

        // --- 6. DESCRIPTION IMAGES SCRAPING ---
        let productDescImgs = [];
        try {
            console.log('--- Starting Description Images Scraping Sequence ---');
            await randomDelay(3000, 6000); // Wait 3 seconds after returning from reviews

            const currentUrlForDesc = page.url();
            console.log(`[DEBUG] Current URL for Desc Images: ${currentUrlForDesc}`);

            // Safety Check: Must contain 'goods' or 'product' AND NOT be a category/search page
            // Allow 'search_result' in URL if it's part of query params (e.g. refer_page_name) and we have goods_id
            const isProductPage = (currentUrlForDesc.includes('goods') || currentUrlForDesc.includes('product')) 
                                  && !currentUrlForDesc.includes('classification') 
                                  && (!currentUrlForDesc.includes('search_result') || currentUrlForDesc.includes('goods_id'));

            if (!isProductPage) {
                 console.warn(`⚠️ Warning: It seems we are NOT on a product page (URL: ${currentUrlForDesc}). Skipping description images.`);
            } else {
            // 1. Check for description container existence (without scrolling loop)
            // User requested to remove the initial "search scroll" and rely on the lazy scroll sequence.
            let foundDescContainer = await page.evaluate(() => {
                return !!(document.querySelector('.mP10ZXCw') || document.querySelector('.UhNRiWLO'));
            });

            if (!foundDescContainer) {
                 console.log('Description container not found in DOM immediately.');
            }

            if (foundDescContainer) {
                console.log('Found description container. Starting slow scroll for lazy loading...');
                
                // Slow Scroll through .Blmqu2TV and its nested children
                await page.evaluate(async () => {
                    // Try to find the specific nested container structure user mentioned:
                    // .UhNRiWLO > .BTmMjWa_ > .Blmqu2TV
                    let container = document.querySelector('.Blmqu2TV');
                    
                    // If .Blmqu2TV isn't found directly, try finding it via the parent chain
                    if (!container) {
                        const parent = document.querySelector('.UhNRiWLO');
                        if (parent) {
                            container = parent.querySelector('.Blmqu2TV');
                        }
                    }

                    if (container) {
                        // Scroll the container into view first
                        container.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        await new Promise(r => setTimeout(r, 1000));

                        // Now scroll down the page to cover the height of the container
                        const totalHeight = container.scrollHeight;
                        
                        // Human-like slow slide scroll: ~15px every ~20ms (approx 750px/sec)
                        let currentScroll = 0;
                        const minStep = 10;
                        const maxStep = 20;
                        
                        while (currentScroll < totalHeight) {
                            const step = Math.floor(Math.random() * (maxStep - minStep + 1)) + minStep;
                            window.scrollBy(0, step);
                            currentScroll += step;
                            
                            // Variable delay for natural feel
                            await new Promise(r => setTimeout(r, 15 + Math.random() * 10));
                        }
                        
                        // Scroll back up slightly to trigger any bottom intersection observers
                        window.scrollBy(0, -200);
                        await new Promise(r => setTimeout(r, 500));
                        window.scrollBy(0, 200);
                    } else {
                        console.log('[DEBUG-Browser] .Blmqu2TV container not found.');
                    }
                });
                
                await randomDelay(3000, 6000); // Final wait for last images

                // 2. Collect Images from divs with data-uniqid inside .Blmqu2TV
                console.log('Extracting description images from .Blmqu2TV > div[data-uniqid]...');
                productDescImgs = await page.evaluate(() => {
                    let container = document.querySelector('.Blmqu2TV');
                    if (!container) {
                        // Try finding via parent
                         const parent = document.querySelector('.UhNRiWLO');
                         if (parent) {
                             container = parent.querySelector('.Blmqu2TV');
                         }
                    }
                    
                    if (!container) {
                        console.log('[DEBUG-Browser] Container .Blmqu2TV not found during extraction.');
                        return [];
                    }
                    
                    const images = [];
                    // User said: inside .Blmqu2TV -> div[data-uniqid] -> img
                    // We select all divs with data-uniqid attribute
                    const uniqIdDivs = container.querySelectorAll('div[data-uniqid]');
                    
                    console.log(`[DEBUG-Browser] Found ${uniqIdDivs.length} divs with data-uniqid`);

                    if (uniqIdDivs.length > 0) {
                        uniqIdDivs.forEach(div => {
                            const img = div.querySelector('img');
                            if (img) {
                                let src = img.src;
                                let dataSrc = img.getAttribute('data-src');

                                // Handle spaces in src/data-src
                                if (src) src = src.trim();
                                if (dataSrc) dataSrc = dataSrc.trim();

                                if (!src || src.startsWith('data:') || src.includes('base64')) {
                                    src = dataSrc;
                                }
                                
                                if (src && src.startsWith('http')) {
                                    images.push(src);
                                }
                            }
                        });
                    }
                    
                    // Fallback: If no images found via uniqid, try broader search
                    if (images.length === 0) {
                         console.log('[DEBUG-Browser] No images found via data-uniqid, falling back to all images in .Blmqu2TV');
                         const allImgs = container.querySelectorAll('img');
                         console.log(`[DEBUG-Browser] Found ${allImgs.length} images in .Blmqu2TV via fallback`);
                         allImgs.forEach(img => {
                            let src = img.src;
                            let dataSrc = img.getAttribute('data-src');
                            
                            if (src) src = src.trim();
                            if (dataSrc) dataSrc = dataSrc.trim();

                            if (!src || src.startsWith('data:') || src.includes('base64')) {
                                src = dataSrc;
                            }
                            if (src && src.startsWith('http')) {
                                images.push(src);
                            }
                         });
                    }

                    return Array.from(new Set(images)); // Deduplicate
                });
                console.log(`[DEBUG] Collected ${productDescImgs.length} description images.`);
            } else {
                console.log('Could not find description container (.mP10ZXCw or .UhNRiWLO) after scrolling.');
            }
            } // End of isProductPage check

        } catch (err) {
            console.error('Error scraping description images:', err.message);
        }

        // --- 7. AI Translation & Processing ---
        console.log('--- Processing Data with AI (Translation & Metadata) ---');
        console.time('AI Processing Total');
        
        // Slice arrays
        const limitedReviews = scrapedReviews.slice(0, 8);
        const limitedOptions = generated_options.slice(0, 30);
        
        // Prepare Parallel Tasks
        console.log('Starting parallel AI tasks (Name, Description, Options, Reviews)...');
        console.time('Parallel AI Tasks');

        const nameTask = translateText(basicData.product_name, 'product_name', basicData.descriptionText, MODEL_12B);
        const descriptionTask = formatDescriptionToKV(basicData.descriptionText);
        const optionsTask = batchTranslate(limitedOptions.map(opt => opt.color), 'option', MODEL_4B, MODEL_12B);
        const reviewsTask = batchTranslate(limitedReviews.map(rev => rev.comment), 'review', MODEL_4B, MODEL_12B);

        // Execute all in parallel
        const [translatedName, descriptionKV, translatedOptionNames, translatedReviewComments] = await Promise.all([
            nameTask,
            descriptionTask,
            optionsTask,
            reviewsTask
        ]);

        console.timeEnd('Parallel AI Tasks');
        
        // Map translated options
        const translatedOptions = limitedOptions.map((opt, idx) => {
            const { skuId, ...rest } = opt;
            let translatedName = translatedOptionNames[idx] || opt.color;
            
            // CLEANUP: If translation is a single Arabic character but input was longer, it's likely a fragment/bad translation
            const isSingleArabicChar = translatedName.length === 1 && /[\u0600-\u06FF]/.test(translatedName);
            const wasSingleChar = opt.color.length === 1;
            
            if (isSingleArabicChar && !wasSingleChar) {
                console.log(`[DEBUG] Discarding single-character Arabic translation fragment: "${translatedName}" for input "${opt.color}"`);
                return null;
            }
            
            // Also discard if the translation is empty or just whitespace
            if (!translatedName || !translatedName.trim()) return null;

            return {
                ...rest,
                color: translatedName
            };
        }).filter(opt => opt !== null);
        
        console.log(`✅ Translation complete: ${translatedOptions.length} options ready`);
        
        // Map translated reviews
        const translatedReviews = limitedReviews.map((rev, idx) => ({
            name: rev.name,
            photos: rev.photos,
            comment: translatedReviewComments[idx] || rev.comment
        }));

        // Generate Metadata (Depends on translatedName, so runs after parallel block)
        console.log('Generating AI Metadata using 12B...');
        console.time('Metadata Generation');
        const aiMetadata = await generateAiMetadata(translatedName, basicData.descriptionText);
        console.timeEnd('Metadata Generation');
        
        console.timeEnd('AI Processing Total');
        console.log('Metadata generation complete.');

        // 4. Construct Final Object
        const finalGeneralPrice = (() => {
            // Priority 1: Main Page Price (converted to raw IQD)
            if (basicData.mainPagePrice && basicData.mainPagePrice > 0) {
                 return basicData.mainPagePrice * 200;
            }
            
            // Priority 2: Min of Options (which are already raw IQD now)
            const validPrices = translatedOptions.map(o => o.price).filter(p => p > 0);
            return validPrices.length > 0 ? Math.min(...validPrices) : 0;
        })();

        console.log(`💰 Final Product Price: ${finalGeneralPrice} IQD`);

        const finalData = {
            product_name: translatedName,
            main_images: basicData.main_images,
            url: url,
            product_details: descriptionKV, // Key-Value formatted description
            product_desc_imgs: productDescImgs,
            general_price: finalGeneralPrice,
            generated_options: translatedOptions,
            scrapedReviews: translatedReviews,
            aiMetadata: aiMetadata
        };

        return finalData;

    } catch (e) {
        console.error(`Error scraping ${url}:`, e.message);
        return null;
    }
}

// Main Execution
(async () => {
    // Check DB first
    await ensureDatabaseSchema();
    
    console.log('[Start] Initializing Pinduoduo Scraper (Click-and-Scrape Mode)...');
    
    let urlInput = '';
    
    if (CATEGORY_URL && CATEGORY_URL.length > 10) {
        urlInput = CATEGORY_URL;
        console.log('Using predefined CATEGORY_URL from script.');
    } else if (process.argv[2]) {
        urlInput = process.argv[2];
    } else {
        urlInput = await askQuestion('Enter the Pinduoduo Category URL to scrape: ');
    }

    urlInput = urlInput.trim();
    if (!urlInput) {
        console.error('No URL provided. Exiting.');
        process.exit(1);
    }

    console.log('Using URL:', urlInput);
    console.log('----------------------------------------------------');
    CATEGORY_URL = urlInput.trim();

    // Create or connect to browser
    let browser;
    try {
        // FIX: Pass 'true' for useGuest (as requested by user), and pass CATEGORY_URL for immediate load
        browser = await createBrowser(true, CATEGORY_URL);
        console.log('Browser launched');
    } catch (err) {
        console.error('❌ FATAL: Could not create or connect to browser.');
        throw err;
    }

    // --- 1. INITIALIZE PAGE FIRST ---
    // Get all pages
    const pages = await browser.pages();
    
    // If we connected to an existing browser, find the tab with our target URL or create new
    // If we launched a new one with initialUrl, the first page should be it.
    let page;
    
    // Check if any existing page matches our target
    const targetPage = pages.find(p => p.url().includes('mobile.pinduoduo.com'));
    
    if (targetPage) {
        console.log('Using existing Pinduoduo tab...');
        page = targetPage;
    } else if (pages.length > 0) {
        // Use the first available page (often "about:blank" if just launched without args, or our initialUrl page)
        console.log('Using first available tab...');
        page = pages[0];
    } else {
        console.log('Creating new page...');
        page = await browser.newPage();
    }

    // Load cookies for the initial session
    await loadCookies(page);

    // --- 2. LOGIN DELAY (DESKTOP MODE) ---
    console.log('⏳ 30 SECONDS LOGIN DELAY (Please Login if needed)...');
    console.log('👉 NOTE: You are in DESKTOP mode to allow QR Code Login.');
    
    // Simulate user activity during the delay
    const delayDuration = 30000;
    const interval = 2000;
    
    for(let i=0; i<delayDuration; i+=interval) {
         const remaining = Math.round((delayDuration - i) / 1000);
         process.stdout.write(`\r⏳ Waiting... ${remaining}s `);
         
         // Keep session alive with tiny scroll
         try {
            if (page) await page.mouse.move(Math.random()*100, Math.random()*100);
         } catch(e) {}
         
         await new Promise(r => setTimeout(r, interval));
    }
    console.log('\n✅ Login Delay Finished. Preparing Scraper...');

    // --- 3. APPLY DESKTOP MODE (NO VIEWPORT CHANGES) ---
    console.log('Keeping existing Desktop Viewport (User Request)...');
    
    // REMOVED: Explicit Viewport setting to avoiding "screen to the left" issue
    // REMOVED: Zoom setting
    // REMOVED: Mobile Emulation

    console.log('⚠️ DESKTOP MODE ACTIVE: Using default browser view.');

    // Inject stealth scripts into ANY page (not just new ones)
    const injectStealth = async (p) => {
        await p.evaluate(() => {
            // 1. Pass the Webdriver Test
            Object.defineProperty(navigator, 'webdriver', { get: () => false });
            
            // 2. Pass Chrome Test
            window.chrome = { runtime: {} };
            
            // 3. Pass Permissions Test
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) => (
                parameters.name === 'notifications' ? Promise.resolve({ state: 'denied' }) : originalQuery(parameters)
            );

            // 4. Spoof Hardware Concurrency (Simulate 8-core CPU)
            Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });

            // 5. Spoof Device Memory (Simulate 8GB RAM)
            Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });

            // 6. Spoof Languages (Match US/English or Chinese based on UA)
            Object.defineProperty(navigator, 'languages', { get: () => ['zh-CN', 'zh', 'en-US', 'en'] });

            // 7. Spoof Plugins (Basic Array)
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
        });
    };

    // Inject on New Document (Persistent)
    await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
        window.chrome = { runtime: {} };
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
            parameters.name === 'notifications' ? Promise.resolve({ state: 'denied' }) : originalQuery(parameters)
        );
        Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
        Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
        Object.defineProperty(navigator, 'languages', { get: () => ['zh-CN', 'zh', 'en-US', 'en'] });
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    });
    
    // Inject IMMEDIATELY into current page
    try { await injectStealth(page); } catch(e) {}
    
    // Refresh page to apply mobile view if needed, OR just proceed if user navigated
    // We will let the "Diagnostic Pause" handle the visual check


    // If it's not our URL (e.g. blank), go there NOW (after applying anti-detection)
    if (!page.url().includes('mobile.pinduoduo.com')) {
         // Human-like pre-navigation delay
         console.log('Performing human-like pre-navigation behaviors...');
         // REMOVED mouse moves as they are suspicious on mobile emulation
         await delay(Math.random() * 1000 + 500);
 
         // Use Soft Navigation instead of page.goto
         await page.evaluate((url) => window.location.href = url, CATEGORY_URL);
         await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(()=>console.log('Nav timeout (ok)'));
    }
    
    // Enable console log forwarding from the browser to the terminal
    page.on('console', msg => {
        const text = msg.text();
        if (!text.includes('ERR_BLOCKED_BY_CLIENT')) {
            if (text.includes('[DEBUG-Browser]')) {
                console.log(text);
            }
            // console.log(`[Browser Console] ${msg.type().toUpperCase()}: ${text}`);
        }
    });

    // Use global hasPageError
    page.on('pageerror', err => {
        console.log(`[Browser Error]: ${err.toString()}`);
        if (err.toString().includes('424') || err.toString().includes('403')) {
            hasPageError = true;
        }
    });

    let lastProductUrl = '';
    let lastProductAt = 0;
    
    // Rate limit tracking variables
    let rateLimitHits = 0;
    let rateLimitBackoffMs = 60000;
    let lastRateLimitAt = 0;

    page.on('framenavigated', frame => {
        try {
            if (frame.parentFrame()) return;
            const url = frame.url();
            
            // Check for Captcha/Verification pages
            if (url.includes('verification') || url.includes('punish') || url.includes('captcha')) {
                console.log(`⚠️ [SECURITY-CHECK] Captcha/Verification detected: ${url}`);
                hasPageError = true;
            }

            if (isProductUrl(url)) {
                const normalized = normalizeProductUrl(url);
                lastProductUrl = normalized;
                lastProductAt = Date.now();
                // console.log(`[Nav] Product URL detected: ${normalized}`);
            }
        } catch (e) {}
    });

    page.on('response', res => {
        try {
            if (res.status() === 429) {
                rateLimitHits += 1;
                rateLimitBackoffMs = Math.min(rateLimitBackoffMs > 0 ? rateLimitBackoffMs * 2 : 60000, 300000);
                lastRateLimitAt = Date.now();
                console.log('Rate limited (429). Cooling down...');
            }
        } catch (e) {}
    });

    // Mobile Emulation - DISABLED (User Request)
    // await applyMobileEmulation(page);

    // Initial Navigation - Check if already there
    const currentUrl = page.url();
    if (currentUrl.includes('pinduoduo.com')) {
         console.log('Page already at target (via launch args).');
    } else {
         console.log('Visiting Category URL (and performing login check there):', CATEGORY_URL);
         await safeGoto(page, CATEGORY_URL, { waitUntil: 'domcontentloaded', timeout: PAGE_LOAD_TIMEOUT });
    }

    // Check if we are redirected to login
    const url = page.url();
    if (url.includes('login') || url.includes('verification')) {
        console.log('Login/Verification required. Please solve it in the browser window.');
        console.log('Waiting for you to navigate back to category or product list...');
    }
    
    // Save cookies after initial load
    await saveCookies(page);
    console.log('✅ Cookies saved.');

    // --- AUTOMATION MODE: Click and Scrape ---
    let processedUrls = new Set();
    
    console.log('Starting Scrape Loop (Quadrant-Based)...');

    // --- MAIN LOOP ---
    const PRODUCT_LIMIT = 45; // Max products to scrape
    let productsScrapedCount = 0;
    let consecutiveFailures = 0;
    let productIndex = 0; 
    let batchQueue = []; // Queue for randomized quadrant order

    // Initial check to ensure we are on category page
    const pageUrl = page.url();
    // Simple check: if we are on pinduoduo and not on home page, assume user navigated correctly
    if (!pageUrl.includes('search_result') && !pageUrl.includes('catgoods') && !pageUrl.includes('goods_id')) {
        console.log('Navigating to Category Page...');
        await page.evaluate((url) => window.location.href = url, CATEGORY_URL);
        await randomDelay(5000, 10000); 
    }
    
    // Initial "Human Scroll Slide Down" (Half screen approx)
    console.log('Performing initial human-like slide scroll...');

    await humanScroll(page, 400, { steps: 15, variance: 0.1 });
    await randomDelay(2000, 4000);

    while (isRunning) {
        try {
            // Check for 403/424 or Captcha errors before each product
            if (hasPageError) {
                console.log('⚠️ Page error detected (403/424). Rotating cookies...');
                await rotateCookies(page);
                continue; // Restart the loop after rotation
            }

            // 1. Ensure we are on Category Page (or go back if stuck)
            if (isProductUrl(page.url())) {
                console.log('Unexpectedly on Product Page. Going back...');
                await page.goBack();
                await randomDelay(3000, 6000);
                continue;
            }

            // 2. Scroll Logic (Refill Batch Queue and Scroll)
            if (batchQueue.length === 0) {
                 // If this is NOT the very first batch (productIndex > 0), scroll down
                if (productIndex > 0) {
                    console.log(`\n--- Finished Batch. Scrolling Down (Human Slide)... ---`);
                    
                    // Scroll approx 1 full screen height with HUMAN SLIDE
                    const vh = await page.evaluate(() => window.innerHeight);
                    await humanScroll(page, vh, {
                        steps: 25,
                        variance: 0.15
                    });
                    
                    await randomDelay(4000, 8000); // Wait for content to load
                }

                // Generate new batch (0, 1, 2, 3)
                 console.log('Generating new click order for this screen...');
                 const indices = [0, 1, 2, 3];
                 
                 if (layoutMode === 'vertical-4') {
                     // Sequential for vertical layout as per user instruction
                     console.log('Using Sequential Order for Vertical Layout (Top -> Down)');
                     // No shuffle
                 } else {
                     // Fisher-Yates Shuffle for Grid (Randomized)
                     for (let i = indices.length - 1; i > 0; i--) {
                         const j = Math.floor(Math.random() * (i + 1));
                         [indices[i], indices[j]] = [indices[j], indices[i]];
                     }
                 }
                 batchQueue = indices;
                 console.log('New Batch Order:', batchQueue);
            }
            
            // "Coffee Break" Logic - Every 15-25 products, take a long break
            if (productIndex > 0 && productIndex % (Math.floor(Math.random() * 10) + 15) === 0) {
                const breakTime = Math.floor(Math.random() * 60000) + 60000; // 1-2 minutes
                console.log(`\n☕ Taking a "Coffee Break" for ${Math.round(breakTime/1000)}s to simulate human rest...`);
                await delay(breakTime);
                
                // Randomly scroll up a bit and back down to look active
                if (Math.random() > 0.5) {
                    await page.evaluate(() => window.scrollBy(0, -300));
                    await delay(2000);
                    await page.evaluate(() => window.scrollBy(0, 300));
                }
            }

            // 3. Determine Quadrant/Position from Queue
            const quadrantIdx = batchQueue.shift(); // Get next random index

            let clickTarget;

            if (layoutMode === 'vertical-4') {
                // --- NEW VERTICAL LAYOUT MODE (1 item per row, 4 items per screen) ---
                const slotNames = ['Vertical Item 1 (Top)', 'Vertical Item 2', 'Vertical Item 3', 'Vertical Item 4 (Bottom)'];
                const slotName = slotNames[quadrantIdx];
                console.log(`\nAttempting Product #${productIndex + 1} (Vertical Slot: ${quadrantIdx + 1})...`);

                clickTarget = await page.evaluate((qIdx) => {
                    const vh = window.innerHeight;
                    const vw = window.innerWidth;
                    
                    // Slot 0: 0.20 (20%)
                    // Slot 1: 0.40 (40%)
                    // Slot 2: 0.60 (60%)
                    // Slot 3: 0.80 (80%)
                    const yPct = 0.20 + (qIdx * 0.20);
                    
                    const y = vh * yPct;
                    
                    // X is center of screen (or center of detected container)
                    const container = document.querySelector('#main') || 
                                      document.querySelector('.page-container') || 
                                      document.body;
                    const rect = container.getBoundingClientRect();
                    let left = rect.left;
                    let width = rect.width;
                    
                    if (width > 800) {
                         width = 450;
                         left = (vw / 2) - (width / 2);
                    }
                    
                    const x = left + (width * 0.5); // Center
                    
                    // Jitter
                    const jitterX = (Math.random() - 0.5) * 15;
                    const jitterY = (Math.random() - 0.5) * 15;

                    return {
                        x: x + jitterX,
                        y: y + jitterY,
                        name: `Vertical Slot ${qIdx+1} (${(yPct*100).toFixed(0)}%)`,
                        containerWidth: width
                    };
                }, quadrantIdx);

            } else {
                const quadrantNames = ['Top Left', 'Top Right', 'Bottom Left', 'Bottom Right'];
                const quadrantName = quadrantNames[quadrantIdx];
                
                console.log(`\nAttempting Product #${productIndex + 1} (Quadrant: ${quadrantName})...`);
    
                // --- DETECT "PHONE CONTAINER" & SELECT QUADRANT ---
                clickTarget = await page.evaluate((qIdx) => {
                    // Try to find the main content container (usually centered on desktop)
                    const container = document.querySelector('#main') || 
                                      document.querySelector('.page-container') || 
                                      document.querySelector('.goods-list-container') || 
                                      document.querySelector('._3BdU0') || 
                                      document.body;
                    
                    const rect = container.getBoundingClientRect();
                    
                    let targetRect = {
                        left: rect.left,
                        top: rect.top,
                        width: rect.width,
                        height: rect.height
                    };
    
                    // Heuristic: If body is full width, assume phone is a 400-500px column in the middle
                    if (targetRect.width > 800) {
                         const phoneWidth = 450;
                         targetRect.left = (window.innerWidth / 2) - (phoneWidth / 2);
                         targetRect.width = phoneWidth;
                    }
    
                    // Define the 4 quadrants relative to the detected "phone" container
                    const quadrants = [
                        { name: 'Top Left', xPct: 0.25, yPct: 0.25 },
                        { name: 'Top Right', xPct: 0.75, yPct: 0.25 },
                        { name: 'Bottom Left', xPct: 0.25, yPct: 0.75 },
                        { name: 'Bottom Right', xPct: 0.75, yPct: 0.75 }
                    ];
                    
                    // Use sequential index instead of random
                    const choice = quadrants[qIdx];
                    
                    const x = targetRect.left + (targetRect.width * choice.xPct);
                    
                    // Better approach for Y:
                    const viewportHeight = window.innerHeight;
                    // Target the middle-ish area of the screen
                    const y = (viewportHeight * 0.3) + (viewportHeight * 0.4 * choice.yPct); // Map 0-1 to 30%-70% of screen height
                    
                    // Add Gaussian-like Random Jitter (+/- 5px)
                    const jitterX = (Math.random() - 0.5) * 10; 
                    const jitterY = (Math.random() - 0.5) * 10;
                    
                    return {
                        x: x + jitterX,
                        y: y + jitterY,
                        name: choice.name,
                        containerWidth: targetRect.width
                    };
                }, quadrantIdx); // Pass quadrantIdx to evaluate
            }

            // Click Logic
            const clickX = clickTarget.x;
            const clickY = clickTarget.y;
            
            console.log(`Targeting "${clickTarget.name}" at (${clickX.toFixed(0)}, ${clickY.toFixed(0)}) inside ${clickTarget.containerWidth.toFixed(0)}px width container...`);

            // Highlight (Red Dot)
            await page.evaluate((x, y) => {
                const el = document.createElement('div');
                el.style.position = 'fixed';
                el.style.left = x + 'px';
                el.style.top = y + 'px';
                el.style.width = '20px';
                el.style.height = '20px';
                el.style.backgroundColor = 'red';
                el.style.borderRadius = '50%';
                el.style.zIndex = '99999';
                el.style.pointerEvents = 'none';
                document.body.appendChild(el);
                setTimeout(() => el.remove(), 2000);
            }, clickX, clickY);

            await randomDelay(1000, 2000); 

            // Simulate Click (Touch or Mouse)
            // Use Mouse primarily for Desktop Mode as requested
            console.log('Clicking with Mouse...');
            
            // Human-like mouse movement (Bezier-ish via steps)
            const steps = Math.floor(Math.random() * 5) + 10; // 10-15 steps
            await page.mouse.move(clickX, clickY, {steps: steps});
            
            await delay(Math.random() * 200 + 100); // Slight pause before click
            await page.mouse.down();
            await delay(Math.random() * 100 + 50);
            await page.mouse.up();
            
            /* 
            if (page.touchscreen) {
                await page.touchscreen.touchStart(clickX, clickY);
                await delay(Math.floor(Math.random() * 100) + 50); 
                await page.touchscreen.touchEnd();
            } else {
                await page.mouse.move(clickX, clickY, {steps: 10});
                await page.mouse.down();
                await delay(Math.floor(Math.random() * 100) + 50);
                await page.mouse.up();
            }
            */

            // Wait for navigation
            console.log('Waiting for potential navigation...');
            await randomDelay(5000, 10000);
            
            // Check if entered product page
            const currentUrl = page.url();
            let scraped = false;

            if (isProductUrl(currentUrl)) {
                console.log('✅ Entered Product Page. Scraping...');
                const pData = await scrapeProduct(page, currentUrl);
                if (pData) await saveProductToDb(pData);
                // Mark as processed so we go back, even if scraping failed (e.g. sold out)
                scraped = true;
            } else {
                // Fallback Content Check
                const isProductContent = await page.evaluate(() => !!(document.querySelector('.goods-name') || document.querySelector('.pdd-goods-name')));
                if (isProductContent) {
                    console.log('✅ Content matches Product Page. Scraping...');
                    const pData = await scrapeProduct(page, currentUrl); // Use current URL even if weird
                    if (pData) await saveProductToDb(pData);
                    scraped = true;
                } else {
                    console.log('⚠️ Click did not open a product (or URL mismatch). Skipping to next...');
                }
            }

            if (scraped) {
                productsScrapedCount++;
                console.log(`[Limit Check] Scraped ${productsScrapedCount}/${PRODUCT_LIMIT} products.`);
                
                if (productsScrapedCount >= PRODUCT_LIMIT) {
                    console.log(`\n✅ REACHED PRODUCT LIMIT (${PRODUCT_LIMIT}). Closing scraper gracefully...`);
                    isRunning = false;
                    break;
                }

                console.log('Going back to category...');
                
                // Robust Navigation Back to Category
                // Because we might have pushed history entries (e.g. forced goto), simple goBack() might land on Reviews or Product again.
                // We loop goBack() until we are on a "safe" page (Category).
                
                let attempts = 0;
                const maxAttempts = 2; // Reduced from 5 to 2 (Anti-Spam)
                
                while (attempts < maxAttempts) {
                    const currentUrl = page.url();
                    
                    // Define what is "unsafe" (Product or Reviews pages)
                    // Use isProductUrl() helper which is smarter about distinguishing products from categories
                    const isProduct = isProductUrl(currentUrl);
                    // Also check for Reviews specifically
                    const isReview = currentUrl.includes('comment') || currentUrl.includes('reviews') || currentUrl.includes('subject_review');
                    
                    // Extra safety: If URL contains 'catgoods' or 'search_result', it is DEFINITELY NOT a product/review we want to leave
                    // BUT: If it contains 'goods_id', it IS a product page, so we must exclude it from being a "category"
                    const isCategory = (currentUrl.includes('catgoods') || currentUrl.includes('search_result') || currentUrl.includes('classification')) && !currentUrl.includes('goods_id');

                    // If we are on a product or review page (and NOT a category page), we need to go back
                    if ((isProduct || isReview) && !isCategory) {
                        console.log(`[Back Nav] Currently on ${isProduct ? 'Product' : 'Review'} page (${currentUrl}). Going back (Attempt ${attempts + 1})...`);
                        try {
                            await page.goBack();
                            await randomDelay(2000, 4000); // Wait for navigation to settle
                        } catch (e) {
                            console.log(`[Back Nav] goBack() failed: ${e.message}`);
                        }
                    } else {
                        console.log(`[Back Nav] Successfully returned to non-product/review page: ${currentUrl}`);
                        break; // We are safe
                    }
                    
                    attempts++;
                }

                if (attempts >= maxAttempts) {
                     console.log('⚠️ Failed to return to category via history. Forcing reload of Category URL.');
                     // Fallback: If history fails, force load. We lose scroll position but better than being stuck.
                     try {
                        await page.goto(CATEGORY_URL, { waitUntil: 'domcontentloaded' });
                     } catch(e) { console.log('Force reload failed:', e.message); }
                }

                console.log('Waiting 15 seconds before next product...');
                await randomDelay(15000, 30000);
            }

        } catch (e) {
            console.error('Error in iteration:', e.message);
            consecutiveFailures++;
            if (consecutiveFailures > 5) {
                console.log('Too many failures. Pausing...');
                await randomDelay(10000, 20000);
                consecutiveFailures = 0; // Reset after pause?
            }
        }

        // Always increment index to try next position/batch
        productIndex++;
        
        // Check running flag
        if (!isRunning) break;
    }

    console.log('Scraper finished.');
    
    // Close the browser and exit the process
    try {
        if (typeof browser !== 'undefined' && browser) {
            console.log('Closing browser...');
            await browser.close();
        }
    } catch (e) {
        console.error('Error closing browser:', e.message);
    }
    
    await prisma.$disconnect();
    process.exit(0);
})();
