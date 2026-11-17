import { PrismaClient } from '@prisma/client';
import {
  INITIAL_PRODUCTS,
  INITIAL_ADMIN_ORDERS,
  DEFAULT_SMS_EVENT_TEMPLATES,
  INITIAL_PRODUCT_REVIEWS,
} from '../src/lib/initial-data';
import {
  INITIAL_COUPONS,
  DEFAULT_SITE_CONTENT,
  DEFAULT_SUBSCRIPTION_SETTINGS,
  DEFAULT_PAYMENT_SETTINGS,
} from '../src/lib/db-store';
import { hashPassword } from '../src/lib/password';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting Shiraz Pro Farm Database Seeding (PostgreSQL)...');

  // 1. Seed Site Content Singleton
  console.log('📦 Seeding SiteContent...');
  await prisma.siteContent.upsert({
    where: { id: 'singleton' },
    update: { content: DEFAULT_SITE_CONTENT as any },
    create: { id: 'singleton', content: DEFAULT_SITE_CONTENT as any },
  });

  // 2. Seed Subscription Settings Singleton
  console.log('📦 Seeding SubscriptionSettings...');
  await prisma.subscriptionSettings.upsert({
    where: { id: 'singleton' },
    update: { settings: DEFAULT_SUBSCRIPTION_SETTINGS as any },
    create: { id: 'singleton', settings: DEFAULT_SUBSCRIPTION_SETTINGS as any },
  });

  // 3. Seed Payment Settings Singleton
  console.log('📦 Seeding PaymentSettings...');
  await prisma.paymentSettings.upsert({
    where: { id: 'singleton' },
    update: { settings: DEFAULT_PAYMENT_SETTINGS as any },
    create: { id: 'singleton', settings: DEFAULT_PAYMENT_SETTINGS as any },
  });

  // 4. Seed Products
  console.log(`📦 Seeding ${INITIAL_PRODUCTS.length} Products...`);
  for (const prod of INITIAL_PRODUCTS) {
    await prisma.product.upsert({
      where: { slug: prod.slug },
      update: {
        title: prod.title,
        description: prod.description,
        category: prod.category,
        price: prod.price,
        costPrice: prod.costPrice,
        packSize: prod.packSize || '',
        weightKg: prod.weightKg,
        dimensions: prod.dimensions,
        stock: prod.stock,
        status: prod.status || 'AVAILABLE',
        images: prod.images,
        isOrganicCertified: prod.isOrganicCertified,
        isBulkEligible: prod.isBulkEligible,
        minBulkQuantity: prod.minBulkQuantity,
        specifications: prod.specifications as any,
        highlights: prod.highlights,
        storageInstructions: prod.storageInstructions,
        nutritionalInfo: prod.nutritionalInfo as any,
        faqs: prod.faqs as any,
        originLocation: prod.originLocation,
        shelfLife: prod.shelfLife,
        seoTitle: prod.title,
        seoDescription: prod.description,
      },
      create: {
        id: prod.id,
        title: prod.title,
        slug: prod.slug,
        description: prod.description,
        category: prod.category,
        price: prod.price,
        costPrice: prod.costPrice,
        packSize: prod.packSize || '',
        weightKg: prod.weightKg,
        dimensions: prod.dimensions,
        stock: prod.stock,
        status: prod.status || 'AVAILABLE',
        images: prod.images,
        isOrganicCertified: prod.isOrganicCertified,
        isBulkEligible: prod.isBulkEligible,
        minBulkQuantity: prod.minBulkQuantity,
        specifications: prod.specifications as any,
        highlights: prod.highlights,
        storageInstructions: prod.storageInstructions,
        nutritionalInfo: prod.nutritionalInfo as any,
        faqs: prod.faqs as any,
        originLocation: prod.originLocation,
        shelfLife: prod.shelfLife,
        seoTitle: prod.title,
        seoDescription: prod.description,
      },
    });
  }

  // 5. Seed Users & Default Addresses
  console.log('👤 Seeding Users & Addresses...');
  const adminPassword = hashPassword(process.env.ADMIN_PASSWORD || process.env.ADMIN_INITIAL_PASSWORD || 'Admin@ProFarm2026!#Shiraz');
  const demoUserPassword = hashPassword('user123');
  const plusUserPassword = hashPassword('plus123');
  const proUserPassword = hashPassword('pro123');

  const usersToSeed = [
    {
      id: 'usr-admin',
      phone: '09170000000',
      username: 'admin',
      name: 'مدیر ارشد سیستم (ادمین)',
      email: 'admin@profarm-shiraz.ir',
      password: adminPassword,
      role: 'ADMIN' as const,
      isProMember: true,
      tier: 'PRO',
      proExpiresAt: '1406-01-01',
      authProvider: 'PASSWORD',
      isPhoneVerified: true,
      address: {
        id: 'addr-admin-1',
        recipientName: 'مدیر ارشد سیستم',
        phone: '09170000000',
        province: 'فارس',
        city: 'شیراز',
        postalCode: '۷۱۹۸۷۶۵۴۳۲',
        streetAddress: 'بلوار ارم، پلاک ۱۲',
        unit: 'واحد ۲',
        isShiraz: true,
        isDefault: true,
      },
    },
    {
      id: 'usr-pro',
      phone: '09171234567',
      username: 'pro',
      name: 'سارا نامدار (مشترک پرو)',
      email: 'pro@profarm-shiraz.ir',
      password: proUserPassword,
      role: 'USER' as const,
      isProMember: true,
      tier: 'PRO',
      proExpiresAt: '1405-12-29',
      authProvider: 'PASSWORD',
      isPhoneVerified: true,
      address: {
        id: 'addr-pro-1',
        recipientName: 'سارا نامدار',
        phone: '09171234567',
        province: 'فارس',
        city: 'شیراز',
        postalCode: '۷۱۹۵۵۱۱۲۳۴',
        streetAddress: 'خیابان قصرالدشت، نبش کوچه ۳۴',
        unit: 'طبقه ۴',
        isShiraz: true,
        isDefault: true,
      },
    },
    {
      id: 'usr-plus',
      phone: '09172223344',
      username: 'plus',
      name: 'رضا کمالی (مشترک پلاس)',
      email: 'plus@profarm-shiraz.ir',
      password: plusUserPassword,
      role: 'USER' as const,
      isProMember: true,
      isPlusMember: true,
      tier: 'PLUS',
      plusExpiresAt: '1405-12-29',
      authProvider: 'PASSWORD',
      isPhoneVerified: true,
      address: {
        id: 'addr-plus-1',
        recipientName: 'رضا کمالی',
        phone: '09172223344',
        province: 'فارس',
        city: 'شیراز',
        postalCode: '۷۱۵۵۵۹۸۷۶۱',
        streetAddress: 'بلوار معالی‌آباد، نبش خیابان دوستان، مجتمع نگین',
        unit: 'واحد ۱۴',
        isShiraz: true,
        isDefault: true,
      },
    },
    {
      id: 'usr-regular',
      phone: '09179876543',
      username: 'user',
      name: 'امیر محمدی (کاربر عادی)',
      email: 'user@profarm-shiraz.ir',
      password: demoUserPassword,
      role: 'USER' as const,
      isProMember: false,
      tier: 'FREE',
      authProvider: 'PASSWORD',
      isPhoneVerified: true,
      address: {
        id: 'addr-regular-1',
        recipientName: 'امیر محمدی',
        phone: '09179876543',
        province: 'فارس',
        city: 'شیراز',
        postalCode: '۷۱۳۴۵۱۲۳۴۵',
        streetAddress: 'خیابان زند، کوچه ۱۸، پلاک ۵',
        unit: 'طبقه ۱',
        isShiraz: true,
        isDefault: true,
      },
    },
    {
      id: 'usr-ali',
      phone: '09171112233',
      username: 'ali',
      name: 'علی حسینی',
      email: 'ali@profarm-shiraz.ir',
      password: demoUserPassword,
      role: 'USER' as const,
      isProMember: true,
      tier: 'PRO',
      proExpiresAt: '1405-12-29',
      authProvider: 'PHONE_OTP',
      isPhoneVerified: true,
      address: {
        id: 'addr-1',
        recipientName: 'علی حسینی',
        phone: '09171112233',
        province: 'فارس',
        city: 'شیراز',
        postalCode: '۷۱۹۸۷۶۵۴۳۲',
        streetAddress: 'شیراز، بلوار ارم، کوچه ۱۲، پلاک ۲۴',
        unit: 'واحد ۳',
        isShiraz: true,
        isDefault: true,
      },
    },
    {
      id: 'usr-maryam',
      phone: '09173334455',
      username: 'maryam',
      name: 'دکتر مریم شمس',
      email: 'maryam@profarm-shiraz.ir',
      password: demoUserPassword,
      role: 'USER' as const,
      isProMember: true,
      tier: 'PRO',
      proExpiresAt: '1405-12-29',
      authProvider: 'PHONE_OTP',
      isPhoneVerified: true,
      address: {
        id: 'addr-maryam-1',
        recipientName: 'دکتر مریم شمس',
        phone: '09173334455',
        province: 'فارس',
        city: 'شیراز',
        postalCode: '۷۱۹۶۶۸۸۷۷۶',
        streetAddress: 'شیراز، خیابان عفیف‌آباد، کوچه ۲۰',
        unit: 'واحد ۵',
        isShiraz: true,
        isDefault: true,
      },
    },
  ];

  for (const u of usersToSeed) {
    const userRecord = await prisma.user.upsert({
      where: { phone: u.phone },
      update: {
        name: u.name,
        username: u.username,
        email: u.email,
        password: u.password,
        role: u.role,
        isProMember: u.isProMember,
        isPlusMember: (u as any).isPlusMember || false,
        tier: u.tier,
        plusExpiresAt: (u as any).plusExpiresAt || null,
        proExpiresAt: (u as any).proExpiresAt || null,
        authProvider: u.authProvider,
        isPhoneVerified: u.isPhoneVerified,
      },
      create: {
        id: u.id,
        phone: u.phone,
        username: u.username,
        name: u.name,
        email: u.email,
        password: u.password,
        role: u.role,
        isProMember: u.isProMember,
        isPlusMember: (u as any).isPlusMember || false,
        tier: u.tier,
        plusExpiresAt: (u as any).plusExpiresAt || null,
        proExpiresAt: (u as any).proExpiresAt || null,
        authProvider: u.authProvider,
        isPhoneVerified: u.isPhoneVerified,
      },
    });

    if (u.address) {
      await prisma.address.upsert({
        where: { id: u.address.id },
        update: {
          recipientName: u.address.recipientName,
          phone: u.address.phone,
          streetAddress: u.address.streetAddress,
          unit: u.address.unit,
        },
        create: {
          id: u.address.id,
          userId: userRecord.id,
          recipientName: u.address.recipientName,
          phone: u.address.phone,
          province: u.address.province,
          city: u.address.city,
          postalCode: u.address.postalCode,
          streetAddress: u.address.streetAddress,
          unit: u.address.unit,
          isShiraz: u.address.isShiraz,
          isDefault: u.address.isDefault,
        },
      });
    }
  }

  // 6. Seed Coupons
  console.log(`🎟️ Seeding ${INITIAL_COUPONS.length} Coupons...`);
  for (const coup of INITIAL_COUPONS) {
    await prisma.coupon.upsert({
      where: { code: coup.code },
      update: {
        title: coup.title,
        description: coup.description,
        targetType: coup.targetType,
        targetProductId: coup.targetProductId,
        targetProductName: coup.targetProductName,
        discountType: coup.discountType,
        discountValue: coup.discountValue,
        minOrderAmount: coup.minOrderAmount,
        maxDiscountAmount: coup.maxDiscountAmount,
        usageLimit: coup.usageLimit,
        usageCount: coup.usageCount,
        isActive: coup.isActive,
        expiresAt: coup.expiresAt,
      },
      create: {
        id: coup.id,
        code: coup.code,
        title: coup.title,
        description: coup.description,
        targetType: coup.targetType,
        targetProductId: coup.targetProductId,
        targetProductName: coup.targetProductName,
        discountType: coup.discountType,
        discountValue: coup.discountValue,
        minOrderAmount: coup.minOrderAmount,
        maxDiscountAmount: coup.maxDiscountAmount,
        usageLimit: coup.usageLimit,
        usageCount: coup.usageCount,
        isActive: coup.isActive,
        expiresAt: coup.expiresAt,
      },
    });
  }

  // 7. Seed Delivery Slots
  console.log('🚚 Seeding Delivery Slots...');
  const slotsToSeed = [
    {
      id: 'slot-today-morning',
      date: 'دوشنبه ۲۴ شهریور',
      dayOfWeek: 'دوشنبه',
      timeWindow: '۰۹:۰۰ الی ۱۳:۰۰',
      maxCapacity: 25,
      currentBookings: 18,
    },
    {
      id: 'slot-sun-evening',
      date: 'یکشنبه ۳۰ شهریور',
      dayOfWeek: 'یکشنبه',
      timeWindow: '۱۵:۰۰ الی ۲۱:۰۰',
      maxCapacity: 30,
      currentBookings: 5,
    },
    {
      id: 'slot-wed-evening',
      date: 'چهارشنبه ۲ مهر',
      dayOfWeek: 'چهارشنبه',
      timeWindow: '۱۵:۰۰ الی ۲۱:۰۰',
      maxCapacity: 30,
      currentBookings: 8,
    },
  ];

  for (const slot of slotsToSeed) {
    await prisma.deliverySlot.upsert({
      where: { id: slot.id },
      update: {
        date: slot.date,
        dayOfWeek: slot.dayOfWeek,
        timeWindow: slot.timeWindow,
        maxCapacity: slot.maxCapacity,
        currentBookings: slot.currentBookings,
      },
      create: slot,
    });
  }

  // 8. Seed Orders, OrderItems & Payments
  console.log(`📦 Seeding ${INITIAL_ADMIN_ORDERS.length} Admin Orders...`);
  for (const ord of INITIAL_ADMIN_ORDERS) {
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ id: ord.userId }, { phone: ord.user?.phone }],
      },
    });
    if (!user) continue;

    const address =
      (await prisma.address.findFirst({ where: { userId: user.id } })) ||
      (await prisma.address.create({
        data: {
          userId: user.id,
          recipientName: ord.address?.recipientName || user.name || 'مشتری شیراز',
          phone: ord.address?.phone || user.phone,
          province: ord.address?.province || 'فارس',
          city: ord.address?.city || 'شیراز',
          postalCode: ord.address?.postalCode || '۷۱۹۸۷۶۵۴۳۲',
          streetAddress: ord.address?.streetAddress || 'شیراز، بلوار ارم',
          unit: ord.address?.unit || '',
          isShiraz: true,
          isDefault: true,
        },
      }));

    const statusMap: Record<string, any> = {
      PROCESSING: 'PROCESSING',
      DELIVERED: 'DELIVERED',
      CANCELLED: 'CANCELLED',
      PENDING_PAYMENT: 'PENDING_PAYMENT',
      OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
    };

    let validSlotId = ord.deliverySlotId || 'slot-today-morning';
    if (validSlotId) {
      const slotExists = await prisma.deliverySlot.findUnique({ where: { id: validSlotId } });
      if (!slotExists) {
        if (ord.deliverySlot) {
          await prisma.deliverySlot.create({
            data: {
              id: validSlotId,
              date: ord.deliverySlot.date || 'تحویل شیراز',
              dayOfWeek: ord.deliverySlot.dayOfWeek || 'دوشنبه',
              timeWindow: ord.deliverySlot.timeWindow || '۱۵:۰۰ الی ۲۱:۰۰',
              maxCapacity: ord.deliverySlot.maxCapacity || 30,
              currentBookings: ord.deliverySlot.currentBookings || 1,
            },
          });
        } else {
          validSlotId = 'slot-today-morning';
        }
      }
    }

    const orderRecord = await prisma.order.upsert({
      where: { orderNumber: ord.orderNumber },
      update: {
        totalAmount: ord.totalAmount,
        status: statusMap[ord.status] || 'PROCESSING',
        isBulkOrder: ord.isBulkOrder || false,
        settlementStatus: ord.settlementStatus || 'SETTLED',
        settlementRef: ord.settlementRef || `SHP-${Date.now()}`,
        deliverySlotId: validSlotId,
      },
      create: {
        id: ord.id,
        orderNumber: ord.orderNumber,
        userId: user.id,
        addressId: address.id,
        deliverySlotId: validSlotId,
        totalAmount: ord.totalAmount,
        status: statusMap[ord.status] || 'PROCESSING',
        isBulkOrder: ord.isBulkOrder || false,
        settlementStatus: ord.settlementStatus || 'SETTLED',
        settlementRef: ord.settlementRef || `SHP-${Date.now()}`,
      },
    });

    // Seed Order Items
    if (ord.items && ord.items.length > 0) {
      await prisma.orderItem.deleteMany({ where: { orderId: orderRecord.id } });
      for (const item of ord.items) {
        const prod = await prisma.product.findFirst({
          where: { OR: [{ id: item.productId }, { slug: item.productId }] },
        });
        if (prod) {
          await prisma.orderItem.create({
            data: {
              orderId: orderRecord.id,
              productId: prod.id,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
            },
          });
        }
      }
    }

    // Seed Payment record
    await prisma.payment.upsert({
      where: { orderId: orderRecord.id },
      update: {
        amount: ord.totalAmount,
        status: ord.status === 'PROCESSING' || ord.status === 'DELIVERED' ? 'SUCCESS' : 'INITIATED',
        refId: ord.settlementRef || `REF-${ord.orderNumber.replace(/[^0-9]/g, '')}`,
      },
      create: {
        orderId: orderRecord.id,
        amount: ord.totalAmount,
        gateway: 'ZARINPAL',
        authority: `A00000000000000000000000000${ord.orderNumber.slice(-6)}`,
        refId: ord.settlementRef || `REF-${ord.orderNumber.replace(/[^0-9]/g, '')}`,
        status: ord.status === 'PROCESSING' || ord.status === 'DELIVERED' ? 'SUCCESS' : 'INITIATED',
      },
    });
  }

  // 9. Seed Product Reviews
  console.log(`⭐ Seeding ${INITIAL_PRODUCT_REVIEWS.length} Product Reviews...`);
  for (const rev of INITIAL_PRODUCT_REVIEWS) {
    const prod = await prisma.product.findFirst({
      where: { OR: [{ id: rev.productId }, { slug: rev.productSlug }] },
    });
    const user = await prisma.user.findFirst({
      where: { OR: [{ id: rev.userId }, { phone: rev.userPhone }] },
    });

    if (prod && user) {
      await prisma.productReview.upsert({
        where: { id: rev.id },
        update: {
          rating: rev.rating,
          title: rev.title,
          comment: rev.comment,
          isVerifiedBuyer: rev.isVerifiedBuyer,
          pros: rev.pros,
          cons: rev.cons,
          isRecommended: rev.isRecommended,
          status: rev.status,
          adminResponse: rev.adminResponse,
        },
        create: {
          id: rev.id,
          productId: prod.id,
          productSlug: prod.slug,
          productTitle: prod.title,
          userId: user.id,
          userName: rev.userName,
          userPhone: rev.userPhone,
          rating: rev.rating,
          title: rev.title,
          comment: rev.comment,
          isVerifiedBuyer: rev.isVerifiedBuyer,
          pros: rev.pros,
          cons: rev.cons,
          isRecommended: rev.isRecommended,
          status: rev.status,
          adminResponse: rev.adminResponse,
        },
      });
    }
  }

  // 10. Seed SMS Event Templates
  console.log(`📱 Seeding ${DEFAULT_SMS_EVENT_TEMPLATES.length} SMS Event Templates...`);
  for (const tpl of DEFAULT_SMS_EVENT_TEMPLATES) {
    await prisma.smsEventTemplate.upsert({
      where: { id: tpl.id },
      update: {
        title: tpl.title,
        category: tpl.category,
        description: tpl.description,
        template: tpl.template,
        isEnabled: tpl.isEnabled,
        availableVariables: tpl.availableVariables as any,
      },
      create: {
        id: tpl.id,
        title: tpl.title,
        category: tpl.category,
        description: tpl.description,
        template: tpl.template,
        isEnabled: tpl.isEnabled,
        availableVariables: tpl.availableVariables as any,
      },
    });
  }

  console.log('✅ Shiraz Pro Farm Database Seeding Completed Successfully! All tables populated.');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
