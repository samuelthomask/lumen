// Lumen: hromadný import addonů. Uživatel vloží vlastní adresy (jednu na řádek) a aplikace je nainstaluje.
// Adresy mohou obsahovat osobní klíče, proto se nikam nezapisují do logů ani zpráv (ukazují se jen názvy addonů).

const React = require('react');
const { default: Icon } = require('@stremio/stremio-icons/react');
const { useCore } = require('stremio/core');
const { Button, ModalDialog } = require('stremio/components');
const useToast = require('stremio/common/Toast/useToast');
const { useLumenText } = require('stremio/common/lumenText');

const parseUrls = (text) => text
    .split(/[\s,]+/)
    .map((part) => part.trim().replace(/^stremio:\/\//i, 'https://'))
    .filter((part) => /^https?:\/\//i.test(part))
    .map((part) => /manifest\.json(\?.*)?$/i.test(part) ? part : part.replace(/\/+$/, '') + '/manifest.json');

const ImportAddons = () => {
    const core = useCore();
    const toast = useToast();
    const lt = useLumenText();
    const [open, setOpen] = React.useState(false);
    const [busy, setBusy] = React.useState(false);
    const [text, setText] = React.useState('');

    const close = React.useCallback(() => { if (!busy) setOpen(false); }, [busy]);

    const submit = React.useCallback(async() => {
        const urls = [...new Set(parseUrls(text))];
        if (urls.length === 0) {
            toast.show({ type: 'error', title: lt('importNoUrls'), timeout: 6000 });
            return;
        }
        setBusy(true);
        const installed = [];
        const failed = [];
        for (const transportUrl of urls) {
            try {
                const response = await fetch(transportUrl);
                if (!response.ok) throw new Error('HTTP ' + response.status);
                const manifest = await response.json();
                if (typeof manifest?.id !== 'string' || typeof manifest?.name !== 'string') throw new Error('Not a manifest');
                core.transport.dispatch({
                    action: 'Ctx',
                    args: {
                        action: 'InstallAddon',
                        args: { transportUrl, manifest, flags: { official: false, protected: false } }
                    }
                });
                installed.push(manifest.name);
            } catch (_) {
                // adresu (může obsahovat klíč) záměrně nevypisujeme
                failed.push(`#${urls.indexOf(transportUrl) + 1}`);
            }
        }
        setBusy(false);
        if (installed.length > 0) {
            toast.show({ type: 'success', title: `${lt('importInstalled')}: ${installed.join(', ')}`, timeout: 8000 });
        }
        if (failed.length > 0) {
            toast.show({ type: 'error', title: `${lt('importFailed')}: ${failed.length} (${lt('importLines')} ${failed.join(', ')})`, timeout: 10000 });
        }
        if (failed.length === 0) {
            setText('');
            setOpen(false);
        }
    }, [text, core, toast, lt]);

    const buttons = React.useMemo(() => [
        { label: lt('importCancel'), props: { onClick: close } },
        { label: busy ? lt('importInstalling') : lt('importInstall'), props: { onClick: submit, disabled: busy } }
    ], [close, submit, busy, lt]);

    return (
        <React.Fragment>
            <Button className={'lumen-import-button'} title={lt('importHint')} onClick={() => setOpen(true)}>
                <Icon className={'lumen-import-icon'} name={'addons'} />
                <div className={'lumen-import-label'}>{lt('importButton')}</div>
            </Button>
            {
                open ?
                    <ModalDialog className={'lumen-import-modal'} title={lt('importTitle')} buttons={buttons} onCloseRequest={close}>
                        <div className={'lumen-import-notice'}>{lt('importNotice')}</div>
                        <textarea
                            className={'lumen-import-text'}
                            value={text}
                            placeholder={'https://…/manifest.json\nhttps://…/manifest.json'}
                            autoFocus={true}
                            spellCheck={false}
                            onChange={(event) => setText(event.currentTarget.value)}
                        />
                    </ModalDialog>
                    :
                    null
            }
        </React.Fragment>
    );
};

module.exports = ImportAddons;
