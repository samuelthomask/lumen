// Lumen: balíček addonů na kód. Kdo dostane kód, nainstaluje jedním klikem celou sadu už nastavených addonů
// a doplní jen svůj API klíč. Soubor s balíčky je veřejně dostupný, ale každý balíček je zašifrovaný klíčem
// odvozeným z kódu (PBKDF2 + AES-GCM), takže bez kódu nejde přečíst ani zjistit, které addony obsahuje.
// V balíčku jsou adresy addonů se značkami {{id}} místo osobních klíčů. U addonů, které mají nastavení
// v adrese jako base64 JSON, se nastavení rozbalí, klíč se doplní a nastavení se znovu zabalí.
// Balíčky se vytvářejí nástrojem tools\addon-bundle.mjs ve vývojovém repozitáři.

// tajný gist se souborem lumen-bundles.json (obsah je zašifrovaný, adresa smí být veřejná)
const BUNDLES_URL = 'https://api.github.com/gists/8c6fe087e6e0fafcc252bd0d4b0d0761';
const BUNDLES_FILE = 'lumen-bundles.json';
const BUNDLES_RAW_URL = 'https://gist.githubusercontent.com/raw/8c6fe087e6e0fafcc252bd0d4b0d0761/lumen-bundles.json';
// klíč nezačíná "lumen." (s tečkou), takže patří k aktivnímu profilu stejně jako jeho addony
const STATE_KEY = 'lumenAddonBundle';
const ITERATIONS = 250000;

const enc = new TextEncoder();
const normalizeCode = (code) => String(code || '').toUpperCase().replace(/\s+/g, '');
const hex = (buffer) => Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
const fromBase64 = (text) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
const toBase64 = (text) => btoa(Array.from(enc.encode(text), (b) => String.fromCharCode(b)).join(''));

const decrypt = async (code, entry) => {
    const base = await crypto.subtle.importKey('raw', enc.encode(code), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: fromBase64(entry.salt), iterations: ITERATIONS, hash: 'SHA-256' },
        base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']
    );
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(entry.iv) }, key, fromBase64(entry.data));
    return JSON.parse(new TextDecoder().decode(plain));
};

// najde a odemkne balíček v obsahu souboru s balíčky; neznámý kód = chyba 'code'
const openBundle = async (rawCode, all) => {
    const code = normalizeCode(rawCode);
    if (!code) throw new Error('code');
    const id = hex(await crypto.subtle.digest('SHA-256', enc.encode('lumen-bundle:' + code)));
    const entry = all && all.bundles ? all.bundles[id] : null;
    if (!entry) throw new Error('code');
    const bundle = await decrypt(code, entry);
    if (!bundle || !Array.isArray(bundle.addons)) throw new Error('code');
    return { code, bundle };
};

const fetchFromApi = async () => {
    const response = await fetch(BUNDLES_URL, { headers: { Accept: 'application/vnd.github+json' }, cache: 'no-store' });
    if (!response.ok) throw new Error();
    const gist = await response.json();
    const file = gist.files && gist.files[BUNDLES_FILE];
    const content = file && file.truncated ? await (await fetch(file.raw_url)).text() : file && file.content;
    return JSON.parse(content);
};

// záloha: API GitHubu má limit 60 dotazů za hodinu na IP adresu (sdílené sítě, emulátory); surový soubor limit nemá,
// jen může být až 5 minut starý
const fetchRaw = async () => {
    const response = await fetch(BUNDLES_RAW_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error();
    return JSON.parse(await response.text());
};

const fetchBundle = async (rawCode) => {
    let all;
    try {
        all = await fetchFromApi();
    } catch (_) {
        try {
            all = await fetchRaw();
        } catch (_e) {
            throw new Error('offline');
        }
    }
    return openBundle(rawCode, all);
};

const fill = (value, keys) => {
    if (typeof value === 'string') return value.replace(/\{\{(\w+)\}\}/g, (_, id) => keys[id] || '');
    if (Array.isArray(value)) return value.map((item) => fill(item, keys));
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fill(v, keys)]));
    return value;
};

const addonUrl = (addon, keys) => addon.config !== undefined ?
    addon.url.replace('{config}', toBase64(JSON.stringify(fill(addon.config, keys)))) :
    fill(addon.url, keys);

const dispatch = (core, action, args) => core.transport.dispatch({ action: 'Ctx', args: { action, args } });

// Nainstaluje addony balíčku. Předtím odebere staré verze stejných addonů (jiný klíč = jiná adresa, stejné id)
// i addony, které balíček nainstaloval dřív a už v něm nejsou.
const install = async (core, installedAddons, bundle, keys, previousUrls = []) => {
    const ready = [];
    const failed = [];
    for (const addon of bundle.addons) {
        try {
            const transportUrl = addonUrl(addon, keys);
            const response = await fetch(transportUrl);
            if (!response.ok) throw new Error();
            const manifest = await response.json();
            if (typeof manifest?.id !== 'string' || typeof manifest?.name !== 'string') throw new Error();
            ready.push({ transportUrl, manifest, flags: { official: false, protected: false } });
        } catch (_) {
            // adresu (obsahuje klíč) záměrně nevypisujeme
            failed.push(addon.name || '?');
        }
    }
    const ids = new Set(ready.map((addon) => addon.manifest.id));
    const urls = new Set([...ready.map((addon) => addon.transportUrl), ...previousUrls]);
    (installedAddons || [])
        .filter((addon) => !addon.flags?.protected && (ids.has(addon.manifest.id) || urls.has(addon.transportUrl)))
        .forEach((addon) => dispatch(core, 'UninstallAddon', addon));
    ready.forEach((addon) => dispatch(core, 'InstallAddon', addon));
    return { installed: ready.map((addon) => addon.manifest.name), urls: ready.map((addon) => addon.transportUrl), failed };
};

const uninstall = (core, installedAddons, urls) => {
    const set = new Set(urls);
    (installedAddons || []).filter((addon) => set.has(addon.transportUrl)).forEach((addon) => dispatch(core, 'UninstallAddon', addon));
};

const loadState = () => {
    try {
        return JSON.parse(window.localStorage.getItem(STATE_KEY)) || null;
    } catch (_) {
        return null;
    }
};

const saveState = (state) => {
    try {
        if (state) window.localStorage.setItem(STATE_KEY, JSON.stringify(state));
        else window.localStorage.removeItem(STATE_KEY);
    } catch (_) { /* bez úložiště */ }
};

module.exports = { enabled: true, openBundle, fetchBundle, addonUrl, install, uninstall, loadState, saveState };
