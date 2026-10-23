#!/bin/bash
# Složí hezký instalační .dmg (tmavé pozadí, ikona aplikace a složky Aplikace, šipka) z dist/Lumen.app.
# Volá ho make-app.sh; jde spustit i samostatně: bash make-dmg.sh
set -euo pipefail
cd "$(dirname "$0")"

VERSION="${VERSION:-1.2.10}"
OUT="dist"
APP="$OUT/Lumen.app"
DMG="$OUT/Lumen-$VERSION.dmg"
LOGO="${LOGO:-../web/assets/images/icon_196x196.png}"
FONT_REGULAR="../web/assets/fonts/Inter-Regular.ttf"
FONT_SEMI="../web/assets/fonts/Inter-SemiBold.ttf"
VOL="Lumen"

[ -d "$APP" ] || { echo "Chybí $APP, nejdřív spusťte make-app.sh."; exit 1; }

STAGE="$(mktemp -d)"
RW="$(mktemp -u).dmg"
cleanup() { hdiutil detach "/Volumes/$VOL" -force >/dev/null 2>&1 || true; rm -rf "$STAGE" "$RW"; }
trap cleanup EXIT
hdiutil detach "/Volumes/$VOL" -force >/dev/null 2>&1 || true

echo "==> Pozadí instalátoru"
mkdir -p "$STAGE/.background"
swift dmg-background.swift "$LOGO" "$FONT_REGULAR" "$FONT_SEMI" "$VERSION" "$STAGE/.background/background.png"

cp -R "$APP" "$STAGE/Lumen.app"
ln -s /Applications "$STAGE/Applications"

echo "==> Vytvářím .dmg"
SIZE_MB=$(( $(du -sm "$STAGE" | cut -f1) + 40 ))
hdiutil create -srcfolder "$STAGE" -volname "$VOL" -fs HFS+ -format UDRW -size "${SIZE_MB}m" -ov "$RW" >/dev/null
hdiutil attach "$RW" -noautoopen -mountpoint "/Volumes/$VOL" >/dev/null

# rozložení okna ve Finderu (potřebuje povolení Automatizace pro Finder; bez něj zůstane výchozí vzhled)
if osascript <<APPLESCRIPT >/dev/null 2>&1
tell application "Finder"
  tell disk "$VOL"
    open
    set current view of container window to icon view
    set toolbar visible of container window to false
    set statusbar visible of container window to false
    set the bounds of container window to {200, 120, 860, 548}
    set opts to the icon view options of container window
    set arrangement of opts to not arranged
    set icon size of opts to 112
    set text size of opts to 13
    set background picture of opts to file ".background:background.png"
    set position of item "Lumen.app" of container window to {165, 244}
    set position of item "Applications" of container window to {495, 244}
    close
    open
    update without registering applications
    delay 2
    close
  end tell
end tell
APPLESCRIPT
then
  echo "   rozložení okna nastaveno"
else
  echo "   (Finder nepovolil nastavení okna: DMG bude fungovat, ale bez pozadí a rozložení ikon."
  echo "    Povolte Terminálu/aplikaci v Nastavení → Soukromí a zabezpečení → Automatizace → Finder.)"
fi

sync
hdiutil detach "/Volumes/$VOL" >/dev/null
rm -f "$DMG"
hdiutil convert "$RW" -format UDZO -imagekey zlib-level=9 -o "$DMG" >/dev/null
echo "Hotovo: $DMG"
