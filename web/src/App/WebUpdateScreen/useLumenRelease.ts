import { useCallback, useEffect, useState } from 'react';
const { LUMEN_VERSION, LUMEN_REPO } = require('stremio/common/lumenVersion');

type Release = { version: string, pageUrl: string, dmgUrl: string | null };

const CHECK_EVERY = 6 * 60 * 60 * 1000;
const DISMISS_KEY = 'lumen.updateDismissed';

const parse = (v: string) => v.replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
const isNewer = (a: string, b: string) => {
    const x = parse(a), y = parse(b);
    for (let i = 0; i < Math.max(x.length, y.length); i++) {
        if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
    }
    return false;
};

const useLumenRelease = () => {
    const [release, setRelease] = useState<Release | null>(null);
    const [dismissed, setDismissed] = useState<string | null>(null);

    useEffect(() => {
        try { setDismissed(window.localStorage.getItem(DISMISS_KEY)); } catch (_) { /* bez úložiště */ }
        let cancelled = false;
        const check = async () => {
            try {
                const res = await fetch(`https://api.github.com/repos/${LUMEN_REPO}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } });
                if (!res.ok) return;
                const data = await res.json();
                const version = String(data.tag_name || '').replace(/^v/i, '');
                if (cancelled || !version || !isNewer(version, LUMEN_VERSION)) return;
                const dmg = (data.assets || []).find((a: any) => /\.dmg$/i.test(a.name));
                setRelease({ version, pageUrl: data.html_url, dmgUrl: dmg ? dmg.browser_download_url : null });
            } catch (_) {
                // offline nebo limit GitHubu: zkusí se znovu později
            }
        };
        check();
        const timer = setInterval(check, CHECK_EVERY);
        return () => { cancelled = true; clearInterval(timer); };
    }, []);

    const dismiss = useCallback(() => {
        if (!release) return;
        setDismissed(release.version);
        try { window.localStorage.setItem(DISMISS_KEY, release.version); } catch (_) { /* bez úložiště */ }
    }, [release]);

    return { release, visible: !!release && dismissed !== release.version, dismiss };
};

export default useLumenRelease;
