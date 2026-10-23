import React, { forwardRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useCore } from 'stremio/core';
import { Toggle } from 'stremio/components';
import { useDiscord } from 'stremio/common';
import { Section, Option, Link } from '../components';
// @ts-ignore
import ProfilesSection from './ProfilesSection';
import styles from './General.less';

type Props = {
    profile: Profile,
};

// Lumen: bez účtů – žádné přihlášení ani služby vázané na účet; jen informace o aplikaci a volitelné Discord.
const SOURCE_URL = process.env.LUMEN_REPO_URL;

const General = forwardRef<HTMLDivElement, Props>(({ profile }: Props, ref) => {
    const { t, i18n } = useTranslation();
    const core = useCore();
    const discord = useDiscord();
    const czech = typeof i18n.language === 'string' && i18n.language.toLowerCase().startsWith('cs');

    const discordToggle = useMemo(() => ({
        checked: profile.settings.discordRpcEnabled === true,
        onClick: () => {
            core.transport.dispatch({
                action: 'Ctx',
                args: {
                    action: 'UpdateSettings',
                    args: {
                        ...profile.settings,
                        discordRpcEnabled: !profile.settings.discordRpcEnabled
                    }
                }
            });
        }
    }), [profile.settings]);

    return <>
        <Section ref={ref}>
            <div className={styles['lumen-about']}>
                <div className={styles['lumen-about-name']}>Lumen</div>
                <div className={styles['lumen-about-text']}>
                    {czech ?
                        'Přehrávač a prohlížeč katalogů. Bez účtů: knihovna, pokračování ve sledování i nastavení zůstávají jen v tomto počítači.' :
                        'A player and catalog browser. No accounts: your library, continue watching and settings stay on this computer only.'}
                </div>
            </div>
        </Section>

        <Section>
            <ProfilesSection />
        </Section>

        <Section>
            {
                SOURCE_URL ?
                    <Link
                        label={t('SETTINGS_SOURCE_CODE')}
                        href={SOURCE_URL}
                    />
                    :
                    null
            }
            {
                discord.available &&
                    <Option className={styles['discord-container']} icon={'discord'} label={'SETTINGS_DISCORD'}>
                        <Toggle
                            tabIndex={-1}
                            {...discordToggle}
                        />
                    </Option>
            }
        </Section>
    </>;
});

export default General;
