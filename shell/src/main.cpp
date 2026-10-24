// Tenký obal: okno + WebView2 (rozhraní stremio-web) + libmpv (přehrávání).
// Protokol viz NOTES.md. Vlastní kód, nic z stremio-shell-ng.
#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include <winsock2.h>
#include <ws2tcpip.h>
#include <windows.h>
#include <shellapi.h>
#include <shlobj.h>
#include <shlwapi.h>
#include <urlmon.h>
#include <bcrypt.h>
#include <dcomp.h>
#include <wrl.h>
#include <WebView2.h>
#include <mpv/client.h>

#include <atomic>
#include <chrono>
#include <cmath>
#include <condition_variable>
#include <cstdio>
#include <cstdlib>
#include <memory>
#include <mutex>
#include <string>
#include <thread>
#include <utility>
#include <vector>

using Microsoft::WRL::Callback;
using Microsoft::WRL::ComPtr;

// ---------- Malý JSON (jen to, co protokol potřebuje) ----------

struct Json {
    enum Type { Null, Bool, Num, Str, Arr, Obj } type = Null;
    bool b = false;
    double n = 0;
    std::string s;
    std::vector<Json> a;
    std::vector<std::pair<std::string, Json>> o;

    const Json* get(const char* key) const {
        for (auto& kv : o) if (kv.first == key) return &kv.second;
        return nullptr;
    }
    // Hodnota jako text pro mpv (bool -> yes/no, číslo bez zbytečných nul)
    std::string toMpvString() const {
        switch (type) {
        case Bool: return b ? "yes" : "no";
        case Num: {
            char buf[64];
            if (n == std::floor(n) && std::fabs(n) < 1e15) snprintf(buf, sizeof buf, "%.0f", n);
            else snprintf(buf, sizeof buf, "%.10g", n);
            return buf;
        }
        case Str: return s;
        default: return "";
        }
    }
};

struct JsonParser {
    const std::string& t;
    size_t i = 0;
    explicit JsonParser(const std::string& text) : t(text) {}
    void ws() { while (i < t.size() && (t[i] == ' ' || t[i] == '\t' || t[i] == '\n' || t[i] == '\r')) i++; }
    static void putUtf8(std::string& o, unsigned c) {
        if (c < 0x80) o += (char)c;
        else if (c < 0x800) { o += (char)(0xC0 | (c >> 6)); o += (char)(0x80 | (c & 0x3F)); }
        else if (c < 0x10000) { o += (char)(0xE0 | (c >> 12)); o += (char)(0x80 | ((c >> 6) & 0x3F)); o += (char)(0x80 | (c & 0x3F)); }
        else { o += (char)(0xF0 | (c >> 18)); o += (char)(0x80 | ((c >> 12) & 0x3F)); o += (char)(0x80 | ((c >> 6) & 0x3F)); o += (char)(0x80 | (c & 0x3F)); }
    }
    bool parseString(std::string& out) {
        if (t[i] != '"') return false;
        i++;
        while (i < t.size() && t[i] != '"') {
            char c = t[i++];
            if (c != '\\') { out += c; continue; }
            if (i >= t.size()) return false;
            char e = t[i++];
            switch (e) {
            case 'n': out += '\n'; break;
            case 't': out += '\t'; break;
            case 'r': out += '\r'; break;
            case 'b': out += '\b'; break;
            case 'f': out += '\f'; break;
            case 'u': {
                if (i + 4 > t.size()) return false;
                unsigned u = (unsigned)strtoul(t.substr(i, 4).c_str(), nullptr, 16);
                i += 4;
                if (u >= 0xD800 && u < 0xDC00 && i + 6 <= t.size() && t[i] == '\\' && t[i + 1] == 'u') {
                    unsigned lo = (unsigned)strtoul(t.substr(i + 2, 4).c_str(), nullptr, 16);
                    i += 6;
                    u = 0x10000 + ((u - 0xD800) << 10) + (lo - 0xDC00);
                }
                putUtf8(out, u);
                break;
            }
            default: out += e;
            }
        }
        if (i >= t.size()) return false;
        i++;
        return true;
    }
    bool parse(Json& j, int depth = 0) {
        if (depth > 64) return false;
        ws();
        if (i >= t.size()) return false;
        char c = t[i];
        if (c == '"') { j.type = Json::Str; return parseString(j.s); }
        if (c == '[') {
            j.type = Json::Arr; i++; ws();
            if (t[i] == ']') { i++; return true; }
            for (;;) {
                Json v; if (!parse(v, depth + 1)) return false;
                j.a.push_back(std::move(v)); ws();
                if (i < t.size() && t[i] == ',') { i++; continue; }
                if (i < t.size() && t[i] == ']') { i++; return true; }
                return false;
            }
        }
        if (c == '{') {
            j.type = Json::Obj; i++; ws();
            if (t[i] == '}') { i++; return true; }
            for (;;) {
                ws(); std::string k; if (!parseString(k)) return false;
                ws(); if (i >= t.size() || t[i] != ':') return false; i++;
                Json v; if (!parse(v, depth + 1)) return false;
                j.o.emplace_back(std::move(k), std::move(v)); ws();
                if (i < t.size() && t[i] == ',') { i++; continue; }
                if (i < t.size() && t[i] == '}') { i++; return true; }
                return false;
            }
        }
        if (t.compare(i, 4, "true") == 0) { j.type = Json::Bool; j.b = true; i += 4; return true; }
        if (t.compare(i, 5, "false") == 0) { j.type = Json::Bool; j.b = false; i += 5; return true; }
        if (t.compare(i, 4, "null") == 0) { j.type = Json::Null; i += 4; return true; }
        char* end = nullptr;
        j.n = strtod(t.c_str() + i, &end);
        if (end == t.c_str() + i) return false;
        j.type = Json::Num; i = end - t.c_str();
        return true;
    }
};

static void jsonEscape(std::string& out, const char* s) {
    out += '"';
    for (const unsigned char* p = (const unsigned char*)s; *p; p++) {
        switch (*p) {
        case '"': out += "\\\""; break;
        case '\\': out += "\\\\"; break;
        case '\n': out += "\\n"; break;
        case '\r': out += "\\r"; break;
        case '\t': out += "\\t"; break;
        default:
            if (*p < 0x20) { char b[8]; snprintf(b, sizeof b, "\\u%04x", *p); out += b; }
            else out += (char)*p;
        }
    }
    out += '"';
}

static void nodeToJson(std::string& out, const mpv_node* n) {
    char buf[64];
    switch (n->format) {
    case MPV_FORMAT_STRING: case MPV_FORMAT_OSD_STRING: jsonEscape(out, n->u.string); break;
    case MPV_FORMAT_FLAG: out += n->u.flag ? "true" : "false"; break;
    case MPV_FORMAT_INT64: snprintf(buf, sizeof buf, "%lld", (long long)n->u.int64); out += buf; break;
    case MPV_FORMAT_DOUBLE:
        if (std::isfinite(n->u.double_)) { snprintf(buf, sizeof buf, "%.17g", n->u.double_); out += buf; }
        else out += "null";
        break;
    case MPV_FORMAT_NODE_ARRAY:
        out += '[';
        for (int k = 0; k < n->u.list->num; k++) { if (k) out += ','; nodeToJson(out, &n->u.list->values[k]); }
        out += ']';
        break;
    case MPV_FORMAT_NODE_MAP:
        out += '{';
        for (int k = 0; k < n->u.list->num; k++) {
            if (k) out += ',';
            jsonEscape(out, n->u.list->keys[k]); out += ':'; nodeToJson(out, &n->u.list->values[k]);
        }
        out += '}';
        break;
    default: out += "null";
    }
}

static std::wstring widen(const std::string& s) {
    if (s.empty()) return L"";
    int len = MultiByteToWideChar(CP_UTF8, 0, s.data(), (int)s.size(), nullptr, 0);
    std::wstring w(len, 0);
    MultiByteToWideChar(CP_UTF8, 0, s.data(), (int)s.size(), &w[0], len);
    return w;
}
static std::string narrow(const wchar_t* w) {
    int len = WideCharToMultiByte(CP_UTF8, 0, w, -1, nullptr, 0, nullptr, nullptr);
    std::string s(len > 0 ? len - 1 : 0, 0);
    if (len > 1) WideCharToMultiByte(CP_UTF8, 0, w, -1, &s[0], len, nullptr, nullptr);
    return s;
}

// ---------- Stav aplikace ----------

static const UINT WM_SHELL_SIGNAL = WM_APP + 1; // lParam = new std::string* (hotový JSON pro web)
static const UINT WM_HDR_UPDATE = WM_APP + 2;   // wParam = 1 pokud je video HDR

static HWND g_main = nullptr;
static HWND g_video = nullptr;
static ComPtr<ICoreWebView2Controller> g_controller;
static ComPtr<ICoreWebView2> g_webview;
static ComPtr<ICoreWebView2CompositionController> g_comp;
static ComPtr<IDCompositionDevice> g_dcomp;
static ComPtr<IDCompositionTarget> g_dcompTarget;
static ComPtr<IDCompositionVisual> g_dcompRoot;
static HCURSOR g_cursor = nullptr;
static bool g_trackingMouse = false;
static mpv_handle* g_mpv = nullptr;
static std::thread g_mpvThread;
static std::atomic<bool> g_quit{false};
static bool g_fullscreen = false;
static WINDOWPLACEMENT g_savedPlacement{};
static LONG_PTR g_savedStyle = 0;

static void logf(const char* fmt, ...) {
    char buf[512];
    va_list ap; va_start(ap, fmt); vsnprintf(buf, sizeof buf, fmt, ap); va_end(ap);
    OutputDebugStringA(buf); OutputDebugStringA("\n");
    // Log jde do STREMIO_MOD_LOG, jinak do %LOCALAPPDATA%\StremioMod\shell.log
    static std::string path;
    if (path.empty()) {
        if (const char* e = getenv("STREMIO_MOD_LOG")) path = e;
        else {
            wchar_t* la = nullptr;
            SHGetKnownFolderPath(FOLDERID_LocalAppData, 0, nullptr, &la);
            std::wstring dir = std::wstring(la) + L"\\StremioMod";
            CoTaskMemFree(la);
            CreateDirectoryW(dir.c_str(), nullptr);
            path = narrow((dir + L"\\shell.log").c_str());
        }
    }
    if (FILE* f = fopen(path.c_str(), "a")) { fprintf(f, "[%8llu ms] ", (unsigned long long)GetTickCount64() % 100000000ULL); fputs(buf, f); fputc('\n', f); fclose(f); }
}

// Každých pár vteřin zapíše statistiky přehrávání (pro hledání škubání).
static void logPlaybackStats() {
    auto get = [](const char* n) {
        char* s = mpv_get_property_string(g_mpv, n);
        std::string r = s ? s : "-";
        if (s) mpv_free(s);
        return r;
    };
    if (get("time-pos") == "-") return;
    // Skutečný režim monitoru (po zapnutí HDR se může změnit) a měření vsync v mpv.
    MONITORINFOEXW mi{}; mi.cbSize = sizeof mi;
    DEVMODEW dm{}; dm.dmSize = sizeof dm;
    if (GetMonitorInfoW(MonitorFromWindow(g_main, MONITOR_DEFAULTTONEAREST), &mi) &&
        EnumDisplaySettingsW(mi.szDevice, ENUM_CURRENT_SETTINGS, &dm))
        logf("DISPLAY mode %lux%lu @ %lu Hz", dm.dmPelsWidth, dm.dmPelsHeight, dm.dmDisplayFrequency);
    logf("SYNC video-sync=%s est-display-fps=%s vsync-jitter=%s display-sync-active=%s vo-delayed=%s mistimed=%s",
         get("video-sync").c_str(), get("estimated-display-fps").c_str(), get("vsync-jitter").c_str(),
         get("display-sync-active").c_str(), get("vo-delayed-frame-count").c_str(), get("mistimed-frame-count").c_str());
    logf("STATS t=%s hwdec=%s dec-drop=%s vo-drop=%s vo-delayed=%s avsync=%s fps=%s/%s disp-fps=%s cache=%ss codec=%s %sx%s fs=%d",
         get("time-pos").c_str(), get("hwdec-current").c_str(), get("decoder-frame-drop-count").c_str(),
         get("frame-drop-count").c_str(), get("vo-delayed-frame-count").c_str(), get("avsync").c_str(),
         get("estimated-vf-fps").c_str(), get("container-fps").c_str(), get("display-fps").c_str(),
         get("demuxer-cache-duration").c_str(), get("video-codec").c_str(), get("width").c_str(), get("height").c_str(),
         g_fullscreen ? 1 : 0);
}

// Pošle web signál {type:1,args:[name,data]}; data je již hotový JSON.
static void postSignal(const std::string& name, const std::string& dataJson) {
    auto* msg = new std::string("{\"type\":1,\"args\":[");
    jsonEscape(*msg, name.c_str());
    *msg += ',';
    *msg += dataJson.empty() ? "null" : dataJson;
    *msg += "]}";
    if (!PostMessageW(g_main, WM_SHELL_SIGNAL, 0, (LPARAM)msg)) delete msg;
}

// ---------- Streamovací server (server.js z instalace Stremia, nekopírujeme ho) ----------

static HANDLE g_serverJob = nullptr;

static bool serverPortOpen() {
    WSADATA wsa; WSAStartup(MAKEWORD(2, 2), &wsa);
    SOCKET s = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
    sockaddr_in a{}; a.sin_family = AF_INET; a.sin_port = htons(11470);
    inet_pton(AF_INET, "127.0.0.1", &a.sin_addr);
    bool open = connect(s, (sockaddr*)&a, sizeof a) == 0;
    closesocket(s);
    return open;
}

// ---------- Vestavěný lokální server ----------
// Malý vlastní server na 127.0.0.1:11470, který stačí rozhraní k tomu, aby fungovalo bez nainstalovaného Stremia:
// odpovídá na dotazy na nastavení a stav a přehrávání přímých odkazů (např. debrid, HTTP zdroje) obstará mpv samo.
// Torrenty bez debridu nepodporuje (na jejich adresy vrací 501). Odpovídá jen původu naší stránky (CORS).

static std::string g_settingsOverride;   // vývojově: STREMIO_MOD_SETTINGS_FILE
static const char* kBuiltinSettings =
    "{\"options\":[],\"values\":{\"serverVersion\":\"1.0.0\",\"appPath\":\"\",\"cacheRoot\":\"\",\"cacheSize\":0,"
    "\"btMaxConnections\":0,\"btHandshakeTimeout\":0,\"btRequestTimeout\":0,\"btDownloadSpeedSoftLimit\":0,"
    "\"btDownloadSpeedHardLimit\":0,\"btMinPeersForStable\":0,\"remoteHttps\":\"\",\"localAddonEnabled\":false,"
    "\"transcodeHorsepower\":0,\"transcodeMaxBitRate\":0,\"transcodeConcurrency\":1,\"transcodeTrackConcurrency\":1,"
    "\"transcodeHardwareAccel\":false,\"transcodeProfile\":null,\"allTranscodeProfiles\":[],\"proxyStreamsEnabled\":false},"
    "\"baseUrl\":\"http://127.0.0.1:11470\"}";

static void builtinServeClient(SOCKET c) {
    std::string req;
    char buf[4096];
    size_t headerEnd = std::string::npos;
    while (req.size() < 65536 && (headerEnd = req.find("\r\n\r\n")) == std::string::npos) {
        int n = recv(c, buf, sizeof buf, 0);
        if (n <= 0) break;
        req.append(buf, n);
    }
    if (headerEnd == std::string::npos) { closesocket(c); return; }
    std::string head = req.substr(0, headerEnd);

    auto headerValue = [&](const char* name) {
        std::string key = std::string("\r\n") + name + ":";
        size_t p = 0;
        for (size_t i = 0; i + key.size() <= head.size(); i++) {
            if (_strnicmp(head.c_str() + i, key.c_str(), key.size()) == 0) { p = i + key.size(); break; }
        }
        if (!p) return std::string();
        size_t e = head.find("\r\n", p);
        std::string v = head.substr(p, e == std::string::npos ? std::string::npos : e - p);
        while (!v.empty() && v.front() == ' ') v.erase(v.begin());
        return v;
    };

    size_t sp1 = head.find(' ');
    size_t sp2 = sp1 == std::string::npos ? sp1 : head.find(' ', sp1 + 1);
    std::string method = sp1 == std::string::npos ? "" : head.substr(0, sp1);
    std::string target = sp2 == std::string::npos ? "" : head.substr(sp1 + 1, sp2 - sp1 - 1);
    std::string path = target.substr(0, target.find('?'));

    // tělo požadavku (POST) přečíst a zahodit, ať klient nedostane reset spojení
    long contentLength = atol(headerValue("Content-Length").c_str());
    size_t have = req.size() - (headerEnd + 4);
    while (contentLength > 0 && have < (size_t)contentLength && have < 1048576) {
        int n = recv(c, buf, sizeof buf, 0);
        if (n <= 0) break;
        have += n;
    }

    logf("builtin server: %s %s", method.c_str(), path.c_str());
    // CORS: jen původ naší stránky (jiný web nesmí z prohlížeče číst odpovědi)
    std::string origin = headerValue("Origin");
    bool originOk = origin == "https://lumen.localhost:11470";
    std::string cors;
    if (originOk) {
        cors = "Access-Control-Allow-Origin: " + origin + "\r\nVary: Origin\r\nAccess-Control-Allow-Methods: GET, POST, OPTIONS\r\n"
               "Access-Control-Allow-Headers: *\r\nAccess-Control-Allow-Private-Network: true\r\n";
    }

    int status = 200;
    const char* statusText = "OK";
    std::string body;
    if (method == "OPTIONS") { status = 204; statusText = "No Content"; }
    else if (path == "/settings") body = method == "POST" ? std::string("{\"success\":true}") : (g_settingsOverride.empty() ? std::string(kBuiltinSettings) : g_settingsOverride);
    else if (path == "/network-info") body = "{\"availableInterfaces\":[]}";
    else if (path == "/device-info") body = "{\"availableHardwareAccelerations\":[]}";
    else if (path == "/stats.json") body = "{}";
    else if (path == "/casting") body = "[]";
    else if (path == "/heartbeat") body = "{\"success\":true}";
    else {
        status = 501; statusText = "Not Implemented";
        body = "{\"error\":\"Lumen built-in server: torrent streaming is not supported. Use a source with a direct link (for example through a debrid service) or install a compatible streaming server.\"}";
    }

    std::string resp = "HTTP/1.1 " + std::to_string(status) + " " + statusText + "\r\n" + cors +
        "Content-Type: application/json\r\nContent-Length: " + std::to_string(body.size()) + "\r\nConnection: close\r\n\r\n" + body;
    send(c, resp.c_str(), (int)resp.size(), 0);
    shutdown(c, SD_SEND);
    closesocket(c);
}

static bool startBuiltinServer() {
    if (const char* f = getenv("STREMIO_MOD_SETTINGS_FILE")) {
        if (FILE* fp = fopen(f, "rb")) {
            char b[8192]; size_t n; while ((n = fread(b, 1, sizeof b, fp)) > 0) g_settingsOverride.append(b, n);
            fclose(fp);
            while (!g_settingsOverride.empty() && (unsigned char)g_settingsOverride[0] > 0x7e) g_settingsOverride.erase(0, 1);   // BOM
        }
    }
    WSADATA wsa; WSAStartup(MAKEWORD(2, 2), &wsa);
    SOCKET l = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
    BOOL excl = TRUE;
    setsockopt(l, SOL_SOCKET, SO_EXCLUSIVEADDRUSE, (const char*)&excl, sizeof excl);
    sockaddr_in a{}; a.sin_family = AF_INET; a.sin_port = htons(11470);
    inet_pton(AF_INET, "127.0.0.1", &a.sin_addr);     // jen lokálně, ne v síti
    if (bind(l, (sockaddr*)&a, sizeof a) != 0 || listen(l, 16) != 0) { logf("builtin server: bind/listen failed %d", WSAGetLastError()); closesocket(l); return false; }
    std::thread([l] {
        for (;;) {
            SOCKET c = accept(l, nullptr, nullptr);
            if (c == INVALID_SOCKET) break;
            DWORD timeoutMs = 5000;
            setsockopt(c, SOL_SOCKET, SO_RCVTIMEO, (const char*)&timeoutMs, sizeof timeoutMs);
            std::thread(builtinServeClient, c).detach();
        }
    }).detach();
    logf("builtin server: listening on 127.0.0.1:11470");
    return true;
}

// Vlastní torrentový server (WebTorrent v přibaleném Node) ve složce "torrent" vedle Lumen.exe.
// Končí spolu s námi (job). Když chybí nebo nenaběhne, použije se jednoduchý vestavěný server.
static bool startTorrentServer() {
    wchar_t self[MAX_PATH]; GetModuleFileNameW(nullptr, self, MAX_PATH);
    std::wstring dir = self;
    dir = dir.substr(0, dir.find_last_of(L'\\')) + L"\\torrent";
    std::wstring node = dir + L"\\node.exe";
    if (_wgetenv(L"STREMIO_MOD_NOTORRENT") || GetFileAttributesW(node.c_str()) == INVALID_FILE_ATTRIBUTES ||
        GetFileAttributesW((dir + L"\\server.js").c_str()) == INVALID_FILE_ATTRIBUTES) return false;

    wchar_t* la = nullptr;
    SHGetKnownFolderPath(FOLDERID_LocalAppData, 0, nullptr, &la);
    std::wstring data = std::wstring(la) + L"\\StremioMod\\torrents";
    CoTaskMemFree(la);
    SetEnvironmentVariableW(L"LUMEN_TORRENT_DIR", data.c_str());
    SetEnvironmentVariableW(L"LUMEN_PORT", L"11470");

    if (!g_serverJob) {
        g_serverJob = CreateJobObjectW(nullptr, nullptr);
        JOBOBJECT_EXTENDED_LIMIT_INFORMATION lim{};
        lim.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
        SetInformationJobObject(g_serverJob, JobObjectExtendedLimitInformation, &lim, sizeof lim);
    }
    std::wstring cmd = L"\"" + node + L"\" server.js";
    STARTUPINFOW si{ sizeof si };
    PROCESS_INFORMATION pi{};
    if (!CreateProcessW(nullptr, &cmd[0], nullptr, nullptr, FALSE, CREATE_NO_WINDOW | CREATE_SUSPENDED, nullptr, dir.c_str(), &si, &pi)) {
        logf("torrent server: CreateProcess failed %lu", GetLastError());
        return false;
    }
    AssignProcessToJobObject(g_serverJob, pi.hProcess);
    ResumeThread(pi.hThread);
    CloseHandle(pi.hThread);
    for (int i = 0; i < 100 && !serverPortOpen(); i++) Sleep(100);
    bool up = serverPortOpen();
    logf("torrent server: started, port open = %d", up);
    if (!up) { TerminateProcess(pi.hProcess, 1); }
    CloseHandle(pi.hProcess);
    return up;
}

static void startServer() {
    if (serverPortOpen()) { logf("server: already running"); return; }
    std::wstring dir;
    if (const wchar_t* e = _wgetenv(L"STREMIO_MOD_SERVERDIR")) dir = e;
    else {
        wchar_t* la = nullptr;
        SHGetKnownFolderPath(FOLDERID_LocalAppData, 0, nullptr, &la);
        dir = std::wstring(la) + L"\\Programs\\Stremio";
        CoTaskMemFree(la);
    }
    std::wstring exe = dir + L"\\stremio-runtime.exe";
    // Bez nainstalovaného Stremia (nebo na přání) běží vestavěný server.
    if (_wgetenv(L"STREMIO_MOD_BUILTIN") || GetFileAttributesW(exe.c_str()) == INVALID_FILE_ATTRIBUTES ||
        GetFileAttributesW((dir + L"\\server.js").c_str()) == INVALID_FILE_ATTRIBUTES) {
        if (!startTorrentServer()) startBuiltinServer();
        return;
    }

    // Job s KILL_ON_JOB_CLOSE: server skončí spolu s námi, i když spadneme.
    g_serverJob = CreateJobObjectW(nullptr, nullptr);
    JOBOBJECT_EXTENDED_LIMIT_INFORMATION lim{};
    lim.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
    SetInformationJobObject(g_serverJob, JobObjectExtendedLimitInformation, &lim, sizeof lim);

    std::wstring cmd = L"\"" + exe + L"\" server.js";
    STARTUPINFOW si{ sizeof si };
    PROCESS_INFORMATION pi{};
    if (CreateProcessW(nullptr, &cmd[0], nullptr, nullptr, FALSE, CREATE_NO_WINDOW | CREATE_SUSPENDED, nullptr, dir.c_str(), &si, &pi)) {
        AssignProcessToJobObject(g_serverJob, pi.hProcess);
        ResumeThread(pi.hThread);
        CloseHandle(pi.hThread); CloseHandle(pi.hProcess);
        // Web se na server ptá hned po startu a pak už ne, takže počkáme, až server naslouchá.
        for (int i = 0; i < 100 && !serverPortOpen(); i++) Sleep(100);
        logf("server: started, port open = %d", serverPortOpen());
    } else logf("server: CreateProcess failed %lu", GetLastError());
}

// ---------- Auto HDR ----------
// Zapne HDR ("advanced color") na displeji, kde je okno, když je okno ve fullscreenu a video je HDR (pq/hlg).
// Po skončení stav vrátí. Pokud HDR zapnul už uživatel, nesahá na něj.

struct HdrTarget { LUID adapter; UINT32 id; };
static bool g_hdrVideo = false;
static bool g_hdrWeEnabled = false;
static HdrTarget g_hdrTarget{};

static std::wstring hdrStateFile() {
    wchar_t* appData = nullptr;
    SHGetKnownFolderPath(FOLDERID_LocalAppData, 0, nullptr, &appData);
    std::wstring dir = std::wstring(appData) + L"\\StremioMod";
    CoTaskMemFree(appData);
    CreateDirectoryW(dir.c_str(), nullptr);
    return dir + L"\\hdr-pending.txt";
}

static bool hdrFindTarget(HWND hwnd, HdrTarget& out) {
    MONITORINFOEXW mi{}; mi.cbSize = sizeof mi;
    if (!GetMonitorInfoW(MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST), &mi)) return false;
    UINT32 np = 0, nm = 0;
    if (GetDisplayConfigBufferSizes(QDC_ONLY_ACTIVE_PATHS, &np, &nm) != ERROR_SUCCESS) return false;
    std::vector<DISPLAYCONFIG_PATH_INFO> paths(np);
    std::vector<DISPLAYCONFIG_MODE_INFO> modes(nm);
    if (QueryDisplayConfig(QDC_ONLY_ACTIVE_PATHS, &np, paths.data(), &nm, modes.data(), nullptr) != ERROR_SUCCESS) return false;
    for (UINT32 i = 0; i < np; i++) {
        DISPLAYCONFIG_SOURCE_DEVICE_NAME sn{};
        sn.header.type = DISPLAYCONFIG_DEVICE_INFO_GET_SOURCE_NAME;
        sn.header.size = sizeof sn;
        sn.header.adapterId = paths[i].sourceInfo.adapterId;
        sn.header.id = paths[i].sourceInfo.id;
        if (DisplayConfigGetDeviceInfo(&sn.header) != ERROR_SUCCESS) continue;
        if (wcscmp(sn.viewGdiDeviceName, mi.szDevice) == 0) {
            out.adapter = paths[i].targetInfo.adapterId;
            out.id = paths[i].targetInfo.id;
            return true;
        }
    }
    return false;
}

static bool hdrGet(const HdrTarget& t, bool& supported, bool& enabled) {
    DISPLAYCONFIG_GET_ADVANCED_COLOR_INFO info{};
    info.header.type = DISPLAYCONFIG_DEVICE_INFO_GET_ADVANCED_COLOR_INFO;
    info.header.size = sizeof info;
    info.header.adapterId = t.adapter;
    info.header.id = t.id;
    if (DisplayConfigGetDeviceInfo(&info.header) != ERROR_SUCCESS) return false;
    supported = info.advancedColorSupported;
    enabled = info.advancedColorEnabled;
    return true;
}

static bool hdrSet(const HdrTarget& t, bool on) {
    DISPLAYCONFIG_SET_ADVANCED_COLOR_STATE st{};
    st.header.type = DISPLAYCONFIG_DEVICE_INFO_SET_ADVANCED_COLOR_STATE;
    st.header.size = sizeof st;
    st.header.adapterId = t.adapter;
    st.header.id = t.id;
    st.enableAdvancedColor = on ? 1 : 0;
    LONG r = DisplayConfigSetDeviceInfo(&st.header);
    logf("HDR set %s -> %ld", on ? "ON" : "OFF", r);
    return r == ERROR_SUCCESS;
}

// Vrátí HDR, pokud ho zapnula tato aplikace (volá se i při pádu a při startu po pádu).
static void hdrRestore() {
    if (!g_hdrWeEnabled) return;
    hdrSet(g_hdrTarget, false);
    g_hdrWeEnabled = false;
    DeleteFileW(hdrStateFile().c_str());
}

// Po pádu minulého běhu: soubor říká, který displej jsme zapnuli my.
static void hdrRecoverAfterCrash() {
    std::wstring f = hdrStateFile();
    FILE* fp = _wfopen(f.c_str(), L"r");
    if (!fp) return;
    unsigned long low = 0; long high = 0; unsigned id = 0;
    int n = fscanf(fp, "%lu %ld %u", &low, &high, &id);
    fclose(fp);
    if (n == 3) {
        HdrTarget t{}; t.adapter.LowPart = low; t.adapter.HighPart = high; t.id = id;
        bool sup = false, en = false;
        if (hdrGet(t, sup, en) && en) { logf("HDR recovery after crash"); hdrSet(t, false); }
    }
    DeleteFileW(f.c_str());
}

static LONG WINAPI crashHandler(EXCEPTION_POINTERS*) { hdrRestore(); return EXCEPTION_CONTINUE_SEARCH; }

static void hdrEvaluate() {
    bool want = g_fullscreen && g_hdrVideo;
    logf("HDR evaluate: fullscreen=%d hdrVideo=%d weEnabled=%d", g_fullscreen, g_hdrVideo, g_hdrWeEnabled);
    if (want && !g_hdrWeEnabled) {
        HdrTarget t{};
        bool sup = false, en = false;
        if (!hdrFindTarget(g_main, t) || !hdrGet(t, sup, en)) { logf("HDR: display not found"); return; }
        if (!sup) { logf("HDR: display does not support it"); return; }
        if (en) { logf("HDR: already on (user), leaving it"); return; }
        // Nejdřív poznamenat na disk, teprve pak přepnout (kvůli pádu).
        if (FILE* fp = _wfopen(hdrStateFile().c_str(), L"w")) {
            fprintf(fp, "%lu %ld %u\n", (unsigned long)t.adapter.LowPart, (long)t.adapter.HighPart, t.id);
            fclose(fp);
        }
        if (hdrSet(t, true)) { g_hdrWeEnabled = true; g_hdrTarget = t; }
        else DeleteFileW(hdrStateFile().c_str());
    } else if (!want && g_hdrWeEnabled) {
        hdrRestore();
    }
}

static void sendVisibility() {
    char buf[96];
    snprintf(buf, sizeof buf, "{\"visible\":true,\"visibility\":%d,\"isFullscreen\":%s}", g_fullscreen ? 5 : 2, g_fullscreen ? "true" : "false");
    postSignal("win-visibility-changed", buf);
}

// ---------- Skrývání vrstvy rozhraní při nečinnosti ----------
// Průhledná vrstva WebView2 nad videem nutí Windows (DWM) skládat každý snímek, což je ve 4K HDR drahé.
// Ve fullscreenu při přehrávání a nečinnosti ji proto skryjeme; pohyb myši/klávesa ji vrátí.

static bool g_overlayHidden = false;
static ULONGLONG g_lastActivity = 0;

static void overlayShow() {
    g_lastActivity = GetTickCount64();
    if (g_overlayHidden && g_controller) {
        g_controller->put_IsVisible(TRUE);
        g_controller->MoveFocus(COREWEBVIEW2_MOVE_FOCUS_REASON_PROGRAMMATIC);
        g_overlayHidden = false;
        logf("overlay: shown");
    }
}

// Externí titulky (z addonu) kreslí webová vrstva, ne mpv; dokud je některé zobrazené, vrstvu neskrýváme (jinak by zmizely).
static bool g_keepOverlay = false;

static void overlayCheckIdle() {
    if (g_overlayHidden || g_keepOverlay || !g_fullscreen || !g_controller) return;
    if (GetTickCount64() - g_lastActivity < 3500) return;
    char* p = mpv_get_property_string(g_mpv, "pause");
    char* t = mpv_get_property_string(g_mpv, "time-pos");
    bool playing = p && strcmp(p, "no") == 0 && t;   // jen když video opravdu hraje
    if (p) mpv_free(p);
    if (t) mpv_free(t);
    if (!playing) return;
    g_controller->put_IsVisible(FALSE);
    g_overlayHidden = true;
    logf("overlay: hidden (idle)");
}

static void setFullscreen(bool fs) {
    if (fs == g_fullscreen) return;
    // HDR přepnout jako první: televize/displej si pak mění signál souběžně se změnou velikosti okna.
    g_fullscreen = fs;
    hdrEvaluate();
    overlayShow();
    if (fs) {
        g_savedPlacement.length = sizeof g_savedPlacement;
        GetWindowPlacement(g_main, &g_savedPlacement);
        g_savedStyle = GetWindowLongPtrW(g_main, GWL_STYLE);
        MONITORINFO mi{ sizeof mi };
        GetMonitorInfoW(MonitorFromWindow(g_main, MONITOR_DEFAULTTONEAREST), &mi);
        SetWindowLongPtrW(g_main, GWL_STYLE, g_savedStyle & ~WS_OVERLAPPEDWINDOW);
        SetWindowPos(g_main, HWND_TOP, mi.rcMonitor.left, mi.rcMonitor.top, mi.rcMonitor.right - mi.rcMonitor.left,
                     mi.rcMonitor.bottom - mi.rcMonitor.top, SWP_NOOWNERZORDER | SWP_FRAMECHANGED);
    } else {
        SetWindowLongPtrW(g_main, GWL_STYLE, g_savedStyle);
        SetWindowPlacement(g_main, &g_savedPlacement);
        SetWindowPos(g_main, nullptr, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_NOOWNERZORDER | SWP_FRAMECHANGED);
    }
    sendVisibility();
}

// ---------- mpv ----------

static void mpvSetProp(const std::string& name, const std::string& value) {
    int r = mpv_set_property_string(g_mpv, name.c_str(), value.c_str());
    if (r < 0) logf("mpv set %s=%s: %s", name.c_str(), value.c_str(), mpv_error_string(r));
}

static void mpvThreadMain() {
    while (!g_quit) {
        mpv_event* ev = mpv_wait_event(g_mpv, 0.25);
        switch (ev->event_id) {
        case MPV_EVENT_SHUTDOWN: return;
        case MPV_EVENT_START_FILE: logf("TIMELINE mpv: start-file"); break;
        case MPV_EVENT_FILE_LOADED: logf("TIMELINE mpv: file-loaded"); break;
        case MPV_EVENT_VIDEO_RECONFIG: logf("TIMELINE mpv: video-reconfig"); break;
        case MPV_EVENT_PLAYBACK_RESTART: logf("TIMELINE mpv: playback-restart (first frame / seek done)"); break;
        case MPV_EVENT_LOG_MESSAGE: {
            auto* lm = (mpv_event_log_message*)ev->data;
            logf("[mpv %s] %s", lm->prefix, lm->text);
            break;
        }
        case MPV_EVENT_PROPERTY_CHANGE: {
            auto* p = (mpv_event_property*)ev->data;
            if (ev->reply_userdata == 2) { // vlastní pozorování video-params (celé) pro auto HDR a ladění
                const mpv_node* nd = p->format == MPV_FORMAT_NODE ? (const mpv_node*)p->data : nullptr;
                std::string js; if (nd) nodeToJson(js, nd);
                logf("VIDEO-PARAMS %s", js.c_str());
                bool hdr = false;
                if (nd && nd->format == MPV_FORMAT_NODE_MAP) {
                    for (int k = 0; k < nd->u.list->num; k++) {
                        const char* key = nd->u.list->keys[k];
                        const mpv_node& v = nd->u.list->values[k];
                        if (!strcmp(key, "sig-peak") && v.format == MPV_FORMAT_DOUBLE && v.u.double_ > 1.5) hdr = true;
                        if (v.format != MPV_FORMAT_STRING) continue;
                        // HDR10/HLG (gamma), Dolby Vision (colormatrix) nebo široký gamut BT.2020 s PQ/HLG-like přenosem
                        if (!strcmp(key, "gamma") && (!strcmp(v.u.string, "pq") || !strcmp(v.u.string, "hlg"))) hdr = true;
                        if (!strcmp(key, "colormatrix") && !strcmp(v.u.string, "dolbyvision")) hdr = true;
                    }
                }
                PostMessageW(g_main, WM_HDR_UPDATE, hdr ? 1 : 0, 0);
                break;
            }
            {   // časová osa načítání: kdy se cache zastaví/rozběhne a kdy přijde první čas
                static bool firstTime = true;
                const mpv_node* nd = p->format == MPV_FORMAT_NODE ? (const mpv_node*)p->data : nullptr;
                if (nd && (!strcmp(p->name, "paused-for-cache") || !strcmp(p->name, "seeking")) && nd->format == MPV_FORMAT_FLAG)
                    logf("TIMELINE mpv: %s=%d", p->name, nd->u.flag);
                if (!strcmp(p->name, "path") && nd && nd->format == MPV_FORMAT_STRING) firstTime = true;
                if (!strcmp(p->name, "time-pos") && nd && nd->format == MPV_FORMAT_DOUBLE && firstTime) {
                    firstTime = false;
                    logf("TIMELINE mpv: first time-pos %.2f", nd->u.double_);
                }
            }
            std::string data = "{\"name\":";
            jsonEscape(data, p->name);
            data += ",\"data\":";
            if (p->format == MPV_FORMAT_NODE) nodeToJson(data, (mpv_node*)p->data);
            else data += "null";
            data += '}';
            postSignal("mpv-prop-change", data);
            break;
        }
        case MPV_EVENT_END_FILE: {
            auto* e = (mpv_event_end_file*)ev->data;
            PostMessageW(g_main, WM_HDR_UPDATE, 0, 0);   // video skončilo -> HDR už není potřeba
            if (e->reason == MPV_END_FILE_REASON_EOF) postSignal("mpv-event-ended", "{\"reason\":\"eof\"}");
            else if (e->reason == MPV_END_FILE_REASON_ERROR) {
                std::string d = "{\"reason\":\"error\",\"error\":{\"code\":85,\"critical\":true,\"message\":";
                jsonEscape(d, mpv_error_string(e->error));
                d += "}}";
                postSignal("mpv-event-ended", d);
            }
            break;
        }
        default: break;
        }
    }
}

static bool initMpv() {
    g_mpv = mpv_create();
    if (!g_mpv) return false;
    mpv_set_option_string(g_mpv, "config", "no");
    mpv_set_option_string(g_mpv, "idle", "yes");
    mpv_set_option_string(g_mpv, "osc", "no");
    mpv_set_option_string(g_mpv, "input-default-bindings", "no");
    mpv_set_option_string(g_mpv, "input-vo-keyboard", "no");
    mpv_set_option_string(g_mpv, "terminal", "no");
    mpv_set_option_string(g_mpv, "vo", "gpu-next");
    mpv_set_option_string(g_mpv, "gpu-context", "d3d11");
    mpv_set_option_string(g_mpv, "hwdec", "auto");
    mpv_set_option_string(g_mpv, "target-colorspace-hint", "yes");   // HDR passthrough, když je displej v HDR
    mpv_set_option_string(g_mpv, "volume-max", "200");   // posuvník hlasitosti jde do 200 %, výchozí strop mpv je 130
    mpv_set_option_string(g_mpv, "keep-open", "no");
    // Synchronizace obrazu podle displeje (jako madVR), ne podle zvuku: plynulý rytmus 24p na 144 Hz.
    mpv_set_option_string(g_mpv, "video-sync", "display-resample");
    mpv_set_option_string(g_mpv, "force-window", "yes");
    int64_t wid = (int64_t)(intptr_t)g_video;
    mpv_set_option(g_mpv, "wid", MPV_FORMAT_INT64, &wid);
    if (mpv_initialize(g_mpv) < 0) return false;
    mpv_observe_property(g_mpv, 2, "video-params", MPV_FORMAT_NODE);
    mpv_request_log_messages(g_mpv, getenv("STREMIO_MOD_LOG") ? "v" : "warn");
    g_mpvThread = std::thread(mpvThreadMain);
    return true;
}

// ---------- Discord (aktivita „sleduje“ přes lokální IPC Discordu) ----------
// Web posílá discord-connect / discord-disconnect / discord-set-activity / discord-clear-activity a čeká na signál
// discord-status {connected}. Discord desktop poslouchá na rouře \\.\pipe\discord-ipc-0..9; zpráva = [op:int32][délka:int32][JSON].
// Všechno běží v jednom vlákně; web jen nastaví, co chce, a vlákno to dožene (i po restartu Discordu pošle poslední aktivitu znovu).

static const char* kDiscordClientId = "1563610052621901894";   // Application ID aplikace „Lumen“ z discord.com/developers
static std::mutex g_discordMu;
static std::condition_variable g_discordCv;
static bool g_discordWant = false;          // web chce být připojený
static bool g_discordConnectAsked = false;  // web čeká na odpověď discord-status
static std::string g_discordActivity;       // hotový JSON aktivity, prázdné = žádná
static bool g_discordDirty = false;
static bool g_discordThread = false;

static std::string discordClientId() {
    if (const char* e = getenv("LUMEN_DISCORD_CLIENT_ID")) if (*e) return e;
    return kDiscordClientId;
}

static bool discordWrite(HANDLE pipe, int op, const std::string& json) {
    std::string frame(8, '\0');
    int32_t hdr[2] = { op, (int32_t)json.size() };
    memcpy(&frame[0], hdr, 8);
    frame += json;
    DWORD written = 0;
    return WriteFile(pipe, frame.data(), (DWORD)frame.size(), &written, nullptr) && written == frame.size();
}

// Přečte jednu odpověď (čeká nejvýš timeoutMs). Vrací false při chybě nebo zavřené rouře.
static bool discordRead(HANDLE pipe, int& op, std::string& json, DWORD timeoutMs) {
    ULONGLONG deadline = GetTickCount64() + timeoutMs;
    DWORD avail = 0;
    for (;;) {
        if (!PeekNamedPipe(pipe, nullptr, 0, nullptr, &avail, nullptr)) return false;
        if (avail >= 8) break;
        if (GetTickCount64() > deadline) return false;
        Sleep(20);
    }
    int32_t hdr[2]; DWORD got = 0;
    if (!ReadFile(pipe, hdr, 8, &got, nullptr) || got != 8 || hdr[1] < 0 || hdr[1] > (1 << 20)) return false;
    op = hdr[0];
    json.assign(hdr[1], '\0');
    DWORD off = 0;
    while (off < (DWORD)hdr[1]) {
        if (!ReadFile(pipe, &json[off], hdr[1] - off, &got, nullptr) || !got) return false;
        off += got;
    }
    return true;
}

static HANDLE discordOpen() {
    std::string id = discordClientId();
    if (id.empty() || id == "DISCORD_CLIENT_ID") { logf("DISCORD no client id"); return INVALID_HANDLE_VALUE; }
    for (int n = 0; n < 10; n++) {
        std::wstring name = L"\\\\.\\pipe\\discord-ipc-" + std::to_wstring(n);
        HANDLE pipe = CreateFileW(name.c_str(), GENERIC_READ | GENERIC_WRITE, 0, nullptr, OPEN_EXISTING, 0, nullptr);
        if (pipe == INVALID_HANDLE_VALUE) continue;
        std::string hello = "{\"v\":1,\"client_id\":";
        jsonEscape(hello, id.c_str());
        hello += "}";
        int op = 0; std::string reply;
        if (discordWrite(pipe, 0, hello) && discordRead(pipe, op, reply, 3000) && op == 1 && reply.find("\"READY\"") != std::string::npos) {
            logf("DISCORD connected (pipe %d)", n);
            return pipe;
        }
        logf("DISCORD handshake failed on pipe %d: %.200s", n, reply.c_str());
        CloseHandle(pipe);
    }
    return INVALID_HANDLE_VALUE;
}

static bool discordSend(HANDLE pipe, const std::string& activity) {
    static unsigned nonce = 0;
    std::string cmd = "{\"cmd\":\"SET_ACTIVITY\",\"args\":{\"pid\":" + std::to_string(GetCurrentProcessId()) +
        ",\"activity\":" + (activity.empty() ? "null" : activity) + "},\"nonce\":\"" + std::to_string(++nonce) + "\"}";
    int op = 0; std::string reply;
    if (!discordWrite(pipe, 1, cmd) || !discordRead(pipe, op, reply, 3000)) return false;
    if (reply.find("\"ERROR\"") != std::string::npos) logf("DISCORD activity rejected: %.300s", reply.c_str());
    return op == 1;
}

static void discordStatus(bool connected) {
    postSignal("discord-status", connected ? "{\"connected\":true}" : "{\"connected\":false}");
}

static void discordWorker() {
    HANDLE pipe = INVALID_HANDLE_VALUE;
    for (;;) {
        bool want, asked, dirty; std::string activity;
        {
            std::unique_lock<std::mutex> lock(g_discordMu);
            g_discordCv.wait_for(lock, std::chrono::seconds(5));
            if (g_quit) break;
            want = g_discordWant; asked = g_discordConnectAsked; dirty = g_discordDirty; activity = g_discordActivity;
            g_discordConnectAsked = false; g_discordDirty = false;
        }
        // Discord mezitím zavřený?
        if (pipe != INVALID_HANDLE_VALUE) {
            DWORD avail = 0;
            if (!PeekNamedPipe(pipe, nullptr, 0, nullptr, &avail, nullptr)) {
                logf("DISCORD pipe closed");
                CloseHandle(pipe); pipe = INVALID_HANDLE_VALUE;
                discordStatus(false);
            }
        }
        if (!want) {
            if (pipe != INVALID_HANDLE_VALUE) {
                discordSend(pipe, "");
                discordWrite(pipe, 2, "{}");
                CloseHandle(pipe); pipe = INVALID_HANDLE_VALUE;
                discordStatus(false);
            }
            continue;
        }
        if (pipe == INVALID_HANDLE_VALUE) {
            if (!asked) continue;   // připojujeme se jen na žádost webu (zkouší to každých 15 s)
            pipe = discordOpen();
            discordStatus(pipe != INVALID_HANDLE_VALUE);
            if (pipe == INVALID_HANDLE_VALUE) continue;
            dirty = true;           // po (znovu)připojení pošleme poslední aktivitu
        } else if (asked) {
            discordStatus(true);
        }
        if (dirty && !discordSend(pipe, activity)) {
            logf("DISCORD send failed");
            CloseHandle(pipe); pipe = INVALID_HANDLE_VALUE;
            discordStatus(false);
            std::lock_guard<std::mutex> lock(g_discordMu);
            g_discordDirty = true;
        }
    }
    if (pipe != INVALID_HANDLE_VALUE) { discordSend(pipe, ""); CloseHandle(pipe); }
}

// Discord bere u textů 2–128 bajtů; zkrátí na hranici znaku UTF-8.
static std::string discordText(const std::string& s) {
    std::string t = s;
    if (t.size() > 128) {
        size_t cut = 125;
        while (cut > 0 && ((unsigned char)t[cut] & 0xC0) == 0x80) cut--;
        t = t.substr(0, cut) + "...";
    }
    if (t.size() < 2) t += "  ";
    return t;
}

static std::string discordActivityJson(const Json& a) {
    auto str = [&](const char* k) { const Json* v = a.get(k); return v && v->type == Json::Str ? v->s : std::string(); };
    auto num = [&](const char* k) { const Json* v = a.get(k); return v && v->type == Json::Num && v->n > 0 ? (long long)v->n : 0LL; };
    std::string state = str("state"), details = str("details"), image = str("image");
    std::string j = "{\"type\":3";   // 3 = „Sleduje“
    if (!details.empty()) { j += ",\"details\":"; jsonEscape(j, discordText(details).c_str()); }
    if (!state.empty()) { j += ",\"state\":"; jsonEscape(j, discordText(state).c_str()); }
    long long start = num("startTimestamp"), end = num("endTimestamp");
    if (start || end) {
        j += ",\"timestamps\":{";
        if (start) j += "\"start\":" + std::to_string(start);
        if (end) j += std::string(start ? "," : "") + "\"end\":" + std::to_string(end);
        j += "}";
    }
    j += ",\"assets\":{\"large_image\":";
    // plakát z addonu (Discord umí https adresy); jinak ikona nahraná u aplikace pod názvem „lumen“
    jsonEscape(j, image.rfind("https://", 0) == 0 && image.size() <= 256 ? image.c_str() : "lumen");
    j += ",\"large_text\":";
    jsonEscape(j, discordText(details.empty() ? "Lumen" : details).c_str());
    j += "}}";
    return j;
}

static void discordCommand(const std::string& method, const Json* arg) {
    std::lock_guard<std::mutex> lock(g_discordMu);
    if (!g_discordThread) { g_discordThread = true; std::thread(discordWorker).detach(); }
    if (method == "discord-connect") { g_discordWant = true; g_discordConnectAsked = true; }
    else if (method == "discord-disconnect") { g_discordWant = false; g_discordActivity.clear(); }
    else if (method == "discord-clear-activity") { g_discordActivity.clear(); g_discordDirty = true; }
    else if (method == "discord-set-activity" && arg && arg->type == Json::Obj) { g_discordActivity = discordActivityJson(*arg); g_discordDirty = true; }
    else return;
    g_discordCv.notify_one();
}

// ---------- Aktualizace z aplikace ----------
// Web zjistí novou verzi na GitHubu a pošle adresu instalátoru a jeho SHA-256. Obal ho stáhne, ověří otisk, spustí
// potichu (/S /UPDATE) do složky, ze které běží, a skončí; instalátor přepíše soubory a Lumen znovu spustí.

#pragma comment(lib, "urlmon.lib")
#pragma comment(lib, "bcrypt.lib")

static const char* LUMEN_VERSION = "2.0.0";   // držet shodně s installer\setup.cpp a setup.rc
static std::atomic<bool> g_updating{false};
static std::wstring exeDir();

static void updateStatus(const char* state, int percent = 0, const char* detail = "") {
    std::string d = "{\"state\":";
    jsonEscape(d, state);
    d += ",\"percent\":" + std::to_string(percent) + ",\"detail\":";
    jsonEscape(d, detail);
    d += "}";
    postSignal("lumen-update-status", d);
}

static bool fileSha256(const std::wstring& path, std::string& hex) {
    BCRYPT_ALG_HANDLE alg = nullptr;
    if (BCryptOpenAlgorithmProvider(&alg, BCRYPT_SHA256_ALGORITHM, nullptr, 0) < 0) return false;
    bool ok = false;
    BCRYPT_HASH_HANDLE h = nullptr;
    if (BCryptCreateHash(alg, &h, nullptr, 0, nullptr, 0, 0) >= 0) {
        HANDLE f = CreateFileW(path.c_str(), GENERIC_READ, FILE_SHARE_READ, nullptr, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, nullptr);
        if (f != INVALID_HANDLE_VALUE) {
            std::vector<unsigned char> buf(1 << 20);
            DWORD n = 0;
            ok = true;
            while (ReadFile(f, buf.data(), (DWORD)buf.size(), &n, nullptr) && n)
                if (BCryptHashData(h, buf.data(), n, 0) < 0) { ok = false; break; }
            CloseHandle(f);
            unsigned char out[32];
            if (ok && BCryptFinishHash(h, out, sizeof out, 0) >= 0) {
                hex.clear();
                for (unsigned char b : out) { char t[3]; snprintf(t, sizeof t, "%02x", b); hex += t; }
            } else ok = false;
        }
        BCryptDestroyHash(h);
    }
    BCryptCloseAlgorithmProvider(alg, 0);
    return ok;
}

struct DownloadProgress : IBindStatusCallback {
    int last = -1;
    STDMETHODIMP QueryInterface(REFIID r, void** p) override {
        if (r == IID_IUnknown || r == IID_IBindStatusCallback) { *p = this; return S_OK; }
        *p = nullptr; return E_NOINTERFACE;
    }
    STDMETHODIMP_(ULONG) AddRef() override { return 1; }
    STDMETHODIMP_(ULONG) Release() override { return 1; }
    STDMETHODIMP OnStartBinding(DWORD, IBinding*) override { return S_OK; }
    STDMETHODIMP GetPriority(LONG*) override { return E_NOTIMPL; }
    STDMETHODIMP OnLowResource(DWORD) override { return S_OK; }
    STDMETHODIMP OnProgress(ULONG now, ULONG max, ULONG, LPCWSTR) override {
        if (max) { int p = (int)((unsigned long long)now * 100 / max); if (p != last) { last = p; updateStatus("downloading", p); } }
        return S_OK;
    }
    STDMETHODIMP OnStopBinding(HRESULT, LPCWSTR) override { return S_OK; }
    STDMETHODIMP GetBindInfo(DWORD*, BINDINFO*) override { return S_OK; }
    STDMETHODIMP OnDataAvailable(DWORD, DWORD, FORMATETC*, STGMEDIUM*) override { return S_OK; }
    STDMETHODIMP OnObjectAvailable(REFIID, IUnknown*) override { return S_OK; }
};

static void updateWorker(std::string url, std::string sha) {
    auto fail = [](const char* why) { logf("UPDATE failed: %s", why); updateStatus("error", 0, why); g_updating = false; };
    std::wstring dir = exeDir();
    size_t slash = dir.find_last_of(L'\\');
    if (_wcsicmp((slash == std::wstring::npos ? dir : dir.substr(slash + 1)).c_str(), L"Lumen") != 0) return fail("notinstalled");

    wchar_t tmp[MAX_PATH];
    GetTempPathW(MAX_PATH, tmp);
    std::wstring file = std::wstring(tmp) + L"Lumen-Setup-update.exe";
    DeleteFileW(file.c_str());
    updateStatus("downloading", 0);
    DownloadProgress cb;
    if (URLDownloadToFileW(nullptr, widen(url).c_str(), file.c_str(), 0, &cb) != S_OK) return fail("download");
    std::string got;
    if (!fileSha256(file, got) || got != sha) { DeleteFileW(file.c_str()); return fail("checksum"); }

    updateStatus("installing");
    std::wstring cmd = L"\"" + file + L"\" /S /UPDATE /D=\"" + dir + L"\"";
    std::vector<wchar_t> buf(cmd.begin(), cmd.end());
    buf.push_back(0);
    STARTUPINFOW si{}; si.cb = sizeof si;
    PROCESS_INFORMATION pi{};
    if (!CreateProcessW(nullptr, buf.data(), nullptr, nullptr, FALSE, DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP, nullptr, nullptr, &si, &pi))
        return fail("launch");
    CloseHandle(pi.hThread);
    CloseHandle(pi.hProcess);
    logf("UPDATE installer started, closing");
    PostMessageW(g_main, WM_CLOSE, 0, 0);
}

static bool validUpdateRequest(const std::string& url, const std::string& sha) {
    static const std::string prefix = "https://github.com/samuelthomask/Lumen/releases/download/";
    static const std::string suffix = "/Lumen-Setup.exe";
    if (url.size() <= prefix.size() + suffix.size()) return false;
    if (_strnicmp(url.c_str(), prefix.c_str(), prefix.size()) != 0) return false;   // GitHub vrací adresy s názvem repozitáře malými písmeny
    if (url.compare(url.size() - suffix.size(), suffix.size(), suffix) != 0) return false;
    if (url.find_first_of("\"\\ <>|^&%") != std::string::npos) return false;
    if (sha.size() != 64) return false;
    for (char c : sha) if (!((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f'))) return false;
    return true;
}

// ---------- Příkazy z webu ----------

static void handleWebMessage(const std::string& text) {
    Json msg;
    JsonParser parser(text);
    if (!parser.parse(msg) || msg.type != Json::Obj) return;
    const Json* type = msg.get("type");
    if (!type || type->type != Json::Num) return;

    if ((int)type->n == 3) { // INIT
        // [?, jméno, ?, hodnota] – web bere položky o délce >= 4 s neprázdným [1]
        auto prop = [](const char* name, const char* value) {
            std::string s = "[0,"; jsonEscape(s, name); s += ",0,"; jsonEscape(s, value); s += ']'; return s;
        };
        std::string init = "{\"id\":0,\"type\":3,\"data\":{\"transport\":{\"properties\":[";
        init += prop("shellVersion", (std::string("lumen ") + LUMEN_VERSION).c_str()) + ',';
        init += prop("streamingServerUrl", "http://127.0.0.1:11470/") + ',';
        init += prop("gpuVideoProcessing", "false") + ',';
        init += prop("nativeAssSubtitles", "false") + ',';
        init += prop("cacheDirectoryPicker", "false") + ',';
        init += prop("nativeInterfaceScale", "false");
        init += "]}}}";
        auto* m = new std::string(init);
        if (!PostMessageW(g_main, WM_SHELL_SIGNAL, 0, (LPARAM)m)) delete m;
        sendVisibility();
        return;
    }
    if ((int)type->n != 6) return;

    const Json* args = msg.get("args");
    if (!args || args->type != Json::Arr || args->a.empty() || args->a[0].type != Json::Str) return;
    const std::string& method = args->a[0].s;
    if (method != "mpv-observe-prop") logf("web -> shell: %s", method.c_str());
    const Json* arg1 = args->a.size() > 1 ? &args->a[1] : nullptr;

    if (method == "mpv-command" && arg1 && arg1->type == Json::Arr) {
        std::vector<std::string> strs;
        for (auto& x : arg1->a) strs.push_back(x.toMpvString());
        std::vector<const char*> argv;
        for (auto& s : strs) argv.push_back(s.c_str());
        argv.push_back(nullptr);
        if (strs.size() > 1 && strs[0] == "loadfile") logf("TIMELINE web: loadfile %.60s", strs[1].c_str());
        int r = mpv_command(g_mpv, argv.data());
        if (r < 0) logf("mpv command %s: %s", strs.empty() ? "?" : strs[0].c_str(), mpv_error_string(r));
    } else if (method == "mpv-set-prop" && arg1 && arg1->type == Json::Arr && arg1->a.size() == 2 && arg1->a[0].type == Json::Str) {
        mpvSetProp(arg1->a[0].s, arg1->a[1].toMpvString());
    } else if (method == "mpv-observe-prop" && arg1 && arg1->type == Json::Str) {
        mpv_observe_property(g_mpv, 0, arg1->s.c_str(), MPV_FORMAT_NODE);
    } else if (method == "win-set-visibility" && arg1 && arg1->type == Json::Obj) {
        if (const Json* fs = arg1->get("fullscreen")) if (fs->type == Json::Bool) setFullscreen(fs->b);
    } else if (method == "lumen-keep-overlay" && arg1 && arg1->type == Json::Bool) {
        g_keepOverlay = arg1->b;
        if (g_keepOverlay) overlayShow();
    } else if (method == "lumen-update" && args->a.size() > 2 && arg1 && arg1->type == Json::Str && args->a[2].type == Json::Str) {
        const std::string url = arg1->s, sha = args->a[2].s;
        if (!validUpdateRequest(url, sha)) updateStatus("error", 0, "invalid");
        else if (!g_updating.exchange(true)) std::thread(updateWorker, url, sha).detach();
    } else if (method.rfind("discord-", 0) == 0) {
        discordCommand(method, arg1);
    } else if (method == "quit") {
        PostMessageW(g_main, WM_CLOSE, 0, 0);
    }
    // ostatní (app-ready, media.*, mpv-set-gpu-video-processing...) zatím ignorujeme
}

// ---------- Okno ----------

static void resizeChildren() {
    RECT rc; GetClientRect(g_main, &rc);
    if (g_video) SetWindowPos(g_video, HWND_BOTTOM, 0, 0, rc.right, rc.bottom, SWP_NOACTIVATE);
    if (g_controller) g_controller->put_Bounds(rc);
}

static std::wstring exeDir() {
    wchar_t p[MAX_PATH]; GetModuleFileNameW(nullptr, p, MAX_PATH);
    std::wstring s = p; return s.substr(0, s.find_last_of(L'\\'));
}

static void initWebView(HWND hwnd, const std::wstring& webRoot, const std::wstring& startUrl) {
    wchar_t* appData = nullptr;
    SHGetKnownFolderPath(FOLDERID_LocalAppData, 0, nullptr, &appData);
    std::wstring userData = std::wstring(appData) + L"\\StremioMod\\WebView2";
    if (const wchar_t* e = _wgetenv(L"STREMIO_MOD_PROFILE")) userData = e;   // vývojově: izolovaný (čistý) profil
    CoTaskMemFree(appData);

    // Server.js posílá CORS hlavičky jen pro vybrané původy (mj. ty končící na localhost:11470), proto je naše stránka
    // lokálně namapovaná na lumen.localhost (port 11470; jen uvnitř tohoto okna, DNS se nepoužije).
    // Chromium navíc blokuje přístup na 127.0.0.1 z "veřejné" stránky (Private Network Access).
    SetEnvironmentVariableW(L"WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS",
        L"--disable-features=PrivateNetworkAccessSendPreflights,PrivateNetworkAccessRespectPreflightResults,BlockInsecurePrivateNetworkRequests,LocalNetworkAccessChecks");

    // Vrstva DirectComposition nad celým oknem (i nad okénkem mpv); WebView2 se do ní kreslí s průhledností.
    DCompositionCreateDevice(nullptr, IID_PPV_ARGS(&g_dcomp));
    g_dcomp->CreateTargetForHwnd(hwnd, TRUE, &g_dcompTarget);
    g_dcomp->CreateVisual(&g_dcompRoot);
    g_dcompTarget->SetRoot(g_dcompRoot.Get());
    g_dcomp->Commit();

    CreateCoreWebView2EnvironmentWithOptions(nullptr, userData.c_str(), nullptr,
        Callback<ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler>(
            [hwnd, webRoot, startUrl](HRESULT hr, ICoreWebView2Environment* env) -> HRESULT {
                if (FAILED(hr)) { logf("WebView2 env failed 0x%08x", (unsigned)hr); return hr; }
                ComPtr<ICoreWebView2Environment3> env3;
                if (FAILED(env->QueryInterface(IID_PPV_ARGS(&env3)))) { logf("WebView2 runtime too old (Environment3)"); return E_NOINTERFACE; }
                env3->CreateCoreWebView2CompositionController(hwnd,
                    Callback<ICoreWebView2CreateCoreWebView2CompositionControllerCompletedHandler>(
                        [webRoot, startUrl](HRESULT hr2, ICoreWebView2CompositionController* comp) -> HRESULT {
                            if (FAILED(hr2) || !comp) { logf("WebView2 controller failed 0x%08x", (unsigned)hr2); return hr2; }
                            g_comp = comp;
                            g_comp->put_RootVisualTarget(g_dcompRoot.Get());
                            g_dcomp->Commit();
                            g_comp.As(&g_controller);
                            g_controller->get_CoreWebView2(&g_webview);

                            EventRegistrationToken curTok;
                            g_comp->add_CursorChanged(
                                Callback<ICoreWebView2CursorChangedEventHandler>(
                                    [](ICoreWebView2CompositionController* s, IUnknown*) -> HRESULT {
                                        HCURSOR c = nullptr;
                                        s->get_Cursor(&c);
                                        g_cursor = c;
                                        if (c) SetCursor(c);
                                        return S_OK;
                                    }).Get(), &curTok);

                            ComPtr<ICoreWebView2Controller2> c2;
                            if (SUCCEEDED(g_controller.As(&c2))) {
                                COREWEBVIEW2_COLOR transparent{ 0, 0, 0, 0 };
                                c2->put_DefaultBackgroundColor(transparent);
                            }
                            ComPtr<ICoreWebView2Settings> settings;
                            g_webview->get_Settings(&settings);
                            if (settings) {
                                settings->put_AreDefaultContextMenusEnabled(FALSE);
                                settings->put_IsStatusBarEnabled(FALSE);
                                settings->put_IsZoomControlEnabled(FALSE);
                                ComPtr<ICoreWebView2Settings3> s3;
                                if (SUCCEEDED(settings.As(&s3))) s3->put_AreBrowserAcceleratorKeysEnabled(FALSE);
                            }
                            // stremio-video vypíná transkódování serverem (HLS), když existuje window.qt (starý Qt shell:
                            // přehrávač mpv umí všechno). Bez toho web podle schopností prohlížeče překóduje HEVC/DV/E-AC3
                            // filmy přes ffmpeg, což trvá několik sekund a zhoršuje plynulost. Přehrávání je přímé.
                            g_webview->AddScriptToExecuteOnDocumentCreated(
                                L"window.qt = window.qt || { webChannelTransport: { onmessage: null, send: function() {} } };", nullptr);

                            // Service worker (offline mezipaměť webu) v aplikaci nepotřebujeme a drží starou verzi webu:
                            // jednorázově ho odregistrovat, smazat cache, načíst znovu a dál ho zakázat.
                            g_webview->AddScriptToExecuteOnDocumentCreated(
                                L"(function(){var sw=navigator.serviceWorker;if(!sw)return;"
                                L"try{delete Navigator.prototype.serviceWorker;}catch(e){}"
                                L"sw.getRegistrations().then(function(rs){if(!rs.length)return;"
                                L"return Promise.all(rs.map(function(r){return r.unregister();}))"
                                L".then(function(){return caches.keys();})"
                                L".then(function(ks){return Promise.all(ks.map(function(k){return caches.delete(k);}));})"
                                L".then(function(){location.reload();});}).catch(function(){});})();", nullptr);

                            ComPtr<ICoreWebView2_3> wv3;
                            if (SUCCEEDED(g_webview.As(&wv3)))
                                wv3->SetVirtualHostNameToFolderMapping(L"lumen.localhost", webRoot.c_str(),
                                                                       COREWEBVIEW2_HOST_RESOURCE_ACCESS_KIND_ALLOW);

                            EventRegistrationToken tok;
                            g_webview->add_WebMessageReceived(
                                Callback<ICoreWebView2WebMessageReceivedEventHandler>(
                                    [](ICoreWebView2*, ICoreWebView2WebMessageReceivedEventArgs* args) -> HRESULT {
                                        LPWSTR raw = nullptr;
                                        if (SUCCEEDED(args->TryGetWebMessageAsString(&raw)) && raw) {
                                            handleWebMessage(narrow(raw));
                                            CoTaskMemFree(raw);
                                        }
                                        return S_OK;
                                    }).Get(), &tok);

                            // Odkazy z aplikace (target=_blank) otevřít ve výchozím prohlížeči, ne v novém okně WebView2.
                            EventRegistrationToken nwTok;
                            g_webview->add_NewWindowRequested(
                                Callback<ICoreWebView2NewWindowRequestedEventHandler>(
                                    [](ICoreWebView2*, ICoreWebView2NewWindowRequestedEventArgs* args) -> HRESULT {
                                        args->put_Handled(TRUE);
                                        LPWSTR uri = nullptr;
                                        if (SUCCEEDED(args->get_Uri(&uri)) && uri) {
                                            std::wstring u = uri;
                                            CoTaskMemFree(uri);
                                            if (u.rfind(L"https://", 0) == 0 || u.rfind(L"http://", 0) == 0)
                                                ShellExecuteW(nullptr, L"open", u.c_str(), nullptr, nullptr, SW_SHOWNORMAL);
                                        }
                                        return S_OK;
                                    }).Get(), &nwTok);

                            resizeChildren();
                            g_controller->put_IsVisible(getenv("STREMIO_MOD_HIDEWEB") ? FALSE : TRUE);
                            g_webview->Navigate(startUrl.c_str());

                            // Vývojový test: uloží vzhled webové vrstvy (s průhledností) do PNG a skončí.
                            if (_wgetenv(L"STREMIO_MOD_CAPTURE")) SetTimer(g_main, 1, getenv("STREMIO_MOD_CAPTURE_MS") ? atoi(getenv("STREMIO_MOD_CAPTURE_MS")) : 6000, nullptr);
                            return S_OK;
                        }).Get());
                return S_OK;
            }).Get());
}

static LRESULT CALLBACK wndProc(HWND hwnd, UINT msg, WPARAM wp, LPARAM lp) {
    switch (msg) {
    case WM_SIZE: resizeChildren(); return 0;
    case WM_SHELL_SIGNAL: {
        std::unique_ptr<std::string> m((std::string*)lp);
        if (g_webview) g_webview->PostWebMessageAsString(widen(*m).c_str());
        return 0;
    }
    case WM_MOUSEMOVE: case WM_LBUTTONDOWN: case WM_LBUTTONUP: case WM_LBUTTONDBLCLK:
    case WM_RBUTTONDOWN: case WM_RBUTTONUP: case WM_RBUTTONDBLCLK:
    case WM_MBUTTONDOWN: case WM_MBUTTONUP: case WM_MBUTTONDBLCLK:
    case WM_MOUSEWHEEL: case WM_MOUSEHWHEEL: case WM_MOUSELEAVE: {
        // Kompoziční WebView2 nedostává myš samo; předáváme mu ji.
        if (!g_comp) break;
        {   // Windows posílá "pohyb" i bez pohybu (např. po skrytí vrstvy); počítá se jen skutečná změna polohy.
            static LPARAM lastPos = -1;
            if (msg != WM_MOUSEMOVE || lp != lastPos) overlayShow();
            if (msg == WM_MOUSEMOVE) lastPos = lp;
        }
        POINT pt{ (int)(short)LOWORD(lp), (int)(short)HIWORD(lp) };
        UINT data = 0;
        if (msg == WM_MOUSEWHEEL || msg == WM_MOUSEHWHEEL) {
            ScreenToClient(hwnd, &pt);   // kolečko má souřadnice na obrazovce
            data = (UINT)(short)HIWORD(wp);
        }
        if (msg == WM_MOUSEMOVE && !g_trackingMouse) {
            TRACKMOUSEEVENT t{ sizeof t, TME_LEAVE, hwnd, 0 };
            TrackMouseEvent(&t);
            g_trackingMouse = true;
        }
        if (msg == WM_MOUSELEAVE) g_trackingMouse = false;
        if (msg == WM_LBUTTONDOWN || msg == WM_RBUTTONDOWN || msg == WM_MBUTTONDOWN) { SetCapture(hwnd); g_controller->MoveFocus(COREWEBVIEW2_MOVE_FOCUS_REASON_PROGRAMMATIC); }
        if (msg == WM_LBUTTONUP || msg == WM_RBUTTONUP || msg == WM_MBUTTONUP) ReleaseCapture();
        g_comp->SendMouseInput((COREWEBVIEW2_MOUSE_EVENT_KIND)msg,
                               (COREWEBVIEW2_MOUSE_EVENT_VIRTUAL_KEYS)(LOWORD(wp) & 0x7F), data, pt);
        return 0;
    }
    case WM_KEYDOWN: case WM_SYSKEYDOWN:
        overlayShow();
        break;
    case WM_SETCURSOR:
        if (LOWORD(lp) == HTCLIENT && g_overlayHidden) { SetCursor(nullptr); return TRUE; }
        if (LOWORD(lp) == HTCLIENT && g_cursor) { SetCursor(g_cursor); return TRUE; }
        break;
    case WM_SETFOCUS:
        if (g_controller) g_controller->MoveFocus(COREWEBVIEW2_MOVE_FOCUS_REASON_PROGRAMMATIC);
        return 0;
    case WM_TIMER:
        if (wp == 1) {
            KillTimer(hwnd, 1);
            ComPtr<IStream> stream;
            SHCreateStreamOnFileW(_wgetenv(L"STREMIO_MOD_CAPTURE"), STGM_CREATE | STGM_WRITE, &stream);
            g_webview->CapturePreview(COREWEBVIEW2_CAPTURE_PREVIEW_IMAGE_FORMAT_PNG, stream.Get(),
                Callback<ICoreWebView2CapturePreviewCompletedHandler>([](HRESULT) -> HRESULT {
                    PostMessageW(g_main, WM_CLOSE, 0, 0);
                    return S_OK;
                }).Get());
        }
        if (wp == 7) logPlaybackStats();
        if (wp == 8) overlayCheckIdle();
        if (wp == 6) { KillTimer(hwnd, 6); g_webview->ExecuteScript(L"String(window.__r)",
            Callback<ICoreWebView2ExecuteScriptCompletedHandler>([](HRESULT, LPCWSTR res) -> HRESULT {
                logf("EVAL result: %s", narrow(res ? res : L"(null)").c_str()); return S_OK; }).Get()); }
        if (wp == 5) { // vývojově: spustí skript z STREMIO_MOD_EVAL na stránce a zapíše výsledek do logu
            KillTimer(hwnd, 5);
            g_webview->ExecuteScript(_wgetenv(L"STREMIO_MOD_EVAL"),
                Callback<ICoreWebView2ExecuteScriptCompletedHandler>([](HRESULT, LPCWSTR res) -> HRESULT {
                    logf("EVAL: %s", narrow(res ? res : L"(null)").c_str());
                    return S_OK;
                }).Get());
        }
        // Vývojový test auto HDR: fullscreen zapnout (id 2), vypnout (id 3), skončit (id 4).
        if (wp == 2) { KillTimer(hwnd, 2); setFullscreen(true); }
        if (wp == 3) { KillTimer(hwnd, 3); setFullscreen(false); }
        if (wp == 4) { KillTimer(hwnd, 4); PostMessageW(hwnd, WM_CLOSE, 0, 0); }
        return 0;
    case WM_HDR_UPDATE:
        g_hdrVideo = wp != 0;
        hdrEvaluate();
        return 0;
    case WM_ENDSESSION:
        hdrRestore();
        break;
    case WM_CLOSE: DestroyWindow(hwnd); return 0;
    case WM_DESTROY:
        hdrRestore();
        g_quit = true;
        PostQuitMessage(0);
        return 0;
    case WM_ERASEBKGND: return 1;
    }
    return DefWindowProcW(hwnd, msg, wp, lp);
}

int WINAPI wWinMain(HINSTANCE inst, HINSTANCE, PWSTR cmdline, int show) {
    SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);
    CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED);

    // Nouzově: StremioMod.exe --hdr-off vrátí HDR, které po sobě zapomněl vypnout.
    hdrRecoverAfterCrash();
    if (cmdline && wcsstr(cmdline, L"--hdr-off")) return 0;
    SetUnhandledExceptionFilter(crashHandler);
    if (!getenv("STREMIO_MOD_NOSERVER")) startServer();

    // Cesty lze přepsat proměnnými prostředí (pro vývoj).
    std::wstring webRoot = exeDir() + L"\\web";
    if (const wchar_t* e = _wgetenv(L"STREMIO_MOD_WEB")) webRoot = e;
    std::wstring startUrl = L"https://lumen.localhost:11470/index.html";
    if (const wchar_t* e = _wgetenv(L"STREMIO_MOD_URL")) startUrl = e;

    WNDCLASSW wc{};
    wc.lpfnWndProc = wndProc; wc.hInstance = inst; wc.lpszClassName = L"StremioModMain";
    wc.hIcon = LoadIconW(inst, MAKEINTRESOURCEW(1));   // ikona aplikace (shell\res\lumen.ico)
    wc.hCursor = LoadCursorW(nullptr, IDC_ARROW); wc.hbrBackground = (HBRUSH)GetStockObject(BLACK_BRUSH);
    RegisterClassW(&wc);
    WNDCLASSW vc{};
    vc.lpfnWndProc = DefWindowProcW; vc.hInstance = inst; vc.lpszClassName = L"StremioModVideo";
    vc.hbrBackground = (HBRUSH)GetStockObject(BLACK_BRUSH);
    RegisterClassW(&vc);

    g_main = CreateWindowExW(0, L"StremioModMain", L"Lumen", WS_OVERLAPPEDWINDOW | WS_CLIPCHILDREN,
                             CW_USEDEFAULT, CW_USEDEFAULT,
                             getenv("STREMIO_MOD_W") ? atoi(getenv("STREMIO_MOD_W")) : 1280,
                             getenv("STREMIO_MOD_H") ? atoi(getenv("STREMIO_MOD_H")) : 720, nullptr, nullptr, inst, nullptr);
    g_video = CreateWindowExW(0, L"StremioModVideo", L"", WS_CHILD | WS_VISIBLE | WS_CLIPSIBLINGS,
                              0, 0, 1280, 720, g_main, nullptr, inst, nullptr);

    EnableWindow(g_video, FALSE);   // okno videa nemá brát myš, ta patří rozhraní nad ním
    if (!initMpv()) { MessageBoxW(g_main, L"Nepodařilo se spustit libmpv (chybí libmpv-2.dll?).", L"Lumen", MB_ICONERROR); return 1; }
    initWebView(g_main, webRoot, startUrl);

    ShowWindow(g_main, show);
    UpdateWindow(g_main);

    // Testovací režim: přehraje syntetické video bez sítě/souboru.
    if (const char* t = getenv("STREMIO_MOD_TESTSRC")) {
        const char* cmd[] = { "loadfile", t, nullptr };
        mpv_command(g_mpv, cmd);
    }

    SetTimer(g_main, 7, 5000, nullptr);
    SetTimer(g_main, 8, 500, nullptr);
    if (_wgetenv(L"STREMIO_MOD_EVAL")) { SetTimer(g_main, 5, getenv("STREMIO_MOD_AUTOFS") ? 8000 : 12000, nullptr); SetTimer(g_main, 6, 32000, nullptr); }
    if (getenv("STREMIO_MOD_AUTOFS")) {
        SetTimer(g_main, 2, 5000, nullptr);
        bool longRun = _wgetenv(L"STREMIO_MOD_EVAL") != nullptr;   // s EVAL nech fullscreen déle
        SetTimer(g_main, 3, longRun ? 40000 : 15000, nullptr);
        SetTimer(g_main, 4, longRun ? 44000 : 19000, nullptr);
    }

    MSG m;
    while (GetMessageW(&m, nullptr, 0, 0) > 0) { TranslateMessage(&m); DispatchMessageW(&m); }

    g_quit = true;
    if (g_mpv) { mpv_wakeup(g_mpv); }
    if (g_mpvThread.joinable()) g_mpvThread.join();
    if (g_mpv) mpv_terminate_destroy(g_mpv);
    return 0;
}
