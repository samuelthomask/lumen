# Lumen

**Tmavý „skleněný" prohlížeč a přehrávač filmů a seriálů pro Windows s automatickým přepínáním HDR.**
Postaveno z open-source webového rozhraní Stremia a vlastního Windows obalu (WebView2 + mpv).
Bez účtů, bez telemetrie, bez přibaleného obsahu.

🇬🇧 [English version](README.md)

### ⚠️ Důležité upozornění
Toto není návod ke stahování nelegálního obsahu. Lumen je pouze přehrávač a neposkytuje vůbec žádný obsah. Všechny odkazy vedou na služby třetích stran. Používejte výhradně obsah, ke kterému máte autorská práva. Vše děláte čistě na vlastní odpovědnost.

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
- **Vestavěný streamovací server**: přímé odkazy i torrenty fungují hned, bez další aplikace.

## Požadavky

- Windows 10 / 11 (x64) s **WebView2 runtime** (ve Windows 11 už je).
- Nic dalšího instalovat nemusíte: instalátor obsahuje přehrávací knihovnu (libmpv) i lokální streamovací server (Node.js + WebTorrent).
- Displej s podporou HDR, pokud chcete automatické HDR (nepovinné).

## Instalace

1. Stáhněte **`Lumen-Setup.exe`** ze stránky [Releases](../../releases) tohoto repozitáře.
2. Spusťte ho. Soubor není podepsaný, takže Windows SmartScreen může varovat: *Další informace → Přesto spustit*.
3. Spusťte **Lumen** ze zástupce na ploše nebo z nabídky Start.

Odinstalace: *Nastavení → Aplikace* (nebo `Uninstall.exe` v instalační složce). Instalátor se zeptá, jestli smazat i vaše data.

## Jak získat obsah a addony

Lumen slouží jen jako přehrávač, v základu je úplně prázdný – bez obsahu a bez předinstalovaných doplňků (addonů). Filmy a seriály do něj dostanete právě pomocí komunitních addonů, které si musíte sami nainstalovat. Lumen podporuje stejný systém doplňků jako populární aplikace Stremio.

⚠️ **DŮLEŽITÉ VAROVÁNÍ k přehrávání z P2P sítí (torrentů):**
Přehrávání pomocí komunitních addonů fungujících na bázi torrentů se bude téměř jistě sekat, načítat celou věčnost nebo se video vůbec nespustí, protože jste závislí na rychlosti sdílení ostatních uživatelů internetu. Pro plynulé sledování (obzvlášť u 4K videí) a pro bezpečí vaší IP adresy je nutné využívat tzv. **debrid služby**, které filmy stahují bleskově na své rychlé servery a vám je pak plynule streamují.

**Kde najít návod?**
Z důvodu dodržování pravidel GitHubu zde neuvádíme konkrétní názvy ani přímé odkazy na addony. Kompletní komunitní návod, jak aplikaci nastavit a jak propojit debrid služby s příslušnými addony pro plynulé a levné sledování, naleznete zde:

👉 **[Kompletní komunitní návod na nastavení najdete ZDE](VLOŽ_ODKAZ_NA_RENTRY_NEBO_JINAM)**

## Soukromí
Lumen nemá účty a jeho rozhraní neposílá žádné analytické události. Síťové požadavky ale dělá tam, kam to potřebuje: na servery addonů, které nainstalujete, servery s obrázky (plakáty, pozadí, loga) a veřejnou službu s popisy filmů. Vestavěné jádro aplikace může kontaktovat své výchozí katalogové služby. Knihovna, nastavení a adresy addonů jsou uložené lokálně v `%LOCALAPPDATA%\StremioMod`.

## Licence
GPL-2.0 – viz [LICENSE](LICENSE) a [NOTICE.md](NOTICE.md). Projekt nemá nic společného se Stremiem. Lumen neobsahuje žádný obsah; za addony a služby, které používáte, odpovídáte sami.
