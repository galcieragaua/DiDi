/* ¿DRIVER o NO? — capa de datos.
   Supabase por REST plano (sin CDN, sin dependencias). Si SB_URL/SB_KEY están
   vacíos o el proyecto no responde, todo cae a modo local con IndexedDB. */

const SB_URL = 'https://fywpmdmszvhxxifruexe.supabase.co';
const SB_KEY = 'sb_publishable_1Ay3iXHjpXJBWwoOOt3dKA_RYx38EHW';
const BUCKET = 'fotos';

const sbConfigured = () => !!(SB_URL && SB_KEY);
const tokenKey = 'dn_tok';
const getToken = () => localStorage.getItem(tokenKey) || '';
const setToken = t => t ? localStorage.setItem(tokenKey, t) : localStorage.removeItem(tokenKey);

function headers(extra = {}, auth = false) {
  const h = { apikey: SB_KEY, Authorization: 'Bearer ' + ((auth && getToken()) || SB_KEY), ...extra };
  return h;
}

async function rest(path, opts = {}, auth = false) {
  const r = await fetch(SB_URL + path, { ...opts, headers: headers(opts.headers || {}, auth) });
  if (!r.ok) throw new Error('supabase ' + r.status + ' ' + (await r.text()).slice(0, 200));
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

const publicUrl = p => `${SB_URL}/storage/v1/object/public/${BUCKET}/${p}`;

/* ---------- IndexedDB (modo local / cola offline) ---------- */

function idb() {
  return new Promise((res, rej) => {
    const q = indexedDB.open('driverono', 1);
    q.onupgradeneeded = () => q.result.createObjectStore('subs', { keyPath: 'id', autoIncrement: true });
    q.onsuccess = () => res(q.result);
    q.onerror = () => rej(q.error);
  });
}
async function idbAll() {
  const db = await idb();
  return new Promise((res, rej) => {
    const q = db.transaction('subs').objectStore('subs').getAll();
    q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error);
  });
}
async function idbPut(rec) {
  const db = await idb();
  return new Promise((res, rej) => {
    const q = db.transaction('subs', 'readwrite').objectStore('subs').put(rec);
    q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error);
  });
}
async function idbDel(id) {
  const db = await idb();
  return new Promise((res, rej) => {
    const q = db.transaction('subs', 'readwrite').objectStore('subs').delete(id);
    q.onsuccess = () => res(); q.onerror = () => rej(q.error);
  });
}

/* Las rondas locales guardan blobs; se exponen como object URLs. */
const localRound = r => ({
  id: 'L' + r.id, car: URL.createObjectURL(r.car), proof: r.proof ? URL.createObjectURL(r.proof) : null,
  truth: r.truth ?? null, yes: r.yes ?? 50, note: r.note || '', status: r.status, local: true,
  created_at: r.created_at
});

/* ---------- API pública ---------- */

/** Rondas semilla que viven en el repo. Siempre presentes, así el juego nunca arranca vacío. */
const SEED = [
  { id: 'S1', car: 'assets/auto_01.jpg', proof: null, truth: null, yes: 63, note: '' },
  { id: 'S2', car: 'assets/auto_02.jpg', proof: null, truth: null, yes: 44, note: '' }
];

/** Rondas jugables: semillas + aprobadas (remotas o locales). */
async function getRounds() {
  const out = [...SEED];
  if (sbConfigured()) {
    try {
      const rows = await rest('/rest/v1/rounds?status=eq.approved&select=*&order=created_at.desc&limit=200');
      for (const r of rows) out.push({
        id: r.id, car: publicUrl(r.car_path), proof: r.proof_path ? publicUrl(r.proof_path) : null,
        truth: r.truth, yes: pct(r), note: r.note || ''
      });
    } catch (e) { console.warn('[rounds] remoto no disponible, sigo con semillas + local:', e.message); }
  }
  try {
    (await idbAll()).filter(r => r.status === 'approved').forEach(r => out.push(localRound(r)));
  } catch {}
  return out;
}

/** % que votó "driver". Sin votos todavía, se usa el valor sembrado o 50. */
function pct(r) {
  const t = (r.votes_yes || 0) + (r.votes_no || 0);
  return t < 5 ? 50 : Math.round((r.votes_yes / t) * 100);
}

/** Manda una propuesta. Si Supabase no está listo, queda en IndexedDB como pending. */
async function submitRound({ carBlob, proofBlob, note }) {
  if (sbConfigured()) {
    try {
      const stamp = Date.now() + '-' + Math.random().toString(36).slice(2, 8);
      const carPath = `car/${stamp}.jpg`;
      await put(carPath, carBlob);
      let proofPath = null;
      if (proofBlob) { proofPath = `proof/${stamp}.jpg`; await put(proofPath, proofBlob); }
      await rest('/rest/v1/rounds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ car_path: carPath, proof_path: proofPath, note: note || null, status: 'pending' })
      });
      return { remote: true };
    } catch (e) {
      console.warn('[submit] falló el envío remoto, guardo local:', e.message);
    }
  }
  await idbPut({ car: carBlob, proof: proofBlob || null, note: note || '', truth: null,
                 status: 'pending', created_at: new Date().toISOString() });
  return { remote: false };
}

async function put(path, blob) {
  const r = await fetch(`${SB_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST', headers: headers({ 'Content-Type': 'image/jpeg', 'x-upsert': 'true' }), body: blob
  });
  if (!r.ok) throw new Error('storage ' + r.status + ' ' + (await r.text()).slice(0, 200));
}

/** Suma un voto al consenso (solo rondas remotas: las semillas no se cuentan). */
async function castVote(id, choice) {
  if (!sbConfigured() || typeof id !== 'number') return;
  try {
    await rest('/rest/v1/rpc/cast_vote', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rid: id, choice })
    });
  } catch (e) { console.warn('[vote]', e.message); }
}

/* ---------- admin ---------- */

async function adminList(status) {
  const out = [];
  if (sbConfigured() && getToken()) {
    try {
      const rows = await rest(`/rest/v1/rounds?status=eq.${status}&select=*&order=created_at.desc`, {}, true);
      rows.forEach(r => out.push({
        id: r.id, car: publicUrl(r.car_path), proof: r.proof_path ? publicUrl(r.proof_path) : null,
        truth: r.truth, note: r.note || '', created_at: r.created_at, local: false
      }));
    } catch (e) { console.warn('[admin] remoto:', e.message); }
  }
  try {
    (await idbAll()).filter(r => r.status === status).forEach(r => out.push(localRound(r)));
  } catch {}
  return out;
}

async function adminSet(id, status, truth) {
  if (typeof id === 'string' && id.startsWith('L')) {
    const raw = Number(id.slice(1));
    const all = await idbAll();
    const rec = all.find(r => r.id === raw);
    if (rec) { rec.status = status; rec.truth = truth ?? null; await idbPut(rec); }
    return;
  }
  await rest(`/rest/v1/rounds?id=eq.${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ status, truth: truth ?? null })
  }, true);
}

async function adminDelete(id) {
  if (typeof id === 'string' && id.startsWith('L')) return idbDel(Number(id.slice(1)));
  await rest(`/rest/v1/rounds?id=eq.${id}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }, true);
}

/* ---------- auth (magic link) ---------- */

async function sendMagicLink(email) {
  const r = await fetch(`${SB_URL}/auth/v1/otp`, {
    method: 'POST', headers: { apikey: SB_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, create_user: true,
      options: { email_redirect_to: location.href.split('#')[0] } })
  });
  if (!r.ok) throw new Error((await r.text()).slice(0, 200));
}

/** Supabase vuelve del magic link con el token en el fragmento. Lo guardo y limpio la URL. */
function captureToken() {
  const h = new URLSearchParams(location.hash.slice(1));
  const t = h.get('access_token');
  if (t) { setToken(t); history.replaceState(null, '', location.pathname); return true; }
  return false;
}

async function whoami() {
  if (!getToken()) return null;
  try { return await rest('/auth/v1/user', {}, true); }
  catch { setToken(''); return null; }
}

/* ---------- helpers de imagen ---------- */

function loadImage(file) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error('no pude leer esa imagen'));
    img.src = URL.createObjectURL(file);
  });
}

/** Dibuja la imagen en un canvas con el lado mayor limitado a `max`. */
function fitCanvas(img, max = 1400) {
  const s = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c;
}

/** Pixelado DESTRUCTIVO de una región. Nada de ctx.filter: eso solo desenfoca y
    es parcialmente reversible; esto tira la información a la basura de verdad.

    El lado del bloque tiene un PISO ABSOLUTO, no proporcional a la región. Si el
    bloque fuera una fracción del recuadro, tapar el auto entero daría bloques
    finos y una patente adentro seguiría siendo legible — al revés de lo que
    espera cualquiera que arrastre un recuadro grande "para ir a lo seguro". */
function pixelate(canvas, x, y, w, h) {
  x = Math.max(0, Math.round(x)); y = Math.max(0, Math.round(y));
  w = Math.min(canvas.width - x, Math.round(w)); h = Math.min(canvas.height - y, Math.round(h));
  if (w < 2 || h < 2) return;
  const ctx = canvas.getContext('2d');
  const block = Math.max(16,
    Math.round(Math.min(w, h) / 6),
    Math.round(Math.max(canvas.width, canvas.height) / 40));
  const bw = Math.max(2, Math.ceil(w / block)), bh = Math.max(2, Math.ceil(h / block));
  const tmp = document.createElement('canvas');
  tmp.width = bw; tmp.height = bh;
  const tctx = tmp.getContext('2d');
  tctx.imageSmoothingEnabled = true;
  tctx.drawImage(canvas, x, y, w, h, 0, 0, bw, bh);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tmp, 0, 0, bw, bh, x, y, w, h);
  // segunda pasada: ruido tenue para matar cualquier intento de deconvolución
  ctx.globalAlpha = .09;
  for (let i = 0; i < 26; i++) {
    ctx.fillStyle = i % 2 ? '#fff' : '#000';
    ctx.fillRect(x + Math.random() * w, y + Math.random() * h, w / 9, h / 9);
  }
  ctx.restore();
}

const toJpeg = (canvas, q = .82) =>
  new Promise(res => canvas.toBlob(res, 'image/jpeg', q));
