import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMatch } from 'react-router';
import { UpdateBanner } from 'stremio/components';
import { usePlatform } from 'stremio/common/Platform';
import { useLumenText } from 'stremio/common/lumenText';
import useLumenRelease from './useLumenRelease';
import styles from './WebUpdateScreen.less';

// Hlásí novou verzi Lumenu z GitHub releases. V macOS appce se nová verze stáhne, nainstaluje a Lumen se restartuje, jinde se otevře stránka vydání.
const LumenReleaseBanner = () => {
    const { t } = useTranslation();
    const lt = useLumenText();
    const { shell } = usePlatform();
    const isPlayer = useMatch('/player/*');
    const { release, visible, dismiss } = useLumenRelease();
    const [installing, setInstalling] = useState(false);
    const isMac = !!shell.state.version && shell.state.version.startsWith('lumen-macos');

    const onAction = useCallback(() => {
        if (!release) return;
        if (isMac && release.dmgUrl) {
            setInstalling(true);
            shell.send('lumen-update', release.dmgUrl);
            return;
        }
        window.open(release.pageUrl, '_blank');
        dismiss();
    }, [release, isMac, shell, dismiss]);

    return (
        <UpdateBanner
            className={styles['web-update-banner']}
            visible={visible && isPlayer === null}
            label={installing ? lt('lumenInstalling') : `${lt('lumenNewVersion')} ${release ? release.version : ''}`}
            actionLabel={installing ? '…' : isMac && release?.dmgUrl ? lt('lumenUpdate') : lt('lumenWhatsNew')}
            closeLabel={t('BUTTON_CLOSE')}
            onAction={installing ? () => undefined : onAction}
            onClose={dismiss}
        />
    );
};

export default LumenReleaseBanner;
