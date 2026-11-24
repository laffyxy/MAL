@file:OptIn(androidx.compose.foundation.ExperimentalFoundationApi::class, androidx.compose.foundation.layout.ExperimentalLayoutApi::class)

package com.maltranslate.app.ui

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.text.format.DateUtils
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.relocation.BringIntoViewRequester
import androidx.compose.foundation.relocation.bringIntoViewRequester
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AccessTime
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.CloudUpload
import androidx.compose.material.icons.outlined.ContentCopy
import androidx.compose.material.icons.outlined.Crop
import androidx.compose.material.icons.outlined.DarkMode
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material.icons.outlined.ExpandMore
import androidx.compose.material.icons.outlined.LightMode
import androidx.compose.material.icons.outlined.PhotoCamera
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.Share
import androidx.compose.material.icons.outlined.Translate
import androidx.compose.material.icons.outlined.Tune
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Snackbar
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.maltranslate.app.R
import com.maltranslate.app.data.HistoryItem

private const val GITHUB_URL = "https://github.com/laffyxy/MAL"
private const val ISSUES_URL = "https://github.com/laffyxy/MAL/issues"

@Composable
fun MainScreen(
    vm: MainViewModel,
    isDark: Boolean,
    onToggleTheme: () -> Unit,
    onPickImage: () -> Unit,
    onTakePhoto: () -> Unit,
) {
    val c = LocalAppColors.current
    val context = LocalContext.current
    val snackbar = remember { SnackbarHostState() }
    var settingsOpen by rememberSaveable { mutableStateOf(false) }
    var cropOpen by rememberSaveable { mutableStateOf(false) }
    var policyShown by rememberSaveable { mutableStateOf<String?>(null) }
    var historyExpanded by rememberSaveable { mutableStateOf(true) }
    val resultsRequester = remember { BringIntoViewRequester() }

    LaunchedEffect(vm.message) {
        val m = vm.message ?: return@LaunchedEffect
        snackbar.showSnackbar(m.text)
        vm.messageShown()
    }
    LaunchedEffect(vm.scrollToResults) {
        if (vm.scrollToResults > 0) resultsRequester.bringIntoView()
    }

    Scaffold(
        containerColor = c.bg,
        contentColor = c.text,
        snackbarHost = {
            SnackbarHost(snackbar) { data ->
                val isError = vm.message?.isError == true
                Snackbar(
                    containerColor = c.accent,
                    contentColor = c.onAccent,
                    shape = appShape,
                    modifier = Modifier.padding(12.dp)
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        if (isError) {
                            Icon(Icons.Outlined.ErrorOutline, null, tint = c.danger, modifier = Modifier.size(18.dp))
                            Spacer(Modifier.width(8.dp))
                        }
                        Text(data.visuals.message)
                    }
                }
            }
        }
    ) { padding ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp)
        ) {
            Header(isDark, missingKey = vm.apiKey.isEmpty(), onToggleTheme, onSettings = { settingsOpen = true })
            Hero()

            if (vm.apiKey.isEmpty()) {
                ApiKeyBanner(onSetup = { settingsOpen = true })
            }

            UploadCard(
                vm = vm,
                onPickImage = onPickImage,
                onTakePhoto = onTakePhoto,
                onCrop = { cropOpen = true },
                onNeedKey = { settingsOpen = true },
            )

            if (vm.showResults) {
                Column(
                    Modifier.bringIntoViewRequester(resultsRequester),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    ResultCard(
                        title = "Malayalam OCR",
                        text = vm.malText,
                        placeholder = "Extracted Malayalam text will appear here...",
                        onTextChange = vm::onMalTextChange,
                        large = true,
                        extraAction = {
                            SmallAction(
                                icon = Icons.Outlined.Refresh,
                                label = if (vm.isRetranslating) "Translating…" else "Re-translate",
                                enabled = !vm.isRetranslating,
                                onClick = { if (!vm.retranslate()) settingsOpen = true }
                            )
                        },
                        onShare = { shareText(context, vm.malText, vm) },
                        onCopy = { copyText(context, vm.malText, "Malayalam text copied!", vm) },
                    )
                    ResultCard(
                        title = "English Translation",
                        text = vm.engText,
                        placeholder = "English translation will appear here...",
                        onTextChange = vm::onEngTextChange,
                        large = false,
                        extraAction = null,
                        onShare = { shareText(context, vm.engText, vm) },
                        onCopy = { copyText(context, vm.engText, "English translation copied!", vm) },
                    )
                }
            }

            HistorySection(
                items = vm.history,
                expanded = historyExpanded,
                onToggle = { historyExpanded = !historyExpanded },
                onOpen = vm::openHistoryItem,
                onDelete = vm::deleteHistoryItem,
            )

            Footer(
                onPrivacy = { policyShown = "privacy" },
                onTerms = { policyShown = "terms" },
                onLink = { openUrl(context, it) },
            )
        }
    }

    if (settingsOpen) {
        SettingsDialog(
            initialKey = vm.apiKey,
            initialModel = vm.model,
            onOpenUrl = { openUrl(context, it) },
            onDismiss = { settingsOpen = false },
            onSave = { key, model -> vm.saveSettings(key, model); settingsOpen = false },
        )
    }

    val src = vm.source
    if (cropOpen && src != null) {
        CropEditor(
            source = src,
            initial = vm.edit,
            onCancel = { cropOpen = false },
            onDone = { vm.applyEdit(it); cropOpen = false },
        )
    }

    if (!vm.acceptedPolicies) {
        ConsentDialog(
            onShowPrivacy = { policyShown = "privacy" },
            onShowTerms = { policyShown = "terms" },
            onAccept = vm::acceptPolicies,
        )
    }

    when (policyShown) {
        "privacy" -> PolicyDialog(PRIVACY_POLICY) { policyShown = null }
        "terms" -> PolicyDialog(TERMS_OF_USE) { policyShown = null }
    }
}

@Composable
private fun Header(isDark: Boolean, missingKey: Boolean, onToggleTheme: () -> Unit, onSettings: () -> Unit) {
    val c = LocalAppColors.current
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        AppLogo(32)
        Spacer(Modifier.width(10.dp))
        Text("MalTranslate", fontFamily = InterTight, fontWeight = FontWeight.ExtraBold, fontSize = 20.sp, letterSpacing = (-0.4).sp)
        Spacer(Modifier.weight(1f))
        HeaderButton(if (isDark) Icons.Outlined.LightMode else Icons.Outlined.DarkMode,
            if (isDark) "Switch to light mode" else "Switch to dark mode", c.border, onToggleTheme)
        Spacer(Modifier.width(8.dp))
        HeaderButton(Icons.Outlined.Tune, "Settings", if (missingKey) c.danger else c.border, onSettings)
    }
}

@Composable
fun AppLogo(sizeDp: Int) {
    Box(
        Modifier
            .size(sizeDp.dp)
            .clip(appShape)
            .background(androidx.compose.ui.graphics.Color(0xFF0A0A0A))
    ) {
        Image(
            painterResource(R.drawable.ic_launcher_foreground), null,
            modifier = Modifier.fillMaxSize(),
            contentScale = ContentScale.Crop
        )
    }
}

@Composable
private fun HeaderButton(icon: ImageVector, description: String, borderColor: androidx.compose.ui.graphics.Color, onClick: () -> Unit) {
    Box(
        Modifier
            .size(40.dp)
            .clip(appShape)
            .border(1.dp, borderColor, appShape)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        Icon(icon, description, modifier = Modifier.size(20.dp))
    }
}

@Composable
private fun Hero() {
    val c = LocalAppColors.current
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(
            Modifier
                .border(1.dp, c.border, appShape)
                .padding(horizontal = 10.dp, vertical = 5.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(Icons.Outlined.Translate, null, Modifier.size(14.dp), tint = c.textSecondary)
            Spacer(Modifier.width(6.dp))
            Text("Malayalam to English", fontSize = 12.sp, color = c.textSecondary, fontWeight = FontWeight.Medium)
        }
        Text(
            buildAnnotatedString {
                listOf("Snap", "Read", "Translate").forEach {
                    append(it)
                    withStyle(SpanStyle(color = c.dot)) { append(". ") }
                }
            },
            fontFamily = InterTight, fontSize = 34.sp, lineHeight = 38.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = (-1).sp
        )
        Text(
            "Malayalam OCR and English translation from any photo.",
            color = c.textSecondary, fontSize = 15.sp
        )
    }
}

@Composable
private fun ApiKeyBanner(onSetup: () -> Unit) {
    val c = LocalAppColors.current
    Column(
        Modifier
            .fillMaxWidth()
            .border(1.dp, c.warningBorder, appShape)
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Row(verticalAlignment = Alignment.Top) {
            Icon(Icons.Outlined.ErrorOutline, null, tint = c.warningText, modifier = Modifier.size(20.dp))
            Spacer(Modifier.width(10.dp))
            Text(
                "Gemini API Key is missing. Please configure it in Settings to enable translations.",
                color = c.warningText, fontSize = 14.sp
            )
        }
        OutlinedButton(
            onClick = onSetup,
            shape = appShape,
            border = BorderStroke(1.dp, c.warningBorder),
            colors = ButtonDefaults.outlinedButtonColors(contentColor = c.warningText)
        ) { Text("Set up API Key") }
    }
}

@Composable
private fun UploadCard(
    vm: MainViewModel,
    onPickImage: () -> Unit,
    onTakePhoto: () -> Unit,
    onCrop: () -> Unit,
    onNeedKey: () -> Unit,
) {
    val c = LocalAppColors.current
    Column(
        Modifier
            .fillMaxWidth()
            .border(1.dp, c.border, appShape)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        val preview = vm.preview
        if (preview == null) {
            Column(
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 180.dp)
                    .clip(appShape)
                    .background(c.bgSubtle)
                    .clickable(onClick = onPickImage)
                    .padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                if (vm.isLoadingImage) {
                    CircularProgressIndicator(Modifier.size(28.dp), strokeWidth = 2.dp)
                } else {
                    Icon(Icons.Outlined.CloudUpload, null, Modifier.size(32.dp), tint = c.textSecondary)
                    Spacer(Modifier.height(10.dp))
                    Text("Tap to choose an image", fontWeight = FontWeight.SemiBold)
                    Spacer(Modifier.height(4.dp))
                    Text("PNG, JPG · or share a picture to MalTranslate", fontSize = 13.sp, color = c.textMuted)
                }
            }
        } else {
            Box(
                Modifier
                    .fillMaxWidth()
                    .clip(appShape)
                    .background(c.bgSubtle)
            ) {
                Image(
                    preview.asImageBitmap(), "Selected image",
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(max = 360.dp),
                    contentScale = ContentScale.Fit
                )
                IconButton(
                    onClick = vm::clearImage,
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(8.dp)
                        .size(36.dp)
                        .clip(appShape)
                        .background(c.accent.copy(alpha = 0.85f))
                ) {
                    Icon(Icons.Outlined.Close, "Remove image", tint = c.onAccent)
                }
                Row(
                    Modifier
                        .align(Alignment.BottomStart)
                        .padding(8.dp)
                        .clip(appShape)
                        .background(c.accent.copy(alpha = 0.85f))
                        .clickable(onClick = onCrop)
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(Icons.Outlined.Crop, null, tint = c.onAccent, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(6.dp))
                    Text("Crop", color = c.onAccent, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                }
            }
        }

        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
            Button(
                onClick = { if (!vm.translate()) onNeedKey() },
                enabled = vm.preview != null && !vm.isTranslating,
                shape = appShape,
                modifier = Modifier
                    .weight(1f)
                    .height(52.dp)
            ) {
                if (vm.isTranslating) {
                    CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp, color = c.onAccent)
                    Spacer(Modifier.width(10.dp))
                    Text("Processing OCR & Translating...", maxLines = 1, overflow = TextOverflow.Ellipsis)
                } else {
                    Text("Extract & Translate", fontWeight = FontWeight.SemiBold)
                }
            }
            OutlinedButton(
                onClick = onTakePhoto,
                shape = appShape,
                border = BorderStroke(1.dp, c.border),
                contentPadding = androidx.compose.foundation.layout.PaddingValues(0.dp),
                modifier = Modifier.size(52.dp)
            ) {
                Icon(Icons.Outlined.PhotoCamera, "Take a photo", tint = c.text)
            }
        }
    }
}

@Composable
private fun ResultCard(
    title: String,
    text: String,
    placeholder: String,
    onTextChange: (String) -> Unit,
    large: Boolean,
    extraAction: (@Composable () -> Unit)?,
    onShare: () -> Unit,
    onCopy: () -> Unit,
) {
    val c = LocalAppColors.current
    Column(
        Modifier
            .fillMaxWidth()
            .border(1.dp, c.border, appShape)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text(title, fontWeight = FontWeight.Bold, fontSize = 15.sp)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            extraAction?.invoke()
            SmallAction(Icons.Outlined.Share, "Share", onClick = onShare)
            SmallAction(Icons.Outlined.ContentCopy, "Copy", onClick = onCopy)
        }
        OutlinedTextField(
            value = text,
            onValueChange = onTextChange,
            placeholder = { Text(placeholder, color = c.textMuted) },
            textStyle = TextStyle(fontSize = if (large) 18.sp else 16.sp, lineHeight = if (large) 30.sp else 24.sp, color = c.text),
            shape = appShape,
            colors = OutlinedTextFieldDefaults.colors(
                focusedContainerColor = c.bgTextBox,
                unfocusedContainerColor = c.bgTextBox,
                unfocusedBorderColor = c.border,
                focusedBorderColor = c.accent,
            ),
            modifier = Modifier
                .fillMaxWidth()
                .heightIn(min = 120.dp)
        )
    }
}

@Composable
private fun SmallAction(icon: ImageVector, label: String, enabled: Boolean = true, onClick: () -> Unit) {
    val c = LocalAppColors.current
    Row(
        Modifier
            .clip(appShape)
            .border(1.dp, c.border, appShape)
            .clickable(enabled = enabled, onClick = onClick)
            .padding(horizontal = 10.dp, vertical = 7.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(icon, null, Modifier.size(15.dp), tint = if (enabled) c.text else c.textMuted)
        Spacer(Modifier.width(6.dp))
        Text(label, fontSize = 13.sp, fontWeight = FontWeight.Medium, color = if (enabled) c.text else c.textMuted)
    }
}

@Composable
private fun HistorySection(
    items: List<HistoryItem>,
    expanded: Boolean,
    onToggle: () -> Unit,
    onOpen: (HistoryItem) -> Unit,
    onDelete: (String) -> Unit,
) {
    val c = LocalAppColors.current
    val chevron by animateFloatAsState(if (expanded) 0f else -90f, label = "chevron")
    val context = LocalContext.current // DateUtils needs it for the 12/24-hour setting
    Column(
        Modifier
            .fillMaxWidth()
            .border(1.dp, c.border, appShape)
    ) {
        Row(
            Modifier
                .fillMaxWidth()
                .clickable(onClick = onToggle)
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(Icons.Outlined.AccessTime, null, Modifier.size(18.dp))
            Spacer(Modifier.width(8.dp))
            Text("Recent Translations", fontWeight = FontWeight.Bold, fontSize = 15.sp, modifier = Modifier.weight(1f))
            Icon(Icons.Outlined.ExpandMore, if (expanded) "Collapse" else "Expand", Modifier.rotate(chevron))
        }
        if (expanded) {
            HorizontalDivider(color = c.border)
            if (items.isEmpty()) {
                Text(
                    "No translation history yet.",
                    color = c.textMuted, fontSize = 14.sp,
                    modifier = Modifier.padding(16.dp)
                )
            } else {
                items.forEachIndexed { i, item ->
                    if (i > 0) HorizontalDivider(color = c.border)
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Column(
                            Modifier
                                .weight(1f)
                                .clickable { onOpen(item) }
                                .padding(start = 16.dp, top = 12.dp, bottom = 12.dp, end = 8.dp),
                            verticalArrangement = Arrangement.spacedBy(3.dp)
                        ) {
                            Text(item.translation, maxLines = 2, overflow = TextOverflow.Ellipsis, fontWeight = FontWeight.Medium, fontSize = 14.sp)
                            Text(item.ocr, maxLines = 1, overflow = TextOverflow.Ellipsis, color = c.textSecondary, fontSize = 13.sp)
                            Text(
                                DateUtils.formatDateTime(
                                    context, item.timestamp,
                                    DateUtils.FORMAT_SHOW_DATE or DateUtils.FORMAT_ABBREV_MONTH or DateUtils.FORMAT_SHOW_TIME
                                ),
                                color = c.textMuted, fontSize = 12.sp
                            )
                        }
                        IconButton(onClick = { onDelete(item.id) }) {
                            Icon(Icons.Outlined.Delete, "Delete record", tint = c.textMuted)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun Footer(onPrivacy: () -> Unit, onTerms: () -> Unit, onLink: (String) -> Unit) {
    val c = LocalAppColors.current
    Column(
        Modifier
            .fillMaxWidth()
            .padding(top = 4.dp, bottom = 16.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        FlowRow(horizontalArrangement = Arrangement.Center) {
            FooterLink("Privacy", onPrivacy)
            FooterLink("Terms", onTerms)
            FooterLink("GitHub") { onLink(GITHUB_URL) }
            FooterLink("Report a bug") { onLink(ISSUES_URL) }
        }
        Text("© 2026 MalTranslate", color = c.textMuted, fontSize = 12.sp)
    }
}

@Composable
private fun FooterLink(label: String, onClick: () -> Unit) {
    TextButton(onClick = onClick) {
        Text(label, color = LocalAppColors.current.textSecondary, fontSize = 13.sp)
    }
}

// ---- Platform helpers ----

fun openUrl(context: Context, url: String) {
    runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) }
}

private fun copyText(context: Context, text: String, success: String, vm: MainViewModel) {
    if (text.isEmpty()) return
    val cm = context.getSystemService(ClipboardManager::class.java)
    cm?.setPrimaryClip(ClipData.newPlainText("MalTranslate", text))
    vm.toast(success)
}

private fun shareText(context: Context, text: String, vm: MainViewModel) {
    if (text.isEmpty()) {
        vm.toast("Nothing to share yet.")
        return
    }
    val send = Intent(Intent.ACTION_SEND).apply {
        type = "text/plain"
        putExtra(Intent.EXTRA_TEXT, text)
    }
    context.startActivity(Intent.createChooser(send, null))
}
