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
- **Profiles**: each person has their own addons, library and "continue watching", with an optional PIN. Export profiles to a `.lumen` file (optionally password-protected) and import it on another device.
- **Source preferences**: order sources by language (Czech → English) and minimum quality (4K / Full HD), applied to the results of any addon.
- **Addons**: install community addons in one click, add one URL, or **import many URLs at once**. Nothing is preinstalled.
- **Player (mpv)**: hardware decoding, display-synchronised playback, subtitle & audio track menus, **load subtitles from a file** (.srt/.vtt), glass control bar.
- **Automatic Windows HDR**: when you enter fullscreen with an HDR / Dolby Vision video, Windows HDR is switched on for that display and restored afterwards
  (and recovered after a crash). If you already had HDR on, it is left alone.
- **Czech by default**, English available (UI, help and all added texts).
- **Installer**: a single `Lumen-Setup.exe` (per-user install, shortcuts, uninstaller) that includes everything, including the player library.
- **Built-in streaming server**: direct links and torrents work out of the box, no other application needed.

## Requirements

- Windows 10 / 11 (x64) with the **WebView2 runtime** (included in Windows 11).
- Nothing else to install: the installer includes the player library (libmpv) and a local streaming server (Node.js + WebTorrent).
- A display with HDR support if you want automatic HDR (optional).

## Install

1. Download **`Lumen-Setup.exe`** from the [Releases](../../releases) page of this repository.
2. Run it. The file is not code-signed, so Windows SmartScreen may warn you: *More info → Run anyway*.
3. Start **Lumen** from the desktop shortcut or the Start menu.

Uninstall via *Settings → Apps* (or run `Uninstall.exe` in the install folder). You will be asked whether to also delete your data.

## How to get content and addons

Lumen serves only as a player; by default, it is completely empty – without content and without pre-installed addons. You get movies and series by using community addons that you must install yourself. Lumen supports the same addon ecosystem as Stremio.

⚠️ **IMPORTANT WARNING regarding P2P (torrent) streaming:**
Streaming via torrent-based community addons will almost certainly stutter, take forever to load, or not start at all, as you rely on the upload speed of other internet users. For smooth playback (especially 4K files) and to keep your IP address secure, it is highly recommended to use **debrid services**, which instantly download files to their extremely fast servers and stream them directly to you.

**Where to find a setup guide?**
To comply with GitHub guidelines, we do not list specific addon names or direct links here. You can find a complete community guide on how to set up the app, link debrid services, and install recommended addons here:

👉 **[Complete Community Setup Guide HERE](https://rentry.co/4mmr8vxy)**

## Privacy
Lumen has no accounts and its interface layer sends no analytics events. It does make network requests to what you use: addon servers you install, image servers for posters / backdrops / logos, and the public metadata service used for descriptions. The bundled application core may contact its default catalog services. Your library, settings and addon URLs are stored locally in `%LOCALAPPDATA%\StremioMod`.

## License
GPL-2.0 – see [LICENSE](LICENSE) and [NOTICE.md](NOTICE.md). Not affiliated with Stremio. Lumen contains no content; you are responsible for the addons and services you use.
