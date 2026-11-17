import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkOrders() {
  console.log('🔍 Querying "Order" table directly in PostgreSQL...');
  try {
    const totalOrderCount = await prisma.order.count();
    const allOrders = await prisma.order.findMany({
      select: {
        orderNumber: true,
        totalAmount: true,
        status: true,
        createdAt: true,
        settlementRef: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    console.log(`\n✅ Total orders in PostgreSQL "Order" table: ${totalOrderCount}`);
    allOrders.forEach((o, idx) => {
      console.log(`   [${idx + 1}] Order: ${o.orderNumber} | Total: ${o.totalAmount.toLocaleString('fa-IR')} Toman | Status: ${o.status} | CreatedAt: ${o.createdAt.toISOString()}`);
    });

    const userCount = await prisma.user.count();
    const productCount = await prisma.product.count();
    const couponCount = await prisma.coupon.count();

    console.log(`\n📊 Real PostgreSQL Database Statistics:`);
    console.log(`   - Users: ${userCount}`);
    console.log(`   - Products: ${productCount}`);
    console.log(`   - Coupons: ${couponCount}`);
    console.log(`   - Orders: ${totalOrderCount} (showing latest ${allOrders.length})`);
  } catch (err: any) {
    console.error('❌ Error querying PostgreSQL:', err);
  } finally {
    await prisma.$disconnect();
  }
}

checkOrders();
