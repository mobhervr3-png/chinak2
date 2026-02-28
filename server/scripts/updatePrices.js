import prisma from '../prismaClient.js';

async function updatePrices() {
  console.log('Starting price update: Recalculating all prices (0% profit, rounded to 10)...');
  
  try {
    const products = await prisma.product.findMany({
      select: {
        id: true,
        basePriceIQD: true,
        price: true,
        domesticShippingFee: true
      }
    });

    console.log(`Found ${products.length} products to update.`);
    let updatedCount = 0;

    for (const product of products) {
      // Logic: (BaseIQD + Domestic) * 1.0 -> Rounded to 10
      const base = product.basePriceIQD || product.price; // Fallback to current price if base is missing
      const domestic = product.domesticShippingFee || 0;
      
      const newPrice = Math.ceil((base + domestic) / 10) * 10;
      
      await prisma.product.update({
        where: { id: product.id },
        data: { price: newPrice }
      });
      updatedCount++;
    }
    console.log(`Successfully updated ${updatedCount} products.`);

    // Update ProductVariant prices
    const variants = await prisma.productVariant.findMany({
      select: { 
        id: true, 
        basePriceIQD: true,
        price: true 
      }
    });
    console.log(`Found ${variants.length} variants to update.`);
    let updatedVariantsCount = 0;
    
    for (const variant of variants) {
      const base = variant.basePriceIQD || variant.price;
      // Note: Variants usually inherit domestic fee from product, but simplified here as 0 or included in base
      // If we need domestic fee, we'd need to fetch product relation. 
      // For now, assuming basePriceIQD on variant is the full cost basis.
      
      const newPrice = Math.ceil(base / 10) * 10;
      
      await prisma.productVariant.update({
        where: { id: variant.id },
        data: { price: newPrice }
      });
      updatedVariantsCount++;
    }
    console.log(`Successfully updated ${updatedVariantsCount} variants.`);
  } catch (error) {
    console.error('Error updating prices:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updatePrices();
