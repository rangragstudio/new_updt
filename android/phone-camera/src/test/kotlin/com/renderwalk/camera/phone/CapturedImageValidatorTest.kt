package com.renderwalk.camera.phone

import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File
import java.io.FileOutputStream

class CapturedImageValidatorTest {

    @get:Rule
    val tempFolder = TemporaryFolder()

    @Test
    fun testNullFileRejection() {
        val result = CapturedImageValidator.validate(null)
        assertTrue(result is ValidationResult.Invalid)
        val reason = (result as ValidationResult.Invalid).reason
        assertTrue(reason.contains("null"))
    }

    @Test
    fun testNonExistentFileRejection() {
        val fakeFile = File(tempFolder.root, "does_not_exist.jpg")
        val result = CapturedImageValidator.validate(fakeFile)
        assertTrue(result is ValidationResult.Invalid)
        val reason = (result as ValidationResult.Invalid).reason
        assertTrue(reason.contains("does not exist"))
    }

    @Test
    fun testEmptyZeroByteFileRejection() {
        val emptyFile = tempFolder.newFile("empty.jpg")
        val result = CapturedImageValidator.validate(emptyFile)
        assertTrue(result is ValidationResult.Invalid)
        val reason = (result as ValidationResult.Invalid).reason
        assertTrue(reason.contains("empty (0 bytes)"))
    }

    @Test
    fun testCorruptBytesFileRejection() {
        val corruptFile = tempFolder.newFile("corrupt.jpg")
        FileOutputStream(corruptFile).use { fos ->
            fos.write(byteArrayOf(0x01, 0x02, 0x03, 0x04))
        }
        val result = CapturedImageValidator.validate(corruptFile)
        assertTrue(result is ValidationResult.Invalid)
    }

    @Test
    fun testPhoneCameraModelInvariants() {
        val photoFile = tempFolder.newFile("test_photo.jpg")
        FileOutputStream(photoFile).use { fos ->
            fos.write(byteArrayOf(0xFF.toByte(), 0xD8.toByte(), 0xFF.toByte()))
        }

        val photo = CapturedPhoto(
            file = photoFile,
            uri = android.net.Uri.EMPTY,
            width = 1920,
            height = 1080,
            fileSizeBytes = photoFile.length(),
            captureTimestamp = 1700000000000L,
            facing = CameraLensFacing.BACK
        )

        assertEquals(1920, photo.width)
        assertEquals(1080, photo.height)
        assertEquals(CameraLensFacing.BACK, photo.facing)
        assertEquals("image/jpeg", photo.mimeType)
        assertTrue(photo.file.exists())
    }
}
