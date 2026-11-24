package com.maltranslate.app.data

import android.util.Base64
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

data class OcrResult(val ocr: String, val translation: String)

class GeminiException(message: String) : Exception(message)

/** Talks straight to the Gemini REST API with the user's own key, the same request the PWA makes. */
object GeminiClient {

    private const val BASE = "https://generativelanguage.googleapis.com/v1beta/models/"

    suspend fun extractAndTranslate(apiKey: String, model: String, jpeg: ByteArray): OcrResult {
        val prompt = """
            Analyze this image and perform two tasks:
            1. Extract all Malayalam text present in the image (OCR). Maintain the formatting, layout and spelling.
            2. Translate the extracted Malayalam text into clear, contextually accurate English.

            Put the extracted Malayalam text in "ocr" and the English translation in "translation".
        """.trimIndent()

        val parts = JSONArray()
            .put(JSONObject().put("text", prompt))
            .put(
                JSONObject().put(
                    "inlineData",
                    JSONObject()
                        .put("mimeType", "image/jpeg")
                        .put("data", Base64.encodeToString(jpeg, Base64.NO_WRAP))
                )
            )

        val schema = objectSchema(
            "ocr" to "Malayalam text extracted from the image, preserving layout and spelling",
            "translation" to "Clear, contextually accurate English translation of the extracted text"
        )

        val data = call(apiKey, model, parts, schema)
        val ocr = data.optString("ocr")
        val translation = data.optString("translation")
        if (ocr.isEmpty() && translation.isEmpty()) {
            throw GeminiException("Failed to parse text or translation.")
        }
        return OcrResult(ocr, translation)
    }

    /** Translate (possibly hand-corrected) Malayalam text again without re-sending the image. */
    suspend fun retranslate(apiKey: String, model: String, malayalam: String): String {
        val prompt = """
            Translate the following Malayalam text into clear, contextually accurate English.
            The text may have been corrected by hand after OCR; translate it exactly as given.
            Put the English translation in "translation".

            Malayalam text:
        """.trimIndent() + "\n" + malayalam

        val parts = JSONArray().put(JSONObject().put("text", prompt))
        val schema = objectSchema(
            "translation" to "Clear, contextually accurate English translation of the given Malayalam text"
        )
        val translation = call(apiKey, model, parts, schema).optString("translation")
        if (translation.isEmpty()) throw GeminiException("Failed to parse translation.")
        return translation
    }

    private fun objectSchema(vararg fields: Pair<String, String>): JSONObject {
        val props = JSONObject()
        val names = JSONArray()
        for ((name, description) in fields) {
            props.put(name, JSONObject().put("type", "STRING").put("description", description))
            names.put(name)
        }
        return JSONObject()
            .put("type", "OBJECT")
            .put("properties", props)
            .put("required", names)
            .put("propertyOrdering", names)
    }

    private suspend fun call(apiKey: String, model: String, parts: JSONArray, schema: JSONObject): JSONObject =
        withContext(Dispatchers.IO) {
            val body = JSONObject()
                .put("contents", JSONArray().put(JSONObject().put("parts", parts)))
                .put(
                    "generationConfig",
                    JSONObject()
                        .put("responseMimeType", "application/json")
                        .put("responseSchema", schema)
                )
                .toString()

            val url = URL(BASE + URLEncoder.encode(model, "UTF-8") + ":generateContent")
            val conn = url.openConnection() as HttpURLConnection
            try {
                conn.requestMethod = "POST"
                conn.connectTimeout = 20_000
                conn.readTimeout = 120_000
                conn.doOutput = true
                conn.setRequestProperty("Content-Type", "application/json; charset=utf-8")
                conn.setRequestProperty("x-goog-api-key", apiKey)

                val status = try {
                    conn.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
                    conn.responseCode
                } catch (e: IOException) {
                    throw GeminiException("Couldn't reach Gemini. Check your connection and try again.")
                }

                if (status !in 200..299) {
                    val errText = conn.errorStream?.bufferedReader()?.use { it.readText() }.orEmpty()
                    val message = runCatching {
                        JSONObject(errText).getJSONObject("error").getString("message")
                    }.getOrNull()
                    throw GeminiException(message ?: "API request failed (HTTP $status)")
                }

                val result = JSONObject(conn.inputStream.bufferedReader().use { it.readText() })
                val candidate = result.optJSONArray("candidates")?.optJSONObject(0)
                val responseParts = candidate?.optJSONObject("content")?.optJSONArray("parts")
                val text = buildString {
                    if (responseParts != null) {
                        for (i in 0 until responseParts.length()) {
                            val p = responseParts.getJSONObject(i)
                            if (p.has("text") && !p.optBoolean("thought")) append(p.getString("text"))
                        }
                    }
                }.trim()

                if (text.isEmpty()) {
                    val reason = candidate?.optString("finishReason")?.takeIf { it.isNotEmpty() }
                        ?: result.optJSONObject("promptFeedback")?.optString("blockReason")?.takeIf { it.isNotEmpty() }
                    throw GeminiException(
                        if (reason != null) "No content returned from Gemini ($reason)." else "No content returned from Gemini."
                    )
                }

                try {
                    JSONObject(text)
                } catch (e: Exception) {
                    throw GeminiException("Gemini returned a response that could not be parsed.")
                }
            } finally {
                conn.disconnect()
            }
        }
}
