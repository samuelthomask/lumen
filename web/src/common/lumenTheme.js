// Lumen: vlastní téma. Každý profil si vybere barvu rozhraní a světlý nebo tmavý režim; volitelně se jemný barevný
// nádech pozadí přizpůsobí obrázku filmu, který je právě vidět (úvod domovské stránky, detail titulu).
// Uloženo pod klíčem bez předpony "lumen.", takže patří k profilu a synchronizuje se s účtem.

const React = require('react');

const KEY = 'lumenTheme';
const ACCENTS = {
    blue: '#0a84ff',
    purple: '#bf5af2',
    pink: '#ff375f',
    orange: '#ff9f0a',
    green: '#30d158',
    teal: '#40c8e0'
};
const MODES = ['dark', 'light'];
const DEFAULTS = { accent: 'blue', mode: 'dark', ambient: true };
const listeners = new Set();

const read = () => {
    try {
        const parsed = JSON.parse(window.localStorage.getItem(KEY)) || {};
        return {
            accent: Object.prototype.hasOwnProperty.call(ACCENTS, parsed.accent) ? parsed.accent : DEFAULTS.accent,
            mode: MODES.includes(parsed.mode) ? parsed.mode : DEFAULTS.mode,
            ambient: typeof parsed.ambient === 'boolean' ? parsed.ambient : DEFAULTS.ambient
        };
    } catch (_) {
        return { ...DEFAULTS };
    }
};

let current = read();
let ambientColor = null;   // barva z obrázku filmu, null = žádný film

const apply = () => {
    const root = document.documentElement;
    const accent = ACCENTS[current.accent];
    root.style.setProperty('--primary-accent-color', accent);
    root.style.setProperty('--secondary-accent-color', accent);
    root.style.setProperty('--lumen-accent', accent);
    root.style.setProperty('--lumen-ambient', current.ambient && ambientColor ? ambientColor : accent);
    root.classList.toggle('lumen-light', current.mode === 'light');
};

const getTheme = () => current;

const setTheme = (patch) => {
    current = { ...current, ...patch };
    try {
        window.localStorage.setItem(KEY, JSON.stringify(current));
    } catch (_) {
        // bez uložení platí jen do zavření aplikace
    }
    apply();
    listeners.forEach((listener) => listener());
};

const subscribe = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

const useTheme = () => [React.useSyncExternalStore(subscribe, getTheme), setTheme];

// ---- barva z obrázku ----

const rgbToHsl = (r, g, b) => {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max === min) return [0, 0, l];
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [h * 60, s, l];
};

// Průměr barev vážený sytostí (šedé a téměř černé/bílé pixely skoro nepočítají), výsledek s pevnou světlostí,
// aby byl nádech vždy jemný a čitelný.
const colorOf = (image) => {
    const size = 32;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(image, 0, 0, size, size);
    const data = context.getImageData(0, 0, size, size).data;
    let r = 0, g = 0, b = 0, total = 0;
    for (let i = 0; i < data.length; i += 4) {
        const [, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
        const weight = s * s * (1 - Math.abs(l - 0.5) * 1.6) + 0.01;
        if (weight <= 0) continue;
        r += data[i] * weight; g += data[i + 1] * weight; b += data[i + 2] * weight; total += weight;
    }
    if (total === 0) return null;
    const [h, s] = rgbToHsl(r / total, g / total, b / total);
    if (s < 0.12) return null;   // skoro černobílý obrázek: nechat barvu rozhraní
    return `hsl(${Math.round(h)}, ${Math.round(Math.min(0.85, Math.max(0.5, s)) * 100)}%, 55%)`;
};

let lastUrl = null;
const setAmbientImage = (url) => {
    lastUrl = url;
    if (typeof url !== 'string' || url.length === 0) {
        ambientColor = null;
        apply();
        return;
    }
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
        if (lastUrl !== url) return;
        try {
            ambientColor = colorOf(image);
        } catch (_) {
            ambientColor = null;   // obrázek bez povolení CORS: canvas nejde číst
        }
        apply();
    };
    image.onerror = () => {
        if (lastUrl !== url) return;
        ambientColor = null;
        apply();
    };
    image.src = url;
};

// Komponenta zobrazující film: nastaví nádech podle obrázku a při odchodu ho vrátí
const useAmbientImage = (url) => {
    React.useEffect(() => {
        setAmbientImage(url);
    }, [url]);
    React.useEffect(() => () => setAmbientImage(null), []);
};

apply();

module.exports = { ACCENTS, MODES, useTheme, getTheme, setTheme, useAmbientImage };
