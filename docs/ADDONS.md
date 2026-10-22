# Addons / Addony

Lumen contains **no content and no preinstalled addons**. Movies and series come from addons that you choose and install yourself.
Lumen neobsahuje žádný obsah ani předinstalované addony; filmy a seriály dodávají addony, které si sami zvolíte a nainstalujete.

## Notice / Upozornění

Lumen provides no content and does not itself recommend sources. This is not a guide for downloading illegal content. Use only content you have the right to watch. All links lead to third-party services. You are responsible for third-party addons and services and for obeying the laws of your country. Do everything purely at your own risk.
Toto není návod ke stahování nelegálního obsahu. Lumen neposkytuje obsah a sám nedoporučuje zdroje. Všechny odkazy vedou na služby třetích stran. Používejte jen obsah, ke kterému máte právo. Za addony a služby třetích stran odpovídáte sami. Vše děláte čistě na vlastní odpovědnost.

## What is an addon? / Co je addon

An addon is a small service on the internet that tells the app which catalogs and sources it offers.
It is described by a *manifest* – a JSON file at an address ending with `manifest.json`.
The format is documented in the [addon SDK](https://github.com/Stremio/stremio-addon-sdk) and is used by several apps.

## Installing / Instalace

1. **Community catalog** – tab **Addons** (*Doplňky*) → choose an addon → *Install*.
2. **One address** – *Addons → Add addon* → paste the address.
3. **Many addresses** – *Addons → Import* → paste the addresses, one per line → *Install all*.
   Addresses that cannot be loaded are reported by their line number only (the address itself is never shown or logged).

An addon address can contain **personal keys** (for example a service token). Do not share it, do not paste it into issues or public chats.
Lumen stores installed addons in the local profile (`%LOCALAPPDATA%\StremioMod`), unencrypted.

## Choosing the best source / Výběr zdroje

Above the list of sources on a movie page you can set:

- **Language**: *Czech, then English* (default) / *English* / *Any language* – sources whose title or description mention the language are listed first.
- **Quality**: *4K only* / *Full HD +* (default) / *Any quality* – lower quality is hidden (unknown quality is always kept; if the filter would hide everything, nothing is hidden).

The recognition works on text only (names such as "CZ dabing", "2160p", "1080p", flags) and can be wrong for some addons.

## Recommended setups (Paths A and B) / Doporučené cesty (A a B)

You only need to choose one path and pay for one service. / Stačí si vybrat jednu cestu a platit si jen jednu službu. (As an alternative to Lumen, you can also use [Syncler](https://syncler.net/)).

### Path A - The cheapest (Webshare + Cineshare) / Cesta A - Nejlevnější varianta (Webshare + Cineshare)
You don't need a debrid service. Mostly Czech streams and dubbing. / Nepotřebuješ řešit žádný debrid. Najdeš tu většinou české streamy a u většiny filmů a seriálů je k dispozici český dabing.
1. Create and subscribe to an account on [Webshare](https://webshare.cz/).
2. Go to the [Cineshare](https://wshare5.streamstr.stream/) addon page.
3. Enter your Webshare login details to generate the installation link for Lumen.

### Path B - Biggest selection (Debrid + other addons) / Cesta B - Největší výběr (Debrid + ostatní addony)
You need to buy one "debrid" account. **This is absolutely essential for these addons.** / Tady si koupíš jeden "debrid" účet. **Tohle je naprosto zásadní věc, pokud chceš používat addony z této kategorie.**

⚠️ **IMPORTANT WARNING: Why will it stutter without debrid? / DŮLEŽITÉ VAROVÁNÍ: Proč se to bez debridu bude sekat?**
If you try to use torrent addons (like Torrentio, Comet, MediaFusion etc.) directly, **without a paid debrid account (Real-Debrid or TorBox), playback will almost certainly stutter, take forever to load, or not start at all.** 
This is how torrents work – without debrid, you rely on how fast other people send you the file. Debrid (e.g. Real-Debrid) downloads the file instantly to its own extremely fast servers and streams it smoothly directly to you. Only thanks to this can you watch huge 4K movies without a single stutter, and your IP address remains safe.

Pokud zkusíš používat torrentové addony (jako Torrentio, Comet, MediaFusion atd.) jen tak napřímo, **bez zaplaceného debrid účtu (Real-Debrid nebo TorBox), přehrávání se ti bude téměř jistě sekat, bude se to načítat celou věčnost nebo se video vůbec nespustí.** 
Je to dáno tím, jak torrenty fungují – bez debridu jsi odkázaný na to, jak rychle ti film posílají ostatní běžní lidé z internetu. Většinou to nestačí na plynulé přehrávání. Debrid (např. Real-Debrid) funguje tak, že ten film bleskově stáhne místo tebe na své vlastní extrémně rychlé servery a tobě ho pak plynule streamuje napřímo. Jen díky němu si pustíš i obrovské filmy ve 4K kvalitě bez jediného záseku, a navíc tvoje IP adresa zůstane v bezpečí.

#### 1. Choose a Debrid service / Výběr debridu
Choose and subscribe to **only one** (they do the same thing) / Vyber si a předplať si **pouze jednu** z těchto služeb:
*   [Real-Debrid](https://real-debrid.com/)
*   [TorBox](https://torbox.app/)

#### 2. Choose addons / Výběr addonů
Once you have debrid, install any of these (click for setup page) / Jakmile máš debrid zakoupený, můžeš si nainstalovat libovolný z těchto addonů (můžeš jich mít i více):
*   [Torrentio](https://torrentio.strem.fun/configure) – The most used and stable. / Nejpoužívanější a nejstabilnější addon.
*   [Comet](https://comet.elfhosted.com/) – Very fast, optimized for debrid. / Velmi rychlý addon optimalizovaný pro debrid služby.
*   [MediaFusion](https://mediafusion.elfhosted.com/configure) – Universal, supports live TV. / Univerzální addon s podporou mnoha katalogů a živého vysílání.
*   [TorrentsDB](https://torrentsdb.com/configure) – Great alternative with a large database. / Skvělá alternativa s rozsáhlou databází, pokud jiný addon zrovna nefunguje.

#### 3. Setup guide / Návod na zprovoznění
1. Open the addon configuration page (links above). / Otevři si konfigurační stránku vybraného addonu.
2. Set preferred language to **Czech** and quality to **4K** or at least **Full HD**. / V nabídce si nastav preferovaný jazyk na **Češtinu** a kvalitu videa ideálně na **4K** nebo minimálně na **Full HD**.
3. Find the Debrid section, select yours, and paste your personal API key from your debrid account settings. / V nastavení addonu najdi kolonku pro tvůj debrid (Real-Debrid nebo TorBox) a vlož tam svůj osobní API klíč.
4. Click install/generate. Copy the special addon address ending in `manifest.json`. **Do not share it publicly.** / Klikni na tlačítko pro instalaci/vygenerování. Stránka ti vygeneruje speciální adresu addonu (končí na `manifest.json`). Tuto adresu si **zkopíruj**. Nikam ji veřejně nesdílej.
5. In Lumen, go to **Addons -> Import**, paste the address and click **Install all**. / Otevři si aplikaci Lumen, běž do sekce **Addony**, klikni na **Import**, vlož tam zkopírovanou adresu s `manifest.json` a nakonec dej **Nainstalovat vše**.
