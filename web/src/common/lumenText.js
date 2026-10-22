// Lumen: texty, které přibyly navíc proti původnímu Stremiu (čeština a angličtina podle jazyka rozhraní).

const React = require('react');
const { useTranslation } = require('react-i18next');

const DICT = {
    details: { cs: 'Detail', en: 'Details' },
    featured: { cs: 'Doporučené', en: 'Featured' },
    all: { cs: 'Vše', en: 'All' },
    // velikost náhledů
    densityLarge: { cs: 'Velké náhledy (méně)', en: 'Large previews (fewer)' },
    densityMedium: { cs: 'Střední náhledy', en: 'Medium previews' },
    densitySmall: { cs: 'Malé náhledy (více)', en: 'Small previews (more)' },
    previewSize: { cs: 'Velikost náhledů', en: 'Preview size' },
    // preference zdrojů
    prefLanguage: { cs: 'Jazyk', en: 'Language' },
    prefQuality: { cs: 'Kvalita', en: 'Quality' },
    langCsEn: { cs: 'Česky, pak anglicky', en: 'Czech, then English' },
    langEn: { cs: 'Anglicky', en: 'English' },
    langAny: { cs: 'Jakýkoli jazyk', en: 'Any language' },
    q4k: { cs: 'Jen 4K', en: '4K only' },
    qFullHd: { cs: 'Full HD a víc', en: 'Full HD +' },
    qAny: { cs: 'Jakákoli kvalita', en: 'Any quality' },
    lowerHidden: { cs: 'horších skryto', en: 'lower quality hidden' },
    // import addonů
    importButton: { cs: 'Import', en: 'Import' },
    importTitle: { cs: 'Import addonů', en: 'Import addons' },
    importHint: { cs: 'Import více addonů najednou', en: 'Import several addons at once' },
    importNotice: {
        cs: 'Vložte své vlastní adresy addonů, jednu na řádek (například odkazy zkopírované ze stránek addonů). Addony se jen nainstalují, v aplikaci nic přibaleno není. Adresy mohou obsahovat osobní klíče, proto se nikam nezapisují.',
        en: 'Paste your own addon URLs, one per line (for example the links you copied from your addons\' configuration pages). The addons are only installed; nothing is bundled with the app. Links can contain personal keys, so they are never logged.'
    },
    importCancel: { cs: 'Zrušit', en: 'Cancel' },
    importInstall: { cs: 'Nainstalovat vše', en: 'Install all' },
    importInstalling: { cs: 'Instaluji…', en: 'Installing…' },
    importNoUrls: { cs: 'Nenašel jsem žádnou platnou adresu addonu.', en: 'No valid addon URLs found.' },
    importInstalled: { cs: 'Nainstalováno', en: 'Installed' },
    importFailed: { cs: 'Nepodařilo se načíst addon(y)', en: 'Could not load addon(s)' },
    importLines: { cs: 'řádky', en: 'lines' },
    // titulky
    loadSubtitles: { cs: 'Načíst titulky ze souboru (.srt, .vtt)', en: 'Load subtitles from file (.srt, .vtt)' },
    // nápověda
    helpTab: { cs: 'Nápověda', en: 'Help' }
};

const languageOf = (i18nLanguage) => typeof i18nLanguage === 'string' && i18nLanguage.toLowerCase().startsWith('cs') ? 'cs' : 'en';

const useLumenText = () => {
    const { i18n } = useTranslation();
    const language = languageOf(i18n.language);
    return React.useCallback((key) => DICT[key]?.[language] ?? DICT[key]?.en ?? key, [language]);
};

module.exports = { useLumenText, languageOf };
