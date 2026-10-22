# Notice / Poděkování a licence

**Lumen** is free software.

| Part | License |
|---|---|
| `web/` (modified stremio-web) | **GNU GPL version 2** (see [LICENSE](LICENSE)) |
| `shell/`, `installer/` (original code of this project) | **GNU GPL version 2 or (at your option) any later version** |

## Origin

- `web/` is a modified version of **[stremio-web](https://github.com/Stremio/stremio-web)**
  (© Smart Code OOD, GPL-2.0). All original copyright and license notices are kept in the source files.
  Changes made in this project: new visual design (Lumen theme), reworked home / discover / detail / player pages,
  local library without accounts, language and quality preferences for sources, addon import, density presets,
  Czech default language, in-app help, removal of account / login features and of telemetry events.
- `shell/`, `installer/` and `torrent-server/server.js` are original code of this project.
- Lumen contains its own local streaming server (WebTorrent). It does **not** include, copy or redistribute the proprietary streaming server of the Stremio desktop application;
  if that application happens to be installed on the user's computer, Lumen can start and use it (see `docs/ARCHITECTURE.md`).

## Third-party components

| Component | License |
|---|---|
| stremio-web (base of `web/`) | GPL-2.0 |
| **libmpv** (`libmpv-2.dll`, bundled in the installer, unmodified third-party Windows build of mpv) | GPL-2.0-or-later / LGPL-2.1-or-later (mpv project); contains FFmpeg, libplacebo and other libraries under their own licenses. Exact build, download address, checksum and source information: [installer/THIRD-PARTY-SOURCES.md](installer/THIRD-PARTY-SOURCES.md) |
| **WebTorrent** and its npm dependencies (`torrent-server/`, bundled in the installer) | MIT and other permissive licenses, see `torrent-server/package-lock.json` and each package |
| **Node.js** runtime (`torrent\node.exe`, bundled unmodified) | MIT and the licenses of its components, see `LICENSES\Node-LICENSE.txt` in the installation |
| Inter font (`web/assets/fonts/Inter-*`) | SIL Open Font License 1.1 (`web/assets/fonts/Inter-LICENSE-OFL.txt`) |
| Microsoft Edge WebView2 SDK | see the SDK license (BSD-style, loader linked statically) |
| `@stremio/stremio-core-web`, `@stremio/stremio-video`, other npm packages | see `web/package.json` and each package's license |

## Trademarks

Lumen is **not affiliated with, endorsed or sponsored by Stremio or Smart Code OOD**. "Stremio" is a trademark of its owner
and is mentioned here only to describe compatibility (the addon format and the optional use of an installed application).
The name and the logo "Lumen" are this project's own.

Film posters, backdrops and logos shown in screenshots belong to their respective rights holders and are used only to illustrate the user interface.

## Content

Lumen contains no video content and no preinstalled addons. You are responsible for the addons and services you use
and for complying with the laws of your country.
