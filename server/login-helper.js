import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { executablePath } from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

puppeteer.use(StealthPlugin());

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function loginAndSaveCookies() {
  console.log('🚀 Launching browser for manual login...');
  console.log('---------------------------------------------------');
  console.log('1. A Chrome window will open.');
  console.log('2. Log in to your Taobao/Tmall account.');
  console.log('3. Once you are logged in and on the homepage, come back here.');
  console.log('4. Press ENTER in this terminal to save your cookies.');
  console.log('---------------------------------------------------');

  const browser = await puppeteer.launch({
    headless: false, // Visible browser
    defaultViewport: null, // Full window
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--start-maximized' // Maximize window
    ],
    executablePath: executablePath(),
  });

  const page = await browser.newPage();
  
  // Go to login page
  await page.goto('https://login.taobao.com/member/login.jhtml', { waitUntil: 'domcontentloaded' });

  // Wait for user to hit Enter
  await new Promise(resolve => {
    rl.question('Press ENTER when you have successfully logged in... ', resolve);
  });

  console.log('💾 Saving cookies...');

  // Get cookies
  const cookies = await page.cookies();
  
  // Save to file
  const cookiesPath = path.join(__dirname, 'cookies.json');
  fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));

  console.log(`✅ Cookies saved to: ${cookiesPath}`);
  console.log(`🍪 Total cookies: ${cookies.length}`);
  console.log('---------------------------------------------------');
  console.log('You can now close the browser and run the scraper test.');

  await browser.close();
  rl.close();
  process.exit(0);
}

loginAndSaveCookies().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
