package app.lumen.tv

// Aktualizace z aplikace: stáhne nové APK z GitHub Releases rovnou do instalační relace (PackageInstaller),
// ověří SHA-256 z GitHubu a předá ho Androidu. Instalaci vždy potvrzuje uživatel v systémovém okně.
// Android navíc pustí aktualizaci jen se stejným podpisovým klíčem, jakým je podepsaná nainstalovaná verze.
// Stav posílá rozhraní signálem lumen-update-status: downloading (percent), installing, permission, idle, error (detail).

import android.app.Activity
import android.app.PendingIntent
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageInstaller
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.util.Log
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest

class Updater(private val activity: Activity, private val report: (JSONObject) -> Unit) {

    @Volatile private var running = false

    fun start(url: String, sha: String) {
        // jen soubory z vydání Lumenu na GitHubu
        if (!url.startsWith(ALLOWED_PREFIX, ignoreCase = true) || !url.endsWith(".apk")) return error("bad-url")
        if (running) return
        if (Build.VERSION.SDK_INT >= 26 && !activity.packageManager.canRequestPackageInstalls()) {
            // Lumen zatím nesmí instalovat aplikace: otevřít nastavení, uživatel povolí a dá Aktualizovat znovu
            try {
                activity.startActivity(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${activity.packageName}")))
                report(JSONObject().put("state", "permission"))
                return
            } catch (e: ActivityNotFoundException) {
                // televize toto nastavení nemá: zkusit instalaci rovnou, systém se zeptá sám
            }
        }
        running = true
        Thread { download(url, sha.lowercase()) }.start()
    }

    private fun download(url: String, sha: String) {
        val installer = activity.packageManager.packageInstaller
        var sessionId = -1
        try {
            val conn = URL(url).openConnection() as HttpURLConnection
            conn.connectTimeout = 15_000
            conn.readTimeout = 30_000
            conn.instanceFollowRedirects = true
            if (conn.responseCode != 200) throw Exception("HTTP ${conn.responseCode}")
            val total = conn.contentLengthLong
            val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL)
            params.setAppPackageName(activity.packageName)
            sessionId = installer.createSession(params)
            val digest = MessageDigest.getInstance("SHA-256")
            installer.openSession(sessionId).use { session ->
                session.openWrite("lumen.apk", 0, if (total > 0) total else -1).use { out ->
                    conn.inputStream.use { input ->
                        val buf = ByteArray(64 * 1024)
                        var done = 0L
                        var lastPercent = -1
                        while (true) {
                            val n = input.read(buf)
                            if (n < 0) break
                            out.write(buf, 0, n)
                            digest.update(buf, 0, n)
                            done += n
                            val percent = if (total > 0) (done * 100 / total).toInt() else 0
                            if (percent != lastPercent) {
                                lastPercent = percent
                                report(JSONObject().put("state", "downloading").put("percent", percent))
                            }
                        }
                    }
                    session.fsync(out)
                }
                val got = digest.digest().joinToString("") { "%02x".format(it) }
                if (sha.isNotEmpty() && got != sha) throw Exception("sha-mismatch")
                val flags = PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= 31) PendingIntent.FLAG_MUTABLE else 0)
                val pending = PendingIntent.getActivity(activity, 0,
                    Intent(activity, MainActivity::class.java).setAction(ACTION_STATUS), flags)
                report(JSONObject().put("state", "installing"))
                session.commit(pending.intentSender)
            }
        } catch (e: Exception) {
            Log.w("LumenUpdate", "update failed", e)
            if (sessionId >= 0) try { installer.abandonSession(sessionId) } catch (_: Exception) {}
            running = false
            error(e.message ?: "download")
        }
    }

    fun onStatus(intent: Intent) {
        when (intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE)) {
            PackageInstaller.STATUS_PENDING_USER_ACTION -> {
                @Suppress("DEPRECATION")
                val confirm = intent.getParcelableExtra<Intent>(Intent.EXTRA_INTENT) ?: return error("no-confirm")
                try { activity.startActivity(confirm) } catch (e: Exception) { running = false; error("no-installer") }
            }
            PackageInstaller.STATUS_SUCCESS -> running = false   // Android Lumen po instalaci ukončí
            PackageInstaller.STATUS_FAILURE_ABORTED -> {   // uživatel instalaci zrušil
                running = false
                report(JSONObject().put("state", "idle"))
            }
            else -> {
                running = false
                error(intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE) ?: "install")
            }
        }
    }

    private fun error(detail: String) {
        report(JSONObject().put("state", "error").put("detail", detail))
    }

    companion object {
        const val ACTION_STATUS = "app.lumen.tv.UPDATE_STATUS"
        private const val ALLOWED_PREFIX = "https://github.com/samuelthomask/Lumen/releases/download/"
    }
}
