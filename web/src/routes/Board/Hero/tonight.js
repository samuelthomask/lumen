// Lumen: „Co dnes?“ – náhodný dobře hodnocený film podle žánrů, které uživatel rozkoukal.
// Žánry se berou z „Pokračovat ve sledování“, filmy z žánrových žebříčků Cinemety. Bez účtu a bez serveru.

const { isCinemetaItem, fetchMeta, fetchGenre } = require('./cinemeta');

const FALLBACK_GENRES = ['Drama', 'Comedy', 'Thriller', 'Action', 'Sci-Fi', 'Adventure', 'Crime', 'Mystery'];
const KNOWN_GENRES = [...FALLBACK_GENRES, 'Animation', 'Fantasy', 'Horror', 'Romance', 'Family', 'History', 'War'];
const MIN_RATING = 6.5;
const suggested = new Set();   // co už dnes padlo, ať se tipy neopakují

const randomOf = (list) => list[Math.floor(Math.random() * list.length)];

// Oblíbené žánry: každý žánr rozkoukaného titulu = jeden hlas
const favouriteGenres = async (watching) => {
    const items = watching.filter(isCinemetaItem).slice(0, 8);
    const metas = await Promise.all(items.map((item) => fetchMeta(item.type, item.id)));
    return metas.flatMap((meta) => meta && Array.isArray(meta.genres) ? meta.genres : [])
        .filter((genre) => KNOWN_GENRES.includes(genre));
};

const pickTonight = async (watching) => {
    const list = Array.isArray(watching) ? watching : [];
    const seen = new Set(list.map((item) => item.id));
    const votes = await favouriteGenres(list);
    for (let attempt = 0; attempt < 4; attempt++) {
        const genre = votes.length > 0 && Math.random() < 0.8 ? randomOf(votes) : randomOf(FALLBACK_GENRES);
        const metas = await fetchGenre('movie', genre);
        const candidates = metas.filter((meta) =>
            /^tt\d+$/.test(meta.id) &&
            typeof meta.poster === 'string' &&
            parseFloat(meta.imdbRating) >= MIN_RATING &&
            !seen.has(meta.id) &&
            !suggested.has(meta.id));
        if (candidates.length > 0) {
            const meta = randomOf(candidates);
            suggested.add(meta.id);
            return {
                id: meta.id,
                type: 'movie',
                name: meta.name,
                poster: meta.poster,
                deepLinks: {
                    metaDetailsVideos: `#/detail/movie/${meta.id}`,
                    metaDetailsStreams: `#/detail/movie/${meta.id}/${meta.id}`
                },
                tonight: true
            };
        }
    }
    return null;
};

module.exports = pickTonight;
