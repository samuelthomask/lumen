// Copyright (C) 2017-2023 Smart code 203358507

const React = require('react');
const classnames = require('classnames');
const useTranslate = require('stremio/common/useTranslate');
const { default: useVisibleCatalogs } = require('stremio/common/useVisibleCatalogs');
const { useStreamingServer, useNotifications, withCoreSuspender, useProfile } = require('stremio/common');
const { ContinueWatchingItem, LiveTvContinueWatchingItem, MainNavBars, MetaItem, MetaRow } = require('stremio/components');
const useBoard = require('./useBoard');
const useContinueWatchingPreview = require('./useContinueWatchingPreview');
const { default: useLiveTvContinueWatching } = require('./useLiveTvContinueWatching');
const styles = require('./styles');
const { default: StreamingServerWarning } = require('./StreamingServerWarning');
const { isTvMode } = require('stremio/common/tvNavigation');
const Hero = require('./Hero');
const pickTonight = require('./Hero/tonight');
const { useLumenText } = require('stremio/common/lumenText');
const { useAmbientImage } = require('stremio/common/lumenTheme');

const THRESHOLD = 5;

// Lumen: klik na dlaždici ji zobrazí v banneru; klik na už vybranou (nebo tlačítko v banneru) otevře detail.
const SelectionContext = React.createContext(null);

const SelectableMetaItem = (props) => {
    const selection = React.useContext(SelectionContext);
    const isSelected = selection !== null && selection.selectedId === props.id;
    const onClick = React.useCallback((event) => {
        if (selection !== null && !isSelected) {
            event.preventDefault();
            selection.select(props);
        }
    }, [selection, isSelected, props]);
    return <MetaItem {...props} className={classnames(props.className, { 'selected': isSelected })} onClick={onClick} />;
};

const toWide = (item) => ({ ...item, poster: Hero.backgroundFor(item.poster) ?? item.poster, posterShape: 'landscape' });

const Board = () => {
    const [selectedItem, setSelectedItem] = React.useState(null);
    const [backdrop, setBackdrop] = React.useState(null);
    const [tonightLoading, setTonightLoading] = React.useState(false);
    const backdropRef = React.useRef(null);
    const lt = useLumenText();
    useAmbientImage(backdrop);
    const t = useTranslate();
    const streamingServer = useStreamingServer();
    const continueWatchingPreview = useContinueWatchingPreview();
    const liveTvContinueWatching = useLiveTvContinueWatching();
    const [board, loadBoardRows] = useBoard();
    const notifications = useNotifications();
    const profile = useProfile();
    // Lumen: „Pokračovat ve sledování“ jako široké karty (pozadí titulu místo plakátu, pokud je k dispozici)
    const continueWatchingWide = React.useMemo(() => ({
        ...continueWatchingPreview,
        items: continueWatchingPreview.items.map((item) => ({
            ...item,
            poster: Hero.backgroundFor(item.poster) ?? item.poster,
            posterShape: 'landscape'
        }))
    }), [continueWatchingPreview]);
    const liveTvCatalog = React.useMemo(() => ({
        items: (Array.isArray(liveTvContinueWatching.items) ? liveTvContinueWatching.items : [])
            .map((item) => ({ ...item, posterShape: 'landscape' })),
    }), [liveTvContinueWatching.items]);
    const boardCatalogsOffset =
        (continueWatchingPreview.items.length > 0 ? 1 : 0) +
        (liveTvCatalog.items.length > 0 ? 1 : 0);
    const showStreamingServerWarning = React.useMemo(() => {
        // Lumen: Android TV server nemá (hraje jen přímé odkazy), upozornění by tam jen překáželo
        if (isTvMode()) return false;
        return streamingServer.settings !== null && streamingServer.settings.type === 'Err' && (
            isNaN(profile.settings.streamingServerWarningDismissed.getTime()) ||
            profile.settings.streamingServerWarningDismissed.getTime() < Date.now());
    }, [profile.settings, streamingServer.settings]);
    const { catalogRows, scrollContainerRef, onScroll } = useVisibleCatalogs({
        catalogs: board.catalogs,
        loadRange: loadBoardRows,
        leadingRows: boardCatalogsOffset,
        preloadRows: THRESHOLD,
    });
    const selection = React.useMemo(() => ({
        selectedId: selectedItem ? selectedItem.id : null,
        select: (item) => {
            setSelectedItem(item);
            if (scrollContainerRef.current) {
                scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
            }
        }
    }), [selectedItem, scrollContainerRef]);
    // Lumen „Kino“: obrázek za oknem při posouvání dolů pomalu mizí
    const onBoardScroll = React.useCallback((event) => {
        onScroll(event);
        if (backdropRef.current) {
            const top = event.currentTarget.scrollTop;
            backdropRef.current.style.opacity = String(Math.max(0, 1 - top / (window.innerHeight * 0.6)));
            backdropRef.current.style.transform = `translateY(${-top * 0.25}px)`;
        }
    }, [onScroll]);
    // Lumen: „Co dnes?“ vybere film a ukáže ho v úvodu jako vybraný titul
    const onTonight = React.useCallback(() => {
        if (tonightLoading) return;
        setTonightLoading(true);
        pickTonight(continueWatchingPreview.items)
            .then((pick) => {
                if (pick) selection.select(pick);
                else window.alert(lt('tonightFailed'));
            })
            .finally(() => setTonightLoading(false));
    }, [tonightLoading, continueWatchingPreview.items, selection, lt]);
    return (
        <div className={styles['board-container']}>
            <div ref={backdropRef} className={styles['board-backdrop']}>
                {backdrop ? <img key={backdrop} className={styles['board-backdrop-image']} src={backdrop} alt={' '} /> : null}
            </div>
            <SelectionContext.Provider value={selection}>
            <MainNavBars className={styles['board-content-container']} route={'board'}>
                <div ref={scrollContainerRef} className={styles['board-content']} onScroll={onBoardScroll}>
                    <Hero catalogs={board.catalogs} selected={selectedItem} onResetSelection={() => setSelectedItem(null)}
                        onImage={setBackdrop} onTonight={onTonight} tonightLoading={tonightLoading} />
                    {
                        continueWatchingPreview.items.length > 0 ?
                            <MetaRow
                                className={classnames(styles['board-row'], styles['board-row-landscape'], 'animation-fade-in')}
                                title={t.string('BOARD_CONTINUE_WATCHING')}
                                catalog={continueWatchingWide}
                                itemComponent={ContinueWatchingItem}
                                notifications={notifications}
                            />
                            :
                            null
                    }
                    {
                        liveTvCatalog.items.length > 0 ?
                            <MetaRow
                                className={classnames(styles['board-row'], styles['board-row-landscape'], 'animation-fade-in')}
                                title={t.string('BOARD_CONTINUE_WATCHING_LIVE')}
                                catalog={liveTvCatalog}
                                itemComponent={LiveTvContinueWatchingItem}
                                notifications={notifications}
                            />
                            :
                            null
                    }
                    {catalogRows.map(({ catalog, index }) => {
                        switch (catalog.content?.type) {
                            case 'Ready': {
                                return (
                                    <MetaRow
                                        key={index}
                                        className={classnames(styles['board-row'], styles['board-row-landscape'], 'animation-fade-in')}
                                        catalog={{ ...catalog, content: { ...catalog.content, content: catalog.content.content.map(toWide) } }}
                                        itemComponent={SelectableMetaItem}
                                    />
                                );
                            }
                            case 'Err': {
                                if (catalog.content.content !== 'EmptyContent') {
                                    return (
                                        <MetaRow
                                            key={index}
                                            className={classnames(styles['board-row'], 'animation-fade-in')}
                                            catalog={catalog}
                                            message={catalog.content.content}
                                        />
                                    );
                                }
                                return null;
                            }
                            default: {
                                return (
                                    <MetaRow.Placeholder
                                        key={index}
                                        className={classnames(styles['board-row'], styles['board-row-poster'], 'animation-fade-in')}
                                        catalog={catalog}
                                        title={t.catalogTitle(catalog)}
                                    />
                                );
                            }
                        }
                    })}
                </div>
            </MainNavBars>
            </SelectionContext.Provider>
            {
                showStreamingServerWarning ?
                    <StreamingServerWarning className={styles['board-warning-container']} />
                    :
                    null
            }
        </div>
    );
};

const BoardFallback = () => (
    <div className={styles['board-container']}>
        <MainNavBars className={styles['board-content-container']} route={'board'} />
    </div>
);

module.exports = withCoreSuspender(Board, BoardFallback);
