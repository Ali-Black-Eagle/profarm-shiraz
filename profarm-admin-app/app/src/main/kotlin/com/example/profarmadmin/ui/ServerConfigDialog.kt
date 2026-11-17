package com.example.profarmadmin.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.profarmadmin.ui.theme.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.net.HttpURLConnection
import java.net.URL

@Composable
fun ServerConfigDialog(
    currentUrl: String,
    onDismiss: () -> Unit,
    onSave: (String) -> Unit
) {
    var inputUrl by remember { mutableStateOf(currentUrl) }
    var pingStatus by remember { mutableStateOf<String?>(null) }
    var isPinging by remember { mutableStateOf(false) }
    var isSuccess by remember { mutableStateOf(false) }
    var latencyMs by remember { mutableLongStateOf(0L) }
    val scope = rememberCoroutineScope()

    val presets = listOf(
        Triple("هات‌اسپات کامپیوتر", "http://10.145.79.221:3000", "📱"),
        Triple("کابل USB / لوکال", "http://localhost:3000", "💻"),
        Triple("سرور رسمی ابری", "https://profarm-shiraz.ir", "🌐")
    )

    AlertDialog(
        onDismissRequest = onDismiss,
        shape = RoundedCornerShape(26.dp),
        containerColor = Color.White,
        title = {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Box(
                    modifier = Modifier
                        .size(38.dp)
                        .background(ProfarmEmeraldContainer, CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Text("📡", fontSize = 20.sp)
                }
                Column {
                    Text(
                        text = "تنظیمات اتصال سرور",
                        fontWeight = FontWeight.Bold,
                        fontSize = 17.sp,
                        color = ProfarmForestDark
                    )
                    Text(
                        text = "پیکربندی شبکه محلی یا ابری",
                        fontSize = 11.sp,
                        color = ProfarmTextSecondary
                    )
                }
            }
        },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                Text(
                    text = "آدرس پورت سرور سایت را تعیین نمایید:",
                    fontSize = 12.sp,
                    color = ProfarmTextSecondary,
                    textAlign = TextAlign.Right,
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedTextField(
                    value = inputUrl,
                    onValueChange = {
                        inputUrl = it
                        pingStatus = null
                    },
                    label = { Text("آدرس سرور سایت", fontSize = 12.sp) },
                    leadingIcon = { Text("🌐", fontSize = 16.sp) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = ProfarmEmeraldPrimary,
                        unfocusedBorderColor = ProfarmBorderLight,
                        focusedContainerColor = ProfarmWarmWhite,
                        unfocusedContainerColor = ProfarmWarmWhite
                    )
                )

                Text(
                    text = "گزینه‌های پیشنهادی آماده:",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = ProfarmTextPrimary,
                    modifier = Modifier.fillMaxWidth()
                )

                // Presets Chips Grid
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    presets.forEach { (label, url, icon) ->
                        val isSelected = inputUrl.trimEnd('/') == url.trimEnd('/')
                        Surface(
                            onClick = {
                                inputUrl = url
                                pingStatus = null
                            },
                            shape = RoundedCornerShape(12.dp),
                            color = if (isSelected) ProfarmEmeraldContainer else ProfarmWarmWhite,
                            border = androidx.compose.foundation.BorderStroke(
                                1.dp,
                                if (isSelected) ProfarmEmeraldPrimary else ProfarmBorderLight
                            ),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    Text(icon, fontSize = 16.sp)
                                    Column {
                                        Text(
                                            text = label,
                                            fontSize = 12.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = if (isSelected) ProfarmForestDark else ProfarmTextPrimary
                                        )
                                        Text(
                                            text = url,
                                            fontSize = 10.sp,
                                            color = ProfarmTextSecondary,
                                            fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace
                                        )
                                    }
                                }
                                if (isSelected) {
                                    Text("✓", color = ProfarmEmeraldPrimary, fontWeight = FontWeight.Black)
                                }
                            }
                        }
                    }
                }

                // Ping Status Feedback
                if (pingStatus != null) {
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = if (isSuccess) Color(0xFFDCFCE7) else Color(0xFFFEE2E2),
                        border = androidx.compose.foundation.BorderStroke(
                            1.dp,
                            if (isSuccess) Color(0xFF86EFAC) else Color(0xFFFCA5A5)
                        ),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier.padding(10.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(8.dp)
                                    .background(if (isSuccess) ProfarmOnlineGreen else ProfarmDangerRed, CircleShape)
                            )
                            Text(
                                text = pingStatus!!,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                color = if (isSuccess) Color(0xFF166534) else Color(0xFF991B1B)
                            )
                        }
                    }
                }

                // Test Connection Button
                OutlinedButton(
                    onClick = {
                        isPinging = true
                        pingStatus = null
                        scope.launch {
                            val start = System.currentTimeMillis()
                            val ok = testConnection(inputUrl.trim())
                            val duration = System.currentTimeMillis() - start
                            withContext(Dispatchers.Main) {
                                isPinging = false
                                isSuccess = ok
                                latencyMs = duration
                                pingStatus = if (ok) {
                                    "✓ ارتباط موفقیت‌آمیز است (زمان پاسخ: $duration میلی‌ثانیه)"
                                } else {
                                    "✗ سرور پاسخ نداد. هات‌اسپات و اجرای سایت را بررسی کنید."
                                }
                            }
                        }
                    },
                    enabled = !isPinging,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.outlinedButtonColors(
                        contentColor = ProfarmEmeraldPrimary
                    )
                ) {
                    if (isPinging) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(16.dp),
                            strokeWidth = 2.dp,
                            color = ProfarmEmeraldPrimary
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("در حال بررسی اتصال...", fontSize = 12.sp)
                    } else {
                        Text("⚡ تست زنده اتصال به این آدرس", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val clean = inputUrl.trim().trimEnd('/')
                    if (clean.isNotBlank()) {
                        onSave(clean)
                    }
                },
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = ProfarmEmeraldPrimary)
            ) {
                Text("ذخیره و اعمال", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 12.sp)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("انصراف", color = ProfarmTextSecondary, fontSize = 12.sp)
            }
        }
    )
}

/**
 * Pings the given URL to verify connectivity
 */
private suspend fun testConnection(urlStr: String): Boolean = withContext(Dispatchers.IO) {
    try {
        val target = if (!urlStr.startsWith("http://") && !urlStr.startsWith("https://")) {
            "http://$urlStr"
        } else {
            urlStr
        }
        val url = URL(target)
        val conn = (url.openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = 3500
            readTimeout = 3500
            instanceFollowRedirects = true
        }
        val code = conn.responseCode
        conn.disconnect()
        code in 200..399
    } catch (_: Exception) {
        false
    }
}
