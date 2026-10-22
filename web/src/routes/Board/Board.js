// Copyright (C) 2017-2023 Smart code 203358507

const React = require('react');
const classnames = require('classnames');
const useTranslate = require('stremio/common/useTranslate');
const { default: useVisibleCatalogs } = require('stremio/common/useVisibleCatalogs');
const { useStreamingServer, useNotifications, withCoreSuspender, useProfile } = require('stremio/common');
const { ContinueWatchingItem, EventModal, LiveTvContinueWatchingItem, MainNavBars, MetaItem, MetaRow } = require('stremio/components');
const useBoard = require('./useBoard');
const useContinueWatchingPreview = require('./useContinueWatchingPreview');
const { default: useLiveTvContinueWatching } = require('./useLiveTvContinueWatching');
const styles = require('./styles');
const { default: StreamingServerWarning } = require('./StreamingServerWarning');
const Hero = require('./Hero');

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
    return (
        <div className={styles['board-container']}>
            <EventModal />
            <SelectionContext.Provider value={selection}>
            <MainNavBars className={styles['board-content-container']} route={'board'}>
                <div ref={scrollContainerRef} className={styles['board-content']} onScroll={onScroll}>
                    <Hero catalogs={board.catalogs} selected={selectedItem} onResetSelection={() => setSelectedItem(null)} />
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
