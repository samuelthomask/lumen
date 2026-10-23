// Lumen: karta nápovědy o profilech a přenosu na jiné zařízení (používá ji veřejná i osobní nápověda).

const React = require('react');
const { useTranslation } = require('react-i18next');
const { languageOf } = require('stremio/common/lumenText');

const TEXT = {
    cs: {
        title: 'Profily a přenos na jiné zařízení',
        text: 'Každý profil má vlastní addony, knihovnu a „pokračovat ve sledování“. Při startu si vyberete, kdo se dívá; profil můžete chránit PINem. Profily spravujete na úvodní obrazovce výběru a v Nastavení → Profily.',
        steps: [
            (<React.Fragment>Na starém zařízení otevřete <strong>Nastavení → Profily → Exportovat profily do souboru</strong>. Soubor <strong>.lumen</strong> obsahuje addony, knihovnu i rozkoukané filmy.</React.Fragment>),
            'Doporučujeme soubor zašifrovat heslem: adresy addonů mohou obsahovat osobní klíče.',
            'Soubor pošlete na nové zařízení (e-mailem sobě, přes cloud, USB…).',
            (<React.Fragment>V novém Lumenu zvolte <strong>Nastavení → Profily → Importovat profily ze souboru</strong>. Profily se přidají a stávající se nepřepíšou.</React.Fragment>)
        ]
    },
    en: {
        title: 'Profiles and moving to another device',
        text: 'Each profile has its own addons, library and "continue watching". At startup you choose who is watching; a profile can be protected with a PIN. Manage profiles on the start screen and in Settings → Profiles.',
        steps: [
            (<React.Fragment>On the old device open <strong>Settings → Profiles → Export profiles to file</strong>. The <strong>.lumen</strong> file contains your addons, library and what you were watching.</React.Fragment>),
            'We recommend protecting the file with a password: addon URLs can contain personal keys.',
            'Send the file to the new device (email it to yourself, cloud, USB…).',
            (<React.Fragment>In the new Lumen choose <strong>Settings → Profiles → Import profiles from file</strong>. The profiles are added; existing ones are not overwritten.</React.Fragment>)
        ]
    }
};

const ProfilesHelp = () => {
    const { i18n } = useTranslation();
    const tx = TEXT[languageOf(i18n.language)];
    return (
        <section className={'lumen-help-card'}>
            <h2>{tx.title}</h2>
            <p>{tx.text}</p>
            <ol>
                {tx.steps.map((step, index) => <li key={index}>{step}</li>)}
            </ol>
        </section>
    );
};

module.exports = ProfilesHelp;
