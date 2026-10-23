// swift-tools-version:5.7
// Lumen pro macOS. Sestavení: viz README-macos.md (potřebuje Homebrew mpv: brew install mpv).
import PackageDescription

let package = Package(
    name: "Lumen",
    platforms: [.macOS(.v12)],
    targets: [
        .systemLibrary(name: "CMpv", pkgConfig: "mpv", providers: [.brew(["mpv"])]),
        .executableTarget(name: "Lumen", dependencies: ["CMpv"], path: "Sources/Lumen")
    ]
)
