<div align="center">

<img src="web/assets/images/icon_196x196.png" width="110" alt="Logo Lumenu">

# Lumen

**Tmavý „skleněný" prohlížeč a přehrávač filmů a seriálů pro Windows** 🎬✨
s automatickým HDR, profily a volitelnou synchronizací šifrovanou od konce ke konci.

[![Stáhnout](https://img.shields.io/github/v/release/samuelthomask/Lumen?style=for-the-badge&color=0a84ff&label=Stáhnout)](../../releases/latest)
[![Windows](https://img.shields.io/badge/Windows-10%20%7C%2011-bf5af2?style=for-the-badge&logo=windows11&logoColor=white)](#-instalace)
[![HDR](https://img.shields.io/badge/HDR-automaticky-ff9f0a?style=for-the-badge)](#-funkce)
[![Licence](https://img.shields.io/badge/Licence-GPL--2.0-30d158?style=for-the-badge)](LICENSE)

🇬🇧 [English version](README.md)

</div>

> [!WARNING]
> **Toto není návod ke stahování nelegálního obsahu.** Lumen je pouze přehrávač a neposkytuje vůbec žádný obsah. Všechny odkazy vedou na služby třetích stran. Používejte výhradně obsah, ke kterému máte autorská práva. Vše děláte čistě na vlastní odpovědnost.

![Domů](docs/screenshots/board.png)

## 📸 Ukázky

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/profiles.png" alt="Profily"><br><sub>👥 <b>Kdo se dívá?</b> Profily s vlastními barvami a volitelným PINem</sub></td>
    <td width="50%"><img src="docs/screenshots/detail.png" alt="Detail"><br><sub>🎞️ <b>Detail</b> s velkým pozadím a kartou informací</sub></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/discover.png" alt="Objevit"><br><sub>🧭 <b>Objevit</b> s čipy katalogů a žánrů</sub></td>
    <td><img src="docs/screenshots/account.png" alt="Účet"><br><sub>☁️ <b>Volitelný účet</b> synchronizuje vše, šifrovaně od konce ke konci</sub></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/library.png" alt="Knihovna"><br><sub>📚 <b>Knihovna</b> a pokračování ve sledování</sub></td>
    <td><img src="docs/screenshots/board-small.png" alt="Malé dlaždice"><br><sub>🔍 <b>Tři velikosti dlaždic</b>: tady ta malá</sub></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/addons.png" alt="Addony"><br><sub>🧩 <b>Addony</b>: jedním klikem, jednou adresou nebo více adres najednou</sub></td>
    <td><img src="docs/screenshots/help.png" alt="Nápověda"><br><sub>💡 <b>Vestavěná nápověda</b> česky i anglicky</sub></td>
  </tr>
</table>

## ✨ Funkce

### 🎨 Vzhled
- **Rozhraní ve stylu Apple TV / iOS 26**: tmavé průsvitné „skleněné" panely, písmo Inter, velký 16:9 banner na domovské stránce.
- 🏠 **Domů**: obří doporučený banner (střídá se, bez videí a trailerů) s logem titulu, rokem, délkou, žánry a popisem. Klik na dlaždici ji zobrazí v banneru, druhý klik (nebo *Detail*) ji otevře.
- 🧭 **Objevit**: přepínač typu (filmy / seriály / kanály), čipy katalogů a žánrů, široké dlaždice, panel s informacemi o vybrané položce.
- 🏷️ **Logo titulu na každé dlaždici** (když logo chybí, nápis názvu několika styly písma).
- 🔍 **Tři velikosti náhledů** (velké / střední / malé) na domovské stránce, v Objevit, Knihovně a vyhledávání; pamatují se.

### 👥 Profily
- Každý má **vlastní addony, knihovnu a „pokračovat ve sledování"**, volitelně s **PINem**.
- Profil vyberete při startu nebo ho přepnete v nabídce vpravo nahoře.
- Všechny profily lze exportovat do souboru `.lumen` (volitelně chráněného heslem) a naimportovat na jiném zařízení.

### ☁️ Účet a synchronizace (volitelné, novinka ve verzi 1.2)
- **Účet nepotřebujete.** Bez něj zůstává všechno u vás v počítači, stejně jako dřív.
- S bezplatným účtem Lumen mezi vašimi zařízeními synchronizuje **profily, addony, knihovnu, rozkoukané díly i nastavení**.
- 🔒 **Šifrování od konce ke konci**: data se šifrují ve vašem zařízení klíčem odvozeným z hesla. Server (ani autor) je **nemůže přečíst**.
- Registrace **kódem z e-mailu**, zapomenuté heslo se obnoví stejně a **účet můžete kdykoli smazat** v Nastavení.
- Přečtěte si [zásady ochrany soukromí](docs/PRIVACY.md).

### 🎬 Přehrávač a HDR
- **Přehrávač mpv**: hardwarové dekódování, synchronizace s displejem, nabídky titulků a zvukových stop, **načtení titulků ze souboru** (.srt / .vtt), skleněná ovládací lišta, která se sama skryje.
- 🌈 **Automatické HDR ve Windows**: při přechodu do fullscreenu s HDR / Dolby Vision videem se zapne HDR na daném displeji a po skončení se vrátí (a obnoví se i po pádu aplikace). Pokud jste měli HDR zapnuté už před tím, zůstane tak.

### 🧩 Addony a zdroje
- Komunitní addony jedním klikem, přidání jedné adresy, nebo **import více adres najednou**. Nic není předinstalované.
- 🎯 **Preference zdrojů**: řazení podle jazyka (česky → anglicky) a minimální kvality (4K / Full HD) pro výsledky jakéhokoli addonu.
- 🌐 **Vestavěný streamovací server**: přímé odkazy i torrenty fungují hned, bez další aplikace.

### 📦 Ostatní
- 🇨🇿 **Česky jako výchozí jazyk**, 🇬🇧 k dispozici angličtina (rozhraní, nápověda i všechny přidané texty).
- **Instalátor**: jediný `Lumen-Setup.exe` (instalace pro uživatele, zástupci, odinstalace) obsahuje všechno.
- 🍎 Experimentální verze pro **macOS** je ve složce [`macos/`](macos) (zatím nevyzkoušená).

## 💻 Požadavky

- Windows 10 / 11 (x64) s **WebView2 runtime** (ve Windows 11 už je).
- Nic dalšího instalovat nemusíte: instalátor obsahuje přehrávací knihovnu (libmpv) i lokální streamovací server (Node.js + WebTorrent).
- Displej s podporou HDR, pokud chcete automatické HDR (nepovinné).

## 🚀 Instalace

1. Stáhněte **`Lumen-Setup.exe`** z [nejnovějšího vydání](../../releases/latest).
2. Spusťte ho. Soubor není podepsaný, takže Windows SmartScreen může varovat: *Další informace → Přesto spustit*.
3. Spusťte **Lumen** ze zástupce na ploše nebo z nabídky Start.

Odinstalace: *Nastavení → Aplikace* (nebo `Uninstall.exe` v instalační složce). Instalátor se zeptá, jestli smazat i vaše data.

## 🍿 Jak získat obsah a addony

Lumen slouží jen jako přehrávač, v základu je úplně prázdný – bez obsahu a bez předinstalovaných doplňků (addonů). Filmy a seriály do něj dostanete právě pomocí komunitních addonů, které si musíte sami nainstalovat. Lumen podporuje stejný systém doplňků jako populární aplikace Stremio.

> [!IMPORTANT]
> **Přehrávání z P2P sítí (torrentů):** přehrávání pomocí komunitních addonů fungujících na bázi torrentů se bude téměř jistě sekat, načítat celou věčnost nebo se video vůbec nespustí, protože jste závislí na rychlosti sdílení ostatních uživatelů internetu. Pro plynulé sledování (obzvlášť u 4K videí) a pro bezpečí vaší IP adresy je nutné využívat tzv. **debrid služby**, které filmy stahují bleskově na své rychlé servery a vám je pak plynule streamují.

**Kde najít návod?**
Z důvodu dodržování pravidel GitHubu zde neuvádíme konkrétní názvy ani přímé odkazy na addony. Kompletní komunitní návod, jak aplikaci nastavit a jak propojit debrid služby s příslušnými addony pro plynulé a levné sledování, naleznete zde:

👉 **[Kompletní komunitní návod na nastavení najdete ZDE](https://rentry.co/4mmr8vxy)**

## 🔒 Soukromí

Lumen funguje i bez účtu a jeho rozhraní neposílá žádné analytické události. Síťové požadavky ale dělá tam, kam to potřebuje: na servery addonů, které nainstalujete, servery s obrázky (plakáty, pozadí, loga) a veřejnou službu s popisy filmů. Vestavěné jádro aplikace může kontaktovat své výchozí katalogové služby. Knihovna, nastavení a adresy addonů jsou uložené lokálně v `%LOCALAPPDATA%\StremioMod`.

Pokud si vytvoříte volitelný účet, ukládá se jen váš e-mail a jeden **zašifrovaný** balík (Supabase, EU). Podrobnosti v [zásadách ochrany soukromí](docs/PRIVACY.md).

## 📄 Licence

GPL-2.0 – viz [LICENSE](LICENSE) a [NOTICE.md](NOTICE.md). Projekt nemá nic společného se Stremiem. Lumen neobsahuje žádný obsah; za addony a služby, které používáte, odpovídáte sami.

<div align="center">

Vytvořil s 💙 **Samuel Thomas Konečný** · [Instagram](https://www.instagram.com/samuelthomasko)

</div>
