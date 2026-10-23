// Vygeneruje pozadí okna instalačního DMG (660x400 bodů, Retina 1320x800).
// Použití: swift dmg-background.swift <logo.png> <písmo-regular.ttf> <písmo-semibold.ttf> <verze> <výstup.png>
import AppKit

let args = CommandLine.arguments
guard args.count == 6 else { print("Použití: dmg-background.swift logo.png regular.ttf semibold.ttf verze out.png"); exit(1) }
let logoPath = args[1], regularPath = args[2], semiPath = args[3], version = args[4], outPath = args[5]

for p in [regularPath, semiPath] { CTFontManagerRegisterFontsForURL(URL(fileURLWithPath: p) as CFURL, .process, nil) }
func font(_ name: String, _ size: CGFloat) -> NSFont { NSFont(name: name, size: size) ?? .systemFont(ofSize: size) }
let regular = "Inter-Regular", semi = "Inter-SemiBold"

let pt = NSSize(width: 660, height: 400)
let scale: CGFloat = 2
let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: Int(pt.width * scale), pixelsHigh: Int(pt.height * scale),
                           bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
                           colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
rep.size = pt   // 144 dpi: Finder zobrazí obrázek v bodech

NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
let ctx = NSGraphicsContext.current!.cgContext

func color(_ hex: UInt32, _ a: CGFloat = 1) -> NSColor {
    NSColor(red: CGFloat((hex >> 16) & 255) / 255, green: CGFloat((hex >> 8) & 255) / 255, blue: CGFloat(hex & 255) / 255, alpha: a)
}

// pozadí: tmavý přechod
NSGradient(colors: [color(0x07070c), color(0x12101c)])!.draw(in: NSRect(origin: .zero, size: pt), angle: -90)

// měkké záře (modrá a fialová jako v rozhraní)
func glow(_ center: CGPoint, _ radius: CGFloat, _ c: NSColor) {
    NSGradient(colors: [c, c.withAlphaComponent(0)])!.draw(fromCenter: center, radius: 0, toCenter: center, radius: radius, options: [])
}
glow(CGPoint(x: 120, y: 60), 300, color(0x0a84ff, 0.30))
glow(CGPoint(x: 560, y: 360), 280, color(0xbf5af2, 0.26))

// skleněný panel pod ikonami
let panel = NSBezierPath(roundedRect: NSRect(x: 40, y: 56, width: 580, height: 200), xRadius: 26, yRadius: 26)
color(0xffffff, 0.06).setFill(); panel.fill()
color(0xffffff, 0.14).setStroke(); panel.lineWidth = 1; panel.stroke()

func draw(_ text: String, _ f: NSFont, _ c: NSColor, center x: CGFloat, y: CGFloat) {
    let attrs: [NSAttributedString.Key: Any] = [.font: f, .foregroundColor: c]
    let size = text.size(withAttributes: attrs)
    text.draw(at: NSPoint(x: x - size.width / 2, y: y), withAttributes: attrs)
}

// logo + název
if let logo = NSImage(contentsOfFile: logoPath) {
    logo.draw(in: NSRect(x: 330 - 26 - 62, y: 322, width: 52, height: 52))
}
draw("Lumen", font(semi, 34), .white, center: 330 + 24, y: 328)
draw("macOS · \(version)", font(regular, 13), color(0xffffff, 0.55), center: 330, y: 296)

// šipka mezi aplikací (vlevo) a složkou Aplikace (vpravo)
let arrowY: CGFloat = 156
ctx.setStrokeColor(color(0xffffff, 0.75).cgColor)
ctx.setLineWidth(3); ctx.setLineCap(.round); ctx.setLineJoin(.round)
ctx.move(to: CGPoint(x: 268, y: arrowY)); ctx.addLine(to: CGPoint(x: 392, y: arrowY))
ctx.move(to: CGPoint(x: 374, y: arrowY + 16)); ctx.addLine(to: CGPoint(x: 394, y: arrowY)); ctx.addLine(to: CGPoint(x: 374, y: arrowY - 16))
ctx.strokePath()

// pokyn dole
draw("Přetáhněte Lumen do složky Aplikace", font(semi, 15), .white, center: 330, y: 28)
draw("Drag Lumen to the Applications folder", font(regular, 12), color(0xffffff, 0.55), center: 330, y: 10)

NSGraphicsContext.restoreGraphicsState()
try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: outPath))
print("Pozadí: \(outPath)")
