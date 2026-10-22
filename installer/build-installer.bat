@echo off
rem Builds dist\Lumen-Setup.exe: shell + web build + payload.zip embedded in a self-installing setup.exe.
rem Prerequisites: see docs\BUILD.md (shell prerequisites, built web\build, tar.exe which is part of Windows).
setlocal
set ROOT=%~dp0..
if "%VCVARS%"=="" set "VCVARS=%ProgramFiles(x86)%\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
call "%ROOT%\shell\build.bat" || exit /b 1
if not exist "%ROOT%\web\build\index.html" (echo web\build missing, run "pnpm build" in web\ & exit /b 1)

if exist "%~dp0stage" rmdir /s /q "%~dp0stage"
mkdir "%~dp0stage\payload\LICENSES"
copy /y "%ROOT%\shell\out\Lumen.exe" "%~dp0stage\payload\" >nul
if "%LIBMPV_DLL%"=="" (echo Set LIBMPV_DLL to the path of libmpv-2.dll - see docs\BUILD.md ^& exit /b 1)
copy /y "%LIBMPV_DLL%" "%~dp0stage\payload\libmpv-2.dll" >nul || (echo libmpv-2.dll not found ^& exit /b 1)
copy /y "%~dp0THIRD-PARTY-SOURCES.md" "%~dp0stage\payload\LICENSES\THIRD-PARTY-SOURCES.md" >nul
xcopy /e /i /q /y "%ROOT%\web\build" "%~dp0stage\payload\web" >nul
copy /y "%ROOT%\LICENSE" "%~dp0stage\payload\LICENSES\GPL-2.0.txt" >nul
copy /y "%ROOT%\web\assets\fonts\Inter-LICENSE-OFL.txt" "%~dp0stage\payload\LICENSES\Inter-OFL.txt" >nul
copy /y "%~dp0NOTICE.txt" "%~dp0stage\payload\NOTICE.txt" >nul

rem torrent server: Node runtime + WebTorrent + server.js (run "npm ci" in torrent-server\ first, see docs\BUILD.md)
if "%NODE_EXE%"=="" (echo Set NODE_EXE to the path of node.exe - see docs\BUILD.md ^& exit /b 1)
if not exist "%ROOT%\torrent-server\node_modules" (echo run "npm ci" in torrent-server\ ^& exit /b 1)
mkdir "%~dp0stage\payload\torrent"
copy /y "%NODE_EXE%" "%~dp0stage\payload\torrent\node.exe" >nul || (echo node.exe not found ^& exit /b 1)
copy /y "%ROOT%\torrent-server\server.js" "%~dp0stage\payload\torrent\" >nul
copy /y "%ROOT%\torrent-server\package.json" "%~dp0stage\payload\torrent\" >nul
xcopy /e /i /q /y "%ROOT%\torrent-server\node_modules" "%~dp0stage\payload\torrent\node_modules" >nul
copy /y "%ROOT%\torrent-server\NODE-LICENSE.txt" "%~dp0stage\payload\LICENSES\Node-LICENSE.txt" >nul

tar -a -cf "%~dp0stage\payload.zip" -C "%~dp0stage\payload" . || exit /b 1

call "%VCVARS%" >nul 2>&1 || (echo Cannot find vcvars64.bat, set VCVARS & exit /b 1)
if not exist "%ROOT%\dist" mkdir "%ROOT%\dist"
pushd "%~dp0"
rc /nologo /fo "%~dp0stage\setup.res" setup.rc || exit /b 1
cl /nologo /std:c++17 /EHsc /O2 /utf-8 /W3 /DUNICODE /D_UNICODE /D_CRT_SECURE_NO_WARNINGS setup.cpp /Fo"%~dp0stage\\" /Fe"%ROOT%\dist\Lumen-Setup.exe" ^
  /link /SUBSYSTEM:WINDOWS "%~dp0stage\setup.res" user32.lib gdi32.lib ole32.lib shell32.lib shlwapi.lib advapi32.lib comctl32.lib || exit /b 1
popd
echo.
dir "%ROOT%\dist\Lumen-Setup.exe"

