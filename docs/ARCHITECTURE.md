# Architecture

```
+--------------------------------------------------------------+
| Lumen.exe (shell)                                            |
|   main window                                                |
|    ├─ child window ← mpv renders video here (d3d11, wid)     |
|    └─ DirectComposition layer on top: WebView2 (transparent) |
|         loads web/build via https://lumen.localhost:11470/    |
|   JSON messages (chrome.webview.postMessage)  ⇄  mpv API      |
|   HDR switching (DisplayConfig), server start (job object)    |
+--------------------------------------------------------------+
                │ HTTP                           │ libmpv
        Stremio streaming server           libmpv-2.dll
        (local, from an installed Stremio)   (from that installation)
```

## Why a transparent WebView2 over a native video window

mpv renders into its own window (best video quality, HDR passthrough, hardware decoding).
The interface is a web page; when a video loads it makes its background transparent
(`setBackground(false)` in the player code), so the video shows through. A normal (windowed) WebView2 is not transparent over a
sibling window, therefore the shell uses *composition hosting* (a DirectComposition visual over the whole window) and forwards
mouse input and the cursor itself.

## Protocol between the UI and the shell

The UI (stremio-web) already speaks to its shell through `window.chrome.webview` JSON messages:

- UI → shell: `{id:0, type:6, args:[method, ...args]}` (invoke) and `{id:0, type:3}` (init).
- Shell → UI: `{type:1, args:[signal, data]}` and the init reply with a `properties` list (`shellVersion`, `streamingServerUrl`, capability flags).
- Methods used: `mpv-command`, `mpv-set-prop`, `mpv-observe-prop`, `win-set-visibility` (fullscreen), `app-ready`, `quit`, `media.*` (ignored).
- Signals: `mpv-prop-change {name,data}`, `mpv-event-ended`, `win-visibility-changed {visible, visibility, isFullscreen}`.
- The UI waits for the `mpv-version` property before loading a file.

The UI defines a dummy `window.qt` object at startup. The player library disables server-side transcoding when it exists
(as in the original Qt shell), so mpv receives the original source URL and plays everything directly.

## Automatic HDR

- The shell observes the `video-params` property of mpv. A video counts as HDR when `gamma` is `pq` or `hlg`,
  when the colour matrix is `dolbyvision`, or when `sig-peak` is above 1.5.
- When the window is fullscreen **and** the video is HDR, `DisplayConfigSetDeviceInfo(SET_ADVANCED_COLOR_STATE)` turns Windows HDR on for the
  display that holds the window. mpv (`target-colorspace-hint=yes`) then switches its swap chain to HDR10 passthrough.
- When either condition ends (leaving fullscreen, video ends, window closes) the state is restored. If HDR was already on, nothing is touched.
- Safety net: before switching, a small file in `%LOCALAPPDATA%\StremioMod` records which display was switched; the next start restores it after a crash.
  `Lumen.exe --hdr-off` does the same on demand.

## Local server

The interface expects a local "streaming server" on `127.0.0.1:11470` (settings, network and device info, casting devices, heartbeat).
When Lumen starts:

1. If something already listens on port 11470, it is used.
2. Otherwise, if a Stremio desktop application is installed, its streaming server is started in the background (in a Windows job object,
   so it ends with Lumen). That server also streams torrents.
3. Otherwise Lumen starts its own server, `torrent-server/server.js`, with the bundled `torrent\node.exe` (in the same job object). It uses
   [WebTorrent](https://github.com/webtorrent/webtorrent) and bound to `127.0.0.1` only:
   - status requests the interface makes (`/settings`, `/network-info`, `/device-info`, `/casting`, `/heartbeat`, `/stats.json`);
   - `POST /<infoHash>/create` and `GET /<infoHash>/<fileIdx>?tr=...` (HTTP range requests; `fileIdx` `-1` or missing = the largest video file),
     plus `.../stats.json`. Data is stored in `%LOCALAPPDATA%\StremioMod\torrents`, only the torrent being watched is kept, everything is deleted on exit.
4. If that fails (no `torrent` folder, Node cannot start) a minimal built-in server in `shell/src/main.cpp` (`startBuiltinServer`) answers the status requests only;
   torrent requests return `501`. Sources with a direct link need no server at all, mpv plays them directly.

The built-in server sends CORS headers only for the origin of the app's own page (`https://lumen.localhost:11470`), so web pages in a browser cannot read its answers.
The shell serves the web page from that virtual host (WebView2 `SetVirtualHostNameToFolderMapping`); the Stremio server also accepts it because its allow-list contains
origins ending with `localhost:11470`. Chromium's private-network checks are disabled for the Lumen window.

## macOS shell (`macos/`)

Same idea, different technology: a Swift app (`macos/Sources/Lumen/main.swift`) with a `WKWebView` (transparent) over an `NSOpenGLView`
that mpv renders into through the libmpv **render API** (`vo=libmpv`, which is also what the interface asks for). The protocol between the
interface and the shell is the same JSON as on Windows (a small script injected into the page replaces `window.chrome.webview`).
mpv commands run on a background queue (changing the video output from the main thread deadlocks). The local server is the same
`torrent-server/server.js`, started with a bundled Node from `Contents/Resources/torrent`, and it also serves the web interface on `127.0.0.1:11470`.
There is no automatic HDR on macOS yet (the OpenGL render API outputs SDR).

## Interface additions (web/)

- `src/App/lumen.less` – the theme (CSS variables, glass panels, layout of side bar, player bar, detail page, density presets).
- `src/routes/Board/Hero`, `src/routes/Discover`, `src/components/MetaItem` – banner, chips, tile logos.
- `src/common/density.js`, `streamPrefs.js`, `lumenText.js` – preview size, source preferences, Czech/English texts.
- `src/routes/Addons/ImportAddons.js`, `src/routes/Help` – addon import and the in-app help.
- Account / login pages, telemetry events and links to third-party account pages were removed.
