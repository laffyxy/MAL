package com.maltranslate.app

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.core.content.FileProvider
import com.maltranslate.app.data.ThemeChoice
import com.maltranslate.app.ui.MainScreen
import com.maltranslate.app.ui.MainViewModel
import com.maltranslate.app.ui.MalTranslateTheme
import java.io.File

class MainActivity : ComponentActivity() {
    private val vm: MainViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (savedInstanceState == null) handleShare(intent)

        setContent {
            val systemDark = isSystemInDarkTheme()
            val dark = when (vm.theme) {
                ThemeChoice.SYSTEM -> systemDark
                ThemeChoice.DARK -> true
                ThemeChoice.LIGHT -> false
            }

            // Status/navigation bar icons follow the app theme, not just the system one
            DisposableEffect(dark) {
                val style = if (dark) SystemBarStyle.dark(android.graphics.Color.TRANSPARENT)
                else SystemBarStyle.light(android.graphics.Color.TRANSPARENT, android.graphics.Color.TRANSPARENT)
                enableEdgeToEdge(statusBarStyle = style, navigationBarStyle = style)
                onDispose {}
            }

            val pickImage = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
                if (uri != null) vm.loadImage(uri)
            }

            // The phone's own camera app: full resolution, autofocus and HDR
            var photoPath by rememberSaveable { mutableStateOf<String?>(null) }
            val takePhoto = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { saved ->
                val path = photoPath
                if (saved && path != null) vm.loadImage(Uri.fromFile(File(path)), "Image captured successfully!")
            }

            MalTranslateTheme(dark) {
                MainScreen(
                    vm = vm,
                    isDark = dark,
                    onToggleTheme = { vm.toggleTheme(systemDark) },
                    onPickImage = {
                        pickImage.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
                    },
                    onTakePhoto = {
                        val dir = File(cacheDir, "camera").apply { mkdirs() }
                        val file = File(dir, "photo.jpg")
                        photoPath = file.path
                        val uri = FileProvider.getUriForFile(this, "$packageName.fileprovider", file)
                        runCatching { takePhoto.launch(uri) }
                            .onFailure { vm.toast("No camera app found on this device.", isError = true) }
                    },
                )
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleShare(intent)
    }

    /** An image shared from another app (Gallery, WhatsApp, …). */
    private fun handleShare(intent: Intent?) {
        if (intent?.action != Intent.ACTION_SEND || intent.type?.startsWith("image/") != true) return
        val uri = if (Build.VERSION.SDK_INT >= 33) {
            intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
        } else {
            @Suppress("DEPRECATION")
            intent.getParcelableExtra(Intent.EXTRA_STREAM)
        }
        if (uri != null) vm.loadImage(uri, "Shared image ready to translate.")
        else vm.toast("Couldn't open the shared image. Try sharing it again.", isError = true)
    }
}
