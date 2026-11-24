package com.maltranslate.app.ui

import android.app.Application
import android.graphics.Bitmap
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.maltranslate.app.data.GeminiClient
import com.maltranslate.app.data.HistoryItem
import com.maltranslate.app.data.HistoryStore
import com.maltranslate.app.data.ImageEdit
import com.maltranslate.app.data.ImageTools
import com.maltranslate.app.data.Settings
import com.maltranslate.app.data.ThemeChoice
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

data class UiMessage(val text: String, val isError: Boolean = false, val id: Long = System.nanoTime())

class MainViewModel(app: Application) : AndroidViewModel(app) {
    private val settings = Settings(app)
    private val historyStore = HistoryStore(app)

    // Settings
    var apiKey by mutableStateOf(settings.apiKey); private set
    var model by mutableStateOf(settings.model); private set
    var theme by mutableStateOf(settings.theme); private set
    var acceptedPolicies by mutableStateOf(settings.acceptedPolicies); private set

    // Selected picture: the decoded original, the user's crop/rotation, and what gets uploaded
    var source by mutableStateOf<Bitmap?>(null); private set
    var edit by mutableStateOf(ImageEdit()); private set
    var preview by mutableStateOf<Bitmap?>(null); private set
    private var uploadJpeg: ByteArray? = null
    var isLoadingImage by mutableStateOf(false); private set

    // Results
    var malText by mutableStateOf(""); private set
    var engText by mutableStateOf(""); private set
    var showResults by mutableStateOf(false); private set
    var isTranslating by mutableStateOf(false); private set
    var isRetranslating by mutableStateOf(false); private set

    // History
    var history by mutableStateOf<List<HistoryItem>>(emptyList()); private set
    private var currentHistoryId: String? = null

    var message by mutableStateOf<UiMessage?>(null); private set

    /** Set when the results should scroll into view. */
    var scrollToResults by mutableStateOf(0); private set

    init {
        viewModelScope.launch { history = historyStore.load() }
    }

    fun historyImage(item: HistoryItem) = historyStore.imageFile(item)

    fun toast(text: String, isError: Boolean = false) {
        message = UiMessage(text, isError)
    }

    fun messageShown() {
        message = null
    }

    // ---- Settings ----

    fun saveSettings(newKey: String, newModel: String) {
        apiKey = newKey.trim()
        model = newModel
        settings.apiKey = apiKey
        settings.model = model
        toast("Settings saved successfully!")
    }

    fun toggleTheme(systemDark: Boolean) {
        val dark = when (theme) {
            ThemeChoice.SYSTEM -> systemDark
            ThemeChoice.DARK -> true
            ThemeChoice.LIGHT -> false
        }
        theme = if (dark) ThemeChoice.LIGHT else ThemeChoice.DARK
        settings.theme = theme
    }

    fun acceptPolicies() {
        settings.acceptedPolicies = true
        acceptedPolicies = true
    }

    // ---- Image ----

    fun loadImage(uri: Uri, successMessage: String? = null) {
        viewModelScope.launch {
            isLoadingImage = true
            val bitmap = ImageTools.decode(getApplication(), uri)
            isLoadingImage = false
            if (bitmap == null) {
                toast("Could not read this image. Try a different file.", isError = true)
                return@launch
            }
            source = bitmap
            applyEdit(ImageEdit())
            successMessage?.let { toast(it) }
        }
    }

    /** Re-render the preview and upload copy from the original, so cropping keeps full detail. */
    fun applyEdit(newEdit: ImageEdit) {
        val src = source ?: return
        edit = newEdit
        viewModelScope.launch {
            val (bitmap, jpeg) = withContext(Dispatchers.Default) {
                val rendered = ImageTools.render(src, newEdit, ImageTools.MAX_UPLOAD_DIM)
                rendered to ImageTools.toJpeg(rendered)
            }
            preview = bitmap
            uploadJpeg = jpeg
        }
    }

    fun clearImage() {
        source = null
        preview = null
        uploadJpeg = null
        edit = ImageEdit()
    }

    // ---- Translation ----

    private fun isOnline(): Boolean {
        val cm = getApplication<Application>().getSystemService(ConnectivityManager::class.java)
        val caps = cm?.getNetworkCapabilities(cm.activeNetwork) ?: return false
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    /** Returns false when the API key is missing, so the UI can open Settings. */
    fun translate(): Boolean {
        if (apiKey.isEmpty()) {
            toast("Please configure your Gemini API Key first.", isError = true)
            return false
        }
        val jpeg = uploadJpeg
        if (jpeg == null) {
            toast("Please capture or upload an image.", isError = true)
            return true
        }
        if (!isOnline()) {
            toast("You're offline. Connect to the internet and try again.", isError = true)
            return true
        }

        isTranslating = true
        viewModelScope.launch {
            try {
                val result = GeminiClient.extractAndTranslate(apiKey, model, jpeg)
                malText = result.ocr
                engText = result.translation
                showResults = true
                scrollToResults++
                toast("Translation completed!")
                runCatching {
                    history = historyStore.add(history, result.ocr, result.translation, jpeg)
                    currentHistoryId = history.firstOrNull()?.id
                }.onFailure { toast("Translated, but this record couldn't be saved to history.", isError = true) }
            } catch (e: Exception) {
                toast("Error: ${e.message ?: "Something went wrong"}", isError = true)
            } finally {
                isTranslating = false
            }
        }
        return true
    }

    fun onMalTextChange(text: String) {
        malText = text
    }

    fun onEngTextChange(text: String) {
        engText = text
    }

    fun retranslate(): Boolean {
        val malayalam = malText.trim()
        if (malayalam.isEmpty()) {
            toast("There is no Malayalam text to translate.", isError = true)
            return true
        }
        if (apiKey.isEmpty()) {
            toast("Please configure your Gemini API Key first.", isError = true)
            return false
        }
        if (!isOnline()) {
            toast("You're offline. Connect to the internet and try again.", isError = true)
            return true
        }

        isRetranslating = true
        viewModelScope.launch {
            try {
                val translation = GeminiClient.retranslate(apiKey, model, malayalam)
                engText = translation
                toast("Re-translated edited text!")
                val id = currentHistoryId
                if (id != null && history.any { it.id == id }) {
                    runCatching { history = historyStore.update(history, id, malText, translation) }
                        .onFailure { toast("Re-translated, but history couldn't be updated.", isError = true) }
                }
            } catch (e: Exception) {
                toast("Error: ${e.message ?: "Something went wrong"}", isError = true)
            } finally {
                isRetranslating = false
            }
        }
        return true
    }

    // ---- History ----

    fun openHistoryItem(item: HistoryItem) {
        currentHistoryId = item.id
        malText = item.ocr
        engText = item.translation
        showResults = true
        val file = historyStore.imageFile(item)
        viewModelScope.launch {
            val bitmap = file?.let { withContext(Dispatchers.IO) { ImageTools.decodeFile(it.path) } }
            if (bitmap != null) {
                source = bitmap
                edit = ImageEdit()
                preview = bitmap
                uploadJpeg = withContext(Dispatchers.IO) { file.readBytes() }
            } else {
                clearImage()
            }
            scrollToResults++
            toast("Loaded translation from history!")
        }
    }

    fun deleteHistoryItem(id: String) {
        if (id == currentHistoryId) currentHistoryId = null
        viewModelScope.launch {
            history = historyStore.delete(history, id)
            toast("Record deleted.")
        }
    }
}
