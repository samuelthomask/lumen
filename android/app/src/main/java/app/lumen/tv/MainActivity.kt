package app.lumen.tv

// Lumen pro Android TV: celé okno je WebView s rozhraním (stremio-web přibalené v APK), pod ním nativní video (Media3).
// Rozhraní mluví s obalem stejným protokolem jako ve Windows (window.chrome.webview, JSON zprávy, viz NOTES.md);
// tady ho zajišťuje skript vložený do index.html a JavaScript rozhraní "LumenAndroid".
// Torrentový server na Androidu neběží: přehrávají se jen přímé HTTP(S) odkazy (např. debrid).

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.ConsoleMessage
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.Toast
import androidx.media3.ui.PlayerView
import androidx.webkit.WebViewAssetLoader
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.io.InputStream

class MainActivity : Activity() {

    private lateinit var web: WebView
    private lateinit var playerView: PlayerView
    private lateinit var player: LumenPlayer
    private var fullscreen = false
    private var lastBackPress = 0L
    private var fileCallback: ValueCallback<Array<Uri>>? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN)

        val root = FrameLayout(this)
        root.setBackgroundColor(Color.BLACK)
        playerView = PlayerView(this)
        root.addView(playerView, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))

        WebView.setWebContentsDebuggingEnabled(true)   // ladění z počítače přes chrome://inspect (ADB)
        web = WebView(this)
        web.setBackgroundColor(Color.TRANSPARENT)       // video prosvítá pod průhledným rozhraním
        root.addView(web, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        setContentView(root)

        player = LumenPlayer(this, playerView) { name, data -> sendSignal(name, data) }
        player.onPlayingChanged = { playing ->
            if (playing) window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            else window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        }

        setupWebView()
        web.loadUrl("https://$HOST/index.html")
        web.requestFocus()
        hideSystemUi()
    }

    private fun setupWebView() {
        val s = web.settings
        s.javaScriptEnabled = true
        s.domStorageEnabled = true
        @Suppress("DEPRECATION")
        s.databaseEnabled = true
        s.mediaPlaybackRequiresUserGesture = false
        s.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW   // některé doplňky běží jen přes http
        // web si nastaví viewport width=1280 a tady se zmenší na šířku obrazovky (televize má jinak jen ~960 px CSS)
        s.loadWithOverviewMode = true
        s.useWideViewPort = true
        s.setSupportZoom(false)
        s.builtInZoomControls = false
        s.javaScriptCanOpenWindowsAutomatically = false
        s.setSupportMultipleWindows(false)
        // Rozhraní podle User-Agentu pozná „mobil“ a přepne na dotykové rozložení. Televize se má chovat jako počítač.
        val chrome = Regex("Chrome/[0-9.]+").find(s.userAgentString)?.value ?: "Chrome/120.0.0.0"
        s.userAgentString = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) $chrome Safari/537.36 LumenTV/${BuildConfigCompat.versionName(this)}"

        web.isFocusable = true
        web.isFocusableInTouchMode = true
        web.addJavascriptInterface(Bridge(), "LumenAndroid")

        val loader = WebViewAssetLoader.Builder()
            .setDomain(HOST)
            .addPathHandler("/", WebAssets())
            .build()

        web.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                loader.shouldInterceptRequest(request.url)

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val uri = request.url
                if (uri.host == HOST) return false
                openExternal(uri)
                return true
            }
        }

        web.webChromeClient = object : WebChromeClient() {
            override fun onConsoleMessage(m: ConsoleMessage): Boolean {
                Log.d("LumenWeb", "${m.message()} (${m.sourceId()}:${m.lineNumber()})")
                return true
            }

            // výběr souboru (import profilu .lumen, titulky ze souboru)
            override fun onShowFileChooser(view: WebView, callback: ValueCallback<Array<Uri>>, params: FileChooserParams): Boolean {
                fileCallback?.onReceiveValue(null)
                fileCallback = callback
                val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*")
                return try {
                    @Suppress("DEPRECATION")
                    startActivityForResult(intent, REQUEST_FILE)
                    true
                } catch (e: ActivityNotFoundException) {
                    fileCallback = null
                    Toast.makeText(this@MainActivity, "Výběr souborů není na tomto zařízení k dispozici", Toast.LENGTH_LONG).show()
                    false
                }
            }
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        @Suppress("DEPRECATION")
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == REQUEST_FILE) {
            val uri = data?.data
            fileCallback?.onReceiveValue(if (resultCode == RESULT_OK && uri != null) arrayOf(uri) else null)
            fileCallback = null
        }
    }

    private fun openExternal(uri: Uri) {
        try {
            startActivity(Intent(Intent.ACTION_VIEW, uri))
        } catch (e: ActivityNotFoundException) {
            Toast.makeText(this, uri.toString(), Toast.LENGTH_LONG).show()   // televize často nemá prohlížeč
        }
    }

    // MARK: přibalené rozhraní (assets/web)

    private inner class WebAssets : WebViewAssetLoader.PathHandler {
        override fun handle(path: String): WebResourceResponse? {
            val file = if (path.isEmpty() || path.endsWith("/")) path + "index.html" else path
            val stream: InputStream = try {
                assets.open("web/$file")
            } catch (e: Exception) {
                return WebResourceResponse("text/plain", "utf-8", 404, "Not Found", null, ByteArrayInputStream(ByteArray(0)))
            }
            if (file == "index.html") {
                // most k obalu musí existovat dřív, než se spustí skripty rozhraní
                val html = stream.bufferedReader().use { it.readText() }
                val patched = html.replaceFirst("<head>", "<head><script>$BRIDGE_JS</script>")
                return WebResourceResponse("text/html", "utf-8", ByteArrayInputStream(patched.toByteArray()))
            }
            return WebResourceResponse(mimeType(file), null, stream)
        }
    }

    private fun mimeType(path: String): String = when (path.substringAfterLast('.', "").lowercase()) {
        "html" -> "text/html"
        "js", "mjs" -> "text/javascript"
        "css" -> "text/css"
        "json", "map" -> "application/json"
        "wasm" -> "application/wasm"
        "svg" -> "image/svg+xml"
        "png" -> "image/png"
        "jpg", "jpeg" -> "image/jpeg"
        "webp" -> "image/webp"
        "gif" -> "image/gif"
        "ico" -> "image/x-icon"
        "woff" -> "font/woff"
        "woff2" -> "font/woff2"
        "ttf" -> "font/ttf"
        "otf" -> "font/otf"
        "txt" -> "text/plain"
        else -> "application/octet-stream"
    }

    // MARK: protokol s rozhraním

    private fun send(obj: JSONObject) {
        val js = "window.__lumenReceive && window.__lumenReceive(${JSONObject.quote(obj.toString())})"
        web.post { web.evaluateJavascript(js, null) }
    }

    private fun sendSignal(name: String, data: Any?) {
        send(JSONObject().put("type", 1).put("args", JSONArray().put(name).put(data ?: JSONObject.NULL)))
    }

    private fun sendVisibility() {
        sendSignal("win-visibility-changed", JSONObject()
            .put("visible", true).put("visibility", if (fullscreen) 5 else 2).put("isFullscreen", fullscreen))
    }

    private inner class Bridge {
        @JavascriptInterface
        fun postMessage(text: String) {
            runOnUiThread { handleMessage(text) }
        }
    }

    private fun handleMessage(text: String) {
        val msg = try { JSONObject(text) } catch (e: Exception) { return }
        when (msg.optInt("type")) {
            3 -> {   // INIT: vlastnosti obalu
                fun prop(name: String, value: String) = JSONArray().put(0).put(name).put(0).put(value)
                val props = JSONArray()
                    .put(prop("shellVersion", "lumen-android ${BuildConfigCompat.versionName(this)}"))
                    .put(prop("gpuVideoProcessing", "false"))
                    .put(prop("nativeAssSubtitles", "false"))
                    .put(prop("cacheDirectoryPicker", "false"))
                    .put(prop("nativeInterfaceScale", "false"))
                send(JSONObject().put("id", 0).put("type", 3)
                    .put("data", JSONObject().put("transport", JSONObject().put("properties", props))))
                sendVisibility()
            }
            6 -> {
                val args = msg.optJSONArray("args") ?: return
                val method = args.optString(0)
                val arg1 = if (args.length() > 1) args.opt(1) else null
                when (method) {
                    "mpv-command" -> (arg1 as? JSONArray)?.let { list ->
                        player.command((0 until list.length()).map { LumenPlayer.mpvString(list.opt(it)) })
                    }
                    "mpv-set-prop" -> (arg1 as? JSONArray)?.let { pair ->
                        if (pair.length() == 2) player.setProperty(pair.optString(0), pair.opt(1))
                    }
                    "mpv-observe-prop" -> (arg1 as? String)?.let { player.observe(it) }
                    "win-set-visibility" -> (arg1 as? JSONObject)?.let {
                        fullscreen = it.optBoolean("fullscreen", fullscreen)   // na televizi je okno vždy přes celou obrazovku
                        sendVisibility()
                    }
                    "quit" -> finish()
                    else -> Unit   // app-ready, media.*, discord-* … ignorujeme
                }
            }
        }
    }

    // MARK: dálkový ovladač

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (event.action == KeyEvent.ACTION_DOWN && player.hasMedia()) {
            when (event.keyCode) {
                KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE, KeyEvent.KEYCODE_MEDIA_PLAY, KeyEvent.KEYCODE_MEDIA_PAUSE -> {
                    if (event.repeatCount == 0) player.togglePause()
                    return true
                }
                KeyEvent.KEYCODE_MEDIA_FAST_FORWARD -> { player.seekBy(30_000); return true }
                KeyEvent.KEYCODE_MEDIA_REWIND -> { player.seekBy(-10_000); return true }
            }
        }
        return super.dispatchKeyEvent(event)
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        // nejdřív se zeptáme rozhraní (zavřít nabídku, odejít z přehrávače, krok zpět); když už nemá kam, aplikace skončí
        web.evaluateJavascript("(function(){try{return !!(window.__lumenBack && window.__lumenBack());}catch(e){return false;}})()") { result ->
            if (result == "true") return@evaluateJavascript
            val now = System.currentTimeMillis()
            if (now - lastBackPress < 2500) {
                finish()
            } else {
                lastBackPress = now
                Toast.makeText(this, R.string.exit_hint, Toast.LENGTH_SHORT).show()
            }
        }
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) hideSystemUi()
    }

    @Suppress("DEPRECATION")
    private fun hideSystemUi() {
        window.decorView.systemUiVisibility = (View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or View.SYSTEM_UI_FLAG_FULLSCREEN
            or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or View.SYSTEM_UI_FLAG_LAYOUT_STABLE)
    }

    override fun onPause() {
        super.onPause()
        player.onHostPaused()   // tlačítko Home: film se zastaví, po návratu pokračuje od stejného místa
        web.onPause()
    }

    override fun onResume() {
        super.onResume()
        web.onResume()
    }

    override fun onDestroy() {
        player.release()
        web.destroy()
        super.onDestroy()
    }

    companion object {
        private const val HOST = "appassets.androidplatform.net"
        private const val REQUEST_FILE = 1

        private val BRIDGE_JS = """
(function () {
  var listeners = [];
  window.chrome = window.chrome || {};
  window.chrome.webview = {
    postMessage: function (m) { window.LumenAndroid.postMessage(String(m)); },
    addEventListener: function (t, l) { if (t === 'message') listeners.push(l); },
    removeEventListener: function (t, l) { listeners = listeners.filter(function (x) { return x !== l; }); }
  };
  window.__lumenReceive = function (s) { listeners.slice().forEach(function (l) { l({ data: s }); }); };
  window.qt = window.qt || { webChannelTransport: { onmessage: null, send: function () {} } };
  window.__lumenTV = true;
  try { delete Navigator.prototype.serviceWorker; } catch (e) {}
})();
""".trimIndent().replace("\n", "")
    }
}
