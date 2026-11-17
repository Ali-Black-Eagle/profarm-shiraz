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
    return products.filter((p) => {
      const matchesCategory =
        selectedCategory === 'همه محصولات' || p.category === selectedCategory;
      const matchesSearch =
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesOrganic = !organicOnly || p.isOrganicCertified;
      const matchesBulk = !bulkOnly || p.isBulkEligible;

      return matchesCategory && matchesSearch && matchesOrganic && matchesBulk;
    });
  }, [products, searchQuery, selectedCategory, organicOnly, bulkOnly]);

  const resetFilters = () => {
    setSearchQuery('');
    handleSelectCategory('همه محصولات');
    setOrganicOnly(false);
    setBulkOnly(false);
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
        <Link href="/" className="hover:text-[#2C4A2E] transition-colors">
          خانه
        </Link>
        <ChevronLeft className="w-3.5 h-3.5 text-gray-400" />
        <Link
          href="/products"
          onClick={() => handleSelectCategory('همه محصولات')}
          className={`hover:text-[#2C4A2E] transition-colors ${selectedCategory === 'همه محصولات' ? 'font-bold text-[#2C4A2E]' : ''}`}
        >
          محصولات
        </Link>
        {selectedCategory !== 'همه محصولات' && (
          <>
            <ChevronLeft className="w-3.5 h-3.5 text-gray-400" />
            <span className="font-bold text-[#2C4A2E]">{selectedCategory}</span>
          </>
        )}
      </nav>

      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-black text-[#2C4A2E]">
          {selectedCategory === 'همه محصولات'
            ? 'کاتالوگ فرآورده‌های ارگانیک و بومی شیراز'
            : `خرید اینترنتی ${selectedCategory} ارگانیک مزارع فارس`}
        </h1>
        <p className="text-xs sm:text-sm text-gray-600 leading-relaxed max-w-3xl">
          {generateCategorySeoDescription(selectedCategory)}
        </p>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-5 rounded-3xl border border-[#E6E1D5] shadow-farm space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="جستجوی محصول (مانند: تخم‌مرغ کامفیروز، عسل دشت ارژن، پنیر، سبزی...)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-[#E6E1D5] bg-[#F9F8F5] focus:bg-white focus:outline-none focus:border-[#2C4A2E] text-xs"
            />
          </div>

          {/* Quick Filter Checkboxes */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setOrganicOnly(!organicOnly)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                organicOnly
                  ? 'bg-[#2C4A2E] text-white shadow-xs'
                  : 'bg-[#F9F8F5] text-gray-700 hover:bg-[#F3EFE6] border border-[#E6E1D5]'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-[#D4A373]" />
              <span>فقط دارای گواهی ارگانیک</span>
            </button>

            <button
              onClick={() => setBulkOnly(!bulkOnly)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                bulkOnly
                  ? 'bg-[#2C4A2E] text-white shadow-xs'
                  : 'bg-[#F9F8F5] text-gray-700 hover:bg-[#F3EFE6] border border-[#E6E1D5]'
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
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-[#2C4A2E] text-white shadow-xs'
                  : 'bg-[#F9F8F5] text-gray-600 hover:bg-[#F3EFE6]'
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
          <div className="bg-white rounded-3xl p-12 text-center border border-[#E6E1D5] space-y-3">
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
