@echo off
rem Builds shell\out\Lumen.exe (Windows shell: WebView2 + libmpv).
rem
rem Prerequisites (see docs\BUILD.md):
rem   - Visual Studio 2022 Build Tools (C++ workload, Windows SDK)          -> VCVARS
rem   - WebView2 SDK (NuGet package Microsoft.Web.WebView2, unzipped)       -> WEBVIEW2_SDK = <unzipped>\build\native
rem   - mpv headers (folder that contains mpv\client.h)                      -> MPV_INCLUDE
rem   - libmpv import library shell\lib\mpv.lib (run shell\lib\make-mpv-lib.ps1)
rem   - libmpv-2.dll (a Windows build of mpv, copied next to Lumen.exe)  -> LIBMPV_DLL
setlocal
if "%VCVARS%"=="" set "VCVARS=%ProgramFiles(x86)%\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
if "%LIBMPV_DLL%"=="" (echo Set LIBMPV_DLL to the path of libmpv-2.dll - see docs\BUILD.md ^& exit /b 1)
if "%WEBVIEW2_SDK%"=="" (echo Set WEBVIEW2_SDK to the unzipped Microsoft.Web.WebView2 package\build\native folder & exit /b 1)
if "%MPV_INCLUDE%"=="" (echo Set MPV_INCLUDE to the folder that contains mpv\client.h & exit /b 1)
if not exist "%~dp0lib\mpv.lib" (echo Missing shell\lib\mpv.lib - run shell\lib\make-mpv-lib.ps1 first & exit /b 1)

call "%VCVARS%" >nul 2>&1 || (echo Cannot find vcvars64.bat, set VCVARS & exit /b 1)
if not exist "%~dp0out" mkdir "%~dp0out"
if not exist "%~dp0out\libmpv-2.dll" copy "%LIBMPV_DLL%" "%~dp0out\" >nul

pushd "%~dp0res"
rc /nologo /fo "%~dp0out\app.res" app.rc || exit /b 1
popd
cl /nologo /std:c++17 /EHsc /O2 /utf-8 /W3 /DUNICODE /D_UNICODE /D_CRT_SECURE_NO_WARNINGS ^
  /I"%WEBVIEW2_SDK%\include" /I"%MPV_INCLUDE%" ^
  "%~dp0src\main.cpp" /Fo"%~dp0out\\" /Fe"%~dp0out\Lumen.exe" ^
  /link /SUBSYSTEM:WINDOWS "%~dp0out\app.res" "%WEBVIEW2_SDK%\x64\WebView2LoaderStatic.lib" "%~dp0lib\mpv.lib" ^
  user32.lib gdi32.lib ole32.lib oleaut32.lib advapi32.lib shell32.lib shlwapi.lib version.lib dcomp.lib ws2_32.lib

