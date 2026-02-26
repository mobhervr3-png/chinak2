
const MOJIBAKE_MAP: Record<string, string> = {
    'ط§ظ„ظ…ط§ط±ظƒط©': 'الماركة',
    'ط§ظ„ظ„ظˆظ†': 'اللون',
    'ط§ظ„ظ…ظ‚ط§ط³': 'المقاس',
    'ط§ظ„ظ…ط§ط¯ط©': 'المادة',
    'ط§ظ„ظ…ظٹط²ط©': 'الميزة',
    'ط§ظ„طھطµظ…ظٹظ…': 'التصميم',
    'ط§ظ„ط§ط³طھط®ط¯ط§ظ…': 'الاستخدام',
    'ط§ط³ظ… ط؛ظٹط± ظ…طھظˆظپط±': 'اسم غير متوفر',
    'ط§ظ„ظ„ظˆظ† ط§ظ„ط§ظپطھط±ط§ط¶ظٹ': 'اللون الافتراضي',
    'ظƒظ…ط§ ظپظٹ ط§ظ„طµظˆط±ط©': 'كما في الصورة',
    'طھط®طµظٹطµ': 'تخصيص',
    'ط§طھطµط§ظ„': 'اتصال',
    'ط±ط§ط¨ط·': 'رابط',
    'ظپط±ظ‚': 'فرق',
    'ط¥ظٹط¯ط§ط¹': 'إيداع',
    'ظ„ط§ ظٹط±ط³ظ„': 'لا يرسل',
    'ط®ط¯ظ…ط© ط§ظ„ط¹ظ…ظ„ط§ط،': 'خدمة العملاء',
    'ظ…ط®طµطµ': 'مخصص'
};

export const fixMojibake = (text: string | null | undefined): string => {
    if (!text) return '';
    let fixedText = text;

    // 1. Try raw replacement
    for (const [bad, good] of Object.entries(MOJIBAKE_MAP)) {
        if (fixedText.includes(bad)) {
            fixedText = fixedText.split(bad).join(good);
        }
    }

    // 2. Try normalized replacement (NFC) if raw failed or for safety
    if (/[\u0620-\u064A]/.test(fixedText)) { 
         let normalizedText = fixedText.normalize('NFC');
         let updatedNormalized = false;
         
         for (const [bad, good] of Object.entries(MOJIBAKE_MAP)) {
             const badNormalized = bad.normalize('NFC');
             if (normalizedText.includes(badNormalized)) {
                 normalizedText = normalizedText.split(badNormalized).join(good);
                 updatedNormalized = true;
             }
         }
         
         if (updatedNormalized) {
             return normalizedText;
         }
    }

    return fixedText;
};
