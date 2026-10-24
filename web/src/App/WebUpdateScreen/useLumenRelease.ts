import { useCallback, useEffect, useState } from 'react';
const { LUMEN_VERSION, LUMEN_REPO } = require('stremio/common/lumenVersion');

type Platform = 'mac' | 'win' | null;
type Release = { version: string, pageUrl: string, dmgUrl: string | null, exeUrl: string | null, exeSha: string | null };

const CHECK_EVERY = 60 * 60 * 1000;
const MIN_GAP_ON_FOCUS = 10 * 60 * 1000;
const DISMISS_FOR = 24 * 60 * 60 * 1000;
const DISMISS_KEY = 'lumen.updateDismissed';

const parse = (v: string) => v.replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
const isNewer = (a: string, b: string) => {
    const x = parse(a), y = parse(b);
    for (let i = 0; i < Math.max(x.length, y.length); i++) {
        if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
    }
    return false;
};

// Verze pro každý systém vychází zvlášť (macOS .dmg, Windows Lumen-Setup.exe), proto se hledá nejnovější vydání,
// které má soubor pro tento systém. Instalátor pro Windows se stahuje jen s SHA-256 z GitHubu, jinak ho obal odmítne.
const toRelease = (data: any): Release => {
    const assets: any[] = data.assets || [];
    const dmg = assets.find((a) => /\.dmg$/i.test(a.name));
    const exe = assets.find((a) => a.name === 'Lumen-Setup.exe');
    const sha = exe && typeof exe.digest === 'string' && exe.digest.startsWith('sha256:') ? exe.digest.slice(7).toLowerCase() : null;
    return {
        version: String(data.tag_name || '').replace(/^v/i, ''),
        pageUrl: data.html_url,
        dmgUrl: dmg ? dmg.browser_download_url : null,
        exeUrl: exe && sha ? exe.browser_download_url : null,
        exeSha: sha,
    };
};

const useLumenRelease = (platform: Platform) => {
    const [release, setRelease] = useState<Release | null>(null);
    const [dismissed, setDismissed] = useState<string | null>(null);

    useEffect(() => {
        // zavření nabídky platí jen 24 hodin (uloženo jako "verze@čas"), aby se nová verze nezapomněla navždy
        try {
            const [ver, time] = String(window.localStorage.getItem(DISMISS_KEY) || '').split('@');
            setDismissed(ver && Date.now() - Number(time) < DISMISS_FOR ? ver : null);
        } catch (_) { /* bez úložiště */ }
        let cancelled = false;
        const check = async () => {
            try {
                const res = await fetch(`https://api.github.com/repos/${LUMEN_REPO}/releases?per_page=15`, { headers: { Accept: 'application/vnd.github+json' } });
                if (!res.ok) return;
                const list = await res.json();
                let best: Release | null = null;
                for (const data of Array.isArray(list) ? list : []) {
                    if (data.draft || data.prerelease) continue;
                    const candidate = toRelease(data);
                    if (!candidate.version || !/^\d+(\.\d+)*$/.test(candidate.version)) continue;
                    if (platform === 'mac' && !candidate.dmgUrl) continue;
                    if (platform === 'win' && !candidate.exeUrl) continue;
                    if (!best || isNewer(candidate.version, best.version)) best = candidate;
                }
                if (cancelled || !best || !isNewer(best.version, LUMEN_VERSION)) return;
                setRelease(best);
            } catch (_) {
                // offline nebo limit GitHubu: zkusí se znovu později
            }
        };
        let lastCheck = Date.now();
        const checkNow = () => { lastCheck = Date.now(); check(); };
        // po návratu do okna se zkontroluje znovu (nejvýš jednou za 10 minut), ať se nová verze neprosedí v dlouhém čekání
        const onFocus = () => { if (Date.now() - lastCheck > MIN_GAP_ON_FOCUS) checkNow(); };
        check();
        const timer = setInterval(checkNow, CHECK_EVERY);
        window.addEventListener('focus', onFocus);
        return () => { cancelled = true; clearInterval(timer); window.removeEventListener('focus', onFocus); };
    }, [platform]);

    const dismiss = useCallback(() => {
        if (!release) return;
        setDismissed(release.version);
        try { window.localStorage.setItem(DISMISS_KEY, `${release.version}@${Date.now()}`); } catch (_) { /* bez úložiště */ }
    }, [release]);

    return { release, visible: !!release && dismissed !== release.version, dismiss };
};

export default useLumenRelease;
