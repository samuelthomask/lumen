// Lumen: preference zdrojů (stream) – jazyk a kvalita. Platí pro výsledky jakéhokoli addonu:
// řadí je podle toho, co se v názvu/popisu pozná (české dabing/titulky, 4K/Full HD...).
// Nic se nestahuje ani nekonfiguruje u addonů, jen se seřadí a případně skryje horší kvalita.

const React = require('react');

const KEY = 'lumen.streamPrefs';
const DEFAULTS = {
    // pořadí jazyků: 'cs-en' = česky, pak anglicky; 'en' = anglicky; 'off' = neřadit podle jazyka
    language: 'cs-en',
    // nejnižší zobrazená kvalita: 0 = vše, 1080 = Full HD a víc, 2160 = jen 4K (neznámá kvalita se vždy ponechá)
    minQuality: 1080
};
const LANGUAGES = ['cs-en', 'en', 'off'];
const MIN_QUALITIES = [0, 1080, 2160];
const listeners = new Set();

const read = () => {
    try {
        const parsed = JSON.parse(window.localStorage.getItem(KEY));
        return {
            language: LANGUAGES.includes(parsed?.language) ? parsed.language : DEFAULTS.language,
            minQuality: MIN_QUALITIES.includes(parsed?.minQuality) ? parsed.minQuality : DEFAULTS.minQuality
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

// ---- rozpoznání vlastností zdroje z textu ----

const textOf = (stream) => `${stream.name ?? ''} ${stream.description ?? ''} ${stream.title ?? ''}`;

const detectQuality = (text) => {
    if (/\b(2160p?|4k|uhd)\b/i.test(text)) return 2160;
    if (/\b(1440p?|2k)\b/i.test(text)) return 1440;
    if (/\b(1080[pi]?|full\s?hd|fhd)\b/i.test(text)) return 1080;
    if (/\b720p?\b|(^|[^a-z])hd([^a-z]|$)/i.test(text)) return 720;
    if (/\b(576p?|480p?|dvd|sd)\b/i.test(text)) return 480;
    return null;
};

const detectLanguages = (text) => ({
    czech: /🇨🇿|(^|[^a-z])(cz|cs|cze|czech)([^a-z]|$)|česk|cesk|dabing|(^|[^a-z])dab([^a-z]|$)|titulk/i.test(text),
    english: /🇬🇧|🇺🇸|(^|[^a-z])(en|eng|english)([^a-z]|$)/i.test(text)
});

const score = (stream, prefs) => {
    const text = textOf(stream);
    const quality = detectQuality(text) ?? 0;
    const { czech, english } = detectLanguages(text);
    let language = 0;
    if (prefs.language === 'cs-en') language = czech ? 2 : english ? 1 : 0;
    else if (prefs.language === 'en') language = english ? 2 : czech ? 1 : 0;
    return { quality, language, text };
};

// Vrací seřazené a podle minimální kvality přefiltrované zdroje + počet skrytých
const applyPrefs = (streams, prefs) => {
    const ranked = streams.map((stream, index) => ({ stream, index, ...score(stream, prefs) }));
    const kept = prefs.minQuality > 0 ? ranked.filter((item) => item.quality === 0 || item.quality >= prefs.minQuality) : ranked;
    // když by filtr smazal vše, nic neskrýváme
    const visible = kept.length > 0 ? kept : ranked;
    visible.sort((a, b) => (b.language - a.language) || (b.quality - a.quality) || (a.index - b.index));
    return { streams: visible.map((item) => item.stream), hidden: ranked.length - visible.length };
};

module.exports = { usePrefs, getPrefs, setPrefs, applyPrefs, LANGUAGES, MIN_QUALITIES };
