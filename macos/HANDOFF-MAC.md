# Lumen: předávací příručka pro práci na Macu (a pak Android TV)

Stav k 2026-10-23, verze **1.2.1**. Windows verze je hotová a vydaná. macOS verze je napsaná, ale **ještě nikdy nebyla
zkompilována ani spuštěna**. Android TV je jen plán.

## 1. Jak dostat kód na Mac

Nejjednodušší cesta je veřejný repozitář (obsahuje web, macOS obal, server i dokumentaci):

```bash
git clone https://github.com/samuelthomask/Lumen.git
cd Lumen
```

Rozhraní (`web/`) je nutné sestavit, nebo si stáhnout hotové z `lumen-web-build.zip` (viz níže).

Alternativa bez gitu: `lumen-macos-src.zip` (složka `dist` na Windows). Obsahuje `macos/`, `torrent-server/` a už **sestavené
rozhraní** v `web/build`, takže stačí rozbalit a spustit `make-app.sh`.

## 2. Požadavky na Macu

```bash
xcode-select --install
brew install mpv node pnpm dylibbundler
```

## 3. Sestavení a první spuštění

Rozhraní (jen když nepoužíváte zip):

```bash
cd web
pnpm install
LUMEN_EDITION=public LUMEN_REPO_URL=https://github.com/samuelthomask/Lumen pnpm build
cd ..
```

Aplikace:

```bash
cd macos
bash make-app.sh            # vytvoří dist/Lumen.app a dist/Lumen-1.2.3.dmg
LUMEN_LOG=1 dist/Lumen.app/Contents/MacOS/Lumen
```

Když se okno neukáže nebo je černé video, ladicí přepínače jsou v [README-macos.md](README-macos.md) (`LUMEN_VO`,
`LUMEN_GPU_API`, `LUMEN_GPU_CONTEXT`, `LUMEN_HWDEC`). Pošlete výpis z terminálu Claudovi.

## 4. Co na Macu vyzkoušet (nic z toho není ověřené)

1. Otevře se okno s rozhraním a vybere se profil.
2. Přehraje se přímý odkaz (video pod rozhraním, skleněná lišta nad ním, mezerník = pauza).
3. Titulky ze souboru, přepínání zvukových stop.
4. Torrent bez debridu (server z `Resources/torrent`).
5. HDR video na displeji, který to umí (EDR), nic se nepřepíná ručně.
6. **Účet (nově v 1.2):** Nastavení → Účet → registrace kódem z e-mailu, přihlášení, synchronizace. Rozhraní se na Macu
   načítá z `http://127.0.0.1:11470`, to je zabezpečený kontext, takže šifrování (`crypto.subtle`) má fungovat. Neověřeno.
7. Export a import `.lumen` mezi Windows a Macem.

## 5. Jak pracovat s Claudem na Macu

Nainstalujte Claude Code a spusťte ho ve složce naklonovaného repozitáře. Ve veřejném repu **není** vývojový `CLAUDE.md`,
proto mu na začátku řekněte, co je potřeba. Můžete vložit:

> Pracuji na projektu Lumen (přehrávač pro Windows, experimentální verze pro macOS ve složce `macos/`). Nejdřív přečti
> `macos/HANDOFF-MAC.md` a `macos/README-macos.md`. Nikdy nepřidávej Co-Authored-By do commitů, nepushuj bez výslovné
> žádosti a nedávej do veřejných souborů názvy torrent/debrid addonů ani adresy s klíči. Mluv česky, jednoduše, jsem laik.
> Chci: [co chcete na Macu udělat].

Poznámky k zásadám:
- Commity do veřejného repa pod autorem `sam <123931695+sam05th@users.noreply.github.com>` bez řádku Co-Authored-By.
- Git: `core.autocrlf false`.
- Účty používají Supabase. Veřejný (publishable) klíč je v `web/webpack.config.js` záměrně. **Nikdy** do repa ani do chatu
  nedávejte tajný (service_role) klíč, heslo k databázi ani SMTP klíč z Brevo.

## 6. Android TV (plán, nic ještě nevzniklo)

Windows aplikace na televizi nepoběží. APK pro Android TV je nejrealističtější cesta (LG webOS APK nepustí; pro majitele LG
je řešení Chromecast s Google TV). Navržený postup:

1. **Android Studio** na Macu (nainstalujete sami, je to asi 1–2 GB) a emulátor Android TV.
2. Aplikace v Kotlinu s `WebView`, která načte stejné rozhraní (`web/build`) z paketu aplikace.
3. **Přehrávání:** WebView samo mpv nezná, takže buď přibalit `libmpv` pro Android (mpv-android), nebo použít ExoPlayer (Media3)
   a rozhraní s ním propojit stejným způsobem jako Windows/macOS obal (protokol UI↔obal je popsaný v `NOTES.md` ve vývojovém
   repu a ve zdrojích `main.swift` / `main.cpp`).
4. **Ovládání dálkovým ovladačem (D-pad):** rozhraní je dnes pro myš. Bude potřeba zvýraznění fokusu a šipky, to je největší
   kus práce.
5. **Torrentový server:** Node na Androidu nejede, v první verzi tedy jen přímé odkazy (debrid).
6. Instalace na televizi: APK se nahraje přes aplikaci **Downloader** (adresa souboru z GitHub Releases) nebo přes `adb install`.
7. Účty fungují stejně (stejné webové rozhraní, stejná databáze), jen se tam hůř píše heslo dálkovým ovladačem. Dobrý nápad
   do budoucna: přihlášení přes QR kód z telefonu.

Toto je plán, ne ověřený postup.

## 7. Nevyřešené věci mimo Mac

- E-maily s kódem chodí z Gmailu přes Brevo a **Yahoo (a možná další) je nedoručí**. Trvalá oprava je vlastní doména ověřená
  v Brevo (SPF/DKIM), viz poznámky v `cloud/SUPABASE-SETUP.md` ve vývojovém repu.
- Synchronizace na dvou zařízeních zároveň je neověřená.
- Instalátor 1.2.1 nebyl zkoušen na čistém počítači.
