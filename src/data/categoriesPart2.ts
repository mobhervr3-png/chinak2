import type { Category } from '../types/category';

export const categoriesPart2: Category[] = [
  {
    "id": 3000,
    "name_en": "Electronics & Appliances",
    "name_ar": "إلكترونيات وأجهزة",
    "icon": "cellphone-link",
    "children": [
      {
        "id": 3001,
        "name_en": "Mobile Phones & Accessories",
        "name_ar": "هواتف وإكسسوارات",
        "icon": "cellphone",
        "children": [
          { "id": 300101, "name_en": "Phone Cases", "name_ar": "جرابات هواتف", "icon": "phone-case" },
          { "id": 300102, "name_en": "Screen Protectors", "name_ar": "حماية شاشة", "icon": "shield-check" },
          { "id": 300103, "name_en": "Chargers & Cables", "name_ar": "شواحن وكابلات", "icon": "cable" },
          { "id": 300104, "name_en": "Power Banks (Battery)", "name_ar": "باور بانك (بطارية)", "icon": "power-plug" },
          { "id": 300105, "name_en": "Holders & Stands", "name_ar": "حوامل", "icon": "phone-in-hand" }
        ]
      },
      {
        "id": 3002,
        "name_en": "Batteries & Power Supply",
        "name_ar": "بطاريات وإمداد طاقة",
        "icon": "battery",
        "children": [
          { "id": 300201, "name_en": "Dry Batteries (AA/AAA)", "name_ar": "بطاريات جافة (AA/AAA)", "icon": "battery" },
          { "id": 300202, "name_en": "Rechargeable Batteries", "name_ar": "بطاريات قابلة للشحن", "icon": "battery-charging" },
          { "id": 300203, "name_en": "Lithium Batteries", "name_ar": "بطاريات ليثيوم", "icon": "battery-high" },
          { "id": 300204, "name_en": "Battery Chargers", "name_ar": "شواحن بطاريات", "icon": "plug" },
          { "id": 300205, "name_en": "Power Strips", "name_ar": "أفياش كهرباء", "icon": "power-socket" }
        ]
      },
      {
        "id": 3003,
        "name_en": "Consumer Electronics",
        "name_ar": "إلكترونيات استهلاكية",
        "icon": "headphones",
        "children": [
          { "id": 300301, "name_en": "Headphones & Earbuds", "name_ar": "سماعات", "icon": "headphones" },
          { "id": 300302, "name_en": "Smart Watches", "name_ar": "ساعات ذكية", "icon": "watch-variant" },
          { "id": 300303, "name_en": "Bluetooth Speakers", "name_ar": "سماعات بلوتوث", "icon": "speaker-wireless" },
          { "id": 300304, "name_en": "Camera Accessories", "name_ar": "إكسسوارات كاميرا", "icon": "camera" },
          { "id": 300305, "name_en": "Drones (with Battery)", "name_ar": "درونز (مع بطارية)", "icon": "drone" }
        ]
      },
      {
        "id": 3004,
        "name_en": "Computer & Office",
        "name_ar": "كمبيوتر ومكتب",
        "icon": "laptop",
        "children": [
          { "id": 300401, "name_en": "Laptop Accessories", "name_ar": "إكسسوارات لابتوب", "icon": "laptop" },
          { "id": 300402, "name_en": "Keyboards & Mice", "name_ar": "كيبورد وماوس", "icon": "keyboard" },
          { "id": 300403, "name_en": "Storage (USB/SSD)", "name_ar": "تخزين (USB/SSD)", "icon": "usb" },
          { "id": 300404, "name_en": "Tablet Accessories", "name_ar": "إكسسوارات تابلت", "icon": "tablet" }
        ]
      },
      {
        "id": 3005,
        "name_en": "Home Appliances",
        "name_ar": "أجهزة منزلية",
        "icon": "toaster",
        "children": [
          { "id": 300501, "name_en": "Kitchen Appliances", "name_ar": "أجهزة مطبخ", "icon": "blender" },
          { "id": 300502, "name_en": "Vacuum Cleaners", "name_ar": "مكانس", "icon": "vacuum" },
          { "id": 300503, "name_en": "Personal Care Appliances", "name_ar": "أجهزة عناية شخصية", "icon": "hair-dryer" },
          { "id": 300504, "name_en": "Fans & Heaters", "name_ar": "مراوح وسخانات", "icon": "fan" }
        ]
      }
    ]
  },
  {
    "id": 4000,
    "name_en": "Home & Living",
    "name_ar": "المنزل والمعيشة",
    "icon": "home-variant",
    "children": [
      {
        "id": 4001,
        "name_en": "Home Decor",
        "name_ar": "ديكور منزلي",
        "icon": "lamp",
        "children": [
          { "id": 400101, "name_en": "Wall Art", "name_ar": "لوحات جدارية", "icon": "image" },
          { "id": 400102, "name_en": "Vases & Plants", "name_ar": "مزهرية ونباتات", "icon": "flower" },
          { "id": 400103, "name_en": "Candles & Holders", "name_ar": "شموع وحوامل", "icon": "candle" },
          { "id": 400104, "name_en": "Clocks", "name_ar": "ساعات حائط", "icon": "clock" },
          { "id": 400105, "name_en": "Rugs & Carpets", "name_ar": "سجاد وبسط", "icon": "rug" }
        ]
      },
      {
        "id": 4002,
        "name_en": "Kitchen & Dining",
        "name_ar": "مطبخ وطعام",
        "icon": "silverware-fork-knife",
        "children": [
          { "id": 400201, "name_en": "Cookware", "name_ar": "أواني طهي", "icon": "pot" },
          { "id": 400202, "name_en": "Cutlery", "name_ar": "أدوات مائدة", "icon": "silverware-fork" },
          { "id": 400203, "name_en": "Storage & Organization", "name_ar": "تخزين وتنظيم", "icon": "box" },
          { "id": 400204, "name_en": "Bakeware", "name_ar": "أدوات خبز", "icon": "cake" },
          { "id": 400205, "name_en": "Kitchen Tools", "name_ar": "أدوات مطبخ", "icon": "knife" }
        ]
      }
    ]
  }
];
