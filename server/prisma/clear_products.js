import prisma from '../prismaClient.js';

async function main() {
  try {
    console.log('Deleting all products and related data...');
    
    // Ordered deletion to handle foreign key constraints
    await prisma.cartItem.deleteMany({});
    await prisma.wishlistItem.deleteMany({});
    await prisma.orderItem.deleteMany({});
    await prisma.review.deleteMany({});
    await prisma.productImage.deleteMany({});
    await prisma.productOption.deleteMany({});
    await prisma.productVariant.deleteMany({});
    await prisma.product.deleteMany({});
    
    console.log('All products and related data deleted successfully.');

  } catch (error) {
    console.error('Error deleting products:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
