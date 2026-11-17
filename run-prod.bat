@echo off
chcp 65001 >nul
title ProFarm Shiraz - Production Server

echo ======================================================================
echo           پرو فارم شیراز - اجرای امن سرور در محیط پروداکشن
echo ======================================================================
echo.
echo [نکته امنیتی مهم]:
echo در این حالت، کوکی‌های نشست با پرچم Secure و هدرهای HSTS فعال می‌شوند
echo و رمزهای پیش‌فرض و داده‌های تستی به هیچ عنوان بارگذاری نخواهند شد.
echo ======================================================================
echo.

:: 1. بررسی Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [خطا] نرم‌افزار Node.js بر روی سیستم شما نصب نیست.
    pause
    exit /b 1
)

:: 2. بررسی پکیج‌ها
if not exist "node_modules\" (
    echo [1/3] در حال نصب وابستگی‌های پروژه...
    call npm install --omit=dev
)

:: 3. بیلد پروژه
echo [2/3] در حال بیلد بهینه و امن پروداکشن Next.js...
set NODE_ENV=production
call npm run build

if %errorlevel% neq 0 (
    echo.
    echo [خطا] فرآیند بیلد با خطا مواجه شد.
    pause
    exit /b 1
)

echo.
echo [3/3] در حال راه‌اندازی سرور رسمی پروداکشن روی پورت ۳۰۰۰...
echo آدرس سایت: http://localhost:3000
echo آدرس پنل مدیریت: http://localhost:3000/admin
echo ======================================================================
echo.

start "" /min cmd /c "ping -n 4 127.0.0.1 >nul & start http://localhost:3000"
call npm run start
