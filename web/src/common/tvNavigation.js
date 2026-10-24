// Lumen: ovládání dálkovým ovladačem televize (šipky, OK, Zpět).
// Zapíná se jen v obalu pro Android TV (window.__lumenTV) nebo pro zkoušení v prohlížeči přes localStorage 'lumen.tv' = '1'.
// Šipky přesouvají zvýraznění na nejbližší ovládací prvek v daném směru, OK ho stiskne, Zpět zavře nabídku nebo jde o krok zpět
// (obal volá window.__lumenBack(); když vrátí false, aplikace se ukončí).

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const NATIVE_ENTER = ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'SUMMARY'];
const TEXT_INPUT_TYPES = ['text', 'search', 'email', 'url', 'password', 'number', 'tel', ''];
const DIRECTIONS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
const TOP_LEVEL_ROUTES = ['#/discover', '#/library', '#/addons', '#/settings', '#/search', '#/help'];

const isEnabled = () => {
    if (typeof window === 'undefined') return false;
    if (window.__lumenTV === true) return true;
    try {
        return window.localStorage.getItem('lumen.tv') === '1';
    } catch (_) {
        return false;
    }
};

const isVisible = (el) => {
    if (!(el instanceof HTMLElement)) return false;
    if (typeof el.checkVisibility === 'function' && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 1 && rect.height > 1;
};

const isTextInput = (el) => (
    el instanceof HTMLTextAreaElement ||
    (el instanceof HTMLInputElement && TEXT_INPUT_TYPES.includes((el.getAttribute('type') || '').toLowerCase()))
);

const isPlayer = () => window.location.hash.startsWith('#/player');

// rozbalená nabídka výběru (MultiselectMenu bez portálu) – zavírá se jen kliknutím mimo
const openDropdown = () => {
    const multiselect = Array.from(document.querySelectorAll('[class*="multiselect-menu"][class*="active"]')).filter(isVisible).pop();
    if (multiselect) return multiselect;
    // menu profilu vpravo nahoře (nabídka je vykreslená uvnitř tlačítka)
    return Array.from(document.querySelectorAll('[class*="menu-button-container"].active')).filter(isVisible).pop() || null;
};

// nejvyšší otevřená vrstva (dialog), mimo kterou se nemá zvýraznění dostat
const activeScope = () => {
    const dropdown = openDropdown();
    if (dropdown) return dropdown;
    // nabídky přehrávače (titulky, zvuk, rychlost, díly)
    // nabídka se objevuje animací průhlednosti, proto se průhlednost nekontroluje;
    // zavírající se nabídka (fade-exit) ještě chvíli zůstává ve stránce, ale už se nepočítá
    const playerMenu = Array.from(document.querySelectorAll('[class*="menu-layer"], [class*="side-drawer-layer"]'))
        .filter((el) => !/fade-exit/.test(el.className) && el.getBoundingClientRect().width > 1 &&
            (typeof el.checkVisibility !== 'function' || el.checkVisibility({ checkVisibilityCSS: true }))).pop();
    if (playerMenu) return playerMenu;
    const modals = Array.from(document.querySelectorAll('.modals-container')).filter((m) => m.children.length > 0);
    if (modals.length > 0) return modals[modals.length - 1];
    const dialogs = Array.from(document.querySelectorAll('[role="dialog"], [aria-modal="true"]')).filter(isVisible);
    if (dialogs.length > 0) return dialogs[dialogs.length - 1];
    return document.body;
};

const overlayOpen = () => activeScope() !== document.body;

// tlačítka přehrávače mají tabIndex -1 (myš a klávesové zkratky), ovladačem na ně ale musí jít najet
const PLAYER_FOCUSABLE = ['control-bar', 'nav-bar-layer', 'menu-layer', 'side-drawer-layer']
    .map((name) => `[class*="${name}"] [tabindex="-1"]:not(input)`).join(', ');

const candidates = (scope) => Array.from(scope.querySelectorAll(isPlayer() ? `${FOCUSABLE}, ${PLAYER_FOCUSABLE}` : FOCUSABLE)).filter((el) => (
    isVisible(el) && !el.closest('[aria-hidden="true"], [inert]') && !el.hasAttribute('data-focus-guard')
));

const focusElement = (el) => {
    el.focus({ preventScroll: true });
    try {
        el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    } catch (_) {
        el.scrollIntoView(false);
    }
};

// první prvek vlevo nahoře ve viditelné části obrazovky
const focusFirst = (scope) => {
    const list = candidates(scope).filter((el) => {
        const r = el.getBoundingClientRect();
        return r.bottom > 0 && r.right > 0 && r.top < window.innerHeight && r.left < window.innerWidth;
    });
    if (list.length === 0) return false;
    list.sort((a, b) => {
        const ra = a.getBoundingClientRect();
        const rb = b.getBoundingClientRect();
        return (ra.top + ra.left * 0.5) - (rb.top + rb.left * 0.5);
    });
    focusElement(list[0]);
    return true;
};

// vzdálenost v daném směru; null = prvek není v tom směru
const score = (from, to, dir) => {
    const fcx = from.left + from.width / 2;
    const fcy = from.top + from.height / 2;
    const tcx = to.left + to.width / 2;
    const tcy = to.top + to.height / 2;
    let primary;
    let gap;
    let offset;
    if (dir === 'down' || dir === 'up') {
        if (dir === 'down' ? tcy <= fcy + 1 : tcy >= fcy - 1) return null;
        primary = dir === 'down' ? to.top - from.bottom : from.top - to.bottom;
        gap = Math.max(0, Math.max(from.left, to.left) - Math.min(from.right, to.right));
        offset = Math.abs(tcx - fcx);
    } else {
        if (dir === 'right' ? tcx <= fcx + 1 : tcx >= fcx - 1) return null;
        primary = dir === 'right' ? to.left - from.right : from.left - to.right;
        gap = Math.max(0, Math.max(from.top, to.top) - Math.min(from.bottom, to.bottom));
        offset = Math.abs(tcy - fcy);
    }
    // prvek mimo řádek/sloupec musí ležet celý za aktuálním prvkem (jinak by šipka dolů skočila na sousední položku o kousek níž)
    if (gap > 0 && primary < -4) return null;
    // překrývající se prvky (záporná vzdálenost) bereme jako sousední; prvek mimo řádek/sloupec má velkou přirážku,
    // mezi překrývajícími se vyhrává ten, který je víc naproti
    return Math.max(primary, 0) + (gap > 0 ? gap * 3 + 200 : 0) + offset * 0.3;
};

const move = (dir) => {
    const scope = activeScope();
    const current = document.activeElement;
    if (!(current instanceof HTMLElement) || current === document.body || !scope.contains(current) || !isVisible(current)) {
        return focusFirst(scope);
    }
    const from = current.getBoundingClientRect();
    let best = null;
    let bestScore = Infinity;
    candidates(scope).forEach((el) => {
        if (el === current || el.contains(current) || current.contains(el)) return;
        const s = score(from, el.getBoundingClientRect(), dir);
        if (s !== null && s < bestScore) {
            bestScore = s;
            best = el;
        }
    });
    if (best) {
        focusElement(best);
        return true;
    }
    return false;
};

// přehrávač: ukázat ovládací lištu (skrývá se po chvíli bez pohybu myši)
const wakePlayer = () => {
    const target = document.querySelector('[class*="player-container"]') || document.body;
    const rect = target.getBoundingClientRect();
    target.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 }));
};

const pressSpace = () => {
    const init = { key: ' ', code: 'Space', keyCode: 32, which: 32, bubbles: true };
    window.dispatchEvent(new KeyboardEvent('keydown', init));
    window.dispatchEvent(new KeyboardEvent('keyup', init));
};

const pressEscape = () => {
    const init = { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true, cancelable: true };
    const target = document.activeElement instanceof HTMLElement ? document.activeElement : document.body;
    target.dispatchEvent(new KeyboardEvent('keydown', init));
    target.dispatchEvent(new KeyboardEvent('keyup', init));
};

const playerControlsFocused = () => {
    const el = document.activeElement;
    return el instanceof HTMLElement && el !== document.body && isVisible(el);
};

const onKeyDown = (event) => {
    if (event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey) return;
    const dir = DIRECTIONS[event.key];
    const active = document.activeElement;

    if (isTextInput(active)) {
        if (dir === 'left' || dir === 'right') {
            // v textovém poli šipky posouvají kurzor; až na kraji textu se přejde na další prvek
            const atStart = active.selectionStart === 0 && active.selectionEnd === 0;
            const atEnd = active.selectionStart === active.value.length;
            if (active.type === 'number' || (dir === 'left' && !atStart) || (dir === 'right' && !atEnd)) return;
        }
        if (!dir) return;
    }
    // posuvník (např. přiblížení rozhraní): vlevo/vpravo mění hodnotu
    if (active instanceof HTMLInputElement && active.type === 'range' && (dir === 'left' || dir === 'right')) return;

    if (isPlayer() && !overlayOpen()) {
        wakePlayer();
        if (!playerControlsFocused()) {
            // bez zvýraznění: vlevo/vpravo přetáčí, nahoru/dolů vstoupí do ovládací lišty, OK = pauza
            if (dir === 'left' || dir === 'right') return;
            if (dir === 'up' || dir === 'down') {
                event.preventDefault();
                event.stopPropagation();
                // lišta se po probuzení teprve objevuje (průhlednost 0 → 1), takže se zkouší znovu, dokud není vidět
                const focusBar = (attempt) => {
                    const bar = document.querySelector('[class*="control-bar-container"]') || document.body;
                    if (!focusFirst(bar) && attempt < 5) setTimeout(() => focusBar(attempt + 1), 120);
                };
                requestAnimationFrame(() => focusBar(0));
                return;
            }
            if (event.key === 'Enter') {
                event.preventDefault();
                event.stopPropagation();
                pressSpace();
                return;
            }
            return;
        }
    }

    if (dir) {
        event.preventDefault();
        event.stopPropagation();
        move(dir);
    }
};

// OK na prvku, který Enter sám neobslouží (div s onClick a tabindex) → klik
const onKeyDownLate = (event) => {
    if (event.key !== 'Enter' || event.defaultPrevented) return;
    const el = document.activeElement;
    if (!(el instanceof HTMLElement) || el === document.body || NATIVE_ENTER.includes(el.tagName)) return;
    event.preventDefault();
    el.click();
};

// Zpět na ovladači. Vrací true, když se něco stalo (jinak obal aplikaci ukončí).
const back = () => {
    const active = document.activeElement;
    if (isTextInput(active)) {
        active.blur();
        return true;
    }
    const dropdown = openDropdown();
    if (dropdown) {
        // rozbalovací výběr se zavírá na mouseup mimo, menu profilu (Popup) na mousedown mimo
        document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        document.body.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        const label = dropdown.matches(FOCUSABLE) ? dropdown : dropdown.querySelector(FOCUSABLE);
        if (label) focusElement(label);
        return true;
    }
    // nabídka přehrávače: Escape by zavřel i přehrávač, nabídky se zavírají klikem do přehrávače
    const scope = activeScope();
    if (isPlayer() && /menu-layer|side-drawer-layer/.test(scope.className)) {
        const container = document.querySelector('[class*="player-container"]');
        if (container) container.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        return true;
    }
    if (overlayOpen()) {
        // okna Lumenu (ProfilePicker Modal) se zavírají klikem na pozadí; okno s povinnou volbou pozadí nezavře
        const backdrop = activeScope().parentElement;
        if (backdrop && /modal-backdrop/.test(backdrop.className)) {
            backdrop.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        } else {
            pressEscape();
        }
        return true;
    }
    if (isPlayer()) {
        if (playerControlsFocused()) {
            active.blur();
            return true;
        }
        pressEscape();
        return true;
    }
    const hash = window.location.hash || '#/';
    if (hash === '#/' || hash === '#' || hash === '#/board') return false;
    if (TOP_LEVEL_ROUTES.some((route) => hash === route || hash.startsWith(route + '/') || hash.startsWith(route + '?'))) {
        window.location.hash = '#/';
        return true;
    }
    window.history.back();
    return true;
};

const init = () => {
    if (!isEnabled()) return;
    document.documentElement.classList.add('lumen-tv');
    // televize hlásí jen ~960 px šířky; rozhraní je navržené na počítač, proto stránku vykreslíme na 1280 px a obal ji zmenší na celou obrazovku
    if (window.__lumenTV === true) {
        document.querySelector('meta[name="viewport"]')?.setAttribute('content', 'width=1280');
    }
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keydown', onKeyDownLate, false);
    window.__lumenBack = back;
    // mimo přehrávač musí být stránka neprůhledná, jinak pod ní prosvítá poslední snímek videa z obalu
    const markPlayer = () => document.documentElement.classList.toggle('lumen-tv-player', isPlayer());
    // router mění adresu přes history.pushState (bez události hashchange), proto se kontroluje i při každé změně stránky níž
    window.addEventListener('hashchange', markPlayer);
    window.addEventListener('popstate', markPlayer);
    markPlayer();
    // nově otevřené okno hned dostane zvýraznění, jinak by ovladač dál ovládal stránku pod ním
    let lastScope = null;
    let opener = null;
    let pending = false;
    const check = () => {
        markPlayer();
        const scope = activeScope();
        if (scope === lastScope) return;
        const previous = lastScope;
        lastScope = scope;
        if (scope === document.body) {
            // po zavření nabídky přehrávače zpět na tlačítko, které ji otevřelo
            const active = document.activeElement;
            const lost = !active || active === document.body || !isVisible(active) || active.closest('[class*="fade-exit"]');
            if (opener && opener.isConnected && lost) focusElement(opener);
            opener = null;
            return;
        }
        if (previous === document.body || previous === null) opener = document.activeElement;
        // menu profilu: zvýraznění z tlačítka rovnou na první položku
        if (!scope.contains(document.activeElement) || /menu-button-container/.test(scope.className)) {
            // nabídka se objevuje animací (průhlednost), během ní ještě nejsou položky „viditelné“
            const tryFocus = (attempt) => {
                const active = document.activeElement;
                if (activeScope() !== scope || (attempt > 0 && scope.contains(active) && active !== opener)) return;
                if (!focusFirst(scope) && attempt < 6) setTimeout(() => tryFocus(attempt + 1), 150);
            };
            tryFocus(0);
        }
    };
    new MutationObserver(() => {
        if (pending) return;
        pending = true;
        setTimeout(() => {
            pending = false;
            check();
        }, 30);
    }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
};

init();

module.exports = { isTvMode: isEnabled };
