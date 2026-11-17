// Apex Clan League API — one function, runs on Netlify (Functions v2) or locally via server.mjs
import crypto from 'node:crypto';

const env = k => (globalThis.Netlify?.env?.get?.(k)) ?? process.env[k];
const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

// ---------- cleaning ----------
const INVISIBLE = /[\u0000-\u001F\u007F-\u009F\u00AD\u034F\u061C\u115F\u1160\u17B4\u17B5\u180B-\u180E\u200B\u200C\u200E\u200F\u202A-\u202E\u2060-\u206F\u2800\u3164\uFE00-\uFE0E\uFEFF\uFFA0\uFFF9-\uFFFB\uE000-\uF8FF]/g;
const clean = s => String(s ?? '').normalize('NFC').replace(INVISIBLE, '').replace(/[\u{E0000}-\u{E007F}]/gu, '').replace(/</g, '‹').replace(/>/g, '›').replace(/"/g, '”').replace(/\s+/g, ' ').trim().slice(0, 60);
const num = (v, lo, hi, d = 0) => { v = Number(v); return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d; };
const safeUrl = u => (typeof u === 'string' && /^https:\/\/[a-z0-9.-]*clashofclans\.com\//i.test(u) && !/["'<>\s]/.test(u)) ? u : null;
const tagOf = t => (t ? String(t).replace(/[^#0-9A-Za-z]/g, '').slice(0, 16) : undefined);
function sanitize(st) {
  return {
    members: st.members.slice(0, 200).map(m => ({
      n: clean(m.n), th: num(m.th, 1, 18, 12), clan: clean(m.clan), avail: num(m.avail, 1, 14, 7), tag: tagOf(m.tag), lg: safeUrl(m.lg),
      at: (Array.isArray(m.at) ? m.at : []).slice(0, 14).map(a => ({
        th: num(a.th, 1, 18, 12), mx: num(a.mx, 1, 18, 12), tg: num(a.tg, 0, 18), st: num(a.st, 0, 3), d: num(a.d, 0, 100),
        tl: num(a.tl, 0, 180), al: num(a.al, 0, 100), war: num(a.war, 1, 7, 1), pend: !!a.pend,
      })),
    })),
    groups: (Array.isArray(st.groups) ? st.groups : []).slice(0, 100).map(g => ({ id: num(g.id, 0, 1e15), rep: clean(g.rep), accts: (g.accts || []).slice(0, 10).map(clean) })),
    pool: (Array.isArray(st.pool) ? st.pool : []).slice(0, 200).map(p => ({ n: clean(p.n), th: num(p.th, 1, 18, 12), clan: clean(p.clan), tag: tagOf(p.tag), lg: safeUrl(p.lg) })),
    cb: Object.fromEntries(Object.entries(st.cb || {}).slice(0, 20).map(([k, v]) => [clean(k), safeUrl(v)]).filter(([, v]) => v)),
    clans: (Array.isArray(st.clans) ? st.clans : []).slice(0, 10).map(c => ({ tag: tagOf(c.tag), name: clean(c.name), badge: safeUrl(c.badge) })),
    tags: Object.fromEntries(Object.entries(st.tags || {}).slice(0, 10).map(([k, v]) => [tagOf(k) || '', { season: clean(v?.season).slice(0, 12), rounds: (Array.isArray(v?.rounds) ? v.rounds : []).slice(0, 7).map(r => (Array.isArray(r) ? r : []).slice(0, 4).filter(t => t === '#0' || /^#[0-9A-Z]{3,12}$/.test(t))) }]).filter(([k]) => k)),
    cfg: { clanTag: clean(st.cfg?.clanTag).slice(0, 14), ghosts: num(st.cfg?.ghosts, 0, 10, 5), season: clean(st.cfg?.season).slice(0, 40), topBonus: num(st.cfg?.topBonus, 0, 0.3, 0.08), maxTH: num(st.cfg?.maxTH, 12, 25, 18), bonusCap: num(st.cfg?.bonusCap, 5, 30, 15), bonusDiv: num(st.cfg?.bonusDiv, 1, 10, 2) },
  };
}

// ---------- storage: Netlify Blobs in production, JSON files when running locally ----------
// IMPORTANT: on Netlify the storage token is per request, so a new store is made on every request (never cached).
let _local;
async function kv() {
  if (process.env.APEX_LOCAL) {
    if (_local) return _local;
    const fs = await import('node:fs/promises');
    const dir = process.env.APEX_DATA || './data';
    await fs.mkdir(dir, { recursive: true });
    _local = {
      async get(k) { try { return JSON.parse(await fs.readFile(`${dir}/${k}.json`, 'utf8')); } catch { return null; } },
      async set(k, v) { await fs.writeFile(`${dir}/${k}.json.tmp`, JSON.stringify(v)); await fs.rename(`${dir}/${k}.json.tmp`, `${dir}/${k}.json`); },
    };
    return _local;
  }
  const { getStore } = await import('@netlify/blobs');
  const s = getStore({ name: 'apex', consistency: 'strong' });
  return { get: k => s.get(k, { type: 'json' }), set: (k, v) => s.setJSON(k, v) };
}

// ---------- accounts: one supreme leader (password in Netlify settings) + named leaders made by the supreme leader ----------
const supremePw = () => env('SUPREME_PASSWORD') || env('LEADER_PASSWORD');
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const sign = (p, secret) => crypto.createHmac('sha256', secret).update(p).digest('base64url');
const mkToken = (r, n, i) => { const p = b64({ r, n, i, e: Date.now() + 30 * 864e5 }); return p + '.' + sign(p, env('SESSION_SECRET')); };
function readToken(t) {
  const secret = env('SESSION_SECRET');
  if (!secret || !t) return null;
  const [p, sig] = String(t).split('.');
  if (!p || !sig) return null;
  const a = Buffer.from(sig), b = Buffer.from(sign(p, secret));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try { const o = JSON.parse(Buffer.from(p, 'base64url').toString()); return o.e > Date.now() ? o : null; } catch { return null; }
}
const same = (a, b) => crypto.timingSafeEqual(crypto.createHash('sha256').update(String(a)).digest(), crypto.createHash('sha256').update(String(b)).digest());
const hashPw = (pw, salt = crypto.randomBytes(16).toString('hex')) => ({ salt, hash: crypto.scryptSync(String(pw), salt, 32).toString('hex') });
const checkPw = (pw, rec) => { const h = Buffer.from(crypto.scryptSync(String(pw), rec.salt, 32).toString('hex')), g = Buffer.from(rec.hash); return h.length === g.length && crypto.timingSafeEqual(h, g); };
const getAuth = async S => (await S.get('auth')) || { leaders: [] };
const delay = ms => new Promise(r => setTimeout(r, ms));

async function who(req, S) {
  const t = readToken((req.headers.get('authorization') || '').replace(/^Bearer /, ''));
  if (!t) return null;
  if (t.r === 'supreme') return { role: 'supreme', name: 'supreme' };
  const L = (await getAuth(S)).leaders.find(x => x.id === t.i);
  return L && !L.banned ? { role: 'leader', name: L.name, id: L.id } : null;
}

// ---------- activity log: compares the old and new state, so every change is recorded ----------
async function audit(S, me, msgs) {
  if (!msgs.length) return;
  const log = (await S.get('audit')) || [];
  const t = new Date().toISOString();
  for (const m of msgs.slice(0, 60)) log.push({ t, who: me.name, role: me.role, msg: m });
  if (msgs.length > 60) log.push({ t, who: me.name, role: me.role, msg: '…and ' + (msgs.length - 60) + ' more changes' });
  await S.set('audit', log.slice(-800));
}
function diffState(o, n) {
  const out = [], key = m => m.tag || m.n;
  const om = new Map((o?.members || []).map(m => [key(m), m])), nm = new Map(n.members.map(m => [key(m), m]));
  for (const [k, m] of nm) {
    const p = om.get(k);
    if (!p) { out.push(`Added player ${m.n} (${m.clan})`); continue; }
    if (p.avail !== m.avail) out.push(`${m.n}: attacks available ${p.avail} → ${m.avail}`);
    const pd = new Map(p.at.map(a => [a.war, a])), nd = new Map(m.at.map(a => [a.war, a]));
    for (const [d, a] of nd) {
      const q = pd.get(d);
      if (!q) { out.push(`${m.n}: added Day ${d} attack (${a.st}★ ${a.d}%, target TH${a.tg})`); continue; }
      const ch = [];
      if (q.st !== a.st) ch.push(`stars ${q.st}→${a.st}`);
      if (q.d !== a.d) ch.push(`destruction ${q.d}→${a.d}%`);
      if (q.tl !== a.tl) ch.push(`time left ${q.tl}→${a.tl}s`);
      if (q.al !== a.al) ch.push(`army left ${q.al}→${a.al}%`);
      if (q.tg !== a.tg) ch.push(`target TH ${q.tg}→${a.tg}`);
      if (ch.length) out.push(`${m.n}: edited Day ${d} (${ch.join(', ')})`);
    }
    for (const d of pd.keys()) if (!nd.has(d)) out.push(`${m.n}: deleted Day ${d} attack`);
  }
  for (const [k, m] of om) if (!nm.has(k)) out.push(`Removed player ${m.n}`);
  const oc = new Set((o?.clans || []).map(c => c.name)), nc = new Set((n.clans || []).map(c => c.name));
  for (const c of nc) if (!oc.has(c)) out.push(`Added clan ${c}`);
  for (const c of oc) if (!nc.has(c)) out.push(`Removed clan ${c}`);
  const og = (o?.groups || []).map(g => g.rep + ':' + g.accts.join('+')).sort().join('|'), ng = (n.groups || []).map(g => g.rep + ':' + g.accts.join('+')).sort().join('|');
  if (og !== ng) out.push('Changed linked accounts');
  if ((o?.cfg?.ghosts) !== n.cfg.ghosts) out.push(`Ghost positions set to ${n.cfg.ghosts}`);
  if ((o?.cfg?.season || '') !== (n.cfg.season || '')) out.push(`Season name set to "${n.cfg.season}"`);
  return out;
}

// ---------- Clash of Clans API (through the RoyaleAPI proxy by default) ----------
const BASE = () => env('COC_BASE') || 'https://cocproxy.royaleapi.dev/v1';
const normTag = t => { t = String(t || '').trim().toUpperCase(); if (!t.startsWith('#')) t = '#' + t; return /^#[0289PYLQGRJCUV]{3,12}$/.test(t) ? t : null; };
const enc = encodeURIComponent;
const fail = (message, status) => Object.assign(new Error(message), { status });
async function coc(path) {
  const key = String(env('COC_TOKEN') || '').trim();
  if (!key) throw fail('COC_TOKEN is not set on the server', 500);
  let r;
  try {
    r = await fetch(BASE() + path, { headers: { authorization: 'Bearer ' + key, accept: 'application/json' }, signal: AbortSignal.timeout(9000) });
  } catch (e) {
    throw fail('Could not reach the Clash API proxy (' + (e.name === 'TimeoutError' ? 'timed out' : 'network error') + ').', 502);
  }
  let j = {}; try { j = await r.json(); } catch { /* not json */ }
  if (!r.ok) {
    const tail = ' [' + r.status + (j.reason ? ' ' + j.reason : '') + (j.message ? ': ' + String(j.message).slice(0, 140) : '') + ']';
    const m = r.status === 403 ? 'The Clash API refused the key. Make sure it was created for 45.79.218.79 and pasted with no spaces.'
      : r.status === 404 ? 'Not found. Check the clan tag, and that the clan is in a CWL right now if you are pulling attacks.'
      : r.status === 429 ? 'The Clash API is busy. Try again in a minute.'
      : r.status === 503 ? 'The Clash API is down for maintenance. Try again later.' : 'Clash API error.';
    throw fail(m + tail, r.status === 404 ? 404 : 502);
  }
  return j;
}
const leagueIcon = p => p?.leagueTier?.iconUrls?.small || p?.league?.iconUrls?.small || null;

async function pool(items, n, fn) {
  const out = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } }));
  return out;
}
const group = tag => coc('/clans/' + enc(tag) + '/currentwar/leaguegroup');
const startedDays = g => (g.rounds || []).map((r, i) => ({ day: i + 1, tags: (r.warTags || []).filter(t => t !== '#0') })).filter(r => r.tags.length);

// Clan + its CWL roster (the 15 or 30 players actually in the league) + every clan member
async function clanInfo(tag) {
  const c = await coc('/clans/' + enc(tag));
  const members = (c.memberList || []).map(p => ({ tag: p.tag, name: clean(p.name), th: p.townHallLevel || 0, lg: safeUrl(leagueIcon(p)) }));
  const icon = new Map(members.map(m => [m.tag, m.lg]));
  let cwl = null, cwlNote = '';
  try {
    const g = await group(tag);
    const me = (g.clans || []).find(x => x.tag === tag);
    cwl = { state: g.state, season: g.season, started: startedDays(g).length, roster: (me?.members || []).map(p => ({ tag: p.tag, name: clean(p.name), th: p.townHallLevel || 0, lg: icon.get(p.tag) || null })) };
    if (!cwl.roster.length) cwlNote = 'The CWL group has no roster listed for this clan yet.';
  } catch (e) {
    if (e.status === 404) cwlNote = 'This clan is not in a Clan War League right now, so all clan members were put in the picker instead.';
    else throw e;
  }
  return { name: clean(c.name), tag: c.tag, badge: safeUrl(c.badgeUrls?.small), members, cwl, cwlNote };
}

// Attacks for one CWL day, or every day started so far. If the season has ended and the CWL group is gone,
// the war tags saved earlier (from a previous pull) are used instead.
async function sync(tag, day, saved) {
  let g = null, rounds;
  try { g = await group(tag); rounds = (g.rounds || []).map(r => r.warTags || []); }
  catch (e) { if (saved?.rounds?.length && (e.status === 404 || e.status === 409)) rounds = saved.rounds; else throw e; }
  const S = rounds.map((r, i) => ({ day: i + 1, tags: r.filter(t => t !== '#0') })).filter(r => r.tags.length);
  const want = day === 'all' ? S : S.filter(r => r.day === day);
  if (!want.length) throw fail(day === 'all' ? 'No CWL day has started yet.' : 'Day ' + day + ' has not started yet.', 409);
  const jobs = want.flatMap(r => r.tags.map(t => ({ day: r.day, tag: t })));
  const wars = await pool(jobs, 6, async j => ({ day: j.day, w: await coc('/clanwarleagues/wars/' + enc(j.tag)) }));
  const out = [], found = new Set();
  for (const { day: d, w } of wars) {
    const mine = w.clan?.tag === tag ? w.clan : w.opponent?.tag === tag ? w.opponent : null;
    if (!mine) continue;
    found.add(d);
    const theirs = mine === w.clan ? w.opponent : w.clan;
    const thOf = new Map((theirs.members || []).map(m => [m.tag, m.townhallLevel]));
    const mx = Math.max(0, ...(theirs.members || []).map(m => m.townhallLevel || 0));
    for (const m of mine.members || []) for (const a of m.attacks || []) {
      out.push({ day: d, tag: m.tag, name: clean(m.name), th: m.townhallLevel, mx, tg: thOf.get(a.defenderTag) || 0, st: a.stars, d: a.destructionPercentage, tl: Math.max(0, Math.min(180, 180 - (a.duration || 0))) });
    }
  }
  if (day !== 'all' && !found.size) throw fail('Your clan was not found in Day ' + day + ' of this CWL.', 404);
  return { attacks: out, days: [...found].sort((a, b) => a - b), started: S.length, state: g ? g.state : 'saved', season: g ? g.season : saved?.season, rounds, usedSaved: !g };
}

// Step-by-step check so the leader can see exactly what is failing
async function diagnose(tag) {
  const steps = []; const add = (step, ok, detail) => steps.push({ step, ok, detail });
  const key = String(env('COC_TOKEN') || '').trim();
  add('Server has COC_TOKEN', !!key, key ? 'Key found (' + key.length + ' characters)' : 'Missing. Add it in Netlify environment variables and redeploy.');
  if (!key) return steps;
  try { const c = await coc('/clans/' + enc(tag)); add('Clan lookup', true, clean(c.name) + ' · ' + (c.memberList || []).length + ' members'); }
  catch (e) { add('Clan lookup', false, e.message); return steps; }
  try { const g = await group(tag); const me = (g.clans || []).find(x => x.tag === tag); add('CWL group', true, 'state ' + g.state + ' · season ' + g.season + ' · ' + startedDays(g).length + ' day(s) started · ' + (me?.members || []).length + ' players on the CWL roster'); }
  catch (e) { add('CWL group', false, e.message); }
  return steps;
}

// ---------- routes ----------
export default async (req) => {
  try {
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/api/, '') || '/';

    // Same-origin copy of Clash badge/league icons so the export canvas can draw them (their CDN sends no CORS header)
    if (path === '/img' && req.method === 'GET') {
      let u; try { u = new URL(url.searchParams.get('u') || ''); } catch { return J({ error: 'Bad url' }, 400); }
      if (u.protocol !== 'https:' || !/(^|\.)clashofclans\.com$/i.test(u.hostname)) return J({ error: 'Not allowed' }, 400);
      let r; try { r = await fetch(u.href, { signal: AbortSignal.timeout(8000) }); } catch { return J({ error: 'Image fetch failed' }, 502); }
      const ct = r.headers.get('content-type') || '';
      if (!r.ok || !ct.startsWith('image/')) return J({ error: 'Not an image' }, 502);
      const buf = await r.arrayBuffer();
      if (buf.byteLength > 2000000) return J({ error: 'Too large' }, 413);
      return new Response(buf, { status: 200, headers: { 'content-type': ct, 'cache-control': 'public, max-age=86400' } });
    }

    const S = await kv();

    if (path === '/state' && req.method === 'GET') return J((await S.get('state')) || { rev: 0, state: null });

    if (path === '/archive' && req.method === 'GET') {
      const A = (await S.get('archive')) || [];
      return J({ seasons: A.map(x => ({ id: x.id, name: x.name, saved: x.saved, summary: x.summary })).reverse() });
    }
    const am = path.match(/^\/archive\/([a-f0-9]+)$/);
    if (am && req.method === 'GET') {
      const x = ((await S.get('archive')) || []).find(y => y.id === am[1]);
      return x ? J({ id: x.id, name: x.name, saved: x.saved, state: x.state }) : J({ error: 'No such season' }, 404);
    }

    if (path === '/login' && req.method === 'POST') {
      if (!supremePw() || !env('SESSION_SECRET')) return J({ error: 'Server not configured: set SUPREME_PASSWORD (or LEADER_PASSWORD) and SESSION_SECRET.' }, 500);
      const b = await req.json().catch(() => ({}));
      const name = String(b.name || 'supreme').trim().toLowerCase() || 'supreme';
      if (name === 'supreme') {
        if (same(b.password || '', supremePw())) { await audit(S, { name: 'supreme', role: 'supreme' }, ['Logged in']); return J({ token: mkToken('supreme', 'supreme', 'supreme'), role: 'supreme', name: 'supreme' }); }
      } else {
        const A = await getAuth(S), L = A.leaders.find(x => x.name.toLowerCase() === name);
        if (L && checkPw(b.password || '', L)) {
          if (L.banned) return J({ error: 'This leader account has been banned.' }, 403);
          L.last = new Date().toISOString(); await S.set('auth', A);
          await audit(S, { name: L.name, role: 'leader' }, ['Logged in']);
          return J({ token: mkToken('leader', L.name, L.id), role: 'leader', name: L.name });
        }
      }
      await delay(600);
      await audit(S, { name: 'unknown', role: 'none' }, ['Failed login for "' + clean(name).slice(0, 24) + '"']);
      return J({ error: 'Wrong name or password' }, 401);
    }

    const me = await who(req, S);
    if (!me) return J({ error: 'Not logged in' }, 401);

    if (path === '/state' && req.method === 'PUT') {
      const raw = await req.text();
      if (raw.length > 1500000) return J({ error: 'State too large' }, 413);
      let b; try { b = JSON.parse(raw); } catch { return J({ error: 'Bad JSON' }, 400); }
      if (!b.state || !Array.isArray(b.state.members)) return J({ error: 'Bad state' }, 400);
      const cur = (await S.get('state')) || { rev: 0 };
      if (Number(b.rev) !== cur.rev) return J({ error: 'Changed by someone else', rev: cur.rev }, 409);
      const next = { rev: cur.rev + 1, updated: new Date().toISOString(), by: me.name, state: sanitize(b.state) };
      await S.set('state', next);
      await audit(S, me, diffState(cur.state, next.state));
      return J({ rev: next.rev });
    }

    if (path === '/clan' && req.method === 'GET') {
      const tag = normTag(url.searchParams.get('tag'));
      if (!tag) return J({ error: 'That does not look like a clan tag' }, 400);
      return J(await clanInfo(tag));
    }
    if (path === '/diagnose' && req.method === 'GET') {
      const tag = normTag(url.searchParams.get('tag'));
      if (!tag) return J({ error: 'That does not look like a clan tag' }, 400);
      return J({ steps: await diagnose(tag) });
    }
    if (path === '/sync' && req.method === 'POST') {
      const b = await req.json().catch(() => ({}));
      const tag = normTag(b.tag), day = b.day === 'all' ? 'all' : Number(b.day);
      if (!tag || !(day === 'all' || (day >= 1 && day <= 7))) return J({ error: 'Need a clan tag and a day from 1 to 7' }, 400);
      let saved = null;
      if (b.saved && Array.isArray(b.saved.rounds)) saved = { season: clean(b.saved.season).slice(0, 12), rounds: b.saved.rounds.slice(0, 7).map(r => (Array.isArray(r) ? r : []).slice(0, 4).filter(t => t === '#0' || /^#[0-9A-Z]{3,12}$/.test(t))) };
      return J(await sync(tag, day, saved));
    }

    // ----- supreme leader only -----
    if (path.startsWith('/admin/')) {
      if (me.role !== 'supreme') return J({ error: 'Supreme leader only' }, 403);
      const A = await getAuth(S);
      const pub = L => ({ id: L.id, name: L.name, banned: !!L.banned, created: L.created, last: L.last || null });

      if (path === '/admin/leaders' && req.method === 'GET') return J({ leaders: A.leaders.map(pub) });
      if (path === '/admin/leaders' && req.method === 'POST') {
        const b = await req.json().catch(() => ({}));
        const name = String(b.name || '').trim();
        if (!/^[A-Za-z0-9 _-]{2,24}$/.test(name) || name.toLowerCase() === 'supreme') return J({ error: 'Name must be 2 to 24 letters, numbers, spaces, - or _ (and not "supreme").' }, 400);
        if (String(b.password || '').length < 6) return J({ error: 'Password must be at least 6 characters.' }, 400);
        if (A.leaders.some(x => x.name.toLowerCase() === name.toLowerCase())) return J({ error: 'A leader with that name already exists.' }, 409);
        if (A.leaders.length >= 30) return J({ error: 'Too many leaders.' }, 400);
        const L = { id: crypto.randomBytes(8).toString('hex'), name, ...hashPw(b.password), created: new Date().toISOString(), banned: false };
        A.leaders.push(L); await S.set('auth', A);
        await audit(S, me, ['Created leader ' + name]);
        return J({ leader: pub(L) });
      }
      const m = path.match(/^\/admin\/leaders\/([a-f0-9]+)$/);
      if (m) {
        const L = A.leaders.find(x => x.id === m[1]);
        if (!L) return J({ error: 'No such leader' }, 404);
        if (req.method === 'PUT') {
          const b = await req.json().catch(() => ({})), msgs = [];
          if (typeof b.banned === 'boolean' && b.banned !== !!L.banned) { L.banned = b.banned; msgs.push((b.banned ? 'Banned leader ' : 'Unbanned leader ') + L.name); }
          if (b.password !== undefined) {
            if (String(b.password).length < 6) return J({ error: 'Password must be at least 6 characters.' }, 400);
            Object.assign(L, hashPw(b.password)); msgs.push('Changed password for leader ' + L.name);
          }
          await S.set('auth', A); await audit(S, me, msgs);
          return J({ leader: pub(L) });
        }
        if (req.method === 'DELETE') {
          A.leaders = A.leaders.filter(x => x.id !== L.id); await S.set('auth', A);
          await audit(S, me, ['Deleted leader ' + L.name]);
          return J({ ok: true });
        }
      }
      if (path === '/admin/season/finish' && req.method === 'POST') {
        const b = await req.json().catch(() => ({}));
        const cur = await S.get('state');
        if (!cur?.state?.members?.length) return J({ error: 'There is nothing to archive yet.' }, 400);
        const sm = b.summary || {};
        const entry = {
          id: crypto.randomBytes(6).toString('hex'), name: clean(b.name || 'Season').slice(0, 40), saved: new Date().toISOString(), by: me.name,
          summary: { players: num(sm.players, 0, 500), attacks: num(sm.attacks, 0, 5000), clans: num(sm.clans, 0, 20), top: (Array.isArray(sm.top) ? sm.top : []).slice(0, 10).map(t => ({ n: clean(t.n), clan: clean(t.clan), fin: Math.round(num(t.fin, 0, 200) * 10) / 10 })) },
          state: cur.state,
        };
        const arch = ((await S.get('archive')) || []); arch.push(entry);
        await S.set('archive', arch.slice(-30));
        const fresh = { ...cur.state, members: [], pool: [], tags: {}, cfg: { ...cur.state.cfg, season: '' } };
        const next = { rev: cur.rev + 1, updated: new Date().toISOString(), by: me.name, state: sanitize(fresh) };
        await S.set('state', next);
        await audit(S, me, ['Finished season "' + entry.name + '" and started a new one']);
        return J({ rev: next.rev, id: entry.id });
      }
      const dm = path.match(/^\/admin\/archive\/([a-f0-9]+)$/);
      if (dm && req.method === 'DELETE') {
        const arch = (await S.get('archive')) || [], x = arch.find(y => y.id === dm[1]);
        if (!x) return J({ error: 'No such season' }, 404);
        await S.set('archive', arch.filter(y => y.id !== x.id));
        await audit(S, me, ['Deleted archived season "' + x.name + '"']);
        return J({ ok: true });
      }
      if (path === '/admin/log' && req.method === 'GET') return J({ log: ((await S.get('audit')) || []).slice(-300).reverse() });
      if (path === '/admin/export' && req.method === 'GET') return J((await S.get('state')) || { rev: 0, state: null });
      if (path === '/admin/import' && req.method === 'POST') {
        const raw = await req.text();
        if (raw.length > 1500000) return J({ error: 'File too large' }, 413);
        let b; try { b = JSON.parse(raw); } catch { return J({ error: 'Not a valid backup file' }, 400); }
        const st = b.state || b;
        if (!st || !Array.isArray(st.members)) return J({ error: 'Not a valid backup file' }, 400);
        const cur = (await S.get('state')) || { rev: 0 };
        await S.set('state', { rev: cur.rev + 1, updated: new Date().toISOString(), by: me.name, state: sanitize(st) });
        await audit(S, me, ['Restored a backup']);
        return J({ rev: cur.rev + 1 });
      }
    }

    return J({ error: 'Not found' }, 404);
  } catch (e) {
    return J({ error: e.message || 'Server error' }, e.status || 500);
  }
};

export const config = { path: '/api/*' };
