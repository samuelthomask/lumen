# Lumen pro macOS

Nativní obal pro Mac (Apple Silicon, macOS 12+): okno s `WKWebView` (rozhraní) nad videem `mpv`, plus pomocný server (Node + WebTorrent), který také servíruje rozhraní.
Video kreslí mpv přes render API (OpenGL) přímo do okna Lumenu. Instalace pro uživatele: viz hlavní [README](../README.cs.md#-instalace).

## Požadavky (na Macu)

```bash
xcode-select --install                          # Swift a nástroje (jednou)
brew install mpv node pnpm dylibbundler pkgconf # přehrávač, Node.js, sestavení webu, přibalení knihoven
```

## Sestavení

```bash
cd web && pnpm install && LUMEN_EDITION=public pnpm build && cd ..   # rozhraní (nebo rozbalte lumen-web-build.zip)
cd macos
bash make-app.sh        # dist/Lumen.app a instalační dist/Lumen-<verze>.dmg
open dist/Lumen.app
```

`WEB_BUILD=/cesta/k/web-build bash make-app.sh` použije hotové rozhraní odjinud (bez něj se hledá `../web/build`).
Aplikace se podepíše **ad-hoc** (zdarma, bez Apple účtu), proto ji macOS poprvé zablokuje. Hlášku zavřete tlačítkem **Hotovo** a pak v *Nastavení systému → Soukromí a zabezpečení* (dole, část Zabezpečení) klikněte na **Přesto otevřít** (na macOS 12–14 stačí pravé tlačítko → Otevřít).
`.dmg` (tmavé pozadí, šipka do složky Aplikace) vyrábí `make-dmg.sh` s pozadím z `dmg-background.swift`. Okno se ve Finderu nastavuje přes AppleScript;
když to Mac nepovolí (*Soukromí a zabezpečení → Automatizace*), `.dmg` funguje, jen s výchozím vzhledem. `MAKE_DMG=0` vytvoření `.dmg` vynechá.

## Když něco nejede

Spusťte z terminálu, uvidíte podrobný log:

```bash
LUMEN_LOG=1 dist/Lumen.app/Contents/MacOS/Lumen
```

| Proměnná | Význam |
|---|---|
| `LUMEN_LOG=1` | podrobný log (včetně zpráv mpv) do terminálu |
| `LUMEN_HWDEC` | hardwarové dekódování, výchozí `videotoolbox` (zkuste `no`) |
| `LUMEN_TEST_FILE` | soubor nebo adresa, která se přehraje hned po startu (ladění přehrávače) |
| `LUMEN_WEB_DIR` | složka s rozhraním místo přibaleného |

Log serveru: `~/Library/Application Support/Lumen/torrent-server.log`.

## Co je a není

- Rozhraní, profily, export/import `.lumen`, účet se synchronizací, torrenty i přímé odkazy fungují stejně jako ve Windows.
- **HDR:** na Macu zatím není, HDR videa se přehrají v SDR. Zkoušená cesta přes OpenGL render API nefungovala (tmavé rozhraní); správné řešení vyžaduje Metal.
- Nepodepsaná (ad-hoc) aplikace, bez notarizace; jen Apple Silicon (arm64).
- Přenos mezi Windows a Macem: profily (`.lumen`) jsou stejný soubor na obou systémech.
