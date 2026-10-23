#!/bin/bash
# Sestaví Lumen.app (a volitelně .dmg) na macOS. Postup a požadavky: README-macos.md
set -euo pipefail
cd "$(dirname "$0")"

WEB_BUILD="${WEB_BUILD:-../web/build}"              # sestavené rozhraní (pnpm build), nebo rozbalený lumen-web-build.zip
TORRENT_DIR="${TORRENT_DIR:-../torrent-server}"     # server.js + package.json
ICON_PNG="${ICON_PNG:-../web/assets/images/icon_512x512.png}"
VERSION="${VERSION:-1.2.8}"
OUT="dist"
APP="$OUT/Lumen.app"

[ -f "$WEB_BUILD/index.html" ] || { echo "Chybí $WEB_BUILD/index.html (nastavte WEB_BUILD)."; exit 1; }
[ -f "$TORRENT_DIR/server.js" ] || { echo "Chybí $TORRENT_DIR/server.js (nastavte TORRENT_DIR)."; exit 1; }
command -v swift >/dev/null || { echo "Chybí Swift. Nainstalujte: xcode-select --install"; exit 1; }
command -v node >/dev/null || { echo "Chybí Node.js. Nainstalujte: brew install node"; exit 1; }

echo "==> Sestavuji aplikaci (swift build)"
swift build -c release
BIN="$(swift build -c release --show-bin-path)/Lumen"

echo "==> Skládám $APP"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources/torrent" "$APP/Contents/Frameworks"
cp "$BIN" "$APP/Contents/MacOS/Lumen"
cp -R "$WEB_BUILD" "$APP/Contents/Resources/web"

echo "==> Torrentový server (Node + WebTorrent)"
if [ ! -d "$TORRENT_DIR/node_modules" ]; then (cd "$TORRENT_DIR" && npm ci); fi
cp "$TORRENT_DIR/server.js" "$TORRENT_DIR/package.json" "$APP/Contents/Resources/torrent/"
cp -R "$TORRENT_DIR/node_modules" "$APP/Contents/Resources/torrent/node_modules"
cp "$(command -v node)" "$APP/Contents/Resources/torrent/node"
[ -f "$TORRENT_DIR/NODE-LICENSE.txt" ] && cp "$TORRENT_DIR/NODE-LICENSE.txt" "$APP/Contents/Resources/"

if [ -f "$ICON_PNG" ]; then
  echo "==> Ikona"
  ICONSET="$OUT/Lumen.iconset"; rm -rf "$ICONSET"; mkdir -p "$ICONSET"
  for s in 16 32 128 256 512; do
    sips -z $s $s "$ICON_PNG" --out "$ICONSET/icon_${s}x${s}.png" >/dev/null
    sips -z $((s*2)) $((s*2)) "$ICON_PNG" --out "$ICONSET/icon_${s}x${s}@2x.png" >/dev/null
  done
  iconutil -c icns "$ICONSET" -o "$APP/Contents/Resources/Lumen.icns"
  rm -rf "$ICONSET"
fi

cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleName</key><string>Lumen</string>
  <key>CFBundleDisplayName</key><string>Lumen</string>
  <key>CFBundleIdentifier</key><string>io.github.samuelthomask.lumen</string>
  <key>CFBundleExecutable</key><string>Lumen</string>
  <key>CFBundleIconFile</key><string>Lumen</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>$VERSION</string>
  <key>CFBundleVersion</key><string>$VERSION</string>
  <key>LSMinimumSystemVersion</key><string>12.0</string>
  <key>NSHighResolutionCapable</key><true/>
  <key>NSHumanReadableCopyright</key><string>Samuel Thomas Konečný (samuelthomask). GPL-2.0-or-later</string>
  <key>NSAppTransportSecurity</key><dict><key>NSAllowsLocalNetworking</key><true/></dict>
</dict></plist>
PLIST

echo "==> Přibaluji knihovny mpv"
if command -v dylibbundler >/dev/null; then
  dylibbundler -od -b -x "$APP/Contents/MacOS/Lumen" -d "$APP/Contents/Frameworks" -p @executable_path/../Frameworks >/dev/null
  # dylibbundler přidá rpath podruhé a novější dyld duplicitu odmítne
  for bin in "$APP/Contents/MacOS/Lumen" "$APP"/Contents/Frameworks/*.dylib; do
    if [ "$(otool -l "$bin" | grep -c 'path @executable_path/../Frameworks/ ')" -gt 1 ]; then
      install_name_tool -delete_rpath @executable_path/../Frameworks/ "$bin" 2>/dev/null
    fi
  done
  # Node z Homebrew je tenký spouštěč nad libnode a dalšími knihovnami: přibalit i je
  NODE_DIR="$APP/Contents/Resources/torrent"
  chmod u+w "$NODE_DIR/node"
  dylibbundler -od -of -b -x "$NODE_DIR/node" -d "$NODE_DIR/libs" -p @executable_path/libs -s "$(brew --prefix node 2>/dev/null)/lib" >/dev/null 2>&1
  for bin in "$NODE_DIR/node" "$NODE_DIR"/libs/*.dylib; do
    for rp in $(otool -l "$bin" | grep -A2 LC_RPATH | awk '/path /{print $2}' | sort | uniq -d); do
      install_name_tool -delete_rpath "$rp" "$bin" 2>/dev/null
    done
    codesign --force -s - "$bin" 2>/dev/null
  done
else
  echo "   (dylibbundler není nainstalován: aplikace poběží jen na tomto Macu, kde je mpv z Homebrew."
  echo "    Pro přenosnou aplikaci: brew install dylibbundler a spusťte skript znovu.)"
fi

echo "==> Podepisuji (ad-hoc, bez Apple účtu)"
codesign --force --deep -s - "$APP"

if [ "${MAKE_DMG:-1}" = "1" ]; then
  VERSION="$VERSION" bash make-dmg.sh
fi

echo
echo "Hotovo: $APP"
echo "Spustit: open $APP   (při chybě zkuste: $APP/Contents/MacOS/Lumen s LUMEN_LOG=1)"
