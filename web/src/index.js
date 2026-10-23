// Copyright (C) 2017-2023 Smart code 203358507

if (typeof process.env.SENTRY_DSN === 'string') {
    const Sentry = require('@sentry/browser');
    Sentry.init({ dsn: process.env.SENTRY_DSN });
}

require('stremio/common/density');
const Bowser = require('bowser');
const browser = Bowser.parse(window.navigator?.userAgent || '');
if (browser?.platform?.type === 'desktop') {
    document.querySelector('meta[name="viewport"]')?.setAttribute('content', '');
}

const React = require('react');
const ReactDOM = require('react-dom/client');
const { HashRouter } = require('react-router-dom');
const i18n = require('i18next');
const { initReactI18next } = require('react-i18next');
const stremioTranslations = require('stremio-translations');
const App = require('./App');
const { default: WebUpdateScreen } = require('./App/WebUpdateScreen');
const { CoreProvider } = require('./core');
const { FileDropProvider, PlatformProvider } = require('./common');
const profiles = require('./common/profiles');
const { ProfilePicker } = require('./App/ProfilePicker/ProfilePicker');

// Lumen: názvy "Stremio" v překladech nahradit názvem aplikace (název a značka Stremia nepoužíváme)
const rebrand = (text) => typeof text === 'string' ? text.replace(/Stremio/g, 'Lumen').replace(/STREMIO/g, 'LUMEN') : text;
const COMMUNITY_ADDON_LABEL = { cs: 'Komunitní addon', en: 'Community addon' };
const translations = Object.fromEntries(Object.entries(stremioTranslations()).map(([key, value]) => [key, {
    translation: Object.fromEntries(Object.entries(value).map(([textKey, text]) => [
        textKey,
        textKey === 'STREMIO_COMMUNITY_ADDON' ? (key.toLowerCase().startsWith('cs') ? COMMUNITY_ADDON_LABEL.cs : COMMUNITY_ADDON_LABEL.en) : rebrand(text)
    ]))
}]));

i18n
    .use(initReactI18next)
    .init({
        resources: translations,
        lng: 'en-US',
        fallbackLng: 'en-US',
        interpolation: {
            escapeValue: false
        }
    });

const appInfo = {
    appVersion: process.env.VERSION,
    shellVersion: null
};

// Lumen: profily. Před spuštěním jádra se případně přepne profil a při více profilech se zobrazí jejich výběr.
profiles.init();
try {
    const stored = JSON.parse(window.localStorage.getItem('profile'));
    const lang = stored && stored.settings && stored.settings.interfaceLanguage;
    if (typeof lang === 'string') i18n.changeLanguage(lang);
    else if (window.localStorage.getItem('lumen.langInit') !== '1') i18n.changeLanguage('cs-CZ');
} catch (_) {
    // jazyk se nastaví až po startu jádra
}

const Root = () => {
    const [picked, setPicked] = React.useState(!profiles.needsPicker());
    if (!picked) {
        return <ProfilePicker onDone={(profile) => { profiles.switchLocal(profile.id); setPicked(true); }} />;
    }
    return (
        <PlatformProvider>
            <CoreProvider appInfo={appInfo}>
                <FileDropProvider>
                    <HashRouter>
                        <>
                            <WebUpdateScreen />
                            <App />
                        </>
                    </HashRouter>
                </FileDropProvider>
            </CoreProvider>
        </PlatformProvider>
    );
};

const root = ReactDOM.createRoot(document.getElementById('app'));
root.render(
    <React.StrictMode>
        <Root />
    </React.StrictMode>
);
