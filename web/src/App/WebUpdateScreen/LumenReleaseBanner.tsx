import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMatch } from 'react-router';
import { UpdateBanner } from 'stremio/components';
import { usePlatform } from 'stremio/common/Platform';
import { useLumenText } from 'stremio/common/lumenText';
import useLumenRelease from './useLumenRelease';
const { isTvMode } = require('stremio/common/tvNavigation');
import styles from './WebUpdateScreen.less';

type Progress = { state: 'downloading' | 'installing' | 'permission' | 'error', percent: number, detail: string };

// Hlásí novou verzi Lumenu z GitHub releases. V macOS i Windows appce se nová verze stáhne, nainstaluje a Lumen se sám
// restartuje (Windows: instalátor potichu, s kontrolou SHA-256), jinde se otevře stránka vydání.
// Android TV: obal stáhne APK a Android ukáže okno pro potvrzení instalace (poprvé může chtít povolit instalaci aplikací).
const LumenReleaseBanner = () => {
    const { t } = useTranslation();
    const lt = useLumenText();
    const { shell } = usePlatform();
    const isPlayer = useMatch('/player/*');
    const shellVersion = shell.state.version || '';
    const isMac = shellVersion.startsWith('lumen-macos');
    // osobní vydání se samo neaktualizuje (veřejný instalátor by ho přepsal veřejnou verzí)
    const isWin = shellVersion.startsWith('lumen ') && process.env.LUMEN_EDITION === 'public';
    // Android TV: stránku vydání na televizi otevřít nejde, proto se nabízí jen aktualizace přímo v aplikaci
    const isAndroid = shellVersion.startsWith('lumen-android');
    const { release, visible, dismiss } = useLumenRelease(isMac ? 'mac' : isWin ? 'win' : isAndroid ? 'android' : null);
    const [progress, setProgress] = useState<Progress | null>(null);

    useEffect(() => {
        if (!isWin && !isAndroid) return;
        const onStatus = (data: any) => {
            if (data && data.state === 'idle') {
                setProgress(null);   // instalace zrušená v okně Androidu
            } else if (data && ['downloading', 'installing', 'permission', 'error'].includes(data.state)) {
                setProgress({ state: data.state, percent: data.percent || 0, detail: data.detail || '' });
            }
        };
        shell.on('lumen-update-status', onStatus);
        return () => shell.off('lumen-update-status', onStatus);
    }, [isWin, isAndroid]);

    const onAction = useCallback(() => {
        if (!release) return;
        if (progress && progress.state !== 'error' && progress.state !== 'permission') return;
        if (isMac && release.dmgUrl) {
            setProgress({ state: 'installing', percent: 0, detail: '' });
            shell.send('lumen-update', release.dmgUrl);
        } else if (isWin && release.exeUrl && release.exeSha) {
            setProgress({ state: 'downloading', percent: 0, detail: '' });
            shell.send('lumen-update', release.exeUrl, release.exeSha);
        } else if (isAndroid && release.apkUrl) {
            setProgress({ state: 'downloading', percent: 0, detail: '' });
            shell.send('lumen-update', release.apkUrl, release.apkSha || '');
        } else {
            window.open(release.pageUrl, '_blank');
            dismiss();
        }
    }, [release, isMac, isWin, isAndroid, progress, shell, dismiss]);

    // Ovladač: lišta je přilepená dole přes dlaždice, šipkou dolů se k ní skoro nedá dojet. Proto na ni zvýraznění
    // skočí samo, jednou pro každou verzi, až nebude otevřené okno (např. výběr profilu po spuštění).
    const shown = (visible || (progress !== null && release !== null)) && isPlayer === null;
    const focusedFor = useRef<string | null>(null);
    useEffect(() => {
        if (!shown || !release || !isTvMode() || focusedFor.current === release.version) return;
        let timer: ReturnType<typeof setTimeout>;
        const tryFocus = () => {
            const button = document.querySelector(`.${styles['web-update-banner']} [class*="button"]`) as HTMLElement | null;
            if (button && !document.querySelector('[role="dialog"], [aria-modal="true"], .modals-container > *')) {
                focusedFor.current = release.version;
                button.focus();
            } else {
                timer = setTimeout(tryFocus, 700);
            }
        };
        timer = setTimeout(tryFocus, 700);
        return () => clearTimeout(timer);
    }, [shown, release]);

    const version = release ? release.version : '';
    let label = `${lt('lumenNewVersion')} ${version}`;
    let actionLabel = (isMac && release?.dmgUrl) || (isWin && release?.exeUrl) || (isAndroid && release?.apkUrl) ? lt('lumenUpdate') : lt('lumenWhatsNew');
    if (progress && progress.state === 'downloading') {
        label = `${lt('lumenDownloading')} ${version}`;
        actionLabel = `${progress.percent} %`;
    } else if (progress && progress.state === 'installing') {
        label = lt(isAndroid ? 'lumenInstallingTV' : 'lumenInstalling');
        actionLabel = '…';
    } else if (progress && progress.state === 'permission') {
        label = lt('lumenUpdatePermissionTV');
        actionLabel = lt('lumenUpdate');
    } else if (progress && progress.state === 'error') {
        label = lt(isAndroid ? 'lumenUpdateFailedTV' : 'lumenUpdateFailed');
        actionLabel = isAndroid ? lt('lumenUpdate') : lt('lumenWhatsNew');
    }

    // Android: po chybě tlačítko zkusí aktualizaci znovu (stránka vydání by na televizi nešla otevřít)
    const onError = isAndroid ? onAction : () => { if (release) window.open(release.pageUrl, '_blank'); dismiss(); setProgress(null); };

    return (
        <UpdateBanner
            className={styles['web-update-banner']}
            visible={shown}
            label={label}
            actionLabel={actionLabel}
            closeLabel={t('BUTTON_CLOSE')}
            onAction={progress && progress.state === 'error' ? onError : onAction}
            onClose={() => { if (!progress || progress.state === 'error') { dismiss(); setProgress(null); } }}
        />
    );
};

export default LumenReleaseBanner;
