// Lumen: „Kino“ úvod domovské stránky. Obrázek titulu leží přes celé okno za postranním panelem (vykresluje ho Board,
// Hero mu ho předá přes onImage), text a tlačítka jsou vlevo dole bez rámečku. Zobrazuje vybraný titul (klik na dlaždici),
// tip z „Co dnes?“ nebo doporučené tituly prvního katalogu, které se střídají. Žádná videa ani trailery.

const React = require('react');
const PropTypes = require('prop-types');
const classnames = require('classnames');
const { default: Icon } = require('@stremio/stremio-icons/react');
const { Button } = require('stremio/components');
const { default: getMetaDetailsHref } = require('stremio/common/getMetaDetailsHref');
const { useLumenText } = require('stremio/common/lumenText');
const { isTvMode } = require('stremio/common/tvNavigation');
const { useTranslation } = require('react-i18next');
const { isCinemetaItem, fetchMeta } = require('./cinemeta');
const { useLangLogo } = require('stremio/common/langLogo');
const styles = require('./styles');

const MAX_SLIDES = 6;
const ROTATE_MS = 10000;

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
    href: getMetaDetailsHref(item.deepLinks),
    tonight: item.tonight === true
});

// Doplňující údaje (popis, žánry, délka, logo) z Cinemety
const useExtras = (item) => {
    const key = isCinemetaItem(item) ? `${item.type}/${item.id}` : null;
    const [extras, setExtras] = React.useState(null);
    React.useEffect(() => {
        if (!key) { setExtras(null); return; }
        let cancelled = false;
        setExtras(null);
        fetchMeta(item.type, item.id).then((meta) => { if (!cancelled) setExtras(meta); });
        return () => { cancelled = true; };
    }, [key]);
    return extras;
};

const typeLabel = (type) => typeof type === 'string' && type.length > 0 ? type.charAt(0).toUpperCase() + type.slice(1) : '';

const Hero = ({ className, catalogs, selected, onResetSelection, onImage, onTonight, tonightLoading }) => {
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
    const heading = useLangLogo(active?.type, active?.id, extras?.logo, active?.name);
    const image = active ? extras?.background ?? active.background ?? active.poster : null;
    React.useEffect(() => {
        if (typeof onImage === 'function') onImage(image);
    }, [image]);

    if (active === null) return null;

    const meta = [
        extras?.releaseInfo ?? extras?.year,
        extras?.runtime,
        extras?.imdbRating ? `IMDb ${extras.imdbRating}` : null,
        Array.isArray(extras?.genres) ? extras.genres.slice(0, 3).join(', ') : null
    ].filter(Boolean);
    const tabIndex = isTvMode() ? 0 : -1;

    return (
        <div className={classnames(className, styles['hero-container'])}>
            <div key={active.id} className={styles['hero-info']}>
                <div className={styles['hero-type']}>
                    {active.tonight ? <span className={styles['hero-badge']}>{lt('tonightBadge')}</span> : null}
                    {t(`TYPE_${active.type}`, { defaultValue: typeLabel(active.type) })}
                </div>
                {
                    heading.logo ?
                        <img key={heading.logo} className={styles['hero-logo']} src={heading.logo} alt={heading.title} title={heading.title} />
                        :
                        <div className={styles['hero-title']} title={heading.title} style={heading.pending ? { visibility: 'hidden' } : null}>{heading.title}</div>
                }
                {meta.length > 0 ? <div className={styles['hero-meta']}>{meta.join('  ·  ')}</div> : null}
                {extras?.description ? <div className={styles['hero-description']}>{extras.description}</div> : null}
                <div className={styles['hero-buttons']}>
                    {
                        active.href ?
                            <Button className={styles['hero-button']} href={active.href} tabIndex={tabIndex}>
                                <Icon className={styles['hero-button-icon']} name={'play'} />
                                <div className={styles['hero-button-label']}>{lt('details')}</div>
                            </Button>
                            :
                            null
                    }
                    {
                        typeof onTonight === 'function' ?
                            <Button className={classnames(styles['hero-button'], styles['secondary'], { [styles['loading']]: tonightLoading })}
                                tabIndex={tabIndex} onClick={onTonight}>
                                <svg className={styles['hero-button-icon']} viewBox={'0 0 24 24'} aria-hidden={'true'}>
                                    <rect x={'3'} y={'3'} width={'18'} height={'18'} rx={'4.5'} fill={'none'} stroke={'currentColor'} strokeWidth={'2'} />
                                    <circle cx={'8.5'} cy={'8.5'} r={'1.6'} fill={'currentColor'} />
                                    <circle cx={'12'} cy={'12'} r={'1.6'} fill={'currentColor'} />
                                    <circle cx={'15.5'} cy={'15.5'} r={'1.6'} fill={'currentColor'} />
                                </svg>
                                <div className={styles['hero-button-label']}>{lt(active.tonight ? 'tonightAnother' : 'tonight')}</div>
                            </Button>
                            :
                            null
                    }
                </div>
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
    onResetSelection: PropTypes.func,
    onImage: PropTypes.func,
    onTonight: PropTypes.func,
    tonightLoading: PropTypes.bool
};

Hero.backgroundFor = backgroundFor;

module.exports = Hero;
