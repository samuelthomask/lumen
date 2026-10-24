// Lumen: preference zdrojů (stream) – jazyk a kvalita. Platí pro výsledky jakéhokoli addonu:
// řadí a filtruje je podle toho, co se pozná z názvu/popisu (český dabing, české titulky, 4K/Full HD...).
// Nic se nestahuje ani nekonfiguruje u addonů. Obojí jsou zaškrtávátka, zaškrtnout jde libovolná kombinace.

const React = require('react');

const KEY = 'lumen.streamPrefs';
// csAudio = český dabing, csSubs = české titulky, enAudio = anglický zvuk, enSubs = anglické titulky
const LANGUAGES = ['csSubs', 'csAudio', 'enSubs', 'enAudio'];
// 2160 = 4K, 1080 = Full HD (i 1440p), 0 = méně než Full HD; zdroj s neznámou kvalitou se zobrazí vždy
const QUALITIES = [2160, 1080, 0];
const DEFAULTS = {
    languages: [...LANGUAGES],
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
            languages: pick(parsed.languages, LANGUAGES) ?? DEFAULTS.languages,
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

const qualityGroup = (quality) => quality === null ? null : quality >= 2160 ? 2160 : quality >= 1080 ? 1080 : 0;

// Titulky se v názvech značí slovem „titulky“/„sub“ u jazyka (CZ tit, CZ sub, ENG subs), samotné „CZ“ znamená dabing.
const CS = '(cz|cs|cze|czech|česk[éaý]?|cesk[eay]?)';
const EN = '(en|eng|english|anglick[éaý]?)';
const SUB = '(tit(ulky)?|subs?|subtitles?|forced)';
const detectLanguages = (text) => {
    const csSubs = new RegExp(`(^|[^a-z])${CS}[\\s._-]*${SUB}([^a-z]|$)|${SUB}[\\s:._-]*${CS}([^a-z]|$)|titulk`, 'i').test(text);
    const csAudio = /dabing|(^|[^a-z])dab(ing)?([^a-z]|$)|cz[\s._-]*dub/i.test(text) ||
        (new RegExp(`(^|[^a-z])${CS}([^a-z]|$)|🇨🇿`, 'i').test(text) && !csSubs);
    const enSubs = new RegExp(`(^|[^a-z])${EN}[\\s._-]*${SUB}([^a-z]|$)|${SUB}[\\s:._-]*${EN}([^a-z]|$)|multi[\\s._-]*subs?`, 'i').test(text);
    // bez české stopy jde skoro vždy o původní (většinou anglický) zvuk
    const enAudio = new RegExp(`(^|[^a-z])${EN}([^a-z]|$)|🇬🇧|🇺🇸`, 'i').test(text) || !csAudio;
    return { csSubs, csAudio, enSubs, enAudio };
};

const LANGUAGE_WEIGHT = { csAudio: 8, csSubs: 4, enAudio: 2, enSubs: 1 };

// Vrací seřazené a přefiltrované zdroje + počet skrytých
const applyPrefs = (streams, prefs) => {
    const ranked = streams.map((stream, index) => {
        const text = textOf(stream);
        const quality = detectQuality(text);
        const found = detectLanguages(text);
        const matched = prefs.languages.filter((language) => found[language]);
        return {
            stream,
            index,
            quality: quality ?? 0,
            group: qualityGroup(quality),
            matches: matched.length > 0,
            language: matched.reduce((sum, language) => sum + LANGUAGE_WEIGHT[language], 0)
        };
    });
    // nic nezaškrtnuto = bez filtru
    const kept = ranked.filter((item) =>
        (prefs.qualities.length === 0 || item.group === null || prefs.qualities.includes(item.group)) &&
        (prefs.languages.length === 0 || item.matches));
    // když by filtr smazal vše, nic neskrýváme
    const visible = kept.length > 0 ? kept : ranked;
    visible.sort((a, b) => (b.language - a.language) || (b.quality - a.quality) || (a.index - b.index));
    return { streams: visible.map((item) => item.stream), hidden: ranked.length - visible.length };
};

module.exports = { usePrefs, getPrefs, setPrefs, applyPrefs, detectLanguages, LANGUAGES, QUALITIES };
