# Creates shell\lib\mpv.lib (an import library) from libmpv-2.dll, so the linker knows which functions the DLL offers.
# Usage: .\make-mpv-lib.ps1 -Dll "C:\path\to\libmpv-2.dll" [-VcVars "C:\...\vcvars64.bat"]
param(
    [Parameter(Mandatory=$true)][string]$Dll,
    [string]$VcVars = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
)
if (-not (Test-Path $Dll)) { throw "libmpv-2.dll not found: $Dll" }
if (-not (Test-Path $VcVars)) { throw "vcvars64.bat not found: $VcVars" }

$out = cmd /c "call `"$VcVars`" >nul 2>&1 & dumpbin /exports `"$Dll`""
$names = $out | ForEach-Object { if ($_ -match '^\s+\d+\s+[0-9A-F]+\s+[0-9A-F]{8}\s+(mpv_\S+)') { $Matches[1] } }
if (-not $names) { throw "The DLL exports no mpv_* functions" }

Set-Location $PSScriptRoot
@("LIBRARY libmpv-2.dll", "EXPORTS") + $names | Set-Content mpv.def -Encoding ascii
cmd /c "call `"$VcVars`" >nul 2>&1 & lib /nologo /def:mpv.def /machine:x64 /out:mpv.lib"
"mpv.lib created ($($names.Count) functions)"
