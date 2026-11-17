package com.example.profarmadmin

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import com.example.profarmadmin.data.AdminPreferences
import com.example.profarmadmin.ui.AdminWebScreen
import com.example.profarmadmin.ui.LoginScreen
import com.example.profarmadmin.ui.ServerConfigDialog
import com.example.profarmadmin.ui.theme.ProfarmAdminTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        val prefs = AdminPreferences(this)

        setContent {
            ProfarmAdminTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    var isLoggedIn by remember { mutableStateOf(prefs.isLoggedIn && prefs.rememberMe) }
                    var showServerConfig by remember { mutableStateOf(false) }

                    if (isLoggedIn) {
                        AdminWebScreen(
                            prefs = prefs,
                            onLogout = {
                                prefs.clearSession()
                                isLoggedIn = false
                            },
                            onOpenServerConfig = {
                                showServerConfig = true
                            }
                        )
                    } else {
                        LoginScreen(
                            prefs = prefs,
                            onLoginSuccess = {
                                isLoggedIn = true
                            },
                            onOpenServerConfig = {
                                showServerConfig = true
                            }
                        )
                    }

                    if (showServerConfig) {
                        ServerConfigDialog(
                            currentUrl = prefs.serverUrl,
                            onDismiss = { showServerConfig = false },
                            onSave = { newUrl ->
                                prefs.serverUrl = newUrl
                                showServerConfig = false
                            }
                        )
                    }
                }
            }
        }
    }
}
