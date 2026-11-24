package com.maltranslate.app.data

import android.content.Context

enum class ThemeChoice { SYSTEM, LIGHT, DARK }

data class GeminiModel(val id: String, val label: String)

val GEMINI_MODELS = listOf(
    GeminiModel("gemini-3.5-flash", "Gemini 3.5 Flash (Fast, Recommended)"),
    GeminiModel("gemini-3.5-pro", "Gemini 3.5 Pro (Premium Reasoning)"),
    GeminiModel("gemini-3.1-pro", "Gemini 3.1 Pro (High Quality)"),
    GeminiModel("gemini-3.1-flash-lite", "Gemini 3.1 Flash-Lite (Lightweight)"),
)

/** Bump when the Privacy Policy or Terms change to ask users to accept again. */
const val POLICY_VERSION = "2026-11-05"

/** Small key/value settings, kept in the app's private SharedPreferences. */
class Settings(context: Context) {
    private val prefs = context.getSharedPreferences("settings", Context.MODE_PRIVATE)

    var apiKey: String
        get() = prefs.getString("gemini_api_key", "").orEmpty()
        set(value) = prefs.edit().putString("gemini_api_key", value).apply()

    var model: String
        get() = prefs.getString("gemini_model", GEMINI_MODELS.first().id) ?: GEMINI_MODELS.first().id
        set(value) = prefs.edit().putString("gemini_model", value).apply()

    var theme: ThemeChoice
        get() = runCatching { ThemeChoice.valueOf(prefs.getString("theme", "SYSTEM")!!) }.getOrDefault(ThemeChoice.SYSTEM)
        set(value) = prefs.edit().putString("theme", value.name).apply()

    var acceptedPolicies: Boolean
        get() = prefs.getString("policies_accepted", null) == POLICY_VERSION
        set(value) = prefs.edit().putString("policies_accepted", if (value) POLICY_VERSION else null).apply()
}
