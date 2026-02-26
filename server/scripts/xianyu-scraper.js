import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

// --- SAFETY CHECK: PREVENT RUNNING IN PRODUCTION BY ACCIDENT ---
if (process.env.NODE_ENV === 'production' && process.env.ALLOW_SCRAPER_IN_PROD !== 'true') {
    console.error('CRITICAL: Scraper is BLOCKED in production environment.');
    console.error('To run this script on the server, set ALLOW_SCRAPER_IN_PROD=true in your environment variables.');
    process.exit(1);
}

// Common Chrome paths on Windows
const CHROME_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe', // Fallback to Edge if Chrome missing
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
];

function getExecutablePath() {
  for (const p of CHROME_PATHS) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return null;
}

const targetUrl = 'https://www.goofish.com/item?spm=a21ybx.search.searchFeedList.5.7d9b7c7fB78B0q&id=1020869532587&categoryId=126860245';

async function scrapeXianyu() {
  const executablePath = getExecutablePath();
  if (!executablePath) {
    console.error('Chrome or Edge executable not found. Please install Chrome.');
    process.exit(1);
  }

  console.log(`Using executable: ${executablePath}`);

  const browser = await puppeteer.launch({
    executablePath,
    headless: false,
    defaultViewport: null,
    args: [
      '--start-maximized', 
      '--no-sandbox', 
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled' // Helps with detection
    ]
  });

  const page = await browser.newPage();

  // Set a realistic User Agent
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  try {
    console.log(`Navigating to ${targetUrl}...`);
    // Increased timeout to 60s
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    console.log('Page loaded (domcontentloaded). Waiting for content...');

    // Handle the specific login/close popup
    const closeButtonSelector = '.closeIconBg--cubvOqVh, img.closeIcon--gwB7wNKs, .closeIcon--gwB7wNKs';
    
    console.log('Looking for login popup close button...');
    try {
      // Wait a bit for any popup animation
      await new Promise(r => setTimeout(r, 3000));
      
      const closeBtn = await page.$(closeButtonSelector);
      if (closeBtn) {
        console.log('Close button found! Clicking...');
        await closeBtn.click();
        console.log('Clicked close button.');
        await new Promise(r => setTimeout(r, 1000));
      } else {
        console.log('Close button not found immediately. Continuing...');
      }
    } catch (e) {
      console.log('Error checking close button:', e.message);
    }

    // Wait for main content
    await new Promise(r => setTimeout(r, 3000));

    // Debug: Save HTML to see what we got
    const html = await page.content();
    fs.writeFileSync('xianyu-debug.html', html);
    console.log('Saved debug HTML to xianyu-debug.html');

    console.log('Starting data extraction...');
    // Scrape Data
    const data = await page.evaluate(() => {
      const getText = (selector) => {
        const el = document.querySelector(selector);
        return el ? el.innerText.trim() : '';
      };
      
      const title = document.title || '';
      
      // Try to find price more robustly
      let price = '';
      // Look for elements containing ¥ or currency symbol
      const priceCandidates = Array.from(document.querySelectorAll('*'))
        .filter(el => el.children.length === 0 && el.innerText && (el.innerText.includes('¥') || el.innerText.includes('CNY')));
      
      if (priceCandidates.length > 0) {
        // Sort by font size usually price is big
        priceCandidates.sort((a, b) => {
          const sizeA = parseFloat(window.getComputedStyle(a).fontSize);
          const sizeB = parseFloat(window.getComputedStyle(b).fontSize);
          return sizeB - sizeA;
        });
        price = priceCandidates[0].innerText;
      }

      const images = Array.from(document.querySelectorAll('img'))
        .map(img => img.src)
        .filter(src => src && src.startsWith('http') && !src.includes('avatar') && !src.includes('icon') && !src.includes('grey.gif'));

      // Try to get description
      const description = document.querySelector('meta[name="description"]')?.content || '';

      return {
        title,
        price,
        description,
        images: images.slice(0, 10)
      };
    });

    console.log('--- Scraped Data ---');
    console.log(JSON.stringify(data, null, 2));
    fs.writeFileSync('xianyu-data.json', JSON.stringify(data, null, 2));
    console.log('Data saved to xianyu-data.json');
    console.log('--------------------');
    
    try {
      await page.screenshot({ path: 'xianyu-product.png', fullPage: true });
      console.log('Screenshot saved.');
    } catch (err) {
      console.error('Screenshot failed:', err.message);
    }

  } catch (error) {
    console.error('Scraping failed:', error);
  } finally {
    // Keep browser open for a bit if we want to see it, otherwise close
    // await new Promise(r => setTimeout(r, 5000)); 
    await browser.close();
  }
}

scrapeXianyu();
