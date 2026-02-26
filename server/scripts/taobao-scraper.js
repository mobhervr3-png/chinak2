import vanillaPuppeteer from 'puppeteer-core';
import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

const puppeteer = puppeteerExtra.addExtra(vanillaPuppeteer);
puppeteer.use(StealthPlugin());

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, '..', '.env');
dotenv.config({ path: envPath });

// --- SAFETY CHECK: PREVENT RUNNING IN PRODUCTION BY ACCIDENT ---
if (process.env.NODE_ENV === 'production' && process.env.ALLOW_SCRAPER_IN_PROD !== 'true') {
    console.error('CRITICAL: Scraper is BLOCKED in production environment.');
    console.error('To run this script on the server, set ALLOW_SCRAPER_IN_PROD=true in your environment variables.');
    process.exit(1);
}

const EDIBLE_KEYWORDS = [
    "é£ںه“پ", "é›¶é£ں", "ه‌ڑو‍œ", "ç½گه¤´", "é¥®و–™", "ç³–و‍œ", "é¥¼ه¹²", "è°ƒو–™", "èŒ¶", "é…’", 
    "è‚‰", "è›‹", "ه¥¶", "و²¹", "ç±³", "é‌¢", "و‍œه†»", "ه·§ه…‹هٹ›", "ه’–ه•،", "food", "snack", 
    "nut", "can", "drink", "candy", "biscuit", "seasoning", "tea", "wine", 
    "meat", "egg", "milk", "oil", "rice", "noodle", "jelly", "chocolate", "coffee",
    "هگƒ", "ه–‌", "ه‘³", "é¦™", "ç”œ", "è¾£", "ه’¸", "é…¸", "è‹¦"
];

const STRICT_EDIBLE_KEYWORDS = [
    "é£ںه“پ", "é›¶é£ں", "ه‌ڑو‍œ", "ç½گه¤´", "é¥®و–™", "ç³–و‍œ", "é¥¼ه¹²", "è°ƒو–™", "èŒ¶هڈ¶", "é…’و°´", 
    "é²œè‚‰", "é¸،è›‹", "ç‰›ه¥¶", "é£ںç”¨و²¹", "ه¤§ç±³", "é‌¢ç²‰", "و‍œه†»", "ه·§ه…‹هٹ›", "ه’–ه•،è±†",
    "ن؟‌هپ¥ه“پ", "ç»´ç”ںç´ ", "é’™ç‰‡", "é…µç´ ", "ç›ٹç”ںèڈŒ"
];

function isEdiblePreCheck(title, description) {
    const text = (title + " " + description).toLowerCase();
    for (const keyword of STRICT_EDIBLE_KEYWORDS) {
        if (text.includes(keyword)) {
            return { isEdible: true, keyword: keyword };
        }
    }
    return { isEdible: false };
}

let aiClient = null;

const AI_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS) > 0 ? Number(process.env.AI_TIMEOUT_MS) : 180000;
const AI_MAX_ATTEMPTS = Number(process.env.AI_MAX_ATTEMPTS) > 0 ? Number(process.env.AI_MAX_ATTEMPTS) : 3;
const AI_BASE_RETRY_DELAY_MS = Number(process.env.AI_BASE_RETRY_DELAY_MS) > 0 ? Number(process.env.AI_BASE_RETRY_DELAY_MS) : 1500;

const PUPPETEER_PROTOCOL_TIMEOUT_MS =
  Number(process.env.PUPPETEER_PROTOCOL_TIMEOUT_MS) > 0
    ? Number(process.env.PUPPETEER_PROTOCOL_TIMEOUT_MS)
    : 180000;
const PUPPETEER_DEFAULT_TIMEOUT_MS =
  Number(process.env.PUPPETEER_DEFAULT_TIMEOUT_MS) > 0
    ? Number(process.env.PUPPETEER_DEFAULT_TIMEOUT_MS)
    : 120000;

let AI_PRIMARY_MODEL = process.env.AI_MODEL || "qwen/qwen-vl-plus";
let AI_FALLBACK_MODEL = process.env.AI_FALLBACK_MODEL || AI_PRIMARY_MODEL;
let AI_MODEL = AI_PRIMARY_MODEL;
if (process.env.DEEPINFRA_API_KEY) {
    AI_PRIMARY_MODEL = process.env.DEEPINFRA_MODEL || process.env.AI_MODEL || "google/gemma-3-12b-it";
    AI_FALLBACK_MODEL = process.env.DEEPINFRA_FALLBACK_MODEL || "google/gemma-3-27b-it";
    AI_MODEL = AI_PRIMARY_MODEL;
    aiClient = new OpenAI({
        baseURL: "https://api.deepinfra.com/v1/openai",
        apiKey: process.env.DEEPINFRA_API_KEY,
        timeout: AI_TIMEOUT_MS,
        maxRetries: 0,
    });
    console.log(`AI Initialized (DeepInfra: primary=${AI_PRIMARY_MODEL}, fallback=${AI_FALLBACK_MODEL})`);
} else {
    console.log('Warning: No AI API KEY found. AI features will use mock data.');
}

const isModelBusyError = (e) => {
    const message = (e && e.message) ? String(e.message) : String(e);
    const code = (e && e.code) ? e.code : '';
    return (
        message.includes('429') ||
        String(code) === '429' ||
        message.toLowerCase().includes('model busy') ||
        message.toLowerCase().includes('rate limit') ||
        message.toLowerCase().includes('too many requests')
    );
};

const isTimeoutError = (e) => {
    const message = (e && e.message) ? String(e.message) : String(e);
    const name = (e && e.name) ? String(e.name) : '';
    const code = (e && e.code) ? String(e.code) : '';
    const status = (e && typeof e.status !== 'undefined') ? String(e.status) : '';
    return (
        name.toLowerCase().includes('timeout') ||
        message.toLowerCase().includes('timeout') ||
        code === 'ETIMEDOUT' ||
        code === 'UND_ERR_CONNECT_TIMEOUT' ||
        code === 'ECONNRESET' ||
        message.toLowerCase().includes('socket hang up') ||
        status === '408'
    );
};

const AI_BUSY_FALLBACK_MODEL = "google/gemma-3-27b-it";

const cliUrl = process.argv[2];
let CATEGORY_URL = cliUrl && cliUrl.startsWith('http') ? cliUrl : '';

const OUTPUT_FILE = path.join(__dirname, '..', 'taobao-products.json');
const LINKS_FILE = path.join(__dirname, '..', 'taobao-links.json');
const PAGE_LOAD_TIMEOUT = 60000;
const TAOBAO_MAX_PAGES = Number(process.env.TAOBAO_MAX_PAGES || 50);
const TAOBAO_LINK_TARGET = Number(process.env.TAOBAO_LINK_TARGET || 100);

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

async function enrichWithAI(title, description, price) {
    if (!aiClient) {
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
        const safeTitle = String(title || '').slice(0, 220);
        const safeDescription = String(description || '').slice(0, 600);
        const safePrice = String(price || '').slice(0, 50);

        const prompt = `
        You are a product data enrichment assistant for an Iraqi e-commerce site.
        
        Original Product Title (Chinese): "${safeTitle}"
        Product Description: "${safeDescription}"
        Price: "${safePrice}"

        Task:
        1. Extract the Brand Name in English (e.g., "Nike", "Sony", "Xiaomi"). If no brand is found, ignore it.
        2. Translate the Product Name to ARABIC accurately.
           - TARGET LANGUAGE: ARABIC (Iraq dialect or MSA).
           - INPUT: Chinese -> OUTPUT: Arabic.
           - DO NOT output English (except for the Brand Name).
           - Remove marketing fluff like "hot sale", "new arrival", "2024", "Ready Stock".
           - Example: "冬季加绒卫衣" -> "كنزة شتوية مبطنة" (NOT "Winter Fleece Sweater").
        3. Combine them into "product_name_ar" format: "[Arabic Name]".
           - ONLY include the brand if it is a well-known international brand (e.g. Nike, Adidas, Sony).
           - If the brand is generic, unknown, or "No Brand", DO NOT include it in the title.
           - NEVER include text like "No Brand", "Generic", "Other", "ماركة غير معروفة" in the title.
           - IMPORTANT: You MUST translate the actual title. Do NOT use placeholder text like "اسم المنتج بالعربية".
        4. Extract "product_details_ar" as a structured Key-Value JSON object in ARABIC.
        5. Generate "aiMetadata" based strictly on the product Title and Description.
            - "synonyms": Array of 3-5 alternative Arabic names SPECIFIC to this product.
            - "market_tags": Array of 3-5 relevant tags in Arabic.
            - "category_suggestion": A specific category path in Arabic.
        6. DETECT IF THE PRODUCT IS EDIBLE (Food, Drink, Nuts, Cans, Snacks, Ingredients, Supplements, Vitamins, Medicine).
            - Set "is_edible": true if it is food/edible/supplement.
            - Set "is_edible": false if it is NOT edible (e.g. clothes, electronics, tools).
            - BE VERY CAREFUL. "Food Container" is NOT edible. "Dog Food" IS edible (sort of, but usually restricted). "Almond Oil for Skin" is NOT edible (cosmetic). "Almond Oil for Cooking" IS edible.
            - If in doubt, set true to be safe.

         CRITICAL INSTRUCTIONS:
         - The "product_name_ar" MUST be in ARABIC script (except the brand).
        - If the original title is "WASSUP BEAVER...", translate "WASSUP BEAVER" as the Brand, and the rest as the Arabic name.
        - NEVER return "اسم غير متوفر" (Name Not Available). ALWAYS generate a descriptive Arabic name based on the description if the title is unclear.
        - Example: If title is "2025 Winter Jacket", output "سترة شتوية 2025".
        - The translation MUST be high quality and natural for Arabic speakers in Iraq.
        - If the product name is vague or generic in Chinese, infer the specific type from description or context.
        - The "product_details_ar" field MUST be a JSON OBJECT (key-value pairs), NOT a string.
        - Example format for details:
          "product_details_ar": { 
              "المادة": "قماش كتان", 
              "الميزة": "ألوان متعددة", 
              "التصميم": "إبداعي", 
              "الاستخدام": "غرفة المعيشة" 
          }
        - STRICTLY EXCLUDE any "return policy", "refund", "replacement", "shipping", "free shipping", or "guarantee" information from details.
        - STRICTLY EXCLUDE any PRICE or COST information (e.g., "السعر", "Price", "29.9 ريال") from details.
        - DO NOT include keys with EMPTY values (e.g. "الماركة": "" should be removed).
        - Do NOT include any Chinese characters (like ¥, 包邮, 品牌, etc.) in values.
        - English text IS ALLOWED for Brand Names and Model Numbers.
        - Convert all prices and measurements to Arabic format if possible.

        Return ONLY a valid JSON object with this structure (no markdown, no \`\`\`json blocks):
        {
            "product_name_ar": "Put Translated Name Here",
            "is_edible": false,
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

        let attempts = 0;
        
        while (attempts < AI_MAX_ATTEMPTS) {
            try {
                const create = async (model) => {
                    return await aiClient.chat.completions.create({
                        model,
                        messages: [{ role: "user", content: prompt }],
                        temperature: 0.2,
                        max_tokens: 1000,
                    });
                };

                let response;
                try {
                    response = await create(AI_PRIMARY_MODEL);
                } catch (e) {
                    if (isTimeoutError(e)) {
                        throw e;
                    }
                    if (isModelBusyError(e)) {
                        console.log(`AI busy on ${AI_PRIMARY_MODEL}. Falling back to ${AI_BUSY_FALLBACK_MODEL}...`);
                        response = await create(AI_BUSY_FALLBACK_MODEL);
                    } else if (AI_FALLBACK_MODEL && AI_FALLBACK_MODEL !== AI_PRIMARY_MODEL) {
                        console.log(`AI error on ${AI_PRIMARY_MODEL}. Falling back to ${AI_FALLBACK_MODEL}...`);
                        response = await create(AI_FALLBACK_MODEL);
                    } else {
                        throw e;
                    }
                }

                let text = response.choices[0].message.content;
                text = text.replace(/```json/g, '').replace(/```/g, '').trim();
                text = text.replace(/,(\s*[}\]])/g, '$1');
                
                const jsonStart = text.indexOf('{');
                let parsed = null;

                if (jsonStart !== -1) {
                    let endSearchPos = text.lastIndexOf('}');
                    while (endSearchPos > jsonStart) {
                        try {
                            const candidate = text.substring(jsonStart, endSearchPos + 1);
                            parsed = JSON.parse(candidate);
                            break;
                        } catch (e) {
                            endSearchPos = text.lastIndexOf('}', endSearchPos - 1);
                        }
                    }
                }

                if (!parsed) {
                    console.error("Failed to parse AI response. Raw text:", text);
                    throw new Error("JSON parsing failed after multiple attempts.");
                }

                if (parsed.product_name_ar) {
                     const badNames = [
                         'اسم غير متوفر',
                         'name not available',
                         'اسم المنتج بالعربيه',
                         'اسم المنتج بالعربية',
                         'put translated name here',
                         'arabic name',
                         'ترجمة اسم المنتج'
                      ];
                     const lowered = String(parsed.product_name_ar).toLowerCase();
                     if (badNames.some(b => lowered.includes(b))) {
                        console.error("Invalid AI product name returned. Forcing retry.");
                        throw new Error("AI returned placeholder product name.");
                     }
                } else {
                    throw new Error("AI did not return product_name_ar.");
                }

                const stripChinese = (str) => {
                    if (!str || typeof str !== 'string') return str;
                    return str.replace(/[\u4e00-\u9fa5]+/g, '').trim();
                };

                if (parsed.product_details_ar && typeof parsed.product_details_ar === 'object') {
                    for (const key in parsed.product_details_ar) {
                        if (parsed.product_details_ar[key]) {
                            parsed.product_details_ar[key] = stripChinese(parsed.product_details_ar[key]);
                            if (/[\u4e00-\u9fa5]/.test(parsed.product_details_ar[key])) {
                                delete parsed.product_details_ar[key];
                            }
                            if (!parsed.product_details_ar[key] || parsed.product_details_ar[key].trim() === '') {
                                delete parsed.product_details_ar[key];
                            }
                        }
                    }

                    if (parsed.aiMetadata) {
                         if (!Array.isArray(parsed.aiMetadata.synonyms)) parsed.aiMetadata.synonyms = [];
                         if (!Array.isArray(parsed.aiMetadata.market_tags)) parsed.aiMetadata.market_tags = [];
                         if (!parsed.aiMetadata.category_suggestion) parsed.aiMetadata.category_suggestion = "ط¹ط§ظ…";
                    } else {
                        parsed.aiMetadata = {
                            synonyms: [],
                            market_tags: [],
                            category_suggestion: "ط¹ط§ظ…"
                        };
                    }
                }

                return parsed;
                
            } catch (e) {
                attempts++;
                console.log(`AI attempt ${attempts}/${AI_MAX_ATTEMPTS} failed: ${e.message}`);
                
                if (attempts < AI_MAX_ATTEMPTS) {
                    const waitTime = AI_BASE_RETRY_DELAY_MS + Math.floor(Math.random() * 500);
                    await delay(waitTime);
                } else {
                    console.log("Max AI attempts reached.");
                }
            }
        }

        throw new Error("Max AI attempts reached");
    } catch (e) {
        console.error("AI Generation Error:", e.message);
        return {
            shouldSkip: true,
            reason: "AI Translation Failed (Max Attempts)"
        };
    }
}

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

const delay = (ms) => new Promise(resolve => {
    const end = Date.now() + ms;
    const timer = setInterval(() => {
        if (Date.now() >= end) {
            clearInterval(timer);
            resolve();
        }
    }, 100);
});
const humanDelay = (min = 1000, max = 3000) => delay(Math.floor(Math.random() * (max - min + 1)) + min);

async function configurePage(page) {
    if (!page) return;
    try { page.setDefaultTimeout(PUPPETEER_DEFAULT_TIMEOUT_MS); } catch (e) {}
    try { page.setDefaultNavigationTimeout(PUPPETEER_DEFAULT_TIMEOUT_MS); } catch (e) {}
    
    try {
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => false });
            Object.defineProperty(navigator, 'languages', { get: () => ['zh-CN', 'zh', 'en'] });
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
            window.chrome = { runtime: {} };
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) => (
                parameters.name === 'notifications' ?
                Promise.resolve({ state: 'denied' }) :
                originalQuery(parameters)
            );
        });
    } catch (e) {}
}

async function safeGoto(page, url, options = {}, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await page.goto(url, options);
        } catch (e) {
            const msg = e.message || '';
            if (i === maxRetries - 1) throw e;
            if (msg.includes('ERR_CONNECTION_REFUSED') || 
                msg.includes('ERR_CONNECTION_RESET') || 
                msg.includes('Timeout') ||
                msg.includes('net::ERR_')) {
                console.log(`[Navigation] Retry ${i+1}/${maxRetries} for ${url} (${msg})`);
                await delay(2000 * (i + 1));
            } else {
                throw e;
            }
        }
    }
}

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
    protocolTimeout: PUPPETEER_PROTOCOL_TIMEOUT_MS,
    userDataDir: 'chrome_data_taobao_persistent',
    args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-infobars',
        '--window-position=0,0',
        '--ignore-certificate-errors',
        '--ignore-certificate-errors-spki-list',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        '--lang=zh-CN,zh'
    ]
  });

  const page = (await browser.pages())[0];
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    Object.defineProperty(navigator, 'languages', { get: () => ['zh-CN', 'zh', 'en'] });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    window.chrome = { runtime: {} };
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters) => (
      parameters.name === 'notifications' ?
        Promise.resolve({ state: 'denied' }) :
        originalQuery(parameters)
    );
  });
  
  return browser;
}

async function collectProductLinks(page) {
    const links = await page.evaluate(() => {
        const out = new Set();
        const normalize = (href, itemId) => {
            if (!href) return null;
            let url = href.trim();
            if (url.startsWith('//')) url = `https:${url}`;
            if (url.startsWith('/')) url = location.origin + url;
            if (url.includes('click.simba.taobao.com')) {
                if (itemId) return `https://detail.tmall.com/item.htm?id=${itemId}`;
                try {
                    const u = new URL(url);
                    const id = u.searchParams.get('id');
                    if (id) return `https://detail.tmall.com/item.htm?id=${id}`;
                } catch (e) {}
                return null;
            }
            return url;
        };
        const pickFrom = (a) => {
            const href = a.getAttribute('href') || '';
            let itemId = '';
            const spmId = a.getAttribute('data-spm-act-id') || '';
            if (spmId) itemId = spmId;
            if (!itemId) {
                const idAttr = a.getAttribute('id') || '';
                const match = idAttr.match(/item_id_(\d+)/);
                if (match) itemId = match[1];
            }
            const normalized = normalize(href, itemId);
            if (!normalized) return;
            if (normalized.includes('amos.alicdn.com')) return;
            if (!(normalized.includes('detail.tmall.com/item.htm') || normalized.includes('item.taobao.com/item.htm'))) return;
            out.add(normalized);
        };
        const containers = Array.from(document.querySelectorAll('.doubleCardWrapperAdapt--mEcC7olq'));
        for (const c of containers) pickFrom(c);
        return Array.from(out);
    });
    return links;
}

async function slowScroll(page) {
    let lastHeight = 0;
    let stableCount = 0;
    for (let i = 0; i < 40; i++) {
        await page.evaluate(() => {
            window.scrollBy(0, Math.floor(window.innerHeight * 0.7));
        });
        await humanDelay(800, 1400);
        const height = await page.evaluate(() => document.body.scrollHeight);
        if (height <= lastHeight + 50) {
            stableCount += 1;
        } else {
            stableCount = 0;
            lastHeight = height;
        }
        if (stableCount >= 3) break;
    }
}

async function clickNextPage(page) {
    const didClick = await page.evaluate(() => {
        const nodes = Array.from(document.querySelectorAll('a, button, span'));
        const target = nodes.find(n => {
            const t = (n.textContent || '').trim();
            return t === '下一页' || t.includes('下一页');
        });
        if (target && target.click) {
            target.click();
            return true;
        }
        return false;
    });
    return didClick;
}

async function extractProductData(page) {
    // Wait for critical data objects or elements
    try {
        await page.waitForFunction(() => {
            return window.__ICE_APP_CONTEXT__ || 
                   window.TShop || 
                   window.Hub || 
                   document.querySelector('.mainTitle--R75fTcZL');
        }, { timeout: 15000 });
    } catch (e) {
        console.log('Timeout waiting for ICE/TShop context, proceeding anyway...');
    }

    return await page.evaluate(() => {
        const titleEl = document.querySelector('.mainTitle--R75fTcZL');
        let title = titleEl ? titleEl.innerText.trim() : '';
        if (!title) title = document.title || '';

        const priceEl = document.querySelector('[class*="price"]') || document.querySelector('.tb-rmb-num');
        const price = priceEl ? (priceEl.innerText || priceEl.textContent || '').trim() : '';

        const descEl = document.querySelector('.paramsWrap--H4YJB7Yk');
        let description = descEl ? (descEl.innerText || descEl.textContent || '').trim() : '';
        if (!description) {
            const metaDesc = document.querySelector('meta[name="description"]');
            description = metaDesc ? (metaDesc.getAttribute('content') || '').trim() : '';
        }

        const imageEls = [
            ...Array.from(document.querySelectorAll('.thumbnailItem--WQyauvvr img')),
            ...Array.from(document.querySelectorAll('.mainPicWrap--Ns5WQiHr img'))
        ];

        const images = imageEls
            .map(img => img.getAttribute('src') || img.getAttribute('data-src') || '')
            .filter(Boolean)
            .map(src => src.startsWith('//') ? `https:${src}` : src)
            .filter(src => src.startsWith('http'))
            .filter((v, i, a) => a.indexOf(v) === i);

        const parseContext = () => {
            if (window.__ICE_APP_CONTEXT__) return window.__ICE_APP_CONTEXT__;
            
            // Try searching scripts for JSON patterns
            const scripts = Array.from(document.querySelectorAll('script'));
            for (const s of scripts) {
                const text = s.textContent || '';
                
                // Check for __ICE_APP_CONTEXT__ pattern specifically
                if (text.includes('__ICE_APP_CONTEXT__')) {
                     // Try brace counting for "var b = {" or similar pattern after __ICE_APP_CONTEXT__
                     // The pattern is: window.__ICE_APP_CONTEXT__ || {};var b = {
                     const idx = text.indexOf('window.__ICE_APP_CONTEXT__');
                     if (idx !== -1) {
                         const startSearch = idx + 'window.__ICE_APP_CONTEXT__'.length;
                         // Regex for "var ... = {"
                         const varRegex = /var\s+[a-zA-Z0-9_]+\s*=\s*\{/g;
                         varRegex.lastIndex = startSearch;
                         // We need to search in substring from startSearch because lastIndex only works with exec() in a loop or if 'y' flag is used?
                         // Actually, matching against substring is safer.
                         const snippet = text.substring(startSearch, startSearch + 200);
                         const match = snippet.match(/var\s+[a-zA-Z0-9_]+\s*=\s*\{/);
                         
                         if (match) {
                             const jsonStart = startSearch + match.index + match[0].length - 1; // Points to {
                             let balance = 0;
                             let jsonEnd = -1;
                             let inString = false;
                             let escape = false;
                             
                             for (let i = jsonStart; i < text.length; i++) {
                                 const char = text[i];
                                 if (escape) { escape = false; continue; }
                                 if (char === '\\') { escape = true; continue; }
                                 if (char === '"') { inString = !inString; continue; }
                                 if (!inString) {
                                     if (char === '{') balance++;
                                     else if (char === '}') {
                                         balance--;
                                         if (balance === 0) {
                                             jsonEnd = i + 1;
                                             break;
                                         }
                                     }
                                 }
                             }
                             
                             if (jsonEnd !== -1) {
                                 try {
                                     const jsonStr = text.substring(jsonStart, jsonEnd);
                                     const json = JSON.parse(jsonStr);
                                     if (json.loaderData || json.data) return json;
                                 } catch (e) {}
                             }
                         }
                     }
                }
                
                // Fallback to simple extraction for TShop/Hub or generic JSON
                if (text.includes('TShop.Setup') || text.includes('Hub.config')) {
                    try {
                        let start = text.indexOf('{');
                        let end = text.lastIndexOf('}');
                        if (start !== -1 && end !== -1 && end > start) {
                             const potentialJson = text.slice(start, end + 1);
                             const json = JSON.parse(potentialJson);
                             if (json.valItemInfo || json.itemDO) return json;
                        }
                    } catch (e) {}
                }
            }
            return null;
        };

        const ctx = parseContext();
        
        let res = ctx?.data?.res || null;
        if (!res && ctx?.loaderData) {
            // Try to find 'data.res' in any loaderData key (e.g. 'home', 'item', 'detail')
            for (const key in ctx.loaderData) {
                const routeData = ctx.loaderData[key];
                if (routeData?.data?.res) {
                    res = routeData.data.res;
                    break;
                }
            }
        }
        
        // Fallback: check for legacy TShop/Hub data if ICE not found
        if (!res && window.TShop && window.TShop.Setup) {
             const setup = window.TShop.Setup;
             res = {
                 item: setup.itemDO,
                 skuBase: {
                     props: [], 
                     skus: setup.valItemInfo?.skuList || []
                 },
                 skuCore: {
                     sku2info: setup.valItemInfo?.skuMap || {}
                 }
             };
        }

        let sku2info = res?.skuCore?.sku2info || res?.sku2info || null;
        if (!sku2info && ctx?.loaderData) {
             // Try to find sku2info in any loaderData key
             for (const key in ctx.loaderData) {
                 const routeData = ctx.loaderData[key];
                 if (routeData?.data?.skuCore?.sku2info) {
                     sku2info = routeData.data.skuCore.sku2info;
                     break;
                 }
             }
        }
        
        let skuBase = res?.skuBase || null;
        
        // If sku2info is missing but skuBase.skus exists, try to build sku2info from skus (common in some API responses)
        if ((!sku2info || Object.keys(sku2info).length === 0) && skuBase && Array.isArray(skuBase.skus)) {
            const tempInfo = {};
            let foundPrice = false;
            for (const sku of skuBase.skus) {
                if (sku.skuId) {
                    const p = sku.promotionPrice || sku.price || sku.priceChar || '0';
                    if (p) {
                        tempInfo[sku.skuId] = {
                            price: {
                                priceText: p,
                                priceMoney: sku.priceMoney || (parseFloat(p) * 100)
                            },
                            subPrice: {
                                priceText: sku.promotionPrice || p
                            }
                        };
                        foundPrice = true;
                    }
                }
            }
            if (foundPrice) sku2info = tempInfo;
        }
        const itemInfo = res?.item || null;
        
        let basicParamList = res?.plusViewVO?.industryParamVO?.basicParamList || [];
        if (basicParamList.length === 0 && ctx?.loaderData) {
            // Try to find basicParamList in any loaderData key
             for (const key in ctx.loaderData) {
                 const routeData = ctx.loaderData[key];
                 if (routeData?.data?.plusViewVO?.industryParamVO?.basicParamList) {
                     basicParamList = routeData.data.plusViewVO.industryParamVO.basicParamList;
                     break;
                 }
             }
        }
        let colorList = [];
        const colorParam = Array.isArray(basicParamList)
            ? basicParamList.find(p => String(p?.propertyName || '').includes('颜色分类') || String(p?.propertyName || '').includes('颜色'))
            : null;
        if (colorParam) {
            if (Array.isArray(colorParam.values)) {
                colorList = colorParam.values.map(v => v?.name || v?.text || v?.value).filter(Boolean);
            } else if (typeof colorParam.propertyValue === 'string') {
                colorList = colorParam.propertyValue.split(/[,，]/).map(s => s.trim()).filter(Boolean);
            }
        }

        const domColorList = [];
        const skuRoot = document.querySelector('#SkuPanel_tbpcDetail_ssr2025') || document;
        const skuItems = Array.from(skuRoot.querySelectorAll('.skuItem--Z2AJB9Ew'));
        const pushDomColor = (text, skuId, thumb) => {
            const t = (text || '').trim();
            if (!t) return;
            if (!domColorList.find(v => v.text === t)) {
                domColorList.push({ text: t, skuId: skuId || '', thumb: thumb || '' });
            }
        };
        for (const item of skuItems) {
            const labelEl = item.querySelector('.ItemLabel--psS1SOyC span, .ItemLabel--psS1SOyC, .labelWrap--ffBEejeJ span, .labelWrap--ffBEejeJ');
            const labelText = labelEl ? (labelEl.textContent || '').trim() : '';
            const valueWrap = item.querySelector('.skuValueWrap--aEfxuhNr') || item;
            const valueItems = Array.from(valueWrap.querySelectorAll('.valueItem--smR4pNt4'));
            if (valueItems.length > 0) {
                for (const v of valueItems) {
                    const textEl = v.querySelector('.valueItemText--T7YrR8tO');
                    const text = (textEl?.getAttribute('title') || textEl?.textContent || '').trim();
                    const skuId = v.getAttribute('data-vid') || '';
                    const imgEl = v.querySelector('.valueItemImgWrap--ZvA2Cmim img, img.valueItemImg--GC9bH5my');
                    const img = (imgEl?.getAttribute('src') || imgEl?.getAttribute('data-src') || '').trim();
                    pushDomColor(text, skuId, img);
                }
            } else if (labelText.includes('颜色')) {
                const optionEls = Array.from(valueWrap.querySelectorAll('[data-sku-id],[data-skuid],[data-skuid],[data-skuId],li,a,button,span'));
                for (const el of optionEls) {
                    const text = (el.getAttribute('title') || el.textContent || '').trim();
                    if (!text) continue;
                    if (text === labelText) continue;
                    const skuId = el.getAttribute('data-sku-id') || el.getAttribute('data-skuid') || el.getAttribute('data-skuid') || el.getAttribute('data-skuId') || '';
                    pushDomColor(text, skuId, '');
                }
            }
        }

        return {
            title,
            price,
            description,
            images,
            sku2info,
            colorList,
            domColorList,
            skuBase,
            itemInfo
        };
    });
}

async function translateComments(comments) {
    if (!aiClient || !comments || comments.length === 0) return comments;
    const isObjectList = Array.isArray(comments) && comments.every(c => c && typeof c === 'object');
    const clean = (isObjectList ? comments.map(c => c.content) : comments)
        .map(c => String(c || '').replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .slice(0, 8);
    if (clean.length === 0) return isObjectList ? comments : [];
    const prompt = `
    Translate these Taobao review comments to Arabic.
    Return ONLY a JSON array, same length and order.
    Each item: {"c": "translated comment"}
    Input: ${JSON.stringify(clean)}
    `;
    const translate = async (model) => {
        return await aiClient.chat.completions.create({
            model,
            messages: [{ role: "user", content: prompt }],
            temperature: 0.3,
            max_tokens: 1000
        });
    };
    let res;
    try {
        res = await translate(AI_PRIMARY_MODEL);
    } catch (e) {
        if (isTimeoutError(e)) throw e;
        if (isModelBusyError(e)) {
            res = await translate(AI_BUSY_FALLBACK_MODEL);
        } else if (AI_FALLBACK_MODEL && AI_FALLBACK_MODEL !== AI_PRIMARY_MODEL) {
            res = await translate(AI_FALLBACK_MODEL);
        } else {
            throw e;
        }
    }
    let jsonStr = res.choices[0].message.content.replace(/```json/g, '').replace(/```/g, '').trim();
    const start = jsonStr.indexOf('[');
    const end = jsonStr.lastIndexOf(']');
    if (start !== -1 && end !== -1) jsonStr = jsonStr.substring(start, end + 1);
    let parsed = [];
    try {
        parsed = JSON.parse(jsonStr);
    } catch (e) {
        parsed = [];
    }
    if (!Array.isArray(parsed) || parsed.length !== clean.length) return isObjectList ? comments : clean;
    if (!isObjectList) return parsed.map((p, i) => ({ original: clean[i], translated: String(p?.c || '').trim() || clean[i] }));
    return comments.map((c, i) => ({
        ...c,
        content: String(parsed[i]?.c || '').trim() || String(c?.content || '').trim()
    }));
}

async function extractDescImages(page) {
    try {
        await page.evaluate(() => {
            const anchor = document.querySelector('.RecommendInfo--Q8RLYLUz');
            if (anchor && anchor.scrollIntoView) anchor.scrollIntoView({ block: 'start' });
        });
    } catch (e) {}
    await delay(2000);
    await page.evaluate(() => {
        const container = document.querySelector('.descV8-container');
        if (!container) return;
        return new Promise(resolve => {
            let lastTop = -1;
            let sameCount = 0;
            const step = () => {
                const maxTop = container.scrollHeight - container.clientHeight;
                if (maxTop <= 0) {
                    resolve();
                    return;
                }
                const nextTop = Math.min(container.scrollTop + Math.max(120, Math.floor(container.clientHeight * 0.6)), maxTop);
                container.scrollTop = nextTop;
                if (container.scrollTop === lastTop) {
                    sameCount += 1;
                } else {
                    sameCount = 0;
                    lastTop = container.scrollTop;
                }
                if (container.scrollTop >= maxTop || sameCount >= 4) {
                    resolve();
                    return;
                }
                setTimeout(step, 200);
            };
            step();
        });
    });
    await delay(800);
    return await page.evaluate(() => {
        const imgs = Array.from(document.querySelectorAll('.descV8-singleImage img'))
            .map(img => img.getAttribute('src') || img.getAttribute('data-src') || '')
            .filter(Boolean)
            .map(src => src.startsWith('//') ? `https:${src}` : src)
            .filter(src => src.startsWith('http'));
        return Array.from(new Set(imgs));
    });
}

async function extractComments(page) {
    try {
        await page.evaluate(() => {
            const byClass = document.querySelector('.ShowButton--fMu7HZNs');
            if (byClass && byClass.click) {
                byClass.click();
                return;
            }
            const nodes = Array.from(document.querySelectorAll('a, button, span, div'));
            const target = nodes.find(n => (n.textContent || '').trim().includes('查看全部评价'));
            if (target && target.click) target.click();
        });
    } catch (e) {}
    await delay(5000);
    const raw = await page.evaluate(() => {
        const comments = [];
        const nodes = Array.from(document.querySelectorAll('.Comment--H5QmJwe9'));
        for (const n of nodes) {
            const name = (n.querySelector('.userName--KpyzGX2s')?.textContent || '').trim();
            const meta = (n.querySelector('.meta--PLijz6qf')?.textContent || '').trim();
            const content = (n.querySelector('.content--uonoOhaz')?.textContent || '').replace(/\s+/g, ' ').trim();
            const album = n.querySelector('.album--sq8vrGV3');
            if (album) {
                const opener = album.querySelector('button, a, div, span');
                if (opener && opener.click) opener.click();
            }
            const photos = album
                ? Array.from(album.querySelectorAll('img'))
                    .map(img => img.getAttribute('src') || img.getAttribute('data-src') || '')
                    .filter(Boolean)
                    .map(src => src.startsWith('//') ? `https:${src}` : src)
                    .filter(src => src.startsWith('http'))
                : [];
            if (!name && !content) continue;
            comments.push({
                name,
                meta,
                content,
                photos: Array.from(new Set(photos))
            });
            if (comments.length >= 8) break;
        }
        return comments;
    });
    return raw.slice(0, 8);
}

async function closeCommentsModal(page) {
    try {
        await page.evaluate(() => {
            const closeBtn = document.querySelector('.closeWrap--IAcEEbMy');
            if (!closeBtn) return;
            const rect = closeBtn.getBoundingClientRect();
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            const evt = new MouseEvent('click', { bubbles: true, cancelable: true, view: window, clientX: cx, clientY: cy });
            closeBtn.dispatchEvent(evt);
        });
    } catch (e) {}
}

async function translateTexts(texts) {
    if (!aiClient || !texts || texts.length === 0) return {};
    const clean = Array.from(new Set(texts.map(t => String(t || '').trim()).filter(Boolean)));
    if (clean.length === 0) return {};
    
    const chunks = [];
    for (let i = 0; i < clean.length; i += 20) {
        chunks.push(clean.slice(i, i + 20));
    }
    
    const resultMap = {};
    for (const chunk of chunks) {
        const prompt = `
        Translate these Taobao product option names (colors/sizes) to Arabic (Iraqi dialect if applicable).
        Keep numbers and units (cm, mm, kg) as is.
        Return ONLY a JSON object where keys are original text and values are translated text.
        Example: {"红色": "أحمر", "XL": "XL"}
        Input: ${JSON.stringify(chunk)}
        `;
        
        try {
            const res = await aiClient.chat.completions.create({
                model: AI_PRIMARY_MODEL,
                messages: [{ role: "user", content: prompt }],
                temperature: 0.3,
                max_tokens: 1000
            });
            let jsonStr = res.choices[0].message.content.replace(/```json/g, '').replace(/```/g, '').trim();
            const start = jsonStr.indexOf('{');
            const end = jsonStr.lastIndexOf('}');
            if (start !== -1 && end !== -1) {
                const parsed = JSON.parse(jsonStr.substring(start, end + 1));
                Object.assign(resultMap, parsed);
            }
        } catch (e) {
            console.error('Translation error:', e.message);
        }
        await delay(500);
    }
    return resultMap;
}

async function run() {
    console.log('[Start] Initializing Taobao Scraper...');
    console.log('argv:', process.argv);
    if (!CATEGORY_URL) {
        const input = await askQuestion('Enter the Taobao Category URL to scrape: ');
        CATEGORY_URL = String(input || '').trim();
    }
    if (!CATEGORY_URL.startsWith('http')) {
        console.error('Invalid URL provided. The URL must start with "http" or "https".');
        process.exit(1);
    }

    const browser = await createBrowser();
    console.log('Browser launched');
    const page = await browser.newPage();
    await configurePage(page);

    console.log('Opening Taobao login page...');
    await safeGoto(page, 'https://www.taobao.com/', { waitUntil: 'domcontentloaded', timeout: PAGE_LOAD_TIMEOUT });
    console.log('Waiting 1 seconds for stability...');
    await delay(1000);
    console.log('Delay finished.');

    const allLinks = new Set();
    console.log('CATEGORY_URL:', CATEGORY_URL);
    const isItemUrl = CATEGORY_URL.includes('item.htm') || CATEGORY_URL.includes('detail.tmall.com');
    console.log('isItemUrl:', isItemUrl);

    if (isItemUrl) {
        console.log('Single item URL detected. Skipping category scraping.');
        allLinks.add(CATEGORY_URL);
    } else {
        console.log('Navigating to category page...');
        await safeGoto(page, CATEGORY_URL, { waitUntil: 'domcontentloaded', timeout: PAGE_LOAD_TIMEOUT });
        await delay(5000);

        try {
            fs.writeFileSync(LINKS_FILE, JSON.stringify([], null, 2));
        } catch (e) {}

        let pageIndex = 0;
        while (isRunning) {
            pageIndex += 1;
            await slowScroll(page);
            const links = await collectProductLinks(page);
            for (const l of links) allLinks.add(l);
            fs.writeFileSync(LINKS_FILE, JSON.stringify(Array.from(allLinks), null, 2));

            if (TAOBAO_LINK_TARGET > 0 && allLinks.size >= TAOBAO_LINK_TARGET) break;
            if (TAOBAO_MAX_PAGES > 0 && pageIndex >= TAOBAO_MAX_PAGES) break;
            const clicked = await clickNextPage(page);
            if (!clicked) break;
            await Promise.race([
                page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => null),
                delay(5000)
            ]);
            await delay(3000);
        }
    }

    const linkList = Array.from(allLinks).slice(0, TAOBAO_LINK_TARGET > 0 ? TAOBAO_LINK_TARGET : undefined);
    console.log(`Collected ${linkList.length} product links.`);

    let products = [];
    try {
        if (fs.existsSync(OUTPUT_FILE)) {
            products = JSON.parse(fs.readFileSync(OUTPUT_FILE));
        }
    } catch (e) {}

    for (const productUrl of linkList) {
        if (!isRunning) break;
        const productPage = await browser.newPage();
        await configurePage(productPage);

        let interceptedSkuInfo = {};
                        productPage.on('response', async res => {
             const url = res.url();
             if (url.includes('mtop') || url.includes('detail') || url.includes('get') || url.includes('batch')) {
                 try {
                     const text = await res.text();
                     if (text.includes('sku') || text.includes('price')) {
                          let jsonStr = text;
                          if (jsonStr.trim().startsWith('mtopjsonp')) {
                              const match = jsonStr.match(/mtopjsonp\w+\((.*)\)/);
                              if (match) jsonStr = match[1];
                          }
                          try {
                              const json = JSON.parse(jsonStr);
                              
                              // Check apiStack
                              const stack = json.data?.apiStack || json.apiStack;
                              if (stack && Array.isArray(stack)) {
                                   const val = stack[0]?.value;
                                   if (val) {
                                       try {
                                           const pStack = JSON.parse(val);
                                           // 1. Check sku2info
                                           const s2i = pStack.skuCore?.sku2info || pStack.data?.skuCore?.sku2info || pStack.global?.data?.skuCore?.sku2info;
                                           if (s2i) {
                                               console.log(`[Scraper] Found sku2info in apiStack from ${url}`);
                                               Object.assign(interceptedSkuInfo, s2i);
                                           }

                                           // 2. Check for sku2price or similar maps
                                           const s2p = pStack.skuCore?.sku2price || pStack.data?.skuCore?.sku2price;
                                           if (s2p) {
                                               console.log(`[Scraper] Found sku2price in apiStack from ${url}`);
                                               for (const [skuId, priceData] of Object.entries(s2p)) {
                                                   if (!interceptedSkuInfo[skuId]) interceptedSkuInfo[skuId] = {};
                                                   Object.assign(interceptedSkuInfo[skuId], priceData);
                                               }
                                           }

                                           // 3. Check for deep skuBase
                                           const sBase = pStack.skuBase || pStack.data?.skuBase;
                                           if (sBase && Array.isArray(sBase.skus)) {
                                               console.log(`[Scraper] Found skuBase in apiStack from ${url}`);
                                               for (const sku of sBase.skus) {
                                                   if (sku.skuId && (sku.price || sku.promotionPrice)) {
                                                       if (!interceptedSkuInfo[sku.skuId]) interceptedSkuInfo[sku.skuId] = {};
                                                       if (!interceptedSkuInfo[sku.skuId].price) interceptedSkuInfo[sku.skuId].price = {};
                                                       interceptedSkuInfo[sku.skuId].price.priceText = sku.promotionPrice || sku.price;
                                                   }
                                               }
                                           }
                                       } catch(e) {}
                                   }
                              }

                              // Check direct skuCore
                              const s2i = json.data?.skuCore?.sku2info || json.skuCore?.sku2info;
                              if (s2i) {
                                  console.log(`[Scraper] Found direct sku2info from ${url}`);
                                  Object.assign(interceptedSkuInfo, s2i);
                              }
                         } catch(e) {}
                     }
                 } catch(e) {}
             }
        });

        try {
            console.log(`Opening product: ${productUrl}`);
            await safeGoto(productPage, productUrl, { waitUntil: 'domcontentloaded', timeout: PAGE_LOAD_TIMEOUT });
            await delay(3000);

            // Add scroll to trigger lazy loading
            await slowScroll(productPage);

            const data = await extractProductData(productPage);
            const rawComments = await extractComments(productPage);
            await closeCommentsModal(productPage);
            await delay(5000);
            const descImages = await extractDescImages(productPage);
            const translatedComments = await translateComments(rawComments);
            const preCheck = isEdiblePreCheck(data.title, data.description);
            if (preCheck.isEdible) {
                await productPage.close();
                continue;
            }

            const aiData = await enrichWithAI(data.title, data.description, data.price);
            if (aiData.shouldSkip) {
                await productPage.close();
                continue;
            }

            let general_price = 0;
            let generated_options = [];
            const domColors = Array.isArray(data.domColorList) ? data.domColorList : [];
            const basePriceMatch = String(data.price || '').match(/(\d+(\.\d+)?)/);
            const basePriceVal = basePriceMatch ? parseFloat(basePriceMatch[1]) * 200 : 0;
            const skuBase = data.skuBase && typeof data.skuBase === 'object' ? data.skuBase : null;
            const itemImages = Array.isArray(data.itemInfo?.images) ? data.itemInfo.images : [];
            const fallbackImage = itemImages[0] || (data.images && data.images[0]) || null;
            const pickDomColor = (key, color, index) => {
                if (!domColors.length) return null;
                const bySku = key ? domColors.find(c => c.skuId && c.skuId === key) : null;
                if (bySku) return bySku;
                const byText = color ? domColors.find(c => c.text === color) : null;
                if (byText) return byText;
                return domColors[index] || null;
            };

            let skuInfo = data.sku2info && typeof data.sku2info === 'object' ? data.sku2info : {};
            if (Object.keys(interceptedSkuInfo).length > 0) {
                 console.log(`Merged ${Object.keys(interceptedSkuInfo).length} SKU prices from Network Interception`);
                 Object.assign(skuInfo, interceptedSkuInfo);
            }
            if (Object.keys(skuInfo).length === 0) skuInfo = null;
            
            // Try to parse apiStack for better price data (promotions/real SKU prices)
            try {
                const stack = data.apiStack || data.data?.apiStack;
                if (stack && Array.isArray(stack) && stack.length > 0) {
                    const stackVal = stack[0].value;
                    if (stackVal) {
                        const parsedStack = JSON.parse(stackVal);
                        // Look for sku2info in various locations within apiStack
                        const stackSku2Info = parsedStack.skuCore?.sku2info || 
                                            parsedStack.data?.skuCore?.sku2info || 
                                            parsedStack.global?.data?.skuCore?.sku2info ||
                                            parsedStack.skuCore?.sku2info?.[0]; // sometimes array?
                        
                        if (stackSku2Info && typeof stackSku2Info === 'object') {
                             if (!skuInfo) skuInfo = {};
                             // Merge stack info (prefer stack info as it usually has promotion prices)
                             for (const key in stackSku2Info) {
                                 const val = stackSku2Info[key];
                                 if (val) {
                                     skuInfo[key] = { ...(skuInfo[key] || {}), ...val };
                                 }
                             }
                             console.log(`Merged ${Object.keys(stackSku2Info).length} SKU prices from apiStack`);
                        }
                    }
                }
            } catch (e) {
                console.log('Error parsing apiStack:', e.message);
            }

            const toPriceVal = (info) => {
                if (!info) return 0;
                
                // Priority: subPrice (promotion) > price (list) > originalPrice
                const sub = info.subPrice || info.promotionPrice || null;
                const pri = info.price || null;
                const orig = info.originalPrice || null;
                
                // 1. Try priceMoney (usually in cents)
                let priceMoney = sub?.priceMoney ?? pri?.priceMoney ?? orig?.priceMoney ?? null;
                if (priceMoney !== null && priceMoney !== undefined) {
                    const pm = String(priceMoney).replace(/[^\d.]/g, '');
                    const pmVal = pm ? parseFloat(pm) : 0;
                    if (pmVal > 0) return (pmVal / 100) * 200;
                }
                
                // 2. Try priceText
                const priceText = sub?.priceText || pri?.priceText || orig?.priceText || info.priceText || info.price || '';
                const priceMatch = String(priceText || '').match(/(\d+(\.\d+)?)/);
                if (priceMatch) {
                    return parseFloat(priceMatch[1]) * 200;
                }
                
                return 0;
            };
            
            if (skuBase && Array.isArray(skuBase.props) && Array.isArray(skuBase.skus)) {
                // Fix: ensure skuInfo handles both string and number keys
                const safeSkuInfo = {};
                if (skuInfo) {
                    for (const k of Object.keys(skuInfo)) {
                        safeSkuInfo[String(k)] = skuInfo[k];
                    }
                }

                const props = skuBase.props || [];
                const propsByPid = new Map();
                for (const p of props) {
                    if (p && p.pid) propsByPid.set(String(p.pid), p);
                }
                
                const colorMap = new Map(); // Map<string, OptionObject>

                for (const sku of skuBase.skus) {
                    const skuId = String(sku?.skuId || '');
                    const propPath = String(sku?.propPath || '');
                    if (!propPath) continue; 
                    
                    const pairs = propPath.split(';').map(p => p.split(':')).filter(v => v.length === 2);
                    
                    let colorName = '';
                    let sizeName = '';
                    let optionImage = '';
                    
                    for (const [pidRaw, vidRaw] of pairs) {
                        const pid = String(pidRaw || '');
                        const vid = String(vidRaw || '');
                        if (!pid || !vid) continue;
                        const prop = propsByPid.get(pid);
                        if (!prop) continue;
                        
                        const vals = Array.isArray(prop?.values) ? prop.values : [];
                        const val = vals.find(v => String(v?.vid || '') === vid);
                        if (!val) continue;
                        
                        const name = val?.name || val?.text || val?.value || '';
                        const hasImage = String(prop?.hasImage || '').toLowerCase() === 'true';
                        
                        // Determine if this property represents the "Color" (Visual Option)
                        // 1627207 is the standard Color PID in Taobao
                        const isColor = pid === '1627207' || 
                                      (prop.name && (prop.name.includes('颜色') || prop.name.includes('Color'))) || 
                                      hasImage;

                        if (isColor) {
                            if (colorName) colorName += ' ';
                            colorName += name;
                            if (hasImage && !optionImage) {
                                optionImage = val?.image || val?.imageUrl || val?.img || '';
                            }
                        } else {
                            // It's a size or specification
                            if (sizeName) sizeName += ' ';
                            sizeName += name;
                        }
                    }
                    
                    // Fallback: If no color found, treat the size/spec as the main option (Color) if it's the only thing
                    if (!colorName && sizeName) {
                        // If we have multiple sizes but no color, we treat each size as a distinct "Option" (Color)
                        // This matches the "Flat" structure for non-visual variants
                        colorName = sizeName;
                        sizeName = '';
                    } else if (!colorName && !sizeName) {
                        colorName = 'Default';
                    }
                    
                    // Determine Price
                    let info = safeSkuInfo[skuId] || {};
                    let priceVal = toPriceVal(info);
                    if (!priceVal && (sku.price || sku.promotionPrice)) {
                         priceVal = toPriceVal({
                             price: { priceText: sku.price },
                             subPrice: { priceText: sku.promotionPrice } 
                         });
                    }
                    if (!priceVal) priceVal = basePriceVal;

                    // Grouping Logic
                    if (!colorMap.has(colorName)) {
                        colorMap.set(colorName, {
                            color: colorName,
                            sizes: [],
                            price: priceVal,
                            thumbnail: optionImage || fallbackImage,
                            skuId: skuId
                        });
                    }
                    
                    const entry = colorMap.get(colorName);
                    if (sizeName && !entry.sizes.includes(sizeName)) {
                        entry.sizes.push(sizeName);
                    }
                    // Update thumbnail if missing
                    if (!entry.thumbnail && optionImage) {
                        entry.thumbnail = optionImage;
                    }
                    // Keep the lowest price for the group if multiple SKUs share the same color?
                    // Or keep the first one? The user says "price is fixed".
                    // Let's assume consistent pricing for now.
                }
                
                generated_options = Array.from(colorMap.values());

            } else if (skuInfo) {
                const entries = Object.entries(skuInfo);
                for (let i = 0; i < entries.length; i++) {
                    const [key, info] = entries[i];
                    const priceVal = toPriceVal(info) || basePriceVal;
                    const color = Array.isArray(data.colorList) && data.colorList[i]
                        ? data.colorList[i]
                        : (domColors[i]?.text || `颜色${i + 1}`);
                    const domColor = pickDomColor(key, color, i);
                    generated_options.push({
                        color,
                        sizes: [],
                        price: priceVal,
                        thumbnail: domColor?.thumb || fallbackImage,
                        skuId: key
                    });
                }
            }

            if (generated_options.length === 0 && domColors.length > 0) {
                for (const c of domColors) {
                    generated_options.push({
                        color: c.text,
                        sizes: [],
                        price: basePriceVal,
                        thumbnail: c.thumb || fallbackImage,
                        skuId: c.skuId || null
                    });
                }
            }

            generated_options = generated_options.filter(o => String(o?.skuId || '') !== '5593497685319');

            // Translate options to Arabic
            const optionTexts = generated_options.map(o => o.color).filter(Boolean);
            if (optionTexts.length > 0) {
                console.log('Translating options...');
                const translatedMap = await translateTexts(optionTexts);
                for (const opt of generated_options) {
                    if (translatedMap[opt.color]) {
                        opt.color = translatedMap[opt.color];
                    }
                }
            }

            if (generated_options.length > 0) {
                const prices = generated_options.map(o => o.price).filter(p => p > 0);
                if (prices.length > 0) general_price = Math.min(...prices);
            }
            if (general_price === 0 && basePriceVal > 0) {
                general_price = basePriceVal;
            }

            // --- Post-Processing for Iraqi Market Rules (from dataexample.txt) ---
            
            // 1. Weight Calculation (Raw Scraped Only)
            let weightVal = null;
            try {
                 if (data.props) {
                     const wProp = data.props.find(p => p.name.includes('重量') || p.name.includes('weight'));
                     if (wProp) {
                         const m = wProp.value.match(/(\d+(\.\d+)?)/);
                         if (m) weightVal = parseFloat(m[1]);
                     }
                 }
            } catch (e) {}
            
            // 2. Domestic Shipping (Removed as per request)
            let domesticShipping = 0; 

            // 3. Dimensions
            // Default logic based on category keywords (simple heuristic)
            let dimensions = "30*20*12"; // Default shoes
            const tLower = (data.title || '').toLowerCase();
            if (tLower.includes('slippers') || tLower.includes('slide') || tLower.includes('拖鞋')) {
                dimensions = "28*15*8";
            } else if (tLower.includes('boot') || tLower.includes('winter') || tLower.includes('靴')) {
                dimensions = "32*22*15";
            } else if (tLower.includes('kid') || tLower.includes('child') || tLower.includes('童')) {
                dimensions = "18*15*8";
            }

            // 4. Ensure generated_options have prices and simple structure
            if (generated_options.length === 0) {
                 generated_options.push({
                     color: 'Default',
                     sizes: [],
                     price: general_price,
                     thumbnail: data.images && data.images[0] ? data.images[0] : '',
                     skuId: 'def'
                 });
            } else {
                generated_options.forEach(o => {
                    if (!o.price || o.price === 0) o.price = general_price;
                });
            }

            const enrichedProduct = {
                product_name: aiData.product_name_ar || 'اسم غير متوفر',
                main_images: (data.images || []).slice(0, 5),
                url: productUrl,
                product_details: aiData.product_details_ar || {},
                product_desc_imgs: descImages || [],
                general_price: general_price,
                generated_options: generated_options,
                scrapedReviews: translatedComments || [],
                aiMetadata: aiData.aiMetadata || {},
                // New Fields
                weight: weightVal ? String(weightVal) : "0",
                dimensions: dimensions,
                domestic_shipping_fee: domesticShipping,
                delivery_time: "0"
            };

            console.log('Enriched Product Weight:', enrichedProduct.weight);
            console.log('Enriched Product Shipping:', enrichedProduct.domestic_shipping_fee);
            console.log('Writing to file:', OUTPUT_FILE);

            products.push(enrichedProduct);
            fs.writeFileSync(OUTPUT_FILE, JSON.stringify(products, null, 2));
            console.log('File written successfully.');
        } catch (e) {
            console.error('Product scrape error:', e.message);
        } finally {
            try { await productPage.close(); } catch (e) {}
            await humanDelay(1500, 3000);
        }
    }

    await browser.close();
    console.log('[End] Taobao Scraping Complete.');
}

run().catch(err => console.error('Fatal Error:', err));
