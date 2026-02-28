import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

puppeteer.use(StealthPlugin());

const BRIGHT_DATA_PROXY_URL = process.env.BRIGHT_DATA_PROXY_URL;
const BRIGHT_DATA_USERNAME = process.env.BRIGHT_DATA_USERNAME;
const BRIGHT_DATA_PASSWORD = process.env.BRIGHT_DATA_PASSWORD;

import fs from 'fs';

const getExecutablePath = async () => {
    // 1. Check if running in Docker (Render)
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
        return process.env.PUPPETEER_EXECUTABLE_PATH;
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
        const { executablePath } = await import('puppeteer');
        return executablePath();
    } catch (e) {
        console.warn('[Scraper] Could not find bundled Chrome:', e.message);
        return null;
    }
};

async function testProxy() {
  console.log('---------------------------------------------------');
  console.log('🧪 Testing Residential Proxy Connection');
  console.log('---------------------------------------------------');
  console.log(`Proxy URL: ${BRIGHT_DATA_PROXY_URL}`);
  console.log(`Username: ${BRIGHT_DATA_USERNAME}`);
  console.log('---------------------------------------------------');

  let browser;
  try {
    const chromePath = await getExecutablePath();
    if (!chromePath) {
        throw new Error('Chrome browser not found. Please install Google Chrome.');
    }

    const launchOptions = {
      headless: "new",
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
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

    console.log('🚀 Connecting to ipinfo.io to verify IP...');
    await page.goto('https://ipinfo.io/json', { waitUntil: 'domcontentloaded', timeout: 60000 });

    const content = await page.$eval('body', el => el.innerText);
    const json = JSON.parse(content);

    console.log('\n✅ Proxy Connection Successful!');
    console.log('---------------------------------------------------');
    console.log('IP:', json.ip);
    console.log('City:', json.city);
    console.log('Region:', json.region);
    console.log('Country:', json.country);
    console.log('Org:', json.org);
    console.log('---------------------------------------------------');

  } catch (error) {
    console.error('\n❌ Proxy Test Failed!');
    console.error('Error:', error.message);
  } finally {
    if (browser) await browser.close();
  }
}

testProxy();
