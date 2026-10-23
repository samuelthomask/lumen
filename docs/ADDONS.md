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
Lumen stores installed addons in the local profile (Windows: `%LOCALAPPDATA%\StremioMod`, macOS: `~/Library/WebKit/io.github.samuelthomask.lumen`), unencrypted.

## Choosing the best source / Výběr zdroje

Above the list of sources on a movie page you can set:

- **Language**: *Czech, then English* (default) / *English* / *Any language* – sources whose title or description mention the language are listed first.
- **Quality**: *4K only* / *Full HD +* (default) / *Any quality* – lower quality is hidden (unknown quality is always kept; if the filter would hide everything, nothing is hidden).

## Setup Guides and Recommended Addons / Návody a doporučené addony

To keep this repository clean, all detailed tutorials, recommendations for community addons, and guides on setting up debrid services for smooth playback are hosted externally.
Z důvodu udržení čistého repozitáře jsou všechny detailní návody na instalaci komunitních doplňků a zprovoznění debrid služeb pro plynulé přehrávání přesunuty mimo GitHub.

👉 **[Community Setup Guide / Komunitní návod na nastavení a addony](https://rentry.co/4mmr8vxy)**
