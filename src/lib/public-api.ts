/**
 * Shared shaping helpers for customer-facing API responses.
 * Everything a browser may see passes through here, so internal fields (cost prices, admin notes,
 * phone numbers of other people, reviewer contact data) are removed in one place.
 */
import type { Coupon, Product, ProductReview, ReturnRequest } from '@/types';
import type { CartQuote } from './pricing';

/** Product as shown to customers. The cost price never leaves the server. */
export function toPublicProduct<T extends Product>(product: T): Omit<T, 'costPrice'> {
  const { costPrice: _cost, ...rest } = product;
  return rest;
}

/** Quote without the internal product snapshots (costs and full product objects stay on the server). */
export function publicQuote(quote: CartQuote) {
  return {
    ...quote,
    lines: quote.lines.map(({ product: _product, costPrice: _cost, ...line }) => line),
  };
}

export function publicCoupon(coupon: Coupon) {
  return {
    code: coupon.code,
    title: coupon.title,
    description: coupon.description ?? '',
    targetType: coupon.targetType,
    discountType: coupon.discountType,
    discountValue: coupon.discountValue,
    minOrderAmount: coupon.minOrderAmount ?? null,
    maxDiscountAmount: coupon.maxDiscountAmount ?? null,
    expiresAt: coupon.expiresAt ?? null,
  };
}

/** Reviewer name for public display: first name plus the initial of the last name. */
export function maskReviewerName(name?: string | null): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'کاربر';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1].charAt(0)}.`;
}

export function publicReview(review: ProductReview) {
  return {
    id: review.id,
    productSlug: review.productSlug,
    rating: review.rating,
    title: review.title ?? null,
    comment: review.comment,
    pros: review.pros ?? [],
    cons: review.cons ?? [],
    isRecommended: review.isRecommended ?? null,
    isVerifiedBuyer: review.isVerifiedBuyer,
    adminResponse: review.adminResponse ?? null,
    userName: maskReviewerName(review.userName),
    createdAt: review.createdAt,
  };
}

/** Return request as seen by its owner. Admin notes and other customers' contact data are not included. */
export function publicReturn(request: ReturnRequest) {
  return {
    id: request.id,
    orderNumber: request.orderNumber,
    productId: request.productId ?? null,
    productTitle: request.productTitle ?? null,
    quantity: request.quantity ?? null,
    reason: request.reason,
    reasonTitle: request.reasonTitle ?? null,
    description: request.description ?? '',
    refundAmount: request.refundAmount,
    status: request.status,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt ?? null,
  };
}

const ZERO_WIDTH = /[‌‍‎‏﻿]/g;

/**
 * Search normalisation: Arabic ي and ك become Persian ی and ک, Persian and Arabic-Indic digits become ASCII,
 * zero-width joiners are removed and letter case is ignored.
 */
export function normalizeSearchText(input: string): string {
  return input
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(ZERO_WIDTH, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Same as normalizeSearchText with all spaces removed, so "تخم مرغ" also matches "تخم‌مرغ". */
export function compactSearchKey(input: string): string {
  return normalizeSearchText(input).replace(/ /g, '');
}

export function matchesSearch(haystacks: (string | null | undefined)[], query: string): boolean {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;
  const compactQuery = compactSearchKey(query);
  return haystacks.some((value) => {
    if (!value) return false;
    return normalizeSearchText(value).includes(normalizedQuery) || compactSearchKey(value).includes(compactQuery);
  });
}
