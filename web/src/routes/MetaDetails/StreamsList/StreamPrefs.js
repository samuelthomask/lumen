// Lumen: zaškrtávátka kvality zdrojů přímo nad seznamem zdrojů.
// Jde zaškrtnout libovolná kombinace; nic nezaškrtnuto = bez filtru.

const React = require('react');
const PropTypes = require('prop-types');
const classnames = require('classnames');
const { usePrefs } = require('stremio/common/streamPrefs');
const { useLumenText } = require('stremio/common/lumenText');

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
                <button type={'button'} tabIndex={-1} role={'checkbox'} aria-checked={prefs.czOnly}
                    className={classnames('lumen-pref-chip', { 'selected': prefs.czOnly })}
                    onClick={() => setPrefs({ czOnly: !prefs.czOnly })}>
                    {prefs.czOnly ? <Check /> : null}
                    {lt('czOnly')}
                </button>
                <div className={'lumen-pref-hidden'}>{lt('czHint')}</div>
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
