'use client';

import React, { useState, useEffect, useRef } from 'react';
import { farmStore } from '@/lib/db-store';
import { Product, ProductStatus, ProductSpecification, ProductFaq } from '@/types';
import { formatToman, toPersianDigits } from '@/lib/formatters';
import { INITIAL_CATEGORIES } from '@/lib/initial-data';
import {
  Package,
  Plus,
  Save,
  CheckCircle2,
  Edit,
  X,
  Sparkles,
  Layers,
  Scale,
  Maximize2,
  Trash2,
  Copy,
  UploadCloud,
  Image as ImageIcon,
  Star,
  Link as LinkIcon,
  Clock,
  AlertCircle,
  CheckCircle,
  FolderTree,
  Tag,
  RotateCcw,
  Sliders,
  HelpCircle,
  FileText,
  Flame,
  Globe,
  Search,
  ExternalLink,
} from 'lucide-react';
import {
  generateSeoSlug,
  generateProductSeoTitle,
  generateProductSeoDescription,
  generateProductSeoKeywords,
} from '@/lib/seo-utils';

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Status Filter State
  const [statusFilter, setStatusFilter] = useState<'ALL' | ProductStatus>('ALL');

  // Modal State for Add / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form fields
  const [title, setTitle] = useState('');
  const [packSize, setPackSize] = useState('');
  const [category, setCategory] = useState(INITIAL_CATEGORIES[1]);
  const [price, setPrice] = useState<number>(150000);
  const [costPrice, setCostPrice] = useState<number | ''>('');
  const [stock, setStock] = useState<number>(20);
  const [status, setStatus] = useState<ProductStatus>('AVAILABLE');
  const [weightKg, setWeightKg] = useState<number | ''>('');
  const [dimensions, setDimensions] = useState('');
  const [description, setDescription] = useState('');

  // Modern Specifications, Highlights, Storage, Nutrition & FAQs
  const [specifications, setSpecifications] = useState<ProductSpecification[]>([]);
  const [highlightsText, setHighlightsText] = useState('');
  const [storageInstructions, setStorageInstructions] = useState('');
  const [originLocation, setOriginLocation] = useState('');
  const [shelfLife, setShelfLife] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [fat, setFat] = useState('');
  const [carbs, setCarbs] = useState('');
  const [faqs, setFaqs] = useState<ProductFaq[]>([]);
  
  // Multi-image state
  const [images, setImages] = useState<string[]>([]);
  const [urlInput, setUrlInput] = useState('');
  const [isOrganicCertified, setIsOrganicCertified] = useState(true);
  const [isBulkEligible, setIsBulkEligible] = useState(true);
  const [minBulkQuantity, setMinBulkQuantity] = useState<number>(8);

  // SEO & URL Slug state
  const [slug, setSlug] = useState('');
  const [isSlugCustomized, setIsSlugCustomized] = useState(false);
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [seoKeywordsText, setSeoKeywordsText] = useState('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const sampleImages = [
    { label: 'تخم‌مرغ محلی', url: '/images/prod-eggs.jpg' },
    { label: 'عسل کوهستان', url: '/images/prod-honey.jpg' },
    { label: 'سبزی خوردن', url: '/images/prod-greens.jpg' },
    { label: 'پنیر کوزه خمره‌ای', url: '/images/prod-cheese.jpg' },
    { label: 'شیره انگور بوانات', url: '/images/prod-grape-syrup.jpg' },
    { label: 'جعبه سبزیجات', url: '/images/prod-veggie-box.jpg' },
    { label: 'عرقیات میمند', url: '/images/prod-distillates.jpg' },
    { label: 'گردوی سپیدان', url: '/images/prod-walnut.jpg' },
    { label: 'زعفران استهبان', url: '/images/prod-saffron.jpg' },
    { label: 'روغن زیتون سروستان', url: '/images/prod-olive-oil.jpg' },
  ];

  const refreshProducts = () => {
    setProducts([...farmStore.getProducts()]);
    setCategories([...farmStore.getCategories()]);
  };

  useEffect(() => {
    refreshProducts();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleAddCategory = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newCategoryInput.trim()) return;
    const res = farmStore.addCategory(newCategoryInput);
    if (res.success) {
      setCategories([...res.categories]);
      setCategory(newCategoryInput.trim());
      setNewCategoryInput('');
      showToast(res.message);
    } else {
      alert(res.message);
    }
  };

  const handleDeleteCategory = (catName: string) => {
    const productsInCat = products.filter((p) => p.category === catName).length;
    if (productsInCat > 0) {
      if (
        !confirm(
          `توجه: ${toPersianDigits(productsInCat)} محصول در این دسته‌بندی تعریف شده است. آیا از حذف دسته‌بندی «${catName}» اطمینان دارید؟`
        )
      ) {
        return;
      }
    } else {
      if (!confirm(`آیا از حذف دسته‌بندی «${catName}» اطمینان دارید؟`)) return;
    }
    const res = farmStore.deleteCategory(catName);
    setCategories([...res.categories]);
    showToast(res.message);
  };

  const handleResetCategories = () => {
    if (confirm('آیا از بازنشانی دسته‌بندی‌ها به مقادیر اولیه اطمینان دارید؟')) {
      const defs = farmStore.resetCategories();
      setCategories([...defs]);
      showToast('دسته‌بندی‌ها به حالت پیش‌فرض بازنشانی شدند.');
    }
  };

  const handleOpenAddModal = () => {
    setIsEditing(false);
    setEditingId(null);
    setTitle('');
    setPackSize('');
    const availableCats = farmStore.getCategories().filter((c) => c !== 'همه محصولات');
    setCategory(availableCats[0] || INITIAL_CATEGORIES[1]);
    setPrice(180000);
    setCostPrice('');
    setStock(25);
    setStatus('AVAILABLE');
    setWeightKg('');
    setDimensions('');
    setDescription('');
    setImages([sampleImages[0].url]);
    setUrlInput('');
    setIsOrganicCertified(true);
    setIsBulkEligible(true);
    setMinBulkQuantity(8);

    // Modern dynamic fields
    setSpecifications([
      { key: 'محل تولید و مرتع', value: 'مزارع شیراز، استان فارس' },
      { key: 'ماندگاری در یخچال', value: '۳۰ روز' },
      { key: 'نوع بسته‌بندی', value: 'بسته‌بندی بهداشتی دوستدار محیط‌زیست' },
    ]);
    setHighlightsText('۱۰۰٪ طبیعی و ارگانیک مزارع فارس\nبرداشت روزانه و ارسال با پیک اختصاصی شیراز\nفاقد مواد نگهدارنده شیمیایی');
    setStorageInstructions('در دمای ۲ تا ۶ درجه سانتی‌گراد در یخچال نگهداری شود.');
    setOriginLocation('شیراز، استان فارس');
    setShelfLife('۳۰ روز');
    setCalories('');
    setProtein('');
    setFat('');
    setCarbs('');
    setFaqs([
      {
        question: 'نحوه ارسال این محصول در شیراز چگونه است؟',
        answer: 'ارسال با ناوگان مجهز به زنجیره سرد پیک پروفارم در بازه انتخابی شما درب منزل انجام می‌شود.',
      },
    ]);

    // SEO fields
    setSlug('');
    setIsSlugCustomized(false);
    setSeoTitle('');
    setSeoDescription('');
    setSeoKeywordsText('');

    setIsModalOpen(true);
  };

  const handleOpenEditModal = (prod: Product) => {
    setIsEditing(true);
    setEditingId(prod.id);
    setTitle(prod.title || '');
    setPackSize(prod.packSize || '');
    setCategory(prod.category);
    setPrice(prod.price);
    setCostPrice(prod.costPrice ?? '');
    setStock(prod.stock);
    setStatus(prod.status || (prod.stock > 0 ? 'AVAILABLE' : 'OUT_OF_STOCK'));
    setWeightKg(prod.weightKg !== undefined && prod.weightKg !== null && Number(prod.weightKg) > 0 ? prod.weightKg : '');
    setDimensions(prod.dimensions || '');
    setDescription(prod.description || '');
    setImages(prod.images && prod.images.length > 0 ? [...prod.images] : [sampleImages[0].url]);
    setUrlInput('');
    setIsOrganicCertified(prod.isOrganicCertified);
    setIsBulkEligible(prod.isBulkEligible);
    setMinBulkQuantity(prod.minBulkQuantity || 5);

    // Modern dynamic fields
    setSpecifications(prod.specifications && prod.specifications.length > 0 ? prod.specifications.map((s) => ({ ...s })) : []);
    setHighlightsText(prod.highlights ? prod.highlights.join('\n') : '');
    setStorageInstructions(prod.storageInstructions || '');
    setOriginLocation(prod.originLocation || '');
    setShelfLife(prod.shelfLife || '');
    setCalories(prod.nutritionalInfo?.calories || '');
    setProtein(prod.nutritionalInfo?.protein || '');
    setFat(prod.nutritionalInfo?.fat || '');
    setCarbs(prod.nutritionalInfo?.carbs || '');
    setFaqs(prod.faqs && prod.faqs.length > 0 ? prod.faqs.map((f) => ({ ...f })) : []);

    // SEO fields
    setSlug(prod.slug || '');
    setIsSlugCustomized(true);
    setSeoTitle(prod.seoTitle || '');
    setSeoDescription(prod.seoDescription || '');
    setSeoKeywordsText(prod.seoKeywords ? prod.seoKeywords.join('، ') : '');

    setIsModalOpen(true);
  };

  const handleAutoGenerateSeo = () => {
    if (!title.trim()) {
      alert('لطفاً ابتدا عنوان محصول را در بالای فرم بنویسید.');
      return;
    }
    const autoSlug = generateSeoSlug(title, products.map((p) => p.slug));
    setSlug(autoSlug);
    setIsSlugCustomized(true);
    setSeoTitle(generateProductSeoTitle({ title, category, originLocation }));
    setSeoDescription(generateProductSeoDescription({ title, category, description, originLocation }));
    setSeoKeywordsText(generateProductSeoKeywords({ title, category, originLocation }).join('، '));
    showToast('اطلاعات سئو و آدرس یکتای کالا به صورت خودکار با موفقیت تنظیم شدند.');
  };

  // Dynamic specifications handlers
  const handleAddSpecificationRow = (presetKey = '', presetValue = '') => {
    setSpecifications((prev) => [...prev, { key: presetKey, value: presetValue }]);
  };

  const handleUpdateSpecification = (index: number, field: 'key' | 'value', value: string) => {
    setSpecifications((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleRemoveSpecification = (index: number) => {
    setSpecifications((prev) => prev.filter((_, idx) => idx !== index));
  };

  // FAQ handlers
  const handleAddFaqRow = () => {
    setFaqs((prev) => [...prev, { question: '', answer: '' }]);
  };

  const handleUpdateFaq = (index: number, field: 'question' | 'answer', value: string) => {
    setFaqs((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleRemoveFaq = (index: number) => {
    setFaqs((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Quick Status Switcher directly from Table
  const handleQuickStatusChange = (prodId: string, newStatus: ProductStatus) => {
    farmStore.updateProduct(prodId, { status: newStatus });
    refreshProducts();
    const label = newStatus === 'AVAILABLE' ? 'موجود' : newStatus === 'OUT_OF_STOCK' ? 'ناموجود' : 'به زودی';
    showToast(`وضعیت محصول به «${label}» تغییر یافت.`);
  };

  // Upload local images from device
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setImages((prev) => [...prev, event.target!.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });

    // Reset input so re-uploading same file works
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Add image via URL
  const handleAddImageUrl = () => {
    if (!urlInput.trim()) return;
    setImages((prev) => [...prev, urlInput.trim()]);
    setUrlInput('');
  };

  // Remove image
  const handleRemoveImage = (indexToRemove: number) => {
    setImages((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  // Set as primary/main image
  const handleSetPrimaryImage = (index: number) => {
    if (index === 0) return;
    setImages((prev) => {
      const copy = [...prev];
      const selected = copy.splice(index, 1)[0];
      copy.unshift(selected);
      return copy;
    });
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      alert('لطفاً عنوان محصول را وارد کنید.');
      return;
    }

    const finalImages = images.length > 0 ? images : [sampleImages[0].url];

    const parsedWeight =
      weightKg !== '' && !isNaN(Number(weightKg)) && Number(weightKg) > 0
        ? Number(weightKg)
        : null;

    const parsedDimensions = dimensions.trim() || undefined;
    const parsedPackSize = packSize.trim() || undefined;
    const parsedDescription = description.trim() || '';
    const parsedCostPrice = costPrice !== '' && Number(costPrice) > 0 ? Number(costPrice) : undefined;

    const parsedHighlights = highlightsText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const validSpecs = specifications.filter((s) => s.key.trim() && s.value.trim());
    const validFaqs = faqs.filter((f) => f.question.trim() && f.answer.trim());
    const nutritionalInfo =
      calories.trim() || protein.trim() || fat.trim() || carbs.trim()
        ? {
            calories: calories.trim() || undefined,
            protein: protein.trim() || undefined,
            fat: fat.trim() || undefined,
            carbs: carbs.trim() || undefined,
          }
        : undefined;

    const extraFields = {
      specifications: validSpecs,
      highlights: parsedHighlights,
      storageInstructions: storageInstructions.trim() || undefined,
      originLocation: originLocation.trim() || undefined,
      shelfLife: shelfLife.trim() || undefined,
      nutritionalInfo,
      faqs: validFaqs,
    };

    const parsedKeywords = seoKeywordsText
      .split(/[،,]/)
      .map((k) => k.trim())
      .filter((k) => k.length > 0);

    const seoPayload = {
      slug: slug.trim() || undefined,
      seoTitle: seoTitle.trim() || undefined,
      seoDescription: seoDescription.trim() || undefined,
      seoKeywords: parsedKeywords.length > 0 ? parsedKeywords : undefined,
    };

    if (isEditing && editingId) {
      farmStore.updateProduct(editingId, {
        title,
        packSize: parsedPackSize,
        category,
        price,
        costPrice: parsedCostPrice,
        stock,
        status,
        weightKg: parsedWeight,
        dimensions: parsedDimensions,
        description: parsedDescription,
        images: finalImages,
        isOrganicCertified,
        isBulkEligible,
        minBulkQuantity,
        ...extraFields,
        ...seoPayload,
      });
      showToast(`محصول «${title}» با موفقیت به‌روزرسانی شد.`);
    } else {
      farmStore.addProduct({
        title,
        packSize: parsedPackSize,
        category,
        price,
        costPrice: parsedCostPrice,
        stock,
        status,
        weightKg: parsedWeight,
        dimensions: parsedDimensions,
        description: parsedDescription,
        images: finalImages,
        isOrganicCertified,
        isBulkEligible,
        minBulkQuantity,
        ...extraFields,
        ...seoPayload,
      });
      showToast(`محصول ارگانیک جدید «${title}» با موفقیت و رعایت کامل اصول سئو به کاتالوگ انبار اضافه شد.`);
    }

    setIsModalOpen(false);
  };

  const handleClone = (prod: Product) => {
    const cloned = farmStore.cloneProduct(prod.slug);
    if (cloned) {
      refreshProducts();
      showToast(`نسخه رونوشت از «${prod.title}» ساخته شد.`);
    }
  };

  return (
    <div className="space-y-7">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#E6E1D5]">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#2C4A2E] tracking-tight">
            مدیریت محصولات و کنترل موجودی انبار شیراز
          </h1>
          <p className="text-sm text-gray-500 mt-1 leading-relaxed">
            تعریف کالای جدید، آپلود چندگانه تصاویر کالا، ویرایش مشخصات بسته‌بندی، قیمت و موجودی لحظه‌ای
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setIsCategoryModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-white border border-[#E6E1D5] hover:bg-[#F3EFE6] text-[#2C4A2E] text-xs sm:text-sm font-bold shadow-xs transition-all cursor-pointer shrink-0"
          >
            <FolderTree className="w-4 h-4 text-[#D4A373]" />
            <span>مدیریت دسته‌بندی‌ها ({toPersianDigits(categories.filter((c) => c !== 'همه محصولات').length)})</span>
          </button>

          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-[#2C4A2E] text-white text-xs sm:text-sm font-bold shadow-md hover:bg-[#1E3520] transition-all cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4 text-[#D4A373]" />
            <span>افزودن محصول جدید به انبار</span>
          </button>
        </div>
      </div>

      {toastMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-sm font-bold text-emerald-900 flex items-center gap-2.5 animate-in fade-in shadow-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Status Filters Bar */}
      <div className="flex flex-wrap items-center gap-2.5 pb-1">
        <span className="text-xs font-bold text-gray-500 ml-1">فیلتر بر اساس وضعیت:</span>
        <button
          onClick={() => setStatusFilter('ALL')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            statusFilter === 'ALL'
              ? 'bg-[#2C4A2E] text-white shadow-sm'
              : 'bg-white text-gray-700 hover:bg-gray-100 border border-[#E6E1D5]'
          }`}
        >
          همه محصولات ({toPersianDigits(products.length)})
        </button>

        <button
          onClick={() => setStatusFilter('AVAILABLE')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            statusFilter === 'AVAILABLE'
              ? 'bg-emerald-700 text-white shadow-sm'
              : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
          }`}
        >
          <CheckCircle className="w-3.5 h-3.5" />
          <span>
            موجود ({toPersianDigits(products.filter((p) => (p.status || (p.stock > 0 ? 'AVAILABLE' : 'OUT_OF_STOCK')) === 'AVAILABLE').length)})
          </span>
        </button>

        <button
          onClick={() => setStatusFilter('OUT_OF_STOCK')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            statusFilter === 'OUT_OF_STOCK'
              ? 'bg-rose-700 text-white shadow-sm'
              : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200'
          }`}
        >
          <AlertCircle className="w-3.5 h-3.5" />
          <span>
            ناموجود ({toPersianDigits(products.filter((p) => (p.status || (p.stock > 0 ? 'AVAILABLE' : 'OUT_OF_STOCK')) === 'OUT_OF_STOCK').length)})
          </span>
        </button>

        <button
          onClick={() => setStatusFilter('COMING_SOON')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            statusFilter === 'COMING_SOON'
              ? 'bg-purple-700 text-white shadow-sm'
              : 'bg-purple-50 text-purple-800 hover:bg-purple-100 border border-purple-200'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>
            به زودی ({toPersianDigits(products.filter((p) => p.status === 'COMING_SOON').length)})
          </span>
        </button>
      </div>

      {/* Mobile Products Cards (Mobile only, zero horizontal scrolling) */}
      <div className="md:hidden flex flex-col gap-3.5">
        {products
          .filter((p) => {
            if (statusFilter === 'ALL') return true;
            const currentStatus = p.status || (p.stock > 0 ? 'AVAILABLE' : 'OUT_OF_STOCK');
            return currentStatus === statusFilter;
          })
          .map((prod) => {
            const currentStatus: ProductStatus = prod.status || (prod.stock > 0 ? 'AVAILABLE' : 'OUT_OF_STOCK');
            return (
              <div
                key={prod.id}
                className="bg-white rounded-2xl border border-[#E6E1D5] p-4 shadow-xs space-y-3"
              >
                {/* Header: Thumbnail + Title + Category */}
                <div className="flex items-center gap-3">
                  <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-[#E6E1D5] shrink-0 bg-gray-100">
                    <img
                      src={prod.images[0]}
                      alt={prod.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-gray-900 text-sm truncate">{prod.title}</div>
                    <div className="text-xs text-[#D4A373] font-semibold mt-0.5">{prod.packSize}</div>
                    <div className="text-[11px] text-gray-500">{prod.category}</div>
                  </div>
                </div>

                {/* Pricing & Stock Details */}
                <div className="grid grid-cols-2 gap-2 bg-[#F9F8F5] p-2.5 rounded-xl text-xs">
                  <div>
                    <span className="text-gray-500 block text-[11px]">قیمت فروش:</span>
                    <span className="font-black text-[#2C4A2E]">{formatToman(prod.price)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[11px]">موجودی انبار:</span>
                    <span className={`font-bold ${prod.stock < 10 ? 'text-rose-600' : 'text-emerald-700'}`}>
                      {toPersianDigits(prod.stock)} بسته
                    </span>
                  </div>
                </div>

                {/* Status Switcher & Action Buttons */}
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#F3EFE6]">
                  <select
                    value={currentStatus}
                    onChange={(e) => handleQuickStatusChange(prod.id, e.target.value as ProductStatus)}
                    className="flex-1 px-2.5 py-1.5 rounded-xl border border-[#E6E1D5] bg-[#F9F8F5] text-xs font-bold text-[#2C4A2E]"
                  >
                    <option value="AVAILABLE">موجود و فعال</option>
                    <option value="OUT_OF_STOCK">ناموجود در مزرعه</option>
                    <option value="DISCONTINUED">توقف تولید</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => handleOpenEditModal(prod)}
                    className="p-2 rounded-xl bg-gray-100 hover:bg-[#2C4A2E] hover:text-white text-gray-700 transition-colors"
                    title="ویرایش"
                  >
                    <Edit className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleClone(prod)}
                    className="p-2 rounded-xl bg-gray-100 hover:bg-[#2C4A2E] hover:text-white text-gray-700 transition-colors"
                    title="تکثیر"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
      </div>

      {/* Desktop Products Table */}
      <div className="hidden md:block bg-white rounded-3xl border border-[#E6E1D5] shadow-farm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-[#F9F8F5] border-b border-[#E6E1D5] text-[#2C4A2E]">
              <tr>
                <th className="py-4 px-5 font-black">تصویر و پکیج کالا</th>
                <th className="py-4 px-5 font-black">دسته‌بندی</th>
                <th className="py-4 px-5 font-black">قیمت فروش</th>
                <th className="py-4 px-5 font-black">بهای خرید / سود</th>
                <th className="py-4 px-5 font-black">وضعیت عرضه</th>
                <th className="py-4 px-5 font-black">موجودی انبار</th>
                <th className="py-4 px-5 font-black">وزن بسته</th>
                <th className="py-4 px-5 font-black">گواهی ارگانیک</th>
                <th className="py-4 px-5 font-black">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6E1D5]">
              {products
                .filter((p) => {
                  if (statusFilter === 'ALL') return true;
                  const currentStatus = p.status || (p.stock > 0 ? 'AVAILABLE' : 'OUT_OF_STOCK');
                  return currentStatus === statusFilter;
                })
                .map((prod) => {
                  const currentStatus: ProductStatus = prod.status || (prod.stock > 0 ? 'AVAILABLE' : 'OUT_OF_STOCK');
                  return (
                    <tr key={prod.id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3.5">
                          <div className="relative w-14 h-14 rounded-2xl overflow-hidden border border-[#E6E1D5] shrink-0 bg-gray-100 shadow-xs">
                            <img
                              src={prod.images[0]}
                              alt={prod.title}
                              className="w-full h-full object-cover"
                            />
                            {prod.images.length > 1 && (
                              <span className="absolute bottom-0.5 right-0.5 bg-black/75 text-white text-[9px] font-bold px-1 rounded-sm">
                                +{toPersianDigits(prod.images.length - 1)}
                              </span>
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-gray-900 leading-snug">{prod.title}</div>
                            <div className="text-xs text-[#D4A373] font-semibold mt-0.5">
                              {prod.packSize}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-5 text-gray-600 font-medium">{prod.category}</td>

                      <td className="py-4 px-5 font-black text-[#2C4A2E]">
                        {formatToman(prod.price)}
                      </td>

                      <td className="py-4 px-5">
                        {prod.costPrice ? (
                          <div>
                            <div className="font-bold text-gray-700 text-xs">{formatToman(prod.costPrice)}</div>
                            <div className="text-[11px] font-semibold text-emerald-700">
                              سود: {toPersianDigits(Math.max(0, Math.round(((prod.price - prod.costPrice) / prod.price) * 100)))}٪
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-[11px]">ثبت‌نشده</span>
                        )}
                      </td>

                      {/* Status Column with interactive quick-switch */}
                      <td className="py-4 px-5">
                        <div className="inline-flex items-center gap-1.5">
                          <select
                            value={currentStatus}
                            onChange={(e) => handleQuickStatusChange(prod.id, e.target.value as ProductStatus)}
                            className={`text-xs font-bold px-2.5 py-1 rounded-xl border appearance-none cursor-pointer focus:outline-none transition-colors ${
                              currentStatus === 'AVAILABLE'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                                : currentStatus === 'OUT_OF_STOCK'
                                ? 'bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100'
                                : 'bg-purple-50 text-purple-800 border-purple-300 hover:bg-purple-100'
                            }`}
                            title="برای تغییر وضعیت کالا کلیک کنید"
                          >
                            <option value="AVAILABLE">✓ موجود</option>
                            <option value="OUT_OF_STOCK">✕ ناموجود</option>
                            <option value="COMING_SOON">⌛ به زودی</option>
                          </select>
                        </div>
                      </td>

                      <td className="py-4 px-5">
                        <span
                          className={`inline-block px-3 py-1 rounded-xl text-xs font-bold ${
                            prod.stock <= 5
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {toPersianDigits(prod.stock)} بسته
                        </span>
                      </td>

                      <td className="py-4 px-5 text-gray-600">
                        {prod.weightKg && Number(prod.weightKg) > 0 ? (
                          `${toPersianDigits(prod.weightKg)} کیلوگرم`
                        ) : (
                          <span className="text-gray-400 text-[11px]">ثبت‌نشده (بدون نمایش)</span>
                        )}
                      </td>

                      <td className="py-4 px-5">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold border ${
                            prod.isOrganicCertified
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              : 'bg-gray-100 text-gray-500 border-gray-300'
                          }`}
                        >
                          {prod.isOrganicCertified ? '✓ ارگانیک' : 'عادی'}
                        </span>
                      </td>

                      <td className="py-4 px-5">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleOpenEditModal(prod)}
                        className="px-3.5 py-2 rounded-xl bg-gray-100 hover:bg-[#2C4A2E] hover:text-white text-gray-800 font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        <span>ویرایش</span>
                      </button>

                      <button
                        onClick={() => handleClone(prod)}
                        className="p-2 rounded-xl text-gray-400 hover:text-[#2C4A2E] hover:bg-gray-100 transition-colors cursor-pointer"
                        title="تکثیر و کپی از محصول"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Advanced Product Modal with Image Upload & Multi-image Gallery */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 sm:p-8 border border-[#E6E1D5] shadow-2xl space-y-6 animate-in fade-in zoom-in-95 my-8 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-[#F3EFE6]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#2C4A2E]/10 flex items-center justify-center text-[#2C4A2E]">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-[#2C4A2E]">
                    {isEditing ? 'ویرایش پیشرفته اطلاعات محصول' : 'افزودن محصول ارگانیک جدید به انبار'}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    مشخصات کالا، بسته‌بندی، قیمت، و گالری تصاویر
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-6 text-sm">
              {/* Product Basic Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Title */}
                <div className="sm:col-span-2">
                  <label className="block text-gray-700 font-bold mb-1.5">نام و عنوان محصول:</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: تخم‌بلدرچین ارگانیک کامفیروز (بسته ۲۰ عددی)"
                    value={title}
                    onChange={(e) => {
                      const newTitle = e.target.value;
                      setTitle(newTitle);
                      if (!isSlugCustomized) {
                        setSlug(generateSeoSlug(newTitle, products.map((p) => p.slug)));
                      }
                    }}
                    className="w-full px-4 py-2.5 rounded-xl border border-[#E6E1D5] bg-[#F9F8F5] focus:bg-white focus:outline-none focus:border-[#2C4A2E] text-gray-900 font-medium"
                  />
                </div>

                {/* Pack size */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-gray-700 font-bold">نوع پکیج و مشخصات بسته:</label>
                    <span className="text-[11px] text-gray-400 font-normal">اختیاری</span>
                  </div>
                  <input
                    type="text"
                    placeholder="مثال: بسته ۳۰ عددی یا ۱ کیلوگرمی (اختیاری)"
                    value={packSize}
                    onChange={(e) => setPackSize(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-[#E6E1D5] bg-[#F9F8F5] focus:bg-white focus:outline-none focus:border-[#2C4A2E] text-gray-900 placeholder:text-gray-400"
                  />
                </div>

                {/* Category */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-gray-700 font-bold">دسته‌بندی:</label>
                    <button
                      type="button"
                      onClick={() => setIsCategoryModalOpen(true)}
                      className="text-xs text-[#2C4A2E] hover:text-[#1E3520] font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 text-[#D4A373]" />
                      <span>+ دسته جدید</span>
                    </button>
                  </div>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-[#E6E1D5] bg-[#F9F8F5] focus:bg-white focus:outline-none focus:border-[#2C4A2E] text-gray-900 font-medium"
                  >
                    {categories
                      .filter((c) => c !== 'همه محصولات')
                      .map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Price */}
                <div>
                  <label className="block text-gray-700 font-bold mb-1.5">قیمت فروش به مشتری (تومان):</label>
                  <input
                    type="number"
                    required
                    value={price}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    className="w-full px-4 py-2.5 rounded-xl border border-[#E6E1D5] bg-[#F9F8F5] focus:bg-white focus:outline-none focus:border-[#2C4A2E] text-gray-900 font-bold"
                  />
                </div>

                {/* Cost Price */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-gray-700 font-bold">بهای خرید از مزرعه (تومان):</label>
                    {costPrice !== '' && Number(costPrice) > 0 && price > Number(costPrice) && (
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                        حاشیه سود: {toPersianDigits(Math.round(((price - Number(costPrice)) / price) * 100))}٪
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    placeholder="اختیاری - برای گزارش سود ناخالص"
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-4 py-2.5 rounded-xl border border-[#E6E1D5] bg-[#F9F8F5] focus:bg-white focus:outline-none focus:border-[#2C4A2E] text-gray-900 font-bold"
                  />
                </div>

                {/* Stock */}
                <div>
                  <label className="block text-gray-700 font-bold mb-1.5">موجودی انبار پروفارم (تعداد بسته):</label>
                  <input
                    type="number"
                    required
                    value={stock}
                    onChange={(e) => setStock(Number(e.target.value))}
                    className="w-full px-4 py-2.5 rounded-xl border border-[#E6E1D5] bg-[#F9F8F5] focus:bg-white focus:outline-none focus:border-[#2C4A2E] text-gray-900 font-bold"
                  />
                </div>

                {/* Product Status Selector (موجود - ناموجود - به زودی) */}
                <div className="sm:col-span-2 p-4 rounded-2xl bg-white border border-[#E6E1D5] space-y-2.5 shadow-xs">
                  <label className="block text-gray-900 font-black text-xs">
                    وضعیت عرضه و فروش محصول در سایت:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => setStatus('AVAILABLE')}
                      className={`py-3 px-4 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer ${
                        status === 'AVAILABLE'
                          ? 'bg-emerald-700 text-white border-emerald-800 shadow-sm'
                          : 'bg-[#F9F8F5] text-emerald-900 border-emerald-200 hover:bg-emerald-50'
                      }`}
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>موجود (آماده سفارش)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setStatus('OUT_OF_STOCK')}
                      className={`py-3 px-4 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer ${
                        status === 'OUT_OF_STOCK'
                          ? 'bg-rose-700 text-white border-rose-800 shadow-sm'
                          : 'bg-[#F9F8F5] text-rose-900 border-rose-200 hover:bg-rose-50'
                      }`}
                    >
                      <AlertCircle className="w-4 h-4" />
                      <span>ناموجود (اتمام موقت)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setStatus('COMING_SOON')}
                      className={`py-3 px-4 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer ${
                        status === 'COMING_SOON'
                          ? 'bg-purple-700 text-white border-purple-800 shadow-sm'
                          : 'bg-[#F9F8F5] text-purple-900 border-purple-200 hover:bg-purple-50'
                      }`}
                    >
                      <Clock className="w-4 h-4" />
                      <span>به زودی (فصل برداشت)</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-500 font-medium leading-relaxed">
                    {status === 'AVAILABLE' && '✓ کالا با برچسب سبز در سایت فعال است و مشتریان می‌توانند به سبد خرید اضافه نمایند.'}
                    {status === 'OUT_OF_STOCK' && '✕ کالا با برچسب قرمز «ناموجود» نمایش داده شده و دکمه افزودن به سبد غیرفعال می‌گردد.'}
                    {status === 'COMING_SOON' && '⌛ کالا با برچسب بنفش «به زودی» و متن «به زودی در مزرعه» برای معرفی محصولات فصلی آینده نمایش می‌یابد.'}
                  </p>
                </div>

                {/* Weight */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-gray-700 font-bold">وزن تقریبی بسته (کیلوگرم):</label>
                    <span className="text-[11px] text-gray-400 font-normal">اختیاری</span>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="در صورت خالی بودن، کلاً در سایت نمایش داده نمی‌شود"
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-4 py-2.5 rounded-xl border border-[#E6E1D5] bg-[#F9F8F5] focus:bg-white focus:outline-none focus:border-[#2C4A2E] text-gray-900 placeholder:text-gray-400"
                  />
                  <p className="text-[10px] text-gray-400 mt-1 leading-normal">
                    💡 اگر وزن محصول را خالی بگذارید، مشخصه وزن در کارت محصول و صفحه جزئیات کالا کلاً مخفی خواهد بود.
                  </p>
                </div>

                {/* Dimensions */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-gray-700 font-bold">ابعاد کارتن (طول×عرض×ارتفاع):</label>
                    <span className="text-[11px] text-gray-400 font-normal">اختیاری</span>
                  </div>
                  <input
                    type="text"
                    placeholder="در صورت خالی بودن، کلاً در سایت نمایش داده نمی‌شود"
                    value={dimensions}
                    onChange={(e) => setDimensions(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-[#E6E1D5] bg-[#F9F8F5] focus:bg-white focus:outline-none focus:border-[#2C4A2E] text-gray-900 placeholder:text-gray-400"
                  />
                  <p className="text-[10px] text-gray-400 mt-1 leading-normal">
                    💡 اگر ابعاد محصول را خالی بگذارید، مشخصه ابعاد کارتن در صفحه محصول مخفی خواهد بود.
                  </p>
                </div>
              </div>

              {/* Multi-Image Upload & Gallery Section */}
              <div className="p-5 rounded-3xl bg-[#F9F8F5] border border-[#E6E1D5] space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="w-5 h-5 text-[#2C4A2E]" />
                    <span className="font-black text-[#2C4A2E]">تصاویر محصول (تصویر اصلی + گالری چندگانه):</span>
                  </div>
                  <span className="text-xs text-gray-500 font-medium">
                    {toPersianDigits(images.length)} تصویر بارگذاری‌شده
                  </span>
                </div>

                {/* File Upload Zone */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-[#2C4A2E]/40 hover:border-[#2C4A2E] rounded-2xl p-6 text-center bg-white cursor-pointer transition-all hover:bg-emerald-50/40 group"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <div className="w-12 h-12 rounded-2xl bg-[#2C4A2E]/10 group-hover:bg-[#2C4A2E]/20 text-[#2C4A2E] flex items-center justify-center mx-auto mb-2 transition-colors">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  <div className="font-bold text-gray-800 text-sm">
                    برای آپلود تصویر از کامپیوتر یا موبایل کلیک کنید
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    پشتیبانی از چندین تصویر همزمان (JPG, PNG, WebP)
                  </div>
                </div>

                {/* Add via Link / Sample Presets */}
                <div className="pt-2 border-t border-gray-200 space-y-2">
                  <span className="block text-xs font-bold text-gray-600">یا افزودن از طریق آدرس اینترنتی (URL) یا نمونه‌ها:</span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="/images/prod-eggs.jpg یا آدرس تصویر..."
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      className="flex-1 px-3.5 py-2 rounded-xl border border-[#E6E1D5] bg-white text-xs font-mono text-left"
                      dir="ltr"
                    />
                    <button
                      type="button"
                      onClick={handleAddImageUrl}
                      className="px-4 py-2 rounded-xl bg-gray-200 hover:bg-[#2C4A2E] hover:text-white text-gray-800 text-xs font-bold transition-colors shrink-0"
                    >
                      افزودن لینک
                    </button>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-xs text-gray-400">تصاویر آماده مزرعه:</span>
                    {sampleImages.map((s) => (
                      <button
                        key={s.label}
                        type="button"
                        onClick={() => setImages((prev) => [...prev, s.url])}
                        className="px-2.5 py-1 rounded-lg bg-white border border-gray-200 hover:border-[#2C4A2E] text-xs text-gray-700 transition-colors"
                      >
                        + {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Live Image Previews / Gallery Management */}
                {images.length > 0 && (
                  <div className="pt-3 border-t border-gray-200">
                    <div className="text-xs font-bold text-gray-700 mb-2.5">
                      پیش‌نمایش گالری (تصویر اول به عنوان تصویر شاخص نمایش داده می‌شود):
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {images.map((img, idx) => {
                        const isMain = idx === 0;
                        return (
                          <div
                            key={idx}
                            className={`relative rounded-2xl overflow-hidden border-2 transition-all p-1 bg-white ${
                              isMain
                                ? 'border-[#2C4A2E] shadow-md ring-2 ring-[#2C4A2E]/20'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <img
                              src={img}
                              alt={`عکس ${idx + 1}`}
                              className="w-full h-28 object-cover rounded-xl"
                            />

                            {/* Main badge or Set-as-main button */}
                            <div className="mt-1.5 flex flex-col gap-1">
                              {isMain ? (
                                <span className="inline-flex items-center justify-center gap-1 w-full py-1 rounded-lg bg-[#2C4A2E] text-white text-[10px] font-bold">
                                  <Star className="w-3 h-3 text-[#D4AF37] fill-[#D4AF37]" />
                                  <span>تصویر اصلی (کاور)</span>
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleSetPrimaryImage(idx)}
                                  className="w-full py-1 rounded-lg bg-gray-100 hover:bg-[#2C4A2E] hover:text-white text-[10px] font-bold text-gray-700 transition-colors cursor-pointer"
                                >
                                  انتخاب به عنوان تصویر اصلی
                                </button>
                              )}

                              {/* Remove button */}
                              <button
                                type="button"
                                onClick={() => handleRemoveImage(idx)}
                                className="w-full py-0.5 rounded-lg text-rose-600 hover:bg-rose-50 text-[10px] font-semibold transition-colors flex items-center justify-center gap-1 cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>حذف تصویر</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-gray-700 font-bold mb-1.5">شرح و معرفی کامل محصول:</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="توضیحات جذاب و جزئیات ارگانیک بودن این محصول را بنویسید..."
                  className="w-full p-4 rounded-xl border border-[#E6E1D5] bg-[#F9F8F5] focus:bg-white focus:outline-none focus:border-[#2C4A2E] text-gray-900 leading-relaxed font-medium"
                />
              </div>

              {/* SECTION: Dynamic Specifications (مشخصات فنی و شناسنامه محصول) */}
              <div className="p-5 rounded-2xl border-2 border-dashed border-[#2C4A2E]/20 bg-[#2C4A2E]/5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 font-bold text-gray-900 text-sm">
                      <Sliders className="w-4 h-4 text-[#2C4A2E]" />
                      <span>جدول مشخصات فنی و شناسنامه اختصاصی محصول</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[#2C4A2E] text-white font-bold">
                        {toPersianDigits(specifications.length)} مشخصه
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      تعداد و عناوین مشخصات توسط ادمین تعیین می‌شود و مستقیماً در جدول مشخصات صفحه محصول درج می‌گردد.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddSpecificationRow('', '')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#2C4A2E] hover:bg-[#1E3520] text-white text-xs font-bold transition-all shadow-sm shrink-0 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-[#D4A373]" />
                    <span>+ افزودن ردیف مشخصه جدید</span>
                  </button>
                </div>

                {/* Quick Presets Chips */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-xs text-gray-500 font-medium">عناوین پیشنهادی سریع:</span>
                  {[
                    'محل تولید و مرتع',
                    'شیوه پرورش و نگهداری',
                    'دمای ایده‌آل نگهداری',
                    'مدت ماندگاری',
                    'نوع بسته‌بندی',
                    'طبع و مزاج در طب سنتی',
                    'گواهی سلامت و بهداشت',
                    'وزن خالص بدون ظرف',
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handleAddSpecificationRow(preset, '')}
                      className="text-[11px] px-2.5 py-1 rounded-lg bg-white border border-[#2C4A2E]/20 hover:border-[#2C4A2E] hover:bg-[#2C4A2E]/10 text-gray-700 transition-colors cursor-pointer"
                    >
                      + {preset}
                    </button>
                  ))}
                </div>

                {/* Dynamic Specification Rows */}
                {specifications.length === 0 ? (
                  <div className="py-6 text-center text-xs text-gray-400 bg-white/70 rounded-xl border border-gray-200">
                    هنوز هیچ مشخصه‌ای اضافه نشده است. با زدن دکمه بالا یا کلیک روی عناوین پیشنهادی، مشخصات دلخواه را اضافه کنید.
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                    {specifications.map((spec, sIdx) => (
                      <div
                        key={sIdx}
                        className="flex items-center gap-2 bg-white p-2.5 rounded-xl border border-gray-200 hover:border-[#2C4A2E]/40 transition-colors"
                      >
                        <span className="text-xs font-bold text-gray-400 w-5 text-center shrink-0">
                          {toPersianDigits(sIdx + 1)}
                        </span>
                        <input
                          type="text"
                          placeholder="عنوان مشخصه (مثلاً: محل برداشت)..."
                          value={spec.key}
                          onChange={(e) => handleUpdateSpecification(sIdx, 'key', e.target.value)}
                          className="w-1/3 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-bold text-gray-800 focus:outline-none focus:border-[#2C4A2E]"
                        />
                        <span className="text-gray-300">:</span>
                        <input
                          type="text"
                          placeholder="مقدار مشخصه (مثلاً: باغات دشت‌ارژن شیراز)..."
                          value={spec.value}
                          onChange={(e) => handleUpdateSpecification(sIdx, 'value', e.target.value)}
                          className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-700 focus:outline-none focus:border-[#2C4A2E]"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveSpecification(sIdx)}
                          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition-colors shrink-0 cursor-pointer"
                          title="حذف ردیف"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* SECTION: Key Highlights (نکات کلیدی و مزایا) */}
              <div>
                <label className="block text-gray-700 font-bold mb-1.5 text-xs flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#D4A373]" />
                    <span>نکات کلیدی و مزایای ویژه محصول (هر مورد در یک خط):</span>
                  </span>
                  <span className="text-gray-400 font-normal">نمایش به صورت تیک‌های سبز در بالای صفحه محصول</span>
                </label>
                <textarea
                  rows={3}
                  value={highlightsText}
                  onChange={(e) => setHighlightsText(e.target.value)}
                  placeholder="مثال:&#10;۱۰۰٪ طبیعی و ارگانیک بدون سموم شیمیایی&#10;برداشت تازه روز با ارسال اکسپرس در شیراز&#10;سرشار از آنتی‌اکسیدان و مواد مغذی"
                  className="w-full p-3 rounded-xl border border-[#E6E1D5] bg-[#F9F8F5] focus:bg-white focus:outline-none focus:border-[#2C4A2E] text-xs leading-relaxed text-gray-800"
                />
              </div>

              {/* SECTION: Origin, Shelf Life, and Storage */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-2xl bg-amber-50/40 border border-amber-200/60">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">محل و مبدأ دقیق تولید:</label>
                  <input
                    type="text"
                    value={originLocation}
                    onChange={(e) => setOriginLocation(e.target.value)}
                    placeholder="مثلاً: باغات سیب سپیدان، مزارع کوار، کندوهای دشت‌ارژن"
                    className="w-full px-3 py-2 rounded-xl border border-amber-200 bg-white text-xs font-medium text-gray-800 focus:outline-none focus:border-[#2C4A2E]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">مدت زمان ماندگاری و انقضا:</label>
                  <input
                    type="text"
                    value={shelfLife}
                    onChange={(e) => setShelfLife(e.target.value)}
                    placeholder="مثلاً: ۳۰ روز در یخچال، ۲ سال در دمای اتاق"
                    className="w-full px-3 py-2 rounded-xl border border-amber-200 bg-white text-xs font-medium text-gray-800 focus:outline-none focus:border-[#2C4A2E]"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-gray-700 mb-1">دستورالعمل نگهداری بهینه:</label>
                  <input
                    type="text"
                    value={storageInstructions}
                    onChange={(e) => setStorageInstructions(e.target.value)}
                    placeholder="مثلاً: در دمای ۲ الی ۶ درجه سانتی‌گراد، دور از رطوبت و تابش مستقیم نور خورشید نگهداری شود."
                    className="w-full px-3 py-2 rounded-xl border border-amber-200 bg-white text-xs font-medium text-gray-800 focus:outline-none focus:border-[#2C4A2E]"
                  />
                </div>
              </div>

              {/* SECTION: Nutritional Information */}
              <div className="p-4 rounded-2xl bg-blue-50/40 border border-blue-200/60 space-y-3">
                <div className="flex items-center gap-1.5 font-bold text-xs text-blue-900">
                  <Flame className="w-3.5 h-3.5 text-amber-500" />
                  <span>جدول ارزش غذایی تقریبی (در هر ۱۰۰ گرم یا یک وعده استاندارد)</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 mb-1">کالری (Kcal):</label>
                    <input
                      type="text"
                      value={calories}
                      onChange={(e) => setCalories(e.target.value)}
                      placeholder="مثلاً: ۷۲"
                      className="w-full px-3 py-1.5 rounded-lg border border-blue-200 bg-white text-xs font-medium text-center focus:outline-none focus:border-[#2C4A2E]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 mb-1">پروتئین (گرم):</label>
                    <input
                      type="text"
                      value={protein}
                      onChange={(e) => setProtein(e.target.value)}
                      placeholder="مثلاً: ۶.۳"
                      className="w-full px-3 py-1.5 rounded-lg border border-blue-200 bg-white text-xs font-medium text-center focus:outline-none focus:border-[#2C4A2E]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 mb-1">چربی کل (گرم):</label>
                    <input
                      type="text"
                      value={fat}
                      onChange={(e) => setFat(e.target.value)}
                      placeholder="مثلاً: ۴.۸"
                      className="w-full px-3 py-1.5 rounded-lg border border-blue-200 bg-white text-xs font-medium text-center focus:outline-none focus:border-[#2C4A2E]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 mb-1">کربوهیدرات (گرم):</label>
                    <input
                      type="text"
                      value={carbs}
                      onChange={(e) => setCarbs(e.target.value)}
                      placeholder="مثلاً: ۰.۵"
                      className="w-full px-3 py-1.5 rounded-lg border border-blue-200 bg-white text-xs font-medium text-center focus:outline-none focus:border-[#2C4A2E]"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION: Dynamic FAQs */}
              <div className="p-4 rounded-2xl bg-emerald-50/40 border border-emerald-200/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-[#2C4A2E]">
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>سوالات متداول اختصاصی این کالا ({toPersianDigits(faqs.length)} سوال)</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddFaqRow}
                    className="text-xs font-bold text-[#2C4A2E] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>+ افزودن سوال جدید</span>
                  </button>
                </div>

                {faqs.length === 0 ? (
                  <p className="text-[11px] text-gray-400">هنوز سوال متداولی برای این کالا تعریف نشده است.</p>
                ) : (
                  <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                    {faqs.map((faq, fIdx) => (
                      <div key={fIdx} className="bg-white p-2.5 rounded-xl border border-emerald-100 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <input
                            type="text"
                            placeholder="پرسش متداول (مثلاً: آیا این عسل حرارت دیده است؟)..."
                            value={faq.question}
                            onChange={(e) => handleUpdateFaq(fIdx, 'question', e.target.value)}
                            className="flex-1 px-2.5 py-1 rounded-lg border border-gray-200 text-xs font-bold text-gray-800 focus:outline-none focus:border-[#2C4A2E]"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveFaq(fIdx)}
                            className="p-1 rounded text-rose-500 hover:bg-rose-50 cursor-pointer"
                            title="حذف پرسش"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <textarea
                          rows={2}
                          placeholder="پاسخ کوتاه و کامل..."
                          value={faq.answer}
                          onChange={(e) => handleUpdateFaq(fIdx, 'answer', e.target.value)}
                          className="w-full px-2.5 py-1 rounded-lg border border-gray-200 text-xs font-medium text-gray-700 focus:outline-none focus:border-[#2C4A2E]"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* SEO & Google SERP Configuration */}
              <div className="bg-gradient-to-br from-emerald-50/50 via-teal-50/30 to-blue-50/40 p-4 rounded-xl border border-emerald-200/80 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-100 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-[#2C4A2E] text-white flex items-center justify-center shadow-sm">
                      <Globe className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-sm text-[#1A2E1B] flex items-center gap-1.5">
                        تنظیمات سئو و نتایج گوگل (Google SEO & Rich Snippets)
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                          تولید خودکار هوشمند
                        </span>
                      </h4>
                      <p className="text-[11px] text-gray-500">
                        در صورت خالی گذاشتن، هوش مصنوعی فروشگاه به صورت ۱۰۰٪ خودکار بهینه‌ترین عنوان، توضیحات، اسکیما و آدرس سئو را می‌سازد.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAutoGenerateSeo}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-50 rounded-lg text-xs font-bold transition shadow-sm cursor-pointer self-start sm:self-auto"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                    <span>تولید و بازنویسی خودکار سئو</span>
                  </button>
                </div>

                {/* Google SERP Live Snippet Preview */}
                <div className="bg-white rounded-xl p-3.5 border border-gray-200/80 shadow-xs space-y-1.5 text-right font-sans" dir="rtl">
                  <div className="text-[11px] text-gray-500 flex items-center gap-1.5 font-mono dir-ltr justify-end">
                    <span className="text-gray-400">https://profarm.ir</span>
                    <span className="text-gray-300">›</span>
                    <span className="text-emerald-700 font-semibold">products</span>
                    <span className="text-gray-300">›</span>
                    <span className="text-gray-700 font-bold max-w-[200px] truncate">{slug || (title ? generateSeoSlug(title) : 'product-slug')}</span>
                  </div>
                  <h5 className="text-[#1a0dab] hover:underline text-base font-medium leading-snug cursor-pointer line-clamp-1">
                    {seoTitle || (title ? generateProductSeoTitle({ title, category, originLocation }) : 'خرید آنلاین محصولات ارگانیک شیراز | پروفارم')}
                  </h5>
                  <div className="flex items-center gap-2 text-xs text-gray-500 font-sans">
                    <span className="text-amber-500 font-bold flex items-center">★★★★★</span>
                    <span className="text-xs font-bold text-gray-700">۵٫۰</span>
                    <span className="text-[11px] text-gray-400">· موجود در انبار شیراز · ارسال همان روز</span>
                  </div>
                  <p className="text-xs text-[#4d5156] leading-relaxed line-clamp-2">
                    {seoDescription || (title ? generateProductSeoDescription({ title, category, description, originLocation }) : 'محصولات طبیعی و ارگانیک مزارع فارس با ارسال سریع زنجیره سرد در شیراز. خرید اینترنتی با تضمین تازگی و کیفیت روز.')}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* URL Slug */}
                  <div className="sm:col-span-2">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-gray-700 flex items-center gap-1">
                        <span>نامک آدرس صفحه (URL Slug)</span>
                        <span className="text-[10px] text-gray-400 font-normal">(انگلیسی یا فارسی استاندارد)</span>
                      </label>
                      <span className="text-[10px] text-emerald-700 font-medium font-mono">
                        /products/{slug || (title ? generateSeoSlug(title) : '...')}
                      </span>
                    </div>
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        placeholder="مانند: organic-honey یا عسل-گون-شیراز (خودکار تولید می‌شود)"
                        value={slug}
                        onChange={(e) => {
                          setSlug(e.target.value);
                          setIsSlugCustomized(true);
                        }}
                        className="w-full pl-3 pr-8 py-2 rounded-lg border border-gray-200 text-xs font-mono text-gray-800 focus:outline-none focus:border-[#2C4A2E] bg-white text-left dir-ltr"
                      />
                      <Search className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 pointer-events-none" />
                    </div>
                  </div>

                  {/* SEO Title */}
                  <div className="sm:col-span-2">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-gray-700">
                        عنوان سئو در گوگل (Meta Title)
                      </label>
                      <span className={`text-[10px] font-mono ${(seoTitle.length > 65 || (seoTitle.length > 0 && seoTitle.length < 30)) ? 'text-amber-600' : 'text-gray-400'}`}>
                        {seoTitle.length} / ۶۰ کاراکتر {seoTitle.length === 0 ? '(استفاده از خودکار)' : ''}
                      </span>
                    </div>
                    <input
                      type="text"
                      placeholder={title ? generateProductSeoTitle({ title, category, originLocation }) : 'عنوان سئو (اختیاری - در صورت خالی بودن خودکار پر می‌شود)'}
                      value={seoTitle}
                      onChange={(e) => setSeoTitle(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs font-medium text-gray-800 focus:outline-none focus:border-[#2C4A2E] bg-white"
                    />
                  </div>

                  {/* SEO Meta Description */}
                  <div className="sm:col-span-2">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-gray-700">
                        توضیحات متا در نتایج گوگل (Meta Description)
                      </label>
                      <span className={`text-[10px] font-mono ${(seoDescription.length > 165 || (seoDescription.length > 0 && seoDescription.length < 100)) ? 'text-amber-600' : 'text-gray-400'}`}>
                        {seoDescription.length} / ۱۵۵ کاراکتر {seoDescription.length === 0 ? '(استفاده از خودکار)' : ''}
                      </span>
                    </div>
                    <textarea
                      rows={2}
                      placeholder={title ? generateProductSeoDescription({ title, category, description, originLocation }) : 'توضیحات کوتاه برای نمایش در موتورهای جستجو...'}
                      value={seoDescription}
                      onChange={(e) => setSeoDescription(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs font-medium text-gray-800 focus:outline-none focus:border-[#2C4A2E] bg-white"
                    />
                  </div>

                  {/* SEO Keywords */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      کلمات کلیدی جستجو (با کاما یا ویرگول جدا کنید)
                    </label>
                    <input
                      type="text"
                      placeholder={title ? generateProductSeoKeywords({ title, category, originLocation }).join('، ') : 'ارگانیک شیراز، ارسال سریع، محصولات طبیعی فارس'}
                      value={seoKeywordsText}
                      onChange={(e) => setSeoKeywordsText(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs font-medium text-gray-800 focus:outline-none focus:border-[#2C4A2E] bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Checkboxes */}
              <div className="flex flex-wrap items-center gap-8 pt-3 border-t border-gray-100">
                <label className="flex items-center gap-2.5 cursor-pointer font-bold text-gray-800">
                  <input
                    type="checkbox"
                    checked={isOrganicCertified}
                    onChange={(e) => setIsOrganicCertified(e.target.checked)}
                    className="w-5 h-5 rounded text-[#2C4A2E] focus:ring-[#2C4A2E]"
                  />
                  <span>دارای تاییدیه ارگانیک مزارع فارس</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer font-bold text-gray-800">
                  <input
                    type="checkbox"
                    checked={isBulkEligible}
                    onChange={(e) => setIsBulkEligible(e.target.checked)}
                    className="w-5 h-5 rounded text-[#2C4A2E] focus:ring-[#2C4A2E]"
                  />
                  <span>واجد شرایط خرید عمده (سایر استان‌ها)</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-5 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-2.5 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-100 font-bold transition-colors cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-7 py-2.5 rounded-xl bg-[#2C4A2E] text-white font-bold hover:bg-[#1E3520] shadow-md flex items-center gap-2 cursor-pointer transition-all hover:scale-102"
                >
                  <Save className="w-4 h-4 text-[#D4A373]" />
                  <span>{isEditing ? 'ذخیره تغییرات محصول' : 'ثبت قطعی در انبار شیراز'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Management Modal */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-xl w-full max-h-[90vh] overflow-y-auto border border-[#E6E1D5] shadow-2xl p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-[#E6E1D5]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#D4A373]/20 flex items-center justify-center text-[#D4A373]">
                  <FolderTree className="w-5 h-5 text-[#2C4A2E]" />
                </div>
                <div>
                  <h3 className="font-black text-lg text-[#2C4A2E]">
                    مدیریت دسته‌بندی‌های محصولات
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    افزودن دسته‌های جدید کالا، ویرایش و حذف دسته‌ها
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(false)}
                className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Add New Category Form */}
            <form onSubmit={handleAddCategory} className="space-y-3 bg-[#F9F8F5] p-4 rounded-2xl border border-[#E6E1D5]">
              <label className="block text-xs font-bold text-[#2C4A2E]">
                ایجاد دسته‌بندی جدید:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="مثال: گیاهان دارویی و دمنوش، ترشیجات محلی..."
                  value={newCategoryInput}
                  onChange={(e) => setNewCategoryInput(e.target.value)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-[#E6E1D5] bg-white focus:outline-none focus:border-[#2C4A2E] text-xs font-medium"
                />
                <button
                  type="submit"
                  disabled={!newCategoryInput.trim()}
                  className="px-5 py-2.5 rounded-xl bg-[#2C4A2E] text-white text-xs font-bold hover:bg-[#1E3520] transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
                >
                  <Plus className="w-4 h-4 text-[#D4A373]" />
                  <span>افزودن دسته</span>
                </button>
              </div>
            </form>

            {/* Existing Categories List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-gray-600">
                <span>دسته‌بندی‌های فعال ({toPersianDigits(categories.filter((c) => c !== 'همه محصولات').length)} دسته):</span>
                <button
                  type="button"
                  onClick={handleResetCategories}
                  className="text-xs text-amber-700 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>بازنشانی پیش‌فرض</span>
                </button>
              </div>

              <div className="divide-y divide-gray-100 border border-[#E6E1D5] rounded-2xl overflow-hidden max-h-72 overflow-y-auto">
                {categories
                  .filter((c) => c !== 'همه محصولات')
                  .map((cat) => {
                    const prodCount = products.filter((p) => p.category === cat).length;
                    return (
                      <div
                        key={cat}
                        className="flex items-center justify-between p-3.5 hover:bg-[#F9F8F5] transition-colors text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <Tag className="w-4 h-4 text-[#D4A373]" />
                          <span className="font-bold text-gray-800">{cat}</span>
                          <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 text-[10px]">
                            {toPersianDigits(prodCount)} محصول
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteCategory(cat)}
                          title="حذف دسته‌بندی"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
              </div>
            </div>

            <div className="pt-3 border-t border-gray-100 flex justify-end">
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(false)}
                className="px-6 py-2.5 rounded-xl bg-[#2C4A2E] text-white text-xs font-bold hover:bg-[#1E3520] transition-colors cursor-pointer"
              >
                تایید و بستن
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
