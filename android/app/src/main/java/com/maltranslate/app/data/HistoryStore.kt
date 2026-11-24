package com.maltranslate.app.data

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

data class HistoryItem(
    val id: String,
    val timestamp: Long,
    val ocr: String,
    val translation: String,
    /** File name of the stored JPEG inside the history folder, or null. */
    val imageFile: String?,
)

/**
 * Recent translations: an index in history.json plus one JPEG per record,
 * all in the app's private storage.
 */
class HistoryStore(context: Context) {
    private val dir = File(context.filesDir, "history").apply { mkdirs() }
    private val index = File(dir, "history.json")

    fun imageFile(item: HistoryItem): File? = item.imageFile?.let { File(dir, it) }?.takeIf { it.exists() }

    suspend fun load(): List<HistoryItem> = withContext(Dispatchers.IO) {
        if (!index.exists()) return@withContext emptyList()
        runCatching {
            val arr = JSONArray(index.readText())
            (0 until arr.length()).map { i ->
                val o = arr.getJSONObject(i)
                HistoryItem(
                    id = o.getString("id"),
                    timestamp = o.optLong("timestamp"),
                    ocr = o.optString("ocr"),
                    translation = o.optString("translation"),
                    imageFile = o.optString("image").takeIf { it.isNotEmpty() },
                )
            }
        }.getOrDefault(emptyList())
    }

    /** Add a record to the front, keep the newest [HISTORY_LIMIT], return the new list. */
    suspend fun add(current: List<HistoryItem>, ocr: String, translation: String, jpeg: ByteArray?): List<HistoryItem> =
        withContext(Dispatchers.IO) {
            val id = System.currentTimeMillis().toString()
            val imageName = jpeg?.let { "$id.jpg".also { name -> File(dir, name).writeBytes(it) } }
            val item = HistoryItem(id, System.currentTimeMillis(), ocr, translation, imageName)
            val all = listOf(item) + current
            val kept = all.take(HISTORY_LIMIT)
            all.drop(HISTORY_LIMIT).forEach { deleteImage(it) }
            save(kept)
            kept
        }

    suspend fun update(current: List<HistoryItem>, id: String, ocr: String, translation: String): List<HistoryItem> =
        withContext(Dispatchers.IO) {
            val updated = current.map { if (it.id == id) it.copy(ocr = ocr, translation = translation) else it }
            save(updated)
            updated
        }

    suspend fun delete(current: List<HistoryItem>, id: String): List<HistoryItem> = withContext(Dispatchers.IO) {
        current.find { it.id == id }?.let { deleteImage(it) }
        val remaining = current.filter { it.id != id }
        save(remaining)
        remaining
    }

    private fun deleteImage(item: HistoryItem) {
        item.imageFile?.let { File(dir, it).delete() }
    }

    private fun save(items: List<HistoryItem>) {
        val arr = JSONArray()
        items.forEach {
            arr.put(
                JSONObject()
                    .put("id", it.id)
                    .put("timestamp", it.timestamp)
                    .put("ocr", it.ocr)
                    .put("translation", it.translation)
                    .put("image", it.imageFile ?: "")
            )
        }
        val tmp = File(dir, "history.json.tmp")
        tmp.writeText(arr.toString())
        tmp.renameTo(index)
    }

    companion object {
        const val HISTORY_LIMIT = 15
    }
}
