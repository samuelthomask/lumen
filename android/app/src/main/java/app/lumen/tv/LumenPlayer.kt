package app.lumen.tv

// Přehrávač pro Android TV: rozhraní (stremio-web) mluví „jazykem mpv“ (mpv-command, mpv-set-prop, mpv-observe-prop),
// stejně jako s obalem ve Windows a na Macu. Tady ho překládáme na Media3 ExoPlayer: hardwarové dekódování
// a HDR/Dolby Vision řeší sám Android a televize.

import android.content.Context
import android.graphics.Color
import android.os.Handler
import android.os.Looper
import android.util.Log
import androidx.annotation.OptIn
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.Format
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.PlaybackException
import androidx.media3.common.PlaybackParameters
import androidx.media3.common.Player
import androidx.media3.common.TrackSelectionOverride
import androidx.media3.common.Tracks
import androidx.media3.common.VideoSize
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.DefaultDataSource
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.exoplayer.DefaultRenderersFactory
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.CaptionStyleCompat
import androidx.media3.ui.PlayerView
import androidx.media3.ui.SubtitleView
import org.json.JSONArray
import org.json.JSONObject
import java.util.Locale

@OptIn(UnstableApi::class)
class LumenPlayer(
    context: Context,
    private val view: PlayerView,
    private val signal: (name: String, data: Any?) -> Unit,
) : Player.Listener {

    private val main = Handler(Looper.getMainLooper())
    private val exo: ExoPlayer
    private val observed = HashSet<String>()
    private val lastSent = HashMap<String, String>()

    private var url: String? = null
    private var seeking = false
    private var ended = false
    private var loadId = 0
    private var readySent = false
    private var volume = 100.0
    private var muted = false
    private var subScale = 1.0
    private var subPos = 100.0
    private var subDelay = 0.0
    private var subColor = Color.WHITE
    private var subBackColor = Color.TRANSPARENT
    private var subBorderColor = Color.BLACK
    private var keepAspect = true
    private var panScan = 0.0

    // mpv čísluje stopy zvlášť pro každý typ (1, 2, …); tady si pamatujeme, kterou skupinu Media3 které číslo znamená
    private data class TrackRef(val group: Tracks.Group, val index: Int)
    private val trackRefs = HashMap<String, TrackRef>()   // klíč "audio:2"
    private var trackList = JSONArray()
    private var selected = HashMap<String, Any>()          // "aid"/"sid"/"vid" -> číslo nebo "no"

    var isPlaying = false
        private set
    var onPlayingChanged: ((Boolean) -> Unit)? = null

    private val ticker = object : Runnable {
        override fun run() {
            if (url != null) {
                emit("time-pos")
                emit("duration")
                emit("demuxer-cache-time")
            }
            main.postDelayed(this, 250)
        }
    }

    init {
        val renderers = DefaultRenderersFactory(context)
            .setEnableDecoderFallback(true)
            // FFmpeg jen jako záloha: co umí televize sama (nebo pošle do receiveru), dekóduje ona
            .setExtensionRendererMode(DefaultRenderersFactory.EXTENSION_RENDERER_MODE_ON)
        val http = DefaultHttpDataSource.Factory()
            .setAllowCrossProtocolRedirects(true)
            .setUserAgent("Lumen/${BuildConfigCompat.versionName(context)} (Android TV)")
            .setConnectTimeoutMs(20_000)
            .setReadTimeoutMs(30_000)
        exo = ExoPlayer.Builder(context, renderers)
            .setMediaSourceFactory(DefaultMediaSourceFactory(DefaultDataSource.Factory(context, http)))
            .setAudioAttributes(
                AudioAttributes.Builder().setUsage(C.USAGE_MEDIA).setContentType(C.AUDIO_CONTENT_TYPE_MOVIE).build(),
                true
            )
            .setHandleAudioBecomingNoisy(true)
            .setSeekBackIncrementMs(10_000)
            .setSeekForwardIncrementMs(10_000)
            .build()
        exo.addListener(this)
        view.player = exo
        view.useController = false
        view.setShutterBackgroundColor(Color.TRANSPARENT)
        view.setKeepContentOnPlayerReset(false)
        applySubtitleStyle()
        main.post { ticker.run() }
    }

    // MARK: příkazy z rozhraní

    fun command(args: List<String>) {
        when (args.firstOrNull()) {
            "loadfile" -> {
                val target = args.getOrNull(1) ?: return
                val start = args.drop(2).firstOrNull { it.startsWith("start=") }
                    ?.removePrefix("start=")?.removePrefix("+")?.toDoubleOrNull() ?: 0.0
                load(target, (start * 1000).toLong())
            }
            "stop" -> stop()
            "seek" -> {
                val amount = args.getOrNull(1)?.toDoubleOrNull() ?: return
                val absolute = args.getOrNull(2)?.startsWith("absolute") == true
                seekTo(if (absolute) (amount * 1000).toLong() else exo.currentPosition + (amount * 1000).toLong())
            }
            else -> Log.d(TAG, "ignored command ${args.firstOrNull()}")
        }
    }

    fun setProperty(name: String, raw: Any?) {
        val text = mpvString(raw)
        when (name) {
            "pause" -> { exo.playWhenReady = !isYes(text); emit("pause") }
            "time-pos" -> text.toDoubleOrNull()?.let { seekTo((it * 1000).toLong()) }
            "speed" -> text.toFloatOrNull()?.let { if (it > 0f) exo.playbackParameters = PlaybackParameters(it) }
            "volume" -> text.toDoubleOrNull()?.let { volume = it; applyVolume(); emit("volume") }
            "mute" -> { muted = isYes(text); applyVolume(); emit("mute") }
            "aid" -> selectTrack("audio", C.TRACK_TYPE_AUDIO, text)
            "sid" -> selectTrack("sub", C.TRACK_TYPE_TEXT, text)
            "vid" -> selectTrack("video", C.TRACK_TYPE_VIDEO, text)
            "sub-scale" -> text.toDoubleOrNull()?.let { subScale = it; applySubtitleStyle(); emit("sub-scale") }
            "sub-pos" -> text.toDoubleOrNull()?.let { subPos = it; applySubtitleStyle(); emit("sub-pos") }
            "sub-delay" -> text.toDoubleOrNull()?.let { subDelay = it; emit("sub-delay") }   // Media3 posun titulků neumí, jen hlásíme zpět
            "sub-color" -> parseColor(text)?.let { subColor = it; applySubtitleStyle() }
            "sub-back-color" -> parseColor(text)?.let { subBackColor = it; applySubtitleStyle() }
            "sub-border-color" -> parseColor(text)?.let { subBorderColor = it; applySubtitleStyle() }
            "keepaspect" -> { keepAspect = isYes(text); applyResizeMode() }
            "panscan" -> text.toDoubleOrNull()?.let { panScan = it; applyResizeMode() }
            else -> Log.d(TAG, "ignored property $name=$text")   // hwdec, vo, osc, … řeší Android sám
        }
    }

    fun observe(name: String) {
        observed.add(name)
        lastSent.remove(name)
        emit(name)
    }

    // MARK: ovladač (tlačítka přehrávání na dálkovém ovladači)

    fun hasMedia() = url != null

    fun togglePause() {
        if (url == null) return
        exo.playWhenReady = !exo.playWhenReady
        emit("pause")
    }

    fun seekBy(deltaMs: Long) {
        if (url == null) return
        seekTo((exo.currentPosition + deltaMs).coerceAtLeast(0))
    }

    fun release() {
        main.removeCallbacks(ticker)
        exo.release()
    }

    fun onHostPaused() {
        if (url != null && exo.playWhenReady) { exo.playWhenReady = false; emit("pause") }
    }

    // MARK: vnitřek

    private fun load(target: String, startMs: Long) {
        url = target
        ended = false
        seeking = false
        loadId += 1
        view.visibility = android.view.View.VISIBLE
        readySent = false
        trackRefs.clear(); trackList = JSONArray(); selected.clear()
        signal("mpv-event-video-ready", JSONObject().put("loadId", loadId).put("ready", false))
        exo.setMediaItem(MediaItem.fromUri(target), startMs.coerceAtLeast(0))
        exo.prepare()
        exo.playWhenReady = true
        emitAll()
    }

    private fun stop() {
        url = null
        ended = false
        seeking = false
        exo.stop()
        exo.clearMediaItems()
        // povrch videa by jinak dál ukazoval poslední snímek pod průhlednými místy stránky
        view.visibility = android.view.View.INVISIBLE
        trackRefs.clear(); trackList = JSONArray(); selected.clear()
        emitAll()
    }

    private fun seekTo(ms: Long) {
        if (url == null) return
        seeking = true
        emit("seeking")
        exo.seekTo(ms.coerceAtLeast(0))
    }

    private fun applyVolume() {
        exo.volume = if (muted) 0f else (volume / 100.0).coerceIn(0.0, 1.0).toFloat()
    }

    private fun applyResizeMode() {
        view.resizeMode = when {
            !keepAspect -> AspectRatioFrameLayout.RESIZE_MODE_FILL
            panScan >= 0.5 -> AspectRatioFrameLayout.RESIZE_MODE_ZOOM
            else -> AspectRatioFrameLayout.RESIZE_MODE_FIT
        }
    }

    private fun applySubtitleStyle() {
        val sv: SubtitleView = view.subtitleView ?: return
        // rozhraní posílá sub-scale = velikost × 0,0066 (100 % = 0,66)
        val factor = (subScale / 0.66).coerceIn(0.3, 4.0)
        sv.setFractionalTextSize((SubtitleView.DEFAULT_TEXT_SIZE_FRACTION * factor).toFloat())
        sv.setBottomPaddingFraction(((100.0 - subPos) / 100.0 + 0.04).coerceIn(0.0, 0.9).toFloat())
        sv.setApplyEmbeddedStyles(false)
        sv.setStyle(
            CaptionStyleCompat(
                subColor, subBackColor, Color.TRANSPARENT,
                CaptionStyleCompat.EDGE_TYPE_OUTLINE, subBorderColor, null
            )
        )
    }

    private fun selectTrack(kind: String, type: Int, value: String) {
        val params = exo.trackSelectionParameters.buildUpon()
        if (value == "no" || value == "false" || value.isEmpty()) {
            params.setTrackTypeDisabled(type, true)
        } else {
            val ref = trackRefs["$kind:$value"] ?: return
            params.setTrackTypeDisabled(type, false)
            params.setOverrideForType(TrackSelectionOverride(ref.group.mediaTrackGroup, ref.index))
        }
        exo.trackSelectionParameters = params.build()
    }

    private fun emitAll() {
        listOf(
            "path", "pause", "time-pos", "duration", "seeking", "eof-reached", "paused-for-cache",
            "demuxer-cache-time", "track-list", "aid", "sid", "vid", "video-params", "speed"
        ).forEach { emit(it) }
    }

    /** Pošle hodnotu do rozhraní, pokud ji sleduje a změnila se. */
    private fun emit(name: String) {
        if (name !in observed) return
        val value = valueOf(name)
        val key = if (value == null) "null" else value.toString()
        if (lastSent[name] == key) return
        lastSent[name] = key
        signal("mpv-prop-change", JSONObject().put("name", name).put("data", value ?: JSONObject.NULL))
    }

    private fun valueOf(name: String): Any? {
        val loaded = url != null
        return when (name) {
            "mpv-version" -> "0.40.0"    // rozhraní podle verze volí tvar příkazu loadfile
            "ffmpeg-version" -> "media3"
            "path" -> url
            "time-pos" -> if (loaded) exo.currentPosition / 1000.0 else null
            "duration" -> if (loaded && exo.duration != C.TIME_UNSET) exo.duration / 1000.0 else null
            "pause" -> !exo.playWhenReady
            "seeking" -> seeking
            "eof-reached" -> ended
            "paused-for-cache" -> loaded && exo.playbackState == Player.STATE_BUFFERING
            "cache-buffering-state" -> if (exo.playbackState == Player.STATE_BUFFERING) 0 else 100
            "demuxer-cache-time" -> if (loaded) exo.bufferedPosition / 1000.0 else null
            "volume" -> volume
            "mute" -> muted
            "speed" -> exo.playbackParameters.speed.toDouble()
            "aid" -> selected["aid"] ?: "no"
            "sid" -> selected["sid"] ?: "no"
            "vid" -> selected["vid"] ?: "no"
            "track-list" -> trackList
            "video-params" -> videoParams()
            "metadata" -> null
            "sub-scale" -> subScale
            "sub-pos" -> subPos
            "sub-delay" -> subDelay
            else -> null
        }
    }

    private fun videoParams(): JSONObject? {
        if (url == null) return null
        val f = exo.videoFormat ?: return null
        val o = JSONObject()
        if (f.width > 0) o.put("w", f.width).put("dw", f.width)
        if (f.height > 0) o.put("h", f.height).put("dh", f.height)
        val color = f.colorInfo
        o.put("primaries", if (color?.colorSpace == C.COLOR_SPACE_BT2020) "bt.2020" else "bt.709")
        o.put("gamma", when (color?.colorTransfer) {
            C.COLOR_TRANSFER_ST2084 -> "pq"
            C.COLOR_TRANSFER_HLG -> "hlg"
            else -> "bt.1886"
        })
        if (f.sampleMimeType == MimeTypes.VIDEO_DOLBY_VISION) o.put("colormatrix", "dolbyvision")
        return o
    }

    private fun rebuildTracks(tracks: Tracks) {
        trackRefs.clear()
        selected.clear()
        val list = JSONArray()
        val counters = HashMap<String, Int>()
        for (group in tracks.groups) {
            val kind = when (group.type) {
                C.TRACK_TYPE_AUDIO -> "audio"
                C.TRACK_TYPE_VIDEO -> "video"
                C.TRACK_TYPE_TEXT -> "sub"
                else -> continue
            }
            for (i in 0 until group.length) {
                if (!group.isTrackSupported(i, true)) continue
                val f = group.getTrackFormat(i)
                val id = (counters[kind] ?: 0) + 1
                counters[kind] = id
                trackRefs["$kind:$id"] = TrackRef(group, i)
                val t = JSONObject().put("id", id).put("type", kind)
                    .put("external", false)
                    .put("selected", group.isTrackSelected(i))
                    .put("default", (f.selectionFlags and C.SELECTION_FLAG_DEFAULT) != 0)
                language(f.language)?.let { t.put("lang", it) }
                f.label?.let { t.put("title", it) }
                codec(f)?.let { t.put("codec", it) }
                if (f.channelCount > 0) t.put("demux-channel-count", f.channelCount)
                list.put(t)
                if (group.isTrackSelected(i)) {
                    val prop = when (kind) { "audio" -> "aid"; "sub" -> "sid"; else -> "vid" }
                    if (!selected.containsKey(prop)) selected[prop] = id
                }
            }
        }
        trackList = list
    }

    private fun language(code: String?): String? {
        if (code.isNullOrEmpty() || code == "und") return null
        return try { Locale.forLanguageTag(code).isO3Language.ifEmpty { code } } catch (e: Exception) { code }
    }

    private fun codec(f: Format): String? = when (f.sampleMimeType ?: f.codecs) {
        MimeTypes.TEXT_SSA -> "ass"
        MimeTypes.APPLICATION_SUBRIP -> "subrip"
        MimeTypes.TEXT_VTT -> "webvtt"
        MimeTypes.APPLICATION_PGS -> "hdmv_pgs_subtitle"
        MimeTypes.AUDIO_AC3 -> "ac3"
        MimeTypes.AUDIO_E_AC3, MimeTypes.AUDIO_E_AC3_JOC -> "eac3"
        MimeTypes.AUDIO_AAC -> "aac"
        MimeTypes.AUDIO_DTS, MimeTypes.AUDIO_DTS_HD -> "dts"
        MimeTypes.AUDIO_TRUEHD -> "truehd"
        MimeTypes.AUDIO_OPUS -> "opus"
        MimeTypes.VIDEO_H265 -> "hevc"
        MimeTypes.VIDEO_H264 -> "h264"
        MimeTypes.VIDEO_AV1 -> "av1"
        MimeTypes.VIDEO_DOLBY_VISION -> "hevc"
        else -> f.sampleMimeType?.substringAfter('/')
    }

    // MARK: Player.Listener

    override fun onPlaybackStateChanged(state: Int) {
        when (state) {
            Player.STATE_READY -> {
                if (seeking) { seeking = false; emit("seeking") }
                if (!readySent && exo.videoFormat == null && url != null) sendReady()   // jen zvuk
            }
            Player.STATE_ENDED -> {
                if (url != null && !ended) {
                    ended = true
                    emit("eof-reached")
                    signal("mpv-event-ended", JSONObject().put("reason", "eof"))
                }
            }
        }
        emit("paused-for-cache")
        emit("duration")
    }

    override fun onIsPlayingChanged(playing: Boolean) {
        isPlaying = playing
        view.keepScreenOn = playing
        onPlayingChanged?.invoke(playing)
    }

    override fun onPlayWhenReadyChanged(playWhenReady: Boolean, reason: Int) = emit("pause")

    override fun onTracksChanged(tracks: Tracks) {
        rebuildTracks(tracks)
        listOf("track-list", "aid", "sid", "vid", "video-params").forEach { emit(it) }
    }

    override fun onVideoSizeChanged(videoSize: VideoSize) = emit("video-params")

    override fun onRenderedFirstFrame() {
        if (!readySent && url != null) sendReady()
    }

    override fun onPlaybackParametersChanged(playbackParameters: PlaybackParameters) = emit("speed")

    override fun onPlayerError(error: PlaybackException) {
        Log.w(TAG, "playback error ${error.errorCodeName}", error)
        if (url == null) return
        val message = "${error.errorCodeName}: ${error.message ?: ""}".trim()
        signal("mpv-event-ended", JSONObject().put("reason", "error").put(
            "error", JSONObject().put("code", 85).put("critical", true).put("message", message)
        ))
    }

    private fun sendReady() {
        readySent = true
        emit("video-params")
        signal("mpv-event-video-ready", JSONObject().put("loadId", loadId).put("ready", true))
    }

    companion object {
        private const val TAG = "LumenPlayer"

        fun mpvString(value: Any?): String = when (value) {
            null, JSONObject.NULL -> ""
            is Boolean -> if (value) "yes" else "no"
            is Number -> value.toString()
            else -> value.toString()
        }

        private fun isYes(text: String) = text == "yes" || text == "true" || text == "1"

        /** mpv posílá barvy jako #AARRGGBB (stejně jako Android). */
        private fun parseColor(text: String): Int? = try { Color.parseColor(text) } catch (e: Exception) { null }
    }
}

object BuildConfigCompat {
    fun versionName(context: Context): String = try {
        context.packageManager.getPackageInfo(context.packageName, 0).versionName ?: "?"
    } catch (e: Exception) { "?" }
}
