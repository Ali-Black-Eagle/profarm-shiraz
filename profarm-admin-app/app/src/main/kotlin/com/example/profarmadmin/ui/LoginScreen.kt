package com.example.profarmadmin.ui

import android.webkit.CookieManager
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.profarmadmin.data.AdminPreferences
import com.example.profarmadmin.ui.theme.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

@Composable
fun LoginScreen(
    prefs: AdminPreferences,
    onLoginSuccess: () -> Unit,
    onOpenServerConfig: () -> Unit
) {
    var phone by remember { mutableStateOf(prefs.savedPhone) }
    var password by remember { mutableStateOf(prefs.savedPassword) }
    var rememberMe by remember { mutableStateOf(prefs.rememberMe) }
    var isPasswordVisible by remember { mutableStateOf(false) }
    var isLoading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    colors = listOf(
                        ProfarmForestDark,
                        ProfarmForestMedium,
                        ProfarmWarmWhite,
                        ProfarmWarmWhite
                    ),
                    startY = 0f,
                    endY = 1200f
                )
            )
    ) {
        // Decorative background aura circle
        Box(
            modifier = Modifier
                .size(340.dp)
                .align(Alignment.TopCenter)
                .offset(y = (-60).dp)
                .background(
                    Brush.radialGradient(
                        colors = listOf(
                            Color(0x33D4AF37),
                            Color(0x152E6934),
                            Color.Transparent
                        )
                    ),
                    CircleShape
                )
        )

        Column(
            modifier = Modifier
                .fillMaxSize()
                .statusBarsPadding()
                .navigationBarsPadding()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp, vertical = 20.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Spacer(modifier = Modifier.height(16.dp))

            // Brand Hero Section
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier
                    .size(92.dp)
                    .background(
                        Brush.linearGradient(
                            colors = listOf(ProfarmForestDark, ProfarmEmeraldPrimary)
                        ),
                        CircleShape
                    )
                    .border(2.5.dp, Brush.linearGradient(listOf(ProfarmGoldPrimary, ProfarmGoldLight)), CircleShape)
            ) {
                // Secondary inner glow
                Box(
                    modifier = Modifier
                        .size(76.dp)
                        .background(Color(0x22D4AF37), CircleShape)
                )
                Text(
                    text = "🌱",
                    fontSize = 44.sp
                )
            }

            Spacer(modifier = Modifier.height(14.dp))

            Text(
                text = "مزارع ارگانیک پروفارم شیراز",
                fontSize = 22.sp,
                fontWeight = FontWeight.Black,
                color = Color.White,
                textAlign = TextAlign.Center
            )

            Spacer(modifier = Modifier.height(4.dp))

            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                Text(
                    text = "سامانه یکپارچه مدیریت و لجستیک",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Medium,
                    color = ProfarmGoldLight,
                    textAlign = TextAlign.Center
                )
                Box(
                    modifier = Modifier
                        .size(5.dp)
                        .background(ProfarmGoldPrimary, CircleShape)
                )
                Text(
                    text = "نسخه ۲.۰",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White.copy(alpha = 0.8f)
                )
            }

            Spacer(modifier = Modifier.height(28.dp))

            // Luxury Card Container
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(28.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                border = androidx.compose.foundation.BorderStroke(1.5.dp, Color(0x26D4AF37)),
                elevation = CardDefaults.cardElevation(defaultElevation = 10.dp)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(26.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    // Header Pill
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = ProfarmEmeraldContainer
                    ) {
                        Text(
                            text = "ورود اختصاصی مدیر ارشد 🔐",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = ProfarmForestDark,
                            modifier = Modifier.padding(horizontal = 14.dp, vertical = 6.dp)
                        )
                    }

                    // Error Banner
                    if (errorMessage != null) {
                        Surface(
                            shape = RoundedCornerShape(14.dp),
                            color = Color(0xFFFEE2E2),
                            border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFFCA5A5)),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Row(
                                modifier = Modifier.padding(12.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Text("⚠️", fontSize = 16.sp)
                                Text(
                                    text = errorMessage!!,
                                    fontSize = 12.sp,
                                    color = Color(0xFFB91C1C),
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.weight(1f)
                                )
                            }
                        }
                    }

                    // Phone Input
                    OutlinedTextField(
                        value = phone,
                        onValueChange = {
                            phone = it
                            errorMessage = null
                        },
                        label = { Text("شماره همراه مدیر (۰۹۱۷...)", fontSize = 12.sp) },
                        leadingIcon = { Text("📱", fontSize = 16.sp) },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(16.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = ProfarmEmeraldPrimary,
                            unfocusedBorderColor = ProfarmBorderLight,
                            focusedContainerColor = ProfarmWarmWhite,
                            unfocusedContainerColor = ProfarmWarmWhite
                        )
                    )

                    // Password Input with Eye Visibility Toggle
                    OutlinedTextField(
                        value = password,
                        onValueChange = {
                            password = it
                            errorMessage = null
                        },
                        label = { Text("کلمه عبور امن", fontSize = 12.sp) },
                        leadingIcon = { Text("🔒", fontSize = 16.sp) },
                        trailingIcon = {
                            IconButton(onClick = { isPasswordVisible = !isPasswordVisible }) {
                                Text(if (isPasswordVisible) "👁️" else "🙈", fontSize = 16.sp)
                            }
                        },
                        singleLine = true,
                        visualTransformation = if (isPasswordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(16.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = ProfarmEmeraldPrimary,
                            unfocusedBorderColor = ProfarmBorderLight,
                            focusedContainerColor = ProfarmWarmWhite,
                            unfocusedContainerColor = ProfarmWarmWhite
                        )
                    )

                    // Remember Me Row
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = "ذخیره ورود خودکار در این گوشی",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = ProfarmTextPrimary
                        )
                        Switch(
                            checked = rememberMe,
                            onCheckedChange = { rememberMe = it },
                            colors = SwitchDefaults.colors(
                                checkedThumbColor = Color.White,
                                checkedTrackColor = ProfarmEmeraldPrimary,
                                uncheckedThumbColor = Color.LightGray,
                                uncheckedTrackColor = Color(0xFFE2E8F0)
                            )
                        )
                    }

                    Spacer(modifier = Modifier.height(4.dp))

                    // Luxury CTA Login Button
                    Button(
                        onClick = {
                            if (phone.isBlank() || password.isBlank()) {
                                errorMessage = "لطفاً شماره موبایل و کلمه عبور را وارد فرمایید."
                                return@Button
                            }

                            isLoading = true
                            errorMessage = null

                            scope.launch {
                                try {
                                    val (success, token, msg) = performLogin(
                                        baseUrl = prefs.serverUrl,
                                        phone = phone.trim(),
                                        pass = password
                                    )

                                    if (success && token != null) {
                                        prefs.saveCredentials(phone.trim(), password, rememberMe)
                                        prefs.saveSession(token, System.currentTimeMillis())

                                        // Set cookie in CookieManager
                                        CookieManager.getInstance().apply {
                                            setAcceptCookie(true)
                                            setCookie(prefs.serverUrl, token)
                                            flush()
                                        }

                                        withContext(Dispatchers.Main) {
                                            isLoading = false
                                            onLoginSuccess()
                                        }
                                    } else {
                                        withContext(Dispatchers.Main) {
                                            isLoading = false
                                            errorMessage = msg ?: "نام کاربری یا کلمه عبور صحیح نمی‌باشد."
                                        }
                                    }
                                } catch (e: Exception) {
                                    withContext(Dispatchers.Main) {
                                        isLoading = false
                                        errorMessage = "عدم برقراری ارتباط با سرور: ${e.localizedMessage ?: "خطای ناشناخته"}"
                                    }
                                }
                            }
                        },
                        enabled = !isLoading,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(52.dp),
                        shape = RoundedCornerShape(16.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = ProfarmEmeraldPrimary,
                            disabledContainerColor = ProfarmEmeraldLight.copy(alpha = 0.6f)
                        ),
                        elevation = ButtonDefaults.buttonElevation(defaultElevation = 4.dp)
                    ) {
                        if (isLoading) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(22.dp),
                                color = ProfarmGoldPrimary,
                                strokeWidth = 2.5.dp
                            )
                            Spacer(modifier = Modifier.width(10.dp))
                            Text(
                                text = "در حال احراز هویت امن...",
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color.White
                            )
                        } else {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Text(
                                    text = "ورود امن به پنل مدیریت",
                                    fontSize = 15.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Color.White
                                )
                                Text("🛡️", fontSize = 16.sp)
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Server Connection Status Pill
            Surface(
                onClick = onOpenServerConfig,
                shape = RoundedCornerShape(20.dp),
                color = Color.White.copy(alpha = 0.95f),
                border = androidx.compose.foundation.BorderStroke(1.dp, ProfarmBorderLight),
                shadowElevation = 4.dp
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 9.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .size(9.dp)
                            .background(ProfarmOnlineGreen, CircleShape)
                    )
                    val displayHost = prefs.serverUrl
                        .removePrefix("http://")
                        .removePrefix("https://")
                        .trimEnd('/')

                    Text(
                        text = "سرور کامپیوتر: $displayHost",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = ProfarmForestDark
                    )
                    Text("⚙️", fontSize = 13.sp)
                }
            }

            Spacer(modifier = Modifier.height(16.dp))
        }
    }
}

/**
 * Performs authentication against Next.js API route /api/auth/login
 */
private suspend fun performLogin(
    baseUrl: String,
    phone: String,
    pass: String
): Triple<Boolean, String?, String?> = withContext(Dispatchers.IO) {
    var connection: HttpURLConnection? = null
    try {
        val cleanBase = baseUrl.trimEnd('/')
        val url = URL("$cleanBase/api/auth/login")
        connection = (url.openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            setRequestProperty("Content-Type", "application/json; charset=UTF-8")
            setRequestProperty("Accept", "application/json")
            connectTimeout = 7000
            readTimeout = 7000
            doOutput = true
            doInput = true
        }

        val jsonPayload = JSONObject().apply {
            put("phone", phone)
            put("password", pass)
        }

        OutputStreamWriter(connection.outputStream).use { writer ->
            writer.write(jsonPayload.toString())
            writer.flush()
        }

        val responseCode = connection.responseCode
        if (responseCode in 200..299) {
            val responseText = connection.inputStream.bufferedReader().use { it.readText() }
            val jsonResponse = JSONObject(responseText)
            val success = jsonResponse.optBoolean("success", true)
            val message = jsonResponse.optString("message", null)

            // Capture Set-Cookie header for session token
            val cookieHeader = connection.headerFields["Set-Cookie"]?.joinToString("; ") ?: ""
            Triple(success, cookieHeader.ifBlank { "dummy_auth_session=1; Path=/" }, message)
        } else {
            val errText = connection.errorStream?.bufferedReader()?.use { it.readText() } ?: ""
            val errMsg = try {
                JSONObject(errText).optString("error", "اطلاعات ورود نادرست است.")
            } catch (_: Exception) {
                "کد خطا: $responseCode"
            }
            Triple(false, null, errMsg)
        }
    } finally {
        connection?.disconnect()
    }
}
