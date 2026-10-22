# Lumen

**Tmavý „skleněný" prohlížeč a přehrávač filmů a seriálů pro Windows s automatickým přepínáním HDR.**
Postaveno z open-source webového rozhraní Stremia a vlastního Windows obalu (WebView2 + mpv).
Bez účtů, bez telemetrie, bez přibaleného obsahu.

🇬🇧 [English version](README.md)

![Domů](docs/screenshots/board.png)

## Funkce

- **Rozhraní ve stylu Apple TV / iOS 26**: tmavé průsvitné „skleněné" panely, písmo Inter, velký 16:9 banner na domovské stránce.
- **Domů**: obří doporučený banner (střídá se, bez videí a trailerů) s logem titulu, rokem, délkou, žánry a popisem.
  Klik na dlaždici ji zobrazí v banneru, druhý klik (nebo *Detail*) ji otevře.
- **Objevit**: přepínač typu (filmy / seriály / kanály), čipy katalogů a žánrů, široké dlaždice, panel s informacemi o vybrané položce.
- **Logo titulu na každé dlaždici** (když logo chybí, nápis názvu několika styly písma).
- **Detail**: velké pozadí s kartou informací, zdroje a epizody v mřížce karet.
- **Tři velikosti náhledů** (velké / střední / malé) na domovské stránce, v Objevit, Knihovně a vyhledávání; pamatují se.
- **Lokální knihovna a „pokračovat ve sledování"** bez účtu, vše zůstává u vás v počítači.
- **Preference zdrojů**: řazení podle jazyka (česky → anglicky) a minimální kvality (4K / Full HD) pro výsledky jakéhokoli addonu.
- **Addony**: instalace komunitních addonů jedním klikem, přidání jedné adresy, nebo **import více adres najednou**. Nic není předinstalované.
- **Přehrávač (mpv)**: hardwarové dekódování, synchronizace s displejem, nabídky titulků a zvukových stop, **načtení titulků ze souboru** (.srt/.vtt), skleněná ovládací lišta.
- **Automatické HDR ve Windows**: při přechodu do fullscreenu s HDR / Dolby Vision videem se zapne HDR na daném displeji a po skončení se vrátí
  (a obnoví se i po pádu aplikace). Pokud jste měli HDR zapnuté už před tím, zůstane tak.
- **Česky jako výchozí jazyk**, k dispozici angličtina (rozhraní, nápověda i všechny přidané texty).
- **Instalátor**: jediný `Lumen-Setup.exe` (instalace pro uživatele, zástupci, odinstalace) obsahuje všechno včetně přehrávací knihovny.
- **Vestavěný streamovací server**: přímé odkazy i torrenty fungují hned, bez debrid služby a bez dalších aplikací.

## Screenshoty

| Objevit | Detail |
|---|---|
| ![Objevit](docs/screenshots/discover.png) | ![Detail](docs/screenshots/detail.png) |
| **Malé náhledy** | **Knihovna** |
| ![Malé náhledy](docs/screenshots/board-small.png) | ![Knihovna](docs/screenshots/library.png) |
| **Addony** | **Nápověda** |
| ![Addony](docs/screenshots/addons.png) | ![Nápověda](docs/screenshots/help.png) |

## Požadavky

- Windows 10 / 11 (x64) s **WebView2 runtime** (ve Windows 11 už je).
- Nic dalšího instalovat nemusíte: instalátor obsahuje přehrávací knihovnu (libmpv) i lokální streamovací server (Node.js + WebTorrent).
- Displej s podporou HDR, pokud chcete automatické HDR (nepovinné).

## Instalace

1. Stáhněte **`Lumen-Setup.exe`** ze stránky [Releases](../../releases) tohoto repozitáře.
2. Spusťte ho. Soubor není podepsaný, takže Windows SmartScreen může varovat: *Další informace → Přesto spustit*.
3. Spusťte **Lumen** ze zástupce na ploše nebo z nabídky Start.

### Streamování a torrenty

Lumen má vlastní lokální server (přibalený Node.js a open-source knihovna [WebTorrent](https://github.com/webtorrent/webtorrent), licence MIT):

- **Přímé odkazy** (například ty, které addon získá přes debrid službu) se přehrávají přímo.
- **Torrentové zdroje** Lumen streamuje sám za běhu stahování, **debrid služba není potřeba**. Přehrávání začne, až dorazí dost začátku souboru,
  takže rychlost závisí na počtu zdrojů (peerů). Stažená data jsou dočasná a smažou se při zavření Lumenu (nebo při otevření jiného torrentu).
  Pozor: torrentový klient během stahování data sdílí s ostatními; běžnou ochranou je VPN. Za to, co streamujete, odpovídáte sami.
- Je-li v počítači nainstalované desktopové Stremio, Lumen místo toho použije jeho streamovací server.

> **Upozornění – torrenty mohou být pomalé.** Streamování torrentů je experimentální. Přehrávání závisí jen na tom, kolik lidí soubor sdílí:
> velké 4K soubory, vzácná vydání nebo slabě sdílené torrenty se mohou rozjíždět pomalu, sekat, nebo se nespustit vůbec.
> Pro plynulé přehrávání používejte zdroje s **přímým odkazem**, tedy addony, které pracují s placenou debrid službou nebo s placeným účtem u služby na ukládání souborů
> (viz [docs/ADDONS.md](docs/ADDONS.md)). Bez nich počítejte s načítáním.

Odinstalace: *Nastavení → Aplikace* (nebo `Uninstall.exe` v instalační složce). Instalátor se zeptá, jestli smazat i vaše data.

## Jak Lumen používat

- Záložka **Doplňky** → nainstalujte komunitní addon, nebo **Import** víc adres addonů (každá na nový řádek).
  Podrobně: [docs/ADDONS.md](docs/ADDONS.md).
- Otevřete film → nad seznamem zdrojů nastavíte pořadí jazyků a minimální kvalitu.
- Vpravo nahoře na stránkách Domů / Objevit / Knihovna přepínají tři ikony velikost náhledů.
- V přehrávači: tlačítko titulků → *Načíst titulky ze souboru*. Tlačítko zvukových stop se aktivuje, když má soubor víc stop.

## Soukromí

Lumen nemá účty a jeho rozhraní neposílá žádné analytické události. Síťové požadavky ale dělá tam, kam to potřebuje:
na servery addonů, které nainstalujete, servery s obrázky (plakáty, pozadí, loga) a veřejnou službu s popisy filmů.
Vestavěné jádro aplikace může kontaktovat své výchozí katalogové služby. Knihovna, nastavení a adresy addonů jsou uložené lokálně
v `%LOCALAPPDATA%\StremioMod` (profil WebView2). Adresy addonů mohou obsahovat osobní klíče; nejsou šifrované.

## Sestavení ze zdrojů

Viz [docs/BUILD.md](docs/BUILD.md). Stručně: `pnpm build` ve složce `web/`, sestavit obal, pak `installer\build-installer.bat`.

## Struktura projektu

```
web/        upravený stremio-web (React) – uživatelské rozhraní            (GPL-2.0)
shell/      Windows obal: WebView2 + libmpv, přepínání HDR, lokální server (GPL-2.0+)
installer/  samostatný setup.exe                                           (GPL-2.0+)
docs/       dokumentace a screenshoty
```

Jak rozhraní komunikuje s obalem: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Licence

GPL-2.0 – viz [LICENSE](LICENSE) a [NOTICE.md](NOTICE.md). Projekt nemá nic společného se Stremiem. Lumen neobsahuje žádný obsah;
za addony a služby, které používáte, odpovídáte sami.
