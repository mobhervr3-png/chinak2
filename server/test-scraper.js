import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { scrapeProduct } from './services/scraperService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

async function main() {
  const url = process.argv[2] || 'https://detail.tmall.com/item.htm?ali_refid=a3_420434_1006%3A1102227079%3AH%3ArpE3ZjAG6mphNqXLgvRjiA%3D%3D%3Ac0b1faa13fc415398c06ae0b49012702&ali_trackid=282_c0b1faa13fc415398c06ae0b49012702&id=850905286743&mi_id=0000f8OSSM_454xshSckFd5jHWhQHRP8MCmKTSxCu8kPD1A&mm_sceneid=1_0_12974530_0&priceTId=2150413e17722888254976306e19b0&spm=a21n57.1.hoverItem.3&utparam=%7B%22aplus_abtest%22%3A%22aeb90feba6e2de593e0f141cf9985bdb%22%7D&xxc=ad_ztc';

  console.log('---------------------------------------------------');
  console.log('🧪 Starting Scraper Test (Service Mode)');
  console.log(`🔗 Target URL: ${url}`);
  console.log('---------------------------------------------------');

  try {
    const result = await scrapeProduct(url);
    
    console.log('\n✅ Scraping Successful!');
    console.log('---------------------------------------------------');
    console.log(JSON.stringify(result, null, 2));
    console.log('---------------------------------------------------');
  } catch (error) {
    console.error('\n❌ Scraping Failed!');
    console.error('Error:', error.message);
    if (error.stack) console.error(error.stack);
  }
}

main().catch(console.error);
