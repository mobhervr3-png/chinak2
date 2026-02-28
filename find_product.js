
import prisma from './server/prismaClient.js';

async function main() {
  console.log('Connecting to DB...');
  const timeout = setTimeout(() => {
    console.log('Timed out after 10s');
    process.exit(1);
  }, 10000);
  
  try {
    const products = await prisma.product.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        price: true,
        basePriceIQD: true,
        purchaseUrl: true,
        createdAt: true
      }
    });
    clearTimeout(timeout);
    console.log(`Found ${products.length} products`);
    console.log(JSON.stringify(products, null, 2));
  } catch (err) {
    console.error('DB Error:', err);
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
