import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import OpenAI from 'openai'; // Use OpenAI SDK for DeepInfra
import readline from 'readline';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

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

const prisma = new PrismaClient();

// Initialize AI (DeepInfra)
let deepinfra = null;
if (process.env.DEEPINFRA_API_KEY) {
    deepinfra = new OpenAI({
        baseURL: "https://api.deepinfra.com/v1/openai",
        apiKey: process.env.DEEPINFRA_API_KEY,
    });
    console.log('AI Initialized (DeepInfra)');
} else {
    console.log('Warning: DEEPINFRA_API_KEY not found. AI features will use mock data.');
}

// --- Configuration ---
let CATEGORY_URL = ''; // Set via user input
const TARGET_LINK_COUNT = 60;
// Use absolute paths to ensure files are saved in the correct location (server directory)
const OUTPUT_FILE = path.join(__dirname, '..', 'arabic-products.json'); 
const LINKS_FILE = path.join(__dirname, '..', 'xianyu-links.json');
const PAGE_LOAD_TIMEOUT = 60000;

// Global flag for graceful shutdown
let isRunning = true;
process.on('SIGINT', () => {
    console.log('\nReceived SIGINT. Stopping scraper gracefully...');
    isRunning = false;
});

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

// Helper: Process with AI
async function enrichWithAI(title, description, price) {
    if (!deepinfra) {
        return {
            translatedTitle: title + " (Translation Pending)",
            translatedDesc: description + " (Translation Pending)",
            aiMetadata: {
                synonyms: ["Placeholder"],
                market_tags: ["Tag"],
                category_suggestion: "General"
            }
        };
    }

    try {
        const prompt = `
        You are a product data enrichment assistant for an Iraqi e-commerce site.
        
        Product Title (might be empty): "${title}"
        Product Description: "${description}"
        Price: "${price}"

        Task:
        1. Extract the Brand Name in English (e.g., "Nike", "Sony", "Xiaomi"). If no brand is found, ignore it.
        2. Extract a concise Product Name from the Title or the first sentence of the Description. Translate it to ARABIC.
        3. Combine them into "product_name_ar" format: "[English Brand] [Arabic Name]" (e.g., "Sony سماعات بلوتوث").
        4. Extract "product_details" as a structured Key-Value JSON object in ARABIC. Extract as many specifications as possible (Material, Color, Size, Design, Usage, Brand, etc.).
        5. Generate "aiMetadata" with synonyms (Arabic), market_tags (Arabic), and a category_suggestion (Arabic).

        CRITICAL INSTRUCTIONS:
        - The "product_name_ar" MUST start with the English Brand (if found), followed by the Arabic name.
        - The rest of the name MUST be in ARABIC. NO Chinese characters allowed.
        - If the product name cannot be translated, provide a descriptive Arabic name based on the category (e.g., "حقيبة يد نسائية" instead of Chinese text).
        - The "product_details_ar" field MUST be a JSON OBJECT (key-value pairs), NOT a string.
        - Example format for details:
          "product_details_ar": { 
              "المادة": "قماش كتّان, حشوة من رغوة البوليسترين", 
              "الميزة": "ألوان متعددة, أحجام متنوعة", 
              "التصميم": "إبداعي, على طراز انستغرام", 
              "الاستخدام": "غرفة المعيشة, غرفة النوم" 
          }
        - STRICTLY EXCLUDE any "return policy", "refund", "replacement", "shipping", "free shipping", or "guarantee" information from details. We only want physical product specs.
        - Do NOT include any Chinese characters (like ¥, 包邮, 品牌, etc.) in values.
        - English text IS ALLOWED for Brand Names and Model Numbers.
        - Convert all prices and measurements to Arabic format if possible, or keep numbers as digits.

        Return ONLY a valid JSON object with this structure (no markdown):
        {
            "product_name_ar": "اسم المنتج بالعربية",
            "product_details_ar": {
                "الماركة": "قيمة",
                "اللون": "قيمة",
                "المادة": "قيمة"
            },
            "aiMetadata": {
                "synonyms": ["مرادف1", "مرادف2"],
                "market_tags": ["تاق1", "تاق2"],
                "category_suggestion": "اسم التصنيف"
            }
        }
        `;

        // Rate limiting logic: Wait if needed
        // DeepInfra Free tier might have 60 RPM or similar.
        // We will implement a retry mechanism.
        
        let attempts = 0;
        const maxAttempts = 5;
        
        while (attempts < maxAttempts) {
            try {
                // Add 25s timeout to the API call (Increased from 15s to avoid timeout on long generations)
                const responsePromise = deepinfra.chat.completions.create({
                    model: "Qwen/Qwen2.5-7B-Instruct",
                    messages: [{ role: "user", content: prompt }],
                    temperature: 0.7,
                    max_tokens: 1024, // Explicitly increase token limit to avoid truncation
                });

                const response = await Promise.race([
                    responsePromise,
                    new Promise((_, reject) => setTimeout(() => reject(new Error('AI Request Timeout')), 25000))
                ]);

                let text = response.choices[0].message.content;
                
                // --- ROBUST JSON CLEANING ---
                // 1. Remove markdown code blocks
                text = text.replace(/```json/g, '').replace(/```/g, '').trim();
                
                // 2. Escape control characters that break JSON.parse (like unescaped newlines in strings)
                // This regex finds control characters (0-31) except newlines/tabs allowed in JSON
                // text = text.replace(/[\x00-\x09\x0B-\x1F\x7F]/g, ''); 
                
                // Better approach: Try to find valid JSON block if there's extra text
                const jsonStart = text.indexOf('{');
                const jsonEnd = text.lastIndexOf('}');
                if (jsonStart !== -1 && jsonEnd !== -1) {
                    text = text.substring(jsonStart, jsonEnd + 1);
                }

                // 3. Handle common AI mistakes like trailing commas
                text = text.replace(/,(\s*[}\]])/g, '$1');

                try {
                    const parsed = JSON.parse(text);
                    
                    // --- REGEX FALLBACK: STRIP CHINESE CHARACTERS ---
                    // Remove Chinese characters range: \u4e00-\u9fff
                    const stripChinese = (str) => {
                        if (typeof str !== 'string') return str;
                        return str.replace(/[\u4e00-\u9fa5]/g, '').trim();
                    };

                    if (parsed.product_name_ar) {
                        parsed.product_name_ar = stripChinese(parsed.product_name_ar);
                        // If name becomes empty after stripping, use a fallback
                        if (!parsed.product_name_ar) parsed.product_name_ar = "منتج متنوع (الاسم الأصلي غير قابل للترجمة)";
                    }

                    if (parsed.product_details_ar) {
                        for (const key in parsed.product_details_ar) {
                            parsed.product_details_ar[key] = stripChinese(parsed.product_details_ar[key]);
                        }
                    }

                    return parsed;

                } catch (jsonError) {
                    console.warn(`JSON Parse Error (Attempt ${attempts + 1}):`, jsonError.message);
                    console.warn('Raw text:', text.substring(0, 100) + '...');
                    // Continue to next attempt loop
                    throw jsonError; 
                }
                
            } catch (e) {
                attempts++;
                console.error(`AI Error (Attempt ${attempts}/${maxAttempts}):`, e.message);
                
                // If it's a rate limit (429), wait longer
                if (e.message.includes('429')) {
                    const waitTime = attempts * 5000; // 5s, 10s, 15s...
                    console.log(`Rate limit hit. Waiting ${waitTime/1000}s...`);
                    await delay(waitTime);
                } else {
                    // Other error, just wait a bit
                    await delay(2000);
                }
            }
        }
        
        throw new Error("Max AI attempts reached");
        
    } catch (e) {
        console.error("AI Generation Error:", e.message);
        // Fallback if limit reached or error
        return {
            translatedTitle: title,
            translatedDesc: description,
            aiMetadata: { synonyms: [], market_tags: [], category_suggestion: "Error" }
        };
    }
}

// Common Chrome paths
const CHROME_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
];

function getExecutablePath() {
  for (const p of CHROME_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const humanDelay = (min = 1000, max = 3000) => delay(Math.floor(Math.random() * (max - min + 1)) + min);

async function createBrowser() {
  const executablePath = getExecutablePath();
  if (!executablePath) {
    console.error('Chrome/Edge executable not found.');
    process.exit(1);
  }

  return await puppeteer.launch({
    executablePath,
    headless: false,
    defaultViewport: null,
    userDataDir: path.join(process.cwd(), 'chrome_data'),
    args: [
      '--start-maximized', 
      '--no-sandbox', 
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1920,1080',
      '--disable-infobars',
      '--excludeSwitches=enable-automation',
      '--use-gl=desktop',
      '--disable-popup-blocking',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-site-isolation-trials',
      '--ignore-certificate-errors',
      '--disable-notifications',
      '--disable-extensions',
      '--disable-client-side-phishing-detection',
      '--no-first-run',
      '--no-default-browser-check',
      '--safebrowsing-disable-auto-update',
      '--safebrowsing-disable-download-protection'
    ]
  });
}

async function autoScroll(page) {
    console.log('Scrolling down slowly to load items...');
    await page.evaluate(async () => {
        await new Promise((resolve) => {
            let totalHeight = 0;
            const distance = 150; // Smaller scroll steps
            const timer = setInterval(() => {
                const scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;
                
                // Scroll back up a bit occasionally to mimic human reading
                if (Math.random() < 0.1) {
                     window.scrollBy(0, -100);
                }

                if (totalHeight >= scrollHeight - window.innerHeight) {
                    clearInterval(timer);
                    resolve();
                }
            }, 300); // Slower interval (300ms)
        });
    });
    console.log('Scroll complete.');
}

async function randomInteraction(page) {
    console.log('Performing random interactions...');
    try {
        const width = await page.evaluate(() => window.innerWidth);
        const height = await page.evaluate(() => window.innerHeight);

        // 1. Random Scroll
        await page.evaluate(() => window.scrollBy(0, 300));
        await delay(Math.random() * 1000 + 500);
        await page.evaluate(() => window.scrollBy(0, -100));
        
        // 2. Random Mouse Moves
        for (let i = 0; i < 3; i++) {
            const x = Math.floor(Math.random() * width);
            const y = Math.floor(Math.random() * height);
            await page.mouse.move(x, y, { steps: 5 });
            await delay(Math.random() * 500);
        }

        // 3. Random Click (on safe elements like text)
        // Find a random p or span
        const randomEl = await page.$('p, span.desc--GaIUKUQY');
        if (randomEl) {
            await randomEl.click().catch(() => {});
        }
        
        await delay(Math.random() * 1000);
    } catch (e) {
        // Ignore interaction errors
    }
}

async function run() {
    console.log('[Start] Initializing Scraper...');
    
    // Ask for URL
    console.log('----------------------------------------------------');
    const urlInput = await askQuestion('Enter the Xianyu/Goofish Category URL to scrape: ');
    console.log('----------------------------------------------------');
    
    if (!urlInput.trim()) {
        console.error('URL cannot be empty.');
        process.exit(1);
    }
    CATEGORY_URL = urlInput.trim();

    let browser = await createBrowser();
    let page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // 1. Visit Category Page
    console.log('Visiting Category URL:', CATEGORY_URL);
    
    // Ensure we are going to the search page, not a product page from previous session cache
    if (page.url() !== CATEGORY_URL) {
         await page.goto(CATEGORY_URL, { waitUntil: 'domcontentloaded', timeout: PAGE_LOAD_TIMEOUT });
    }

    console.log('================================================================');
    console.log('  PAUSING FOR MANUAL LOGIN (15 seconds)');
    console.log('  Please log in manually now.');
    console.log('================================================================');
    await delay(15000); 
    console.log('Resuming...');

    // 2. Collect Links
    console.log(`[Phase 1] Collecting ${TARGET_LINK_COUNT} Links...`);
    await page.goto(CATEGORY_URL, { waitUntil: 'domcontentloaded' });
    
    let links = new Set();
    
    // Load existing links if any
    try {
        if (fs.existsSync(LINKS_FILE)) {
            const existing = JSON.parse(fs.readFileSync(LINKS_FILE));
            existing.forEach(l => links.add(l));
        }
    } catch(e) {}

    while (links.size < TARGET_LINK_COUNT) {
        console.log(`Scanning page... Current count: ${links.size}`);
        
        // Wait for at least one item to be present before scrolling
        try {
            await page.waitForSelector('a[href*="item?id="]', { timeout: 10000 });
        } catch(e) {
            console.log('Timeout waiting for items. Page might be empty or blocked.');
        }

        // Scroll to load all items
        await autoScroll(page);
        await randomInteraction(page); // Add interaction on category page too
        await humanDelay(2000, 3000);

        // Extract Links
        // Try multiple strategies to find links
        const newLinks = await page.evaluate(() => {
            const extracted = [];
            
            // Strategy 1: Standard card selectors
             // Updated: Broaden search to ANY item link
             const cardLinks = document.querySelectorAll('a[href*="item.taobao.com"], a[href*="detail.tmall.com"], a[href*="/item?id="], a[href*="goofish.com/item"]');
             cardLinks.forEach(a => extracted.push(a.href));
             
             // Strategy 3: Check ALL links and filter by ID pattern
             if (extracted.length === 0) {
                 const allLinks = document.querySelectorAll('a');
                 allLinks.forEach(a => {
                     if (a.href && (a.href.match(/id=\d+/) || a.href.includes('item.htm'))) {
                         extracted.push(a.href);
                     }
                 });
             }
             
             return extracted.filter(href => href && !href.includes('login') && !href.includes('search?'));
        });

        if (newLinks.length === 0) {
            console.log('No links found! Possible block or empty page.');
            
            // Debug: Check what IS on the page
            const debugInfo = await page.evaluate(() => {
                return {
                    title: document.title,
                    bodyLength: document.body.innerText.length,
                    hasItems: !!document.querySelector('.card-container') || !!document.querySelector('.item-card'),
                    allLinksCount: document.querySelectorAll('a').length,
                    firstLink: document.querySelector('a')?.href
                };
            });
            console.log('Debug Info:', debugInfo);
        }

        newLinks.forEach(l => links.add(l));
        console.log(`Found ${newLinks.length} links on this page. Total unique: ${links.size}`);
        
        fs.writeFileSync(LINKS_FILE, JSON.stringify(Array.from(links), null, 2));

        if (links.size >= TARGET_LINK_COUNT) break;

        // Click Next
        console.log('Looking for Next button...');
        await humanDelay(5000, 8000); // Requested delay before next click
        
        // Strategy: Find the container that has the "right" arrow class inside it
        // The user provided: <button class="..."><div class="... search-pagination-arrow-right--CKU78u4z"></div></button>
        
        const nextBtn = await page.evaluateHandle(() => {
            // Find the specific right arrow div
            const rightArrow = document.querySelector('.search-pagination-arrow-right--CKU78u4z');
            if (rightArrow) {
                // Return its parent button (or the arrow itself if parent not found)
                return rightArrow.closest('button') || rightArrow;
            }
            return null;
        });

        if (nextBtn && await nextBtn.asElement()) {
            console.log('Found Next button. Clicking...');
            
            // Get current first item to verify change
            const firstItemBefore = await page.evaluate(() => document.querySelector('a[href*="item?id="]')?.href);
            
            // Try JS click first to avoid clicking overlapping elements (like product cards)
            await page.evaluate(el => el.click(), nextBtn);
            
            await humanDelay(3000, 5000); // Wait for load
            
            // Verify if page changed
            const firstItemAfter = await page.evaluate(() => document.querySelector('a[href*="item?id="]')?.href);
            if (firstItemBefore === firstItemAfter) {
                console.log('Warning: Page did not seem to change after click. Retrying with Puppeteer click...');
                await nextBtn.click();
                await humanDelay(4000, 6000);
            }
        } else {
            console.log('Next button not found. End of pages?');
            break;
        }
    }

    const linkList = Array.from(links).slice(0, TARGET_LINK_COUNT);
    console.log(`[Phase 1 Complete] Collected ${linkList.length} links.`);

    // 3. Scrape Products
    console.log('[Phase 2] Scraping Products...');
    let products = [];
    
    // Load existing partial data to avoid re-scraping
    try {
        if (fs.existsSync(OUTPUT_FILE)) {
            products = JSON.parse(fs.readFileSync(OUTPUT_FILE));
        }
    } catch(e) {}

    const scrapedUrls = new Set(products.map(p => p.url));
    const toScrape = linkList.filter(l => !scrapedUrls.has(l));

    console.log(`Remaining to scrape: ${toScrape.length}`);

    // Close main page to save resources, we use new tabs
    await page.close();

    for (let i = 0; i < toScrape.length; i++) {
        if (!isRunning) {
            console.log('Scraper stopped by user.');
            break;
        }

        const url = toScrape[i];
        console.log(`[${i+1}/${toScrape.length}] Scraping: ${url}`);

        let productPage;
        try {
            if (!browser.isConnected()) {
                console.log('Browser was closed. Stopping scraper...');
                break;
            }
            
            productPage = await browser.newPage();
            await productPage.setViewport({ width: 1920, height: 1080 });
            
            // Stealth Injection
            await productPage.evaluateOnNewDocument(() => {
                Object.defineProperty(navigator, 'webdriver', { get: () => false });
                window.chrome = { runtime: {} };
            });

            await productPage.goto(url, { waitUntil: 'domcontentloaded', timeout: PAGE_LOAD_TIMEOUT });
            
            // Random Interaction Phase (10s approx)
            await humanDelay(5000, 8000); // Wait for load
            await randomInteraction(productPage);
            await humanDelay(2000, 4000);

            // 4. Extract Data
            if (!isRunning) break;

            // Click thumbnails for high res
            try {
                // Selector provided by user: <div class="item-main-window-list-item--gXUlMEkj">
                const thumbnails = await productPage.$$('.item-main-window-list-item--gXUlMEkj');
                if (thumbnails.length > 0) {
                    console.log(`Clicking ${thumbnails.length} thumbnails...`);
                    for (const thumb of thumbnails) {
                        if (!isRunning || !browser.isConnected()) throw new Error('Browser closed or stopped');
                        await thumb.click();
                        await delay(800); // Increased wait for render
                    }
                }
            } catch(e) {
                console.log('Thumbnail click error:', e.message);
                if (e.message.includes('detached Frame') || e.message.includes('Session closed') || e.message.includes('Target closed')) {
                     throw e; // Re-throw to outer catch to stop scraping
                }
            }

            if (!isRunning) break;
            await humanDelay(2000, 4000);

            const data = await productPage.evaluate(() => {
                // User-provided title selector: .title--qJ7HP_99
                let title = '';
                const titleEl = document.querySelector('.title--qJ7HP_99');
                if (titleEl) {
                    title = titleEl.innerText.trim();
                }
                
                // Fallback: document.title
                if (!title) {
                    title = document.title || '';
                }

                // Full price text (e.g. ¥30包邮)
                let price = '';
                
                // User-provided price container selector: .value--EyQBSInp
                // Structure: .value--EyQBSInp > .symbol... + .price... + .post...
                const priceContainer = document.querySelector('.value--EyQBSInp');
                if (priceContainer) {
                    // Try to get just the price value div first if possible
                    const priceValueDiv = priceContainer.querySelector('.price--OEWLbcxC');
                    if (priceValueDiv) {
                        price = priceValueDiv.innerText.trim();
                    } else {
                        price = priceContainer.innerText.replace(/\n/g, '').trim();
                    }
                }
                
                // Fallback 1: .price-container--y2k82w00
                if (!price) {
                    const priceEl = document.querySelector('.price-container--y2k82w00');
                    if (priceEl) price = priceEl.innerText.trim();
                }
                
                // Fallback 2: Biggest font with currency
                if (!price || price === '¥' || price === '￥' || price === 'CNY') {
                     const candidates = Array.from(document.querySelectorAll('*'))
                        .filter(el => el.children.length === 0 && el.innerText && (el.innerText.includes('¥') || el.innerText.includes('CNY') || el.innerText.includes('￥')));
                     
                     if (candidates.length > 0) {
                        candidates.sort((a, b) => parseFloat(window.getComputedStyle(b).fontSize) - parseFloat(window.getComputedStyle(a).fontSize));
                        price = candidates[0].innerText.trim();
                     }
                }

                // Description
                // User-provided description selector: .desc--GaIUKUQY
                let description = '';
                
                // Try specific class first
                const descEl = document.querySelector('.desc--GaIUKUQY');
                if (descEl) {
                    // Replace <br> with newlines to preserve formatting
                    description = descEl.innerHTML.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim();
                }

                // Fallback: meta description
                if (!description) {
                     description = document.querySelector('meta[name="description"]')?.content || '';
                }
                
                // Fallback: .desc-container
                if (!description) {
                    const fallbackDesc = document.querySelector('.desc-container') || document.querySelector('div[class*="desc--"]');
                    if (fallbackDesc) description = fallbackDesc.innerText.trim();
                }

                // High Res Images
                // Main carousel image often updates after click
                let images = Array.from(document.querySelectorAll('.carouselItem--jwFj0Jpa img'))
                    .map(img => img.src)
                    .filter(src => src && !src.includes('grey.gif'));
                
                // Fallback: collect all large images if carousel empty
                if (images.length === 0) {
                    images = Array.from(document.querySelectorAll('img'))
                        .map(img => img.src)
                        .filter(src => src && src.startsWith('http') && !src.includes('avatar') && !src.includes('icon') && !src.includes('_110x10000') && !src.includes('_32x32'));
                }

                // Clean URLs
                images = images.map(src => {
                    const match = src.match(/(.*?\.(jpg|png|jpeg|heic))/i);
                    return match ? match[1] : src;
                });

                return { title, price, description, images: [...new Set(images)] };
            });

            // --- Post-Processing & AI ---
            // Fix price extraction: handle cases like "2人小刀价¥35.00原价¥55包邮"
            // We want the price before "包邮" if possible, or just the first valid number
            let general_price = 0;
            
            // Regex to find price range like "35 - 50"
            const rangeMatch = data.price.match(/(\d+(\.\d+)?)\s*-\s*(\d+(\.\d+)?)/);
            if (rangeMatch) {
                const minPrice = parseFloat(rangeMatch[1]);
                const maxPrice = parseFloat(rangeMatch[3]);
                general_price = `${minPrice * 200} - ${maxPrice * 200}`; // IQD Range
            } else {
                // Single price extraction logic
                let numericPrice = 0;
                // Regex to find price like 35.00 before "包邮" or just the first number
                const priceMatch = data.price.match(/(\d+(\.\d+)?)(?=[^\d]*包邮)/) || data.price.match(/(\d+(\.\d+)?)/);
                if (priceMatch) {
                    numericPrice = parseFloat(priceMatch[1]);
                }
                general_price = numericPrice * 200; // IQD Conversion
            }

            console.log(`Enriching data with AI for: ${data.title.substring(0, 30)}...`);
            const aiData = await enrichWithAI(data.title, data.description, data.price);

            const enrichedProduct = {
                product_name: aiData.product_name_ar || 'اسم غير متوفر',
                main_images: data.images,
                url: url,
                product_details: aiData.product_details_ar || {}, // Now a JSON object
                general_price: general_price, // e.g. "7000 - 10000" or 7000
                aiMetadata: aiData.aiMetadata || {}
            };

            products.push(enrichedProduct);
            
            // Save immediately
            if (isRunning) {
                console.log(`Saving product to: ${OUTPUT_FILE}`);
                fs.writeFileSync(OUTPUT_FILE, JSON.stringify(products, null, 2));
                console.log('Saved enriched product to JSON.');

                // --- INSERT INTO DATABASE ---
                try {
                    console.log('Inserting into Database...');
                    const dbProduct = await prisma.product.create({
                        data: {
                            name: enrichedProduct.product_name,
                            price: parseFloat(enrichedProduct.general_price) || 0,
                            basePriceIQD: parseFloat(enrichedProduct.general_price) || 0, // Assuming general_price is IQD
                            image: enrichedProduct.main_images[0] || '',
                            purchaseUrl: enrichedProduct.url,
                            status: 'PUBLISHED',
                            isActive: true,
                            isFeatured: false,
                            specs: JSON.stringify(enrichedProduct.product_details),
                            aiMetadata: enrichedProduct.aiMetadata,
                            domesticShippingFee: 0, // Default
                            deliveryTime: null,
                            images: {
                                create: enrichedProduct.main_images.map((img, idx) => ({
                                    url: img,
                                    order: idx,
                                    type: 'GALLERY'
                                }))
                            }
                        }
                    });
                    console.log(`Product saved to DB with ID: ${dbProduct.id}`);
                } catch (dbError) {
                    console.error('Database Insertion Error:', dbError.message);
                }
                // -----------------------------
            }
            
            // Random post-scrape delay (5-20s)
            await humanDelay(5000, 20000);

            await productPage.close();

        } catch (e) {
            console.error(`Error scraping ${url}: ${e.message}`);
            if (e.message.includes('detached Frame') || e.message.includes('Session closed') || e.message.includes('Target closed') || !browser.isConnected()) {
                console.log('Critical error or browser closed. Stopping scraper...');
                break;
            }
            if (productPage) await productPage.close().catch(() => {});
        }

        await humanDelay(5000, 15000); // Random delay 5-15s
    }

    console.log('[End] Scraping Complete.');
    await browser.close();
    await prisma.$disconnect();
}

run();
