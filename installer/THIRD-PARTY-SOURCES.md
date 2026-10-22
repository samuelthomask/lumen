# Third-party binaries bundled with the installer

## libmpv (`libmpv-2.dll`)

- Player library of the **[mpv](https://mpv.io)** project (source: <https://github.com/mpv-player/mpv>), licensed GPL-2.0-or-later
  (LGPL-2.1-or-later for builds configured as LGPL); it contains FFmpeg, libplacebo and other libraries, each with its own license.
- The bundled binary is an unmodified Windows build made by the **mpv-winbuild-cmake** project:
  - release tag: `20261021`
  - asset: `mpv-dev-x86_64-20261021-git-e471496c56.7z`
  - download: <https://github.com/shinchiro/mpv-winbuild-cmake/releases/download/20261021/mpv-dev-x86_64-20261021-git-e471496c56.7z>
  - SHA-256 of the archive: `EFC719EFF3DC5954B4A5EFC800632808BCEC01CC9034940DD14E5EB7FE9EA633`
  - library version string: `v0.41.0-1227-ge471496c5`
- Corresponding source code: mpv and the build scripts with the exact versions of all dependencies are published by the projects above
  (<https://github.com/mpv-player/mpv>, <https://github.com/shinchiro/mpv-winbuild-cmake>). On request the Lumen authors will provide the source of the
  bundled build as well.

Lumen loads `libmpv-2.dll` dynamically as a separate library. You can replace it with another compatible build of `libmpv-2.dll` placed in the same folder.
