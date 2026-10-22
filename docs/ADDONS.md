# Addons / Addony

Lumen contains **no content and no preinstalled addons**. Movies and series come from addons that you choose and install yourself.
Lumen neobsahuje žádný obsah ani předinstalované addony; filmy a seriály dodávají addony, které si sami zvolíte a nainstalujete.

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

## What is "debrid"? / Co je debrid

Some addons can use a paid *debrid* service: it downloads the source on its fast servers and sends it to you as an ordinary video.
Playback then starts within seconds, does not stall, handles large 4K HDR files, and your IP address is not shared with other people.
The service key is entered on the configuration page of the specific addon – **not in Lumen**.
Whether you need such a service depends on the addon; you only need one.

## Recommended addons and services / Doporučené addony a služby

> The maintainer of this repository can list recommendations here. / Správce repozitáře sem může doplnit doporučení.

| Name / Název | What it does / K čemu je | Link / Odkaz |
|---|---|---|
| DOPLNEK_1 | _popis_ | ODKAZ_1 |
| DOPLNEK_2 | _popis_ | ODKAZ_2 |
| SLUZBA_1 | _popis_ | ODKAZ_3 |
| SLUZBA_2 | _popis_ | ODKAZ_4 |

## Notice / Upozornění

Lumen provides no content and does not itself recommend sources. Use only content you have the right to watch.
You are responsible for third-party addons and services and for obeying the laws of your country.
Lumen neposkytuje obsah. Používejte jen obsah, ke kterému máte právo. Za addony a služby třetích stran odpovídáte sami.
