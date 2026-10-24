// Lumen: balíček addonů na kód (zadání kódu, API klíč skrytý rozmazáním, změna klíče, přeinstalace, odebrání).

const React = require('react');
const bundles = require('stremio/common/addonBundle');
const { useCore } = require('stremio/core');
const useToast = require('stremio/common/Toast/useToast');
const { useLumenText } = require('stremio/common/lumenText');
const { Modal, styles } = require('stremio/App/ProfilePicker/ProfilePicker');
const own = require('./BundleSection.less');

const BundleSection = ({ profile }) => {
    const core = useCore();
    const toast = useToast();
    const text = useLumenText();
    const [state, setState] = React.useState(bundles.loadState());
    // code | keys | change | remove
    const [mode, setMode] = React.useState(null);
    const [code, setCode] = React.useState('');
    const [pending, setPending] = React.useState(null);
    const [keys, setKeys] = React.useState({});
    const [revealed, setRevealed] = React.useState({});
    const [error, setError] = React.useState('');
    const [busy, setBusy] = React.useState(false);

    const addons = profile && Array.isArray(profile.addons) ? profile.addons : [];
    const errorText = (message) => text(`bundleErr_${message}`) !== `bundleErr_${message}` ? text(`bundleErr_${message}`) : text('bundleErr_offline');

    const open = (next) => {
        setError('');
        setMode(next);
    };
    const close = () => {
        if (busy) return;
        setMode(null);
        setError('');
        setCode('');
        setPending(null);
    };

    const run = async (action) => {
        if (busy) return;
        setBusy(true);
        setError('');
        try {
            await action();
        } catch (err) {
            setError(errorText(err.message));
        }
        setBusy(false);
    };

    const report = (result) => {
        if (result.installed.length > 0) toast.show({ type: 'success', title: `${text('bundleDone')}: ${result.installed.join(', ')}`, timeout: 8000 });
        if (result.failed.length > 0) toast.show({ type: 'error', title: `${text('bundleFailed')}: ${result.failed.join(', ')}`, timeout: 10000 });
    };

    // nainstaluje balíček s danými klíči a uloží stav k aktivnímu profilu
    const apply = async (bundleCode, bundle, nextKeys) => {
        if ((bundle.keys || []).some((key) => !String(nextKeys[key.id] || '').trim())) throw new Error('key');
        const trimmed = Object.fromEntries(Object.entries(nextKeys).map(([id, value]) => [id, String(value).trim()]));
        const result = await bundles.install(core, addons, bundle, trimmed, state ? state.urls : []);
        const next = { code: bundleCode, bundle, keys: trimmed, urls: result.urls };
        bundles.saveState(next);
        setState(next);
        report(result);
        setMode(null);
        setPending(null);
        setCode('');
    };

    const submitCode = () => run(async () => {
        const opened = await bundles.fetchBundle(code);
        setPending(opened);
        setKeys(Object.fromEntries((opened.bundle.keys || []).map((key) => [key.id, state && state.keys[key.id] || ''])));
        setMode('keys');
    });

    const submitKeys = () => run(() => apply(pending.code, pending.bundle, keys));

    const submitChange = () => run(() => apply(state.code, state.bundle, { ...state.keys, ...keys }));

    // přeinstalace stáhne i nejnovější verzi balíčku; bez internetu použije uloženou
    const reinstall = () => run(async () => {
        let bundle = state.bundle;
        try {
            bundle = (await bundles.fetchBundle(state.code)).bundle;
        } catch (err) {
            if (err.message === 'code') throw err;
        }
        await apply(state.code, bundle, state.keys);
    });

    const remove = () => {
        bundles.uninstall(core, addons, state.urls || []);
        bundles.saveState(null);
        setState(null);
        setRevealed({});
        setMode(null);
    };

    const onEnter = (submit) => (event) => {
        if (event.key === 'Enter') submit();
    };

    const keyInputs = (bundle, submit, labelOverride) => (bundle.keys || []).map((key, index) => (
        <div key={key.id}>
            <label>{labelOverride || key.label || key.id}</label>
            <input type={'text'} autoFocus={index === 0} spellCheck={false} autoComplete={'off'}
                value={keys[key.id] || ''} onChange={(event) => setKeys({ ...keys, [key.id]: event.target.value })} onKeyDown={onEnter(submit)} />
            {key.hint ? <p className={own['hint']}>{key.hint}</p> : null}
        </div>
    ));

    const buttons = (primaryLabel, onPrimary) => (
        <div className={styles['buttons']}>
            <button className={styles['button']} onClick={close}>{text('bundleCancel')}</button>
            <button className={`${styles['button']} ${styles['primary']}`} disabled={busy} onClick={onPrimary}>{primaryLabel}</button>
        </div>
    );

    const errorLine = error ? <div className={styles['error']}>{error}</div> : null;

    if (!bundles.enabled) return null;

    return (
        <div className={own['section']}>
            <div className={own['title']}>{text('bundleSection')}</div>
            {state ?
                <React.Fragment>
                    <div className={own['summary']}>
                        {text('bundleName')}: <strong>{state.bundle.name || state.code}</strong> · {state.bundle.addons.length} {text('bundleAddons')}
                    </div>
                    {(state.bundle.keys || []).map((key) => (
                        <div key={key.id} className={own['key-row']}>
                            <div className={own['key-label']}>{key.label || key.id}</div>
                            <div className={own['key-box']}>
                                <span className={revealed[key.id] ? own['key-value'] : `${own['key-value']} ${own['blurred']}`}>{state.keys[key.id] || '—'}</span>
                                <button className={own['reveal']} onClick={() => setRevealed({ ...revealed, [key.id]: !revealed[key.id] })}>
                                    {revealed[key.id] ? text('bundleHide') : text('bundleReveal')}
                                </button>
                            </div>
                            <button className={styles['sbutton']} onClick={() => { setKeys({ [key.id]: '' }); open('change'); }}>{text('bundleChange')}</button>
                        </div>
                    ))}
                    <div className={own['actions']}>
                        <button className={styles['sbutton']} disabled={busy} title={text('bundleReinstallHint')} onClick={reinstall}>
                            {busy && !mode ? text('bundleInstalling') : text('bundleReinstall')}
                        </button>
                        <button className={styles['sbutton']} style={{ color: '#ff6b6b' }} onClick={() => open('remove')}>{text('bundleRemove')}</button>
                    </div>
                    {error && !mode ? <div style={{ color: '#ff6b6b' }}>{error}</div> : null}
                </React.Fragment> :
                <React.Fragment>
                    <div className={own['intro']}>{text('bundleIntro')}</div>
                    <button className={styles['sbutton']} style={{ alignSelf: 'flex-start' }} onClick={() => open('code')}>{text('bundleEnterCode')}</button>
                </React.Fragment>}

            {mode === 'code' ?
                <Modal title={text('bundleSection')} onClose={close}>
                    <div>
                        <label>{text('bundleCode')}</label>
                        <input type={'text'} autoFocus spellCheck={false} autoComplete={'off'} value={code}
                            onChange={(event) => setCode(event.target.value)} onKeyDown={onEnter(submitCode)} />
                    </div>
                    {errorLine}
                    {buttons(busy ? text('bundleChecking') : text('bundleContinue'), submitCode)}
                </Modal> : null}

            {mode === 'keys' && pending ?
                <Modal title={pending.bundle.name || text('bundleSection')} onClose={close}>
                    <p>{text('bundleWillInstall')}</p>
                    <ul className={own['list']}>
                        {pending.bundle.addons.map((addon, index) => <li key={index}>{addon.name || '?'}</li>)}
                    </ul>
                    {keyInputs(pending.bundle, submitKeys)}
                    {errorLine}
                    {buttons(busy ? text('bundleInstalling') : text('bundleInstall'), submitKeys)}
                </Modal> : null}

            {mode === 'change' && state ?
                <Modal title={text('bundleChange')} onClose={close}>
                    {keyInputs(state.bundle, submitChange, text('bundleNewKey'))}
                    {errorLine}
                    {buttons(busy ? text('bundleInstalling') : text('bundleSave'), submitChange)}
                </Modal> : null}

            {mode === 'remove' && state ?
                <Modal title={text('bundleRemove')} onClose={close}>
                    <p>{text('bundleRemoveText')}</p>
                    <div className={styles['buttons']}>
                        <button className={styles['button']} onClick={close}>{text('bundleCancel')}</button>
                        <button className={`${styles['button']} ${styles['primary']}`} style={{ background: '#d93b3b' }} onClick={remove}>{text('bundleRemove')}</button>
                    </div>
                </Modal> : null}
        </div>
    );
};

module.exports = BundleSection;
