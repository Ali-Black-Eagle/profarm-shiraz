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
  const isAvailable = currentStatus === 'AVAILABLE' && product.stock > 0;
  const isComingSoon = currentStatus === 'COMING_SOON';
  const isOutOfStock = currentStatus === 'OUT_OF_STOCK' || product.stock <= 0;

  return (
    <div className="group relative bg-white rounded-3xl border border-[#E6E1D5] overflow-hidden shadow-farm hover:shadow-farm-hover transition-all duration-300 flex flex-col justify-between">
      {/* Product Image & Badges */}
      <div className="relative aspect-4/3 w-full bg-[#F3EFE6] overflow-hidden">
        <Link href={`/products/${product.slug}`} className="block w-full h-full relative">
          <Image
            src={product.images[0] || '/images/prod-eggs.jpg'}
            alt={product.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className={`object-cover group-hover:scale-105 transition-transform duration-500 ${
              isOutOfStock ? 'grayscale-40 opacity-85' : ''
            }`}
          />
        </Link>

        {/* Top Badges */}
        <div className="absolute top-3 right-3 flex flex-col gap-1.5 z-10">
          {isComingSoon && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-purple-700 text-white shadow-md backdrop-blur-md">
              <Clock className="w-3 h-3" />
              <span>به زودی در مزرعه</span>
            </span>
          )}

          {isOutOfStock && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-rose-700 text-white shadow-md backdrop-blur-md">
              <AlertCircle className="w-3 h-3" />
              <span>اتمام موجودی</span>
            </span>
          )}

          {isAvailable && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-emerald-700/90 text-white shadow-xs backdrop-blur-md">
              <span>موجود در انبار شیراز</span>
            </span>
          )}

          {product.isOrganicCertified && (
            <Badge variant="organic" className="shadow-xs backdrop-blur-md bg-white/90">
              <Sparkles className="w-3 h-3 text-[#2C4A2E]" />
              <span>ارگانیک گواهی‌شده</span>
            </Badge>
          )}
          {product.isBulkEligible && (
            <Badge variant="bulk" className="shadow-xs backdrop-blur-md bg-white/90">
              <span>خرید عمده مجاز</span>
            </Badge>
          )}
        </div>

        {/* Package Size Floating Pill (only if packSize is set) */}
        {product.packSize && product.packSize.trim() !== '' && (
          <div className="absolute bottom-3 right-3 z-10">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#2C4A2E]/90 text-white backdrop-blur-md shadow-xs">
              <PackageCheck className="w-3.5 h-3.5 text-[#D4A373]" />
              <span>{product.packSize}</span>
            </span>
          </div>
        )}
      </div>

      {/* Product Information */}
      <div className="p-5 flex flex-col flex-1 justify-between gap-4">
        <div>
          <div className="text-xs text-[#6C757D] mb-1.5 font-medium">
            <span>{product.category}</span>
          </div>

          <Link href={`/products/${product.slug}`}>
            <h3 className="text-base font-bold text-[#2C4A2E] group-hover:text-[#1E3520] transition-colors line-clamp-2 leading-snug">
              {product.title}
            </h3>
          </Link>

          <p className="text-xs text-gray-500 mt-2 line-clamp-2 leading-relaxed">
            {product.description}
          </p>
        </div>

        {/* Price & Cart Actions */}
        <div className="pt-3 border-t border-[#F3EFE6] flex items-center justify-between gap-3">
          <div>
            <span className="block text-[11px] text-gray-400">قیمت هر بسته:</span>
            <span className="text-base font-black text-[#2C4A2E]">
              {formatToman(product.price)}
            </span>
          </div>

          {isComingSoon ? (
            <span className="flex items-center gap-1 px-3 py-2 rounded-xl bg-purple-50 text-purple-900 border border-purple-200 text-xs font-bold">
              <Clock className="w-3.5 h-3.5 text-purple-600" />
              <span>به زودی</span>
            </span>
          ) : isOutOfStock ? (
            <span className="flex items-center gap-1 px-3 py-2 rounded-xl bg-gray-100 text-gray-600 border border-gray-200 text-xs font-bold">
              <span>اتمام موجودی</span>
            </span>
          ) : quantity === 0 ? (
            <button
              onClick={() => addItem(product, 1)}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[#2C4A2E] text-white text-xs font-semibold hover:bg-[#1E3520] active:scale-95 transition-all shadow-xs cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4 text-[#D4A373]" />
              <span>افزودن بسته</span>
            </button>
          ) : (
            <div className="flex items-center gap-2 bg-[#F3EFE6] border border-[#E6E1D5] rounded-xl p-1">
              <button
                onClick={() => updateQuantity(product.id, quantity + 1)}
                disabled={quantity >= product.stock}
                className="w-7 h-7 rounded-lg bg-white flex items-center justify-center text-[#2C4A2E] hover:bg-[#2C4A2E] hover:text-white transition-colors cursor-pointer disabled:opacity-40"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              <span className="w-6 text-center text-xs font-black text-[#2C4A2E]">
                {toPersianDigits(quantity)}
              </span>
              <button
                onClick={() => updateQuantity(product.id, quantity - 1)}
                className="w-7 h-7 rounded-lg bg-white flex items-center justify-center text-[#2C4A2E] hover:bg-rose-600 hover:text-white transition-colors cursor-pointer"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
