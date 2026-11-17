'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Product } from '@/types';
import { useCart } from '@/hooks/useCart';
import { formatToman, toPersianDigits } from '@/lib/formatters';
import { Badge } from '@/components/ui/Badge';
import { Plus, Minus, ShoppingBag, Sparkles, PackageCheck, Clock, AlertCircle } from 'lucide-react';

interface ProductCardProps {
  product: Product;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const { items, addItem, updateQuantity } = useCart();
  const cartItem = items.find((i) => i.product.id === product.id);
  const quantity = cartItem?.quantity || 0;

  const currentStatus = product.status || (product.stock > 0 ? 'AVAILABLE' : 'OUT_OF_STOCK');
  const isComingSoon = currentStatus === 'COMING_SOON';
  const isOutOfStock = currentStatus === 'OUT_OF_STOCK' || product.stock <= 0;

  return (
    <article className="group relative bg-white rounded-3xl border border-farm-border overflow-hidden shadow-farm hover:shadow-farm-hover transition-all duration-300 flex flex-col justify-between">
      {/* Product Image & Clean Minimal Badges (Max 1-2 overlays) */}
      <div className="relative aspect-4/3 w-full bg-farm-bg-warm overflow-hidden">
        <Link href={`/products/${product.slug}`} className="block w-full h-full relative">
          <Image
            src={product.images[0] || '/images/prod-eggs.jpg'}
            alt={product.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className={`object-cover group-hover:scale-105 transition-transform duration-500 ${
              isOutOfStock ? 'grayscale-40 opacity-80' : ''
            }`}
          />
        </Link>

        {/* Top-Right: Show exceptional status OR a single primary organic badge */}
        <div className="absolute top-3 right-3 flex flex-col gap-1.5 z-10 pointer-events-none">
          {isComingSoon ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-farm-primary-dark text-white shadow-md backdrop-blur-md">
              <Clock className="w-3.5 h-3.5 text-farm-accent" />
              <span>به‌زودی</span>
            </span>
          ) : isOutOfStock ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-rose-700 text-white shadow-md backdrop-blur-md">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>اتمام موجودی</span>
            </span>
          ) : product.isOrganicCertified ? (
            <Badge variant="organic" className="shadow-xs backdrop-blur-md bg-white/95">
              <Sparkles className="w-3 h-3 text-farm-primary" />
              <span>ارگانیک گواهی‌شده</span>
            </Badge>
          ) : null}
        </div>

        {/* Bottom-Right Package Size Pill (only when set) */}
        {product.packSize && product.packSize.trim() !== '' && (
          <div className="absolute bottom-3 right-3 z-10 pointer-events-none">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-farm-primary/90 text-white backdrop-blur-md shadow-xs">
              <PackageCheck className="w-3.5 h-3.5 text-farm-accent" />
              <span>{product.packSize}</span>
            </span>
          </div>
        )}
      </div>

      {/* Product Information */}
      <div className="p-5 flex flex-col flex-1 justify-between gap-4">
        <div>
          <div className="flex items-center justify-between gap-2 text-xs text-farm-text-muted mb-1.5 font-medium">
            <span>{product.category}</span>
            {product.isBulkEligible && (
              <span className="text-farm-gold-text font-bold">فروش عمده</span>
            )}
          </div>

          <Link href={`/products/${product.slug}`}>
            <h3 className="text-base font-bold text-farm-primary group-hover:text-farm-primary-dark transition-colors line-clamp-2 leading-snug">
              {product.title}
            </h3>
          </Link>

          <p className="text-xs sm:text-[13px] text-farm-text-muted mt-2 line-clamp-2 leading-relaxed">
            {product.description}
          </p>
        </div>

        {/* Price & Accessible Cart Actions */}
        <div className="pt-3 border-t border-farm-bg-warm flex items-center justify-between gap-2">
          <div className="min-w-0">
            <span className="block text-xs text-farm-text-muted">قیمت هر بسته:</span>
            <span className="text-base font-black text-farm-primary">
              {formatToman(product.price)}
            </span>
          </div>

          {isComingSoon ? (
            <span className="inline-flex items-center gap-1 min-h-[40px] px-3 rounded-xl bg-farm-bg-warm text-farm-primary border border-farm-border text-xs font-bold shrink-0">
              <Clock className="w-3.5 h-3.5 text-farm-gold-text" />
              <span>به‌زودی</span>
            </span>
          ) : isOutOfStock ? (
            <span className="inline-flex items-center min-h-[40px] px-3 rounded-xl bg-gray-100 text-gray-700 border border-gray-200 text-xs font-bold shrink-0">
              اتمام موجودی
            </span>
          ) : quantity === 0 ? (
            <button
              type="button"
              onClick={() => addItem(product, 1)}
              className="flex items-center gap-1.5 min-h-[44px] px-3.5 rounded-xl bg-farm-primary text-white text-xs sm:text-sm font-bold hover:bg-farm-primary-dark active:scale-95 transition-all shadow-xs cursor-pointer shrink-0"
            >
              <ShoppingBag className="w-4 h-4 text-farm-accent" />
              <span>افزودن</span>
            </button>
          ) : (
            <div
              className="flex items-center gap-1.5 bg-farm-bg-warm border border-farm-border rounded-xl p-1 shrink-0"
              role="group"
              aria-label={`تعداد ${product.title}`}
            >
              <button
                type="button"
                onClick={() => updateQuantity(product.id, quantity + 1)}
                disabled={quantity >= product.stock}
                aria-label={`افزایش تعداد ${product.title}`}
                className="min-w-[36px] min-h-[36px] rounded-lg bg-white flex items-center justify-center text-farm-primary hover:bg-farm-primary hover:text-white transition-colors cursor-pointer disabled:opacity-40"
              >
                <Plus className="w-4 h-4" />
              </button>
              <span className="min-w-[24px] text-center text-sm font-black text-farm-primary">
                {toPersianDigits(quantity)}
              </span>
              <button
                type="button"
                onClick={() => updateQuantity(product.id, quantity - 1)}
                aria-label={`کاهش تعداد ${product.title}`}
                className="min-w-[36px] min-h-[36px] rounded-lg bg-white flex items-center justify-center text-farm-primary hover:bg-rose-700 hover:text-white transition-colors cursor-pointer"
              >
                <Minus className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
};
