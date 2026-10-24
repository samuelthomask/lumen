# Sestaví APK pro Android TV z hotového stremio-web\build a zkopíruje ho do dist\Lumen-AndroidTV.apk.
# Web musí být sestavený předem (pnpm build, pro veřejnou verzi s LUMEN_EDITION=public).
# Podpis: když existuje android\keystore.properties, použije se vlastní klíč; jinak ladicí klíč (stačí pro ruční instalaci).
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$env:JAVA_HOME = 'C:\Program Files\Eclipse Adoptium\jdk-21.0.10.7-hotspot'
$env:GRADLE_USER_HOME = 'E:\tools\gradle-home'
$env:ANDROID_HOME = 'E:\tools\android-sdk'
$task = if (Test-Path (Join-Path $root 'keystore.properties')) { 'assembleRelease' } else { 'assembleDebug' }
Push-Location $root
try {
    & E:\tools\gradle-8.14.3\bin\gradle.bat $task --no-daemon --console=plain -q
    if ($LASTEXITCODE -ne 0) { throw "gradle selhal ($LASTEXITCODE)" }
} finally { Pop-Location }
$kind = if ($task -eq 'assembleRelease') { 'release' } else { 'debug' }
$apk = Get-ChildItem (Join-Path $root "app\build\outputs\apk\$kind") -Filter '*.apk' | Select-Object -First 1
$dist = Join-Path $root '..\dist'
New-Item -ItemType Directory -Force $dist | Out-Null
Copy-Item $apk.FullName (Join-Path $dist 'Lumen-AndroidTV.apk') -Force
"APK: " + (Resolve-Path (Join-Path $dist 'Lumen-AndroidTV.apk'))
