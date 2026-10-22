// Lumen: velikost náhledů (3 předvolby: s = hodně malých, m = střední, l = málo velkých).
// Hodnota se pamatuje v localStorage a nastavuje atribut data-density na <html>, podle kterého se řídí CSS.

const React = require('react');

const KEY = 'lumen.density';
const VALUES = ['s', 'm', 'l'];
const listeners = new Set();

const read = () => {
    try {
        const value = window.localStorage.getItem(KEY);
        return VALUES.includes(value) ? value : 'm';
    } catch (_) {
        return 'm';
    }
};

let current = read();

const apply = () => {
    if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-density', current);
    }
};

apply();

const getDensity = () => current;

const setDensity = (value) => {
    if (!VALUES.includes(value) || value === current) return;
    current = value;
    try {
        window.localStorage.setItem(KEY, value);
    } catch (_) {
        // bez uložení (např. blokované úložiště) se hodnota drží jen do zavření aplikace
    }
    apply();
    listeners.forEach((listener) => listener());
};

const subscribe = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

const useDensity = () => [React.useSyncExternalStore(subscribe, getDensity), setDensity];

module.exports = { useDensity, getDensity, setDensity, DENSITY_VALUES: VALUES };
