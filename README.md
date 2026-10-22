# Lumen

**A dark, glassy movie & series browser and player for Windows with automatic HDR switching.**
Built from the open-source Stremio web UI plus a custom Windows shell (WebView2 + mpv).
No accounts, no telemetry events, no bundled content.

🇨🇿 [Česká verze / Czech version](README.cs.md)

### ⚠️ Important Notice
This is not a guide for downloading illegal content. Lumen is only a player and provides no content. All links lead to third-party services. Use only content you have the right to watch. You are responsible for third-party addons and services. Do everything purely at your own risk.

![Home](docs/screenshots/board.png)

## Features

- **Apple TV / iOS 26-style interface**: dark translucent "glass" panels, Inter font, large 16:9 banner on the home page.
- **Home**: giant featured banner (rotating, no videos or trailers) with title logo, year, runtime, genres and description.
  Click any tile to show it in the banner; click again (or *Detail*) to open it.
- **Discover**: type switch (movies / series / channels), catalog and genre chips, wide tiles, info dock for the selected title.
- **Title logos on every tile** (title text in several typefaces when no logo exists).
- **Detail page**: big backdrop with an information card, sources / episodes in a card grid.
- **Three preview sizes** (large / medium / small) for home, discover, library and search, remembered between runs.
- **Local library and "continue watching"** – no account needed, everything stays on your computer.
- **Source preferences**: order sources by language (Czech → English) and minimum quality (4K / Full HD), applied to the results of any addon.
- **Addons**: install community addons in one click, add one URL, or **import many URLs at once**. Nothing is preinstalled.
- **Player (mpv)**: hardware decoding, display-synchronised playback, subtitle & audio track menus, **load subtitles from a file** (.srt/.vtt), glass control bar.
- **Automatic Windows HDR**: when you enter fullscreen with an HDR / Dolby Vision video, Windows HDR is switched on for that display and restored afterwards
  (and recovered after a crash). If you already had HDR on, it is left alone.
- **Czech by default**, English available (UI, help and all added texts).
- **Installer**: a single `Lumen-Setup.exe` (per-user install, shortcuts, uninstaller) that includes everything, including the player library.
- **Built-in streaming server**: direct links and torrents work out of the box, no debrid service and no other application needed.

## Requirements

- Windows 10 / 11 (x64) with the **WebView2 runtime** (included in Windows 11).
- Nothing else to install: the installer includes the player library (libmpv) and a local streaming server (Node.js + WebTorrent).
- A display with HDR support if you want automatic HDR (optional).

## Install

1. Download **`Lumen-Setup.exe`** from the [Releases](../../releases) page of this repository.
2. Run it. The file is not code-signed, so Windows SmartScreen may warn you: *More info → Run anyway*.
3. Start **Lumen** from the desktop shortcut or the Start menu.

Uninstall via *Settings → Apps* (or run `Uninstall.exe` in the install folder). You will be asked whether to also delete your data.

## How to get content (Recommended Paths)

Lumen serves only as a player; by default, it is completely empty – without content and without pre-installed addons. You get movies and series by using addons that you must install yourself. (As an alternative to Lumen, you can also use [Syncler](https://syncler.net/)).

Just choose one of two paths and pay for only one service:

### Path A - The cheapest (Webshare + Cineshare)
You don't need to deal with any debrid. You'll find mostly Czech streams here, and Czech dubbing is available for most movies and series.
1. Create and subscribe to an account on [Webshare](https://webshare.cz/).
2. Go to the [Cineshare](https://wshare5.streamstr.stream/) addon page.
3. Enter your Webshare login details to generate the installation link for Lumen.

### Path B - Biggest selection (Debrid + torrent addons)
Here you buy one "debrid" account. **This is absolutely essential if you want to use addons from this category.**

⚠️ **IMPORTANT WARNING: Why will it stutter without debrid?**
If you try to use torrent addons (like Torrentio, Comet, etc.) directly, **without a paid debrid account (Real-Debrid or TorBox), playback will almost certainly stutter, take forever to load, or not start at all.** 
This is because of how torrents work – without debrid, you rely on how fast other regular people on the internet send you the file, which is usually not enough. Debrid works by instantly downloading the film to its own extremely fast servers and smoothly streaming it directly to you. Only thanks to it can you play huge 4K movies without a single stutter, plus your IP address remains hidden.

*   **Step 1: Choose a debrid service**
    Choose and subscribe to **only one** of these services (both do the same):
    *   [Real-Debrid](https://real-debrid.com/)
    *   [TorBox](https://torbox.app/)

*   **Step 2: Choose addons**
    Once you have purchased debrid, you can install any of these addons:
    *   [Torrentio](https://torrentio.strem.fun/configure) – The most used and stable addon.
    *   [Comet](https://comet.elfhosted.com/) – Very fast addon optimized for debrid services.
    *   [MediaFusion](https://mediafusion.elfhosted.com/configure) – Universal addon supporting many catalogs and live broadcasting.
    *   [TorrentsDB](https://torrentsdb.com/configure) – Great alternative with a large database if another addon isn't working.

*   **Step 3: Installation**
    Open the addon configuration page, set the quality ideally to 4K. Enter your API key from your debrid service. Copy the generated address (ends in `manifest.json`), go to **Addons -> Import** in Lumen, paste it and click **Install all**. Do not share this link publicly.

## Privacy
Lumen has no accounts and its interface layer sends no analytics events. It does make network requests to what you use: addon servers you install, image servers for posters / backdrops / logos, and the public metadata service used for descriptions. The bundled application core may contact its default catalog services. Your library, settings and addon URLs are stored locally in `%LOCALAPPDATA%\StremioMod`.

## License
GPL-2.0 – see [LICENSE](LICENSE) and [NOTICE.md](NOTICE.md). Not affiliated with Stremio. Lumen contains no content; you are responsible for the addons and services you use.
