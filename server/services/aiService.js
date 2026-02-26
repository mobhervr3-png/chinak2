import prisma from '../prismaClient.js';

/**
 * Arabic and Iraqi Dialect Normalization
 * Used for basic search enhancement without external AI.
 */
export function normalizeArabic(text) {
  if (!text) return { fullString: '', groups: [] };
  
  let normalized = text
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ناسائ/g, 'نسائ')
    .replace(/ناسا/g, 'نسا')
    .replace(/گ/g, 'ق') // Iraqi dialect: G -> Q
    .replace(/چ/g, 'ج') // Iraqi dialect: CH -> J
    .replace(/پ/g, 'ب') // P -> B
    .replace(/ڤ/g, 'ف') // V -> F
    .trim();

  // Iraqi Dialect Expansions (Common Synonyms)
  const synonyms = {
    'ميز': 'طاوله مكتب desk table',
    'جربايه': 'سرير bed',
    'قنفه': 'اريكه كنبه sofa couch',
    'برده': 'ستاره curtain',
    'بنكه': 'مروحه fan',
    'ثلاجه': 'براد refrigerator fridge',
    'مجمد': 'فريزر freezer',
    'طباخ': 'فرن غاز stove oven',
    'كاونتر': 'خزانه مطبخ kitchen cabinet',
    'دوشك': 'مرتبه mattress',
    'شرشف': 'مفرش غطاء sheet cover',
    'كرسي': 'chair',
    'مكتب': 'desk office',
    'خاولي': 'منشفه towel',
    'تراكي': 'اقراط حلق earrings',
    'سوار': 'اسواره bracelet',
    'جنطه': 'حقيبه bag backpack',
    'قاط': 'بدله suit',
    'دشداشه': 'جلابيه ثوب dress robe',
    'حذاء': 'بوط جزم shoes boots',
    'نعال': 'شبشب slippers',
    'شحاطه': 'صندل sandals',
    'كلاو': 'قبعه hat cap',
    'تيشيرت': 't-shirt shirt',
    'قميص': 'shirt',
    'بنطلون': 'pants trousers jeans',
    'فستان': 'dress',
    'تنوره': 'skirt',
    'بايدر': 'دراجه bike bicycle',
    'سياره': 'عربه car',
    'تلفزيون': 'شاشه tv television monitor',
    'موبايل': 'هاتف جوال mobile phone',
    'لابتوب': 'حاسوب كمبيوتر laptop computer',
    'شاحنه': 'charger',
    'سماعه': 'headphone speaker headset',
    'كاميرا': 'camera',
    'نساء': 'women woman female ladies',
    'نسائي': 'women woman female ladies',
    'رجال': 'men man male',
    'رجالي': 'men man male',
    'اطفال': 'kids children',
    'ولادي': 'boys',
    'بناتي': 'girls',
  };

  const words = normalized.split(/\s+/);
  const expandedGroups = words.map(word => {
    if (synonyms[word]) {
      return [word, ...synonyms[word].split(' ')];
    }
    return [word];
  });
  
  return {
    fullString: expandedGroups.map(g => g.join(' ')).join(' '),
    groups: expandedGroups
  };
}

export async function estimateProductPhysicals(product) {
  return {
    weight: 0.5,
    length: 10,
    width: 10,
    height: 10
  };
}
