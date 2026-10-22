// Lumen: přepínače preferencí zdrojů (jazyk, minimální kvalita) přímo nad seznamem zdrojů.

const React = require('react');
const PropTypes = require('prop-types');
const classnames = require('classnames');
const { usePrefs } = require('stremio/common/streamPrefs');
const { useLumenText } = require('stremio/common/lumenText');

const LANGUAGE_OPTIONS = [
    { value: 'cs-en', labelKey: 'langCsEn' },
    { value: 'en', labelKey: 'langEn' },
    { value: 'off', labelKey: 'langAny' }
];
const QUALITY_OPTIONS = [
    { value: 2160, labelKey: 'q4k' },
    { value: 1080, labelKey: 'qFullHd' },
    { value: 0, labelKey: 'qAny' }
];

const StreamPrefs = ({ hidden }) => {
    const [prefs, setPrefs] = usePrefs();
    const lt = useLumenText();
    return (
        <div className={'lumen-stream-prefs'}>
            <div className={'lumen-pref-row'}>
                <div className={'lumen-pref-label'}>{lt('prefLanguage')}</div>
                {LANGUAGE_OPTIONS.map(({ value, labelKey }) => (
                    <button key={value} type={'button'} tabIndex={-1}
                        className={classnames('lumen-pref-chip', { 'selected': prefs.language === value })}
                        onClick={() => setPrefs({ language: value })}>
                        {lt(labelKey)}
                    </button>
                ))}
            </div>
            <div className={'lumen-pref-row'}>
                <div className={'lumen-pref-label'}>{lt('prefQuality')}</div>
                {QUALITY_OPTIONS.map(({ value, labelKey }) => (
                    <button key={value} type={'button'} tabIndex={-1}
                        className={classnames('lumen-pref-chip', { 'selected': prefs.minQuality === value })}
                        onClick={() => setPrefs({ minQuality: value })}>
                        {lt(labelKey)}
                    </button>
                ))}
                {hidden > 0 ? <div className={'lumen-pref-hidden'}>{hidden} {lt('lowerHidden')}</div> : null}
            </div>
        </div>
    );
};

StreamPrefs.propTypes = {
    hidden: PropTypes.number
};

module.exports = StreamPrefs;
