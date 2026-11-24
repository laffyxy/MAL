package com.maltranslate.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.Visibility
import androidx.compose.material.icons.outlined.VisibilityOff
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.LinkAnnotation
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextLinkStyles
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withLink
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.maltranslate.app.data.GEMINI_MODELS

@Composable
private fun DialogCard(content: @Composable () -> Unit) {
    val c = LocalAppColors.current
    Column(
        Modifier
            .fillMaxWidth()
            .background(c.bg, appShape)
            .border(1.dp, c.border, appShape)
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) { content() }
}

@Composable
fun SettingsDialog(
    initialKey: String,
    initialModel: String,
    onOpenUrl: (String) -> Unit,
    onDismiss: () -> Unit,
    onSave: (String, String) -> Unit,
) {
    val c = LocalAppColors.current
    var key by rememberSaveable { mutableStateOf(initialKey) }
    var model by rememberSaveable { mutableStateOf(initialModel) }
    var showKey by rememberSaveable { mutableStateOf(false) }

    Dialog(onDismissRequest = onDismiss) {
        DialogCard {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Settings", fontFamily = InterTight, fontWeight = FontWeight.Bold, fontSize = 20.sp, modifier = Modifier.weight(1f))
                IconButton(onClick = onDismiss) { Icon(Icons.Outlined.Close, "Close settings") }
            }

            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Gemini API Key", fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                OutlinedTextField(
                    value = key,
                    onValueChange = { key = it },
                    placeholder = { Text("Enter AI Studio API Key", color = c.textMuted) },
                    singleLine = true,
                    visualTransformation = if (showKey) VisualTransformation.None else PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, autoCorrectEnabled = false),
                    trailingIcon = {
                        IconButton(onClick = { showKey = !showKey }) {
                            Icon(
                                if (showKey) Icons.Outlined.VisibilityOff else Icons.Outlined.Visibility,
                                if (showKey) "Hide API key" else "Show API key"
                            )
                        }
                    },
                    shape = appShape,
                    colors = OutlinedTextFieldDefaults.colors(unfocusedBorderColor = c.border, focusedBorderColor = c.accent),
                    modifier = Modifier.fillMaxWidth()
                )
                Text(
                    buildAnnotatedString {
                        append("Don't have a key? Get one for free at ")
                        withLink(
                            LinkAnnotation.Clickable(
                                "aistudio",
                                TextLinkStyles(SpanStyle(color = c.text, textDecoration = TextDecoration.Underline))
                            ) { onOpenUrl("https://aistudio.google.com/") }
                        ) { append("Google AI Studio") }
                        append(".")
                    },
                    fontSize = 13.sp, color = c.textSecondary
                )
            }

            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text("Gemini Model", fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                GEMINI_MODELS.forEach { m ->
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .selectable(selected = model == m.id, role = Role.RadioButton) { model = m.id }
                            .padding(vertical = 2.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        RadioButton(selected = model == m.id, onClick = null)
                        Spacer(Modifier.width(10.dp))
                        Text(m.label, fontSize = 14.sp)
                    }
                }
                Text(
                    "\"Flash\" models are faster and highly accurate for text extraction and translation.",
                    fontSize = 13.sp, color = c.textSecondary
                )
            }

            Button(
                onClick = { onSave(key, model) },
                shape = appShape,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(48.dp)
            ) { Text("Save Configuration", fontWeight = FontWeight.SemiBold) }
        }
    }
}

@Composable
fun ConsentDialog(onShowPrivacy: () -> Unit, onShowTerms: () -> Unit, onAccept: () -> Unit) {
    val c = LocalAppColors.current
    var checked by rememberSaveable { mutableStateOf(false) }
    Dialog(
        onDismissRequest = {},
        properties = DialogProperties(dismissOnBackPress = false, dismissOnClickOutside = false)
    ) {
        DialogCard {
            Row(verticalAlignment = Alignment.CenterVertically) {
                AppLogo(36)
                Spacer(Modifier.width(12.dp))
                Text("Welcome to MalTranslate", fontFamily = InterTight, fontWeight = FontWeight.Bold, fontSize = 20.sp)
            }
            Text(
                "MalTranslate sends the images you choose to Google's Gemini API to read and translate them. " +
                    "Your API key, settings and history stay on this device.",
                color = c.textSecondary, fontSize = 14.sp, lineHeight = 21.sp
            )
            Row(
                Modifier.clickable { checked = !checked },
                verticalAlignment = Alignment.CenterVertically
            ) {
                Checkbox(checked = checked, onCheckedChange = { checked = it })
                val link = TextLinkStyles(SpanStyle(color = c.text, textDecoration = TextDecoration.Underline))
                Text(
                    buildAnnotatedString {
                        append("I have read and agree to the ")
                        withLink(LinkAnnotation.Clickable("privacy", link) { onShowPrivacy() }) { append("Privacy Policy") }
                        append(" and ")
                        withLink(LinkAnnotation.Clickable("terms", link) { onShowTerms() }) { append("Terms of Use") }
                        append(".")
                    },
                    fontSize = 14.sp
                )
            }
            Button(
                onClick = onAccept,
                enabled = checked,
                shape = appShape,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(48.dp)
            ) { Text("Continue", fontWeight = FontWeight.SemiBold) }
        }
    }
}

@Composable
fun PolicyDialog(doc: PolicyDoc, onDismiss: () -> Unit) {
    val c = LocalAppColors.current
    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false)
    ) {
        Column(
            Modifier
                .fillMaxSize()
                .background(c.bg)
                .safeDrawingPadding()
        ) {
            Row(Modifier.padding(horizontal = 8.dp, vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onDismiss) { Icon(Icons.Outlined.Close, "Close") }
                Text(doc.title, fontWeight = FontWeight.Bold, fontSize = 18.sp)
            }
            Column(
                Modifier
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 20.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Text(doc.updated, color = c.textMuted, fontSize = 13.sp)
                doc.sections.forEach { s ->
                    s.heading?.let {
                        Spacer(Modifier.height(6.dp))
                        Text(it, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                    }
                    s.paragraphs.forEach { p ->
                        Text(p, color = c.textSecondary, fontSize = 14.sp, lineHeight = 21.sp)
                    }
                }
                Spacer(Modifier.height(24.dp))
            }
        }
    }
}
