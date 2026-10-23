// Lumen: výběr profilu při startu (před spuštěním jádra) a dialogy pro správu profilů.

const React = require('react');
const ReactDOM = require('react-dom');
const profiles = require('stremio/common/profiles');
const { useLumenText } = require('stremio/common/lumenText');
const styles = require('./styles.less');

const initial = (name) => (name || '?').trim().charAt(0).toUpperCase();
const avatarStyle = (color) => ({ background: `linear-gradient(145deg, ${color}, ${color}99)` });

const Modal = ({ title, children, onClose }) => ReactDOM.createPortal(
    <div className={styles['modal-backdrop']} onMouseDown={(event) => { if (event.target === event.currentTarget && onClose) onClose(); }}>
        <div className={styles['modal']}>
            <h2>{title}</h2>
            {children}
        </div>
    </div>,
    document.body
);

const PinModal = ({ profile, onOk, onClose }) => {
    const text = useLumenText();
    const [pin, setPin] = React.useState('');
    const [wrong, setWrong] = React.useState(false);
    const submit = async () => {
        if (await profiles.checkPin(profile, pin)) onOk();
        else { setWrong(true); setPin(''); }
    };
    return (
        <Modal title={profile.name} onClose={onClose}>
            <div>
                <label>{text('profileEnterPin')}</label>
                <input type={'password'} autoFocus value={pin} onChange={(event) => { setPin(event.target.value); setWrong(false); }}
                    onKeyDown={(event) => { if (event.key === 'Enter') submit(); }} />
            </div>
            {wrong ? <div className={styles['error']}>{text('profileWrongPin')}</div> : null}
            <div className={styles['buttons']}>
                <button className={styles['button']} onClick={onClose}>{text('profileCancel')}</button>
                <button className={`${styles['button']} ${styles['primary']}`} onClick={submit}>{text('profileContinue')}</button>
            </div>
        </Modal>
    );
};

// profile = existující profil (úprava) nebo null (nový)
const EditModal = ({ profile, blockActive, onSaved, onDeleted, onClose }) => {
    const text = useLumenText();
    const [name, setName] = React.useState(profile ? profile.name : '');
    const [color, setColor] = React.useState(profile ? profile.color : profiles.COLORS[profiles.getProfiles().length % profiles.COLORS.length]);
    const [pin, setPin] = React.useState('');
    const [removePin, setRemovePin] = React.useState(false);
    const save = async () => {
        if (!name.trim()) return;
        if (profile) await profiles.updateProfile(profile.id, { name, color, pin: removePin ? '' : (pin ? pin : undefined) });
        else await profiles.addProfile({ name, color, pin });
        onSaved();
    };
    const remove = () => {
        if (window.confirm(text('profileDeleteConfirm')) && profiles.removeProfile(profile.id)) onDeleted();
    };
    return (
        <Modal title={profile ? text('editProfile') : text('addProfile')} onClose={onClose}>
            <div>
                <label>{text('profileName')}</label>
                <input type={'text'} autoFocus maxLength={24} value={name} onChange={(event) => setName(event.target.value)}
                    onKeyDown={(event) => { if (event.key === 'Enter') save(); }} />
            </div>
            <div>
                <label>{text('profileColor')}</label>
                <div className={styles['colors']}>
                    {profiles.COLORS.map((c) => (
                        <button key={c} style={{ background: c }} className={c === color ? styles['selected'] : ''} onClick={() => setColor(c)} />
                    ))}
                </div>
            </div>
            <div>
                <label>{text('profilePin')}</label>
                <input type={'password'} maxLength={12} value={pin} placeholder={profile && profile.pin ? text('profilePinKeep') : ''}
                    onChange={(event) => { setPin(event.target.value); setRemovePin(false); }} />
                {profile && profile.pin ?
                    <button className={styles['link']} onClick={() => { setRemovePin(true); setPin(''); }}>
                        {removePin ? '✓ ' : ''}{text('profilePinRemove')}
                    </button> : null}
            </div>
            <div className={styles['buttons']}>
                {profile && profiles.getProfiles().length > 1 && !(blockActive && profiles.getActive() && profiles.getActive().id === profile.id) ?
                    <button className={`${styles['button']} ${styles['danger']}`} onClick={remove}>{text('profileDelete')}</button> : null}
                <button className={styles['button']} onClick={onClose}>{text('profileCancel')}</button>
                <button className={`${styles['button']} ${styles['primary']}`} onClick={save}>{text('profileSave')}</button>
            </div>
        </Modal>
    );
};

const ProfilePicker = ({ onDone, onCancel }) => {
    const text = useLumenText();
    const [list, setList] = React.useState(profiles.getProfiles());
    const [managing, setManaging] = React.useState(false);
    const [pinFor, setPinFor] = React.useState(null);
    const [editing, setEditing] = React.useState(undefined);   // undefined = zavřeno, null = nový, objekt = úprava
    const refresh = () => setList(profiles.getProfiles());

    const enter = (profile) => {
        profiles.markPicked();
        onDone(profile);
    };
    const choose = (profile) => {
        if (managing) { setEditing(profile); return; }
        if (profile.pin) { setPinFor(profile); return; }
        enter(profile);
    };

    return ReactDOM.createPortal(
        <div className={styles['picker']} onKeyDown={(event) => { if (event.key === 'Escape' && onCancel) onCancel(); }}>
            <div className={styles['title']}>{managing ? text('manageProfiles') : text('whoWatching')}</div>
            <div className={styles['row']}>
                {list.map((profile) => (
                    <button key={profile.id} className={styles['tile']} onClick={() => choose(profile)}>
                        <div className={styles['avatar']} style={avatarStyle(profile.color)}>{initial(profile.name)}</div>
                        {managing ? <div className={styles['badge']}>✎</div> : null}
                        {profile.pin ? <div className={styles['lock']}>🔒</div> : null}
                        <div className={styles['name']}>{profile.name}</div>
                    </button>
                ))}
                {list.length < 8 ?
                    <button className={`${styles['tile']} ${styles['add']}`} onClick={() => setEditing(null)}>
                        <div className={styles['avatar']}>+</div>
                        <div className={styles['name']}>{text('addProfile')}</div>
                    </button> : null}
            </div>
            <div className={styles['actions']}>
                <button className={styles['manage']} onClick={() => setManaging(!managing)}>
                    {managing ? text('doneManaging') : text('manageProfiles')}
                </button>
                {onCancel ? <button className={styles['manage']} onClick={onCancel}>{text('profileCancel')}</button> : null}
            </div>
            <div className={styles['hint']}>{text('profileTransferHint')}</div>
            {pinFor ? <PinModal profile={pinFor} onOk={() => enter(pinFor)} onClose={() => setPinFor(null)} /> : null}
            {editing !== undefined ?
                <EditModal profile={editing} blockActive={Boolean(onCancel)}
                    onSaved={() => { setEditing(undefined); refresh(); }}
                    onDeleted={() => { setEditing(undefined); refresh(); }}
                    onClose={() => setEditing(undefined)} /> : null}
        </div>,
        document.body
    );
};

module.exports = { ProfilePicker, Modal, styles };
