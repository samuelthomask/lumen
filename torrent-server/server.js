// Lumen local server: status endpoints the interface needs + torrent streaming (WebTorrent, MIT).
// Listens on 127.0.0.1 only. Torrent data is stored in LUMEN_TORRENT_DIR and removed when a torrent is dropped.
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import WebTorrent from 'webtorrent';

const PORT = Number(process.env.LUMEN_PORT || 11470);
const ALLOWED_ORIGIN = 'https://lumen.localhost:11470';
// Na macOS servíruje rozhraní přímo tento server (LUMEN_WEB_DIR), stránka je pak na stejném původu jako server.
const WEB_DIR = process.env.LUMEN_WEB_DIR ? path.resolve(process.env.LUMEN_WEB_DIR) : '';
const ALLOWED_ORIGINS = new Set([ALLOWED_ORIGIN, `http://127.0.0.1:${Number(process.env.LUMEN_PORT || 11470)}`]);
const STATIC_MIME = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', mjs: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', json: 'application/json', svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', ico: 'image/x-icon', woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf', wasm: 'application/wasm', map: 'application/json', txt: 'text/plain; charset=utf-8', webmanifest: 'application/manifest+json' };
const DIR = process.env.LUMEN_TORRENT_DIR || path.join(os.tmpdir(), 'lumen-torrents');
const MAX_ACTIVE = 1;               // only one torrent at a time (the one being watched); older ones are removed so they do not share bandwidth
const VIDEO = /\.(mkv|mp4|avi|mov|m4v|webm|ts|m2ts|wmv|flv)$/i;
const LOGFILE = process.env.LUMEN_LOGFILE || path.join(os.tmpdir(), 'lumen-torrent-server.log');
const log = (...a) => { try { fs.appendFileSync(LOGFILE, new Date().toISOString() + ' ' + a.join(' ') + '\n'); } catch {} };
const DEFAULT_TRACKERS = [
  'udp://tracker.opentrackr.org:1337/announce', 'udp://open.stealth.si:80/announce', 'udp://tracker.torrent.eu.org:451/announce',
  'udp://exodus.desync.com:6969/announce', 'udp://open.demonii.com:1337/announce', 'udp://tracker.openbittorrent.com:6969/announce',
  'udp://explodie.org:6969/announce', 'udp://tracker.moeking.me:6969/announce', 'udp://opentracker.io:6969/announce',
  'udp://tracker.tiny-vps.com:6969/announce', 'https://tracker.tamersunion.org:443/announce',
];

fs.rmSync(DIR, { recursive: true, force: true });       // leftovers of a previous run
fs.mkdirSync(DIR, { recursive: true });

const client = new WebTorrent({ utp: true, maxConns: 100 });
client.on('error', (e) => log('client error', e.message));
const pending = new Map();           // infoHash -> Promise<torrent>
const lastUsed = new Map();

const SETTINGS = {
  options: [],
  values: {
    serverVersion: '1.0.0', appPath: '', cacheRoot: DIR, cacheSize: 0, btMaxConnections: 55, btHandshakeTimeout: 20000,
    btRequestTimeout: 4000, btDownloadSpeedSoftLimit: 0, btDownloadSpeedHardLimit: 0, btMinPeersForStable: 5,
    remoteHttps: '', localAddonEnabled: false, transcodeHorsepower: 0, transcodeMaxBitRate: 0, transcodeConcurrency: 1,
    transcodeTrackConcurrency: 1, transcodeHardwareAccel: false, transcodeProfile: null, allTranscodeProfiles: [],
    proxyStreamsEnabled: false,
  },
  baseUrl: `http://127.0.0.1:${PORT}`,
};

function magnetFor(infoHash, trackers) {
  let m = `magnet:?xt=urn:btih:${infoHash}`;
  for (const t of [...new Set([...trackers, ...DEFAULT_TRACKERS])]) m += `&tr=${encodeURIComponent(t)}`;
  return m;
}

function getTorrent(infoHash, trackers) {
  infoHash = infoHash.toLowerCase();
  lastUsed.set(infoHash, Date.now());
  const existing = client.torrents.find((t) => t.infoHash === infoHash);
  if (existing && existing.files && existing.files.length) return Promise.resolve(existing);
  if (pending.has(infoHash)) return pending.get(infoHash);
  const p = new Promise((resolve, reject) => {
    log('adding', infoHash, 'trackers from request:', trackers.length);
    const t = existing || client.add(magnetFor(infoHash, trackers), { path: path.join(DIR, infoHash) });
    const timer = setTimeout(() => { pending.delete(infoHash); reject(new Error('timeout waiting for torrent metadata')); }, 90000);
    t.on('warning', (e) => log('torrent warning', infoHash, e.message));
    t.on('infoHash', () => log('torrent added', infoHash));
    const onMeta = () => {
      log('metadata', infoHash, t.name, t.files.length, 'files');
      try { prefetch(t); } catch (e) { log('prefetch error', e.message); }
      clearTimeout(timer); pending.delete(infoHash); resolve(t);
    };
    if (t.files && t.files.length) onMeta(); else t.once('metadata', onMeta);
    t.once('error', (e) => { clearTimeout(timer); pending.delete(infoHash); reject(e); });
  });
  pending.set(infoHash, p);
  trim(infoHash);
  return p;
}

function prefetch(t) {
  const main = pickFile(t, -1);
  const pl = t.pieceLength;
  const first = Math.floor(main.offset / pl), last = Math.floor((main.offset + main.length - 1) / pl);
  t.deselect(0, t.pieces.length - 1, 0);                  // stop downloading the whole torrent in rarest-first order
  t.select(first, Math.min(last, first + Math.ceil(24e6 / pl)), 2);   // head: container header, first seconds
  t.select(Math.max(first, last - Math.ceil(8e6 / pl)), last, 2);     // tail: index/cues of MKV/MP4
  log('prefetch', t.infoHash, 'pieceLength=' + pl, 'file=' + main.name);
}

function trim(keep) {
  const others = client.torrents.filter((t) => t.infoHash && t.infoHash !== keep).sort((a, b) => (lastUsed.get(a.infoHash) || 0) - (lastUsed.get(b.infoHash) || 0));
  while (others.length >= MAX_ACTIVE) {
    const old = others.shift();
    log('dropping', old.infoHash);
    old.destroy({ destroyStore: true });
  }
}

function pickFile(torrent, idx, nameHint) {
  if (Number.isInteger(idx) && idx >= 0 && torrent.files[idx]) return torrent.files[idx];
  if (nameHint) {
    const f = torrent.files.find((x) => x.name === nameHint || x.path.endsWith(nameHint));
    if (f) return f;
  }
  const vids = torrent.files.filter((f) => VIDEO.test(f.name));
  return (vids.length ? vids : torrent.files).reduce((a, b) => (b.length > a.length ? b : a));
}

const MIME = { mkv: 'video/x-matroska', mp4: 'video/mp4', m4v: 'video/mp4', webm: 'video/webm', avi: 'video/x-msvideo', mov: 'video/quicktime', ts: 'video/mp2t', m2ts: 'video/mp2t' };
const mimeOf = (name) => MIME[name.split('.').pop().toLowerCase()] || 'application/octet-stream';

function statsOf(t, file) {
  const s = {
    infoHash: t.infoHash, name: t.name, peers: t.numPeers, unchoked: t.numPeers, queued: 0, unique: t.numPeers, connectionTries: 0,
    swarmPaused: false, swarmConnections: t.numPeers, swarmSize: t.numPeers, selections: [], wires: null,
    downloaded: t.downloaded, uploaded: t.uploaded, downloadSpeed: t.downloadSpeed, uploadSpeed: t.uploadSpeed,
    sources: [], files: t.files.map((f) => ({ name: f.name, path: f.path, length: f.length, offset: f.offset })),
  };
  if (file) { s.streamName = file.name; s.streamLen = file.length; s.streamProgress = file.progress; }
  return s;
}

function send(res, status, body, headers = {}) {
  const data = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), ...headers });
  res.end(data);
}

async function streamFile(req, res, file, cors) {
  const size = file.length;
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  let start = 0, end = size - 1, status = 200;
  if (range && (range[1] || range[2])) {
    if (range[1] === '') { start = Math.max(0, size - Number(range[2])); }
    else { start = Number(range[1]); if (range[2]) end = Math.min(Number(range[2]), size - 1); }
    if (start > end || start >= size) { res.writeHead(416, { 'Content-Range': `bytes */${size}`, ...cors }); return res.end(); }
    status = 206;
  }
  const headers = { 'Content-Type': mimeOf(file.name), 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1, 'Cache-Control': 'no-store', ...cors };
  if (status === 206) headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
  res.writeHead(status, headers);
  res.flushHeaders();                 // send headers now, the player must not wait for the first piece
  if (req.method === 'HEAD') return res.end();
  file.select();
  const rs = file.createReadStream({ start, end });
  const stop = () => rs.destroy();
  res.on('close', stop);
  rs.on('error', () => res.destroy());
  rs.pipe(res);
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = []; let n = 0;
    req.on('data', (c) => { n += c.length; if (n < 4e6) chunks.push(c); });
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString() || '{}')); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://127.0.0.1');
  const p = u.pathname;
  const origin = req.headers.origin;
  const cors = ALLOWED_ORIGINS.has(origin)
    ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin', 'Access-Control-Allow-Methods': 'GET, POST, HEAD, OPTIONS', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Private-Network': 'true', 'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges, Content-Length' }
    : {};
  // Other web pages must not read or drive this server.
  if (origin && !ALLOWED_ORIGINS.has(origin)) return send(res, 403, { error: 'forbidden origin' });
  log(req.method, req.url.slice(0, 200), 'range=' + (req.headers.range || '-'));
  try {
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
    if (p === '/settings') { await readBody(req); return send(res, 200, req.method === 'POST' ? { success: true } : SETTINGS, cors); }
    if (p === '/network-info') return send(res, 200, { availableInterfaces: [] }, cors);
    if (p === '/device-info') return send(res, 200, { availableHardwareAccelerations: [] }, cors);
    if (p === '/casting') return send(res, 200, [], cors);
    if (p === '/heartbeat') return send(res, 200, { success: true }, cors);
    if (p === '/stats.json') return send(res, 200, Object.fromEntries(client.torrents.map((t) => [t.infoHash, statsOf(t)])), cors);

    const m = /^\/([0-9a-fA-F]{40})(?:\/(-?\d+|[^/]*))?(?:\/(stats\.json))?$/.exec(p);
    const create = /^\/([0-9a-fA-F]{40})\/create$/.exec(p);
    if (create) {
      const body = await readBody(req);
      const trackers = (body.peerSearch?.sources || []).filter((s) => s.startsWith('tracker:')).map((s) => s.slice(8));
      const t = await getTorrent(create[1], trackers);
      return send(res, 200, statsOf(t), cors);
    }
    if (m) {
      const trackers = u.searchParams.getAll('tr').map((s) => s.replace(/^tracker:/, ''));
      const isStats = m[3] === 'stats.json' || m[2] === 'stats.json';
      if (isStats) {
        const cur = client.torrents.find((x) => x.infoHash === m[1].toLowerCase());
        if (!cur || !cur.files || !cur.files.length) { if (!cur) getTorrent(m[1], trackers).catch(() => {}); return send(res, 200, { infoHash: m[1].toLowerCase(), peers: cur ? cur.numPeers : 0, unchoked: 0, downloadSpeed: cur ? cur.downloadSpeed : 0, uploadSpeed: 0, downloaded: 0, uploaded: 0, files: [] }, cors); }
      }
      const t = await getTorrent(m[1], trackers);
      if (m[3] === 'stats.json' || m[2] === 'stats.json') return send(res, 200, statsOf(t, m[2] && m[2] !== 'stats.json' ? pickFile(t, Number(m[2])) : undefined), cors);
      const idx = m[2] === undefined || m[2] === '' ? -1 : Number(m[2]);
      const file = pickFile(t, idx, u.searchParams.get('filename') || '');
      return streamFile(req, res, file, cors);
    }
    if (WEB_DIR && (req.method === 'GET' || req.method === 'HEAD')) {
      let rel = decodeURIComponent(p);
      if (rel.endsWith('/')) rel += 'index.html';
      const file = path.resolve(WEB_DIR, '.' + rel);
      if ((file === WEB_DIR || file.startsWith(WEB_DIR + path.sep)) && fs.existsSync(file) && fs.statSync(file).isFile()) {
        const data = fs.readFileSync(file);
        res.writeHead(200, { 'Content-Type': STATIC_MIME[file.split('.').pop().toLowerCase()] || 'application/octet-stream', 'Content-Length': data.length, 'Cache-Control': 'no-cache', ...cors });
        return res.end(req.method === 'HEAD' ? undefined : data);
      }
    }
    send(res, 404, { error: 'not found' }, cors);
  } catch (e) {
    log('error', p, e.message);
    if (!res.headersSent) send(res, 502, { error: String(e.message || e) }, cors);
    else res.destroy();
  }
});

server.listen(PORT, '127.0.0.1', () => log('listening', PORT));
process.on('uncaughtException', (e) => log('uncaught', e.message));
process.on('unhandledRejection', (e) => log('unhandled', e?.message || e));
const bye = () => { client.destroy(() => { fs.rmSync(DIR, { recursive: true, force: true }); process.exit(0); }); setTimeout(() => process.exit(0), 3000); };
process.on('SIGINT', bye); process.on('SIGTERM', bye);
setInterval(() => { for (const t of client.torrents) log('status', t.infoHash, 'peers=' + t.numPeers, 'down=' + Math.round(t.downloadSpeed / 1024) + 'KB/s', 'progress=' + (t.progress * 100).toFixed(1) + '%', 'ready=' + t.ready); }, 5000).unref();
