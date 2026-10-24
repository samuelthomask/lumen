# Lumen pro Android TV

Aplikace pro Android TV / Google TV (Chromecast s Google TV, NVIDIA Shield, televize Sony, TCL, Philips s Androidem…).
**Nefunguje** na televizích LG (webOS) ani Samsung (Tizen) – ty Android nemají.

## Co umí a co ne (verze 1)
- Rozhraní Lumenu ovládané dálkovým ovladačem: šipky = pohyb, OK = potvrdit, Zpět = zavřít nabídku / krok zpět,
  na domovské obrazovce dvakrát Zpět = ukončit.
- Přehrávání přes vestavěný přehrávač Androidu (Media3/ExoPlayer): titulky, výběr zvuku a titulků, HDR podle televize.
  Zvuk, který televize sama neumí (DTS, TrueHD…), dekóduje přibalený FFmpeg (knihovna Jellyfin `media3-ffmpeg-decoder`, GPL).
  V přehrávači: OK = pauza, vlevo/vpravo = přetáčení, nahoru/dolů = ovládací lišta. Tlačítka přehrávání na ovladači fungují taky.
- **Torrenty nefungují** – v Androidu zatím není torrentový server. Hrají jen zdroje s přímým odkazem (HTTP), typicky přes debrid službu.
- Lokální soubory a export souboru `.lumen` v1 neumí; data mezi zařízeními přenese účet Lumen (Nastavení → Účet).

## Instalace (bez Obchodu Play)
Nejjednodušší je aplikace **Downloader** (od AFTVnews), která je zdarma v Obchodě Play na televizi:
1. Na televizi: Nastavení → Systém → Informace → 7× kliknout na **Sestavení OS** (zapnou se Možnosti pro vývojáře).
2. Nastavení → Aplikace → Zabezpečení a omezení → **Neznámé zdroje** → povolit pro Downloader.
3. V Downloaderu zadat odkaz na `Lumen-AndroidTV.apk` (z GitHub Releases) → stáhnout → Instalovat.

Jiné možnosti:
- **USB flash disk**: nahrát APK na disk, na televizi otevřít správcem souborů (např. „File Commander“) a nainstalovat.
- **adb z počítače** (televize a PC ve stejné síti): v Možnostech pro vývojáře zapnout Ladění USB / Ladění přes síť, pak
  `adb connect IP_TELEVIZE` a `adb install -r Lumen-AndroidTV.apk`.

Po instalaci je Lumen v řadě aplikací na domovské obrazovce (s bannerem).

## Sestavení (pro vývojáře)
- Potřeba: JDK 21, Android SDK (platform 35, build-tools 35), Gradle 8.14 – na tomto PC v `E:\tools`.
- Web: ve `stremio-web` `pnpm build` (`LUMEN_EDITION=public` pro veřejnou verzi). APK si vezme `stremio-web\build`.
- `android\build-apk.ps1` → `dist\Lumen-AndroidTV.apk`. Verze se bere z `stremio-web\src\common\lumenVersion.js`.
- Podpis: bez `android\keystore.properties` se podepíše ladicím klíčem. Pro vydání vytvořit vlastní klíč mimo repozitář a
  do `keystore.properties` napsat `storeFile`, `storePassword`, `keyAlias`, `keyPassword`. Aktualizace musí být podepsané **stejným** klíčem.
- Ikony a banner: `android\make-icons.ps1` (z `stremio-web\assets\images`).

## Jak to funguje
- `MainActivity.kt`: WebView s webem z assets (`https://appassets.androidplatform.net/`), pod ním `PlayerView` (video).
  Do `index.html` se vloží skript, který vytvoří stejné rozhraní `window.chrome.webview` jako obal pro Windows.
- `LumenPlayer.kt`: napodobuje příkazy a vlastnosti mpv (`loadfile`, `pause`, `time-pos`, `aid`/`sid`, `track-list`…) nad ExoPlayerem.
- Web: `src\common\tvNavigation.js` (ovládání šipkami, `window.__lumenBack`), zapne se jen při `window.__lumenTV`.
  V prohlížeči se dá zkoušet přes `localStorage.setItem('lumen.tv','1')`.
