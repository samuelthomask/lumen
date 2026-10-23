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
    // účet
    accountSection: { cs: 'Účet', en: 'Account' },
    accountIntro: {
        cs: 'Volitelné. S účtem se profily, addony, knihovna, rozkoukané díly i nastavení samy synchronizují mezi zařízeními. Data se šifrují vaším heslem ještě v zařízení, správce serveru je přečíst nemůže. Bez účtu Lumen funguje stejně jako dosud.',
        en: 'Optional. With an account your profiles, addons, library, continue watching and settings sync between devices automatically. Data is encrypted with your password on the device, the server admin cannot read it. Without an account Lumen works just as before.'
    },
    accountSignIn: { cs: 'Přihlásit se', en: 'Sign in' },
    accountSignUp: { cs: 'Vytvořit účet', en: 'Create account' },
    accountSignOut: { cs: 'Odhlásit se', en: 'Sign out' },
    accountSignedAs: { cs: 'Přihlášeno jako', en: 'Signed in as' },
    accountSyncNow: { cs: 'Synchronizovat teď', en: 'Sync now' },
    accountSyncing: { cs: 'Synchronizuji…', en: 'Syncing…' },
    accountLastSync: { cs: 'Naposledy synchronizováno', en: 'Last synced' },
    accountDelete: { cs: 'Smazat účet', en: 'Delete account' },
    accountPrivacy: { cs: 'Zásady ochrany soukromí', en: 'Privacy policy' },
    accountEmail: { cs: 'E-mail', en: 'Email' },
    accountPassword: { cs: 'Heslo (aspoň 8 znaků)', en: 'Password (at least 8 characters)' },
    accountPasswordAgain: { cs: 'Heslo znovu', en: 'Password again' },
    accountNewPassword: { cs: 'Nové heslo (aspoň 8 znaků)', en: 'New password (at least 8 characters)' },
    accountForgot: { cs: 'Zapomenuté heslo', en: 'Forgot password' },
    accountCode: { cs: 'Kód z e-mailu', en: 'Code from the email' },
    accountCodeSent: {
        cs: 'Poslali jsme vám e-mail s kódem. Opište ho sem (pokud nepřišel, podívejte se i do spamu).',
        en: 'We sent you an email with a code. Enter it here (if it did not arrive, check your spam folder too).'
    },
    accountConfirmSent: {
        cs: 'Poslali jsme vám e-mail s kódem pro potvrzení účtu. Opište ho sem (pokud nepřišel, podívejte se i do spamu).',
        en: 'We sent you an email with a code to confirm your account. Enter it here (if it did not arrive, check your spam folder too).'
    },
    accountSendCode: { cs: 'Poslat kód', en: 'Send code' },
    accountResetHint: {
        cs: 'Pošleme vám kód pro nastavení nového hesla. Data v účtu jsou zašifrovaná starým heslem, proto se po změně nahradí daty z tohoto zařízení. Obnovu proto dělejte na zařízení, kde máte svá data.',
        en: 'We will send you a code to set a new password. The data in your account is encrypted with the old password, so after the change it is replaced with the data from this device. Do the reset on a device that has your data.'
    },
    accountChoiceTitle: { cs: 'Účet už obsahuje data', en: 'The account already has data' },
    accountChoiceText: {
        cs: 'Chcete v tomto zařízení použít data z účtu (stávající profily v zařízení se nahradí), nebo naopak nahrát do účtu data z tohoto zařízení?',
        en: 'Do you want to use the account data on this device (the profiles on this device will be replaced), or upload this device\'s data to the account instead?'
    },
    accountUseCloud: { cs: 'Použít data z účtu', en: 'Use account data' },
    accountUseDevice: { cs: 'Nahrát z tohoto zařízení', en: 'Upload from this device' },
    accountDeleteText: {
        cs: 'Účet i všechna data v něm budou trvale smazána. Data v tomto zařízení zůstanou.',
        en: 'The account and all its data will be permanently deleted. The data on this device stays.'
    },
    accountDeleteConfirm: { cs: 'Trvale smazat', en: 'Delete permanently' },
    accountContinue: { cs: 'Pokračovat', en: 'Continue' },
    accountCancel: { cs: 'Zrušit', en: 'Cancel' },
    accountPasswordMismatch: { cs: 'Hesla se neshodují.', en: 'The passwords do not match.' },
    accountPasswordShort: { cs: 'Heslo musí mít aspoň 8 znaků.', en: 'The password must have at least 8 characters.' },
    accountForgetWarning: {
        cs: 'Heslo si dobře zapamatujte: šifruje vaše data a nikdo jiný ho nezná.',
        en: 'Remember your password well: it encrypts your data and nobody else knows it.'
    },
    accountErr_credentials: { cs: 'Špatný e-mail nebo heslo.', en: 'Wrong email or password.' },
    accountErr_unconfirmed: { cs: 'E-mail ještě není potvrzený.', en: 'The email is not confirmed yet.' },
    accountErr_exists: { cs: 'Účet s tímto e-mailem už existuje.', en: 'An account with this email already exists.' },
    accountErr_code: { cs: 'Kód je špatný nebo už vypršel.', en: 'The code is wrong or has expired.' },
    accountErr_weak: { cs: 'Heslo je příliš slabé.', en: 'The password is too weak.' },
    accountErr_rate: { cs: 'Příliš mnoho pokusů, zkuste to za chvíli.', en: 'Too many attempts, try again later.' },
    accountErr_network: { cs: 'Nepodařilo se spojit se serverem.', en: 'Could not reach the server.' },
    accountErr_auth: { cs: 'Přihlášení vypršelo, přihlaste se znovu.', en: 'Your session expired, please sign in again.' },
    accountErr_relogin: { cs: 'Heslo bylo změněno na jiném zařízení. Přihlaste se znovu.', en: 'The password was changed on another device. Please sign in again.' },
    accountErr_decrypt: { cs: 'Data v účtu nejde odemknout tímto heslem.', en: 'The account data cannot be unlocked with this password.' },
    accountErr_server: { cs: 'Server vrátil chybu, zkuste to znovu.', en: 'The server returned an error, please try again.' },
    accountPrivacyText: {
        cs: 'Účet je dobrovolný. Ukládá se: váš e-mail (jen kvůli přihlášení a obnově hesla), čas posledního přihlášení a zašifrovaný balík dat (profily, addony, knihovna, rozkoukané díly, nastavení). Balík se šifruje v zařízení klíčem z vašeho hesla (AES-256); heslo ani klíč se nikam neposílají, správce serveru proto obsah nevidí. Data jsou uložena u služby Supabase. Nic se neprodává ani nesdílí, žádná reklama ani sledování. Tlačítkem Smazat účet se účet i data trvale odstraní.',
        en: 'The account is optional. Stored: your email (only for sign-in and password reset), the time of your last sign-in and an encrypted bundle (profiles, addons, library, continue watching, settings). The bundle is encrypted on your device with a key derived from your password (AES-256); neither the password nor the key is ever sent, so the server admin cannot see the contents. Data is stored with Supabase. Nothing is sold or shared, no ads or tracking. Delete account permanently removes the account and its data.'
    },
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
