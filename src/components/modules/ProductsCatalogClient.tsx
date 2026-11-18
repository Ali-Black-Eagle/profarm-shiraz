'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { ProductCard } from '@/components/modules/ProductCard';
import { Search, Filter, Sparkles, Package, RotateCcw, ChevronLeft } from 'lucide-react';
import { toPersianDigits, safeJsonLdStringify } from '@/lib/formatters';
import { matchesSearch } from '@/lib/public-api';
import type { Product } from '@/types';
import { generateCategorySeoDescription, generateCategoryBreadcrumbJsonLd } from '@/lib/seo-utils';

const ALL_CATEGORIES = 'همه محصولات';
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://profarm-shiraz.ir';

interface ProductsCatalogClientProps {
  products: Product[];
  /** Category names without the "all products" entry. */
  categories: string[];
}

type SortKey = 'default' | 'price-asc' | 'price-desc' | 'available';

export default function ProductsCatalogClient({ products, categories }: ProductsCatalogClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlCategory = searchParams.get('category')?.trim() || '';
  const urlSearch = searchParams.get('search')?.trim() || '';

  const [searchQuery, setSearchQuery] = useState(urlSearch);
  const [selectedCategory, setSelectedCategory] = useState<string>(urlCategory || ALL_CATEGORIES);
  const [organicOnly, setOrganicOnly] = useState(false);
  const [bulkOnly, setBulkOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>('default');

  // The URL is the source of truth for category and search: follow it on every change.
  // Removing the category parameter resets the category to "all".
  useEffect(() => {
    setSelectedCategory(urlCategory || ALL_CATEGORIES);
  }, [urlCategory]);

  useEffect(() => {
    setSearchQuery(urlSearch);
  }, [urlSearch]);

  const categoryTabs = useMemo(
    () => [ALL_CATEGORIES, ...categories.filter((c) => c && c !== ALL_CATEGORIES)],
    [categories]
  );

  const handleSelectCategory = (cat: string) => {
    setSelectedCategory(cat);
    if (cat === ALL_CATEGORIES) {
      router.replace('/products', { scroll: false });
    } else {
      router.replace(`/products?category=${encodeURIComponent(cat)}`, { scroll: false });
    }
  };

  const filteredProducts = useMemo(() => {
    const list = products.filter((p) => {
      const matchesCategory = selectedCategory === ALL_CATEGORIES || p.category === selectedCategory;
      // Ignores case, ي/ك vs ی/ک, digit forms and spacing inside words (see lib/public-api)
      const matchesText = matchesSearch([p.title, p.description, p.category], searchQuery);
      const matchesOrganic = !organicOnly || p.isOrganicCertified;
      const matchesBulk = !bulkOnly || p.isBulkEligible;
      return matchesCategory && matchesText && matchesOrganic && matchesBulk;
    });

    if (sortBy === 'price-asc') {
      return [...list].sort((a, b) => a.price - b.price);
    }
    if (sortBy === 'price-desc') {
      return [...list].sort((a, b) => b.price - a.price);
    }
    if (sortBy === 'available') {
      return [...list].sort((a, b) => (b.stock > 0 ? 1 : 0) - (a.stock > 0 ? 1 : 0));
    }
    return list;
  }, [products, searchQuery, selectedCategory, organicOnly, bulkOnly, sortBy]);

  const resetFilters = () => {
    setSearchQuery('');
    setOrganicOnly(false);
    setBulkOnly(false);
    setSortBy('default');
    handleSelectCategory(ALL_CATEGORIES);
  };

  const hasActiveFilters =
    searchQuery.trim() !== '' || selectedCategory !== ALL_CATEGORIES || organicOnly || bulkOnly;

  const itemListSchema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: selectedCategory === ALL_CATEGORIES ? 'کاتالوگ محصولات پروفارم شیراز' : selectedCategory,
    description: generateCategorySeoDescription(selectedCategory),
    numberOfItems: filteredProducts.length,
    itemListElement: filteredProducts.slice(0, 50).map((p, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: p.title,
      url: `${BASE_URL}/products/${p.slug}`,
      ...(p.images[0]
        ? { image: p.images[0].startsWith('http') ? p.images[0] : `${BASE_URL}${p.images[0]}` }
        : {}),
    })),
  };

  const breadcrumbSchema = generateCategoryBreadcrumbJsonLd(selectedCategory, BASE_URL);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(itemListSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(breadcrumbSchema) }}
      />

      {/* Breadcrumbs */}
      <nav aria-label="مسیر صفحه" className="flex items-center gap-1.5 text-xs text-gray-500">
        <Link href="/" className="hover:text-farm-primary transition-colors">
          خانه
        </Link>
        <ChevronLeft className="w-3.5 h-3.5 text-gray-500" aria-hidden="true" />
        <Link
          href="/products"
          onClick={() => handleSelectCategory(ALL_CATEGORIES)}
          className={`hover:text-farm-primary transition-colors ${selectedCategory === ALL_CATEGORIES ? 'font-bold text-farm-primary' : ''}`}
        >
          محصولات
        </Link>
        {selectedCategory !== ALL_CATEGORIES && (
          <>
            <ChevronLeft className="w-3.5 h-3.5 text-gray-500" aria-hidden="true" />
            <span className="font-bold text-farm-primary">{selectedCategory}</span>
          </>
        )}
      </nav>

      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-black text-farm-primary">
          {selectedCategory === ALL_CATEGORIES
            ? 'کاتالوگ فرآورده‌های ارگانیک و بومی شیراز'
            : `خرید اینترنتی ${selectedCategory} ارگانیک مزارع فارس`}
        </h1>
        <p className="text-xs sm:text-sm text-gray-600 leading-relaxed max-w-3xl">
          {generateCategorySeoDescription(selectedCategory)}
        </p>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-5 rounded-3xl border border-farm-border shadow-farm space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-farm-text-muted" aria-hidden="true" />
            <input
              type="search"
              aria-label="جستجوی محصول"
              placeholder="جستجوی محصول (مانند: تخم‌مرغ کامفیروز، عسل دشت ارژن، پنیر، سبزی...)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full min-h-[44px] pr-10 pl-4 py-2.5 rounded-xl border border-farm-border bg-farm-bg focus:bg-white focus:outline-none focus:border-farm-primary text-base sm:text-sm"
            />
          </div>

          {/* Sort Dropdown */}
          <select
            aria-label="مرتب‌سازی محصولات"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="min-h-[44px] px-3.5 py-2 rounded-xl border border-farm-border bg-farm-bg focus:bg-white text-sm font-bold text-farm-text focus:outline-none focus:border-farm-primary cursor-pointer"
          >
            <option value="default">مرتب‌سازی: پیشنهاد مزرعه</option>
            <option value="price-asc">ارزان‌ترین</option>
            <option value="price-desc">گران‌ترین</option>
            <option value="available">کالاهای موجود اول</option>
          </select>

          {/* Quick Filter Toggles */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setOrganicOnly(!organicOnly)}
              aria-pressed={organicOnly}
              className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                organicOnly
                  ? 'bg-farm-primary text-white shadow-xs'
                  : 'bg-farm-bg text-gray-800 hover:bg-farm-bg-warm border border-farm-border'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-[#D4A373]" aria-hidden="true" />
              <span>فقط دارای گواهی ارگانیک</span>
            </button>

            <button
              type="button"
              onClick={() => setBulkOnly(!bulkOnly)}
              aria-pressed={bulkOnly}
              className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                bulkOnly
                  ? 'bg-farm-primary text-white shadow-xs'
                  : 'bg-farm-bg text-gray-700 hover:bg-farm-bg-warm border border-farm-border'
              }`}
            >
              <Package className="w-3.5 h-3.5 text-[#D4A373]" aria-hidden="true" />
              <span>واجد شرایط ارسال عمده</span>
            </button>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="min-h-[44px] px-3 py-2 text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>حذف فیلترها</span>
              </button>
            )}
          </div>
        </div>

        {/* Category Pills */}
        <div
          role="group"
          aria-label="دسته‌بندی محصولات"
          className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none pt-2 border-t border-gray-100"
        >
          {categoryTabs.map((cat) => (
            <button
              key={cat}
              type="button"
              aria-pressed={selectedCategory === cat}
              onClick={() => handleSelectCategory(cat)}
              className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-farm-primary text-white shadow-xs'
                  : 'bg-farm-bg text-gray-600 hover:bg-farm-bg-warm'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Results Count & Grid */}
      <div className="space-y-4">
        <div className="text-xs text-gray-500 font-medium" aria-live="polite">
          نمایش {toPersianDigits(filteredProducts.length)} محصول ارگانیک در شیراز
        </div>

        {filteredProducts.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-farm-border space-y-3">
            <Filter className="w-10 h-10 text-gray-300 mx-auto" aria-hidden="true" />
            <h3 className="font-bold text-gray-700">هیچ محصولی با این فیلترها یافت نشد</h3>
            <p className="text-xs text-gray-500">
              لطفاً عنوان جستجو را تغییر دهید یا فیلترهای اعمال شده را ریست نمایید.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
