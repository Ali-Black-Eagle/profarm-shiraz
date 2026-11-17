# ==============================================================================
# R8 / ProGuard Optimization Rules for Profarm Admin
# ==============================================================================

# Preserve annotations and Javascript interfaces for WebViews
-keepattributes *Annotation*
-keepattributes JavascriptInterface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Preserve reflection calls and Compose metadata
-keepclassmembers class * extends java.lang.Enum {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# Android Web & Network rules
-dontwarn android.webkit.**
-dontwarn androidx.**
