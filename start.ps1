# ======================================================================
# سامانه جامع مزارع ارگانیک پروفارم شیراز (ProFarm Shiraz) - اسکریپت پاورشل
# ======================================================================
param (
    [string]$Mode = "dev"
)

# Set UTF-8 encoding for Persian output
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Set-Location -Path $PSScriptRoot

Write-Host "======================================================================" -ForegroundColor Green
Write-Host "   سامانه جامع مزارع ارگانیک پروفارم شیراز (ProFarm Shiraz)" -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "[1/3] بررسی پیش‌نیازهای سیستم..." -ForegroundColor Yellow

# Check Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "[خطا] نرم‌افزار Node.js روی سیستم شما یافت نشد!" -ForegroundColor Red
    Write-Host "لطفاً ابتدا Node.js را از سایت https://nodejs.org دانلود و نصب فرمایید."
    Read-Host "برای خروج کلیدی را فشار دهید..."
    exit 1
}

# Check node_modules
if (-not (Test-Path "node_modules")) {
    Write-Host "[2/3] پکیج‌های پروژه یافت نشد. در حال نصب وابستگی‌ها (npm install)..." -ForegroundColor Yellow
    npm install
} else {
    Write-Host "[2/3] پکیج‌های پروژه آماده هستند." -ForegroundColor Cyan
}

Write-Host ""
Write-Host "[3/3] در حال راه‌اندازی سرور لوکال هاست..." -ForegroundColor Green
Write-Host "آدرس سایت: http://localhost:3000" -ForegroundColor White
Write-Host "آدرس پنل مدیریت: http://localhost:3000/admin" -ForegroundColor White
Write-Host "جهت توقف سرور کلیدهای Ctrl + C را بفشارید." -ForegroundColor DarkGray
Write-Host "======================================================================" -ForegroundColor Green
Write-Host ""

# Open default browser after 3 seconds asynchronously
Start-Job -ScriptBlock {
    Start-Sleep -Seconds 3
    Start-Process "http://localhost:3000"
} | Out-Null

if ($Mode -eq "prod" -or $Mode -eq "production") {
    Write-Host "[امنیت پروداکشن] در حال بیلد و اجرای پروداکشن Next.js..." -ForegroundColor Cyan
    $env:NODE_ENV = "production"
    npm run build
    npm run start
} else {
    Write-Host "[نکته امنیتی]: جهت انتشار در اینترنت از start.ps1 -Mode prod استفاده فرمایید." -ForegroundColor Yellow
    npm run dev
}
