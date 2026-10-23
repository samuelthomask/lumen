// Lumen: profily. Každý profil má vlastní addony, knihovnu, pokračování ve sledování a nastavení.
// Jádro aplikace ukládá do window.localStorage pod pevnými názvy, proto "aktivní" profil žije přímo v localStorage
// a ostatní jsou uložené jako snímek pod klíčem lumen.pdata.<id>. Přepnutí = uložit snímek aktivního, načíst snímek jiného
// a znovu načíst stránku. Přepíná se jen při startu, dokud jádro neběží (viz applyPendingSwitch).

const META_KEY = 'lumen.profiles';
const DATA_PREFIX = 'lumen.pdata.';
const PENDING_KEY = 'lumen.pendingSwitch';
const PENDING_REPLACE_KEY = 'lumen.pendingReplace'; // data z účtu čekající na použití při startu
const PICKED_KEY = 'lumen.profilePicked'; // sessionStorage: profil už byl při tomto spuštění vybrán
const FORMAT = 'lumen-profiles';

const COLORS = ['#0a84ff', '#bf5af2', '#ff375f', '#ff9f0a', '#30d158', '#64d2ff', '#ffd60a', '#ac8e68'];

const store = () => window.localStorage;

// klíče patřící profilu: vše, co zapisuje jádro, + vlastní nastavení Lumenu vázané na profil
const isOwned = (key) => !key.startsWith('lumen.') || key === 'lumen.streamPrefs' || key === 'lumen.langInit';

const ownedKeys = () => {
    const keys = [];
    for (let i = 0; i < store().length; i++) {
        const key = store().key(i);
        if (key && isOwned(key)) keys.push(key);
    }
    return keys;
};

const snapshot = () => Object.fromEntries(ownedKeys().map((key) => [key, store().getItem(key)]));

const clearOwned = () => ownedKeys().forEach((key) => store().removeItem(key));

const restore = (data) => {
    clearOwned();
    Object.entries(data || {}).forEach(([key, value]) => {
        if (isOwned(key) && typeof value === 'string') store().setItem(key, value);
    });
};

const newId = () => `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const readMeta = () => {
    try {
        const meta = JSON.parse(store().getItem(META_KEY));
        if (meta && Array.isArray(meta.profiles)) return meta;
    } catch (_) {
        // poškozená data: začne se znovu
    }
    return null;
};

const writeMeta = (meta) => store().setItem(META_KEY, JSON.stringify(meta));

const readData = (id) => {
    try {
        return JSON.parse(store().getItem(DATA_PREFIX + id)) || {};
    } catch (_) {
        return {};
    }
};

const writeData = (id, data) => store().setItem(DATA_PREFIX + id, JSON.stringify(data));

const getMeta = () => readMeta() || { activeId: null, profiles: [] };

const getProfiles = () => getMeta().profiles;

const getActive = () => {
    const meta = getMeta();
    return meta.profiles.find((profile) => profile.id === meta.activeId) || meta.profiles[0] || null;
};

// Při prvním spuštění se stávající data stanou prvním profilem. Volá se před startem jádra.
const init = () => {
    try {
        let meta = readMeta();
        if (!meta || meta.profiles.length === 0) {
            const id = newId();
            meta = { activeId: id, profiles: [{ id, name: 'Profil 1', color: COLORS[0] }] };
            writeMeta(meta);
        }
        const replace = store().getItem(PENDING_REPLACE_KEY);
        if (replace) {
            store().removeItem(PENDING_REPLACE_KEY);
            try { replaceAllLocal(JSON.parse(replace)); } catch (_) { /* poškozená data: zůstanou stávající profily */ }
        }
        const pending = store().getItem(PENDING_KEY);
        if (pending) {
            store().removeItem(PENDING_KEY);
            switchLocal(pending);
        }
    } catch (_) {
        // bez localStorage profily nefungují, aplikace běží jako dřív
    }
};

// Přepne aktivní profil (jen úložiště, bez znovunačtení).
const switchLocal = (id) => {
    const meta = getMeta();
    if (!meta.profiles.some((profile) => profile.id === id) || meta.activeId === id) return;
    if (meta.profiles.some((profile) => profile.id === meta.activeId)) writeData(meta.activeId, snapshot());
    restore(readData(id));
    meta.activeId = id;
    writeMeta(meta);
};

// Přepnutí z běžící aplikace: uloží se pokyn a stránka se načte znovu (přepne se před startem jádra).
const requestSwitch = (id) => {
    store().setItem(PENDING_KEY, id);
    window.location.reload();
};

const markPicked = () => {
    try { window.sessionStorage.setItem(PICKED_KEY, '1'); } catch (_) { /* ignorováno */ }
};
const clearPicked = () => {
    try { window.sessionStorage.removeItem(PICKED_KEY); } catch (_) { /* ignorováno */ }
};
const needsPicker = () => {
    try {
        return getProfiles().length > 1 && window.sessionStorage.getItem(PICKED_KEY) !== '1';
    } catch (_) {
        return false;
    }
};

// ---- správa ----

const bytesToHex = (buffer) => Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, '0')).join('');

const hashPin = async (pin, salt) => {
    const data = new TextEncoder().encode(`${salt}:${pin}`);
    return bytesToHex(await window.crypto.subtle.digest('SHA-256', data));
};

const makePin = async (pin) => {
    const salt = bytesToHex(window.crypto.getRandomValues(new Uint8Array(8)));
    return { salt, hash: await hashPin(pin, salt) };
};

const checkPin = async (profile, pin) => !profile.pin || (await hashPin(pin, profile.pin.salt)) === profile.pin.hash;

const addProfile = async ({ name, color, pin }) => {
    const meta = getMeta();
    const profile = { id: newId(), name: name.trim() || 'Profil', color: color || COLORS[meta.profiles.length % COLORS.length] };
    if (pin) profile.pin = await makePin(pin);
    meta.profiles.push(profile);
    writeMeta(meta);
    writeData(profile.id, {});
    return profile;
};

// pin: undefined = beze změny, '' = odstranit, jinak nový
const updateProfile = async (id, { name, color, pin }) => {
    const meta = getMeta();
    const profile = meta.profiles.find((item) => item.id === id);
    if (!profile) return;
    if (typeof name === 'string' && name.trim()) profile.name = name.trim();
    if (color) profile.color = color;
    if (pin === '') delete profile.pin;
    else if (typeof pin === 'string') profile.pin = await makePin(pin);
    writeMeta(meta);
};

const removeProfile = (id) => {
    const meta = getMeta();
    if (meta.profiles.length <= 1) return false;
    const wasActive = meta.activeId === id;
    meta.profiles = meta.profiles.filter((profile) => profile.id !== id);
    store().removeItem(DATA_PREFIX + id);
    if (wasActive) {
        const next = meta.profiles[0];
        restore(readData(next.id));
        meta.activeId = next.id;
    }
    writeMeta(meta);
    return true;
};

// ---- export / import (.lumen) ----

const toBase64 = (buffer) => {
    let binary = '';
    new Uint8Array(buffer).forEach((b) => { binary += String.fromCharCode(b); });
    return window.btoa(binary);
};
const fromBase64 = (text) => Uint8Array.from(window.atob(text), (c) => c.charCodeAt(0));

const deriveKey = async (password, salt) => {
    const material = await window.crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
    return window.crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations: 200000, hash: 'SHA-256' },
        material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
    );
};

// Všechny profily včetně dat (pro export i synchronizaci s účtem).
const collectAll = () => {
    const meta = getMeta();
    return meta.profiles.map((profile) => ({
        ...profile,
        data: profile.id === meta.activeId ? snapshot() : readData(profile.id)
    }));
};

// Obsah souboru: adresy addonů mohou obsahovat osobní klíče, proto je lze zašifrovat heslem.
const exportProfiles = async (password) => {
    const profiles = collectAll();
    const payload = JSON.stringify(profiles);
    if (!password) return JSON.stringify({ format: FORMAT, version: 1, encrypted: false, profiles });
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(password, salt);
    const encrypted = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(payload));
    return JSON.stringify({ format: FORMAT, version: 1, encrypted: true, salt: toBase64(salt), iv: toBase64(iv), data: toBase64(encrypted) });
};

// Vrací { encrypted: true } když je potřeba heslo; chybné heslo nebo soubor vyhodí chybu.
const parseExport = async (text, password) => {
    const file = JSON.parse(text);
    if (!file || file.format !== FORMAT) throw new Error('format');
    if (!file.encrypted) return { profiles: file.profiles };
    if (!password) return { encrypted: true };
    try {
        const key = await deriveKey(password, fromBase64(file.salt));
        const plain = await window.crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(file.iv) }, key, fromBase64(file.data));
        return { profiles: JSON.parse(new TextDecoder().decode(plain)) };
    } catch (_) {
        throw new Error('password');
    }
};

// Přidá profily ze souboru jako nové (stávající se nepřepisují).
const importProfiles = (profiles) => {
    const meta = getMeta();
    let count = 0;
    profiles.forEach((item) => {
        if (!item || typeof item.name !== 'string') return;
        const id = newId();
        const profile = { id, name: item.name, color: COLORS.includes(item.color) ? item.color : COLORS[count % COLORS.length] };
        if (item.pin && item.pin.salt && item.pin.hash) profile.pin = { salt: String(item.pin.salt), hash: String(item.pin.hash) };
        meta.profiles.push(profile);
        const data = {};
        Object.entries(item.data || {}).forEach(([key, value]) => { if (isOwned(key) && typeof value === 'string') data[key] = value; });
        writeData(id, data);
        count++;
    });
    writeMeta(meta);
    return count;
};

// Nahradí všechny profily v zařízení (data z účtu). Stejně jako přepnutí profilu se provede až po znovunačtení,
// před startem jádra (viz init).
const replaceAllLocal = (items) => {
    const meta = { activeId: null, profiles: [] };
    const datas = {};
    (Array.isArray(items) ? items : []).forEach((item) => {
        if (!item || typeof item.name !== 'string' || typeof item.id !== 'string') return;
        const profile = { id: item.id, name: item.name, color: COLORS.includes(item.color) ? item.color : COLORS[meta.profiles.length % COLORS.length] };
        if (item.pin && item.pin.salt && item.pin.hash) profile.pin = { salt: String(item.pin.salt), hash: String(item.pin.hash) };
        meta.profiles.push(profile);
        const data = {};
        Object.entries(item.data || {}).forEach(([key, value]) => { if (isOwned(key) && typeof value === 'string') data[key] = value; });
        datas[profile.id] = data;
    });
    if (meta.profiles.length === 0) return;
    getProfiles().forEach((profile) => store().removeItem(DATA_PREFIX + profile.id));
    meta.activeId = meta.profiles[0].id;
    meta.profiles.slice(1).forEach((profile) => writeData(profile.id, datas[profile.id]));
    restore(datas[meta.activeId]);
    writeMeta(meta);
};

const requestReplaceAll = (items) => {
    store().setItem(PENDING_REPLACE_KEY, JSON.stringify(items));
    clearPicked();
    window.location.reload();
};

const saveFile = (text, filename) => {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
};

module.exports = {
    COLORS, init, getProfiles, getActive, switchLocal, requestSwitch, needsPicker, markPicked, clearPicked,
    addProfile, updateProfile, removeProfile, checkPin, exportProfiles, parseExport, importProfiles, saveFile,
    collectAll, requestReplaceAll
};
