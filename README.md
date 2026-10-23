<div align="center">

<img src="web/assets/images/icon_196x196.png" width="110" alt="Lumen logo">

# Lumen

**A dark, glassy movie & series browser and player for Windows and macOS** 🎬✨
with automatic HDR (Windows), profiles and optional end-to-end encrypted sync.

[![Release](https://img.shields.io/github/v/release/samuelthomask/Lumen?style=for-the-badge&color=0a84ff&label=Download)](../../releases/latest)
[![Windows](https://img.shields.io/badge/Windows-10%20%7C%2011-bf5af2?style=for-the-badge&logo=windows11&logoColor=white)](#-install)
[![macOS](https://img.shields.io/badge/macOS-12%2B%20(Apple%20Silicon)-bf5af2?style=for-the-badge&logo=apple&logoColor=white)](#-install)
[![HDR](https://img.shields.io/badge/HDR-automatic-ff9f0a?style=for-the-badge)](#-features)
[![License](https://img.shields.io/badge/License-GPL--2.0-30d158?style=for-the-badge)](LICENSE)

🇨🇿 [Česká verze / Czech version](README.cs.md)

</div>

> [!WARNING]
> **This is not a guide for downloading illegal content.** Lumen is only a player and provides no content. All links lead to third-party services. Use only content you have the right to watch. You are responsible for third-party addons and services. Do everything purely at your own risk.

https://github.com/user-attachments/assets/7c7c40a3-a23d-4a13-b2ba-edfe1fefa871



![Home](docs/screenshots/board.png)

## 📸 Screenshots

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/profiles.png" alt="Profiles"><br><sub>👥 <b>Who's watching?</b> Profiles with their own colours and an optional PIN</sub></td>
    <td width="50%"><img src="docs/screenshots/detail.png" alt="Detail"><br><sub>🎞️ <b>Detail page</b> with a big backdrop and an information card</sub></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/discover.png" alt="Discover"><br><sub>🧭 <b>Discover</b> with catalog and genre chips</sub></td>
    <td><img src="docs/screenshots/account.png" alt="Account"><br><sub>☁️ <b>Optional account</b> that syncs everything, end-to-end encrypted</sub></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/library.png" alt="Library"><br><sub>📚 <b>Library</b> and continue watching</sub></td>
    <td><img src="docs/screenshots/board-small.png" alt="Small tiles"><br><sub>🔍 <b>Three tile sizes</b>: here the small one</sub></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/addons.png" alt="Addons"><br><sub>🧩 <b>Addons</b>: one click, one URL or many URLs at once</sub></td>
    <td><img src="docs/screenshots/help.png" alt="Help"><br><sub>💡 <b>Built-in help</b> in Czech and English</sub></td>
  </tr>
</table>

## ✨ Features

### 🎨 Look & feel
- **Apple TV / iOS 26-style interface**: dark translucent "glass" panels, Inter font, large 16:9 banner on the home page.
- 🏠 **Home**: giant featured banner (rotating, no videos or trailers) with title logo, year, runtime, genres and description. Click a tile to show it in the banner, click again (or *Detail*) to open it.
- 🧭 **Discover**: type switch (movies / series / channels), catalog and genre chips, wide tiles, info dock for the selected title.
- 🏷️ **Title logos on every tile** (title text in several typefaces when no logo exists).
- 🔍 **Three preview sizes** (large / medium / small) for home, discover, library and search, remembered between runs.

### 👥 Profiles
- Each person has their **own addons, library and continue watching**, with an optional **PIN**.
- Pick a profile at start-up or switch it from the menu in the top-right corner.
- Export all profiles to a `.lumen` file (optionally password-protected) and import it on another device.

### ☁️ Account & sync (optional, new in 1.2)
- **No account needed.** Without one, everything stays on your computer, as before.
- With a free account, Lumen syncs **profiles, addons, library, continue watching and settings** between your devices.
- 🔒 **End-to-end encrypted**: the data is encrypted on your device with a key derived from your password. The server (and the author) **cannot read it**.
- Sign up with a **code from your email**, reset a forgotten password the same way, and **delete the account** any time from Settings.
- Read the [privacy policy](docs/PRIVACY.md).

### 🎬 Player & HDR
- **mpv player**: hardware decoding, display-synchronised playback, subtitle & audio track menus, **load subtitles from a file** (.srt / .vtt), glass control bar that hides itself.
- 🌈 **Automatic Windows HDR**: when you enter fullscreen with an HDR / Dolby Vision video, Windows HDR is switched on for that display and restored afterwards (and recovered after a crash). If HDR was already on, it is left alone. *(Windows only. The macOS version plays HDR videos in SDR for now.)*

### 🧩 Addons & sources
- Install community addons in one click, add one URL, or **import many URLs at once**. Nothing is preinstalled.
- 🎯 **Source preferences**: order sources by language (Czech → English) and minimum quality (4K / Full HD), for the results of any addon.
- 🌐 **Built-in streaming server**: direct links and torrents work out of the box, no other application needed.

### 📦 Everything else
- 🇨🇿 **Czech by default**, 🇬🇧 English available (UI, help and all added texts).
- **Windows installer**: a single `Lumen-Setup.exe` (per-user install, shortcuts, uninstaller) that includes everything.
- 🍎 **macOS installer**: a single `Lumen-1.2.4.dmg`, drag Lumen to Applications. It includes the player and the streaming server too. The macOS version is new in 1.2.2; the source is in [`macos/`](macos).

## 💻 Requirements

**Windows**
- Windows 10 / 11 (x64) with the **WebView2 runtime** (included in Windows 11).
- Nothing else to install: the installer includes the player library (libmpv) and a local streaming server (Node.js + WebTorrent).
- A display with HDR support if you want automatic HDR (optional).

**macOS**
- macOS 12 Monterey or newer on a **Mac with Apple Silicon** (M1 or newer). Intel Macs are not supported yet.
- Nothing else to install: the app includes the player library (libmpv) and the local streaming server (Node.js + WebTorrent).

## 🚀 Install

### 🪟 Windows

1. Download **`Lumen-Setup.exe`** from the [latest release](../../releases/latest).
2. Run it. The file is not code-signed, so Windows SmartScreen may warn you: *More info → Run anyway*.
3. Start **Lumen** from the desktop shortcut or the Start menu.

Uninstall via *Settings → Apps* (or run `Uninstall.exe` in the install folder). You will be asked whether to also delete your data.

### 🍎 macOS

1. Download **`Lumen-1.2.4.dmg`** from the [latest release](../../releases/latest).
2. Open it and **drag Lumen to the Applications folder** (the arrow in the window shows where).
3. Open **Lumen** from Applications (or Launchpad). The app is not signed with an Apple Developer ID, so macOS blocks it the first time with the message *"Lumen Not Opened – Apple could not verify "Lumen" is free of malware…"*. This is expected. Click **Done** (do **not** click *Move to Trash*).
4. Allow it once in the settings:
   1. Open **System Settings → Privacy & Security**.
   2. Scroll all the way down to the **Security** section. You will see *"Lumen was blocked to protect your Mac"*.
   3. Click **Open Anyway**, confirm with your password or Touch ID, and click **Open** in the next window.

   You only do this once, from then on Lumen opens normally. On older macOS (12–14) it is enough to **right-click Lumen → Open → Open**.

   If macOS says the app is *damaged*, run this in Terminal and open it again:
   ```bash
   xattr -dr com.apple.quarantine /Applications/Lumen.app
   ```

Uninstall: drag Lumen from Applications to the Trash. To also delete your data, remove `~/Library/WebKit/io.github.samuelthomask.lumen`, `~/Library/Application Support/Lumen` and `~/Library/Caches/io.github.samuelthomask.lumen`.

## 🍿 How to get content and addons

Lumen serves only as a player; by default, it is completely empty – without content and without pre-installed addons. You get movies and series by using community addons that you must install yourself. Lumen supports the same addon ecosystem as Stremio.

> [!IMPORTANT]
> **P2P (torrent) streaming:** streaming via torrent-based community addons will almost certainly stutter, take forever to load, or not start at all, as you rely on the upload speed of other internet users. For smooth playback (especially 4K files) and to keep your IP address secure, it is highly recommended to use **debrid services**, which instantly download files to their extremely fast servers and stream them directly to you.

**Where to find a setup guide?**
To comply with GitHub guidelines, we do not list specific addon names or direct links here. You can find a complete community guide on how to set up the app, link debrid services, and install recommended addons here:

👉 **[Complete Community Setup Guide HERE](https://rentry.co/4mmr8vxy)**

## 🔒 Privacy

Lumen works without an account and its interface layer sends no analytics events. It does make network requests to what you use: addon servers you install, image servers for posters / backdrops / logos, and the public metadata service used for descriptions. The bundled application core may contact its default catalog services. Your library, settings and addon URLs are stored locally (Windows: `%LOCALAPPDATA%\StremioMod`, macOS: `~/Library/WebKit/io.github.samuelthomask.lumen`).

If you create the optional account, only your email and one **encrypted** bundle are stored (Supabase, EU). Details in the [privacy policy](docs/PRIVACY.md).

## 📄 License

GPL-2.0 – see [LICENSE](LICENSE) and [NOTICE.md](NOTICE.md). Not affiliated with Stremio. Lumen contains no content; you are responsible for the addons and services you use.

<div align="center">

Made with 💙 by **Samuel Thomas Konečný** · [Instagram](https://www.instagram.com/samuelthomasko)

</div>
