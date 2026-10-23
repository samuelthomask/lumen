# Lumen pro macOS (experimentální)

Nativní obal pro Mac: okno s `WKWebView` (rozhraní) nad videem `mpv`, plus pomocný server (Node + WebTorrent), který také servíruje rozhraní.
Windows verze zůstává hlavní; tahle je **první verze a nebyla ještě zkoušena na skutečném Macu**, proto je tu postup ladění.

## Požadavky (na Macu)

```bash
xcode-select --install          # Swift a nástroje (jednou)
brew install mpv node           # přehrávač a Node.js
brew install dylibbundler       # volitelné: přibalí knihovny mpv do aplikace
```

## Sestavení

Potřebujete sestavené rozhraní. Jednoduché je rozbalit `lumen-web-build.zip` (z vydání), nebo `pnpm build` ve složce `web/`.

```bash
cd macos
WEB_BUILD=/cesta/k/rozbalenemu/web-build bash make-app.sh     # bez WEB_BUILD se hledá ../web/build
open dist/Lumen.app
```

Skript postaví aplikaci, přibalí server a Node, ikonu a vytvoří `dist/Lumen.app` a `dist/Lumen-1.2.0.dmg`.
Aplikace se podepíše **ad-hoc** (zdarma, bez Apple účtu). Při prvním otevření Mac ukáže varování:
pravé tlačítko na aplikaci → **Otevřít** → **Otevřít** (na novějších macOS: *Nastavení → Soukromí a zabezpečení → Přesto otevřít*).

## Když něco nejede

Spusťte z terminálu, uvidíte podrobný log:

```bash
LUMEN_LOG=1 dist/Lumen.app/Contents/MacOS/Lumen
```

Přehrávač má přepínače, protože způsob vykreslení videa na Macu se u mpv liší podle verze:

| Proměnná | Výchozí | Zkuste |
|---|---|---|
| `LUMEN_VO` | `gpu-next` | `gpu` |
| `LUMEN_GPU_API` | `vulkan` | `opengl` |
| `LUMEN_GPU_CONTEXT` | `macvk` | `cocoa` |
| `LUMEN_HWDEC` | `videotoolbox` | `no` |

Například: `LUMEN_VO=gpu LUMEN_GPU_API=opengl LUMEN_GPU_CONTEXT=cocoa LUMEN_LOG=1 dist/Lumen.app/Contents/MacOS/Lumen`
(OpenGL varianta je spolehlivější, ale bez HDR.) Log serveru: `~/Library/Application Support/Lumen/torrent-server.log`.

Když se nic neukáže, pošlete výpis z terminálu.

## Co je a není

- Rozhraní, profily, export/import `.lumen`, torrenty i přímé odkazy fungují stejně jako ve Windows.
- **HDR:** na Macu se nepřepíná ručně. mpv posílá HDR přes EDR, pokud to displej umí (MacBook Pro s XDR, Studio Display apod.).
- Nepodepsaná (ad-hoc) aplikace, bez notarizace.
- Přenos mezi Windows a Macem: profily (`.lumen`) jsou stejný soubor na obou systémech.
