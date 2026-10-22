# Lumen

**Tmavý „skleněný" prohlížeč a přehrávač filmů a seriálů pro Windows s automatickým přepínáním HDR.**[cite: 4]
Postaveno z open-source webového rozhraní Stremia a vlastního Windows obalu (WebView2 + mpv).[cite: 4]
Bez účtů, bez telemetrie, bez přibaleného obsahu.[cite: 4]

🇬🇧 [English version](README.md)[cite: 4]

### ⚠️ Důležité upozornění
Toto není návod ke stahování nelegálního obsahu. Lumen je pouze přehrávač a neposkytuje vůbec žádný obsah. Všechny odkazy vedou na služby třetích stran. Používejte výhradně obsah, ke kterému máte autorská práva. Vše děláte čistě na vlastní odpovědnost.

![Domů](docs/screenshots/board.png)[cite: 4]

## Funkce

- **Rozhraní ve stylu Apple TV / iOS 26**: tmavé průsvitné „skleněné" panely, písmo Inter, velký 16:9 banner na domovské stránce.[cite: 4]
- **Domů**: obří doporučený banner (střídá se, bez videí a trailerů) s logem titulu, rokem, délkou, žánry a popisem.[cite: 4]
  Klik na dlaždici ji zobrazí v banneru, druhý klik (nebo *Detail*) ji otevře.[cite: 4]
- **Objevit**: přepínač typu (filmy / seriály / kanály), čipy katalogů a žánrů, široké dlaždice, panel s informacemi o vybrané položce.[cite: 4]
- **Logo titulu na každé dlaždici** (když logo chybí, nápis názvu několika styly písma).[cite: 4]
- **Detail**: velké pozadí s kartou informací, zdroje a epizody v mřížce karet.[cite: 4]
- **Tři velikosti náhledů** (velké / střední / malé) na domovské stránce, v Objevit, Knihovně a vyhledávání; pamatují se.[cite: 4]
- **Lokální knihovna a „pokračovat ve sledování"** bez účtu, vše zůstává u vás v počítači.[cite: 4]
- **Preference zdrojů**: řazení podle jazyka (česky → anglicky) a minimální kvality (4K / Full HD) pro výsledky jakéhokoli addonu.[cite: 4]
- **Addony**: instalace komunitních addonů jedním klikem, přidání jedné adresy, nebo **import více adres najednou**. Nic není předinstalované.[cite: 4]
- **Přehrávač (mpv)**: hardwarové dekódování, synchronizace s displejem, nabídky titulků a zvukových stop, **načtení titulků ze souboru** (.srt/.vtt), skleněná ovládací lišta.[cite: 4]
- **Automatické HDR ve Windows**: při přechodu do fullscreenu s HDR / Dolby Vision videem se zapne HDR na daném displeji a po skončení se vrátí[cite: 4]
  (a obnoví se i po pádu aplikace). Pokud jste měli HDR zapnuté už před tím, zůstane tak.[cite: 4]
- **Česky jako výchozí jazyk**, k dispozici angličtina (rozhraní, nápověda i všechny přidané texty).[cite: 4]
- **Instalátor**: jediný `Lumen-Setup.exe` (instalace pro uživatele, zástupci, odinstalace) obsahuje všechno včetně přehrávací knihovny.[cite: 4]
- **Vestavěný streamovací server**: přímé odkazy i torrenty fungují hned, bez debrid služby a bez dalších aplikací.[cite: 4]

## Požadavky

- Windows 10 / 11 (x64) s **WebView2 runtime** (ve Windows 11 už je).[cite: 4]
- Nic dalšího instalovat nemusíte: instalátor obsahuje přehrávací knihovnu (libmpv) i lokální streamovací server (Node.js + WebTorrent).[cite: 4]
- Displej s podporou HDR, pokud chcete automatické HDR (nepovinné).[cite: 4]

## Instalace

1. Stáhněte **`Lumen-Setup.exe`** ze stránky [Releases](../../releases) tohoto repozitáře.[cite: 4]
2. Spusťte ho. Soubor není podepsaný, takže Windows SmartScreen může varovat: *Další informace → Přesto spustit*.[cite: 4]
3. Spusťte **Lumen** ze zástupce na ploše nebo z nabídky Start.[cite: 4]

Odinstalace: *Nastavení → Aplikace* (nebo `Uninstall.exe` v instalační složce). Instalátor se zeptá, jestli smazat i vaše data.[cite: 4]

## Jak získat obsah (Doporučené cesty)

Lumen slouží jen jako přehrávač, v základu je úplně prázdný – bez obsahu a bez předinstalovaných doplňků (addonů). Filmy a seriály do něj dostanete právě pomocí addonů, které si musíte sami nainstalovat. (Jako alternativu k Lumenu lze využít například aplikaci [Syncler](https://syncler.net/)). 

Stačí si vybrat jednu ze dvou cest a platit si jen jednu službu:

### Cesta A - Nejlevnější varianta (Webshare + Cineshare)
Nepotřebuješ řešit žádný debrid. Najdeš tu většinou české streamy a u většiny filmů a seriálů je k dispozici český dabing.
1. Založ si a předplať účet na [Webshare](https://webshare.cz/).
2. Přejdi na stránku addonu [Cineshare](https://wshare5.streamstr.stream/).
3. V nastavení addonu zadej své přihlašovací údaje z Webshare a vygeneruj si instalační odkaz, který vložíš do Lumenu.

### Cesta B - Největší výběr (Debrid + torrentové addony)
Tady si koupíš jeden "debrid" účet. **Tohle je naprosto zásadní věc, pokud chceš používat addony z této kategorie.**

⚠️ **DŮLEŽITÉ VAROVÁNÍ: Proč se to bez debridu bude sekat?**
Pokud zkusíš používat torrentové addony (jako Torrentio, Comet atd.) jen tak napřímo, **bez zaplaceného debrid účtu (Real-Debrid nebo TorBox), přehrávání se ti bude téměř jistě sekat, bude se to načítat celou věčnost nebo se video vůbec nespustí.** 
Je to dáno tím, jak torrenty fungují – bez debridu jsi odkázaný na to, jak rychle ti film posílají ostatní běžní lidé z internetu, což většinou nestačí. Debrid funguje tak, že film bleskově stáhne na své vlastní extrémně rychlé servery a tobě ho pak plynule streamuje napřímo. Jen díky němu si pustíš obrovské filmy ve 4K kvalitě bez jediného záseku a navíc tvá IP adresa zůstane skrytá.

*   **Krok 1: Výběr debridu**
    Vyber si a předplať si **pouze jednu** z těchto služeb (obě dělají totéž):
    *   [Real-Debrid](https://real-debrid.com/)
    *   [TorBox](https://torbox.app/)

*   **Krok 2: Výběr addonů**
    Jakmile máš debrid zakoupený, můžeš si nainstalovat libovolný z těchto addonů:
    *   [Torrentio](https://torrentio.strem.fun/configure) – Nejpoužívanější a nejstabilnější addon.
    *   [Comet](https://comet.elfhosted.com/) – Velmi rychlý addon optimalizovaný pro debrid služby.
    *   [MediaFusion](https://mediafusion.elfhosted.com/configure) – Univerzální addon s podporou mnoha katalogů a živého vysílání.
    *   [TorrentsDB](https://torrentsdb.com/configure) – Skvělá alternativa s rozsáhlou databází, pokud jiný addon zrovna nefunguje.

*   **Krok 3: Instalace**
    Otevři stránku addonu, nastav jazyk na Češtinu a kvalitu ideálně na 4K. Vlož svůj API klíč z debridu. Zkopíruj vygenerovanou adresu (končí na `manifest.json`), v Lumenu běž do sekce **Addony -> Import**, vlož ji a klikni na **Nainstalovat vše**. Tento odkaz nikam veřejně nesdílej.

## Soukromí
Lumen nemá účty a jeho rozhraní neposílá žádné analytické události. Síťové požadavky ale dělá tam, kam to potřebuje: na servery addonů, které nainstalujete, servery s obrázky (plakáty, pozadí, loga) a veřejnou službu s popisy filmů.[cite: 4] Vestavěné jádro aplikace může kontaktovat své výchozí katalogové služby.[cite: 4] Knihovna, nastavení a adresy addonů jsou uložené lokálně v `%LOCALAPPDATA%\StremioMod`.[cite: 4]

## Licence
GPL-2.0 – viz [LICENSE](LICENSE) a [NOTICE.md](NOTICE.md).[cite: 4] Projekt nemá nic společného se Stremiem.[cite: 4] Lumen neobsahuje žádný obsah; za addony a služby, které používáte, odpovídáte sami.[cite: 4]
