import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
// import { executablePath } from 'puppeteer'; // Use local detection instead

// puppeteer.use(StealthPlugin());

const BRIGHT_DATA_PROXY_URL = process.env.BRIGHT_DATA_PROXY_URL;
const BRIGHT_DATA_USERNAME = process.env.BRIGHT_DATA_USERNAME;
const BRIGHT_DATA_PASSWORD = process.env.BRIGHT_DATA_PASSWORD;

// Configure global-agent
// process.env.GLOBAL_AGENT_HTTP_PROXY = `http://${BRIGHT_DATA_USERNAME}:${BRIGHT_DATA_PASSWORD}@${BRIGHT_DATA_PROXY_URL}`;
// process.env.GLOBAL_AGENT_HTTPS_PROXY = `http://${BRIGHT_DATA_USERNAME}:${BRIGHT_DATA_PASSWORD}@${BRIGHT_DATA_PROXY_URL}`;
// process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // Allow self-signed certs for proxy

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { execSync } from 'child_process';

const getExecutablePath = async () => {
    // 1. Try Puppeteer's bundled Chrome (Highest Priority for Docker)
    try {
        const puppeteer = await import('puppeteer');
        if (puppeteer.executablePath) {
             const bundledPath = puppeteer.executablePath();
             console.log(`[Scraper] Found bundled Chrome at: ${bundledPath}`);
             return bundledPath;
        }
    } catch (e) {
        console.warn('[Scraper] Could not find bundled Chrome:', e.message);
    }

    console.log(`[Scraper] PUPPETEER_EXECUTABLE_PATH env var: ${process.env.PUPPETEER_EXECUTABLE_PATH}`);
    
    // 0. Use `which` command on Linux to find the binary automatically
    if (process.platform === 'linux') {
        try {
            const path = execSync('which google-chrome-stable || which google-chrome || which chromium || which chromium-browser || find / -name "chrome" -type f -executable | head -n 1').toString().trim();
            if (path) {
                console.log(`[Scraper] Found Chrome via 'which/find': ${path}`);
                return path;
            }
        } catch (e) {
            console.warn('[Scraper] Failed to find Chrome via which:', e.message);
        }
    }

    // 1. Check if running in Docker (Render)
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
        if (fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
            console.log(`[Scraper] Using Docker Chrome at: ${process.env.PUPPETEER_EXECUTABLE_PATH}`);
            return process.env.PUPPETEER_EXECUTABLE_PATH;
        } else {
            console.warn(`[Scraper] PUPPETEER_EXECUTABLE_PATH is set but file does not exist: ${process.env.PUPPETEER_EXECUTABLE_PATH}`);
        }
    }

    // 2. Check standard Linux paths (Docker/Render)
    const linuxPaths = [
        process.env.PUPPETEER_EXECUTABLE_PATH,
        '/usr/bin/google-chrome-stable',
        '/usr/bin/google-chrome',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/opt/google/chrome/google-chrome' // Common alternative location
    ];

    console.log('[Scraper] Checking Linux paths:', linuxPaths);

    for (const p of linuxPaths) {
        if (p && fs.existsSync(p)) {
            console.log(`[Scraper] Found Linux Chrome at: ${p}`);
            return p;
        }
    }

    // List contents of /usr/bin to help debugging if nothing is found
    try {
        if (process.platform === 'linux') {
            const binFiles = fs.readdirSync('/usr/bin').filter(f => f.includes('chrome') || f.includes('chromium'));
            console.log('[Scraper] Chrome-related files in /usr/bin:', binFiles);
        }
    } catch (e) {
        console.warn('[Scraper] Failed to list /usr/bin:', e.message);
    }

    // Check common Windows paths for Chrome
    const paths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
    ];
    for (const p of paths) {
        if (fs.existsSync(p)) {
            console.log(`[Scraper] Found local Chrome at: ${p}`);
            return p;
        }
    }
    // Try Puppeteer's bundled Chrome
    try {
        const puppeteer = await import('puppeteer');
        if (puppeteer.executablePath) {
             return puppeteer.executablePath();
        }
        return null;
    } catch (e) {
        console.warn('[Scraper] Could not find bundled Chrome:', e.message);
        return null;
    }
};

export async function testProxyConnection() {
  console.log('---------------------------------------------------');
  console.log('🧪 Testing Residential Proxy Connection (Scraper Service)');
  console.log('---------------------------------------------------');
  console.log(`Proxy URL: ${BRIGHT_DATA_PROXY_URL}`);
  
  let browser;
  try {
    const chromePath = await getExecutablePath();
    if (!chromePath) throw new Error('Chrome not found');

    const launchOptions = {
      headless: "new",
      ignoreHTTPSErrors: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        `--proxy-server=${BRIGHT_DATA_PROXY_URL}`,
        '--ignore-certificate-errors',
      ],
      executablePath: chromePath,
    };

    browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();

    if (BRIGHT_DATA_USERNAME && BRIGHT_DATA_PASSWORD) {
        await page.authenticate({
          username: BRIGHT_DATA_USERNAME,
          password: BRIGHT_DATA_PASSWORD,
        });
    }

    console.log('🚀 Connecting to ipinfo.io...');
    await page.goto('https://ipinfo.io/json', { waitUntil: 'domcontentloaded', timeout: 60000 });

    const content = await page.$eval('body', el => el.innerText);
    const json = JSON.parse(content);

    console.log('\n✅ Proxy Connection Successful!');
    console.log('IP:', json.ip);
    console.log('Country:', json.country);
    
    return { success: true, data: json };

  } catch (error) {
    console.error('\n❌ Proxy Test Failed!', error.message);
    return { success: false, error: error.message };
  } finally {
    if (browser) await browser.close();
  }
}

export async function scrapeProduct(url) {
  let browser;
  try {
    const isTaobao = url.includes('taobao.com') || url.includes('tmall.com');
    const isPdd = url.includes('pinduoduo.com') || url.includes('yangkeduo.com');
    const is1688 = url.includes('1688.com');

    console.log(`[Scraper] Starting scrape for: ${url}`);
    
    const chromePath = await getExecutablePath();
    if (!chromePath) {
        throw new Error('Chrome browser not found. Please install Google Chrome.');
    }

    const launchOptions = {
      headless: "new",
      ignoreHTTPSErrors: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        `--proxy-server=${BRIGHT_DATA_PROXY_URL}`,
        // `--proxy-server=${BRIGHT_DATA_PROXY_URL}`, // DISABLED FOR DIRECT TEST
        '--ignore-certificate-errors',
        '--ignore-certificate-errors-spki-list',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-features=IsolateOrigins,site-per-process'
      ],
      executablePath: chromePath,
    };

    browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();

    // Authenticate with Bright Data (Only if username/password are set)
    if (BRIGHT_DATA_USERNAME && BRIGHT_DATA_PASSWORD) {
        await page.authenticate({
          username: BRIGHT_DATA_USERNAME,
          password: BRIGHT_DATA_PASSWORD,
        });
    }

    await page.setViewport({ width: 1920, height: 1080 });

    // --- COOKIE INJECTION ---
    const cookiesPath = path.join(__dirname, '../cookies.json');
    if (fs.existsSync(cookiesPath)) {
      try {
        const cookiesString = fs.readFileSync(cookiesPath, 'utf8');
        const cookies = JSON.parse(cookiesString);
        if (Array.isArray(cookies) && cookies.length > 0) {
           console.log(`[Scraper] Loading ${cookies.length} cookies from cookies.json...`);
           await page.setCookie(...cookies);
        }
      } catch (cookieErr) {
        console.warn('[Scraper] Failed to load cookies.json:', cookieErr.message);
      }
    }
    // ------------------------

    // Set generic headers
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
    });

    console.log('[Scraper] Navigating to page (with Proxy)...');
    // Increased timeout to 120 seconds for Bright Data initial connection
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });

    console.log('[Scraper] Page loaded, extracting data...');
    
    return await extractData(page, url, isTaobao, isPdd, is1688);

  } catch (error) {
    console.error('[Scraper] Error details:', error);
    if (browser) await browser.close();

    // Throw specific error for frontend to handle
    throw new Error('Failed to scrape product: ' + error.message);
  } finally {
    if (browser) await browser.close();
  }
}

async function extractData(page, url, isTaobao, isPdd, is1688) {
    let productData = {
      originalUrl: url,
      provider: isTaobao ? 'TAOBAO' : (isPdd ? 'PDD' : (is1688 ? '1688' : 'OTHER')),
      name: '',
      price: 0,
      originalPrice: 0,
      image: '',
      sellerName: '',
      images: [],
      skuId: '',
      options: [],
      variants: []
    };

    if (isTaobao) {
      try {
        productData.name = await page.$eval('h1', el => el.innerText.trim()).catch(() => 'Taobao Product');
        // Try multiple price selectors
        const priceSelectors = ['.tb-main-price', '.tm-price', '#J_PromoPriceNum', '.Price--priceText--2nLbVda'];
        for (const sel of priceSelectors) {
             const priceText = await page.$eval(sel, el => el.innerText).catch(() => null);
             if (priceText) {
                 productData.originalPrice = parseFloat(priceText.replace(/[^0-9.]/g, ''));
                 productData.price = productData.originalPrice;
                 break;
             }
        }
        
        productData.image = await page.$eval('#J_ImgBooth', el => el.src).catch(() => '');
        if (!productData.image) {
            productData.image = await page.$eval('.MainImage--mainImage--1_A7jX9', el => el.src).catch(() => ''); // Tmall new layout
        }

      } catch (e) {
        console.warn('[Scraper] Taobao extraction partial failure:', e.message);
      }
    } else if (isPdd) {
       try {
        productData.name = await page.$eval('h1', el => el.innerText.trim()).catch(() => 'PDD Product');
      } catch (e) {
         console.warn('[Scraper] PDD extraction partial failure:', e.message);
      }
    }

    // Fallback: Get Title and Main Image if specific logic failed
    if (!productData.name || productData.name === 'Taobao Product') {
        productData.name = await page.title();
    }
    
    // DEBUG: Save screenshot if name is empty
    if (!productData.name) {
        console.log('[Scraper] Name empty, saving screenshot to debug-direct.png');
        await page.screenshot({ path: 'debug-direct.png' });
    }

    // Check for Login Wall / Captcha
    if (productData.name.includes('登录') || productData.name.includes('Login') || page.url().includes('login.')) {
        throw new Error('Hit Login Wall. Please provide valid cookies in cookies.json or check proxy configuration.');
    }
    
    console.log('[Scraper] Extraction complete:', productData.name);
    return productData;
}

// Mock Data Removed - We only want real data
/*
function getMockData(url) {
    return { ... };
}
*/
