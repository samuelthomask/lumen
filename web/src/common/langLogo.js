// Lumen: logo titulu jen v češtině nebo angličtině, jinak textový název (český, jinak anglický).
// Jazyk loga zná jen TMDB, proto je potřeba klíč LUMEN_TMDB_KEY (webpack). Bez klíče zůstává původní chování.
// Odpovědi se pamatují po dobu běhu aplikace.

const React = require('react');

const TMDB = 'https://api.themoviedb.org/3';
const KEY = process.env.LUMEN_TMDB_KEY || '';

const cache = new Map();

const lookup = (type, imdbId) => {
    const cacheKey = `${type}/${imdbId}`;
    if (!cache.has(cacheKey)) {
        const kind = type === 'series' ? 'tv' : 'movie';
        const promise = fetch(`${TMDB}/find/${imdbId}?api_key=${KEY}&external_source=imdb_id`)
            .then((response) => response.ok ? response.json() : null)
            .then((found) => {
                const hit = found && found[`${kind}_results`] && found[`${kind}_results`][0];
                if (!hit) return null;
                return fetch(`${TMDB}/${kind}/${hit.id}?api_key=${KEY}&append_to_response=images,translations&include_image_language=cs,en`)
                    .then((response) => response.ok ? response.json() : null);
            })
            .then((data) => {
                if (!data) return null;
                const logos = data.images && Array.isArray(data.images.logos) ? data.images.logos : [];
                const logo = logos.find((l) => l.iso_639_1 === 'cs') || logos.find((l) => l.iso_639_1 === 'en');
                const translations = data.translations && Array.isArray(data.translations.translations) ? data.translations.translations : [];
                const titleIn = (lang) => {
                    const tr = translations.find((t) => t.iso_639_1 === lang);
                    const title = tr && tr.data ? tr.data.title || tr.data.name : null;
                    return typeof title === 'string' && title.length > 0 ? title : null;
                };
                return {
                    logo: logo ? `https://image.tmdb.org/t/p/w500${logo.file_path}` : null,
                    title: titleIn('cs') || titleIn('en')
                };
            })
            .catch(() => { cache.delete(cacheKey); return null; });
        cache.set(cacheKey, promise);
    }
    return cache.get(cacheKey);
};

// Typ a IMDb id z odkazů na detail (#/detail/movie/tt123...)
const idFromDeepLinks = (deepLinks) => {
    if (!deepLinks) return null;
    const href = deepLinks.metaDetailsVideos || deepLinks.metaDetailsStreams || '';
    const match = /\/detail\/(movie|series)\/(tt\d+)/.exec(href);
    return match ? { type: match[1], id: match[2] } : null;
};

// Vrací { logo, title } k zobrazení. Bez klíče nebo pro ne-IMDb titul vrací původní logo a název.
const useLangLogo = (type, imdbId, fallbackLogo, fallbackName) => {
    const enabled = KEY.length > 0 && /^tt\d+$/.test(imdbId || '') && (type === 'movie' || type === 'series');
    const [result, setResult] = React.useState(null);
    React.useEffect(() => {
        if (!enabled) { setResult(null); return; }
        let cancelled = false;
        setResult(null);
        lookup(type, imdbId).then((data) => { if (!cancelled) setResult(data || { logo: null, title: null }); });
        return () => { cancelled = true; };
    }, [enabled, type, imdbId]);
    if (!enabled) return { logo: fallbackLogo || null, title: fallbackName, pending: false };
    if (result === null) return { logo: null, title: fallbackName, pending: true };
    return { logo: result.logo, title: result.title || fallbackName, pending: false };
};

module.exports = { useLangLogo, idFromDeepLinks };
