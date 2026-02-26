import prisma from '../prismaClient.js';

async function main() {
  try {
    const settings = await prisma.storeSettings.update({
      where: { id: 1 },
      data: {
        seaShippingThreshold: 30000,
        airShippingThreshold: 30000,
        airShippingMinFloor: 0
      }
    });
    console.log('Successfully updated store settings:', settings);
  } catch (error) {
    console.error('Failed to update store settings:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
