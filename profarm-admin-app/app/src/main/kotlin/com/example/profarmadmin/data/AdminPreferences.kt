package com.example.profarmadmin.data

import android.content.Context
import android.content.SharedPreferences

class AdminPreferences(context: Context) {
    private val prefs: SharedPreferences = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    companion object {
        private const val PREFS_NAME = "profarm_admin_prefs"
        private const val KEY_SERVER_URL = "server_url"
        private const val KEY_ADMIN_PHONE = "admin_phone"
        private const val KEY_ADMIN_PASSWORD = "admin_password"
        private const val KEY_REMEMBER_ME = "remember_me"
        private const val KEY_SESSION_TOKEN = "session_token"
        private const val KEY_IS_LOGGED_IN = "is_logged_in"

        // Default to PC's active Wi-Fi IP address on the mobile hotspot
        const val DEFAULT_SERVER_URL = "http://10.145.79.221:3000"
        const val DEFAULT_ADMIN_PHONE = "09170000000"
        const val DEFAULT_ADMIN_PASSWORD = "Admin@ProFarm2026!#Shiraz"
    }

    var serverUrl: String
        get() = prefs.getString(KEY_SERVER_URL, DEFAULT_SERVER_URL) ?: DEFAULT_SERVER_URL
        set(value) = prefs.edit().putString(KEY_SERVER_URL, cleanUrl(value)).apply()

    var savedPhone: String
        get() = prefs.getString(KEY_ADMIN_PHONE, DEFAULT_ADMIN_PHONE) ?: DEFAULT_ADMIN_PHONE
        set(value) = prefs.edit().putString(KEY_ADMIN_PHONE, value).apply()

    var savedPassword: String
        get() = prefs.getString(KEY_ADMIN_PASSWORD, DEFAULT_ADMIN_PASSWORD) ?: DEFAULT_ADMIN_PASSWORD
        set(value) = prefs.edit().putString(KEY_ADMIN_PASSWORD, value).apply()

    var rememberMe: Boolean
        get() = prefs.getBoolean(KEY_REMEMBER_ME, true)
        set(value) = prefs.edit().putBoolean(KEY_REMEMBER_ME, value).apply()

    var sessionToken: String
        get() = prefs.getString(KEY_SESSION_TOKEN, "") ?: ""
        set(value) = prefs.edit().putString(KEY_SESSION_TOKEN, value).apply()

    var isLoggedIn: Boolean
        get() = prefs.getBoolean(KEY_IS_LOGGED_IN, false)
        set(value) = prefs.edit().putBoolean(KEY_IS_LOGGED_IN, value).apply()

    fun getAdminDashboardUrl(): String {
        val base = cleanUrl(serverUrl)
        return "$base/admin"
    }

    fun getLoginApiUrl(): String {
        val base = cleanUrl(serverUrl)
        return "$base/api/auth/login"
    }

    fun saveCredentials(phone: String, pass: String, remember: Boolean) {
        if (remember) {
            savedPhone = phone
            savedPassword = pass
        }
        rememberMe = remember
    }

    fun saveSession(token: String, timestamp: Long = System.currentTimeMillis()) {
        sessionToken = token
        isLoggedIn = true
    }

    fun clearSession() {
        prefs.edit()
            .remove(KEY_SESSION_TOKEN)
            .putBoolean(KEY_IS_LOGGED_IN, false)
            .apply()
    }

    private fun cleanUrl(url: String): String {
        var clean = url.trim()
        if (!clean.startsWith("http://") && !clean.startsWith("https://")) {
            clean = "http://$clean"
        }
        return clean.trimEnd('/')
    }
}
