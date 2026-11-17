@echo off
chcp 65001 > nul
title سامانه مزارع ارگانیک پروفارم شیراز (ProFarm Shiraz)

:: رفتن به پوشه اصلی پروژه
cd /d "%~dp0"

echo ======================================================================
echo    سامانه جامع مزارع ارگانیک پروفارم شیراز (ProFarm Shiraz)
echo ======================================================================
echo.
echo [1/3] بررسی پیش‌نیازهای سیستم...

:: بررسی نصب بودن Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [خطا] نرم‌افزار Node.js روی سیستم شما یافت نشد!
    echo لطفاً ابتدا Node.js را از سایت https://nodejs.org دانلود و نصب فرمایید.
    echo.
    pause
    exit /b 1
)

:: بررسی پوشه node_modules
if not exist "node_modules\" (
    echo [2/3] پکیج‌های پروژه یافت نشد. در حال نصب وابستگی‌ها (npm install)...
    call npm install
    if %errorlevel% neq 0 (
        echo [خطا] در فرآیند نصب پکیج‌ها مشکلی رخ داد.
        pause
        exit /b 1
    )
) else (
    echo [2/3] پکیج‌های پروژه آماده هستند.
)

echo.
echo [3/3] در حال راه‌اندازی سرور لوکال هاست و باز کردن مرورگر...
echo.
echo آدرس اصلی سایت: http://localhost:3000
echo پنل مدیریت ادمین: http://localhost:3000/admin
echo برای توقف سرور می‌توانید کلیدهای Ctrl + C را فشار دهید.
echo [نکته امنیتی]: برای استقرار در اینترنت از دستور run-prod.bat استفاده نمایید.
echo ======================================================================
echo.

if "%1"=="prod" (
    call run-prod.bat
    exit /b %errorlevel%
)

:: باز کردن خودکار مرورگر بعد از ۴ ثانیه در پس‌زمینه
start "" /min cmd /c "ping -n 5 127.0.0.1 >nul & start http://localhost:3000"

:: اجرای سرور توسعه Next.js
call npm run dev

if %errorlevel% neq 0 (
    echo.
    echo [هشدار] اجرای سرور متوقف شد یا با خطا مواجه گردید.
    pause
)
