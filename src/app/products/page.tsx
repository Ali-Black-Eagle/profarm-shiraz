'use client';

import React, { useState, useMemo, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { farmStore } from '@/lib/db-store';
import { INITIAL_PRODUCTS, INITIAL_CATEGORIES } from '@/lib/initial-data';
import { ProductCard } from '@/components/modules/ProductCard';
import { Search, Filter, Sparkles, Package, RotateCcw, ChevronLeft } from 'lucide-react';
import { toPersianDigits, safeJsonLdStringify } from '@/lib/formatters';
import { Product } from '@/types';
import {
  generateCategorySeoTitle,
  generateCategorySeoDescription,
  generateCategoryBreadcrumbJsonLd,
} from '@/lib/seo-utils';

function ProductsCatalogContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCatParam = searchParams.get('category');

  const [products, setProducts] = useState<Product[]>([...INITIAL_PRODUCTS]);
  const [categories, setCategories] = useState<string[]>([...INITIAL_CATEGORIES]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>(() => {
    return initialCatParam ? decodeURIComponent(initialCatParam) : 'همه محصولات';
  });
  const [organicOnly, setOrganicOnly] = useState(false);
  const [bulkOnly, setBulkOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'default' | 'price-asc' | 'price-desc' | 'available'>('default');

  // Sync category param if URL changes
  useEffect(() => {
    const cat = searchParams.get('category');
    if (cat) {
      setSelectedCategory(decodeURIComponent(cat));
    }
  }, [searchParams]);

  useEffect(() => {
    setProducts([...farmStore.getProducts()]);
    setCategories([...farmStore.getCategories()]);
  }, []);

  // Update document title and meta description dynamically for category SEO
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const seoTitle = generateCategorySeoTitle(selectedCategory);
      const seoDesc = generateCategorySeoDescription(selectedCategory);
      document.title = seoTitle;

      let metaDescEl = document.querySelector('meta[name="description"]');
      if (!metaDescEl) {
        metaDescEl = document.createElement('meta');
        metaDescEl.setAttribute('name', 'description');
        document.head.appendChild(metaDescEl);
      }
      metaDescEl.setAttribute('content', seoDesc);
    }
  }, [selectedCategory]);

  const handleSelectCategory = (cat: string) => {
    setSelectedCategory(cat);
    if (cat === 'همه محصولات') {
      router.replace('/products', { scroll: false });
    } else {
      router.replace(`/products?category=${encodeURIComponent(cat)}`, { scroll: false });
    }
  };

  const filteredProducts = useMemo(() => {
    const list = products.filter((p) => {
      const matchesCategory =
        selectedCategory === 'همه محصولات' || p.category === selectedCategory;
      const matchesSearch =
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesOrganic = !organicOnly || p.isOrganicCertified;
      const matchesBulk = !bulkOnly || p.isBulkEligible;

      return matchesCategory && matchesSearch && matchesOrganic && matchesBulk;
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
    handleSelectCategory('همه محصولات');
    setOrganicOnly(false);
    setBulkOnly(false);
    setSortBy('default');
  };

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://profarm-shiraz.ir';

  const itemListSchema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: generateCategorySeoTitle(selectedCategory),
    description: generateCategorySeoDescription(selectedCategory),
    numberOfItems: filteredProducts.length,
    itemListElement: filteredProducts.map((p, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: p.title,
      url: `${baseUrl}/products/${p.slug}`,
      image: p.images[0]?.startsWith('http') ? p.images[0] : `${baseUrl}${p.images[0]}`,
    })),
  };

  const breadcrumbSchema = generateCategoryBreadcrumbJsonLd(selectedCategory, baseUrl);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Google SEO JSON-LD Catalog & Breadcrumb Schemas */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(itemListSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(breadcrumbSchema) }}
      />

      {/* SEO Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-gray-500">
        <Link href="/" className="hover:text-farm-primary transition-colors">
          خانه
        </Link>
        <ChevronLeft className="w-3.5 h-3.5 text-gray-500" />
        <Link
          href="/products"
          onClick={() => handleSelectCategory('همه محصولات')}
          className={`hover:text-farm-primary transition-colors ${selectedCategory === 'همه محصولات' ? 'font-bold text-farm-primary' : ''}`}
        >
          محصولات
        </Link>
        {selectedCategory !== 'همه محصولات' && (
          <>
            <ChevronLeft className="w-3.5 h-3.5 text-gray-500" />
            <span className="font-bold text-farm-primary">{selectedCategory}</span>
          </>
        )}
      </nav>

      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-black text-farm-primary">
          {selectedCategory === 'همه محصولات'
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
            <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-farm-text-muted" />
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
            onChange={(e) => setSortBy(e.target.value as 'default' | 'price-asc' | 'price-desc' | 'available')}
            className="min-h-[44px] px-3.5 py-2 rounded-xl border border-farm-border bg-farm-bg focus:bg-white text-sm font-bold text-farm-text focus:outline-none focus:border-farm-primary cursor-pointer"
          >
            <option value="default">مرتب‌سازی: پیشنهاد مزرعه</option>
            <option value="price-asc">ارزان‌ترین</option>
            <option value="price-desc">گران‌ترین</option>
            <option value="available">کالاهای موجود اول</option>
          </select>

          {/* Quick Filter Checkboxes */}
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
              <Sparkles className="w-3.5 h-3.5 text-[#D4A373]" />
              <span>فقط دارای گواهی ارگانیک</span>
            </button>

            <button
              onClick={() => setBulkOnly(!bulkOnly)}
              className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                bulkOnly
                  ? 'bg-farm-primary text-white shadow-xs'
                  : 'bg-farm-bg text-gray-700 hover:bg-farm-bg-warm border border-farm-border'
              }`}
            >
              <Package className="w-3.5 h-3.5 text-[#D4A373]" />
              <span>واجد شرایط ارسال عمده</span>
            </button>

            {(searchQuery || selectedCategory !== 'همه محصولات' || organicOnly || bulkOnly) && (
              <button
                onClick={resetFilters}
                className="px-3 py-2 text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>حذف فیلترها</span>
              </button>
            )}
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none pt-2 border-t border-gray-100">
          {categories.map((cat) => (
            <button
              key={cat}
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
        <div className="text-xs text-gray-500 font-medium">
          نمایش {toPersianDigits(filteredProducts.length)} محصول ارگانیک در شیراز
        </div>

        {filteredProducts.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-farm-border space-y-3">
            <Filter className="w-10 h-10 text-gray-300 mx-auto" />
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

export default function ProductsPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-7xl mx-auto px-4 py-16 text-center text-sm text-gray-500">
          در حال بارگذاری کاتالوگ محصولات...
        </div>
      }
    >
      <ProductsCatalogContent />
    </Suspense>
  );
}
