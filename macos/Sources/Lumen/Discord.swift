import Foundation
import Darwin

// MARK: - Discord (aktivita „sleduje“ přes lokální IPC Discordu)
// Stejný protokol jako ve Windows obalu (shell/src/main.cpp): Discord desktop poslouchá na unixovém socketu
// $TMPDIR/discord-ipc-0..9, zpráva = [op:int32][délka:int32][JSON]. Web posílá discord-connect / discord-disconnect /
// discord-set-activity / discord-clear-activity a čeká na signál discord-status {connected}. Vše běží v jedné frontě.

final class DiscordPresence {
    static let clientId = "1563610052621901894"   // Application ID aplikace „Lumen“ z discord.com/developers

    private let queue = DispatchQueue(label: "lumen.discord")
    private let status: (Bool) -> Void
    private var fd: Int32 = -1
    private var activity: [String: Any]? = nil
    private var nonce = 0

    init(status: @escaping (Bool) -> Void) { self.status = status }

    func handle(_ method: String, _ arg: Any?) {
        queue.async {
            switch method {
            case "discord-connect":
                if self.fd < 0 {
                    self.open()
                    if self.fd >= 0 { self.push() }   // po (znovu)připojení pošleme poslední aktivitu
                }
                self.status(self.fd >= 0)
            case "discord-disconnect":
                self.activity = nil
                if self.fd >= 0 { self.sendActivity(nil); self.close(); self.status(false) }
            case "discord-clear-activity":
                self.activity = nil
                self.push()
            case "discord-set-activity":
                if let a = arg as? [String: Any] { self.activity = DiscordPresence.build(a); self.push() }
            default:
                break
            }
        }
    }

    private func push() {
        guard fd >= 0 else { return }
        if !sendActivity(activity) {
            log("DISCORD send failed")
            close()
            status(false)   // web zkusí znovu se připojit za 15 s
        }
    }

    private func open() {
        let env = ProcessInfo.processInfo.environment
        let id = env["LUMEN_DISCORD_CLIENT_ID"].flatMap { $0.isEmpty ? nil : $0 } ?? DiscordPresence.clientId
        guard id != "DISCORD_CLIENT_ID" else { log("DISCORD no client id"); return }
        let base = env["XDG_RUNTIME_DIR"] ?? env["TMPDIR"] ?? NSTemporaryDirectory()
        for n in 0..<10 {
            let path = (base as NSString).appendingPathComponent("discord-ipc-\(n)")
            let s = socket(AF_UNIX, SOCK_STREAM, 0)
            if s < 0 { continue }
            var on: Int32 = 1
            setsockopt(s, SOL_SOCKET, SO_NOSIGPIPE, &on, socklen_t(MemoryLayout<Int32>.size))   // zavřený Discord nesmí shodit aplikaci
            var tv = timeval(tv_sec: 3, tv_usec: 0)
            setsockopt(s, SOL_SOCKET, SO_RCVTIMEO, &tv, socklen_t(MemoryLayout<timeval>.size))
            var addr = sockaddr_un()
            addr.sun_family = sa_family_t(AF_UNIX)
            let bytes = Array(path.utf8)
            guard bytes.count < MemoryLayout.size(ofValue: addr.sun_path) else { Darwin.close(s); continue }
            withUnsafeMutableBytes(of: &addr.sun_path) { raw in
                raw.copyBytes(from: bytes)
                raw[bytes.count] = 0
            }
            let connected = withUnsafePointer(to: &addr) {
                $0.withMemoryRebound(to: sockaddr.self, capacity: 1) { connect(s, $0, socklen_t(MemoryLayout<sockaddr_un>.size)) }
            } == 0
            if !connected { Darwin.close(s); continue }
            fd = s
            if write(op: 0, ["v": 1, "client_id": id]), let reply = read(), reply.op == 1, reply.json.contains("\"READY\"") {
                log("DISCORD connected (\(path))")
                return
            }
            log("DISCORD handshake failed on \(path)")
            close()
        }
    }

    private func close() {
        if fd >= 0 { Darwin.close(fd); fd = -1 }
    }

    @discardableResult
    private func sendActivity(_ a: [String: Any]?) -> Bool {
        nonce += 1
        let args: [String: Any] = ["pid": Int(getpid()), "activity": a ?? NSNull()]
        guard write(op: 1, ["cmd": "SET_ACTIVITY", "args": args, "nonce": String(nonce)]), let reply = read() else { return false }
        if reply.json.contains("\"ERROR\"") { log("DISCORD activity rejected: \(reply.json.prefix(300))") }
        return reply.op == 1
    }

    private func write(op: Int32, _ object: Any) -> Bool {
        let body = Array(jsonString(object).utf8)
        var frame = [UInt8]()
        withUnsafeBytes(of: op.littleEndian) { frame += $0 }
        withUnsafeBytes(of: Int32(body.count).littleEndian) { frame += $0 }
        frame += body
        return frame.withUnsafeBytes { Darwin.write(fd, $0.baseAddress, $0.count) } == frame.count
    }

    private func readExact(_ count: Int) -> [UInt8]? {
        var buf = [UInt8](repeating: 0, count: count)
        var off = 0
        while off < count {
            let r = buf.withUnsafeMutableBytes { Darwin.read(fd, $0.baseAddress! + off, count - off) }
            if r <= 0 { return nil }
            off += r
        }
        return buf
    }

    private func read() -> (op: Int32, json: String)? {
        guard let header = readExact(8) else { return nil }
        let op = header.withUnsafeBytes { Int32(littleEndian: $0.loadUnaligned(fromByteOffset: 0, as: Int32.self)) }
        let len = Int(header.withUnsafeBytes { Int32(littleEndian: $0.loadUnaligned(fromByteOffset: 4, as: Int32.self)) })
        guard len >= 0, len < 1 << 20, let body = readExact(len) else { return nil }
        return (op, String(decoding: body, as: UTF8.self))
    }

    // Discord bere u textů 2–128 bajtů.
    private static func text(_ s: String) -> String {
        var t = s
        if t.utf8.count > 128 {
            while t.utf8.count > 125 { t.removeLast() }
            t += "..."
        }
        if t.utf8.count < 2 { t += "  " }
        return t
    }

    private static func build(_ a: [String: Any]) -> [String: Any] {
        var out: [String: Any] = ["type": 3]   // 3 = „Sleduje“
        let details = a["details"] as? String ?? ""
        let state = a["state"] as? String ?? ""
        if !details.isEmpty { out["details"] = text(details) }
        if !state.isEmpty { out["state"] = text(state) }
        var timestamps: [String: Any] = [:]
        if let s = a["startTimestamp"] as? Double, s > 0 { timestamps["start"] = Int(s) }
        if let e = a["endTimestamp"] as? Double, e > 0 { timestamps["end"] = Int(e) }
        if !timestamps.isEmpty { out["timestamps"] = timestamps }
        // plakát z addonu (Discord umí https adresy); jinak ikona nahraná u aplikace pod názvem „lumen“
        let image = a["image"] as? String ?? ""
        out["assets"] = [
            "large_image": image.hasPrefix("https://") && image.utf8.count <= 256 ? image : "lumen",
            "large_text": text(details.isEmpty ? "Lumen" : details)
        ]
        return out
    }
}
