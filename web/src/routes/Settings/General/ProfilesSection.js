// Lumen: nastavení profilů (přepnutí, export a import souboru .lumen).

const React = require('react');
const profiles = require('stremio/common/profiles');
const { useLumenText } = require('stremio/common/lumenText');
const { ProfilePicker, Modal, styles } = require('stremio/App/ProfilePicker/ProfilePicker');

const ProfilesSection = () => {
    const text = useLumenText();
    const [picker, setPicker] = React.useState(false);
    const [exporting, setExporting] = React.useState(false);
    const [password, setPassword] = React.useState('');
    const [askPassword, setAskPassword] = React.useState(null);   // { text } souboru čekajícího na heslo
    const [importPassword, setImportPassword] = React.useState('');
    const [message, setMessage] = React.useState('');
    const fileInput = React.useRef(null);
    const active = profiles.getActive();

    const doExport = async () => {
        try {
            const data = await profiles.exportProfiles(password);
            profiles.saveFile(data, 'lumen-profily.lumen');
            setMessage(text('profileExported'));
        } catch (_) {
            setMessage(text('profileBadFile'));
        }
        setExporting(false);
        setPassword('');
    };

    const tryImport = async (fileText, pass) => {
        try {
            const result = await profiles.parseExport(fileText, pass);
            if (result.encrypted) { setAskPassword({ text: fileText }); setImportPassword(''); return; }
            const count = profiles.importProfiles(result.profiles);
            setAskPassword(null);
            setMessage(`${text('profileImported')}: ${count}`);
        } catch (error) {
            setMessage(error.message === 'password' ? text('profileWrongPassword') : text('profileBadFile'));
        }
    };

    const onFile = async (event) => {
        const file = event.target.files && event.target.files[0];
        event.target.value = '';
        if (!file) return;
        tryImport(await file.text(), '');
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.5rem 0' }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 600 }}>{text('profilesSection')}</div>
            <div style={{ opacity: 0.75 }}>{text('profileCurrent')}: <strong>{active ? active.name : ''}</strong></div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.8rem' }}>
                <button className={styles['sbutton']} onClick={() => setPicker(true)}>{text('profileSwitch')}</button>
                <button className={styles['sbutton']} onClick={() => setExporting(true)}>{text('profileExport')}</button>
                <button className={styles['sbutton']} onClick={() => fileInput.current && fileInput.current.click()}>{text('profileImport')}</button>
                <input ref={fileInput} type={'file'} accept={'.lumen,.json'} style={{ display: 'none' }} onChange={onFile} />
            </div>
            <div style={{ opacity: 0.55, fontSize: '1rem', maxWidth: '50rem', lineHeight: 1.45 }}>{text('profileExportHint')}</div>
            {message ? <div style={{ color: 'rgb(10, 132, 255)' }}>{message}</div> : null}

            {picker ?
                <ProfilePicker
                    onCancel={() => setPicker(false)}
                    onDone={(profile) => {
                        setPicker(false);
                        if (active && profile.id !== active.id) profiles.requestSwitch(profile.id);
                    }} /> : null}

            {exporting ?
                <Modal title={text('profileExport')} onClose={() => setExporting(false)}>
                    <p>{text('profileExportHint')}</p>
                    <div>
                        <label>{text('profilePassword')}</label>
                        <input type={'password'} autoFocus value={password} onChange={(event) => setPassword(event.target.value)}
                            onKeyDown={(event) => { if (event.key === 'Enter') doExport(); }} />
                    </div>
                    <div className={styles['buttons']}>
                        <button className={styles['button']} onClick={() => setExporting(false)}>{text('profileCancel')}</button>
                        <button className={`${styles['button']} ${styles['primary']}`} onClick={doExport}>{text('profileSave')}</button>
                    </div>
                </Modal> : null}

            {askPassword ?
                <Modal title={text('profileImport')} onClose={() => setAskPassword(null)}>
                    <div>
                        <label>{text('profilePasswordAsk')}</label>
                        <input type={'password'} autoFocus value={importPassword} onChange={(event) => setImportPassword(event.target.value)}
                            onKeyDown={(event) => { if (event.key === 'Enter') tryImport(askPassword.text, importPassword); }} />
                    </div>
                    <div className={styles['buttons']}>
                        <button className={styles['button']} onClick={() => setAskPassword(null)}>{text('profileCancel')}</button>
                        <button className={`${styles['button']} ${styles['primary']}`} onClick={() => tryImport(askPassword.text, importPassword)}>{text('profileContinue')}</button>
                    </div>
                </Modal> : null}
        </div>
    );
};

module.exports = ProfilesSection;
