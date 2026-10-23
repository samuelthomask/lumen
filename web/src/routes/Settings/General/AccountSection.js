// Lumen: volitelný účet se šifrovanou synchronizací (přihlášení, registrace, obnova hesla, smazání účtu).
// Zobrazí se jen v sestavení s nastaveným LUMEN_SUPABASE_URL a LUMEN_SUPABASE_KEY.

const React = require('react');
const cloud = require('stremio/common/cloud');
const { useLumenText } = require('stremio/common/lumenText');
const { Modal, styles } = require('stremio/App/ProfilePicker/ProfilePicker');

const MIN_PASSWORD = 8;

const AccountSection = () => {
    const text = useLumenText();
    const [status, setStatus] = React.useState(cloud.getStatus());
    const [loggedIn, setLoggedIn] = React.useState(cloud.isLoggedIn());
    // login | signup | confirm | forgot | reset | choice | delete | privacy
    const [mode, setMode] = React.useState(null);
    const [form, setForm] = React.useState({ email: '', password: '', password2: '', code: '' });
    const [error, setError] = React.useState('');
    const [busy, setBusy] = React.useState(false);

    React.useEffect(() => cloud.subscribe((next) => {
        setStatus(next);
        setLoggedIn(cloud.isLoggedIn());
    }), []);

    const errorText = (code) => text(`accountErr_${code}`) !== `accountErr_${code}` ? text(`accountErr_${code}`) : text('accountErr_server');
    const field = (name) => (event) => setForm({ ...form, [name]: event.target.value });
    const open = (next) => {
        setError('');
        setMode(next);
    };
    const close = () => {
        setMode(null);
        setError('');
        setForm({ ...form, password: '', password2: '', code: '' });
    };

    // po přihlášení: prázdný účet je hotový hned, jinak se uživatel rozhodne, čí data platí
    const afterLogin = (result) => {
        setLoggedIn(cloud.isLoggedIn());
        if (result && result.choice) open('choice');
        else close();
    };

    const run = async (action) => {
        if (busy) return;
        setBusy(true);
        setError('');
        try {
            await action();
        } catch (err) {
            setError(err.message === 'server' && err.detail ? `${errorText('server')} (${err.detail})` : errorText(err.message));
        }
        setBusy(false);
    };

    const checkNewPassword = () => {
        if (form.password.length < MIN_PASSWORD) { setError(text('accountPasswordShort')); return false; }
        if (form.password !== form.password2) { setError(text('accountPasswordMismatch')); return false; }
        return true;
    };

    const submit = {
        login: () => run(async () => afterLogin(await cloud.signIn(form.email, form.password))),
        signup: () => {
            if (!checkNewPassword()) return;
            run(async () => {
                const result = await cloud.signUp(form.email, form.password);
                if (result.confirm) open('confirm');
                else afterLogin(result);
            });
        },
        confirm: () => run(async () => afterLogin(await cloud.verifySignup(form.email, form.password, form.code))),
        forgot: () => run(async () => {
            await cloud.sendReset(form.email);
            open('reset');
        }),
        reset: () => {
            if (!checkNewPassword()) return;
            run(async () => afterLogin(await cloud.resetPassword(form.email, form.code, form.password)));
        },
        delete: () => run(async () => {
            await cloud.deleteAccount();
            setLoggedIn(false);
            close();
        })
    };

    const onEnter = (event) => {
        if (event.key === 'Enter' && submit[mode]) submit[mode]();
    };

    const input = (name, label, type = 'text', autoFocus = false) => (
        <div>
            <label>{label}</label>
            <input type={type} autoFocus={autoFocus} value={form[name]} onChange={field(name)} onKeyDown={onEnter}
                autoComplete={type === 'password' ? 'off' : undefined} inputMode={name === 'email' ? 'email' : undefined} />
        </div>
    );

    const buttons = (primaryLabel, onPrimary) => (
        <div className={styles['buttons']}>
            <button className={styles['button']} onClick={close}>{text('accountCancel')}</button>
            <button className={`${styles['button']} ${styles['primary']}`} disabled={busy} onClick={onPrimary}>
                {busy ? '…' : primaryLabel}
            </button>
        </div>
    );

    const errorLine = error ? <div className={styles['error']}>{error}</div> : null;

    if (!cloud.enabled) return null;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.5rem 0' }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 600 }}>{text('accountSection')}</div>
            {loggedIn ?
                <React.Fragment>
                    <div style={{ opacity: 0.75 }}>{text('accountSignedAs')}: <strong>{cloud.email()}</strong></div>
                    <div style={{ opacity: 0.55, fontSize: '1rem' }}>
                        {status.busy ? text('accountSyncing') :
                            status.lastSync ? `${text('accountLastSync')}: ${new Date(status.lastSync).toLocaleTimeString()}` : ''}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.8rem' }}>
                        <button className={styles['sbutton']} disabled={status.busy} onClick={() => cloud.syncNow(false)}>{text('accountSyncNow')}</button>
                        <button className={styles['sbutton']} onClick={() => run(async () => { await cloud.signOut(); setLoggedIn(false); })}>{text('accountSignOut')}</button>
                        <button className={styles['sbutton']} style={{ color: '#ff6b6b' }} onClick={() => open('delete')}>{text('accountDelete')}</button>
                    </div>
                </React.Fragment> :
                <React.Fragment>
                    <div style={{ opacity: 0.55, fontSize: '1rem', maxWidth: '50rem', lineHeight: 1.45 }}>{text('accountIntro')}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.8rem' }}>
                        <button className={styles['sbutton']} onClick={() => open('login')}>{text('accountSignIn')}</button>
                        <button className={styles['sbutton']} onClick={() => open('signup')}>{text('accountSignUp')}</button>
                    </div>
                </React.Fragment>}
            {status.error && !mode ? <div style={{ color: '#ff6b6b' }}>{errorText(status.error)}</div> : null}
            <button className={styles['sbutton']} style={{ alignSelf: 'flex-start', border: 'none', background: 'none', padding: 0, color: 'rgb(10, 132, 255)' }}
                onClick={() => open('privacy')}>{text('accountPrivacy')}</button>

            {mode === 'login' ?
                <Modal title={text('accountSignIn')} onClose={close}>
                    {input('email', text('accountEmail'), 'text', true)}
                    {input('password', text('accountPassword').replace(/ \(.*\)$/, ''), 'password')}
                    {errorLine}
                    <button className={styles['link']} onClick={() => open('forgot')}>{text('accountForgot')}</button>
                    {buttons(text('accountSignIn'), submit.login)}
                </Modal> : null}

            {mode === 'signup' ?
                <Modal title={text('accountSignUp')} onClose={close}>
                    {input('email', text('accountEmail'), 'text', true)}
                    {input('password', text('accountPassword'), 'password')}
                    {input('password2', text('accountPasswordAgain'), 'password')}
                    <p>{text('accountForgetWarning')}</p>
                    {errorLine}
                    {buttons(text('accountSignUp'), submit.signup)}
                </Modal> : null}

            {mode === 'confirm' ?
                <Modal title={text('accountSignUp')} onClose={close}>
                    <p>{text('accountConfirmSent')}</p>
                    {input('code', text('accountCode'), 'text', true)}
                    {errorLine}
                    {buttons(text('accountContinue'), submit.confirm)}
                </Modal> : null}

            {mode === 'forgot' ?
                <Modal title={text('accountForgot')} onClose={close}>
                    <p>{text('accountResetHint')}</p>
                    {input('email', text('accountEmail'), 'text', true)}
                    {errorLine}
                    {buttons(text('accountSendCode'), submit.forgot)}
                </Modal> : null}

            {mode === 'reset' ?
                <Modal title={text('accountForgot')} onClose={close}>
                    <p>{text('accountCodeSent')}</p>
                    {input('code', text('accountCode'), 'text', true)}
                    {input('password', text('accountNewPassword'), 'password')}
                    {input('password2', text('accountPasswordAgain'), 'password')}
                    {errorLine}
                    {buttons(text('accountContinue'), submit.reset)}
                </Modal> : null}

            {mode === 'choice' ?
                <Modal title={text('accountChoiceTitle')}>
                    <p>{text('accountChoiceText')}</p>
                    {errorLine}
                    <div className={styles['buttons']}>
                        <button className={styles['button']} disabled={busy} onClick={() => run(async () => { await cloud.resolveChoice('device'); close(); })}>
                            {text('accountUseDevice')}
                        </button>
                        <button className={`${styles['button']} ${styles['primary']}`} disabled={busy} onClick={() => run(() => cloud.resolveChoice('cloud'))}>
                            {text('accountUseCloud')}
                        </button>
                    </div>
                </Modal> : null}

            {mode === 'delete' ?
                <Modal title={text('accountDelete')} onClose={close}>
                    <p>{text('accountDeleteText')}</p>
                    {errorLine}
                    <div className={styles['buttons']}>
                        <button className={styles['button']} onClick={close}>{text('accountCancel')}</button>
                        <button className={`${styles['button']} ${styles['primary']}`} style={{ background: '#d93b3b' }} disabled={busy} onClick={submit.delete}>
                            {text('accountDeleteConfirm')}
                        </button>
                    </div>
                </Modal> : null}

            {mode === 'privacy' ?
                <Modal title={text('accountPrivacy')} onClose={close}>
                    <p>{text('accountPrivacyText')}</p>
                    <div className={styles['buttons']}>
                        <button className={`${styles['button']} ${styles['primary']}`} onClick={close}>OK</button>
                    </div>
                </Modal> : null}
        </div>
    );
};

module.exports = AccountSection;
