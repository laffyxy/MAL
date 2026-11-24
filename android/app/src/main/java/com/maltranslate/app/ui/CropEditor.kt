package com.maltranslate.app.ui

import android.graphics.Bitmap
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.drag
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.RotateLeft
import androidx.compose.material.icons.automirrored.outlined.RotateRight
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.input.pointer.positionChange
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.maltranslate.app.data.CropRect
import com.maltranslate.app.data.ImageEdit
import com.maltranslate.app.data.ImageTools
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlin.math.abs
import kotlin.math.min


/** Full-screen crop & rotate editor. Edits are always applied to the original picture. */
@Composable
fun CropEditor(source: Bitmap, initial: ImageEdit, onCancel: () -> Unit, onDone: (ImageEdit) -> Unit) {
    var rotation by remember { mutableStateOf(initial.rotation) }
    var crop by remember { mutableStateOf(initial.crop) }

    // Rotated picture, downscaled for the screen
    val shown by produceState<Bitmap?>(null, source, rotation) {
        value = withContext(Dispatchers.Default) { ImageTools.render(source, ImageEdit(rotation), 1600) }
    }

    Dialog(
        onDismissRequest = onCancel,
        properties = DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false)
    ) {
        Column(
            Modifier
                .fillMaxSize()
                .background(Color(0xFF0A0A0A))
                .safeDrawingPadding()
        ) {
            Row(
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 8.dp, vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                TextButton(onClick = onCancel) { Text("Cancel", color = Color(0xFFA3A3A3)) }
                Text(
                    "Crop & rotate", color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = 16.sp,
                    modifier = Modifier.weight(1f), textAlign = androidx.compose.ui.text.style.TextAlign.Center
                )
                TextButton(onClick = {
                    onDone(ImageEdit(rotation, if (crop.isFull) CropRect() else crop))
                }) { Text("Done", color = Color.White, fontWeight = FontWeight.Bold) }
            }

            BoxWithConstraints(
                Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .padding(horizontal = 8.dp),
                contentAlignment = Alignment.Center
            ) {
                val bmp = shown
                if (bmp != null) {
                    val density = LocalDensity.current
                    // Touch margin around the picture, so handles on its border can be grabbed from outside too
                    val marginDp = 28.dp
                    val margin = with(density) { marginDp.toPx() }
                    val availW = with(density) { maxWidth.toPx() } - 2 * margin
                    val availH = with(density) { maxHeight.toPx() } - 2 * margin
                    val fit = min(availW / bmp.width, availH / bmp.height)
                    val wPx = bmp.width * fit
                    val hPx = bmp.height * fit
                    val wDp = with(density) { wPx.toDp() }
                    val hDp = with(density) { hPx.toDp() }
                    val minPx = with(density) { 48.dp.toPx() }
                    val reach = with(density) { 28.dp.toPx() }
                    val currentCrop by rememberUpdatedState(crop)

                    Box(
                        Modifier
                            .size(wDp + marginDp * 2, hDp + marginDp * 2)
                            .pointerInput(wPx, hPx) {
                                awaitEachGesture {
                                    // Pick the handle where the finger lands, and follow it without any touch slop
                                    val down = awaitFirstDown()
                                    val p = down.position - Offset(margin, margin)
                                    val start = currentCrop
                                    val grab = pickGrab(
                                        p, start.x * wPx, start.y * hPx,
                                        (start.x + start.w) * wPx, (start.y + start.h) * hPx, reach
                                    ) ?: return@awaitEachGesture
                                    down.consume()
                                    var total = Offset.Zero
                                    drag(down.id) { change ->
                                        total += change.positionChange()
                                        change.consume()
                                        crop = moveEdges(start, grab, total.x / wPx, total.y / hPx,
                                            min(1f, minPx / wPx), min(1f, minPx / hPx))
                                    }
                                }
                            }
                            .padding(marginDp)
                    ) {
                        Image(
                            bmp.asImageBitmap(), null,
                            modifier = Modifier.fillMaxSize(),
                            contentScale = ContentScale.FillBounds
                        )
                        Canvas(Modifier.fillMaxSize()) {
                            val l = crop.x * size.width
                            val t = crop.y * size.height
                            val r = (crop.x + crop.w) * size.width
                            val b = (crop.y + crop.h) * size.height
                            val dim = Color.Black.copy(alpha = 0.55f)
                            drawRect(dim, Offset.Zero, Size(size.width, t))
                            drawRect(dim, Offset(0f, b), Size(size.width, size.height - b))
                            drawRect(dim, Offset(0f, t), Size(l, b - t))
                            drawRect(dim, Offset(r, t), Size(size.width - r, b - t))
                            drawRect(Color.White, Offset(l, t), Size(r - l, b - t), style = Stroke(2.dp.toPx()))
                            // Rule-of-thirds guides
                            val guide = Color.White.copy(alpha = 0.35f)
                            for (i in 1..2) {
                                val x = l + (r - l) * i / 3f
                                val y = t + (b - t) * i / 3f
                                drawLine(guide, Offset(x, t), Offset(x, b), 1.dp.toPx())
                                drawLine(guide, Offset(l, y), Offset(r, y), 1.dp.toPx())
                            }
                            // Corner brackets and mid-edge bars show what can be dragged
                            val len = min(22.dp.toPx(), min(r - l, b - t) / 3)
                            val th = 4.dp.toPx()
                            fun bar(x: Float, y: Float, w: Float, h: Float) =
                                drawRect(Color.White, Offset(x, y), Size(w, h))
                            bar(l - th / 2, t - th / 2, len, th); bar(l - th / 2, t - th / 2, th, len)
                            bar(r - len + th / 2, t - th / 2, len, th); bar(r - th / 2, t - th / 2, th, len)
                            bar(l - th / 2, b - th / 2, len, th); bar(l - th / 2, b - len + th / 2, th, len)
                            bar(r - len + th / 2, b - th / 2, len, th); bar(r - th / 2, b - len + th / 2, th, len)
                            val mid = len * 0.9f
                            bar((l + r) / 2 - mid / 2, t - th / 2, mid, th)
                            bar((l + r) / 2 - mid / 2, b - th / 2, mid, th)
                            bar(l - th / 2, (t + b) / 2 - mid / 2, th, mid)
                            bar(r - th / 2, (t + b) / 2 - mid / 2, th, mid)
                        }
                    }
                }
            }

            Row(
                Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                horizontalArrangement = Arrangement.SpaceEvenly,
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = {
                    crop = ImageTools.rotateCrop(crop, clockwise = false)
                    rotation = (rotation + 270) % 360
                }) { Icon(Icons.AutoMirrored.Outlined.RotateLeft, "Rotate left", tint = Color.White) }
                TextButton(onClick = { rotation = 0; crop = CropRect() }) { Text("Reset", color = Color.White) }
                IconButton(onClick = {
                    crop = ImageTools.rotateCrop(crop, clockwise = true)
                    rotation = (rotation + 90) % 360
                }) { Icon(Icons.AutoMirrored.Outlined.RotateRight, "Rotate right", tint = Color.White) }
            }
        }
    }
}

/** Which edges a drag moves; none of them means the whole box moves. */
private data class Grab(val left: Boolean, val top: Boolean, val right: Boolean, val bottom: Boolean) {
    val isMove get() = !left && !top && !right && !bottom
}

/**
 * Work out what the finger at [p] grabbed. Each edge reaches [reach] px outward, and inward up to a
 * quarter of the box, so a small box can still be moved from its middle. Touching two edges = a corner.
 * Returns null for a touch outside the box and its handles.
 */
private fun pickGrab(p: Offset, l: Float, t: Float, r: Float, b: Float, reach: Float): Grab? {
    val inX = min(reach, (r - l) / 4)
    val inY = min(reach, (b - t) / 4)
    val withinY = p.y in (t - reach)..(b + reach)
    val withinX = p.x in (l - reach)..(r + reach)
    var left = withinY && p.x - l in -reach..inX
    var right = withinY && r - p.x in -reach..inX
    var top = withinX && p.y - t in -reach..inY
    var bottom = withinX && b - p.y in -reach..inY
    if (left && right) { if (abs(p.x - l) <= abs(p.x - r)) right = false else left = false }
    if (top && bottom) { if (abs(p.y - t) <= abs(p.y - b)) bottom = false else top = false }
    val grab = Grab(left, top, right, bottom)
    if (!grab.isMove) return grab
    return if (p.x in l..r && p.y in t..b) grab else null
}

/** Move edges of the crop box, keeping it inside the image and above a minimum size. */
private fun moveEdges(start: CropRect, grab: Grab, dx: Float, dy: Float, minW: Float, minH: Float): CropRect {
    var left = start.x
    var top = start.y
    var right = start.x + start.w
    var bottom = start.y + start.h
    if (grab.isMove) {
        left = (start.x + dx).coerceIn(0f, 1f - start.w)
        top = (start.y + dy).coerceIn(0f, 1f - start.h)
        right = left + start.w
        bottom = top + start.h
    } else {
        if (grab.left) left = (left + dx).coerceIn(0f, right - minW)
        if (grab.right) right = (right + dx).coerceIn(left + minW, 1f)
        if (grab.top) top = (top + dy).coerceIn(0f, bottom - minH)
        if (grab.bottom) bottom = (bottom + dy).coerceIn(top + minH, 1f)
    }
    return CropRect(left, top, right - left, bottom - top)
}
