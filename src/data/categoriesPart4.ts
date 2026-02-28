import type { Category } from '../types/category';

export const categoriesPart4: {
  childrenOf6002: Category[];
  siblingsOf6002: Category[];
  newTopLevelCategories: Category[];
} = {
  // Continuation of children for Category 6002 (Baby Care & Liquids) from Part 3
  childrenOf6002: [
    { "id": 600201, "name_en": "Diapers", "name_ar": "حفاضات", "icon": "ticket" }, 
    { "id": 600202, "name_en": "Feeding Bottles (Liquid Safe)", "name_ar": "رضاعات (آمنة للسوائل)", "icon": "baby-bottle" }, 
    { "id": 600203, "name_en": "Baby Shampoo & Wash", "name_ar": "شامبو وغسول أطفال", "icon": "shampoo" }, 
    { "id": 600204, "name_en": "Baby Oil & Lotion", "name_ar": "زيت وغسول أطفال", "icon": "lotion" }, 
    { "id": 600205, "name_en": "Health & Safety", "name_ar": "صحة وسلامة", "icon": "bandage" } 
  ],
  
  // Remaining children for Category 6000 (Mother & Baby)
  siblingsOf6002: [
    { 
      "id": 6003, 
      "name_en": "Toys & Play", 
      "name_ar": "ألعاب ولعب", 
      "icon": "toy-brick", 
      "children": [ 
        { "id": 600301, "name_en": "Educational Toys", "name_ar": "ألعاب تعليمية", "icon": "school" }, 
        { "id": 600302, "name_en": "Plush Toys", "name_ar": "ألعاب قطيفة", "icon": "teddy-bear" }, 
        { "id": 600303, "name_en": "Strollers & Gear", "name_ar": "عربات ومعدات", "icon": "baby-carriage" }, 
        { "id": 600304, "name_en": "RC Toys (with Battery)", "name_ar": "ألعاب تحكم (مع بطارية)", "icon": "car-electric" } 
      ] 
    }
  ],

  // New Top Level Categories
  newTopLevelCategories: [
    { 
      "id": 7000, 
      "name_en": "Sports & Outdoors", 
      "name_ar": "رياضة وخارج المنزل", 
      "icon": "dumbbell", 
      "children": [ 
        { 
          "id": 7001, 
          "name_en": "Sports Clothing", 
          "name_ar": "ملابس رياضية", 
          "icon": "run", 
          "children": [ 
            { "id": 700101, "name_en": "Activewear", "name_ar": "ملابس نشاط", "icon": "run" }, 
            { "id": 700102, "name_en": "Sports Shoes", "name_ar": "أحذية رياضية", "icon": "shoe-sneaker" }, 
            { "id": 700103, "name_en": "Swimwear", "name_ar": "ملابس سباحة", "icon": "swim" } 
          ] 
        }, 
        { 
          "id": 7002, 
          "name_en": "Equipment", 
          "name_ar": "معدات", 
          "icon": "basketball", 
          "children": [ 
            { "id": 700201, "name_en": "Fitness Equipment", "name_ar": "معدات لياقة", "icon": "dumbbell" }, 
            { "id": 700202, "name_en": "Cycling", "name_ar": "دراجات", "icon": "bike" }, 
            { "id": 700203, "name_en": "Camping & Hiking", "name_ar": "تخييم ومشي", "icon": "tent" }, 
            { "id": 700204, "name_en": "Ball Sports", "name_ar": "رياضات كرة", "icon": "basketball" }, 
            { "id": 700205, "name_en": "Water Bottles & Hydration", "name_ar": "قوارير ماء وترطيب", "icon": "bottle-water" } 
          ] 
        } 
      ] 
    }, 
    { 
      "id": 8000, 
      "name_en": "Toys & Hobbies", 
      "name_ar": "ألعاب وهوايات", 
      "icon": "toy-brick", 
      "children": [ 
        { 
          "id": 8001, 
          "name_en": "Action Figures", 
          "name_ar": "شخصيات أكشن", 
          "icon": "robot", 
          "children": [ 
            { "id": 800101, "name_en": "Anime", "name_ar": "أنمي", "icon": "eye" }, 
            { "id": 800102, "name_en": "Movies", "name_ar": "أفلام", "icon": "film" } 
          ] 
        }, 
        { 
          "id": 8002, 
          "name_en": "Building Blocks", 
          "name_ar": "مكعبات بناء", 
          "icon": "layers", 
          "children": [ 
            { "id": 800201, "name_en": "Bricks", "name_ar": "طوب بناء", "icon": "cube" }, 
            { "id": 800202, "name_en": "Models", "name_ar": "مجسمات", "icon": "model-text" } 
           ] 
         }, 
         { 
           "id": 8003, 
           "name_en": "Remote Control & Batteries", 
           "name_ar": "تحكم عن بعد وبطاريات", 
           "icon": "remote", 
           "children": [ 
             { "id": 800301, "name_en": "RC Cars (with Battery)", "name_ar": "سيارات تحكم (مع بطارية)", "icon": "car-electric" }, 
             { "id": 800302, "name_en": "Drones (with Battery)", "name_ar": "درونز (مع بطارية)", "icon": "drone" }, 
             { "id": 800303, "name_en": "Replacement Batteries", "name_ar": "بطاريات بديلة", "icon": "battery" } 
           ] 
         } 
       ] 
     }
  ]
};
