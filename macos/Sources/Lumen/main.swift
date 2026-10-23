// Lumen pro macOS: okno s WKWebView (rozhraní) nad nativním videem mpv.
// Rozhraní (stremio-web) mluví s obalem stejným protokolem jako ve Windows (window.chrome.webview, JSON zprávy);
// tady ho zajišťuje malý skript vložený do stránky. Lokální server (Node + WebTorrent) běží jako pomocný proces
// a servíruje i samotné rozhraní.
//
// Video: mpv kreslí přes render API (OpenGL) přímo do našeho view, žádné vlastní okno mpv.
// Ladicí proměnné prostředí: LUMEN_HWDEC (videotoolbox), LUMEN_TEST_FILE, LUMEN_TEST_UPDATE (odkaz na DMG), LUMEN_WEB_DIR, LUMEN_LOG=1 (podrobný log do terminálu).

import AppKit
import WebKit
import CMpv
import Foundation
import OpenGL.GL3

let serverPort = 11470
let verbose = ProcessInfo.processInfo.environment["LUMEN_LOG"] != nil

func log(_ message: String) {
    if verbose { FileHandle.standardError.write(Data(("[lumen] " + message + "\n").utf8)) }
}

// MARK: - JSON pomocníci

func jsonString(_ object: Any) -> String {
    guard JSONSerialization.isValidJSONObject(object),
          let data = try? JSONSerialization.data(withJSONObject: object),
          let text = String(data: data, encoding: .utf8) else { return "null" }
    return text
}

/// Textový literál pro JavaScript (celý řetězec včetně uvozovek).
func jsLiteral(_ text: String) -> String {
    let data = try? JSONSerialization.data(withJSONObject: [text], options: [])
    var s = data.flatMap { String(data: $0, encoding: .utf8) } ?? "[\"\"]"
    s.removeFirst(); s.removeLast()
    return s
}

func nodeToJSON(_ n: mpv_node) -> Any {
    switch n.format {
    case MPV_FORMAT_STRING:
        return n.u.string.map { String(cString: $0) } ?? NSNull()
    case MPV_FORMAT_FLAG:
        return n.u.flag != 0
    case MPV_FORMAT_INT64:
        return NSNumber(value: n.u.int64)
    case MPV_FORMAT_DOUBLE:
        let d = n.u.double_
        return d.isFinite ? NSNumber(value: d) : NSNull()
    case MPV_FORMAT_NODE_ARRAY:
        guard let list = n.u.list else { return [Any]() }
        return (0..<Int(list.pointee.num)).map { nodeToJSON(list.pointee.values[$0]) }
    case MPV_FORMAT_NODE_MAP:
        guard let list = n.u.list else { return [String: Any]() }
        var dict = [String: Any]()
        for i in 0..<Int(list.pointee.num) {
            if let key = list.pointee.keys[i] { dict[String(cString: key)] = nodeToJSON(list.pointee.values[i]) }
        }
        return dict
    default:
        return NSNull()
    }
}

/// Hodnota z webu (JSON) převedená na text, jak ji čeká mpv.
func mpvString(_ value: Any) -> String {
    if let s = value as? String { return s }
    if let b = value as? Bool { return b ? "yes" : "no" }
    if let n = value as? NSNumber { return n.stringValue }
    return jsonString(value)
}

// MARK: - Video (mpv)

private func glProcAddress(_ ctx: UnsafeMutableRawPointer?, _ name: UnsafePointer<CChar>?) -> UnsafeMutableRawPointer? {
    guard let name = name else { return nil }
    return dlsym(UnsafeMutableRawPointer(bitPattern: -2), name)   // RTLD_DEFAULT: framework OpenGL je přilinkovaný
}

/// View s OpenGL kontextem, do kterého mpv kreslí přes render API.
final class MpvVideoView: NSOpenGLView {
    private var renderContext: OpaquePointer?

    init() {
        let attrs: [NSOpenGLPixelFormatAttribute] = [
            UInt32(NSOpenGLPFAOpenGLProfile), UInt32(NSOpenGLProfileVersion3_2Core),
            UInt32(NSOpenGLPFADoubleBuffer), UInt32(NSOpenGLPFAAccelerated),
            UInt32(NSOpenGLPFAColorSize), 24, 0
        ]
        super.init(frame: .zero, pixelFormat: NSOpenGLPixelFormat(attributes: attrs))!
        wantsBestResolutionOpenGLSurface = true
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    override var isOpaque: Bool { true }

    /// Vytvoří render kontext mpv; volat po mpv_initialize.
    func attach(_ mpv: OpaquePointer) -> Bool {
        guard let gl = openGLContext else { return false }
        gl.makeCurrentContext()
        var apiType = Array(MPV_RENDER_API_TYPE_OPENGL.utf8CString)
        var ctx: OpaquePointer?
        let r: Int32 = apiType.withUnsafeMutableBufferPointer { api in
            var initParams = mpv_opengl_init_params(get_proc_address: glProcAddress, get_proc_address_ctx: nil)
            return withUnsafeMutablePointer(to: &initParams) { ip in
                var params = [
                    mpv_render_param(type: MPV_RENDER_PARAM_API_TYPE, data: UnsafeMutableRawPointer(api.baseAddress)),
                    mpv_render_param(type: MPV_RENDER_PARAM_OPENGL_INIT_PARAMS, data: UnsafeMutableRawPointer(ip)),
                    mpv_render_param(type: MPV_RENDER_PARAM_INVALID, data: nil)
                ]
                return mpv_render_context_create(&ctx, mpv, &params)
            }
        }
        if r < 0 { log("mpv_render_context_create: \(String(cString: mpv_error_string(r)))"); return false }
        renderContext = ctx
        mpv_render_context_set_update_callback(ctx, { raw in
            guard let raw = raw else { return }
            let view = Unmanaged<MpvVideoView>.fromOpaque(raw).takeUnretainedValue()
            DispatchQueue.main.async { view.needsDisplay = true }
        }, Unmanaged.passUnretained(self).toOpaque())
        return true
    }

    override func draw(_ dirtyRect: NSRect) {
        guard let gl = openGLContext else { return }
        gl.makeCurrentContext()
        let size = convertToBacking(bounds).size
        if let ctx = renderContext {
            _ = mpv_render_context_update(ctx)
            var fbo = mpv_opengl_fbo(fbo: 0, w: Int32(size.width), h: Int32(size.height), internal_format: 0)
            var currentFbo: GLint = 0
            glGetIntegerv(GLenum(GL_FRAMEBUFFER_BINDING), &currentFbo)
            fbo.fbo = currentFbo
            var flipY: Int32 = 1
            withUnsafeMutablePointer(to: &fbo) { fp in
                withUnsafeMutablePointer(to: &flipY) { yp in
                    var params = [
                        mpv_render_param(type: MPV_RENDER_PARAM_OPENGL_FBO, data: UnsafeMutableRawPointer(fp)),
                        mpv_render_param(type: MPV_RENDER_PARAM_FLIP_Y, data: UnsafeMutableRawPointer(yp)),
                        mpv_render_param(type: MPV_RENDER_PARAM_INVALID, data: nil)
                    ]
                    mpv_render_context_render(ctx, &params)
                }
            }
        } else {
            glClearColor(0, 0, 0, 1)
            glClear(GLbitfield(GL_COLOR_BUFFER_BIT))
        }
        gl.flushBuffer()
    }

    override func reshape() {
        super.reshape()
        openGLContext?.update()
        needsDisplay = true
    }
}

final class Player {
    private(set) var handle: OpaquePointer?
    private var running = true
    var onSignal: ((String, Any) -> Void)?
    var onEnded: ((Any) -> Void)?

    func start(videoView: MpvVideoView) -> Bool {
        guard let h = mpv_create() else { return false }
        handle = h
        let env = ProcessInfo.processInfo.environment
        func opt(_ name: String, _ value: String) {
            let r = mpv_set_option_string(h, name, value)
            if r < 0 { log("mpv option \(name)=\(value): \(String(cString: mpv_error_string(r)))") }
        }
        opt("config", "no")
        opt("idle", "yes")
        opt("osc", "no")
        opt("input-default-bindings", "no")
        opt("input-vo-keyboard", "no")
        opt("terminal", "no")
        opt("volume-max", "200")   // posuvník hlasitosti jde do 200 %, výchozí strop mpv je 130
        opt("keep-open", "no")
        opt("vo", "libmpv")
        opt("hwdec", env["LUMEN_HWDEC"] ?? "videotoolbox")
        opt("video-sync", "audio")
        if mpv_initialize(h) < 0 { return false }
        if !videoView.attach(h) { return false }
        mpv_request_log_messages(h, verbose ? "v" : "warn")
        Thread.detachNewThread { [weak self] in self?.eventLoop() }
        return true
    }

    // Volání mpv běží mimo hlavní vlákno: video výstup mpv se při restartu dotazuje hlavního vlákna a jinak vznikne deadlock.
    private let mpvQueue = DispatchQueue(label: "lumen.mpv")

    func command(_ args: [String]) {
        mpvQueue.async { [weak self] in self?.commandSync(args) }
    }

    private func commandSync(_ args: [String]) {
        guard let h = handle else { return }
        var cargs: [UnsafePointer<CChar>?] = args.map { UnsafePointer(strdup($0)) } + [nil]
        let r = mpv_command(h, &cargs)
        cargs.forEach { if let p = $0 { free(UnsafeMutablePointer(mutating: p)) } }
        if r < 0 { log("mpv command \(args.first ?? "?"): \(String(cString: mpv_error_string(r)))") }
    }

    func setProperty(_ name: String, _ value: String) {
        // rozhraní chce vo=libmpv (render API), které tu nepoužíváme; ponecháme vlastní výstup
        if name == "vo" { return }
        mpvQueue.async { [weak self] in self?.setPropertySync(name, value) }
    }

    private func setPropertySync(_ name: String, _ value: String) {
        guard let h = handle else { return }
        let r = mpv_set_property_string(h, name, value)
        if r < 0 { log("mpv set \(name)=\(value): \(String(cString: mpv_error_string(r)))") }
    }

    func observe(_ name: String) {
        guard let h = handle else { return }
        mpv_observe_property(h, 0, name, MPV_FORMAT_NODE)
    }

    func shutdown() {
        running = false   // mpv se neničí: proces hned skončí a destroy na hlavním vlákně visel na zavírání zvuku
    }

    private func eventLoop() {
        while running {
            guard let h = handle, let ev = mpv_wait_event(h, 0.25) else { continue }
            switch ev.pointee.event_id {
            case MPV_EVENT_SHUTDOWN:
                return
            case MPV_EVENT_LOG_MESSAGE:
                if let raw = ev.pointee.data {
                    let m = raw.assumingMemoryBound(to: mpv_event_log_message.self).pointee
                    log("[mpv \(String(cString: m.prefix))] \(String(cString: m.text).trimmingCharacters(in: .newlines))")
                }
            case MPV_EVENT_PROPERTY_CHANGE:
                guard let raw = ev.pointee.data else { break }
                let p = raw.assumingMemoryBound(to: mpv_event_property.self).pointee
                let name = String(cString: p.name)
                var value: Any = NSNull()
                if p.format == MPV_FORMAT_NODE, let d = p.data { value = nodeToJSON(d.assumingMemoryBound(to: mpv_node.self).pointee) }
                onSignal?("mpv-prop-change", ["name": name, "data": value])
            case MPV_EVENT_END_FILE:
                guard let raw = ev.pointee.data else { break }
                let e = raw.assumingMemoryBound(to: mpv_event_end_file.self).pointee
                if e.reason == MPV_END_FILE_REASON_EOF {
                    onEnded?(["reason": "eof"])
                } else if e.reason == MPV_END_FILE_REASON_ERROR {
                    onEnded?(["reason": "error", "error": ["code": 85, "critical": true, "message": String(cString: mpv_error_string(e.error))]])
                }
            default:
                break
            }
        }
    }
}

// MARK: - Pomocný server (Node + WebTorrent)

final class LocalServer {
    private var process: Process?

    static func portOpen() -> Bool {
        let sock = socket(AF_INET, SOCK_STREAM, 0)
        if sock < 0 { return false }
        defer { close(sock) }
        var addr = sockaddr_in()
        addr.sin_family = sa_family_t(AF_INET)
        addr.sin_port = in_port_t(serverPort).bigEndian
        addr.sin_addr.s_addr = inet_addr("127.0.0.1")
        return withUnsafePointer(to: &addr) {
            $0.withMemoryRebound(to: sockaddr.self, capacity: 1) { connect(sock, $0, socklen_t(MemoryLayout<sockaddr_in>.size)) == 0 }
        }
    }

    /// Spustí server a počká, až naslouchá. Vrací chybovou zprávu, nebo nil.
    func start(webDir: String) -> String? {
        if LocalServer.portOpen() { log("server: port \(serverPort) already in use, using it"); return nil }
        let fm = FileManager.default
        let resources = Bundle.main.resourcePath ?? FileManager.default.currentDirectoryPath
        var serverDir = resources + "/torrent"
        if !fm.fileExists(atPath: serverDir + "/server.js"), let dev = ProcessInfo.processInfo.environment["LUMEN_SERVER_DIR"] { serverDir = dev }
        guard fm.fileExists(atPath: serverDir + "/server.js") else { return "server.js not found in \(serverDir)" }

        var nodeCandidates = [serverDir + "/node", "/opt/homebrew/bin/node", "/usr/local/bin/node", "/usr/bin/node"]
        if let custom = ProcessInfo.processInfo.environment["LUMEN_NODE"] { nodeCandidates.insert(custom, at: 0) }
        guard let node = nodeCandidates.first(where: { fm.isExecutableFile(atPath: $0) }) else {
            return "Node.js not found. Install it with: brew install node"
        }

        let support = fm.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("Lumen")
        try? fm.createDirectory(at: support, withIntermediateDirectories: true)

        let p = Process()
        p.executableURL = URL(fileURLWithPath: node)
        p.arguments = [serverDir + "/server.js"]
        p.currentDirectoryURL = URL(fileURLWithPath: serverDir)
        var env = ProcessInfo.processInfo.environment
        env["LUMEN_PORT"] = String(serverPort)
        env["LUMEN_WEB_DIR"] = webDir
        env["LUMEN_TORRENT_DIR"] = support.appendingPathComponent("torrents").path
        env["LUMEN_LOGFILE"] = support.appendingPathComponent("torrent-server.log").path
        p.environment = env
        do { try p.run() } catch { return "Cannot start the server: \(error.localizedDescription)" }
        process = p
        for _ in 0..<100 {
            if LocalServer.portOpen() { return nil }
            Thread.sleep(forTimeInterval: 0.1)
        }
        return "The server did not start (see \(support.path)/torrent-server.log)"
    }

    func stop() {
        if let p = process, p.isRunning { p.terminate() }
        process = nil
    }
}

// MARK: - Aplikace

let bridgeScript = """
(function () {
  var listeners = [];
  window.chrome = window.chrome || {};
  window.chrome.webview = {
    postMessage: function (m) { window.webkit.messageHandlers.lumen.postMessage(m); },
    addEventListener: function (t, l) { if (t === 'message') listeners.push(l); },
    removeEventListener: function (t, l) { listeners = listeners.filter(function (x) { return x !== l; }); }
  };
  window.__lumenReceive = function (s) { listeners.slice().forEach(function (l) { l({ data: s }); }); };
  // přehrává mpv, takže stremio-video nemá překódovávat přes server
  window.qt = window.qt || { webChannelTransport: { onmessage: null, send: function () {} } };
  // service worker v aplikaci nepotřebujeme (drží starou verzi webu)
  try { delete Navigator.prototype.serviceWorker; } catch (e) {}
})();
"""

final class AppDelegate: NSObject, NSApplicationDelegate, WKScriptMessageHandler, WKUIDelegate, WKNavigationDelegate, WKDownloadDelegate, NSWindowDelegate {
    var window: NSWindow!
    var webView: WKWebView!
    let videoView = MpvVideoView()
    let player = Player()
    let server = LocalServer()
    var fullscreen = false

    func applicationDidFinishLaunching(_ notification: Notification) {
        buildMenu()
        let webDir = resolveWebDir()

        let frame = NSRect(x: 0, y: 0, width: 1280, height: 800)
        window = NSWindow(contentRect: frame, styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
        window.title = "Lumen"
        window.appearance = NSAppearance(named: .darkAqua)
        window.backgroundColor = .black
        window.collectionBehavior = [.fullScreenPrimary]
        window.delegate = self
        window.center()

        let container = NSView(frame: frame)
        container.autoresizingMask = [.width, .height]
        videoView.frame = frame
        videoView.autoresizingMask = [.width, .height]
        container.addSubview(videoView)

        let config = WKWebViewConfiguration()
        config.userContentController.add(self, name: "lumen")
        config.userContentController.addUserScript(WKUserScript(source: bridgeScript, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        config.preferences.setValue(true, forKey: "developerExtrasEnabled")
        webView = WKWebView(frame: frame, configuration: config)
        webView.autoresizingMask = [.width, .height]
        webView.setValue(false, forKey: "drawsBackground")     // průhledné, aby bylo vidět video pod rozhraním
        webView.uiDelegate = self
        webView.navigationDelegate = self
        container.addSubview(webView)
        window.contentView = container
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)

        player.onSignal = { [weak self] name, data in self?.sendSignal(name, data) }
        player.onEnded = { [weak self] data in self?.sendSignal("mpv-event-ended", data) }
        if !player.start(videoView: videoView) { alert("Cannot start the mpv player (libmpv).") }
        if let test = ProcessInfo.processInfo.environment["LUMEN_TEST_FILE"] { player.command(["loadfile", test]) }   // ladění: přehraje soubor hned po startu

        if let test = ProcessInfo.processInfo.environment["LUMEN_TEST_UPDATE"] { downloadUpdate(test) }   // ladění: spustí aktualizaci z daného odkazu na DMG
        DispatchQueue.global().async { [weak self] in
            guard let self = self else { return }
            let error = self.server.start(webDir: webDir)
            DispatchQueue.main.async {
                if let error = error { self.alert(error) }
                self.webView.load(URLRequest(url: URL(string: "http://127.0.0.1:\(serverPort)/index.html")!))
            }
        }
    }

    func resolveWebDir() -> String {
        let env = ProcessInfo.processInfo.environment
        if let d = env["LUMEN_WEB_DIR"] { return d }
        return (Bundle.main.resourcePath ?? ".") + "/web"
    }

    func alert(_ text: String) {
        let a = NSAlert()
        a.messageText = "Lumen"
        a.informativeText = text
        a.runModal()
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }

    func applicationWillTerminate(_ notification: Notification) {
        server.stop()
        player.shutdown()
        exit(0)   // mpv už nemá vlastní okno, nečekáme na jeho úklid
    }

    func windowWillClose(_ notification: Notification) {
        if (notification.object as? NSWindow) === window { NSApp.terminate(nil) }
    }

    // MARK: menu (kopírovat/vložit v textových polích, ukončení, celá obrazovka)

    func buildMenu() {
        let main = NSMenu()
        let appItem = NSMenuItem(); main.addItem(appItem)
        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "Quit Lumen", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        appItem.submenu = appMenu

        let editItem = NSMenuItem(); main.addItem(editItem)
        let edit = NSMenu(title: "Edit")
        edit.addItem(withTitle: "Undo", action: Selector(("undo:")), keyEquivalent: "z")
        edit.addItem(withTitle: "Redo", action: Selector(("redo:")), keyEquivalent: "Z")
        edit.addItem(NSMenuItem.separator())
        edit.addItem(withTitle: "Cut", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        edit.addItem(withTitle: "Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        edit.addItem(withTitle: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        edit.addItem(withTitle: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
        editItem.submenu = edit

        let viewItem = NSMenuItem(); main.addItem(viewItem)
        let view = NSMenu(title: "View")
        let fs = view.addItem(withTitle: "Toggle Full Screen", action: #selector(NSWindow.toggleFullScreen(_:)), keyEquivalent: "f")
        fs.keyEquivalentModifierMask = [.command, .control]
        viewItem.submenu = view
        NSApp.mainMenu = main
    }

    // MARK: protokol s webem

    func send(_ object: Any) {
        let text = jsonString(object)
        let js = "window.__lumenReceive && window.__lumenReceive(\(jsLiteral(text)))"
        DispatchQueue.main.async { self.webView.evaluateJavaScript(js, completionHandler: nil) }
    }

    func sendSignal(_ name: String, _ data: Any) {
        send(["type": 1, "args": [name, data]] as [String: Any])
    }

    func sendVisibility() {
        sendSignal("win-visibility-changed", ["visible": true, "visibility": fullscreen ? 5 : 2, "isFullscreen": fullscreen] as [String: Any])
    }

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let text = message.body as? String,
              let data = text.data(using: .utf8),
              let msg = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
              let type = msg["type"] as? Int else { return }

        if type == 3 {   // INIT: vlastnosti obalu
            func prop(_ name: String, _ value: String) -> [Any] { [0, name, 0, value] }
            send(["id": 0, "type": 3, "data": ["transport": ["properties": [
                prop("shellVersion", "lumen-macos 1.2.10"),
                prop("streamingServerUrl", "http://127.0.0.1:\(serverPort)/"),
                prop("gpuVideoProcessing", "false"),
                prop("nativeAssSubtitles", "false"),
                prop("cacheDirectoryPicker", "false"),
                prop("nativeInterfaceScale", "false")
            ]]]] as [String: Any])
            sendVisibility()
            return
        }
        guard type == 6, let args = msg["args"] as? [Any], let method = args.first as? String else { return }
        let arg1: Any? = args.count > 1 ? args[1] : nil
        if method != "mpv-observe-prop" { log("web -> shell: \(method)") }

        switch method {
        case "mpv-command":
            if let list = arg1 as? [Any] { player.command(list.map { mpvString($0) }) }
        case "mpv-set-prop":
            if let pair = arg1 as? [Any], pair.count == 2, let name = pair[0] as? String { player.setProperty(name, mpvString(pair[1])) }
        case "mpv-observe-prop":
            if let name = arg1 as? String { player.observe(name) }
        case "win-set-visibility":
            if let d = arg1 as? [String: Any], let want = d["fullscreen"] as? Bool, want != fullscreen { window.toggleFullScreen(nil) }
        case "lumen-update":
            if let link = arg1 as? String { downloadUpdate(link) }
        case "quit":
            NSApp.terminate(nil)
        default:
            break   // app-ready, media.*, discord-* a další zatím ignorujeme
        }
    }

    // aktualizace: stáhne DMG z GitHub releases, nahradí tuto aplikaci novou verzí a spustí ji znovu.
    // Když to nejde (aplikace není v zapisovatelné složce, chyba sítě...), otevře se DMG a uživatel přetáhne Lumen ručně.
    func downloadUpdate(_ link: String) {
        guard let url = URL(string: link), url.scheme == "https", url.host == "github.com",
              url.path.hasPrefix("/samuelthomask/lumen/releases/download/"), url.pathExtension == "dmg" else { return }
        URLSession.shared.downloadTask(with: url) { [weak self] tmp, response, error in
            guard let self = self, let tmp = tmp, error == nil, (response as? HTTPURLResponse)?.statusCode == 200 else {
                DispatchQueue.main.async { NSWorkspace.shared.open(URL(string: "https://github.com/samuelthomask/lumen/releases/latest")!) }
                return
            }
            let fm = FileManager.default
            let work = fm.temporaryDirectory.appendingPathComponent("lumen-update-\(getpid())")
            try? fm.removeItem(at: work)
            try? fm.createDirectory(at: work, withIntermediateDirectories: true)
            let dmg = work.appendingPathComponent("Lumen.dmg")
            try? fm.moveItem(at: tmp, to: dmg)
            if !self.installUpdate(dmg: dmg, work: work) {
                let downloads = fm.urls(for: .downloadsDirectory, in: .userDomainMask).first ?? work
                let target = downloads.appendingPathComponent(url.lastPathComponent)
                try? fm.removeItem(at: target)
                try? fm.moveItem(at: dmg, to: target)
                DispatchQueue.main.async { NSWorkspace.shared.open(target) }
            }
            try? fm.removeItem(at: work)
        }.resume()
    }

    @discardableResult
    func run(_ path: String, _ args: [String]) -> Bool {
        let p = Process()
        p.executableURL = URL(fileURLWithPath: path)
        p.arguments = args
        p.standardOutput = FileHandle.nullDevice
        p.standardError = FileHandle.nullDevice
        do { try p.run() } catch { return false }
        p.waitUntilExit()
        return p.terminationStatus == 0
    }

    func installUpdate(dmg: URL, work: URL) -> Bool {
        let fm = FileManager.default
        let current = Bundle.main.bundleURL
        let parent = current.deletingLastPathComponent()
        guard current.pathExtension == "app", fm.isWritableFile(atPath: parent.path) else { log("update: app folder is not writable"); return false }
        let mount = work.appendingPathComponent("mnt")
        try? fm.createDirectory(at: mount, withIntermediateDirectories: true)
        guard run("/usr/bin/hdiutil", ["attach", "-nobrowse", "-readonly", "-noverify", "-mountpoint", mount.path, dmg.path]) else { return false }
        defer { run("/usr/bin/hdiutil", ["detach", mount.path, "-force"]) }
        let source = mount.appendingPathComponent("Lumen.app")
        let staged = parent.appendingPathComponent(".Lumen-update.app")
        try? fm.removeItem(at: staged)
        guard fm.fileExists(atPath: source.appendingPathComponent("Contents/Info.plist").path),
              run("/usr/bin/ditto", [source.path, staged.path]) else { try? fm.removeItem(at: staged); return false }
        run("/usr/bin/xattr", ["-cr", staged.path])
        // po ukončení této aplikace starou nahradí novou a spustí ji
        let script = "while kill -0 \(getpid()) 2>/dev/null; do sleep 0.3; done; rm -rf \"$1\" && mv \"$2\" \"$1\" && open \"$1\""
        let swap = Process()
        swap.executableURL = URL(fileURLWithPath: "/bin/sh")
        swap.arguments = ["-c", script, "sh", current.path, staged.path]
        swap.standardOutput = FileHandle.nullDevice
        swap.standardError = FileHandle.nullDevice
        guard (try? swap.run()) != nil else { try? fm.removeItem(at: staged); return false }
        log("update: installed, restarting")
        DispatchQueue.main.async { NSApp.terminate(nil) }
        return true
    }

    // fullscreen: stav z okna (tlačítko, klávesová zkratka) i z webu
    func windowDidEnterFullScreen(_ notification: Notification) { fullscreen = true; sendVisibility() }
    func windowDidExitFullScreen(_ notification: Notification) { fullscreen = false; sendVisibility() }

    // odkazy ven otevírat v prohlížeči
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url { NSWorkspace.shared.open(url) }
        return nil
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if navigationAction.shouldPerformDownload { decisionHandler(.download); return }   // export profilů (blob) apod.
        if let url = navigationAction.request.url, navigationAction.navigationType == .linkActivated,
           let scheme = url.scheme, scheme == "http" || scheme == "https", url.host != "127.0.0.1" {
            NSWorkspace.shared.open(url)
            decisionHandler(.cancel)
            return
        }
        decisionHandler(.allow)
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationResponse: WKNavigationResponse, decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        decisionHandler(navigationResponse.canShowMIMEType ? .allow : .download)
    }

    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) { download.delegate = self }
    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) { download.delegate = self }

    // stahování souborů: uživatel vybere, kam uložit
    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse, suggestedFilename: String, completionHandler: @escaping (URL?) -> Void) {
        DispatchQueue.main.async {
            let panel = NSSavePanel()
            panel.nameFieldStringValue = suggestedFilename
            panel.begin { completionHandler($0 == .OK ? panel.url : nil) }
        }
    }

    // potvrzení a upozornění z JavaScriptu (mazání profilu apod.)
    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let a = NSAlert(); a.messageText = message
        a.addButton(withTitle: "OK"); a.addButton(withTitle: "Cancel")
        completionHandler(a.runModal() == .alertFirstButtonReturn)
    }

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let a = NSAlert(); a.messageText = message; a.runModal(); completionHandler()
    }

    // výběr souboru (import profilů, titulky)
    func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping ([URL]?) -> Void) {
        let panel = NSOpenPanel()
        panel.allowsMultipleSelection = parameters.allowsMultipleSelection
        panel.canChooseDirectories = false
        panel.begin { completionHandler($0 == .OK ? panel.urls : nil) }
    }
}

let app = NSApplication.shared
app.setActivationPolicy(.regular)
let delegate = AppDelegate()
app.delegate = delegate
app.run()
