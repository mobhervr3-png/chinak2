import prisma from '../prismaClient.js';

async function main() {
  try {
    console.log('Searching for categories to link products...');
    
    // Find some categories to link products to
    const categories = await prisma.category.findMany({
      where: {
        parentId: { not: null } // Prefer subcategories
      },
      take: 10
    });

    if (categories.length === 0) {
      console.error('No categories found. Please run seed_categories.js first.');
      return;
    }

    const products = [
      {
        name: "تيشيرت قطني عصري",
        price: 25000,
        image: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?q=80&w=400&auto=format&fit=crop",
        description: "تيشيرت قطني 100% مريح جداً ومناسب للاستخدام اليومي.",
        categoryId: categories.find(c => c.name.includes('تيشيرتات'))?.id || categories[0].id,
        isFeatured: true
      },
      {
        name: "حذاء رياضي مريح",
        price: 45000,
        image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=400&auto=format&fit=crop",
        description: "حذاء رياضي خفيف الوزن مثالي للجري والتمارين الرياضية.",
        categoryId: categories.find(c => c.name.includes('أحذية رياضية'))?.id || categories[0].id,
        isFeatured: true
      },
      {
        name: "ساعة يد ذكية",
        price: 85000,
        image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=400&auto=format&fit=crop",
        description: "ساعة ذكية متطورة تدعم مراقبة الصحة والإشعارات.",
        categoryId: categories.find(c => c.name.includes('إلكترونيات'))?.id || categories[0].id,
        isFeatured: true
      },
      {
        name: "حقيبة ظهر للسفر",
        price: 35000,
        image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?q=80&w=400&auto=format&fit=crop",
        description: "حقيبة ظهر متينة وواسعة مناسبة للسفر والعمل.",
        categoryId: categories.find(c => c.name.includes('حقائب ظهر'))?.id || categories[0].id,
        isFeatured: false
      },
      {
        name: "عطر فاخر 100 مل",
        price: 120000,
        image: "https://images.unsplash.com/photo-1541643600914-78b084683601?q=80&w=400&auto=format&fit=crop",
        description: "عطر برائحة جذابة تدوم طويلاً.",
        categoryId: categories.find(c => c.name.includes('عناية'))?.id || categories[0].id,
        isFeatured: true
      },
      {
        name: "سماعات لاسلكية",
        price: 55000,
        image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=400&auto=format&fit=crop",
        description: "سماعات محيطية بجودة صوت عالية وعزل للضوضاء.",
        categoryId: categories.find(c => c.name.includes('إلكترونيات'))?.id || categories[0].id,
        isFeatured: false
      }
    ];

    console.log('Seeding sample products...');
    for (const productData of products) {
      await prisma.product.create({
        data: {
          ...productData,
          price: productData.price * 1.7, // 70% markup for Air shipping (default for small items)
          status: "PUBLISHED",
          isActive: true,
          isPriceCombined: true
        }
      });
    }

    console.log('Sample products seeded successfully.');

  } catch (error) {
    console.error('Error seeding products:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
