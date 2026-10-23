// Lumen: volitelný účet (Supabase) se šifrovanou synchronizací profilů.
// Ukládá se stejný obsah jako do souboru .lumen (profily, addony, knihovna, pokračování ve sledování, nastavení),
// ale zašifrovaný klíčem odvozeným z hesla. Klíč ani heslo neopustí zařízení: serveru se místo hesla posílá
// jeho otisk (jiný než šifrovací klíč), takže správce databáze vidí jen e-mail a nečitelný balík.
// Účet patří celé instalaci (klíče lumen.cloud.* nejsou součástí profilu).

const profiles = require('stremio/common/profiles');

const BASE_URL = (process.env.LUMEN_SUPABASE_URL || '').replace(/\/+$/, '');
const API_KEY = process.env.LUMEN_SUPABASE_KEY || '';
const enabled = !!(BASE_URL && API_KEY);

const SESSION_KEY = 'lumen.cloud.session'; // { access_token, refresh_token, expires_at, email }
const VAULT_KEY = 'lumen.cloud.key'; // šifrovací klíč (hex) a jeho otisk
const SYNC_KEY = 'lumen.cloud.sync'; // { hash, updatedAt, baseline }
const SYNC_INTERVAL = 60 * 1000;
const PBKDF2_ROUNDS = 200000;

const store = () => window.localStorage;
const readJson = (key) => {
    try { return JSON.parse(store().getItem(key)); } catch (_) { return null; }
};
const writeJson = (key, value) => store().setItem(key, JSON.stringify(value));

const listeners = new Set();
let current = { busy: false, error: '', lastSync: null };
const setStatus = (patch) => {
    current = { ...current, ...patch };
    listeners.forEach((listener) => listener(current));
};
const subscribe = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

// ---- kryptografie ----

const enc = new TextEncoder();
const toHex = (buffer) => Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
const fromHex = (hex) => new Uint8Array(hex.match(/../g).map((h) => parseInt(h, 16)));
const toBase64 = (buffer) => {
    let binary = '';
    new Uint8Array(buffer).forEach((b) => { binary += String.fromCharCode(b); });
    return window.btoa(binary);
};
const fromBase64 = (text) => Uint8Array.from(window.atob(text), (c) => c.charCodeAt(0));
const normEmail = (email) => String(email || '').trim().toLowerCase();

const pbkdf2 = async (password, salt) => {
    const material = await window.crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
    return window.crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(salt), iterations: PBKDF2_ROUNDS, hash: 'SHA-256' }, material, 256);
};

// heslo pro server a šifrovací klíč vznikají z hesla s různou solí, z jednoho nejde zjistit druhé
const authSecret = async (email, password) => toHex(await pbkdf2(password, `lumen-auth:${normEmail(email)}`));
const vaultKey = async (email, password) => {
    const raw = await pbkdf2(password, `lumen-vault:${normEmail(email)}`);
    return { key: toHex(raw), kid: toHex(await window.crypto.subtle.digest('SHA-256', raw)).slice(0, 16) };
};

const aesKey = (hex) => window.crypto.subtle.importKey('raw', fromHex(hex), 'AES-GCM', false, ['encrypt', 'decrypt']);

const encrypt = async (vault, text) => {
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const data = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(vault.key), enc.encode(text));
    return JSON.stringify({ v: 1, kid: vault.kid, iv: toBase64(iv), data: toBase64(data) });
};

const decrypt = async (vault, blob) => {
    const file = JSON.parse(blob);
    if (file.kid !== vault.kid) throw new Error('key');
    const plain = await window.crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(file.iv) }, await aesKey(vault.key), fromBase64(file.data));
    return new TextDecoder().decode(plain);
};

const blobKid = (blob) => {
    try { return JSON.parse(blob).kid; } catch (_) { return null; }
};

const sha256 = async (text) => toHex(await window.crypto.subtle.digest('SHA-256', enc.encode(text)));

// ---- komunikace se Supabase ----

const errorCode = (body, httpStatus) => {
    const text = `${(body && (body.error_code || body.code || body.error)) || ''} ${(body && (body.msg || body.message || body.error_description)) || ''}`.toLowerCase();
    if (/invalid_credentials|invalid login/.test(text)) return 'credentials';
    if (/email_not_confirmed|not confirmed/.test(text)) return 'unconfirmed';
    if (/user_already_exists|already registered/.test(text)) return 'exists';
    if (/otp_expired|expired|invalid.*token|token.*invalid/.test(text)) return 'code';
    if (/weak_password|password should/.test(text)) return 'weak';
    if (/rate|too many|over_email_send_rate_limit/.test(text) || httpStatus === 429) return 'rate';
    if (httpStatus === 401 || httpStatus === 403) return 'auth';
    return 'server';
};

const request = async (path, { method = 'GET', body, token, headers = {} } = {}) => {
    let response;
    try {
        response = await fetch(BASE_URL + path, {
            method,
            headers: {
                apikey: API_KEY,
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
                ...headers
            },
            body: body !== undefined ? JSON.stringify(body) : undefined
        });
    } catch (_) {
        throw new Error('network');
    }
    const text = await response.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch (_) { json = null; }
    if (!response.ok) {
        const error = new Error(errorCode(json, response.status));
        // přesné znění chyby pro případ, který aplikace nezná (pomáhá při nastavování serveru)
        error.detail = `${response.status} ${(json && (json.msg || json.message || json.error_description || json.error)) || ''}`.trim();
        throw error;
    }
    return json;
};

// ---- relace ----

const getSession = () => readJson(SESSION_KEY);
const getVault = () => readJson(VAULT_KEY);
const isLoggedIn = () => !!(getSession() && getVault());
const email = () => (getSession() || {}).email || '';

const saveSession = (data, address) => {
    writeJson(SESSION_KEY, {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: data.expires_at || Math.floor(Date.now() / 1000) + (data.expires_in || 3600),
        email: normEmail(address || (data.user && data.user.email)),
        user_id: (data.user && data.user.id) || (getSession() || {}).user_id
    });
};

const clearLocal = () => {
    [SESSION_KEY, VAULT_KEY, SYNC_KEY].forEach((key) => store().removeItem(key));
    setStatus({ busy: false, error: '', lastSync: null });
};

const token = async () => {
    const session = getSession();
    if (!session) throw new Error('auth');
    if (session.expires_at - 60 > Date.now() / 1000) return session.access_token;
    try {
        const data = await request('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: session.refresh_token } });
        saveSession(data, session.email);
        return data.access_token;
    } catch (error) {
        if (error.message !== 'network') clearLocal();
        throw error;
    }
};

// ---- trezor (zašifrovaná data v databázi) ----

const fetchVault = async () => {
    const rows = await request('/rest/v1/lumen_vault?select=data,updated_at', { token: await token() });
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
};

const currentPayload = () => JSON.stringify(profiles.collectAll());

const upload = async (payload) => {
    const vault = getVault();
    const text = payload || currentPayload();
    const rows = await request('/rest/v1/lumen_vault', {
        method: 'POST',
        token: await token(),
        headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
        body: { user_id: getSession().user_id, data: await encrypt(vault, text) }
    });
    const updatedAt = Array.isArray(rows) && rows[0] ? rows[0].updated_at : new Date().toISOString();
    writeJson(SYNC_KEY, { hash: await sha256(text), updatedAt });
    setStatus({ lastSync: Date.now(), error: '' });
};

const applyRemote = async (row) => {
    const items = JSON.parse(await decrypt(getVault(), row.data));
    writeJson(SYNC_KEY, { hash: null, updatedAt: row.updated_at, baseline: true });
    profiles.requestReplaceAll(items);
};

// Heslo změněné na jiném zařízení: tady uložený klíč už data neodemkne, je potřeba se přihlásit znovu.
const keyChanged = () => {
    clearLocal();
    setStatus({ error: 'relogin' });
};

// ---- přihlášení a registrace ----

const finishLogin = async (data, address, password) => {
    saveSession(data, address);
    writeJson(VAULT_KEY, await vaultKey(address, password));
    store().removeItem(SYNC_KEY);
    const row = await fetchVault();
    // prázdný účet: nahraje se toto zařízení; jinak se uživatel rozhodne (resolveChoice)
    if (!row) {
        await upload();
        return { done: true };
    }
    return { choice: true, updatedAt: row.updated_at };
};

const signIn = async (address, password) => {
    const data = await request('/auth/v1/token?grant_type=password', {
        method: 'POST', body: { email: normEmail(address), password: await authSecret(address, password) }
    });
    return finishLogin(data, address, password);
};

// Vrací { confirm: true }, když je potřeba zadat kód z e-mailu (verifySignup).
const signUp = async (address, password) => {
    const data = await request('/auth/v1/signup', {
        method: 'POST', body: { email: normEmail(address), password: await authSecret(address, password) }
    });
    if (data && data.access_token) return finishLogin(data, address, password);
    // existující e-mail: Supabase kvůli ochraně soukromí odpoví úspěchem, ale bez identit a nic nepošle
    const user = data && (data.user || data);
    if (user && Array.isArray(user.identities) && user.identities.length === 0) throw new Error('exists');
    return { confirm: true };
};

// Kód z e-mailu, nebo celý odkaz z výchozí šablony Supabase (bez vlastního SMTP nejde šablona upravit
// a e-mail obsahuje jen odkaz; jeho parametr token je otisk kódu, který /verify přijme jako token_hash).
const verify = (type, address, code) => {
    const input = String(code || '').trim();
    let tokenHash = null;
    try { tokenHash = /^https?:\/\//.test(input) ? new URL(input).searchParams.get('token') : null; } catch (_) { tokenHash = null; }
    const body = tokenHash ? { type, token_hash: tokenHash } : { type, email: normEmail(address), token: input };
    return request('/auth/v1/verify', { method: 'POST', body });
};

// Prázdný kód = uživatel na odkaz v e-mailu rovnou klikl v prohlížeči, účet je potvrzený a stačí se přihlásit.
const verifySignup = async (address, password, code) => {
    if (!String(code || '').trim()) return signIn(address, password);
    return finishLogin(await verify('signup', address, code), address, password);
};

const sendReset = (address) => request('/auth/v1/recover', { method: 'POST', body: { email: normEmail(address) } });

// Nové heslo: stará data v účtu nový klíč neodemkne, proto se nahradí daty z tohoto zařízení.
const resetPassword = async (address, code, password) => {
    const data = await verify('recovery', address, code);
    saveSession(data, address);
    await request('/auth/v1/user', { method: 'PUT', token: data.access_token, body: { password: await authSecret(address, password) } });
    writeJson(VAULT_KEY, await vaultKey(address, password));
    await upload();
    return { done: true };
};

// Po přihlášení k účtu, který už data má: 'cloud' = použít data z účtu (aplikace se načte znovu),
// 'device' = přepsat účet daty z tohoto zařízení.
const resolveChoice = async (which) => {
    if (which === 'device') return upload();
    const row = await fetchVault();
    if (!row) return upload();
    try {
        await applyRemote(row);
    } catch (_) {
        throw new Error('decrypt');
    }
};

const signOut = async () => {
    try { await request('/auth/v1/logout', { method: 'POST', token: await token() }); } catch (_) { /* odhlásí se i bez spojení */ }
    clearLocal();
};

const deleteAccount = async () => {
    await request('/rest/v1/rpc/delete_account', { method: 'POST', token: await token(), body: {} });
    clearLocal();
};

// ---- průběžná synchronizace ----

let syncing = false;

// startup = true: při spuštění se nejdřív zkontroluje, jestli jiné zařízení nenahrálo novější data.
const syncNow = async (startup) => {
    if (!enabled || !isLoggedIn() || syncing) return;
    syncing = true;
    setStatus({ busy: true });
    try {
        const sync = readJson(SYNC_KEY) || {};
        const row = await fetchVault();
        if (row && blobKid(row.data) !== getVault().kid) {
            keyChanged();
            return;
        }
        if (startup && row && row.updated_at !== sync.updatedAt) {
            await applyRemote(row);
            return;
        }
        const text = currentPayload();
        const hash = await sha256(text);
        if (sync.baseline) {
            // první kontrola po načtení dat z účtu: jen se zapamatuje stav, nic se nenahrává
            writeJson(SYNC_KEY, { hash, updatedAt: sync.updatedAt });
            setStatus({ lastSync: Date.now(), error: '' });
        } else if (!row || hash !== sync.hash) {
            await upload(text);
        } else {
            setStatus({ lastSync: Date.now(), error: '' });
        }
    } catch (error) {
        setStatus({ error: error.message });
    } finally {
        syncing = false;
        setStatus({ busy: false });
    }
};

let started = false;
const start = () => {
    if (!enabled || started) return;
    started = true;
    setTimeout(() => syncNow(true), 3000);
    setInterval(() => syncNow(false), SYNC_INTERVAL);
};

module.exports = {
    enabled, subscribe, getStatus: () => current, isLoggedIn, email,
    signIn, signUp, verifySignup, sendReset, resetPassword, resolveChoice, signOut, deleteAccount, syncNow, start
};
