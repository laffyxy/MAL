package com.maltranslate.app.data

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.Paint
import android.media.ExifInterface
import android.net.Uri
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/** Crop as 0..1 fractions of the rotated image. */
data class CropRect(val x: Float = 0f, val y: Float = 0f, val w: Float = 1f, val h: Float = 1f) {
    val isFull get() = x <= 0.001f && y <= 0.001f && w >= 0.999f && h >= 0.999f
}

data class ImageEdit(val rotation: Int = 0, val crop: CropRect = CropRect())

object ImageTools {
    /** Longest side of the picture sent to Gemini, as in the PWA. */
    const val MAX_UPLOAD_DIM = 1200

    /** Longest side kept in memory as the editable source (enough detail for cropping). */
    private const val MAX_SOURCE_DIM = 3000

    /** Decode a picture, honouring its EXIF orientation, without loading a 48 MP photo at full size. */
    suspend fun decode(context: Context, uri: Uri): Bitmap? = withContext(Dispatchers.IO) {
        runCatching {
            val resolver = context.contentResolver
            val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            resolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, bounds) }
            if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return@runCatching null

            var sample = 1
            while (max(bounds.outWidth, bounds.outHeight) / (sample * 2) >= MAX_SOURCE_DIM) sample *= 2
            val opts = BitmapFactory.Options().apply { inSampleSize = sample }
            val bitmap = resolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, opts) }
                ?: return@runCatching null

            val orientation = resolver.openInputStream(uri)?.use {
                ExifInterface(it).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)
            } ?: ExifInterface.ORIENTATION_NORMAL
            applyExif(bitmap, orientation)
        }.getOrNull()
    }

    fun decodeFile(path: String): Bitmap? = BitmapFactory.decodeFile(path)

    private fun applyExif(bitmap: Bitmap, orientation: Int): Bitmap {
        val m = Matrix()
        when (orientation) {
            ExifInterface.ORIENTATION_ROTATE_90 -> m.postRotate(90f)
            ExifInterface.ORIENTATION_ROTATE_180 -> m.postRotate(180f)
            ExifInterface.ORIENTATION_ROTATE_270 -> m.postRotate(270f)
            ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> m.postScale(-1f, 1f)
            ExifInterface.ORIENTATION_FLIP_VERTICAL -> m.postScale(1f, -1f)
            ExifInterface.ORIENTATION_TRANSPOSE -> { m.postRotate(90f); m.postScale(-1f, 1f) }
            ExifInterface.ORIENTATION_TRANSVERSE -> { m.postRotate(270f); m.postScale(-1f, 1f) }
            else -> return bitmap
        }
        return Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, m, true)
    }

    fun rotatedSize(src: Bitmap, rotation: Int): Pair<Int, Int> =
        if (rotation % 180 == 0) src.width to src.height else src.height to src.width

    /** Rotate (0/90/180/270 clockwise), crop and scale [src] so its longest side is at most [maxDim]. */
    fun render(src: Bitmap, edit: ImageEdit, maxDim: Int): Bitmap {
        val (rw, rh) = rotatedSize(src, edit.rotation)
        val c = edit.crop
        val cx = c.x * rw
        val cy = c.y * rh
        val cw = c.w * rw
        val ch = c.h * rh
        val scale = min(1f, maxDim / max(cw, ch))

        val out = Bitmap.createBitmap(
            max(1, (cw * scale).roundToInt()),
            max(1, (ch * scale).roundToInt()),
            Bitmap.Config.ARGB_8888
        )
        val canvas = Canvas(out)
        canvas.drawColor(Color.WHITE) // JPEG has no alpha: keep transparent PNGs from turning black

        val m = Matrix()
        when (edit.rotation) {
            90 -> { m.postRotate(90f); m.postTranslate(src.height.toFloat(), 0f) }
            180 -> { m.postRotate(180f); m.postTranslate(src.width.toFloat(), src.height.toFloat()) }
            270 -> { m.postRotate(270f); m.postTranslate(0f, src.width.toFloat()) }
        }
        m.postTranslate(-cx, -cy)
        m.postScale(scale, scale)
        canvas.drawBitmap(src, m, Paint(Paint.FILTER_BITMAP_FLAG or Paint.ANTI_ALIAS_FLAG))
        return out
    }

    fun toJpeg(bitmap: Bitmap, quality: Int = 85): ByteArray =
        ByteArrayOutputStream().use { bitmap.compress(Bitmap.CompressFormat.JPEG, quality, it); it.toByteArray() }

    /** Rotate a crop box by ±90 degrees together with the picture. */
    fun rotateCrop(c: CropRect, clockwise: Boolean): CropRect =
        if (clockwise) CropRect(1 - (c.y + c.h), c.x, c.h, c.w)
        else CropRect(c.y, 1 - (c.x + c.w), c.h, c.w)
}
