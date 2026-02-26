import cron from 'node-cron';
import axios from 'axios';
import prisma from '../prismaClient.js';

/**
 * Checks if a 1688 product link is still valid.
 * 1688 often redirects to re.1688.com or similar when a product is removed.
 */
async function isLinkValid(url) {
  if (!url || !url.includes('1688.com')) return true;

  try {
    const response = await axios.get(url, {
      maxRedirects: 5,
      validateStatus: (status) => status < 400,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 10000 // 10 second timeout
    });

    const finalUrl = response.request.res.responseUrl || url;
    
    // If it redirects to the search/landing page, it's likely gone
    if (finalUrl.includes('re.1688.com') || finalUrl.includes('err.1688.com')) {
      return false;
    }

    return true;
  } catch (error) {
    // If 404, it's definitely gone
    if (error.response && error.response.status === 404) {
      return false;
    }
    
    // For other errors (timeout, 403, etc.), we might want to be cautious 
    // and not delete immediately to avoid false positives due to blocking
    console.error(`Error checking link ${url}:`, error.message);
    return true; 
  }
}

export async function checkAllProductLinks() {
  console.log('[LinkChecker] Starting scheduled link verification...');
  
  try {
    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        purchaseUrl: {
            contains: '1688.com'
        }
      },
      select: {
        id: true,
        name: true,
        purchaseUrl: true
      }
    });

    console.log(`[LinkChecker] Found ${products.length} products to check.`);

    let deactivatedCount = 0;

    for (const product of products) {
      const isValid = await isLinkValid(product.purchaseUrl);
      
      if (!isValid) {
        console.log(`[LinkChecker] Deactivating product: ${product.name} (ID: ${product.id}) - Link invalid: ${product.purchaseUrl}`);
        
        await prisma.product.update({
          where: { id: product.id },
          data: { 
            isActive: false,
            status: 'ARCHIVED' 
          }
        });
        deactivatedCount++;
      }
      
      // Add a small delay between requests to avoid being blocked
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log(`[LinkChecker] Finished. Deactivated ${deactivatedCount} products.`);
  } catch (error) {
    console.error('[LinkChecker] Error during link check:', error);
  }
}

export function setupLinkCheckerCron() {
    // Run every day at 3:00 AM
    cron.schedule('0 3 * * *', () => {
        checkAllProductLinks();
    });
    
    console.log('[LinkChecker] Cron job scheduled (0 3 * * *)');
}
