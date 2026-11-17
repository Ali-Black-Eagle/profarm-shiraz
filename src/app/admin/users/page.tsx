'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { farmStore } from '@/lib/db-store';
import { User, SubscriptionTier, UserRole } from '@/types';
import { toPersianDigits } from '@/lib/formatters';
import {
  Users,
  Crown,
  Sparkles,
  ShieldCheck,
  Calendar,
  Edit,
  X,
  Save,
  CheckCircle2,
  Filter,
  UserCheck,
  Zap,
  Mail,
} from 'lucide-react';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [filterTier, setFilterTier] = useState<'ALL' | 'PRO' | 'PLUS' | 'FREE'>('ALL');
  const [notification, setNotification] = useState<string | null>(null);

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier>('FREE');
  const [customExpiry, setCustomExpiry] = useState<string>('');
  const [userRole, setUserRole] = useState<UserRole>('USER');

  const loadUsers = async () => {
    try {
      const res = await fetch('/api/admin?type=users');
      const data = await res.json();
      if (data.success && Array.isArray(data.users)) {
        const unique = new Map<string, User>();
        data.users.forEach((u: User) => {
          const key = u.id || u.phone;
          if (key && !unique.has(key)) {
            unique.set(key, u);
          }
        });
        setUsers(Array.from(unique.values()));
        return;
      }
    } catch (e) {
      console.warn('Failed to load users from API, falling back to store:', e);
    }

    const rawUsers = farmStore.getAllUsers();
    const unique = new Map<string, User>();
    rawUsers.forEach((u) => {
      const key = u.id || u.phone;
      if (key && !unique.has(key)) {
        unique.set(key, u);
      }
    });
    setUsers(Array.from(unique.values()));
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  const handleOpenEditModal = (user: User) => {
    setEditingUser(user);
    const tier: SubscriptionTier = user.subscriptionTier || (user.isProMember ? 'PRO' : user.isPlusMember ? 'PLUS' : 'FREE');
    setSelectedTier(tier);
    const expiry = tier === 'PRO' ? (user.proExpiresAt || '۱۴۰۵/۱۲/۲۹') : tier === 'PLUS' ? (user.plusExpiresAt || '۱۴۰۵/۱۲/۲۹') : '';
    setCustomExpiry(expiry);
    setUserRole(user.role || 'USER');
    setIsEditModalOpen(true);
  };

  const handleQuickExtend = (months: number) => {
    // Generates a sample Jalali expiration date based on months
    if (months === 1) setCustomExpiry('۱۴۰۵/۰۷/۱۵');
    else if (months === 3) setCustomExpiry('۱۴۰۵/۰۹/۱۵');
    else if (months === 6) setCustomExpiry('۱۴۰۵/۱۲/۲۹');
    else if (months === 12) setCustomExpiry('۱۴۰۶/۰۶/۱۵');
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      // 1. Update subscription on server
      await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateUserSubscription',
          payload: {
            identifier: editingUser.id || editingUser.phone,
            tier: selectedTier,
            expiryDate: selectedTier !== 'FREE' ? customExpiry : undefined,
          },
        }),
      });

      // 2. Update role on server if changed
      if (editingUser.role !== userRole) {
        await fetch('/api/admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'updateUserRole',
            payload: {
              identifier: editingUser.phone || editingUser.id,
              role: userRole,
            },
          }),
        });
      }
    } catch (err) {
      console.warn('Failed to update user on server API:', err);
    }

    // Sync local store
    const userIdentifier = editingUser.id || editingUser.phone || '';
    if (userIdentifier) {
      farmStore.updateUserSubscription(
        userIdentifier,
        selectedTier,
        selectedTier !== 'FREE' ? customExpiry : undefined
      );
      if (editingUser.role !== userRole) {
        farmStore.updateUserRole(userIdentifier, userRole);
      }
    }

    await loadUsers();
    setIsEditModalOpen(false);
    showToast(`اشتراک و دسترسی‌های کاربر ${editingUser.name || editingUser.phone || 'کاربر'} با موفقیت ذخیره شد.`);
  };

  const filteredUsers = users.filter((u) => {
    const tier: SubscriptionTier = u.subscriptionTier || (u.isProMember ? 'PRO' : u.isPlusMember ? 'PLUS' : 'FREE');
    if (filterTier === 'ALL') return true;
    return tier === filterTier;
  });

  const proCount = users.filter((u) => u.isProMember || u.subscriptionTier === 'PRO').length;
  const plusCount = users.filter((u) => u.isPlusMember || u.subscriptionTier === 'PLUS').length;
  const freeCount = users.filter((u) => !u.isProMember && !u.isPlusMember && u.subscriptionTier !== 'PRO' && u.subscriptionTier !== 'PLUS').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#E6E1D5]">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#2C4A2E] tracking-tight">
            مدیریت کاربران و اشتراک‌های طلایی (پرو و پلاس)
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1 leading-relaxed">
            مشاهده اعضا، تعیین سطح اشتراک (پرو ۶ روز تحویل، پلاس، یا رایگان)، ویرایش تاریخ انقضا و مدیریت نقش‌ها
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href="/admin/subscriptions"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-[#2C4A2E] text-white hover:bg-[#1E3520] text-xs font-bold shadow-xs transition-all"
          >
            <Crown className="w-4 h-4 text-[#D4AF37]" />
            <span>تنظیمات تعرفه و ظرفیت اشتراک‌ها</span>
          </Link>
          <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold shadow-xs">
            <Crown className="w-4 h-4 text-amber-600" />
            <span>{toPersianDigits(proCount)} مشترک پرو</span>
          </span>
          <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold shadow-xs">
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <span>{toPersianDigits(plusCount)} مشترک پلاس</span>
          </span>
        </div>
      </div>

      {notification && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-xs sm:text-sm font-bold text-emerald-950 flex items-center gap-2.5 animate-in fade-in shadow-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 pb-1">
        <span className="text-xs font-bold text-gray-500 ml-1">فیلتر سطح اشتراک:</span>
        <button
          onClick={() => setFilterTier('ALL')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            filterTier === 'ALL'
              ? 'bg-[#2C4A2E] text-white shadow-sm'
              : 'bg-white text-gray-700 hover:bg-gray-100 border border-[#E6E1D5]'
          }`}
        >
          همه خریداران ({toPersianDigits(users.length)})
        </button>

        <button
          onClick={() => setFilterTier('PRO')}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            filterTier === 'PRO'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-200'
          }`}
        >
          <Crown className="w-3.5 h-3.5" />
          <span>مشترکین پرو ({toPersianDigits(proCount)})</span>
        </button>

        <button
          onClick={() => setFilterTier('PLUS')}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            filterTier === 'PLUS'
              ? 'bg-emerald-700 text-white shadow-sm'
              : 'bg-emerald-50 text-emerald-900 hover:bg-emerald-100 border border-emerald-200'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>مشترکین پلاس ({toPersianDigits(plusCount)})</span>
        </button>

        <button
          onClick={() => setFilterTier('FREE')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            filterTier === 'FREE'
              ? 'bg-gray-700 text-white shadow-sm'
              : 'bg-white text-gray-700 hover:bg-gray-100 border border-[#E6E1D5]'
          }`}
        >
          کاربران عادی ({toPersianDigits(freeCount)})
        </button>
      </div>

      {/* Mobile Users Cards (Mobile only, zero horizontal scrolling) */}
      <div className="md:hidden flex flex-col gap-3.5">
        {filteredUsers.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E6E1D5] p-8 text-center text-gray-500 font-medium">
            هیچ کاربری در این فیلتر یافت نشد.
          </div>
        ) : (
          filteredUsers.map((user) => {
            const isPro = user.isProMember || user.subscriptionTier === 'PRO';
            const isPlus = !isPro && (user.isPlusMember || user.subscriptionTier === 'PLUS');
            return (
              <div
                key={user.id || user.phone}
                className="bg-white rounded-2xl border border-[#E6E1D5] p-4 shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between border-b border-[#F3EFE6] pb-2">
                  <div>
                    <div className="font-bold text-gray-900 text-sm">{user.name || 'کاربر بدون نام'}</div>
                    <div className="text-[10px] text-gray-400 font-mono">
                      {user.username ? `@${user.username}` : `شناسه: ${user.id || '-'}`}
                    </div>
                  </div>
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                      user.role === 'ADMIN'
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {user.role === 'ADMIN' ? 'مدیر ارشد' : 'مشتری'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">شماره تماس:</span>
                  {user.phone ? (
                    <a
                      href={`tel:${user.phone}`}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 font-bold"
                      dir="ltr"
                    >
                      <span>{user.phone}</span>
                      <span>📞</span>
                    </a>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">سطح عضویت:</span>
                  {isPro ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 font-bold text-[11px]">
                      <Crown className="w-3 h-3 text-amber-600" />
                      <span>پروفارم پرو</span>
                    </span>
                  ) : isPlus ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 font-bold text-[11px]">
                      <Sparkles className="w-3 h-3 text-emerald-600" />
                      <span>پروفارم پلاس</span>
                    </span>
                  ) : (
                    <span className="text-gray-400 text-xs">عادی</span>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#F3EFE6]">
                  <button
                    type="button"
                    onClick={() => handleOpenEditModal(user)}
                    className="px-3 py-1.5 rounded-xl bg-[#2C4A2E] text-white font-bold text-xs flex items-center gap-1.5 shadow-xs"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>مدیریت و اشتراک</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Desktop Users Table */}
      <div className="hidden md:block bg-white rounded-3xl border border-[#E6E1D5] shadow-farm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs sm:text-sm">
            <thead className="bg-[#F9F8F5] border-b border-[#E6E1D5] text-[#2C4A2E]">
              <tr>
                <th className="py-3.5 px-5 font-black">کاربر</th>
                <th className="py-3.5 px-5 font-black">شماره همراه</th>
                <th className="py-3.5 px-5 font-black">نقش</th>
                <th className="py-3.5 px-5 font-black">سطح اشتراک</th>
                <th className="py-3.5 px-5 font-black">مزایای فعال</th>
                <th className="py-3.5 px-5 font-black">تاریخ انقضا</th>
                <th className="py-3.5 px-5 font-black">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6E1D5]">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-500 font-medium">
                    هیچ کاربری در این فیلتر یافت نشد.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const isPro = user.isProMember || user.subscriptionTier === 'PRO';
                  const isPlus = !isPro && (user.isPlusMember || user.subscriptionTier === 'PLUS');
                  const expiry = isPro ? user.proExpiresAt : isPlus ? user.plusExpiresAt : null;

                  return (
                    <tr key={user.id || user.phone} className="hover:bg-gray-50/70 transition-colors">
                      <td className="py-4 px-5">
                        <div className="font-bold text-gray-900">{user.name || 'کاربر بدون نام'}</div>
                        {user.email && (
                          <div className="text-[11px] text-emerald-700 font-mono mt-0.5 dir-ltr text-right">
                            {user.email}
                          </div>
                        )}
                        <div className="text-[10px] text-gray-400 mt-0.5 font-mono">
                          {user.username ? `@${user.username}` : `شناسه: ${user.id || '-'}`}
                        </div>
                      </td>

                      <td className="py-4 px-5 font-mono text-gray-700">
                        <div className="flex items-center gap-1" dir="ltr">
                          <span>{user.phone || '-'}</span>
                          {user.phone && (
                            user.isPhoneVerified ? (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800">
                                تاییدشده ✓
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800">
                                تاییدنشده
                              </span>
                            )
                          )}
                        </div>
                      </td>

                      <td className="py-4 px-5">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-xl text-xs font-bold ${
                            user.role === 'ADMIN'
                              ? 'bg-purple-100 text-purple-800 border border-purple-200'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {user.role === 'ADMIN' ? 'مدیر ارشد' : 'کاربر خریدار'}
                        </span>
                      </td>

                      <td className="py-4 px-5">
                        {isPro ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs">
                            <Crown className="w-3.5 h-3.5 text-amber-600" />
                            <span>پروفارم پرو (طلایی)</span>
                          </span>
                        ) : isPlus ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold text-xs">
                            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                            <span>پروفارم پلاس</span>
                          </span>
                        ) : (
                          <span className="inline-block px-2.5 py-1 rounded-full bg-gray-100 text-gray-500 font-medium text-xs">
                            عادی (رایگان)
                          </span>
                        )}
                      </td>

                      <td className="py-4 px-5 text-xs">
                        {isPro ? (
                          <div className="space-y-0.5 text-gray-700 font-medium">
                            <span className="text-amber-800 font-bold block">✓ ارسال ۶ روزه هفتگی</span>
                            <span className="text-[11px] text-gray-500 block">۱۰٪ تخفیف + ارسال رایگان بالای ۶۰۰ ت</span>
                          </div>
                        ) : isPlus ? (
                          <div className="space-y-0.5 text-gray-700 font-medium">
                            <span className="text-emerald-800 font-bold block">✓ ۵٪ تخفیف دائم سبد</span>
                            <span className="text-[11px] text-gray-500 block">سوپرآفرهای ماهانه اعضا</span>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">ارسال ۲ روزه (یکشنبه و چهارشنبه)</span>
                        )}
                      </td>

                      <td className="py-4 px-5">
                        {expiry ? (
                          <span className="font-mono text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                            تا {expiry}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">نامحدود / بدون اشتراک</span>
                        )}
                      </td>

                      <td className="py-4 px-5">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleOpenEditModal(user)}
                            className="px-3.5 py-2 rounded-xl bg-gray-100 hover:bg-[#2C4A2E] hover:text-white text-gray-800 font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                          >
                            <Edit className="w-3.5 h-3.5" />
                            <span>مدیریت</span>
                          </button>
                          {user.email && (
                            <Link
                              href="/admin/sms"
                              className="px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-800 font-bold text-xs transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
                              title="ارسال ایمیل به این کاربر"
                            >
                              <Mail className="w-3.5 h-3.5" />
                              <span>ایمیل</span>
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit User Subscription & Role Modal */}
      {isEditModalOpen && editingUser && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 border border-[#E6E1D5] shadow-2xl space-y-6 animate-in fade-in zoom-in-95 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-[#F3EFE6]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#2C4A2E]/10 flex items-center justify-center text-[#2C4A2E]">
                  <Crown className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-[#2C4A2E]">
                    مدیریت اشتراک و دسترسی کاربر
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {editingUser.name || 'کاربر بدون نام'} ({editingUser.phone})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-5 text-sm">
              {/* Subscription Tier Selection */}
              <div className="space-y-2">
                <label className="block text-gray-800 font-black text-xs">
                  سطح عضویت اشتراک:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTier('PRO');
                      if (!customExpiry) setCustomExpiry('۱۴۰۵/۱۲/۲۹');
                    }}
                    className={`p-3 rounded-2xl border text-right transition-all cursor-pointer ${
                      selectedTier === 'PRO'
                        ? 'bg-amber-500 text-white border-amber-600 shadow-sm ring-2 ring-amber-300'
                        : 'bg-[#F9F8F5] text-gray-800 border-gray-200 hover:bg-amber-50/50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs mb-1">
                      <Crown className="w-4 h-4" />
                      <span>پروفارم پرو</span>
                    </div>
                    <div className={`text-[10px] leading-tight ${selectedTier === 'PRO' ? 'text-amber-100' : 'text-gray-500'}`}>
                      ارسال ۶ روزه، ۱۰٪ تخفیف
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTier('PLUS');
                      if (!customExpiry) setCustomExpiry('۱۴۰۵/۱۲/۲۹');
                    }}
                    className={`p-3 rounded-2xl border text-right transition-all cursor-pointer ${
                      selectedTier === 'PLUS'
                        ? 'bg-emerald-700 text-white border-emerald-800 shadow-sm ring-2 ring-emerald-300'
                        : 'bg-[#F9F8F5] text-gray-800 border-gray-200 hover:bg-emerald-50/50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs mb-1">
                      <Sparkles className="w-4 h-4" />
                      <span>پروفارم پلاس</span>
                    </div>
                    <div className={`text-[10px] leading-tight ${selectedTier === 'PLUS' ? 'text-emerald-100' : 'text-gray-500'}`}>
                      ۵٪ تخفیف دائمی
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTier('FREE');
                      setCustomExpiry('');
                    }}
                    className={`p-3 rounded-2xl border text-right transition-all cursor-pointer ${
                      selectedTier === 'FREE'
                        ? 'bg-gray-800 text-white border-gray-900 shadow-sm ring-2 ring-gray-300'
                        : 'bg-[#F9F8F5] text-gray-800 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs mb-1">
                      <Users className="w-4 h-4" />
                      <span>عادی (رایگان)</span>
                    </div>
                    <div className={`text-[10px] leading-tight ${selectedTier === 'FREE' ? 'text-gray-300' : 'text-gray-500'}`}>
                      بدون اشتراک ویژه
                    </div>
                  </button>
                </div>
              </div>

              {/* Expiry Date (if Pro or Plus) */}
              {selectedTier !== 'FREE' && (
                <div className="space-y-2 p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-amber-700" />
                      <span>تاریخ انقضای اشتراک (شمسی):</span>
                    </label>
                    <span className="text-[11px] text-amber-800">تمدید سریع:</span>
                  </div>

                  <input
                    type="text"
                    required
                    placeholder="مثال: ۱۴۰۵/۱۲/۲۹"
                    value={customExpiry}
                    onChange={(e) => setCustomExpiry(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl border border-amber-300 bg-white text-gray-900 font-bold text-xs focus:outline-none focus:border-amber-600"
                  />

                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => handleQuickExtend(1)}
                      className="px-2.5 py-1 rounded-lg bg-white border border-amber-300 text-amber-900 text-[11px] font-bold hover:bg-amber-100 cursor-pointer"
                    >
                      + ۱ ماه
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickExtend(3)}
                      className="px-2.5 py-1 rounded-lg bg-white border border-amber-300 text-amber-900 text-[11px] font-bold hover:bg-amber-100 cursor-pointer"
                    >
                      + ۳ ماه
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickExtend(6)}
                      className="px-2.5 py-1 rounded-lg bg-white border border-amber-300 text-amber-900 text-[11px] font-bold hover:bg-amber-100 cursor-pointer"
                    >
                      + ۶ ماه
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickExtend(12)}
                      className="px-2.5 py-1 rounded-lg bg-white border border-amber-300 text-amber-900 text-[11px] font-bold hover:bg-amber-100 cursor-pointer"
                    >
                      + ۱ سال
                    </button>
                  </div>
                </div>
              )}

              {/* User Role */}
              <div className="space-y-1.5">
                <label className="block text-gray-800 font-black text-xs">
                  نقش دسترسی در سامانه:
                </label>
                <select
                  value={userRole}
                  onChange={(e) => setUserRole(e.target.value as UserRole)}
                  className="w-full px-4 py-2.5 rounded-xl border border-[#E6E1D5] bg-[#F9F8F5] focus:bg-white text-xs font-bold text-gray-800 focus:outline-none focus:border-[#2C4A2E]"
                >
                  <option value="USER">کاربر عادی و خریدار محصولات</option>
                  <option value="ADMIN">مدیر ارشد (دسترسی به پنل ادمین)</option>
                </select>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-5 py-2 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-100 text-xs font-bold transition-colors cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 rounded-xl bg-[#2C4A2E] text-white text-xs font-bold hover:bg-[#1E3520] shadow-md flex items-center gap-1.5 cursor-pointer transition-all"
                >
                  <Save className="w-4 h-4 text-[#D4A373]" />
                  <span>ذخیره تغییرات</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
