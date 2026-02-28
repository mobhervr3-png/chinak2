import type { Category } from '../types/category';

export const categoriesPart8Additions: {
  parentId: number;
  items?: Category[];
  newGroup?: Category;
}[] = [
  // 1. Electronics additions
  {
    parentId: 3005, // Home Appliances
    items: [
      { id: 300505, name_en: "Oral Care Appliances", name_ar: "أجهزة العناية بالفم", icon: "tooth-outline" },
      { id: 300506, name_en: "Hair Dryers & Stylers", name_ar: "مجففات ومصففات الشعر", icon: "hair-dryer" }
    ]
  },
  {
    parentId: 3003, // Consumer Electronics
    items: [
      { id: 300306, name_en: "Smart Watch Accessories", name_ar: "إكسسوارات الساعات الذكية", icon: "watch-variant" }
    ]
  },
  // 2. Home & Living additions
  {
    parentId: 4004, // Bedding & Bath
    items: [
      { id: 400406, name_en: "Bathroom Accessories", name_ar: "مستلزمات الحمام", icon: "shower" }
    ]
  },
  {
    parentId: 4000, // Home & Living (New Group: Home Organization)
    newGroup: {
      id: 4006,
      name_en: "Home Organization",
      name_ar: "تنظيم المنزل",
      icon: "dresser",
      children: [
        { id: 400601, name_en: "Closet Organizers", name_ar: "منظمات الخزانة", icon: "hanger" },
        { id: 400602, name_en: "Storage Bags", name_ar: "حقائب تخزين", icon: "bag-personal" }
      ]
    }
  },
  // 3. Mother & Baby additions
  {
    parentId: 6003, // Toys & Play
    items: [
      { id: 600305, name_en: "Kids Costumes", name_ar: "ملابس تنكرية للأطفال", icon: "mask" }
    ]
  },
  {
    parentId: 6002, // Baby Care
    items: [
      { id: 600206, name_en: "Baby Safety & Protection", name_ar: "سلامة وحماية الطفل", icon: "shield-check" }
    ]
  },
  // 4. Sports additions
  {
    parentId: 7002, // Equipment & Gear
    items: [
      { id: 700205, name_en: "Yoga & Pilates", name_ar: "اليوجا والبيلاتس", icon: "yoga" },
      { id: 700206, name_en: "Bicycle Accessories", name_ar: "إكسسوارات الدراجات", icon: "bike" }
    ]
  },
  // 5. Home Improvement additions
  {
    parentId: 14001, // Lighting & Decor
    items: [
      { id: 1400105, name_en: "Garden Tools", name_ar: "أدوات الحديقة", icon: "spade" },
      { id: 1400106, name_en: "Kitchen & Sink Accessories", name_ar: "إكسسوارات المطبخ والمغاسل", icon: "faucet" }
    ]
  },
  // 6. Jewelry additions
  {
    parentId: 15001, // Fashion Jewelry Accessories
    items: [
      { id: 1500105, name_en: "Jewelry Storage & Boxes", name_ar: "صناديق ومنظمات المجوهرات", icon: "archive" }
    ]
  }
];
