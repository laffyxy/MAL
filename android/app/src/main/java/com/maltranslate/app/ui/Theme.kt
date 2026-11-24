package com.maltranslate.app.ui

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.material3.Typography
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.ExperimentalTextApi
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.maltranslate.app.R

// Inter (body) and Inter Tight (display), the PWA's fonts, bundled as variable fonts.
// Malayalam isn't in Inter, so those glyphs fall back to the system's Noto Sans Malayalam.
@OptIn(ExperimentalTextApi::class)
private fun variableFamily(resId: Int, vararg weights: Int) = FontFamily(
    weights.map { w ->
        Font(resId, FontWeight(w), variationSettings = FontVariation.Settings(FontVariation.weight(w)))
    }
)

val Inter = variableFamily(R.font.inter, 400, 500, 600, 700, 800)
val InterTight = variableFamily(R.font.inter_tight, 600, 700, 800)

private fun TextStyle.inter() = copy(fontFamily = Inter)

private val AppTypography = Typography().run {
    Typography(
        displayLarge = displayLarge.copy(fontFamily = InterTight),
        displayMedium = displayMedium.copy(fontFamily = InterTight),
        displaySmall = displaySmall.copy(fontFamily = InterTight),
        headlineLarge = headlineLarge.copy(fontFamily = InterTight),
        headlineMedium = headlineMedium.copy(fontFamily = InterTight),
        headlineSmall = headlineSmall.copy(fontFamily = InterTight),
        titleLarge = titleLarge.inter(), titleMedium = titleMedium.inter(), titleSmall = titleSmall.inter(),
        bodyLarge = bodyLarge.inter(), bodyMedium = bodyMedium.inter(), bodySmall = bodySmall.inter(),
        labelLarge = labelLarge.inter(), labelMedium = labelMedium.inter(), labelSmall = labelSmall.inter(),
    )
}

/** The PWA's monochrome palette (style.css custom properties). */
@Immutable
data class AppColors(
    val bg: Color,
    val bgSubtle: Color,
    val bgTextBox: Color,
    val accent: Color,
    val onAccent: Color,
    val dot: Color,
    val text: Color,
    val textSecondary: Color,
    val textMuted: Color,
    val border: Color,
    val warningText: Color,
    val warningBorder: Color,
    val danger: Color,
)

val LightAppColors = AppColors(
    bg = Color(0xFFFFFFFF),
    bgSubtle = Color(0xFFF5F5F5),
    bgTextBox = Color(0xFFFAFAFA),
    accent = Color(0xFF0A0A0A),
    onAccent = Color(0xFFFFFFFF),
    dot = Color(0xFFB5B5B5),
    text = Color(0xFF0A0A0A),
    textSecondary = Color(0xFF525252),
    textMuted = Color(0xFF8A8A8A),
    border = Color(0xFFE5E5E5),
    warningText = Color(0xFFB91C1C),
    warningBorder = Color(0xFFFECACA),
    danger = Color(0xFFDC2626),
)

val DarkAppColors = AppColors(
    bg = Color(0xFF0A0A0A),
    bgSubtle = Color(0xFF171717),
    bgTextBox = Color(0xFF111111),
    accent = Color(0xFFFAFAFA),
    onAccent = Color(0xFF0A0A0A),
    dot = Color(0xFF555555),
    text = Color(0xFFFAFAFA),
    textSecondary = Color(0xFFA3A3A3),
    textMuted = Color(0xFF737373),
    border = Color(0xFF262626),
    warningText = Color(0xFFFCA5A5),
    warningBorder = Color(0xFF7F1D1D),
    danger = Color(0xFFF87171),
)

val LocalAppColors = staticCompositionLocalOf { LightAppColors }

val appShape = RoundedCornerShape(4.dp)

@Composable
fun MalTranslateTheme(dark: Boolean, content: @Composable () -> Unit) {
    val c = if (dark) DarkAppColors else LightAppColors
    val scheme = if (dark) {
        darkColorScheme(
            primary = c.accent, onPrimary = c.onAccent,
            background = c.bg, onBackground = c.text,
            surface = c.bg, onSurface = c.text, surfaceVariant = c.bgSubtle, onSurfaceVariant = c.textSecondary,
            surfaceContainer = Color(0xFF111111), surfaceContainerHigh = Color(0xFF111111),
            outline = c.border, outlineVariant = c.border, error = c.danger,
            inverseSurface = c.accent, inverseOnSurface = c.onAccent,
        )
    } else {
        lightColorScheme(
            primary = c.accent, onPrimary = c.onAccent,
            background = c.bg, onBackground = c.text,
            surface = c.bg, onSurface = c.text, surfaceVariant = c.bgSubtle, onSurfaceVariant = c.textSecondary,
            surfaceContainer = c.bg, surfaceContainerHigh = c.bg,
            outline = c.border, outlineVariant = c.border, error = c.danger,
            inverseSurface = c.accent, inverseOnSurface = c.onAccent,
        )
    }
    // LocalContentColor defaults to black; set it so text and icons outside a Surface
    // (dialogs, the crop editor) follow the theme too
    androidx.compose.runtime.CompositionLocalProvider(
        LocalAppColors provides c,
        androidx.compose.material3.LocalContentColor provides c.text,
    ) {
        MaterialTheme(
            colorScheme = scheme,
            typography = AppTypography,
            shapes = Shapes(
                extraSmall = appShape, small = appShape, medium = appShape,
                large = RoundedCornerShape(6.dp), extraLarge = RoundedCornerShape(8.dp)
            ),
            content = content
        )
    }
}
