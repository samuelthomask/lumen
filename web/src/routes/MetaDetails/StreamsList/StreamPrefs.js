// Lumen: zaškrtávátka preferencí zdrojů (jazyk, kvalita) přímo nad seznamem zdrojů.
// Jde zaškrtnout libovolná kombinace; nic nezaškrtnuto v řádku = ten řádek nefiltruje.

const React = require('react');
const PropTypes = require('prop-types');
const classnames = require('classnames');
const { usePrefs } = require('stremio/common/streamPrefs');
const { useLumenText } = require('stremio/common/lumenText');

const LANGUAGE_OPTIONS = [
    { value: 'csSubs', labelKey: 'langCsSubs' },
    { value: 'csAudio', labelKey: 'langCsAudio' },
    { value: 'enSubs', labelKey: 'langEnSubs' },
    { value: 'enAudio', labelKey: 'langEnAudio' }
];
const QUALITY_OPTIONS = [
    { value: 2160, labelKey: 'q4k' },
    { value: 1080, labelKey: 'qFullHd' },
    { value: 0, labelKey: 'qLower' }
];

const toggle = (list, value) => list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

const Check = () => (
    <svg className={'lumen-pref-check'} viewBox={'0 0 16 16'} aria-hidden={'true'}>
        <path d={'M3.5 8.5l3 3 6-7'} fill={'none'} stroke={'currentColor'} strokeWidth={'2.2'} strokeLinecap={'round'} strokeLinejoin={'round'} />
    </svg>
);

const StreamPrefs = ({ hidden }) => {
    const [prefs, setPrefs] = usePrefs();
    const lt = useLumenText();
    return (
        <div className={'lumen-stream-prefs'}>
            <div className={'lumen-pref-row'}>
                <div className={'lumen-pref-label'}>{lt('prefLanguage')}</div>
                {LANGUAGE_OPTIONS.map(({ value, labelKey }) => (
                    <button key={value} type={'button'} tabIndex={-1} role={'checkbox'} aria-checked={prefs.languages.includes(value)}
                        className={classnames('lumen-pref-chip', { 'selected': prefs.languages.includes(value) })}
                        onClick={() => setPrefs({ languages: toggle(prefs.languages, value) })}>
                        {prefs.languages.includes(value) ? <Check /> : null}
                        {lt(labelKey)}
                    </button>
                ))}
            </div>
            <div className={'lumen-pref-row'}>
                <div className={'lumen-pref-label'}>{lt('prefQuality')}</div>
                {QUALITY_OPTIONS.map(({ value, labelKey }) => (
                    <button key={value} type={'button'} tabIndex={-1} role={'checkbox'} aria-checked={prefs.qualities.includes(value)}
                        className={classnames('lumen-pref-chip', { 'selected': prefs.qualities.includes(value) })}
                        onClick={() => setPrefs({ qualities: toggle(prefs.qualities, value) })}>
                        {prefs.qualities.includes(value) ? <Check /> : null}
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
