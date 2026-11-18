/**
 * The single pricing function. POST /api/orders charges exactly the total computed here, and
 * POST /api/orders/quote returns the same object, so the number shown at checkout is the number charged.
 *
 * Server-only: it reads products, settings, coupons, orders and slots from farmStore.
 */
import type { CartItem, DeliverySlot, Product, SubscriptionTier, User } from '@/types';
import { farmStore } from './db-store';
import { calculateCartDiscounts, isBulkOrder, isShirazAddress } from './formatters';
import { getEffectiveTier } from './subscription';

export interface QuoteItemInput {
  productId: string;
  quantity: number;
}

export interface QuoteInput {
  /** Account placing or previewing the order. null = guest (FREE tier, no egg quota). */
  user?: User | null;
  items?: QuoteItemInput[];
  couponCode?: string | null;
  slotId?: string | null;
  /** City from the delivery address. Omit (undefined) for a cart preview that has no address yet. */
  city?: string | null;
  /** Province from the delivery address. Empty means Fars. Shiraz needs the city AND Fars. */
  province?: string | null;
  /** true when placing an order: a delivery slot is then mandatory. */
  requireSlot?: boolean;
  isSubscription?: boolean;
  subscriptionPlan?: unknown;
  nowMs?: number;
}

export interface QuoteLine {
  /** Product slug, the key stored on the order item. */
  productId: string;
  title: string;
  unitPrice: number;
  quantity: number;
  /** Gross line total (unitPrice * quantity). */
  lineTotal: number;
  /** Subscription discount on this line. */
  discount: number;
  eggCount: number;
  eggDiscountedCount: number;
  costPrice: number;
  /** Server product snapshot, used when the order is created. */
  product: Product;
}

export interface CartQuote {
  ok: boolean;
  errors: string[];
  /** true when one of the errors is a stock shortage (the route answers 409 INSUFFICIENT_STOCK). */
  stockIssue: boolean;
  tier: SubscriptionTier;
  isSubscription: boolean;
  subscriptionPlan: 'PLUS' | 'PRO' | null;
  lines: QuoteLine[];
  subtotal: number;
  tierDiscount: number;
  eggDiscount: number;
  otherDiscount: number;
  shippingBase: number;
  shippingDiscount: number;
  /** Shipping charged. Outside Shiraz it is 0: those orders are bulk-only and their freight is quoted separately. */
  shipping: number;
  couponCode: string | null;
  couponDiscount: number;
  couponMessage: string | null;
  total: number;
  isBulk: boolean;
  isShiraz: boolean;
  eggQuota: { limit: number; usedBefore: number; remainingBefore: number };
  slot: DeliverySlot | null;
}

const NOT_SHIRAZ_MESSAGE =
  'خرده‌فروشی صرفاً مختص شهر شیراز است. سفارش‌های خارج از شیراز باید به صورت عمده (حداقل ۱۰ بسته یا ۵ میلیون تومان) ثبت شوند.';

function emptyQuote(tier: SubscriptionTier): CartQuote {
  return {
    ok: false,
    errors: [],
    stockIssue: false,
    tier,
    isSubscription: false,
    subscriptionPlan: null,
    lines: [],
    subtotal: 0,
    tierDiscount: 0,
    eggDiscount: 0,
    otherDiscount: 0,
    shippingBase: 0,
    shippingDiscount: 0,
    shipping: 0,
    couponCode: null,
    couponDiscount: 0,
    couponMessage: null,
    total: 0,
    isBulk: false,
    isShiraz: true,
    eggQuota: { limit: 0, usedBefore: 0, remainingBefore: 0 },
    slot: null,
  };
}

function quoteSubscription(input: QuoteInput, user: User | null, tier: SubscriptionTier, now: number): CartQuote {
  const quote = emptyQuote(tier);
  quote.isSubscription = true;
  const settings = farmStore.getSubscriptionSettings();
  const plan = input.subscriptionPlan;

  if (plan !== 'PLUS' && plan !== 'PRO') {
    quote.errors.push('طرح اشتراک انتخابی نامعتبر است. لطفاً پلاس یا پرو را انتخاب فرمایید.');
  } else {
    quote.subscriptionPlan = plan;
    if (!user) {
      quote.errors.push('جهت خرید اشتراک لطفاً ابتدا وارد حساب کاربری خود شوید.');
    } else {
      if (tier === 'PRO' && plan === 'PLUS') {
        quote.errors.push('اشتراک پرو شما فعال است و خرید اشتراک پلاس امکان‌پذیر نیست.');
      }
      const capacity = plan === 'PRO' ? settings.proMaxCapacity : settings.plusMaxCapacity;
      if (capacity > 0 && tier !== plan && farmStore.countActiveMembers(plan, now) >= capacity) {
        quote.errors.push('ظرفیت اعضای این طرح تکمیل شده است و در حال حاضر امکان ثبت اشتراک جدید نیست.');
      }
    }
  }

  if (input.couponCode && String(input.couponCode).trim()) {
    quote.errors.push('کد تخفیف برای خرید اشتراک قابل استفاده نیست.');
  }

  if (plan === 'PLUS' || plan === 'PRO') {
    const price = plan === 'PRO' ? settings.proMonthlyPrice : settings.plusMonthlyPrice;
    const title = plan === 'PLUS' ? 'اشتراک نقره‌ای پروفارم پلاس (۱ ماهه)' : 'اشتراک طلایی پروفارم پرو (۱ ماهه)';
    const productId = `sub-${plan.toLowerCase()}`;
    const product = {
      id: productId,
      slug: productId,
      title,
      category: 'اشتراک',
      price,
      images: ['/images/hero-shiraz-farm.jpg'],
      stock: 9999,
      isAvailable: true,
      description: 'ارسال ۶ روز در هفته و تخفیف‌های ویژه مزارع فارس',
    } as unknown as Product;
    quote.lines = [
      {
        productId,
        title,
        unitPrice: price,
        quantity: 1,
        lineTotal: price,
        discount: 0,
        eggCount: 0,
        eggDiscountedCount: 0,
        costPrice: 0,
        product,
      },
    ];
    quote.subtotal = price;
    quote.total = price;
  }

  quote.ok = quote.errors.length === 0;
  return quote;
}

/**
 * Prices a cart for a user at a moment in time. Errors are returned in `errors` (never thrown).
 * Rules applied, in order: items and stock; tier discounts (egg quota, other goods, shipping); the Shiraz rule
 * (outside Shiraz only bulk orders, shipping 0); the delivery slot (Asia/Tehran calendar, tier days, closures,
 * capacity); the coupon (validated against the discounted subtotal); then total = subtotal - tier discount +
 * shipping - coupon, never below 0.
 */
export function quoteCart(input: QuoteInput): CartQuote {
  const now = input.nowMs ?? Date.now();
  const user = input.user ?? null;
  const tier = getEffectiveTier(user, now);

  if (input.isSubscription) {
    return quoteSubscription(input, user, tier, now);
  }

  const quote = emptyQuote(tier);
  const rawItems = Array.isArray(input.items) ? input.items : [];
  if (rawItems.length === 0) quote.errors.push('سبد خرید نمی‌تواند خالی باشد.');
  if (rawItems.length > 100) quote.errors.push('تعداد اقلام سفارش بیش از حد مجاز است.');

  // Lines are resolved one by one, then merged per product. The stock check uses the combined quantity, so two
  // lines of the same product cannot each pass a check that only their sum fails.
  const perProduct = new Map<string, { product: Product; quantity: number }>();
  for (const raw of rawItems.slice(0, 100)) {
    if (!raw || typeof raw !== 'object' || typeof raw.productId !== 'string' || !raw.productId) {
      quote.errors.push('اطلاعات کالا در سبد خرید نامعتبر است.');
      continue;
    }
    const prod = farmStore.getProductBySlug(raw.productId) || farmStore.getProductById(raw.productId);
    if (!prod) {
      quote.errors.push('یکی از کالاهای سبد خرید در فروشگاه یافت نشد. لطفاً سبد خرید را بررسی فرمایید.');
      continue;
    }
    const qty = Number(raw.quantity);
    if (!Number.isSafeInteger(qty) || qty < 1 || qty > 1000) {
      quote.errors.push(`تعداد انتخابی برای محصول «${prod.title}» نامعتبر است (باید بین ۱ تا ۱۰۰۰ باشد).`);
      continue;
    }
    const previous = perProduct.get(prod.id);
    perProduct.set(prod.id, { product: prod, quantity: (previous?.quantity ?? 0) + qty });
  }

  const cartItems: CartItem[] = [];
  const entries: { productId: string; product: Product; quantity: number }[] = [];
  for (const { product: prod, quantity } of Array.from(perProduct.values())) {
    if (quantity > 1000) {
      quote.errors.push(`تعداد انتخابی برای محصول «${prod.title}» نامعتبر است (باید بین ۱ تا ۱۰۰۰ باشد).`);
      continue;
    }
    if ((prod.stock ?? 0) < quantity) {
      quote.stockIssue = true;
      quote.errors.push(
        `متاسفانه موجودی محصول «${prod.title}» کافی نیست. موجودی فعلی: ${prod.stock ?? 0} عدد، تعداد درخواستی: ${quantity} عدد.`
      );
    }
    entries.push({ productId: prod.slug, product: prod, quantity });
    cartItems.push({ product: prod, quantity });
  }

  const subtotal = cartItems.reduce((sum, c) => sum + c.product.price * c.quantity, 0);
  // Without an address (cart preview) the Shiraz rule is not evaluated and the Shiraz shipping is shown.
  // Shiraz needs the city Shiraz AND the province Fars (or an empty province).
  const deliveryKnown = input.city !== undefined;
  const isShiraz = deliveryKnown ? isShirazAddress(input.city, input.province) : true;
  const isBulk = isBulkOrder(cartItems, subtotal);

  const settings = farmStore.getSubscriptionSettings();
  const usedBefore = user ? farmStore.getUserRolling30DaysEggDiscountUsed(user.id) : 0;
  const discounts = calculateCartDiscounts(cartItems, tier, settings, usedBefore);

  if (deliveryKnown && !isShiraz && !isBulk) {
    quote.errors.push(NOT_SHIRAZ_MESSAGE);
  }

  // Shiraz pays the courier fee (after the tier discount). Outside Shiraz only bulk orders are accepted, and their
  // freight is quoted separately, so the online total carries no shipping (checkout copy: "خارج از شیراز ... عمده").
  const shipping = isShiraz ? discounts.finalShipping : 0;

  let slot: DeliverySlot | null = null;
  if (input.slotId) {
    const checked = farmStore.validateDeliverySlot(input.slotId, tier, new Date(now));
    if (checked.ok) slot = checked.slot;
    else quote.errors.push(checked.error);
  } else if (input.requireSlot) {
    quote.errors.push('لطفاً سانس تحویل را انتخاب فرمایید.');
  }

  const afterTier = Math.max(0, subtotal - (discounts.eggDiscount + discounts.otherDiscount));
  let couponDiscount = 0;
  let couponCode: string | null = null;
  let couponMessage: string | null = null;
  if (input.couponCode && String(input.couponCode).trim()) {
    const couponResult = farmStore.validateAndApplyCoupon(
      String(input.couponCode),
      cartItems.map((c) => ({
        product: { id: c.product.id, price: c.product.price, title: c.product.title },
        quantity: c.quantity,
      })),
      shipping,
      afterTier,
      { userId: user?.id ?? null, now }
    );
    if (couponResult.isValid && couponResult.coupon) {
      couponDiscount = couponResult.discountAmount;
      couponCode = couponResult.coupon.code;
      couponMessage = couponResult.message;
    } else {
      quote.errors.push(couponResult.message);
    }
  }
  // A coupon can never exceed what is left to pay before it.
  couponDiscount = Math.min(couponDiscount, afterTier + shipping);

  quote.lines = entries.map((e, idx) => {
    const d = discounts.lines[idx];
    return {
      productId: e.productId,
      title: e.product.title,
      unitPrice: e.product.price,
      quantity: e.quantity,
      lineTotal: e.product.price * e.quantity,
      discount: d.discount,
      eggCount: d.eggCount,
      eggDiscountedCount: d.eggDiscountedCount,
      costPrice: typeof e.product.costPrice === 'number' && e.product.costPrice >= 0 ? e.product.costPrice : 0,
      product: e.product,
    };
  });

  quote.subtotal = subtotal;
  quote.tierDiscount = discounts.eggDiscount + discounts.otherDiscount;
  quote.eggDiscount = discounts.eggDiscount;
  quote.otherDiscount = discounts.otherDiscount;
  quote.shippingBase = discounts.finalShipping;
  quote.shippingDiscount = discounts.shippingDiscount;
  quote.shipping = shipping;
  quote.couponCode = couponCode;
  quote.couponDiscount = couponDiscount;
  quote.couponMessage = couponMessage;
  quote.total = Math.max(0, afterTier + shipping - couponDiscount);
  quote.isBulk = isBulk;
  quote.isShiraz = isShiraz;
  quote.eggQuota = {
    limit: discounts.eggQuota,
    usedBefore,
    remainingBefore: discounts.remainingEggQuota,
  };
  quote.slot = slot;
  quote.ok = quote.errors.length === 0;
  return quote;
}
