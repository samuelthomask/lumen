import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMatch } from 'react-router';
import { UpdateBanner } from 'stremio/components';
import { usePlatform } from 'stremio/common/Platform';
import { useLumenText } from 'stremio/common/lumenText';
import useLumenRelease from './useLumenRelease';
import styles from './WebUpdateScreen.less';

type Progress = { state: 'downloading' | 'installing' | 'error', percent: number, detail: string };

// Hlásí novou verzi Lumenu z GitHub releases. V macOS i Windows appce se nová verze stáhne, nainstaluje a Lumen se sám
// restartuje (Windows: instalátor potichu, s kontrolou SHA-256), jinde se otevře stránka vydání.
const LumenReleaseBanner = () => {
    const { t } = useTranslation();
    const lt = useLumenText();
    const { shell } = usePlatform();
    const isPlayer = useMatch('/player/*');
    const shellVersion = shell.state.version || '';
    const isMac = shellVersion.startsWith('lumen-macos');
    // osobní vydání se samo neaktualizuje (veřejný instalátor by ho přepsal veřejnou verzí)
    const isWin = shellVersion.startsWith('lumen ') && process.env.LUMEN_EDITION === 'public';
    const { release, visible, dismiss } = useLumenRelease(isMac ? 'mac' : isWin ? 'win' : null);
    const [progress, setProgress] = useState<Progress | null>(null);

    useEffect(() => {
        if (!isWin) return;
        const onStatus = (data: any) => {
            if (data && (data.state === 'downloading' || data.state === 'installing' || data.state === 'error')) {
                setProgress({ state: data.state, percent: data.percent || 0, detail: data.detail || '' });
            }
        };
        shell.on('lumen-update-status', onStatus);
        return () => shell.off('lumen-update-status', onStatus);
    }, [isWin]);

    const onAction = useCallback(() => {
        if (!release) return;
        if (progress && progress.state !== 'error') return;
        if (isMac && release.dmgUrl) {
            setProgress({ state: 'installing', percent: 0, detail: '' });
            shell.send('lumen-update', release.dmgUrl);
        } else if (isWin && release.exeUrl && release.exeSha) {
            setProgress({ state: 'downloading', percent: 0, detail: '' });
            shell.send('lumen-update', release.exeUrl, release.exeSha);
        } else {
            window.open(release.pageUrl, '_blank');
            dismiss();
        }
    }, [release, isMac, isWin, progress, shell, dismiss]);

    const version = release ? release.version : '';
    let label = `${lt('lumenNewVersion')} ${version}`;
    let actionLabel = (isMac && release?.dmgUrl) || (isWin && release?.exeUrl) ? lt('lumenUpdate') : lt('lumenWhatsNew');
    if (progress && progress.state === 'downloading') {
        label = `${lt('lumenDownloading')} ${version}`;
        actionLabel = `${progress.percent} %`;
    } else if (progress && progress.state === 'installing') {
        label = lt('lumenInstalling');
        actionLabel = '…';
    } else if (progress && progress.state === 'error') {
        label = lt('lumenUpdateFailed');
        actionLabel = lt('lumenWhatsNew');
    }

    return (
        <UpdateBanner
            className={styles['web-update-banner']}
            visible={(visible || (progress !== null && release !== null)) && isPlayer === null}
            label={label}
            actionLabel={actionLabel}
            closeLabel={t('BUTTON_CLOSE')}
            onAction={progress && progress.state === 'error' ? () => { if (release) window.open(release.pageUrl, '_blank'); dismiss(); setProgress(null); } : onAction}
            onClose={() => { if (!progress || progress.state === 'error') { dismiss(); setProgress(null); } }}
        />
    );
};

export default LumenReleaseBanner;
