package com.example.profarmadmin.ui

import android.annotation.SuppressLint
import android.app.Activity
import android.app.DownloadManager
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.print.PrintAttributes
import android.print.PrintManager
import android.provider.MediaStore
import android.util.Base64
import android.view.ViewGroup
import android.webkit.*
import android.widget.Toast
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import com.example.profarmadmin.data.AdminPreferences
import com.example.profarmadmin.ui.theme.*
import java.io.File

/**
 * JavaScript interface injected into the WebView to handle native Android
 * PDF printing and base64 file downloads (Excel/CSV/PDF).
 */
class ProfarmWebAppInterface(
    private val activity: Activity,
    private val webView: WebView
) {
    @JavascriptInterface
    fun printPage() {
        activity.runOnUiThread {
            try {
                val printManager = activity.getSystemService(Context.PRINT_SERVICE) as? PrintManager
                if (printManager != null) {
                    val jobName = "Profarm_Doc_${System.currentTimeMillis()}"
                    val printAdapter = webView.createPrintDocumentAdapter(jobName)
                    printManager.print(jobName, printAdapter, PrintAttributes.Builder().build())
                } else {
                    Toast.makeText(activity, "سرویس چاپ در این دستگاه در دسترس نیست", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Toast.makeText(activity, "خطا در پرینت: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }

    @JavascriptInterface
    fun saveBase64File(base64Data: String, filename: String, mimeType: String) {
        activity.runOnUiThread {
            saveDataToDownloads(activity, base64Data, filename, mimeType)
        }
    }
}

/**
 * Saves base64 encoded data to public Downloads folder and launches view intent.
 */
fun saveDataToDownloads(
    context: Context,
    base64Data: String,
    filename: String,
    mimeType: String
) {
    try {
        val cleanBase64 = if (base64Data.contains(",")) {
            base64Data.substringAfter(",")
        } else {
            base64Data
        }
        val bytes = Base64.decode(cleanBase64, Base64.DEFAULT)

        val cleanMime = when {
            filename.endsWith(".csv", ignoreCase = true) -> "text/csv"
            filename.endsWith(".xlsx", ignoreCase = true) -> "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            filename.endsWith(".pdf", ignoreCase = true) -> "application/pdf"
            mimeType.isNotBlank() -> mimeType
            else -> "application/octet-stream"
        }

        val resolver = context.contentResolver
        val contentValues = ContentValues().apply {
            put(MediaStore.MediaColumns.DISPLAY_NAME, filename)
            put(MediaStore.MediaColumns.MIME_TYPE, cleanMime)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
                put(MediaStore.MediaColumns.IS_PENDING, 1)
            }
        }

        val uri = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, contentValues)
        } else {
            val file = File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), filename)
            file.writeBytes(bytes)
            Uri.fromFile(file)
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && uri != null) {
            resolver.openOutputStream(uri)?.use { os ->
                os.write(bytes)
            }
            contentValues.clear()
            contentValues.put(MediaStore.MediaColumns.IS_PENDING, 0)
            resolver.update(uri, contentValues, null, null)
        }

        Toast.makeText(context, "فایل $filename در دانلودها ذخیره شد", Toast.LENGTH_LONG).show()

        if (uri != null) {
            try {
                val openIntent = Intent(Intent.ACTION_VIEW).apply {
                    setDataAndType(uri, cleanMime)
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(Intent.createChooser(openIntent, "باز کردن فایل"))
            } catch (_: Exception) {}
        }
    } catch (e: Exception) {
        Toast.makeText(context, "خطا در ذخیره فایل: ${e.message}", Toast.LENGTH_SHORT).show()
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@SuppressLint("SetJavaScriptEnabled")
@Composable
fun AdminWebScreen(
    prefs: AdminPreferences,
    onLogout: () -> Unit,
    onOpenServerConfig: () -> Unit
) {
    val context = LocalContext.current
    val activity = context as? Activity

    var webViewInstance by remember { mutableStateOf<WebView?>(null) }
    var currentUrl by remember { mutableStateOf("${prefs.getAdminDashboardUrl()}?in_app=1") }
    var isLoading by remember { mutableStateOf(true) }
    var loadProgress by remember { mutableIntStateOf(0) }
    var hasError by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf("") }
    var canGoBack by remember { mutableStateOf(false) }

    var showMoreBottomSheet by remember { mutableStateOf(false) }
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    // File upload callback for WebChromeClient (product photos)
    var filePathCallback by remember { mutableStateOf<ValueCallback<Array<Uri>>?>(null) }
    val filePickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            val data = result.data
            val uris = if (data?.clipData != null) {
                val count = data.clipData!!.itemCount
                Array(count) { i -> data.clipData!!.getItemAt(i).uri }
            } else if (data?.data != null) {
                arrayOf(data.data!!)
            } else {
                null
            }
            filePathCallback?.onReceiveValue(uris)
        } else {
            filePathCallback?.onReceiveValue(null)
        }
        filePathCallback = null
    }

    // Physical Back Button navigation
    BackHandler(enabled = canGoBack) {
        webViewInstance?.goBack()
    }

    val base = prefs.serverUrl.trimEnd('/')

    Scaffold(
        topBar = {
            Surface(
                color = ProfarmForestDark,
                shadowElevation = 6.dp
            ) {
                Column {
                    TopAppBar(
                        title = {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                // Live Pulsing Status Dot
                                Box(
                                    contentAlignment = Alignment.Center,
                                    modifier = Modifier.size(16.dp)
                                ) {
                                    Box(
                                        modifier = Modifier
                                            .size(16.dp)
                                            .background(
                                                if (hasError) Color(0x33EF4444) else Color(0x3310B981),
                                                CircleShape
                                            )
                                    )
                                    Box(
                                        modifier = Modifier
                                            .size(8.dp)
                                            .background(
                                                if (hasError) ProfarmDangerRed else ProfarmOnlineGreen,
                                                CircleShape
                                            )
                                    )
                                }

                                Column {
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                                    ) {
                                        Text(
                                            text = "پروفارم شیراز",
                                            fontSize = 15.sp,
                                            fontWeight = FontWeight.Black,
                                            color = Color.White
                                        )
                                        Text(
                                            text = "🌱",
                                            fontSize = 13.sp
                                        )
                                    }
                                    Text(
                                        text = if (hasError) "عدم دسترسی به سرور" else "پنل مدیریت مزارع",
                                        fontSize = 10.sp,
                                        color = if (hasError) Color(0xFFFCA5A5) else ProfarmGoldLight,
                                        fontWeight = FontWeight.Medium
                                    )
                                }
                            }
                        },
                        actions = {
                            // Quick Print Action Button
                            IconButton(
                                onClick = {
                                    activity?.let { act ->
                                        val printManager = act.getSystemService(Context.PRINT_SERVICE) as? PrintManager
                                        val jobName = "Profarm_Print_${System.currentTimeMillis()}"
                                        val printAdapter = webViewInstance?.createPrintDocumentAdapter(jobName)
                                        if (printManager != null && printAdapter != null) {
                                            printManager.print(jobName, printAdapter, PrintAttributes.Builder().build())
                                        }
                                    }
                                },
                                modifier = Modifier
                                    .padding(horizontal = 2.dp)
                                    .size(36.dp)
                                    .background(Color(0x22FFFFFF), CircleShape)
                            ) {
                                Icon(
                                    imageVector = Icons.Rounded.Print,
                                    contentDescription = "چاپ فاکتور",
                                    tint = Color.White,
                                    modifier = Modifier.size(18.dp)
                                )
                            }

                            // Reload Action Button
                            IconButton(
                                onClick = { webViewInstance?.reload() },
                                modifier = Modifier
                                    .padding(horizontal = 2.dp)
                                    .size(36.dp)
                                    .background(Color(0x22FFFFFF), CircleShape)
                            ) {
                                Icon(
                                    imageVector = Icons.Rounded.Refresh,
                                    contentDescription = "بروزرسانی",
                                    tint = Color.White,
                                    modifier = Modifier.size(18.dp)
                                )
                            }

                            // Server Settings Action Button
                            IconButton(
                                onClick = onOpenServerConfig,
                                modifier = Modifier
                                    .padding(horizontal = 2.dp)
                                    .size(36.dp)
                                    .background(Color(0x22FFFFFF), CircleShape)
                            ) {
                                Icon(
                                    imageVector = Icons.Rounded.Settings,
                                    contentDescription = "تنظیمات سرور",
                                    tint = Color.White,
                                    modifier = Modifier.size(18.dp)
                                )
                            }

                            // Logout Action Button
                            IconButton(
                                onClick = {
                                    prefs.clearSession()
                                    CookieManager.getInstance().removeAllCookies(null)
                                    onLogout()
                                },
                                modifier = Modifier
                                    .padding(horizontal = 2.dp)
                                    .size(36.dp)
                                    .background(Color(0x22FFFFFF), CircleShape)
                            ) {
                                Icon(
                                    imageVector = Icons.Rounded.Logout,
                                    contentDescription = "خروج",
                                    tint = Color.White,
                                    modifier = Modifier.size(18.dp)
                                )
                            }
                        },
                        colors = TopAppBarDefaults.topAppBarColors(
                            containerColor = ProfarmForestDark
                        )
                    )

                    // Fine Golden Baseline
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(1.5.dp)
                            .background(
                                Brush.horizontalGradient(
                                    listOf(ProfarmGoldPrimary, ProfarmEmeraldPrimary, ProfarmGoldPrimary)
                                )
                            )
                    )
                }
            }
        },
        bottomBar = {
            Surface(
                shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp),
                color = Color.White,
                shadowElevation = 14.dp,
                border = androidx.compose.foundation.BorderStroke(1.dp, ProfarmBorderLight)
            ) {
                NavigationBar(
                    containerColor = Color.Transparent,
                    tonalElevation = 0.dp,
                    modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp)
                ) {
                    // 1. Dashboard
                    val isDashboard = currentUrl.endsWith("/admin") || currentUrl.endsWith("/admin/") || currentUrl.contains("/admin?in_app=1")
                    NavigationBarItem(
                        selected = isDashboard,
                        onClick = {
                            val target = "$base/admin?in_app=1"
                            currentUrl = target
                            webViewInstance?.loadUrl(target)
                        },
                        icon = {
                            Icon(
                                imageVector = Icons.Rounded.SpaceDashboard,
                                contentDescription = "داشبورد",
                                modifier = Modifier.size(22.dp)
                            )
                        },
                        label = { Text("داشبورد", fontSize = 11.sp, fontWeight = FontWeight.Bold) },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = ProfarmForestDark,
                            selectedTextColor = ProfarmForestDark,
                            indicatorColor = ProfarmEmeraldContainer,
                            unselectedIconColor = ProfarmTextSecondary,
                            unselectedTextColor = ProfarmTextSecondary
                        )
                    )

                    // 2. Orders
                    val isOrders = currentUrl.contains("/admin/orders")
                    NavigationBarItem(
                        selected = isOrders,
                        onClick = {
                            val target = "$base/admin/orders?in_app=1"
                            currentUrl = target
                            webViewInstance?.loadUrl(target)
                        },
                        icon = {
                            Icon(
                                imageVector = Icons.Rounded.ShoppingBag,
                                contentDescription = "سفارش‌ها",
                                modifier = Modifier.size(22.dp)
                            )
                        },
                        label = { Text("سفارش‌ها", fontSize = 11.sp, fontWeight = FontWeight.Bold) },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = ProfarmForestDark,
                            selectedTextColor = ProfarmForestDark,
                            indicatorColor = ProfarmEmeraldContainer,
                            unselectedIconColor = ProfarmTextSecondary,
                            unselectedTextColor = ProfarmTextSecondary
                        )
                    )

                    // 3. Shiraz Courier Manifest
                    val isManifest = currentUrl.contains("/admin/manifest")
                    NavigationBarItem(
                        selected = isManifest,
                        onClick = {
                            val target = "$base/admin/manifest?in_app=1"
                            currentUrl = target
                            webViewInstance?.loadUrl(target)
                        },
                        icon = {
                            Icon(
                                imageVector = Icons.Rounded.LocalShipping,
                                contentDescription = "پیک شیراز",
                                modifier = Modifier.size(22.dp)
                            )
                        },
                        label = { Text("پیک شیراز", fontSize = 11.sp, fontWeight = FontWeight.Bold) },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = ProfarmForestDark,
                            selectedTextColor = ProfarmForestDark,
                            indicatorColor = ProfarmEmeraldContainer,
                            unselectedIconColor = ProfarmTextSecondary,
                            unselectedTextColor = ProfarmTextSecondary
                        )
                    )

                    // 4. Products
                    val isProducts = currentUrl.contains("/admin/products")
                    NavigationBarItem(
                        selected = isProducts,
                        onClick = {
                            val target = "$base/admin/products?in_app=1"
                            currentUrl = target
                            webViewInstance?.loadUrl(target)
                        },
                        icon = {
                            Icon(
                                imageVector = Icons.Rounded.Storefront,
                                contentDescription = "محصولات",
                                modifier = Modifier.size(22.dp)
                            )
                        },
                        label = { Text("محصولات", fontSize = 11.sp, fontWeight = FontWeight.Bold) },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = ProfarmForestDark,
                            selectedTextColor = ProfarmForestDark,
                            indicatorColor = ProfarmEmeraldContainer,
                            unselectedIconColor = ProfarmTextSecondary,
                            unselectedTextColor = ProfarmTextSecondary
                        )
                    )

                    // 5. More Modules & Tools
                    NavigationBarItem(
                        selected = showMoreBottomSheet,
                        onClick = {
                            showMoreBottomSheet = true
                        },
                        icon = {
                            Icon(
                                imageVector = Icons.Rounded.GridView,
                                contentDescription = "بیشتر",
                                modifier = Modifier.size(22.dp)
                            )
                        },
                        label = { Text("بیشتر", fontSize = 11.sp, fontWeight = FontWeight.Bold) },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = ProfarmForestDark,
                            selectedTextColor = ProfarmForestDark,
                            indicatorColor = ProfarmGoldContainer,
                            unselectedIconColor = ProfarmTextSecondary,
                            unselectedTextColor = ProfarmTextSecondary
                        )
                    )
                }
            }
        }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .background(ProfarmWarmWhite)
        ) {
            // Main WebView with Native Print & File Download Bridge
            AndroidView(
                modifier = Modifier.fillMaxSize(),
                factory = { ctx ->
                    WebView(ctx).apply {
                        layoutParams = ViewGroup.LayoutParams(
                            ViewGroup.LayoutParams.MATCH_PARENT,
                            ViewGroup.LayoutParams.MATCH_PARENT
                        )

                        settings.apply {
                            javaScriptEnabled = true
                            domStorageEnabled = true
                            allowFileAccess = true
                            allowContentAccess = true
                            loadWithOverviewMode = true
                            useWideViewPort = true
                            setSupportZoom(true)
                            builtInZoomControls = true
                            displayZoomControls = false
                            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                            userAgentString = "$userAgentString ProfarmAdminApp/1.0"
                        }

                        // Connect Javascript Bridge for printing and file downloads
                        activity?.let { act ->
                            addJavascriptInterface(ProfarmWebAppInterface(act, this), "AndroidBridge")
                        }

                        // Ensure cookies are properly synced
                        val webView = this
                        CookieManager.getInstance().apply {
                            setAcceptCookie(true)
                            setAcceptThirdPartyCookies(webView, true)
                            prefs.sessionToken.takeIf { it.isNotBlank() }?.let { token ->
                                setCookie(prefs.serverUrl, token)
                            }
                            flush()
                        }

                        // Handle file downloads
                        setDownloadListener { url, userAgent, contentDisposition, mimetype, _ ->
                            if (url.startsWith("data:")) {
                                try {
                                    val commaIndex = url.indexOf(',')
                                    if (commaIndex != -1) {
                                        val meta = url.substring(5, commaIndex)
                                        val rawData = url.substring(commaIndex + 1)
                                        val isB64 = meta.contains(";base64")
                                        val cleanMime = if (meta.contains(";")) meta.substringBefore(";") else if (meta.isNotBlank()) meta else "text/csv"
                                        val b64 = if (isB64) rawData else Base64.encodeToString(Uri.decode(rawData).toByteArray(Charsets.UTF_8), Base64.NO_WRAP)
                                        val ext = if (cleanMime.contains("csv")) ".csv" else if (cleanMime.contains("sheet") || cleanMime.contains("excel")) ".xlsx" else if (cleanMime.contains("pdf")) ".pdf" else ".csv"
                                        val filename = "profarm_export_${System.currentTimeMillis()}$ext"
                                        saveDataToDownloads(ctx, b64, filename, cleanMime)
                                    }
                                } catch (e: Exception) {
                                    Toast.makeText(ctx, "خطا در پردازش فایل: ${e.message}", Toast.LENGTH_SHORT).show()
                                }
                            } else if (url.startsWith("blob:")) {
                                val jsSnippet = """
                                    (function(bUrl) {
                                        fetch(bUrl)
                                            .then(function(r) { return r.blob(); })
                                            .then(function(b) {
                                                var reader = new FileReader();
                                                reader.onloadend = function() {
                                                    if (window.AndroidBridge && window.AndroidBridge.saveBase64File) {
                                                        window.AndroidBridge.saveBase64File(reader.result, 'profarm_export_' + Date.now() + '.csv', b.type || 'text/csv');
                                                    }
                                                };
                                                reader.readAsDataURL(b);
                                            })
                                            .catch(function(e) { console.error('Blob fetch failed', e); });
                                    })('$url');
                                """.trimIndent()
                                evaluateJavascript(jsSnippet, null)
                            } else {
                                try {
                                    val request = DownloadManager.Request(Uri.parse(url)).apply {
                                        setMimeType(mimetype)
                                        addRequestHeader("User-Agent", userAgent)
                                        val cookie = CookieManager.getInstance().getCookie(url)
                                        if (!cookie.isNullOrBlank()) {
                                            addRequestHeader("Cookie", cookie)
                                        }
                                        setTitle("پروفارم | دانلود فایل")
                                        setDescription("در حال دانلود...")
                                        setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                                        val guessedFilename = URLUtil.guessFileName(url, contentDisposition, mimetype)
                                        setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, guessedFilename)
                                    }
                                    val dm = ctx.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
                                    dm.enqueue(request)
                                    Toast.makeText(ctx, "شروع دانلود فایل...", Toast.LENGTH_SHORT).show()
                                } catch (e: Exception) {
                                    Toast.makeText(ctx, "خطا در دانلود فایل: ${e.message}", Toast.LENGTH_SHORT).show()
                                }
                            }
                        }

                        webViewClient = object : WebViewClient() {
                            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                                isLoading = true
                                hasError = false
                                url?.let {
                                    currentUrl = it
                                    canGoBack = view?.canGoBack() ?: false
                                }

                                // Immediately inject class to prevent flash of duplicate web chrome
                                view?.evaluateJavascript("""
                                    document.documentElement.classList.add('in-profarm-app');
                                """.trimIndent(), null)
                            }

                            override fun onPageFinished(view: WebView?, url: String?) {
                                isLoading = false
                                url?.let {
                                    currentUrl = it
                                    canGoBack = view?.canGoBack() ?: false
                                }
                                CookieManager.getInstance().flush()

                                val hideWebDuplicateChrome = """
                                    document.documentElement.classList.add('in-profarm-app');
                                    var selectors = ['header[data-admin-mobile-header]', 'nav[data-admin-mobile-nav]', 'header.md\\:hidden', 'nav.md\\:hidden'];
                                    selectors.forEach(function(s) {
                                        var el = document.querySelector(s);
                                        if (el) el.style.display = 'none';
                                    });
                                """.trimIndent()
                                view?.evaluateJavascript(hideWebDuplicateChrome, null)

                                val printShim = """
                                    if (!window.__profarmPrintShim) {
                                        window.__profarmPrintShim = true;
                                        var prevPrint = window.print;
                                        window.print = function() {
                                            if (window.AndroidBridge && window.AndroidBridge.printPage) {
                                                window.AndroidBridge.printPage();
                                            } else if (prevPrint) {
                                                prevPrint();
                                            }
                                        };
                                    }
                                """.trimIndent()
                                view?.evaluateJavascript(printShim, null)
                            }

                            override fun onReceivedError(
                                view: WebView?,
                                request: WebResourceRequest?,
                                error: WebResourceError?
                            ) {
                                if (request?.isForMainFrame == true) {
                                    hasError = true
                                    isLoading = false
                                    errorMessage = error?.description?.toString() ?: "خطا در اتصال به سرور"
                                }
                            }
                        }

                        webChromeClient = object : WebChromeClient() {
                            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                                loadProgress = newProgress
                            }

                            override fun onShowFileChooser(
                                webView: WebView?,
                                filePathCallbackInternal: ValueCallback<Array<Uri>>?,
                                fileChooserParams: FileChooserParams?
                            ): Boolean {
                                filePathCallback?.onReceiveValue(null)
                                filePathCallback = filePathCallbackInternal
                                val intent = fileChooserParams?.createIntent() ?: Intent(Intent.ACTION_GET_CONTENT).apply {
                                    type = "image/*"
                                }
                                filePickerLauncher.launch(intent)
                                return true
                            }
                        }

                        webViewInstance = this
                        loadUrl("${prefs.getAdminDashboardUrl()}?in_app=1")
                    }
                },
                update = { wv ->
                    webViewInstance = wv
                }
            )

            // Luxury Gradient Progress Bar
            if (isLoading && loadProgress < 100) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(3.5.dp)
                        .background(Color(0x22D4AF37))
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth(fraction = (loadProgress / 100f).coerceIn(0f, 1f))
                            .fillMaxHeight()
                            .background(
                                Brush.horizontalGradient(
                                    listOf(ProfarmEmeraldPrimary, ProfarmGoldPrimary)
                                )
                            )
                    )
                }
            }

            // Connection Error / Offline Screen
            if (hasError) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(ProfarmWarmWhite)
                        .padding(24.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Card(
                        shape = RoundedCornerShape(26.dp),
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        border = androidx.compose.foundation.BorderStroke(1.5.dp, Color(0x33EF4444)),
                        elevation = CardDefaults.cardElevation(defaultElevation = 8.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(26.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(16.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(72.dp)
                                    .background(Color(0xFFFEE2E2), CircleShape),
                                contentAlignment = Alignment.Center
                            ) {
                                Text("📡", fontSize = 36.sp)
                            }

                            Text(
                                text = "عدم برقراری ارتباط با سرور کامپیوتر",
                                fontSize = 17.sp,
                                fontWeight = FontWeight.Bold,
                                color = ProfarmForestDark,
                                textAlign = TextAlign.Center
                            )

                            Text(
                                text = "آدرس سرور فعلی: ${prefs.serverUrl}\n\nلطفاً اطمینان حاصل فرمایید:\n۱. هات‌اسپات گوشی فعال و کامپیوتر به آن وصل است.\n۲. سرور سایت روی سیستم شما در حال اجراست.",
                                fontSize = 12.sp,
                                color = ProfarmTextSecondary,
                                textAlign = TextAlign.Right,
                                lineHeight = 19.sp,
                                modifier = Modifier.fillMaxWidth()
                            )

                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                Button(
                                    onClick = {
                                        hasError = false
                                        webViewInstance?.loadUrl("${prefs.getAdminDashboardUrl()}?in_app=1")
                                    },
                                    modifier = Modifier.weight(1f),
                                    shape = RoundedCornerShape(14.dp),
                                    colors = ButtonDefaults.buttonColors(containerColor = ProfarmEmeraldPrimary)
                                ) {
                                    Text("تلاش مجدد 🔄", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                                }
                                OutlinedButton(
                                    onClick = onOpenServerConfig,
                                    modifier = Modifier.weight(1f),
                                    shape = RoundedCornerShape(14.dp),
                                    colors = ButtonDefaults.outlinedButtonColors(contentColor = ProfarmForestDark)
                                ) {
                                    Text("تغییر آی‌پی ⚙️", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                                }
                            }
                        }
                    }
                }
            }
        }

        // Expanded BottomSheet with All 12 Admin Modules with Material Vector Icons
        if (showMoreBottomSheet) {
            ModalBottomSheet(
                onDismissRequest = { showMoreBottomSheet = false },
                sheetState = sheetState,
                containerColor = Color.White,
                shape = RoundedCornerShape(topStart = 28.dp, topEnd = 28.dp)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp)
                        .padding(bottom = 32.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    // Sheet Header with Admin Profile Badge
                    Surface(
                        shape = RoundedCornerShape(18.dp),
                        color = ProfarmEmeraldContainer,
                        border = androidx.compose.foundation.BorderStroke(1.dp, ProfarmEmeraldBorder),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier.padding(14.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                                ) {
                                    Text("مدیریت جامع مزارع شیراز", fontWeight = FontWeight.Black, fontSize = 15.sp, color = ProfarmForestDark)
                                    Text("🌱", fontSize = 14.sp)
                                }
                                Text(
                                    text = "دسترسی یک‌لمسی به کلیه بخش‌های سیستم",
                                    fontSize = 11.sp,
                                    color = ProfarmForestMedium
                                )
                            }
                            Surface(
                                shape = RoundedCornerShape(10.dp),
                                color = ProfarmGoldContainer
                            ) {
                                Text(
                                    text = "مدیر ارشد",
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = ProfarmGoldMuted,
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                                )
                            }
                        }
                    }

                    // Grid of all admin modules with Material Vector Icons
                    data class AdminModuleItem(val title: String, val path: String, val icon: ImageVector)

                    val modules = listOf(
                        AdminModuleItem("گزارشات مالی", "/admin/finance", Icons.Rounded.AccountBalanceWallet),
                        AdminModuleItem("کدهای تخفیف", "/admin/coupons", Icons.Rounded.LocalOffer),
                        AdminModuleItem("اشتراک‌های دوره‌ای", "/admin/subscriptions", Icons.Rounded.Autorenew),
                        AdminModuleItem("مشتریان و خریداران", "/admin/users", Icons.Rounded.People),
                        AdminModuleItem("دیدگاه‌های خریداران", "/admin/reviews", Icons.Rounded.Star),
                        AdminModuleItem("سامانه پیامک", "/admin/sms", Icons.Rounded.Sms),
                        AdminModuleItem("تغییر گروهی قیمت", "/admin/bulk", Icons.Rounded.Bolt),
                        AdminModuleItem("بنرها و محتوا", "/admin/cms", Icons.Rounded.EditNote),
                        AdminModuleItem("درگاه پرداخت", "/admin/payment", Icons.Rounded.CreditCard),
                    )

                    modules.chunked(3).forEach { rowItems ->
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            rowItems.forEach { (title, path, icon) ->
                                val isSelected = currentUrl.contains(path)
                                Card(
                                    modifier = Modifier
                                        .weight(1f)
                                        .clickable {
                                            val target = "$base$path?in_app=1"
                                            currentUrl = target
                                            webViewInstance?.loadUrl(target)
                                            showMoreBottomSheet = false
                                        },
                                    shape = RoundedCornerShape(16.dp),
                                    colors = CardDefaults.cardColors(
                                        containerColor = if (isSelected) ProfarmEmeraldContainer else ProfarmWarmWhite
                                    ),
                                    border = androidx.compose.foundation.BorderStroke(
                                        1.dp,
                                        if (isSelected) ProfarmEmeraldPrimary else ProfarmBorderLight
                                    ),
                                    elevation = CardDefaults.cardElevation(defaultElevation = if (isSelected) 3.dp else 1.dp)
                                ) {
                                    Column(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(vertical = 12.dp, horizontal = 4.dp),
                                        horizontalAlignment = Alignment.CenterHorizontally,
                                        verticalArrangement = Arrangement.spacedBy(6.dp)
                                    ) {
                                        Icon(
                                            imageVector = icon,
                                            contentDescription = title,
                                            tint = if (isSelected) ProfarmForestDark else ProfarmEmeraldPrimary,
                                            modifier = Modifier.size(24.dp)
                                        )
                                        Text(
                                            text = title,
                                            fontSize = 11.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = if (isSelected) ProfarmForestDark else ProfarmTextPrimary,
                                            textAlign = TextAlign.Center,
                                            maxLines = 1
                                        )
                                    }
                                }
                            }
                        }
                    }

                    HorizontalDivider(color = ProfarmBorderLight)

                    // Utility Actions Bar at the bottom
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        OutlinedButton(
                            onClick = {
                                showMoreBottomSheet = false
                                activity?.let { act ->
                                    val printManager = act.getSystemService(Context.PRINT_SERVICE) as? PrintManager
                                    val jobName = "Profarm_Print_${System.currentTimeMillis()}"
                                    val printAdapter = webViewInstance?.createPrintDocumentAdapter(jobName)
                                    if (printManager != null && printAdapter != null) {
                                        printManager.print(jobName, printAdapter, PrintAttributes.Builder().build())
                                    }
                                }
                            },
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Icon(Icons.Rounded.Print, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("چاپ سند", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }

                        OutlinedButton(
                            onClick = {
                                showMoreBottomSheet = false
                                webViewInstance?.reload()
                            },
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Icon(Icons.Rounded.Refresh, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("رفرش", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }

                        OutlinedButton(
                            onClick = {
                                showMoreBottomSheet = false
                                onOpenServerConfig()
                            },
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Icon(Icons.Rounded.Settings, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("تنظیمات", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    }
}
