---
name: "1688-scraper"
description: "Specialized 1688.com product and category scraping with CAPTCHA protection. Invoke when user needs to extract product data, images, or category items from 1688.com with anti-detection measures."
---

# 1688.com Scraper Skill

This skill provides specialized capabilities for scraping product data, images, and category listings from 1688.com (Alibaba's domestic Chinese marketplace) with robust CAPTCHA protection and anti-detection measures.

## When to Use This Skill

Invoke this skill when:
- Extracting product data from 1688.com product URLs
- Scraping category pages for multiple product listings
- Handling mobile and desktop 1688.com URLs
- Implementing CAPTCHA bypass and anti-detection measures
- Processing Arabic translations and currency conversions
- Extracting high-quality product images while filtering UI elements

## Core Capabilities

### 1. Product Data Extraction
- Extracts product title, price, specifications, and description
- Handles both mobile (`m.1688.com`) and desktop (`detail.1688.com`) URLs
- Converts Chinese 斤 (jin) to kilograms (divide by 2)
- Converts Chinese yuan to IQD (multiply by 200)
- Arabic translation of product attributes

### 2. Image Extraction with Quality Filtering
- Multi-strategy image extraction (img tags, data attributes, script JSON)
- Filters out UI icons, thumbnails, and low-quality images
- Removes size suffixes (220x220, 310x310, search, summ)
- Targets main product images (-cib.jpg/-cib.webp patterns)
- Duplicate image removal and quality-based selection
- Fallback to user-provided real images when extraction fails

### 3. CAPTCHA Protection & Anti-Detection
- Random delays between requests (2-5 seconds)
- User agent rotation with realistic browser signatures
- Referrer rotation mimicking natural browsing patterns
- Comprehensive browser-like headers and cookies
- SEO-friendly pagination handling for category scraping

### 4. Category Scraping
- Extracts product listings from category pages
- Handles pagination with SEO-friendly URL patterns
- Random or sequential item selection
- JSON output with complete product data

## Implementation Patterns

### CAPTCHA Prevention Utilities
```javascript
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15...'
];

function getRandomHeaders() {
  return {
    'User-Agent': randomUserAgent,
    'Referer': randomReferrer,
    'Accept': 'text/html,application/xhtml+xml...',
    // Additional browser-like headers
  };
}
```

### Image Quality Filtering
```javascript
function isValidProductImage(url) {
  const invalidPatterns = [
    'icon', 'logo', '-16x16', '-24x24', '-32x32',
    /\d{1,2}x\d{1,2}\.png$/
  ];
  return !invalidPatterns.some(pattern => url.includes(pattern));
}
```

### Multi-Strategy Image Extraction
1. **Strategy 1**: Direct img tag extraction
2. **Strategy 2**: Data attribute parsing
3. **Strategy 3**: Script JSON extraction
4. **Strategy 4**: -cib.jpg/-cib.webp pattern targeting
5. **Fallback**: User-provided real images

## File Structure

Primary working files:
- `server/scripts/arabic-translator-extractor.js` - Main extraction logic
- `server/scripts/final-refined-extractor.js` - Proven filtering patterns
- `server/arabic-translated-products.json` - Output data

## Error Handling

- Automatic retry with increased delays on CAPTCHA detection
- Fallback image sources when primary extraction fails
- Duplicate filtering and quality-based image selection
- Comprehensive logging for debugging extraction issues

## Best Practices

1. **Always use random delays** between requests
2. **Rotate user agents and referrers** for each request
3. **Validate image URLs** before including in results
4. **Handle both mobile and desktop URL formats**
5. **Implement proper error handling** for network issues
6. **Use fallback mechanisms** when primary extraction fails

This skill encapsulates all the proven techniques developed through extensive testing with 1688.com, ensuring reliable data extraction while minimizing the risk of CAPTCHA challenges and account blocking.