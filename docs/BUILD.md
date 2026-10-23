# Building Lumen from source

Windows 10/11 x64 (sections 2–3). The macOS version (Apple Silicon) is built on a Mac, see [section 4](#4-macos-macos) and [`macos/README-macos.md`](../macos/README-macos.md). All Windows paths below are examples – every script reads its prerequisites from environment variables.

## 1. Web (the user interface)

Requirements: **Node.js ≥ 22** and **pnpm 11** (`npm i -g pnpm@11`).

```bat
cd web
pnpm install --frozen-lockfile
set LUMEN_REPO_URL=https://github.com/<you>/<repo>
pnpm build
```

Output: `web\build\`. Build options (environment variables read by webpack):

| Variable | Meaning |
|---|---|
| `LUMEN_REPO_URL` | Address of your GitHub repository (adds "Source code" in Settings and the documentation link in Help). Optional. |
| `LUMEN_EDITION` | `public` (default) or `personal`. `personal` additionally loads `web/src/routes/Help/HelpPersonal.local.js`, which is not part of the repository (`*.local.js` is git-ignored). |

## 2. Windows shell (`shell/`)

Requirements:

- **Visual Studio 2022 Build Tools** with the *Desktop development with C++* workload (MSVC v143 + Windows SDK). Variable `VCVARS` = path to `vcvars64.bat` (default is the usual Build Tools path).
- **WebView2 SDK**: download the NuGet package `Microsoft.Web.WebView2`, unzip it (a `.nupkg` is a zip). Variable `WEBVIEW2_SDK` = `<unzipped>\build\native`.
- **mpv headers**: the `include\mpv\*.h` files from the [mpv sources](https://github.com/mpv-player/mpv). Variable `MPV_INCLUDE` = the folder that contains `mpv\client.h`.
- **libmpv-2.dll**: a Windows build of mpv. The release uses the *mpv-winbuild-cmake* build listed in
  `installer/THIRD-PARTY-SOURCES.md` (the `mpv-dev-x86_64-*.7z` archive contains `libmpv-2.dll` and the headers; `tar -xf archive.7z` unpacks it).
  Variable `LIBMPV_DLL` = path of `libmpv-2.dll` (also required by the installer build). The same archive provides `include\mpv\*.h` for `MPV_INCLUDE`.

```bat
set LIBMPV_DLL=C:\sdk\libmpv\libmpv-2.dll
set WEBVIEW2_SDK=C:\sdk\webview2\build\native
set MPV_INCLUDE=C:\sdk\libmpv\include
rem 1) import library for the DLL (once)
powershell -ExecutionPolicy Bypass -File shell\lib\make-mpv-lib.ps1 -Dll %LIBMPV_DLL%
rem 2) build shell\out\Lumen.exe
shell\build.bat
```

Run in development: `set STREMIO_MOD_WEB=<repo>\web\build` and start `shell\out\Lumen.exe`.
Useful development variables (all optional): `STREMIO_MOD_URL` (start page), `STREMIO_MOD_PROFILE` (isolated WebView2 profile, e.g. to test first run),
`STREMIO_MOD_NOSERVER`, `STREMIO_MOD_LOG` (log file), `STREMIO_MOD_TESTSRC` (play a test source), `STREMIO_MOD_CAPTURE` (save a PNG of the web layer and exit),
`STREMIO_MOD_W` / `STREMIO_MOD_H` (window size).

## 3. Torrent server (`torrent-server/`)

Requirements: Node.js ≥ 22 (the same `node.exe` is bundled into the installer; variable `NODE_EXE` = its path).

```bat
cd torrent-server
npm ci
```

Try it standalone: `set LUMEN_LOG=1 && node server.js`, then request `http://127.0.0.1:11470/<infoHash>/-1?tr=<tracker>` with a `Range` header.

## 4. Installer (`installer/`)

```bat
set NODE_EXE=C:\sdk\node\node.exe
installer\build-installer.bat
```

Builds `dist\Lumen-Setup.exe` (≈ 110 MB, mostly `node.exe` and `libmpv-2.dll`): the shell, `libmpv-2.dll`, the torrent server with Node, `web\build`, licenses and a payload ZIP are embedded in a small C++ installer.
It uses `tar.exe` (part of Windows 10/11) to unpack. Silent install for testing:
`Lumen-Setup.exe /S /D=C:\Temp\LumenTest /NOSHORTCUTS`, uninstall: `Uninstall.exe /uninstall /S /NOSHORTCUTS`.

## 4. macOS (`macos/`)

Apple Silicon Mac, macOS 12+. Requirements: Xcode Command Line Tools (`xcode-select --install`) and Homebrew packages
`brew install mpv node pnpm dylibbundler pkgconf`.

```bash
cd web && pnpm install && LUMEN_EDITION=public pnpm build && cd ..
cd macos && bash make-app.sh
```

Builds `macos/dist/Lumen.app` and the installer `macos/dist/Lumen-<version>.dmg` (≈ 90 MB; dark background with an arrow
to the Applications folder, made by `make-dmg.sh` and `dmg-background.swift`). The app is signed ad-hoc (no Apple account),
so the first launch needs *right-click → Open*. The libraries of mpv and Node from Homebrew are bundled into the app with `dylibbundler`.
Layout of the DMG window is set through Finder (AppleScript); if automation is not allowed, the DMG still works, only with the default look.
