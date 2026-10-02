package com.renderwalk.camera.insta360

import android.webkit.JavascriptInterface
import android.webkit.WebView

/**
 * JavaScript / WebView Interface for the Insta360 Android Camera Bridge.
 *
 * Placed in WebView via:
 * webView.addJavascriptInterface(Insta360BridgeModule(adapter, webView), "RenderWalkInsta360Bridge")
 */
class Insta360BridgeModule(
    private val adapter: Insta360BridgeContract,
    private val webView: WebView? = null
) {
    init {
        // Forward native camera events into JavaScript
        adapter.addEventListener { event ->
            webView?.post {
                val script = "window.__RENDERWALK_DISPATCH_CAMERA_EVENT__ && window.__RENDERWALK_DISPATCH_CAMERA_EVENT__('${event.eventType.name}', ${event.payloadJson});"
                webView.evaluateJavascript(script, null)
            }
        }
    }

    @JavascriptInterface
    fun isSdkConfigured(): Boolean {
        return adapter.getStatus().contains("\"state\": \"SDK_NOT_CONFIGURED\"").not()
    }

    @JavascriptInterface
    fun discover(): String {
        return adapter.discover()
    }

    @JavascriptInterface
    fun connect(deviceId: String): Boolean {
        return try {
            adapter.connect(deviceId)
        } catch (_: Exception) {
            false
        }
    }

    @JavascriptInterface
    fun disconnect() {
        adapter.disconnect()
    }

    @JavascriptInterface
    fun getStatus(): String {
        return adapter.getStatus()
    }

    @JavascriptInterface
    fun getCapabilities(): String {
        return try {
            adapter.getCapabilities()
        } catch (e: Exception) {
            """{"error": "${e.message}"}"""
        }
    }

    @JavascriptInterface
    fun startPreview(): String {
        return try {
            adapter.startPreview()
        } catch (e: Exception) {
            """{"error": "PREVIEW_NOT_AVAILABLE"}"""
        }
    }

    @JavascriptInterface
    fun stopPreview() {
        adapter.stopPreview()
    }

    @JavascriptInterface
    fun capture(): String {
        return adapter.capture()
    }

    @JavascriptInterface
    fun captureHDR(paramsJson: String): String {
        return adapter.captureHDR(paramsJson)
    }

    @JavascriptInterface
    fun listMedia(): String {
        return adapter.listMedia()
    }

    @JavascriptInterface
    fun downloadMedia(mediaId: String, destinationPath: String): String {
        return adapter.downloadMedia(mediaId, destinationPath)
    }

    @JavascriptInterface
    fun deleteMedia(mediaId: String): Boolean {
        return adapter.deleteMedia(mediaId)
    }

    @JavascriptInterface
    fun getBattery(): String? {
        return adapter.getBattery()
    }

    @JavascriptInterface
    fun getStorage(): String? {
        return adapter.getStorage()
    }

    @JavascriptInterface
    fun getIMU(): String? {
        return adapter.getIMU()
    }
}
