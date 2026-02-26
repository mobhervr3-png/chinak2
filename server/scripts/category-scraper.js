import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';

// --- SAFETY CHECK: PREVENT RUNNING IN PRODUCTION BY ACCIDENT ---
if (process.env.NODE_ENV === 'production' && process.env.ALLOW_SCRAPER_IN_PROD !== 'true') {
    console.error('CRITICAL: Scraper is BLOCKED in production environment.');
    console.error('To run this script on the server, set ALLOW_SCRAPER_IN_PROD=true in your environment variables.');
    process.exit(1);
}

// CAPTCHA Prevention Utilities
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0'
];

const referrers = [
  'https://www.1688.com/',
  'https://s.1688.com/',
  'https://search.1688.com/',
  'https://detail.1688.com/'
];

function getRandomHeaders() {
  const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
  const randomReferrer = referrers[Math.floor(Math.random() * referrers.length)];
  
  return {
    'User-Agent': randomUserAgent,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br, zstd',
    'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
    'Cache-Control': 'max-age=0',
    'Cookie': 'arms_uid=d83feb0b-fd16-4613-94a8-039d86d21ca8; cna=k3VhHbDeCyECAU62k0qmepUr; taklid=b3f58c9899704069843ae5f248d5c6fe; lid=tb332647745370; plugin_home_downLoad_cookie=%E4%B8%8B%E8%BD%BD%E6%8F%92%E4%BB%B6; cookie1=W5oDhJJaQ98Up5Cgv0%2FtPqjJBFrdqkDG0vjU5uZvsC8%3D; cookie2=12f611ae70b0bf34e273c09815ad4bf7; cookie17=UUpjNmHbOttj7et9sQ%3D%3D; sgcookie=E100lGD4JADOn7x3xLZ32JvX6bpd7zVZDZ5fWuweG9PMhr69fLkBddgOG6O4ct%2FVCBIDpovMys1Wqk1ypG0IqdjzlZjaLsO3oL2M60yXaunPuxk%3D; t=d045a542d9d514096e017a885f5dcb91; _tb_token_=e37ee78377549; sg=081; csg=6fed4546; unb=2220268184498; uc4=id4=0%40U2gp9rIfvxVio8oSMhjuUS5SYrkxjn6R&nk4=0%40FY4NAA%2BTw091FWXGdnFtuFNaCzFTX%2BhGtw%3D%3D; _nk_=tb332647745370; __cn_logon__=true; __cn_logon_id__=tb332647745370; __last_loginid__=b2b-22202681844980f24a; __last_memberid__=b2b-22202681844980f24a; last_mid=b2b-22202681844980f24a; leftMenuLastMode=COLLAPSE; xlly_s=1; union={"amug_biz":"comad","amug_fl_src":"other","creative_url":"https%3A%2F%2Fre.1688.com%2F%3Fp4p_clc_random%3D%3D3c034a28caba40d6a89bf0657da66a15","creative_time":1769455415976}; keywordsHistory=%E5%A5%B3%E8%A3%85%E8%A1%AC%E8%A1%AB%3B%E5%A5%B3%E8%A3%85T%E6%81%A4; _csrf_token=1769579165429; leftMenuModeTip=shown; mtop_partitioned_detect=1; _m_h5_tk=9ce60edf1c0e34da7ceb05dd55c2dbc2_1769605322315; _m_h5_tk_enc=e367f0db5b000e2bc547d36e546bc994; JSESSIONID=B0EA135BE0923618B3BF562982B6EA31; _user_vitals_session_data_={"user_line_track":true,"ul_session_id":"0k6zhe513ouj","last_page_id":"detail.1688.com%2Fgkk135dskuj"}; isg=BLq60RoUh0wI6AfhARBrri16C-Dcaz5FooLhb8SzZs0Yt1rxrPuOVYBVBUtrPLbd; tfstk=g7ZExambqMIFkX503-mP0uk3L2mKV05jtuGSE82odXchw9Ho4WNirvDkqd4aZ53ItD6Jz3yr6pAH-exisvHDqYmoKPJzH5o7a8BKEbVuabaC5iwLp0nlG7SfcJBgRaRYY0A7IDH7VV6-WiwLpdveZtaGcgSk99DkrbVojfDjF0xnZHXZSxMoqH0kxFAi6YmoqbcuIFDqUvAot72GQYhiZ003ZcXZefcoq0cylJ2kbxghKR0HbAXjd2l0Kf-zelkn8een_3xubPuEiuGwq3qZpRZdh_-VPj4xOqGYsGtE4RDzOfNcmhoiureSUWSexDagWknQfsRS87lnolgwhTotzXzgxVJkqR2ITqUzT68KtyNZkA0MUiH_Gf2LxPWJsJVjTDD',
    'Priority': 'u=0, i',
    'Sec-Ch-Ua': '"Not(A:Brand";v="8", "Chromium";v="144", "Google Chrome";v="144"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
    'Referer': randomReferrer,
    'Origin': 'https://www.1688.com',
    'DNT': '1',
    'Connection': 'keep-alive'
  };
}

// Image quality filtering
function isValidProductImage(url) {
  const invalidPatterns = [
    'icon', 'logo', '-16x16', '-24x24', '-32x32',
    /\d{1,2}x\d{1,2}\.png$/
  ];
  return !invalidPatterns.some(pattern => {
    if (typeof pattern === 'string') return url.includes(pattern);
    return pattern.test(url);
  });
}

// Arabic translation mapping
const arabicTranslations = {
  '女装': 'ملابس نسائية',
  '连衣裙': 'فساتين',
  '大衣': 'معاطف',
  '外套': 'جاكيتات',
  '上衣': 'بلوزات',
  '裤子': 'بنطلونات',
  '裙子': 'تنانير',
  'T恤': 'تي شيرت',
  '衬衫': 'قمصان',
  '毛衣': 'سترات',
  '羽绒服': 'معاطف واقية',
  '牛仔裤': 'جينز',
  '套装': 'أطقم',
  '内衣': 'ملابس داخلية',
  '泳装': 'ملابس سباحة',
  '运动服': 'ملابس رياضية',
  '时尚': 'موضة',
  '新款': 'موديل جديد',
  '爆款': 'الأكثر مبيعاً',
  '热卖': 'شائع',
  '包邮': 'شحن مجاني',
  '折扣': 'خصم',
  '优惠': 'عرض',
  '批发': 'بيع بالجملة',
  '定制': 'مخصص',
  '高端': 'فاخر',
  '品质': 'جودة',
  '性感': 'مثير',
  '优雅': 'أنيق',
  '休闲': 'كاجوال',
  '职业': 'عمل',
  '日常': 'يومي',
  '百搭': 'متعدد الاستخدامات',
  '修身': 'مُشَكّل',
  '宽松': 'واسع',
  '显瘦': 'يُظهر النحافة',
  '显高': 'يُظهر الطول',
  '保暖': 'دافئ',
  '透气': 'منفذ للهواء',
  '舒适': 'مريح',
  '柔软': 'ناعم',
  '弹性': 'مطاطي',
  '纯棉': 'قطن خالص',
  '雪纺': 'شيفون',
  '蕾丝': 'دانتيل',
  '丝绸': 'حرير',
  '羊毛': 'صوف',
  '羊绒': 'كشمير',
  '聚酯纤维': 'بوليستر',
  '尼龙': 'نايلون',
  '氨纶': 'سباندكس'
};

function translateToArabic(text) {
  let translated = text;
  Object.entries(arabicTranslations).forEach(([chinese, arabic]) => {
    translated = translated.replace(new RegExp(chinese, 'g'), arabic);
  });
  return translated;
}

// Extract product URLs from category page
async function extractProductUrlsFromCategory(categoryUrl, maxPages = 1) {
  const productUrls = [];
  
  try {
    for (let page = 1; page <= maxPages; page++) {
      await delay(3000 + Math.random() * 2000); // 3-5 second delay between pages
      
      const pageUrl = categoryUrl.replace(/beginPage=\d+/, `beginPage=${page}`);
      const headers = getRandomHeaders();
      
      console.log(`Fetching page ${page}: ${pageUrl}`);
      
      const response = await axios.get(pageUrl, { 
        headers,
        timeout: 10000
      });
      
      const $ = cheerio.load(response.data);
      
      // Extract product URLs - multiple patterns for different page structures
      const productLinks = $('a[href*="detail.1688.com/offer/"]');
      
      productLinks.each((i, element) => {
        const href = $(element).attr('href');
        if (href && href.includes('detail.1688.com/offer/')) {
          const fullUrl = href.startsWith('http') ? href : `https:${href}`;
          if (!productUrls.includes(fullUrl)) {
            productUrls.push(fullUrl);
          }
        }
      });
      
      console.log(`Found ${productLinks.length} products on page ${page}`);
      
      // Check if there are more pages
      const nextPage = $('a.next');
      if (nextPage.length === 0 && page === 1) {
        break; // No more pages
      }
    }
    
    return productUrls;
  } catch (error) {
    console.error('Error extracting product URLs:', error.message);
    return [];
  }
}

// Extract product data from individual product page
async function extractProductData(productUrl) {
  try {
    await delay(2000 + Math.random() * 3000); // 2-5 second random delay
    const headers = getRandomHeaders();
    
    console.log(`Extracting product data from: ${productUrl}`);
    
    const response = await axios.get(productUrl, { 
      headers,
      timeout: 15000 
    });
    
    const $ = cheerio.load(response.data);
    
    // Extract product title
    let title = $('h1.d-title').text().trim() || 
               $('title').text().replace('- 1688.com', '').trim();
    
    // Price extraction with fallback
    let price = 0;
    const priceText = $('.price, .price-now, .offer-price, .discount-price').first().text() || '0';
    const priceMatch = priceText.match(/(\d+\.?\d*)/);
    if (priceMatch) {
      price = parseFloat(priceMatch[1]);
    }
    
    const priceIQD = price; // User says price is already IQD
    
    // Extract product images with multiple strategies
    const productImages = [];
    
    // Strategy 1: Direct img tags
    $('img').each((i, element) => {
      const src = $(element).attr('src') || $(element).attr('data-src');
      if (src && src.includes('alicdn.com') && isValidProductImage(src)) {
        const cleanUrl = src.replace(/_(\d+x\d+|search|summ)\.(jpg|webp|png)/, '.$2');
        productImages.push(cleanUrl.startsWith('http') ? cleanUrl : `https:${cleanUrl}`);
      }
    });
    
    // Strategy 2: Data attributes
    $('[data-image]').each((i, element) => {
      const imageUrl = $(element).attr('data-image');
      if (imageUrl && isValidProductImage(imageUrl)) {
        productImages.push(imageUrl.startsWith('http') ? imageUrl : `https:${imageUrl}`);
      }
    });
    
    // Strategy 3: Script JSON extraction
    const scriptContents = $('script').map((i, el) => $(el).html()).get();
    for (const script of scriptContents) {
      if (script.includes('imageList') || script.includes('imageUrl')) {
        const jsonMatch = script.match(/\{[\s\S]*?\}/);
        if (jsonMatch) {
          try {
            const jsonData = JSON.parse(jsonMatch[0]);
            const images = jsonData.imageList || jsonData.imageUrl || jsonData.images || [];
            images.forEach(img => {
              if (img && isValidProductImage(img)) {
                const cleanUrl = img.replace(/_(\d+x\d+|search|summ)\.(jpg|webp|png)/, '.$2');
                productImages.push(cleanUrl.startsWith('http') ? cleanUrl : `https:${cleanUrl}`);
              }
            });
          } catch (e) {
            // JSON parsing failed, continue
          }
        }
      }
    }
    
    // Remove duplicates and limit to 5 best images
    const uniqueImages = [...new Set(productImages)].filter(isValidProductImage).slice(0, 5);
    
    // Extract specifications/description
    let description = '';
    $('.description-content, .detail-desc, [data-spm*="desc"]').each((i, element) => {
      description += $(element).text().trim() + '\n';
    });
    
    // Extract weight and convert 斤 to kg
    let weight = 0;
    const weightText = $('td:contains("重量"), td:contains("重量")').next().text() ||
                      $('li:contains("重量")').text();
    const weightMatch = weightText.match(/([\d.]+)\s*斤/);
    if (weightMatch) {
      weight = parseFloat(weightMatch[1]) / 2; // Convert 斤 to kg
    }
    
    // Arabic translation
    const arabicTitle = translateToArabic(title);
    const arabicDescription = translateToArabic(description);
    
    return {
      originalUrl: productUrl,
      title: arabicTitle,
      originalTitle: title,
      price: priceIQD,
      originalPrice: price,
      currency: 'IQD',
      originalCurrency: 'CNY',
      images: uniqueImages,
      description: arabicDescription,
      originalDescription: description,
      weight: weight,
      weightUnit: 'kg',
      extractedAt: new Date().toISOString()
    };
    
  } catch (error) {
    console.error(`Error extracting product data from ${productUrl}:`, error.message);
    return null;
  }
}

// Main category scraping function
async function scrapeCategory(categoryUrl, maxProducts = 10, maxPages = 1) {
  console.log('Starting category scraping with CAPTCHA protection...');
  
  try {
    // Step 1: Extract product URLs from category pages
    const productUrls = await extractProductUrlsFromCategory(categoryUrl, maxPages);
    console.log(`Found ${productUrls.length} product URLs`);
    
    // Step 2: Extract data from individual products
    const products = [];
    let successCount = 0;
    
    for (let i = 0; i < Math.min(productUrls.length, maxProducts); i++) {
      const productData = await extractProductData(productUrls[i]);
      if (productData) {
        products.push(productData);
        successCount++;
        console.log(`Successfully extracted product ${successCount}/${maxProducts}`);
      }
      
      // Additional delay between product extractions
      if (i < Math.min(productUrls.length, maxProducts) - 1) {
        await delay(4000 + Math.random() * 2000); // 4-6 second delay
      }
    }
    
    // Step 3: Save results
    const outputFile = `category-products-${Date.now()}.json`;
    fs.writeFileSync(outputFile, JSON.stringify(products, null, 2));
    
    console.log(`\nScraping completed!`);
    console.log(`Total products found: ${productUrls.length}`);
    console.log(`Successfully extracted: ${successCount}`);
    console.log(`Results saved to: ${outputFile}`);
    
    return products;
    
  } catch (error) {
    console.error('Category scraping failed:', error.message);
    return [];
  }
}

// Run the scraper
const categoryUrl = 'https://s.1688.com/selloffer/offer_search.htm?spm=a260k.home2025.category.dL2.66333597RpQZVA&charset=utf8&keywords=%E5%A5%B3%E8%A3%85&featurePair=401:8872005&beginPage=1';

// To run: scrapeCategory(categoryUrl, maxProducts, maxPages)
// Example: scrapeCategory(categoryUrl, 5, 1) - scrapes 5 products from first page

// Export for use in other files
if (import.meta.url === `file://${process.argv[1]}`) {
  // Run if executed directly
  scrapeCategory(categoryUrl, 3, 1).catch(console.error);
}

export { scrapeCategory, extractProductData, extractProductUrlsFromCategory };