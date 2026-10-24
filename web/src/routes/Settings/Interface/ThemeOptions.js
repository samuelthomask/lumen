// Lumen: volby tématu v Nastavení → Rozhraní (barva, barva podle filmu, světlý/tmavý režim).

const React = require('react');
const classnames = require('classnames');
const { Toggle } = require('stremio/components');
const { useTheme, ACCENTS } = require('stremio/common/lumenTheme');
const { useLumenText } = require('stremio/common/lumenText');
const { default: Option } = require('../components/Option');

const ThemeOptions = () => {
    const [theme, setTheme] = useTheme();
    const lt = useLumenText();
    return (
        <React.Fragment>
            <Option label={lt('themeAccent')}>
                <div className={'lumen-theme-swatches'}>
                    {Object.entries(ACCENTS).map(([name, color]) => (
                        <button key={name} type={'button'} tabIndex={-1} title={lt(`accent_${name}`)}
                            className={classnames('lumen-theme-swatch', { 'selected': theme.accent === name })}
                            style={{ backgroundColor: color }}
                            onClick={() => setTheme({ accent: name })} />
                    ))}
                </div>
            </Option>
            <Option label={lt('themeAmbient')}>
                <Toggle tabIndex={-1} checked={theme.ambient} onClick={() => setTheme({ ambient: !theme.ambient })} />
            </Option>
            <Option label={lt('themeMode')}>
                <div className={'lumen-stream-prefs lumen-theme-modes'}>
                    <div className={'lumen-pref-row'}>
                        {['dark', 'light'].map((mode) => (
                            <button key={mode} type={'button'} tabIndex={-1}
                                className={classnames('lumen-pref-chip', { 'selected': theme.mode === mode })}
                                onClick={() => setTheme({ mode })}>
                                {lt(`themeMode_${mode}`)}
                            </button>
                        ))}
                    </div>
                </div>
            </Option>
        </React.Fragment>
    );
};

module.exports = ThemeOptions;
