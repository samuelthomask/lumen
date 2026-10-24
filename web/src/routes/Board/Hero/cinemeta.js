// Lumen: dotazy na veřejný katalog Cinemeta (popisy titulů, žánrové žebříčky); odpovědi se pamatují po dobu běhu aplikace.

const CINEMETA = 'https://v3-cinemeta.strem.io';

const cache = new Map();
const getJson = (url) => {
    if (!cache.has(url)) {
        cache.set(url, fetch(url)
            .then((response) => response.ok ? response.json() : null)
            .catch(() => { cache.delete(url); return null; }));
    }
    return cache.get(url);
};

const isCinemetaItem = (item) => item && /^tt\d+$/.test(item.id) && (item.type === 'movie' || item.type === 'series');

const fetchMeta = (type, id) => getJson(`${CINEMETA}/meta/${type}/${id}.json`).then((data) => data && data.meta ? data.meta : null);

const fetchGenre = (type, genre) => getJson(`${CINEMETA}/catalog/${type}/top/genre=${encodeURIComponent(genre)}.json`)
    .then((data) => data && Array.isArray(data.metas) ? data.metas : []);

module.exports = { isCinemetaItem, fetchMeta, fetchGenre };
