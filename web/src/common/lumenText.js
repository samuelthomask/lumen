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
    // profily
    whoWatching: { cs: 'Kdo se dívá?', en: "Who's watching?" },
    manageProfiles: { cs: 'Spravovat profily', en: 'Manage profiles' },
    doneManaging: { cs: 'Hotovo', en: 'Done' },
    addProfile: { cs: 'Přidat profil', en: 'Add profile' },
    editProfile: { cs: 'Upravit profil', en: 'Edit profile' },
    profileName: { cs: 'Jméno', en: 'Name' },
    profileColor: { cs: 'Barva', en: 'Color' },
    profilePin: { cs: 'PIN (volitelný)', en: 'PIN (optional)' },
    profilePinKeep: { cs: 'Ponechte prázdné, aby se PIN nezměnil', en: 'Leave empty to keep the PIN' },
    profilePinRemove: { cs: 'Odstranit PIN', en: 'Remove PIN' },
    profileSave: { cs: 'Uložit', en: 'Save' },
    profileDelete: { cs: 'Smazat profil', en: 'Delete profile' },
    profileDeleteConfirm: { cs: 'Opravdu smazat profil a všechna jeho data (addony, knihovnu, pokračování)?', en: 'Really delete this profile and all its data (addons, library, continue watching)?' },
    profileEnterPin: { cs: 'Zadejte PIN profilu', en: 'Enter the profile PIN' },
    profileWrongPin: { cs: 'Nesprávný PIN', en: 'Wrong PIN' },
    profileContinue: { cs: 'Pokračovat', en: 'Continue' },
    profilesSection: { cs: 'Profily', en: 'Profiles' },
    profileCurrent: { cs: 'Aktuální profil', en: 'Current profile' },
    profileSwitch: { cs: 'Změnit profil', en: 'Switch profile' },
    profileExport: { cs: 'Exportovat profily do souboru…', en: 'Export profiles to file…' },
    profileImport: { cs: 'Importovat profily ze souboru…', en: 'Import profiles from file…' },
    profileExportHint: { cs: 'Soubor .lumen obsahuje addony, knihovnu i pokračování ve sledování všech profilů. Adresy addonů mohou obsahovat osobní klíče, proto doporučujeme soubor zašifrovat heslem.', en: 'The .lumen file contains the addons, library and continue watching of all profiles. Addon URLs can contain personal keys, so we recommend protecting the file with a password.' },
    profilePassword: { cs: 'Heslo souboru (nepovinné)', en: 'File password (optional)' },
    profilePasswordAsk: { cs: 'Soubor je zašifrovaný. Zadejte heslo.', en: 'This file is encrypted. Enter the password.' },
    profileWrongPassword: { cs: 'Nesprávné heslo', en: 'Wrong password' },
    profileBadFile: { cs: 'Tohle není platný soubor profilů Lumenu', en: 'This is not a valid Lumen profiles file' },
    profileExported: { cs: 'Soubor uložen', en: 'File saved' },
    profileImported: { cs: 'Naimportováno profilů', en: 'Profiles imported' },
    profileCancel: { cs: 'Zrušit', en: 'Cancel' },
    profileTransferHint: { cs: 'Chcete profily a rozkoukané filmy přenést na jiné zařízení? V Nastavení → Profily je exportujte do souboru .lumen, pošlete si ho a na novém zařízení importujte.', en: 'Want to move your profiles and what you were watching to another device? Export them to a .lumen file in Settings → Profiles, send it to yourself and import it on the new device.' },
    profileSwitchNote: { cs: 'Aplikace se při přepnutí načte znovu.', en: 'The app reloads when you switch.' },
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
