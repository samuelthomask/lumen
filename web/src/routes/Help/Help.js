// Lumen: nápověda (veřejná verze) – jak fungují addony, jak je importovat a co je debrid. Čeština a angličtina.
// Žádný obsah, žádné předinstalované ani doporučené konkrétní addony.
// Osobní vydání (LUMEN_EDITION=personal) načte soukromý soubor HelpPersonal.local.js, který není součástí repozitáře.

const React = require('react');
const { MainNavBars } = require('stremio/components');
const { useTranslation } = require('react-i18next');
const { languageOf } = require('stremio/common/lumenText');

let PersonalHelp = null;
if (process.env.LUMEN_EDITION === 'personal') {
    PersonalHelp = require('./HelpPersonal.local');
}

const REPO_URL = process.env.LUMEN_REPO_URL;
const ADDON_SDK_URL = 'https://github.com/Stremio/stremio-addon-sdk';

// Komunitní průvodce nastavením (stejný odkaz jako v README); konkrétní názvy addonů se tu neuvádějí.
const GUIDE_URL = 'https://rentry.co/4mmr8vxy';

const ProfilesHelp = require('./ProfilesHelp');

const link = (label, href) => (
    <a key={href} className={'lumen-help-link'} href={href} target={'_blank'} rel={'noopener noreferrer'}>{label}</a>
);

const TEXT = {
    cs: {
        title: 'Nápověda',
        lead: (<React.Fragment>Lumen je přehrávač a prohlížeč katalogů, <strong>bez obsahu a bez předinstalovaných addonů</strong>. Filmy a seriály dodávají <strong>addony</strong>, které si nainstalujete sami a za které odpovídáte.</React.Fragment>),
        addonsTitle: 'Co jsou addony',
        addonsText: 'Addon je malá služba na internetu, která Lumenu řekne, jaké katalogy a zdroje nabízí. Každý addon má svou adresu končící na manifest.json. Stejný formát používají i další aplikace.',
        howTitle: 'Jak addon přidat',
        steps: [
            (<React.Fragment>V záložce <strong>Addony</strong> najdete katalog komunitních addonů. Instalace je jedno kliknutí.</React.Fragment>),
            (<React.Fragment>Vlastní addon přidáte přes <strong>Addony → Přidat addon</strong> (jedna adresa), nebo přes <strong>Import</strong> (víc adres najednou, každá na novém řádku).</React.Fragment>),
            'Adresa addonu může obsahovat osobní klíče. Nesdílejte ji a nevkládejte ji do veřejných zpráv.',
            'U filmu nad seznamem zdrojů nastavíte pořadí: jazyk (česky, pak anglicky) a minimální kvalitu.'
        ],
        debridTitle: 'Co je debrid?',
        debridText: 'Některé addony umí použít placenou službu typu „debrid“. Ta zdroj stáhne na svých rychlých serverech a pošle vám ho jako obyčejné video, takže se film spustí za pár vteřin, nezasekává se a zvládne i velké soubory. Klíč ke službě se zadává na stránce konkrétního addonu, ne v Lumenu. Jestli službu potřebujete, záleží na addonu.',
        recTitle: 'Doporučené addony a služby',
        recText: 'Komunitní průvodce vysvětlí, jak Lumen nastavit, propojit debrid službu a nainstalovat doporučené addony. Konkrétní názvy zde z principu neuvádíme.',
        guide: '📖 Kompletní průvodce nastavením',
        moreTitle: 'Víc informací',
        moreText: 'Podrobnější popis funkcí, instalace a dokumentace je v projektu na GitHubu.',
        sdk: 'Jak addony fungují (technická dokumentace)',
        docs: 'Dokumentace Lumenu',
        warnTitle: 'Upozornění',
        warnText: 'Lumen žádný obsah neposkytuje ani nedoporučuje konkrétní zdroje. Používejte jen obsah, ke kterému máte právo. Za addony a služby třetích stran odpovídáte sami.'
    },
    en: {
        title: 'Help',
        lead: (<React.Fragment>Lumen is a player and catalog browser, <strong>with no content and no preinstalled addons</strong>. Movies and series come from <strong>addons</strong> that you install yourself and are responsible for.</React.Fragment>),
        addonsTitle: 'What are addons',
        addonsText: 'An addon is a small service on the internet that tells Lumen which catalogs and sources it offers. Every addon has an address ending with manifest.json. Other apps use the same format.',
        howTitle: 'How to add an addon',
        steps: [
            (<React.Fragment>The <strong>Addons</strong> tab has a catalog of community addons. Installing one is a single click.</React.Fragment>),
            (<React.Fragment>To add your own addon use <strong>Addons → Add addon</strong> (one address) or <strong>Import</strong> (several addresses at once, one per line).</React.Fragment>),
            'An addon address can contain personal keys. Do not share it or paste it into public messages.',
            'On a movie page, above the list of sources, you set the order: language (Czech, then English) and minimum quality.'
        ],
        debridTitle: 'What is debrid?',
        debridText: 'Some addons can use a paid "debrid" service. It downloads the source on its fast servers and sends it to you as an ordinary video, so the movie starts within seconds, does not stall and handles large files. The service key is entered on the page of the specific addon, not in Lumen. Whether you need such a service depends on the addon.',
        recTitle: 'Recommended addons and services',
        recText: 'The community guide explains how to set Lumen up, link a debrid service and install recommended addons. We do not list specific names here on principle.',
        guide: '📖 Complete setup guide',
        moreTitle: 'More information',
        moreText: 'A detailed description of features, installation and documentation is in the GitHub project.',
        sdk: 'How addons work (technical documentation)',
        docs: 'Lumen documentation',
        warnTitle: 'Notice',
        warnText: 'Lumen provides no content and does not recommend specific sources. Use only content you have the right to watch. You are responsible for third-party addons and services.'
    }
};

const Help = () => {
    const { i18n } = useTranslation();
    if (PersonalHelp !== null) return <PersonalHelp />;
    const tx = TEXT[languageOf(i18n.language)];
    return (
        <MainNavBars className={'lumen-help-container'} route={'help'}>
            <div className={'lumen-help'}>
                <h1 className={'lumen-help-title'}>{tx.title}</h1>
                <p className={'lumen-help-lead'}>{tx.lead}</p>

                <section className={'lumen-help-card'}>
                    <h2>{tx.addonsTitle}</h2>
                    <p>{tx.addonsText}</p>
                </section>

                <section className={'lumen-help-card'}>
                    <h2>{tx.howTitle}</h2>
                    <ol>
                        {tx.steps.map((step, index) => <li key={index}>{step}</li>)}
                    </ol>
                </section>

                <section className={'lumen-help-card'}>
                    <h2>{tx.debridTitle}</h2>
                    <p>{tx.debridText}</p>
                </section>

                <ProfilesHelp />

                <section className={'lumen-help-card'}>
                    <h2>{tx.recTitle}</h2>
                    <p>{tx.recText}</p>
                    <div className={'lumen-help-links'}>
                        <a className={'lumen-help-link lumen-help-link-guide'} href={GUIDE_URL} target={'_blank'} rel={'noopener noreferrer'}>{tx.guide}</a>
                    </div>
                </section>

                <section className={'lumen-help-card'}>
                    <h2>{tx.moreTitle}</h2>
                    <p>{tx.moreText}</p>
                    <div className={'lumen-help-links'}>
                        {REPO_URL ? link(tx.docs, REPO_URL) : null}
                        {link(tx.sdk, ADDON_SDK_URL)}
                    </div>
                </section>

                <section className={'lumen-help-card lumen-help-warning'}>
                    <h2>{tx.warnTitle}</h2>
                    <p>{tx.warnText}</p>
                </section>
            </div>
        </MainNavBars>
    );
};

module.exports = Help;
