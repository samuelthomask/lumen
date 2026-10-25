// Lumen – instalátor (jeden setup.exe). Průvodce ve stejném stylu jako aplikace (tmavé "sklo", písmo Inter).
// Rozbalí přiložený balíček (resource 101, ZIP) do zvolené složky (výchozí %LOCALAPPDATA%\Programs\Lumen),
// vytvoří zástupce a záznam pro odinstalaci. Stejný exe slouží jako odinstalátor (/uninstall).
//
// Parametry: /S tichá instalace, /D=cesta jiná cílová složka, /NOSHORTCUTS bez zástupců a registrů (pro testy),
//            /uninstall odinstalovat, /KEEPDATA při odinstalaci nesmazat data uživatele.
// Autor: Samuel Thomas Konečný (samuelthomask)

#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include <windows.h>
#include <commctrl.h>
#include <dwmapi.h>
#include <shellapi.h>
#include <shlobj.h>
#include <shobjidl.h>
#include <shlwapi.h>
#include <windowsx.h>

#include <algorithm>
#include <atomic>
#include <cmath>
#include <string>
#include <thread>
#include <vector>

using std::min;
using std::max;
#include <gdiplus.h>
using namespace Gdiplus;

static const wchar_t* APP_NAME = L"Lumen";
static const wchar_t* APP_VERSION = L"2.1.4";
static const wchar_t* APP_AUTHOR = L"Samuel Thomas Konečný";
static const wchar_t* APP_AUTHOR_HANDLE = L"samuelthomask";
static const wchar_t* APP_URL = L"https://github.com/samuelthomask/Lumen";
static const wchar_t* UNINSTALL_KEY = L"Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Lumen";

// ---------- texty ----------

struct Strings {
    const wchar_t *welcomeTitle, *welcomeSub, *feat1, *feat2, *feat3,
        *locTitle, *locSub, *browse, *space, *deskLnk, *startLnk,
        *instTitle, *instSub, *doneTitle, *doneSub, *launch,
        *uTitle, *uSub, *uData, *uDoneTitle, *uDoneSub,
        *next, *back, *install, *finish, *cancel, *uninstall, *failedTitle, *failedSub, *author, *version, *pickFolder;
};
static const Strings CS = {
    L"Vítejte v Lumenu", L"Tmavý, skleněný přehrávač filmů a seriálů s automatickým HDR.",
    L"Automatické HDR ve Windows", L"Přehrává torrenty i přímé odkazy", L"Bez účtů a bez telemetrie",
    L"Kam nainstalovat", L"Lumen se nainstaluje do této složky. Můžete ji změnit.", L"Procházet…", L"Potřebné místo: asi 300 MB",
    L"Zástupce na ploše", L"Zástupce v nabídce Start",
    L"Instaluji Lumen…", L"Rozbaluji soubory, chvilku strpení.", L"Hotovo", L"Lumen je nainstalovaný a připravený.", L"Spustit Lumen",
    L"Odinstalovat Lumen", L"Lumen se odstraní z tohoto počítače.", L"Smazat i nastavení, knihovnu a addony (data aplikace)",
    L"Lumen byl odinstalován", L"Děkujeme, že jste Lumen používali.",
    L"Pokračovat", L"Zpět", L"Nainstalovat", L"Dokončit", L"Zrušit", L"Odinstalovat", L"Něco se nepovedlo", L"Instalace se nezdařila. Zkuste jinou složku nebo spusťte instalátor znovu.",
    L"Autor", L"Verze", L"Vyberte složku pro Lumen"
};
static const Strings EN = {
    L"Welcome to Lumen", L"A dark, glassy movie and series player with automatic HDR.",
    L"Automatic HDR in Windows", L"Plays torrents and direct links", L"No accounts, no telemetry",
    L"Where to install", L"Lumen will be installed into this folder. You can change it.", L"Browse…", L"Required space: about 300 MB",
    L"Desktop shortcut", L"Start menu shortcut",
    L"Installing Lumen…", L"Unpacking files, one moment.", L"All done", L"Lumen is installed and ready.", L"Launch Lumen",
    L"Uninstall Lumen", L"Lumen will be removed from this computer.", L"Also delete settings, library and addons (app data)",
    L"Lumen has been uninstalled", L"Thank you for using Lumen.",
    L"Continue", L"Back", L"Install", L"Finish", L"Cancel", L"Uninstall", L"Something went wrong", L"The installation failed. Try another folder or run the installer again.",
    L"Author", L"Version", L"Choose a folder for Lumen"
};
static const Strings* S = &EN;
static bool g_czech = false;

// ---------- stav ----------

static std::wstring g_installDir;
static bool g_silent = false;
static bool g_noShortcuts = false;
static bool g_keepData = false;
static bool g_uninstallMode = false;
static bool g_updateMode = false;   // /UPDATE: tichá aktualizace z aplikace, po instalaci znovu spustí Lumen
static bool g_optDesktop = true, g_optStart = true, g_optLaunch = true, g_optDeleteData = false;
static std::wstring g_pendingCleanup;   // příkaz spuštěný při ukončení odinstalátoru

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

// Odinstalátor maže celou cílovou složku, proto se vždy instaluje do složky jménem "Lumen".
static std::wstring normalizeInstallDir(std::wstring d) {
    while (d.size() > 3 && (d.back() == L'\\' || d.back() == L'/')) d.pop_back();
    size_t slash = d.find_last_of(L"\\/");
    std::wstring leaf = slash == std::wstring::npos ? d : d.substr(slash + 1);
    if (_wcsicmp(leaf.c_str(), L"Lumen") != 0) d += L"\\Lumen";
    return d;
}

static bool doInstall() {
    // Běžící Lumen zavřít (jinak by se nepřepsal Lumen.exe)
    runHidden(L"taskkill /IM Lumen.exe /F", true);
    // staré rozhraní pryč, ať se při aktualizacích nehromadí složky předchozích verzí
    if (PathIsDirectoryW(g_installDir.c_str())) runHidden(L"cmd /c rmdir /s /q \"" + g_installDir + L"\\web\"", true);
    if (SHCreateDirectoryExW(nullptr, g_installDir.c_str(), nullptr) != ERROR_SUCCESS && !PathIsDirectoryW(g_installDir.c_str())) return false;

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
        if (g_optStart) createShortcut(knownFolder(FOLDERID_Programs) + L"\\Lumen.lnk", exe, g_installDir);
        if (g_optDesktop) createShortcut(knownFolder(FOLDERID_Desktop) + L"\\Lumen.lnk", exe, g_installDir);

        HKEY key;
        if (RegCreateKeyExW(HKEY_CURRENT_USER, UNINSTALL_KEY, 0, nullptr, 0, KEY_WRITE, nullptr, &key, nullptr) == ERROR_SUCCESS) {
            auto setStr = [&](const wchar_t* name, const std::wstring& v) {
                RegSetValueExW(key, name, 0, REG_SZ, (const BYTE*)v.c_str(), (DWORD)((v.size() + 1) * sizeof(wchar_t)));
            };
            setStr(L"DisplayName", APP_NAME);
            setStr(L"DisplayVersion", APP_VERSION);
            setStr(L"Publisher", std::wstring(APP_AUTHOR) + L" (" + APP_AUTHOR_HANDLE + L")");
            setStr(L"URLInfoAbout", APP_URL);
            setStr(L"InstallLocation", g_installDir);
            setStr(L"DisplayIcon", exe);
            setStr(L"UninstallString", L"\"" + g_installDir + L"\\Uninstall.exe\" /uninstall");
            DWORD one = 1, kb = 300 * 1024;
            RegSetValueExW(key, L"NoModify", 0, REG_DWORD, (const BYTE*)&one, sizeof one);
            RegSetValueExW(key, L"NoRepair", 0, REG_DWORD, (const BYTE*)&one, sizeof one);
            RegSetValueExW(key, L"EstimatedSize", 0, REG_DWORD, (const BYTE*)&kb, sizeof kb);
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
    // Soubory se mažou až po skončení tohoto procesu (běží z mazané složky).
    g_pendingCleanup = L"cmd /c ping 127.0.0.1 -n 4 >nul & rmdir /s /q \"" + g_installDir + L"\"";
    if (deleteData) g_pendingCleanup += L" & rmdir /s /q \"" + knownFolder(FOLDERID_LocalAppData) + L"\\StremioMod\"";
}

// ---------- okno ----------

enum Page { P_WELCOME, P_LOCATION, P_INSTALLING, P_DONE, P_FAILED, P_UCONFIRM, P_UDONE };
static Page g_page = P_WELCOME;

static const int W = 720, H = 480, SIDE = 236;
static const UINT WM_INSTALL_DONE = WM_APP + 1;
static const UINT_PTR TIMER_ANIM = 1;

static HWND g_hwnd = nullptr, g_edit = nullptr;
static HFONT g_editFont = nullptr;
static HBRUSH g_editBrush = nullptr;
static HICON g_icon = nullptr;
static ULONG_PTR g_gdiplusToken = 0;
static PrivateFontCollection* g_fonts = nullptr;
static FontFamily* g_famRegular = nullptr;
static FontFamily* g_famSemi = nullptr;
static int g_hover = -1;
static float g_anim = 0;
static float g_s = 1.f;   // měřítko podle DPI (okno je DPI-aware, jinak by Windows obraz roztáhly a rozmazaly)
static RECT g_linkGh, g_linkIg;
static const wchar_t* APP_INSTAGRAM_URL = L"https://www.instagram.com/samuelthomasko/";   // vyplnit adresou profilu; prázdné = tlačítko se nezobrazí
static std::thread g_worker;
static std::atomic<bool> g_installOk{ false };

struct Btn { RECT r; int id; std::wstring label; bool primary; };
struct Chk { RECT r; bool* val; std::wstring label; };
static std::vector<Btn> g_btns;
static std::vector<Chk> g_chks;
static RECT g_langCs, g_langEn, g_close, g_pathBox;

enum { B_NEXT = 1, B_BACK, B_INSTALL, B_FINISH, B_CANCEL, B_BROWSE, B_UNINSTALL };

static inline Color C(int a, int r, int g, int b) { return Color(a, r, g, b); }
static inline RectF RF(const RECT& r) { return RectF((REAL)r.left, (REAL)r.top, (REAL)(r.right - r.left), (REAL)(r.bottom - r.top)); }

static void roundRect(GraphicsPath& p, REAL x, REAL y, REAL w, REAL h, REAL r) {
    REAL d = r * 2;
    p.AddArc(x, y, d, d, 180, 90);
    p.AddArc(x + w - d, y, d, d, 270, 90);
    p.AddArc(x + w - d, y + h - d, d, d, 0, 90);
    p.AddArc(x, y + h - d, d, d, 90, 90);
    p.CloseFigure();
}

static void fillRound(Graphics& g, const RectF& r, REAL rad, const Brush& b) {
    GraphicsPath p; roundRect(p, r.X, r.Y, r.Width, r.Height, rad); g.FillPath(&b, &p);
}
static void strokeRound(Graphics& g, const RectF& r, REAL rad, const Pen& pen) {
    GraphicsPath p; roundRect(p, r.X + 0.5f, r.Y + 0.5f, r.Width - 1, r.Height - 1, rad); g.DrawPath(&pen, &p);
}

static void text(Graphics& g, const wchar_t* s, REAL size, bool semi, const Color& col, RectF box,
                 StringAlignment h = StringAlignment::StringAlignmentNear, StringAlignment v = StringAlignment::StringAlignmentNear) {
    FontFamily* fam = semi ? g_famSemi : g_famRegular;
    FontFamily fallback(L"Segoe UI");
    Font font(fam ? fam : &fallback, size, FontStyleRegular, UnitPixel);
    StringFormat fmt;
    fmt.SetAlignment(h); fmt.SetLineAlignment(v);
    SolidBrush br(col);
    g.DrawString(s, -1, &font, box, &fmt, &br);
}

static bool inRect(const RECT& r, int x, int y) { return x >= r.left && x < r.right && y >= r.top && y < r.bottom; }

static void layoutButtons();

static void drawGlow(Graphics& g, REAL cx, REAL cy, REAL rx, REAL ry, const Color& col) {
    GraphicsPath path; path.AddEllipse(cx - rx, cy - ry, rx * 2, ry * 2);
    PathGradientBrush br(&path);
    br.SetCenterColor(col);
    Color edge(0, col.GetR(), col.GetG(), col.GetB());
    int n = 1; br.SetSurroundColors(&edge, &n);
    g.FillPath(&br, &path);
}

static void paint(HDC hdc) {
    HDC mem = CreateCompatibleDC(hdc);
    HBITMAP bmp = CreateCompatibleBitmap(hdc, (int)(W * g_s), (int)(H * g_s));
    HGDIOBJ old = SelectObject(mem, bmp);
    {
        Graphics g(mem);
        g.ScaleTransform(g_s, g_s);
        g.SetSmoothingMode(SmoothingModeAntiAlias);
        g.SetTextRenderingHint(TextRenderingHintAntiAliasGridFit);
        g.SetInterpolationMode(InterpolationModeHighQualityBicubic);

        // pozadí + záře
        SolidBrush bg(C(255, 6, 6, 9)); g.FillRectangle(&bg, 0, 0, W, H);
        GraphicsPath clip; clip.AddRectangle(Rect(0, 0, W, H));
        g.SetClip(&clip);
        drawGlow(g, 120, 60, 330, 260, C(110, 10, 132, 255));
        drawGlow(g, W - 60, H - 40, 360, 260, C(80, 120, 70, 230));

        // levý panel
        SolidBrush side(C(255, 255, 255, 255)); (void)side;
        LinearGradientBrush sideBr(Point(0, 0), Point(SIDE, 0), C(34, 255, 255, 255), C(10, 255, 255, 255));
        g.FillRectangle(&sideBr, 0, 0, SIDE, H);
        Pen sideLine(C(30, 255, 255, 255)); g.DrawLine(&sideLine, SIDE, 0, SIDE, H);
        if (g_icon) { Bitmap* ico = Bitmap::FromHICON(g_icon); if (ico) { g.DrawImage(ico, RectF(SIDE / 2 - 44, 70, 88, 88)); delete ico; } }
        text(g, L"Lumen", 30, true, C(255, 255, 255, 255), RectF(0, 170, SIDE, 42), StringAlignmentCenter);
        text(g, (std::wstring(S->version) + L" " + APP_VERSION).c_str(), 13, false, C(150, 255, 255, 255), RectF(0, 212, SIDE, 20), StringAlignmentCenter);
        text(g, S->author, 11, false, C(110, 255, 255, 255), RectF(0, H - 104, SIDE, 16), StringAlignmentCenter);
        text(g, APP_AUTHOR, 13, true, C(235, 255, 255, 255), RectF(0, H - 86, SIDE, 20), StringAlignmentCenter);
        text(g, (std::wstring(L"@") + APP_AUTHOR_HANDLE).c_str(), 12, false, C(255, 10, 132, 255), RectF(0, H - 64, SIDE, 18), StringAlignmentCenter);
        for (int k = 0; k < 2; k++) {
            const RECT& lr = k == 0 ? g_linkGh : g_linkIg;
            if (lr.right <= lr.left) continue;
            fillRound(g, RF(lr), 13, SolidBrush(C(g_hover == 101 + k ? 60 : 30, 255, 255, 255)));
            strokeRound(g, RF(lr), 13, Pen(C(60, 255, 255, 255)));
            text(g, k == 0 ? L"GitHub" : L"Instagram", 12, true, C(255, 235, 235, 245), RF(lr), StringAlignmentCenter, StringAlignmentCenter);
        }

        g_btns.clear(); g_chks.clear();
        layoutButtons();

        const int X0 = SIDE + 40, CW = W - SIDE - 80;
        auto title = [&](const wchar_t* t, const wchar_t* sub) {
            text(g, t, 28, true, C(250, 255, 255, 255), RectF((REAL)X0, 70, (REAL)CW, 40));
            text(g, sub, 14, false, C(165, 255, 255, 255), RectF((REAL)X0, 112, (REAL)CW, 44));
        };

        switch (g_page) {
        case P_WELCOME: {
            title(S->welcomeTitle, S->welcomeSub);
            const wchar_t* f[3] = { S->feat1, S->feat2, S->feat3 };
            for (int i = 0; i < 3; i++) {
                REAL y = 178.f + i * 52;
                fillRound(g, RectF((REAL)X0, y, (REAL)CW, 42), 14, SolidBrush(C(20, 255, 255, 255)));
                strokeRound(g, RectF((REAL)X0, y, (REAL)CW, 42), 14, Pen(C(30, 255, 255, 255)));
                SolidBrush dot(C(255, 10, 132, 255)); g.FillEllipse(&dot, (REAL)X0 + 16, y + 16, 10.f, 10.f);
                text(g, f[i], 14, false, C(235, 255, 255, 255), RectF((REAL)X0 + 38, y, (REAL)CW - 48, 42), StringAlignmentNear, StringAlignmentCenter);
            }
            break;
        }
        case P_LOCATION: {
            title(S->locTitle, S->locSub);
            RECT pb = g_pathBox;
            fillRound(g, RF(pb), 12, SolidBrush(C(40, 255, 255, 255)));
            strokeRound(g, RF(pb), 12, Pen(C(60, 255, 255, 255)));
            text(g, S->space, 12, false, C(120, 255, 255, 255), RectF((REAL)X0, (REAL)pb.bottom + 8, (REAL)CW, 18));
            break;
        }
        case P_INSTALLING: {
            title(S->instTitle, S->instSub);
            RectF bar((REAL)X0, 190, (REAL)CW, 10);
            fillRound(g, bar, 5, SolidBrush(C(36, 255, 255, 255)));
            REAL seg = bar.Width * 0.34f, pos = (bar.Width + seg) * g_anim - seg;
            REAL x1 = std::max(0.f, pos), x2 = std::min(bar.Width, pos + seg);
            if (x2 > x1) {
                GraphicsPath p; roundRect(p, bar.X + x1, bar.Y, x2 - x1, bar.Height, 5);
                LinearGradientBrush lb(PointF(bar.X + x1, 0), PointF(bar.X + x2 + 1, 0), C(255, 10, 132, 255), C(255, 120, 120, 255));
                g.FillPath(&lb, &p);
            }
            break;
        }
        case P_DONE: title(S->doneTitle, S->doneSub); break;
        case P_FAILED: title(S->failedTitle, S->failedSub); break;
        case P_UCONFIRM: title(S->uTitle, S->uSub); break;
        case P_UDONE: title(S->uDoneTitle, S->uDoneSub); break;
        }

        // zaškrtávátka
        for (auto& c : g_chks) {
            RectF box((REAL)c.r.left, (REAL)c.r.top + 3, 20, 20);
            if (*c.val) {
                fillRound(g, box, 6, SolidBrush(C(255, 10, 132, 255)));
                Pen tick(C(255, 255, 255, 255), 2.2f); tick.SetStartCap(LineCapRound); tick.SetEndCap(LineCapRound);
                g.DrawLines(&tick, std::vector<PointF>{ { box.X + 5, box.Y + 10.5f }, { box.X + 8.6f, box.Y + 14 }, { box.X + 15, box.Y + 6 } }.data(), 3);
            } else {
                fillRound(g, box, 6, SolidBrush(C(30, 255, 255, 255)));
                strokeRound(g, box, 6, Pen(C(80, 255, 255, 255)));
            }
            text(g, c.label.c_str(), 14, false, C(235, 255, 255, 255), RectF((REAL)c.r.left + 32, (REAL)c.r.top, (REAL)(c.r.right - c.r.left - 32), 26), StringAlignmentNear, StringAlignmentCenter);
        }

        // tlačítka
        for (size_t i = 0; i < g_btns.size(); i++) {
            auto& b = g_btns[i];
            bool hot = (int)i == g_hover;
            RectF r = RF(b.r);
            if (b.primary) {
                fillRound(g, r, r.Height / 2, SolidBrush(hot ? C(255, 50, 150, 255) : C(255, 10, 132, 255)));
            } else {
                fillRound(g, r, r.Height / 2, SolidBrush(C(hot ? 52 : 32, 255, 255, 255)));
                strokeRound(g, r, r.Height / 2, Pen(C(60, 255, 255, 255)));
            }
            text(g, b.label.c_str(), 14, true, C(255, 255, 255, 255), r, StringAlignmentCenter, StringAlignmentCenter);
        }

        // jazyk + zavřít
        if (g_page == P_WELCOME || g_page == P_LOCATION || g_page == P_UCONFIRM) {
            RectF pill((REAL)g_langCs.left, (REAL)g_langCs.top, (REAL)(g_langEn.right - g_langCs.left), (REAL)(g_langCs.bottom - g_langCs.top));
            fillRound(g, pill, pill.Height / 2, SolidBrush(C(30, 255, 255, 255)));
            RECT act = g_czech ? g_langCs : g_langEn;
            fillRound(g, RF(act), (act.bottom - act.top) / 2.f, SolidBrush(C(255, 10, 132, 255)));
            text(g, L"CZ", 12, true, C(255, 255, 255, 255), RF(g_langCs), StringAlignmentCenter, StringAlignmentCenter);
            text(g, L"EN", 12, true, C(255, 255, 255, 255), RF(g_langEn), StringAlignmentCenter, StringAlignmentCenter);
        }
        if (g_page != P_INSTALLING) {
            Pen x(C(g_hover == 100 ? 255 : 150, 255, 255, 255), 1.8f);
            REAL cx = (g_close.left + g_close.right) / 2.f, cy = (g_close.top + g_close.bottom) / 2.f;
            g.DrawLine(&x, cx - 5, cy - 5, cx + 5, cy + 5); g.DrawLine(&x, cx - 5, cy + 5, cx + 5, cy - 5);
        }
        Pen border(C(70, 255, 255, 255)); g.DrawRectangle(&border, 0, 0, W - 1, H - 1);
    }
    BitBlt(hdc, 0, 0, (int)(W * g_s), (int)(H * g_s), mem, 0, 0, SRCCOPY);
    SelectObject(mem, old); DeleteObject(bmp); DeleteDC(mem);
}

static void addBtn(int id, const std::wstring& label, bool primary, int x, int y, int w) {
    g_btns.push_back({ { x, y, x + w, y + 40 }, id, label, primary });
}

static void layoutLinks() {
    if (APP_INSTAGRAM_URL[0]) { g_linkGh = { 16, H - 38, 112, H - 12 }; g_linkIg = { 124, H - 38, 220, H - 12 }; }
    else { g_linkGh = { SIDE / 2 - 48, H - 38, SIDE / 2 + 48, H - 12 }; g_linkIg = { 0, 0, 0, 0 }; }
}

static void layoutButtons() {
    const int X0 = SIDE + 40, CW = W - SIDE - 80, RIGHT = X0 + CW, BY = H - 76;
    g_langEn = { W - 70, 22, W - 70 + 40, 22 + 28 };
    g_langCs = { W - 70 - 42, 22, W - 70 - 2, 22 + 28 };
    g_close = { W - 36, 22, W - 8, 50 };

    g_pathBox = { X0, 190, RIGHT - 130, 190 + 44 };

    switch (g_page) {
    case P_WELCOME:
        addBtn(B_NEXT, S->next, true, RIGHT - 150, BY, 150);
        break;
    case P_LOCATION:
        addBtn(B_BROWSE, S->browse, false, RIGHT - 118, 190, 118);
        g_btns.back().r.bottom = 190 + 44;
        g_chks.push_back({ { X0, 290, RIGHT, 316 }, &g_optDesktop, S->deskLnk });
        g_chks.push_back({ { X0, 324, RIGHT, 350 }, &g_optStart, S->startLnk });
        addBtn(B_BACK, S->back, false, X0, BY, 110);
        addBtn(B_INSTALL, S->install, true, RIGHT - 150, BY, 150);
        break;
    case P_DONE:
        g_chks.push_back({ { X0, 190, RIGHT, 216 }, &g_optLaunch, S->launch });
        addBtn(B_FINISH, S->finish, true, RIGHT - 150, BY, 150);
        break;
    case P_FAILED:
        addBtn(B_BACK, S->back, false, X0, BY, 110);
        addBtn(B_CANCEL, S->finish, true, RIGHT - 150, BY, 150);
        break;
    case P_UCONFIRM:
        g_chks.push_back({ { X0, 190, RIGHT, 240 }, &g_optDeleteData, S->uData });
        addBtn(B_CANCEL, S->cancel, false, X0, BY, 110);
        addBtn(B_UNINSTALL, S->uninstall, true, RIGHT - 170, BY, 170);
        break;
    case P_UDONE:
        addBtn(B_FINISH, S->finish, true, RIGHT - 150, BY, 150);
        break;
    default: break;
    }
}

static void updateEdit() {
    if (!g_edit) return;
    bool show = g_page == P_LOCATION;
    ShowWindow(g_edit, show ? SW_SHOW : SW_HIDE);
    if (show) {
        layoutButtons();
        MoveWindow(g_edit, (int)((g_pathBox.left + 14) * g_s), (int)((g_pathBox.top + 12) * g_s), (int)((g_pathBox.right - g_pathBox.left - 28) * g_s), (int)(22 * g_s), TRUE);
    }
}

static void gotoPage(Page p) {
    g_page = p; g_hover = -1;
    g_btns.clear(); g_chks.clear();
    updateEdit();
    if (g_hwnd) InvalidateRect(g_hwnd, nullptr, FALSE);
}

static void setLanguage(bool czech) {
    g_czech = czech;
    S = czech ? &CS : &EN;
    InvalidateRect(g_hwnd, nullptr, FALSE);
}

static void readPath() {
    wchar_t buf[1024]; GetWindowTextW(g_edit, buf, 1024);
    std::wstring p = buf;
    if (!p.empty()) g_installDir = normalizeInstallDir(p);
}

static void browse() {
    IFileOpenDialog* dlg = nullptr;
    if (FAILED(CoCreateInstance(CLSID_FileOpenDialog, nullptr, CLSCTX_INPROC_SERVER, IID_PPV_ARGS(&dlg)))) return;
    DWORD opts = 0; dlg->GetOptions(&opts); dlg->SetOptions(opts | FOS_PICKFOLDERS | FOS_FORCEFILESYSTEM);
    dlg->SetTitle(S->pickFolder);
    if (SUCCEEDED(dlg->Show(g_hwnd))) {
        IShellItem* it = nullptr;
        if (SUCCEEDED(dlg->GetResult(&it))) {
            PWSTR path = nullptr;
            if (SUCCEEDED(it->GetDisplayName(SIGDN_FILESYSPATH, &path)) && path) {
                SetWindowTextW(g_edit, normalizeInstallDir(path).c_str());
                CoTaskMemFree(path);
            }
            it->Release();
        }
    }
    dlg->Release();
}

static void startInstall() {
    readPath();
    gotoPage(P_INSTALLING);
    g_anim = 0;
    SetTimer(g_hwnd, TIMER_ANIM, 16, nullptr);
    g_worker = std::thread([] {
        CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED);
        g_installOk = doInstall();
        CoUninitialize();
        PostMessageW(g_hwnd, WM_INSTALL_DONE, 0, 0);
    });
}

static void onButton(int id) {
    switch (id) {
    case B_NEXT: gotoPage(P_LOCATION); break;
    case B_BACK: gotoPage(g_page == P_FAILED ? P_LOCATION : P_WELCOME); break;
    case B_BROWSE: browse(); break;
    case B_INSTALL: startInstall(); break;
    case B_FINISH:
        if (g_page == P_DONE && g_optLaunch && !g_noShortcuts)
            ShellExecuteW(nullptr, L"open", (g_installDir + L"\\Lumen.exe").c_str(), nullptr, g_installDir.c_str(), SW_SHOWNORMAL);
        DestroyWindow(g_hwnd);
        break;
    case B_CANCEL: DestroyWindow(g_hwnd); break;
    case B_UNINSTALL:
        doUninstall(g_optDeleteData);
        gotoPage(P_UDONE);
        break;
    }
}

static int hitTest(int x, int y) {
    if (g_page != P_INSTALLING && inRect(g_close, x, y)) return 100;
    if (inRect(g_linkGh, x, y)) return 101;
    if (g_linkIg.right > g_linkIg.left && inRect(g_linkIg, x, y)) return 102;
    for (size_t i = 0; i < g_btns.size(); i++) if (inRect(g_btns[i].r, x, y)) return (int)i;
    return -1;
}

static LRESULT CALLBACK wndProc(HWND hwnd, UINT msg, WPARAM wp, LPARAM lp) {
    switch (msg) {
    case WM_ERASEBKGND: return 1;
    case WM_PAINT: { PAINTSTRUCT ps; HDC dc = BeginPaint(hwnd, &ps); paint(dc); EndPaint(hwnd, &ps); return 0; }
    case WM_TIMER:
        if (wp == TIMER_ANIM) { g_anim += 0.012f; if (g_anim > 1.f) g_anim = 0; InvalidateRect(hwnd, nullptr, FALSE); }
        return 0;
    case WM_MOUSEMOVE: {
        int h = hitTest((int)(GET_X_LPARAM(lp) / g_s), (int)(GET_Y_LPARAM(lp) / g_s));
        if (h != g_hover) { g_hover = h; InvalidateRect(hwnd, nullptr, FALSE); }
        TRACKMOUSEEVENT t{ sizeof t, TME_LEAVE, hwnd, 0 }; TrackMouseEvent(&t);
        return 0;
    }
    case WM_MOUSELEAVE: if (g_hover != -1) { g_hover = -1; InvalidateRect(hwnd, nullptr, FALSE); } return 0;
    case WM_SETCURSOR: {
        POINT pt; GetCursorPos(&pt); ScreenToClient(hwnd, &pt); pt.x = (LONG)(pt.x / g_s); pt.y = (LONG)(pt.y / g_s);
        bool hand = hitTest(pt.x, pt.y) != -1 || inRect(g_langCs, pt.x, pt.y) || inRect(g_langEn, pt.x, pt.y);
        for (auto& c : g_chks) if (inRect(c.r, pt.x, pt.y)) hand = true;
        if (LOWORD(lp) == HTCLIENT) { SetCursor(LoadCursorW(nullptr, hand ? IDC_HAND : IDC_ARROW)); return TRUE; }
        break;
    }
    case WM_LBUTTONDOWN: {
        int x = (int)(GET_X_LPARAM(lp) / g_s), y = (int)(GET_Y_LPARAM(lp) / g_s);
        int h = hitTest(x, y);
        if (h == 100) { if (g_page != P_INSTALLING) DestroyWindow(hwnd); return 0; }
        if (h == 101) { ShellExecuteW(nullptr, L"open", APP_URL, nullptr, nullptr, SW_SHOWNORMAL); return 0; }
        if (h == 102) { ShellExecuteW(nullptr, L"open", APP_INSTAGRAM_URL, nullptr, nullptr, SW_SHOWNORMAL); return 0; }
        if (h >= 0) { onButton(g_btns[h].id); return 0; }
        for (auto& c : g_chks) if (inRect(c.r, x, y)) { *c.val = !*c.val; InvalidateRect(hwnd, nullptr, FALSE); return 0; }
        if (g_page == P_WELCOME || g_page == P_LOCATION || g_page == P_UCONFIRM) {
            if (inRect(g_langCs, x, y)) { setLanguage(true); return 0; }
            if (inRect(g_langEn, x, y)) { setLanguage(false); return 0; }
        }
        if (y < 64) { ReleaseCapture(); SendMessageW(hwnd, WM_NCLBUTTONDOWN, HTCAPTION, 0); }
        return 0;
    }
    case WM_CTLCOLOREDIT: {
        HDC dc = (HDC)wp;
        SetTextColor(dc, RGB(240, 240, 245)); SetBkColor(dc, RGB(38, 40, 52));
        return (LRESULT)g_editBrush;
    }
    case WM_INSTALL_DONE:
        KillTimer(hwnd, TIMER_ANIM);
        if (g_worker.joinable()) g_worker.join();
        gotoPage(g_installOk ? P_DONE : P_FAILED);
        return 0;
    case WM_CLOSE: if (g_page == P_INSTALLING) return 0; DestroyWindow(hwnd); return 0;
    case WM_DESTROY: PostQuitMessage(0); return 0;
    }
    return DefWindowProcW(hwnd, msg, wp, lp);
}

static void loadFonts() {
    g_fonts = new PrivateFontCollection();
    for (int id : { 102, 103 }) {
        HRSRC r = FindResourceW(nullptr, MAKEINTRESOURCEW(id), RT_RCDATA);
        if (!r) continue;
        HGLOBAL m = LoadResource(nullptr, r);
        void* data = m ? LockResource(m) : nullptr;
        DWORD size = SizeofResource(nullptr, r);
        if (!data) continue;
        g_fonts->AddMemoryFont(data, size);
        DWORD n = 0; AddFontMemResourceEx(data, size, nullptr, &n);   // pro textové pole (GDI)
    }
    int count = g_fonts->GetFamilyCount(), found = 0;
    if (count > 0) {
        std::vector<FontFamily> fams(count);
        g_fonts->GetFamilies(count, fams.data(), &found);
        for (int i = 0; i < found; i++) {
            WCHAR name[LF_FACESIZE]; fams[i].GetFamilyName(name);
            if (wcsstr(name, L"Semi") && !g_famSemi) g_famSemi = fams[i].Clone();
            else if (!g_famRegular) g_famRegular = fams[i].Clone();
        }
        if (!g_famSemi) g_famSemi = g_famRegular ? g_famRegular->Clone() : nullptr;
    }
}

static void runWizard(HINSTANCE inst) {
    GdiplusStartupInput gsi; GdiplusStartup(&g_gdiplusToken, &gsi, nullptr);
    INITCOMMONCONTROLSEX icc{ sizeof icc, ICC_STANDARD_CLASSES }; InitCommonControlsEx(&icc);
    loadFonts();
    layoutLinks();
    g_icon = (HICON)LoadImageW(inst, MAKEINTRESOURCEW(1), IMAGE_ICON, 256, 256, 0);

    WNDCLASSW wc{};
    wc.lpfnWndProc = wndProc; wc.hInstance = inst; wc.lpszClassName = L"LumenSetup";
    wc.hIcon = LoadIconW(inst, MAKEINTRESOURCEW(1));
    wc.hCursor = LoadCursorW(nullptr, IDC_ARROW);
    RegisterClassW(&wc);

    int x = (GetSystemMetrics(SM_CXSCREEN) - (int)(W * g_s)) / 2, y = (GetSystemMetrics(SM_CYSCREEN) - (int)(H * g_s)) / 2;
    g_hwnd = CreateWindowExW(WS_EX_APPWINDOW, L"LumenSetup", g_uninstallMode ? L"Lumen – Uninstall" : L"Lumen Setup", WS_POPUP | WS_MINIMIZEBOX | WS_SYSMENU,
                             x, y, (int)(W * g_s), (int)(H * g_s), nullptr, nullptr, inst, nullptr);
    DWORD pref = 2; DwmSetWindowAttribute(g_hwnd, 33, &pref, sizeof pref);   // zaoblené rohy (Win 11)
    BOOL dark = TRUE; DwmSetWindowAttribute(g_hwnd, 20, &dark, sizeof dark);

    g_editFont = CreateFontW((int)(-15 * g_s), 0, 0, 0, FW_NORMAL, FALSE, FALSE, FALSE, DEFAULT_CHARSET, 0, 0, CLEARTYPE_QUALITY, 0, L"Inter");
    g_editBrush = CreateSolidBrush(RGB(38, 40, 52));
    g_edit = CreateWindowExW(0, L"EDIT", g_installDir.c_str(), WS_CHILD | ES_AUTOHSCROLL, 0, 0, 10, 10, g_hwnd, nullptr, inst, nullptr);
    SendMessageW(g_edit, WM_SETFONT, (WPARAM)g_editFont, TRUE);

    gotoPage(g_uninstallMode ? P_UCONFIRM : P_WELCOME);
    ShowWindow(g_hwnd, SW_SHOW);
    SetForegroundWindow(g_hwnd);
    MSG m;
    while (GetMessageW(&m, nullptr, 0, 0) > 0) { TranslateMessage(&m); DispatchMessageW(&m); }
    if (g_worker.joinable()) g_worker.join();
    GdiplusShutdown(g_gdiplusToken);
}

int WINAPI wWinMain(HINSTANCE inst, HINSTANCE, PWSTR cmdline, int) {
    SetProcessDPIAware();
    { HDC d = GetDC(nullptr); g_s = GetDeviceCaps(d, LOGPIXELSX) / 96.f; ReleaseDC(nullptr, d); }
    CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED);
    g_czech = true;   // česky je výchozí, jazyk jde přepnout v okně
    S = g_czech ? &CS : &EN;

    std::wstring args = cmdline ? cmdline : L"";
    auto has = [&](const wchar_t* flag) { return StrStrIW(args.c_str(), flag) != nullptr; };
    g_silent = StrStrIW((L" " + args + L" ").c_str(), L" /S ") != nullptr;
    g_noShortcuts = has(L"/NOSHORTCUTS");
    g_keepData = has(L"/KEEPDATA");
    g_uninstallMode = has(L"/uninstall");
    g_updateMode = has(L"/UPDATE");
    if (g_updateMode) { g_silent = true; g_optDesktop = false; g_optStart = false; }   // existující zástupci zůstanou, jak jsou

    g_installDir = knownFolder(FOLDERID_LocalAppData) + L"\\Programs\\Lumen";
    if (const wchar_t* d = StrStrIW(args.c_str(), L"/D=")) {
        std::wstring v = d + 3;
        if (!v.empty() && v[0] == L'"') { v = v.substr(1); size_t q = v.find(L'"'); if (q != std::wstring::npos) v = v.substr(0, q); }
        else { size_t sp = v.find(L' '); if (sp != std::wstring::npos) v = v.substr(0, sp); }
        if (!v.empty()) g_installDir = normalizeInstallDir(v);
    }

    if (g_uninstallMode) {
        // Odinstalátor běží z instalační složky; složku bere z umístění tohoto exe.
        if (!has(L"/D=")) { std::wstring me = selfPath(); g_installDir = me.substr(0, me.find_last_of(L'\\')); }
        if (g_silent) { doUninstall(false); }
        else { g_optDeleteData = false; runWizard(inst); }
        if (!g_pendingCleanup.empty()) runHidden(g_pendingCleanup, false);
        return 0;
    }

    if (g_silent) {
        bool ok = doInstall();
        if (ok && g_updateMode) ShellExecuteW(nullptr, L"open", (g_installDir + L"\\Lumen.exe").c_str(), nullptr, g_installDir.c_str(), SW_SHOWNORMAL);
        return ok ? 0 : 1;
    }
    runWizard(inst);
    return 0;
}
