// Lumen: preference zdrojů (stream) – kvalita. Platí pro výsledky jakéhokoli addonu:
// řadí a filtruje je podle toho, co se pozná z názvu/popisu (4K, Full HD...).
// Nic se nestahuje ani nekonfiguruje u addonů. Zaškrtnout jde libovolná kombinace.
// Jazyk jde filtrovat jen jedním zaškrtávátkem "Jen CZ": nechá zdroje, které mají v názvu 🇨🇿, CZ, česky, dabing
// nebo titulky. Dabing a titulky se rozlišit nedají (v názvech to není spolehlivě), a když nic neodpovídá, nezobrazí se nic.

const React = require('react');

const KEY = 'lumen.streamPrefs';
// 2160 = 4K, 1080 = Full HD (i 1440p), 0 = méně než Full HD; zdroj s neznámou kvalitou se zobrazí vždy
const QUALITIES = [2160, 1080, 0];
const DEFAULTS = {
    czOnly: false,
    qualities: [2160, 1080]
};
const listeners = new Set();

const pick = (value, allowed) => Array.isArray(value) ? allowed.filter((item) => value.includes(item)) : null;

const read = () => {
    try {
        const parsed = JSON.parse(window.localStorage.getItem(KEY)) || {};
        // starší verze ukládala minimální kvalitu (0 / 1080 / 2160)
        const legacyQualities = typeof parsed.minQuality === 'number' ? QUALITIES.filter((q) => q >= parsed.minQuality) : null;
        return {
            czOnly: parsed.czOnly === true,
            qualities: pick(parsed.qualities, QUALITIES) ?? legacyQualities ?? DEFAULTS.qualities
        };
    } catch (_) {
        return { ...DEFAULTS };
    }
};

let current = read();

const getPrefs = () => current;

const setPrefs = (patch) => {
    current = { ...current, ...patch };
    try {
        window.localStorage.setItem(KEY, JSON.stringify(current));
    } catch (_) {
        // bez uložení se hodnota drží jen do zavření aplikace
    }
    listeners.forEach((listener) => listener());
};

const subscribe = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

const usePrefs = () => [React.useSyncExternalStore(subscribe, getPrefs), setPrefs];

// ---- rozpoznání kvality zdroje z textu ----

const textOf = (stream) => `${stream.name ?? ''} ${stream.description ?? ''} ${stream.title ?? ''}`;

const detectQuality = (text) => {
    if (/\b(2160p?|4k|uhd)\b/i.test(text)) return 2160;
    if (/\b(1440p?|2k)\b/i.test(text)) return 1440;
    if (/\b(1080[pi]?|full\s?hd|fhd)\b/i.test(text)) return 1080;
    if (/\b720p?\b|(^|[^a-z])hd([^a-z]|$)/i.test(text)) return 720;
    if (/\b(576p?|480p?|dvd|sd)\b/i.test(text)) return 480;
    return null;
};

const qualityGroup = (quality) => quality === null ? null : quality >= 2160 ? 2160 : quality >= 1080 ? 1080 : 0;

const isCzech = (text) => /🇨🇿|(^|[^a-z])(cz|cze|czech|cesky|česky|česk[éáýa]|cesk[eay]|dabing|titulky)([^a-z]|$)/i.test(text);

// Vrací seřazené a přefiltrované zdroje + počet skrytých
const applyPrefs = (streams, prefs) => {
    const ranked = streams.map((stream, index) => {
        const text = textOf(stream);
        const quality = detectQuality(text);
        return { stream, index, quality: quality ?? 0, group: qualityGroup(quality), czech: isCzech(text) };
    });
    // nic nezaškrtnuto = bez filtru
    const kept = ranked.filter((item) =>
        (!prefs.czOnly || item.czech) &&
        (prefs.qualities.length === 0 || item.group === null || prefs.qualities.includes(item.group)));
    kept.sort((a, b) => (b.quality - a.quality) || (a.index - b.index));
    return { streams: kept.map((item) => item.stream), hidden: ranked.length - kept.length };
};

module.exports = { usePrefs, getPrefs, setPrefs, applyPrefs, QUALITIES };
