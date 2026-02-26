import prisma from '../prismaClient.js';
import bcrypt from 'bcryptjs';

async function main() {
  console.log('Clearing database...');
  
  // Order of deletion to avoid FK violations
  await prisma.orderItem.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.cartItem.deleteMany({});
  await prisma.wishlistItem.deleteMany({});
  await prisma.review.deleteMany({});
  await prisma.productOption.deleteMany({});
  await prisma.productVariant.deleteMany({});
  await prisma.productImage.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.address.deleteMany({});
  await prisma.banner.deleteMany({});
  await prisma.coupon.deleteMany({});
  await prisma.adminNotification.deleteMany({});
  await prisma.activityLog.deleteMany({});

  console.log('Creating admin user...');
  const hashedPassword = await bcrypt.hash('admin123', 10);
  await prisma.user.create({
    data: {
      email: 'admin@example.com',
      password: hashedPassword,
      name: 'Admin User',
      role: 'ADMIN',
      permissions: '["manage_products", "manage_orders", "view_reports", "manage_users", "manage_settings"]'
    }
  });

  console.log('Seeding products...');
  
  const products = [
    {
      name: 'ساعة ذكية Ultra Pro',
      chineseName: 'Ultra Pro 智能手表',
      description: 'ساعة ذكية متطورة مع شاشة AMOLED وتتبع للنشاط البدني ونبضات القلب ومقاومة للماء.',
      price: 45000,
      basePriceRMB: 220,
      image: 'https://images.unsplash.com/photo-1579586337278-3befd40fd17a?q=80&w=1000&auto=format&fit=crop',
      isFeatured: true,
      specs: 'شاشة: 1.96 بوصة AMOLED, بطارية: 10 أيام, مقاومة للماء: IP68',
      isPriceCombined: true
    },
    {
      name: 'سماعات بلوتوث عازلة للضوضاء',
      chineseName: '降噪蓝牙耳机',
      description: 'سماعات لاسلكية عالية الجودة مع تقنية عزل الضوضاء النشطة وصوت نقي جداً.',
      price: 32000,
      basePriceRMB: 155,
      image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=1000&auto=format&fit=crop',
      isFeatured: true,
      specs: 'بلوتوث: 5.3, مدة العمل: 40 ساعة, شحن سريع: USB-C',
      isPriceCombined: true
    },
    {
      name: 'تيشيرت قطني كاجوال',
      chineseName: '纯棉休闲T恤',
      description: 'تيشيرت مريح جداً مصنوع من القطن الطبيعي 100% متوفر بألوان ومقاسات مختلفة.',
      price: 12000,
      basePriceRMB: 58,
      image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?q=80&w=1000&auto=format&fit=crop',
      isFeatured: false,
      specs: 'الخامة: قطن 100%, المقاسات: S, M, L, XL, XXL',
      isPriceCombined: true
    }
  ];

  for (const productData of products) {
    await prisma.product.create({
      data: productData
    });
  }

  console.log('Seeding banners...');
  await prisma.banner.createMany({
    data: [
      {
        title: 'تخفيضات الشتاء',
        subtitle: 'احصل على خصم يصل إلى 50% على جميع الملابس',
        image: 'https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?q=80&w=1000&auto=format&fit=crop',
        link: '/',
        order: 1
      },
      {
        title: 'أحدث الإلكترونيات',
        subtitle: 'اكتشف مجموعتنا الجديدة من الساعات الذكية والسماعات',
        image: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?q=80&w=1000&auto=format&fit=crop',
        link: '/',
        order: 2
      }
    ]
  });

  console.log('Seed data created successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
