// Lumen: obří banner (16:9) na domovské stránce. Zobrazuje vybraný titul (klik na dlaždici) nebo
// doporučené tituly prvního katalogu, které se střídají. Žádná videa ani trailery.

const React = require('react');
const PropTypes = require('prop-types');
const classnames = require('classnames');
const { default: Icon } = require('@stremio/stremio-icons/react');
const { Button } = require('stremio/components');
const { default: getMetaDetailsHref } = require('stremio/common/getMetaDetailsHref');
const { useLumenText } = require('stremio/common/lumenText');
const { isTvMode } = require('stremio/common/tvNavigation');
const { useTranslation } = require('react-i18next');
const styles = require('./styles');

const MAX_SLIDES = 6;
const ROTATE_MS = 10000;
const CINEMETA = 'https://v3-cinemeta.strem.io';

// Poster z metahub.space → pozadí stejného titulu (bez dalších dotazů na server)
const backgroundFor = (poster) => {
    if (typeof poster !== 'string') return null;
    return /images\.metahub\.space\/poster\//.test(poster) ?
        poster.replace('/poster/', '/background/').replace(/\/(small|medium|large)\//, '/large/')
        :
        null;
};

const normalize = (item) => ({
    id: item.id,
    name: item.name,
    type: item.type,
    poster: item.poster,
    background: backgroundFor(item.poster),
    href: getMetaDetailsHref(item.deepLinks)
});

// Doplňující údaje (popis, žánry, délka, logo) z Cinemety; výsledky se pamatují
const extrasCache = new Map();
const useExtras = (item) => {
    const key = item && /^tt\d+$/.test(item.id) && (item.type === 'movie' || item.type === 'series') ? `${item.type}/${item.id}` : null;
    const [extras, setExtras] = React.useState(() => key && extrasCache.has(key) ? extrasCache.get(key) : null);
    React.useEffect(() => {
        if (!key) { setExtras(null); return; }
        if (extrasCache.has(key)) { setExtras(extrasCache.get(key)); return; }
        let cancelled = false;
        setExtras(null);
        fetch(`${CINEMETA}/meta/${key}.json`)
            .then((response) => response.ok ? response.json() : null)
            .then((data) => {
                const meta = data && data.meta ? data.meta : null;
                extrasCache.set(key, meta);
                if (!cancelled) setExtras(meta);
            })
            .catch(() => { if (!cancelled) setExtras(null); });
        return () => { cancelled = true; };
    }, [key]);
    return extras;
};

const typeLabel = (type) => typeof type === 'string' && type.length > 0 ? type.charAt(0).toUpperCase() + type.slice(1) : '';

const Hero = ({ className, catalogs, selected, onResetSelection }) => {
    const lt = useLumenText();
    const { t } = useTranslation();
    const slides = React.useMemo(() => {
        if (!Array.isArray(catalogs)) return [];
        const ready = catalogs.find((catalog) => catalog.content?.type === 'Ready' && Array.isArray(catalog.content.content));
        if (!ready) return [];
        return ready.content.content
            .filter((item) => typeof item.name === 'string' && typeof item.poster === 'string')
            .slice(0, MAX_SLIDES)
            .map(normalize);
    }, [catalogs]);

    const [index, setIndex] = React.useState(0);
    React.useEffect(() => {
        if (selected || slides.length < 2) return;
        const timer = setInterval(() => setIndex((current) => (current + 1) % slides.length), ROTATE_MS);
        return () => clearInterval(timer);
    }, [slides.length, selected]);

    const active = selected ? normalize(selected) : slides.length > 0 ? slides[Math.min(index, slides.length - 1)] : null;
    const extras = useExtras(active);

    if (active === null) return null;

    const image = extras?.background ?? active.background ?? active.poster;
    const meta = [
        extras?.releaseInfo ?? extras?.year,
        extras?.runtime,
        extras?.imdbRating ? `IMDb ${extras.imdbRating}` : null,
        Array.isArray(extras?.genres) ? extras.genres.slice(0, 3).join(', ') : null
    ].filter(Boolean);

    return (
        <div className={classnames(className, styles['hero-container'], 'animation-fade-in')}>
            <img key={image} className={styles['hero-image']} src={image} alt={' '} />
            <div className={styles['hero-shade']} />
            <div className={styles['hero-glass']}>
                <div className={styles['hero-type']}>{t(`TYPE_${active.type}`, { defaultValue: typeLabel(active.type) })}</div>
                {
                    extras?.logo ?
                        <img key={extras.logo} className={styles['hero-logo']} src={extras.logo} alt={active.name} title={active.name} />
                        :
                        <div className={styles['hero-title']} title={active.name}>{active.name}</div>
                }
                {meta.length > 0 ? <div className={styles['hero-meta']}>{meta.join('  ·  ')}</div> : null}
                {extras?.description ? <div className={styles['hero-description']}>{extras.description}</div> : null}
                {
                    active.href ?
                        <Button className={styles['hero-button']} href={active.href} tabIndex={isTvMode() ? 0 : -1}>
                            <Icon className={styles['hero-button-icon']} name={'play'} />
                            <div className={styles['hero-button-label']}>{lt('details')}</div>
                        </Button>
                        :
                        null
                }
            </div>
            {
                !selected && slides.length > 1 ?
                    <div className={styles['hero-dots']}>
                        {slides.map((slide, i) => (
                            <button key={slide.id ?? i} type={'button'} tabIndex={-1} title={slide.name}
                                className={classnames(styles['hero-dot'], { [styles['active']]: slide === active })}
                                onClick={() => setIndex(i)} />
                        ))}
                    </div>
                    :
                    selected ?
                        <button type={'button'} tabIndex={-1} className={styles['hero-reset']} onClick={onResetSelection}>{lt('featured')}</button>
                        :
                        null
            }
        </div>
    );
};

Hero.propTypes = {
    className: PropTypes.string,
    catalogs: PropTypes.array,
    selected: PropTypes.object,
    onResetSelection: PropTypes.func
};

Hero.backgroundFor = backgroundFor;

module.exports = Hero;
