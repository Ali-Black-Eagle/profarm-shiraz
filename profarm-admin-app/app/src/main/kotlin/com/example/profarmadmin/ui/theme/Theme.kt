/*
 * Copyright 2026 Profarm Shiraz
 * Material 3 Expressive Theme Configuration
 */

package com.example.profarmadmin.ui.theme

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext

private val LightColorScheme = lightColorScheme(
    primary = ProfarmEmeraldPrimary,
    onPrimary = Color.White,
    primaryContainer = ProfarmEmeraldContainer,
    onPrimaryContainer = ProfarmForestDark,
    secondary = ProfarmForestMedium,
    onSecondary = Color.White,
    secondaryContainer = ProfarmEmeraldContainer,
    onSecondaryContainer = ProfarmForestDark,
    tertiary = ProfarmGoldPrimary,
    onTertiary = ProfarmForestDark,
    tertiaryContainer = ProfarmGoldContainer,
    onTertiaryContainer = ProfarmForestDark,
    background = ProfarmWarmWhite,
    onBackground = ProfarmTextPrimary,
    surface = ProfarmCardWhite,
    onSurface = ProfarmTextPrimary,
    surfaceVariant = ProfarmWarmWhite,
    onSurfaceVariant = ProfarmTextSecondary,
    outline = ProfarmBorderLight,
    error = ProfarmDangerRed,
    onError = Color.White
)

private val DarkColorScheme = darkColorScheme(
    primary = ProfarmGoldPrimary,
    onPrimary = ProfarmForestDark,
    primaryContainer = ProfarmForestMedium,
    onPrimaryContainer = ProfarmGoldLight,
    secondary = ProfarmEmeraldLight,
    onSecondary = Color.White,
    tertiary = ProfarmGoldLight,
    onTertiary = ProfarmForestDark,
    background = ProfarmForestDark,
    onBackground = Color.White,
    surface = ProfarmForestMedium,
    onSurface = Color.White,
    outline = ProfarmGoldMuted
)

@Composable
fun ProfarmAdminTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    dynamicColor: Boolean = false,
    content: @Composable () -> Unit
) {
    val colorScheme = when {
        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
            val context = LocalContext.current
            if (darkTheme) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        }
        darkTheme -> DarkColorScheme
        else -> LightColorScheme
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content
    )
}
