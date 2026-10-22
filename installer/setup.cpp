// Lumen – instalátor (jeden setup.exe). Rozbalí přiložený balíček (resource 101, ZIP) do %LOCALAPPDATA%\Programs\Lumen,
// vytvoří zástupce
// a záznam pro odinstalaci. Stejný exe slouží jako odinstalátor (/uninstall).
//
// Parametry: /S tichá instalace, /D=cesta jiná cílová složka, /NOSHORTCUTS bez zástupců a registrů (pro testy),
//            /uninstall odinstalovat, /KEEPDATA při odinstalaci nesmazat data uživatele.

#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include <windows.h>
#include <commctrl.h>
#include <shellapi.h>
#include <shlobj.h>
#include <shobjidl.h>
#include <shlwapi.h>

#include <atomic>
#include <string>
#include <thread>

static const wchar_t* APP_NAME = L"Lumen";
static const wchar_t* APP_VERSION = L"0.1.0";
static const wchar_t* UNINSTALL_KEY = L"Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Lumen";

struct Strings {
    const wchar_t *installing, *done, *launch, *confirmUninstall, *askData, *uninstalled, *failed, *close;
};
static const Strings CS = {
    L"Instaluji Lumen…", L"Lumen je nainstalovaný.", L"Spustit Lumen teď?",
    L"Opravdu odinstalovat Lumen?", L"Smazat i nastavení, knihovnu a addony (data aplikace)?\n\nAno = smazat všechno, Ne = ponechat pro případnou další instalaci.",
    L"Lumen byl odinstalován.", L"Instalace se nezdařila.", L"Zavřít"
};
static const Strings EN = {
    L"Installing Lumen…", L"Lumen is installed.", L"Launch Lumen now?",
    L"Really uninstall Lumen?", L"Also delete settings, library and addons (app data)?\n\nYes = delete everything, No = keep it for a later reinstall.",
    L"Lumen has been uninstalled.", L"The installation failed.", L"Close"
};
static const Strings* S = &EN;

static std::wstring g_installDir;
static bool g_silent = false;
static bool g_noShortcuts = false;
static bool g_keepData = false;

static std::wstring knownFolder(REFKNOWNFOLDERID id) {
    wchar_t* p = nullptr;
    std::wstring r;
    if (SUCCEEDED(SHGetKnownFolderPath(id, 0, nullptr, &p)) && p) r = p;
    CoTaskMemFree(p);
    return r;
}

static std::wstring selfPath() {
    wchar_t p[MAX_PATH];
    GetModuleFileNameW(nullptr, p, MAX_PATH);
    return p;
}

static bool exists(const std::wstring& path) { return GetFileAttributesW(path.c_str()) != INVALID_FILE_ATTRIBUTES; }

static int runHidden(const std::wstring& cmdline, bool wait) {
    std::wstring cmd = cmdline;
    STARTUPINFOW si{ sizeof si };
    si.dwFlags = STARTF_USESHOWWINDOW; si.wShowWindow = SW_HIDE;
    PROCESS_INFORMATION pi{};
    if (!CreateProcessW(nullptr, &cmd[0], nullptr, nullptr, FALSE, CREATE_NO_WINDOW, nullptr, nullptr, &si, &pi)) return -1;
    DWORD code = 0;
    if (wait) { WaitForSingleObject(pi.hProcess, INFINITE); GetExitCodeProcess(pi.hProcess, &code); }
    CloseHandle(pi.hProcess); CloseHandle(pi.hThread);
    return (int)code;
}

static bool createShortcut(const std::wstring& lnkPath, const std::wstring& target, const std::wstring& workDir) {
    IShellLinkW* link = nullptr;
    if (FAILED(CoCreateInstance(CLSID_ShellLink, nullptr, CLSCTX_INPROC_SERVER, IID_PPV_ARGS(&link)))) return false;
    link->SetPath(target.c_str());
    link->SetWorkingDirectory(workDir.c_str());
    link->SetIconLocation(target.c_str(), 0);
    link->SetDescription(L"Lumen");
    IPersistFile* file = nullptr;
    bool ok = SUCCEEDED(link->QueryInterface(IID_PPV_ARGS(&file))) && SUCCEEDED(file->Save(lnkPath.c_str(), TRUE));
    if (file) file->Release();
    link->Release();
    return ok;
}


static bool writePayload(const std::wstring& zipPath) {
    HRSRC res = FindResourceW(nullptr, MAKEINTRESOURCEW(101), RT_RCDATA);
    if (!res) return false;
    HGLOBAL mem = LoadResource(nullptr, res);
    DWORD size = SizeofResource(nullptr, res);
    const void* data = mem ? LockResource(mem) : nullptr;
    if (!data) return false;
    HANDLE f = CreateFileW(zipPath.c_str(), GENERIC_WRITE, 0, nullptr, CREATE_ALWAYS, FILE_ATTRIBUTE_TEMPORARY, nullptr);
    if (f == INVALID_HANDLE_VALUE) return false;
    DWORD written = 0;
    bool ok = WriteFile(f, data, size, &written, nullptr) && written == size;
    CloseHandle(f);
    return ok;
}

static bool doInstall() {
    // Běžící Lumen zavřít (jinak by se nepřepsal Lumen.exe)
    runHidden(L"taskkill /IM Lumen.exe /F", true);
    SHCreateDirectoryExW(nullptr, g_installDir.c_str(), nullptr);

    wchar_t tmp[MAX_PATH];
    GetTempPathW(MAX_PATH, tmp);
    std::wstring zip = std::wstring(tmp) + L"lumen-payload.zip";
    if (!writePayload(zip)) return false;
    // tar.exe je součástí Windows 10/11 a umí ZIP
    std::wstring sys = knownFolder(FOLDERID_System);
    int rc = runHidden(L"\"" + sys + L"\\tar.exe\" -xf \"" + zip + L"\" -C \"" + g_installDir + L"\"", true);
    DeleteFileW(zip.c_str());
    if (rc != 0) return false;


    // odinstalátor = kopie tohoto exe
    CopyFileW(selfPath().c_str(), (g_installDir + L"\\Uninstall.exe").c_str(), FALSE);

    if (!g_noShortcuts) {
        std::wstring exe = g_installDir + L"\\Lumen.exe";
        std::wstring startMenu = knownFolder(FOLDERID_Programs) + L"\\Lumen.lnk";
        std::wstring desktop = knownFolder(FOLDERID_Desktop) + L"\\Lumen.lnk";
        createShortcut(startMenu, exe, g_installDir);
        createShortcut(desktop, exe, g_installDir);

        HKEY key;
        if (RegCreateKeyExW(HKEY_CURRENT_USER, UNINSTALL_KEY, 0, nullptr, 0, KEY_WRITE, nullptr, &key, nullptr) == ERROR_SUCCESS) {
            auto setStr = [&](const wchar_t* name, const std::wstring& v) {
                RegSetValueExW(key, name, 0, REG_SZ, (const BYTE*)v.c_str(), (DWORD)((v.size() + 1) * sizeof(wchar_t)));
            };
            setStr(L"DisplayName", APP_NAME);
            setStr(L"DisplayVersion", APP_VERSION);
            setStr(L"Publisher", L"Lumen");
            setStr(L"InstallLocation", g_installDir);
            setStr(L"DisplayIcon", exe);
            setStr(L"UninstallString", L"\"" + g_installDir + L"\\Uninstall.exe\" /uninstall");
            DWORD one = 1;
            RegSetValueExW(key, L"NoModify", 0, REG_DWORD, (const BYTE*)&one, sizeof one);
            RegSetValueExW(key, L"NoRepair", 0, REG_DWORD, (const BYTE*)&one, sizeof one);
            RegCloseKey(key);
        }
    }
    return true;
}

static void doUninstall(bool deleteData) {
    runHidden(L"taskkill /IM Lumen.exe /F", true);
    if (!g_noShortcuts) {
        DeleteFileW((knownFolder(FOLDERID_Programs) + L"\\Lumen.lnk").c_str());
        DeleteFileW((knownFolder(FOLDERID_Desktop) + L"\\Lumen.lnk").c_str());
        RegDeleteKeyW(HKEY_CURRENT_USER, UNINSTALL_KEY);
    }
    // Soubory se mažou po skončení tohoto procesu (běží z mazané složky).
    std::wstring cmd = L"cmd /c ping 127.0.0.1 -n 3 >nul & rmdir /s /q \"" + g_installDir + L"\"";
    if (deleteData) cmd += L" & rmdir /s /q \"" + knownFolder(FOLDERID_LocalAppData) + L"\\StremioMod\"";
    runHidden(cmd, false);
}

// ---------- jednoduché okno s průběhem ----------

static const UINT WM_INSTALL_DONE = WM_APP + 1;
static HWND g_window = nullptr;

static LRESULT CALLBACK wndProc(HWND hwnd, UINT msg, WPARAM wp, LPARAM lp) {
    switch (msg) {
    case WM_INSTALL_DONE: DestroyWindow(hwnd); return 0;
    case WM_CLOSE: return 0;   // během instalace nezavírat
    case WM_DESTROY: PostQuitMessage(0); return 0;
    }
    return DefWindowProcW(hwnd, msg, wp, lp);
}

static bool installWithWindow(HINSTANCE inst) {
    INITCOMMONCONTROLSEX icc{ sizeof icc, ICC_PROGRESS_CLASS };
    InitCommonControlsEx(&icc);
    WNDCLASSW wc{};
    wc.lpfnWndProc = wndProc; wc.hInstance = inst; wc.lpszClassName = L"LumenSetup";
    wc.hIcon = LoadIconW(inst, MAKEINTRESOURCEW(1));
    wc.hCursor = LoadCursorW(nullptr, IDC_ARROW);
    wc.hbrBackground = (HBRUSH)(COLOR_WINDOW + 1);
    RegisterClassW(&wc);

    int w = 440, h = 150;
    int x = (GetSystemMetrics(SM_CXSCREEN) - w) / 2, y = (GetSystemMetrics(SM_CYSCREEN) - h) / 2;
    g_window = CreateWindowExW(WS_EX_TOPMOST, L"LumenSetup", L"Lumen", WS_CAPTION | WS_SYSMENU | WS_VISIBLE, x, y, w, h, nullptr, nullptr, inst, nullptr);
    HFONT font = (HFONT)GetStockObject(DEFAULT_GUI_FONT);
    HWND label = CreateWindowExW(0, L"STATIC", S->installing, WS_CHILD | WS_VISIBLE, 24, 22, 380, 24, g_window, nullptr, inst, nullptr);
    SendMessageW(label, WM_SETFONT, (WPARAM)font, TRUE);
    HWND bar = CreateWindowExW(0, PROGRESS_CLASSW, nullptr, WS_CHILD | WS_VISIBLE | PBS_MARQUEE, 24, 58, 380, 20, g_window, nullptr, inst, nullptr);
    SendMessageW(bar, PBM_SETMARQUEE, TRUE, 30);

    std::atomic<bool> ok{ false };
    std::thread worker([&] {
        CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED);
        ok = doInstall();
        CoUninitialize();
        PostMessageW(g_window, WM_INSTALL_DONE, 0, 0);
    });
    MSG m;
    while (GetMessageW(&m, nullptr, 0, 0) > 0) { TranslateMessage(&m); DispatchMessageW(&m); }
    worker.join();
    return ok;
}

int WINAPI wWinMain(HINSTANCE inst, HINSTANCE, PWSTR cmdline, int) {
    CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED);
    S = (GetUserDefaultUILanguage() & 0x3FF) == LANG_CZECH ? &CS : &EN;

    std::wstring args = cmdline ? cmdline : L"";
    auto has = [&](const wchar_t* flag) { return StrStrIW(args.c_str(), flag) != nullptr; };
    g_silent = StrStrIW((L" " + args + L" ").c_str(), L" /S ") != nullptr;
    g_noShortcuts = has(L"/NOSHORTCUTS");
    g_keepData = has(L"/KEEPDATA");
    bool uninstall = has(L"/uninstall");

    g_installDir = knownFolder(FOLDERID_LocalAppData) + L"\\Programs\\Lumen";
    if (const wchar_t* d = StrStrIW(args.c_str(), L"/D=")) {
        std::wstring v = d + 3;
        if (!v.empty() && v[0] == L'"') { v = v.substr(1); size_t q = v.find(L'"'); if (q != std::wstring::npos) v = v.substr(0, q); }
        else { size_t sp = v.find(L' '); if (sp != std::wstring::npos) v = v.substr(0, sp); }
        if (!v.empty()) g_installDir = v;
    }

    if (uninstall) {
        // Odinstalátor běží z instalační složky; složku bere z umístění tohoto exe.
        if (!has(L"/D=")) { std::wstring me = selfPath(); g_installDir = me.substr(0, me.find_last_of(L'\\')); }
        if (!g_silent && MessageBoxW(nullptr, S->confirmUninstall, APP_NAME, MB_YESNO | MB_ICONQUESTION) != IDYES) return 0;
        bool deleteData = false;
        if (!g_keepData && !g_silent) deleteData = MessageBoxW(nullptr, S->askData, APP_NAME, MB_YESNO | MB_ICONQUESTION | MB_DEFBUTTON2) == IDYES;
        doUninstall(deleteData);
        if (!g_silent) MessageBoxW(nullptr, S->uninstalled, APP_NAME, MB_OK | MB_ICONINFORMATION);
        return 0;
    }

    bool ok = g_silent ? doInstall() : installWithWindow(inst);
    if (!ok) {
        if (!g_silent) MessageBoxW(nullptr, S->failed, APP_NAME, MB_OK | MB_ICONERROR);
        return 1;
    }
    if (!g_silent) {
        if (MessageBoxW(nullptr, (std::wstring(S->done) + L"\n\n" + S->launch).c_str(), APP_NAME, MB_YESNO | MB_ICONINFORMATION) == IDYES)
            ShellExecuteW(nullptr, L"open", (g_installDir + L"\\Lumen.exe").c_str(), nullptr, g_installDir.c_str(), SW_SHOWNORMAL);
    }
    return 0;
}

