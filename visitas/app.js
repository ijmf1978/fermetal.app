/* Gestor de Visitas v2 — app.js
 * Cada persona entra con su usuario y clave (validados en el servidor de
 * desarrolloapps.ve@gmail.com). Las visitas se guardan primero en el teléfono
 * y se envían a la base compartida en cuanto hay internet.
 */
'use strict';

/* ---------- utilidades ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const num = v => { if (v === '' || v == null) return null; const n = Number(String(v).replace(',', '.')); return isFinite(n) ? n : null; };
const pad = n => String(n).padStart(2, '0');
const ymd = d => { d = new Date(d); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
const hoy = () => ymd(new Date());
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const fFecha = d => d ? new Date(d).toLocaleString('es-VE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const fHora = d => new Date(d).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
const diasDesde = d => Math.floor((Date.now() - new Date(d).getTime()) / 864e5);
function distanciaM(a, b) {
  if (!a || !b || a.lat == null || b.lat == null) return null;
  const R = 6371e3, r = x => x * Math.PI / 180;
  const dLat = r(b.lat - a.lat), dLng = r(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}
const fDist = m => m == null ? '' : m < 1000 ? m + ' m' : (m / 1000).toFixed(1) + ' km';
function toast(msg, ms = 2800) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => t.hidden = true, ms); }
const ICON = {
  pin: '<svg viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
  cam: '<svg viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  user: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/></svg>',
  cloudOff: '<svg viewBox="0 0 24 24"><path d="M3 3l18 18M8 7.4A6 6 0 0 1 17.7 10 4 4 0 0 1 19 17.6M16 18H7a5 5 0 0 1-1.2-9.8"/></svg>',
  x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  down: '<svg viewBox="0 0 24 24"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
  up: '<svg viewBox="0 0 24 24"><path d="M12 20V9M7 14l5-5 5 5M5 4h14"/></svg>',
  nav: '<svg viewBox="0 0 24 24"><path d="M3 11l18-8-8 18-2-8z"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><path d="M12 6.5v6M9 9.5h6"/></svg>',
  search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
  home: '<svg viewBox="0 0 24 24"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></svg>',
  list: '<svg viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
  users: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c2 .7 3.2 2.4 3.6 5.2"/></svg>',
  map: '<svg viewBox="0 0 24 24"><path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/></svg>',
  chart: '<svg viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  gear: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg>'
};

const TIPOS = [{ k: 'Venta', c: 'venta' }, { k: 'Cobranza', c: 'cobranza' }, { k: 'Visita', c: 'visita' }];
const claseTipo = t => (TIPOS.find(x => x.k === t) || { c: 'visita' }).c;

/* ---------- base local (IndexedDB) ---------- */
const DB = {
  db: null,
  open() {
    return new Promise((res, rej) => {
      const r = indexedDB.open('gestor-visitas', 1);
      r.onupgradeneeded = () => {
        const d = r.result;
        ['clientes', 'visitas', 'vendedores'].forEach(s => { if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { keyPath: 'id' }); });
        if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv', { keyPath: 'k' });
      };
      r.onsuccess = () => { this.db = r.result; res(); };
      r.onerror = () => rej(r.error);
    });
  },
  tx(store, mode, fn) {
    return new Promise((res, rej) => {
      const t = this.db.transaction(store, mode), s = t.objectStore(store); let out;
      const rq = fn(s); if (rq) rq.onsuccess = () => out = rq.result;
      t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
    });
  },
  all(s) { return this.tx(s, 'readonly', st => st.getAll()); },
  get(s, k) { return this.tx(s, 'readonly', st => st.get(k)); },
  put(s, o) { return this.tx(s, 'readwrite', st => st.put(o)); },
  putMany(s, arr) { return this.tx(s, 'readwrite', st => { arr.forEach(o => st.put(o)); }); },
  del(s, id) { return this.tx(s, 'readwrite', st => st.delete(id)); },
  clear(s) { return this.tx(s, 'readwrite', st => st.clear()); }
};

/* ---------- estado ---------- */
const G = window.GV_CONFIG || {};
const S = {
  sess: null,                 // { token, user:{id,nombre,rol,usuario} }
  clientes: [], visitas: [], vendedores: [], view: 'inicio', lastSync: 0,
  f: { desde: ymd(addDays(new Date(), -6)), hasta: hoy(), vendedor: '', tipo: '', q: '' },
  fc: { q: '', zona: '', vendedor: '' },
  st: { rango: 30, vendedor: '' },
  mapa: { rango: 'hoy', clientes: false }
};
const API = () => (G.API_URL || '').trim();
const yo = () => S.sess?.user || {};
const esAdmin = () => yo().rol === 'admin';
const vendedor = id => S.vendedores.find(v => v.id === id);
const vNombre = id => vendedor(id)?.nombre || (id === yo().id ? yo().nombre : (id ? '—' : 'Sin asignar'));
const cliente = id => S.clientes.find(c => c.id === id);
const misVisitas = () => esAdmin() ? S.visitas : S.visitas.filter(v => v.vendedorId === yo().id);
const ultimaVisita = cid => { let u = null; for (const v of S.visitas) if (v.clienteId === cid && (!u || v.fecha > u.fecha)) u = v; return u; };
const pendientes = () => S.visitas.filter(v => !v.synced && v.vendedorId === yo().id).length + S.clientes.filter(c => c.dirty).length;
async function kv(k, v) { if (v === undefined) return (await DB.get('kv', k))?.v; await DB.put('kv', { k, v }); }

/* ---------- arranque ---------- */
async function init() {
  await DB.open();
  S.sess = await kv('sesion') || null;
  S.lastSync = await kv('lastSync') || 0;
  document.addEventListener('click', onClick);
  document.addEventListener('input', onInput);
  document.addEventListener('change', onChange);
  document.addEventListener('submit', e => { e.preventDefault(); if (e.target.id === 'formLogin') entrar(); });
  $('#modal').addEventListener('click', e => { if (e.target.id === 'modal' && !FV) cerrarModal(); });
  $('#lightbox').addEventListener('click', () => $('#lightbox').hidden = true);
  window.addEventListener('online', () => { estadoRed(); sincronizar(true); });
  window.addEventListener('offline', estadoRed);
  window.addEventListener('hashchange', () => S.sess && ir(location.hash.slice(1) || 'inicio', false));
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => { });
  estadoRed();
  if (!S.sess) return pantallaLogin();
  await cargarLocal();
  arrancarSesion();
}
async function cargarLocal() {
  [S.clientes, S.visitas, S.vendedores] = await Promise.all(['clientes', 'visitas', 'vendedores'].map(s => DB.all(s)));
  indexar();
}
function indexar() { S.clientes.forEach(c => c._q = norm([c.nombre, c.rif, c.codigo, c.zona].join(' '))); }
function arrancarSesion() {
  $('#top').hidden = false; $('#tabs').hidden = false; $('#view').className = '';
  pintarTabs();
  ir(location.hash.slice(1) || 'inicio', false);
  if (navigator.onLine) sincronizar(true);
  clearInterval(arrancarSesion._t);
  arrancarSesion._t = setInterval(() => { if (navigator.onLine && pendientes()) sincronizar(true); }, 120000);
}
function estadoRed() { $('#netDot').classList.toggle('off', !navigator.onLine); $('#netDot').title = navigator.onLine ? 'En línea' : 'Sin conexión: las visitas se guardan y se envían al volver la señal'; }
function cabecera() {
  $('#hdrEmpresa').textContent = G.EMPRESA || 'Gestor de Visitas';
  $('#hdrPerfil').textContent = yo().nombre + (esAdmin() ? ' · Administrador' : '');
  const p = pendientes(); $('#pendBadge').hidden = !p; $('#btnSync').title = p ? `${p} pendiente(s) por enviar` : 'Sincronizar';
}

/* ---------- inicio de sesión ---------- */
function pantallaLogin(msg = '') {
  $('#top').hidden = true; $('#tabs').hidden = true;
  const v = $('#view'); v.className = 'login';
  v.innerHTML = `<form class="login-box card" id="formLogin" autocomplete="on">
    <div class="logo"><img src="icon.svg" alt=""><h1>Gestor de Visitas</h1><small>${esc(G.EMPRESA || '')}</small></div>
    <label class="f">Usuario<input name="usuario" autocomplete="username" autocapitalize="none" spellcheck="false" required></label>
    <label class="f">Clave<input name="clave" type="password" autocomplete="current-password" required></label>
    <div class="err" id="loginErr">${esc(msg)}</div>
    <button class="btn pri block" id="btnLogin" type="submit">Entrar</button>
    <small class="muted" style="text-align:center">Tu usuario y clave te los da el administrador.</small>
  </form>`;
  setTimeout(() => $('[name=usuario]')?.focus(), 50);
}
async function entrar() {
  const f = $('#formLogin'), b = $('#btnLogin'), err = $('#loginErr');
  if (!API()) { err.textContent = 'Falta configurar el servidor (config.js).'; return; }
  if (!navigator.onLine) { err.textContent = 'Necesitas internet para entrar la primera vez.'; return; }
  b.disabled = true; b.textContent = 'Entrando…'; err.textContent = '';
  try {
    const j = await api({ action: 'login', usuario: f.usuario.value.trim().toLowerCase(), clave: f.clave.value }, true);
    const anterior = await kv('ultimoUsuario');
    if (anterior && anterior !== j.usuario.id) { // otro usuario en este teléfono: limpia datos ajenos ya enviados
      const pend = (await DB.all('visitas')).filter(v => !v.synced);
      await DB.clear('visitas'); await DB.clear('clientes'); await DB.clear('vendedores');
      if (pend.length) await DB.putMany('visitas', pend);
    }
    S.sess = { token: j.token, user: j.usuario };
    await kv('sesion', S.sess); await kv('ultimoUsuario', j.usuario.id);
    await cargarLocal();
    location.hash = 'inicio';
    arrancarSesion();
  } catch (e) { err.textContent = e.message; }
  finally { if (b.isConnected) { b.disabled = false; b.textContent = 'Entrar'; } }
}
async function salir() {
  if (pendientes()) {
    if (navigator.onLine) await sincronizar(true);
    if (pendientes() && !confirm(`Tienes ${pendientes()} visita(s) sin enviar. Se guardan en este teléfono y se enviarán cuando vuelvas a entrar. ¿Cerrar sesión?`)) return;
  }
  S.sess = null; await kv('sesion', null); cerrarModal(); location.hash = ''; pantallaLogin();
}

/* ---------- servidor ---------- */
async function api(body, sinToken) {
  let r;
  try { r = await fetch(API(), { method: 'POST', body: JSON.stringify(sinToken ? body : { ...body, token: S.sess?.token }) }); }
  catch (e) { throw new Error('Sin conexión con el servidor'); }
  let j; try { j = await r.json(); } catch (e) { throw new Error('El servidor no respondió correctamente (' + r.status + ')'); }
  if (!j.ok) {
    if (/^SESION/.test(j.error || '')) { S.sess = null; await kv('sesion', null); cerrarModal(); pantallaLogin(j.error.replace(/^SESION:\s*/, '')); throw new Error('Sesión cerrada'); }
    throw new Error(j.error || 'Error del servidor');
  }
  return j;
}
let sincronizando = false;
async function sincronizar(silencioso) {
  if (sincronizando || !S.sess) return;
  if (!navigator.onLine) { if (!silencioso) toast('Sin conexión: se enviará al volver internet'); return; }
  sincronizando = true; $('#btnSync').classList.add('spin');
  try {
    const dc = S.clientes.filter(c => c.dirty);
    for (let i = 0; i < dc.length; i += 400) await api({ action: 'pushClientes', clientes: dc.slice(i, i + 400).map(({ dirty, _q, ...c }) => c) });
    dc.forEach(c => delete c.dirty); if (dc.length) await DB.putMany('clientes', dc.map(({ _q, ...c }) => c));
    const pend = S.visitas.filter(v => !v.synced && v.vendedorId === yo().id || (!v.synced && esAdmin()));
    for (let i = 0; i < pend.length; i += 3) {
      const lote = pend.slice(i, i + 3);
      const res = await api({ action: 'pushVisitas', visitas: lote.map(v => ({ ...v, vendedor: vNombre(v.vendedorId) })) });
      for (const v of lote) { v.synced = true; if (res.fotos?.[v.id]?.length) v.fotoUrls = res.fotos[v.id]; await DB.put('visitas', v); }
    }
    const j = await api({ action: 'pull' });
    S.sess.user = { ...S.sess.user, ...j.yo }; await kv('sesion', S.sess);
    S.vendedores = j.vendedores || []; await DB.clear('vendedores'); await DB.putMany('vendedores', S.vendedores);
    S.clientes = (j.clientes || []).map(c => ({ ...c, lat: num(c.lat), lng: num(c.lng), prospecto: String(c.prospecto) === 'true' }));
    await DB.clear('clientes'); await DB.putMany('clientes', S.clientes); indexar();
    const locales = new Map(S.visitas.map(v => [v.id, v]));
    const remotas = (j.visitas || []).map(r => ({ ...r, lat: num(r.lat), lng: num(r.lng), precision: num(r.precision), sinGps: String(r.sinGps) === 'true', fotoUrls: Array.isArray(r.fotoUrls) ? r.fotoUrls : [], fotos: locales.get(r.id)?.fotos || [], synced: true }));
    const ids = new Set(remotas.map(v => v.id));
    const sinEnviar = S.visitas.filter(v => !v.synced && !ids.has(v.id));
    S.visitas = [...remotas, ...sinEnviar];
    await DB.clear('visitas'); await DB.putMany('visitas', S.visitas);
    S.lastSync = Date.now(); await kv('lastSync', S.lastSync);
    if (!silencioso) toast('Sincronizado ✓');
    if ($('#modal').hidden) render(); else cabecera();
  } catch (e) {
    console.error(e); if (!silencioso && e.message !== 'Sesión cerrada') toast('No se pudo sincronizar: ' + e.message, 4500);
  } finally { sincronizando = false; $('#btnSync').classList.remove('spin'); if (S.sess) cabecera(); }
}

/* ---------- navegación ---------- */
const TABS_VEND = [['inicio', 'Inicio', 'home'], ['historial', 'Mis visitas', 'list'], ['cuenta', 'Mi cuenta', 'user']];
const TABS_ADMIN = [['inicio', 'Inicio', 'home'], ['historial', 'Visitas', 'list'], ['clientes', 'Clientes', 'users'], ['mapa', 'Mapa', 'map'], ['stats', 'Estadísticas', 'chart'], ['cuenta', 'Ajustes', 'gear']];
const tabs = () => esAdmin() ? TABS_ADMIN : TABS_VEND;
function pintarTabs() {
  const t = tabs(), n = $('#tabs'); n.style.setProperty('--n', t.length);
  n.innerHTML = t.map(([k, txt, ic]) => `<button data-go="${k}">${ICON[ic]}<span>${txt}</span></button>`).join('');
}
const VISTAS = { inicio: vInicio, historial: vHistorial, clientes: vClientes, mapa: vMapa, stats: vStats, cuenta: vCuenta };
let mapObj = null, charts = [];
function ir(v, push = true) {
  if (!tabs().some(t => t[0] === v)) v = 'inicio';
  S.view = v;
  if (push && location.hash !== '#' + v) history.pushState(null, '', '#' + v);
  render(); window.scrollTo(0, 0);
}
function render() {
  if (!S.sess) return;
  pintarTabs(); $$('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.go === S.view));
  charts.forEach(c => c.destroy()); charts = [];
  if (mapObj) { mapObj.remove(); mapObj = null; }
  $('#view').innerHTML = VISTAS[S.view]();
  cabecera();
  if (S.view === 'mapa') initMapa();
  if (S.view === 'stats') initCharts();
}

/* ---------- componentes ---------- */
const vacio = t => `<div class="empty">${t}</div>`;
const opts = (arr, sel, blank) => (blank != null ? `<option value="">${esc(blank)}</option>` : '') + arr.map(o => { const [v, t] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}" ${String(v) === String(sel) ? 'selected' : ''}>${esc(t)}</option>`; }).join('');
const vendedoresOpts = (sel, blank = 'Todos los vendedores') => opts(S.vendedores.filter(v => v.activo !== false).sort((a, b) => a.nombre.localeCompare(b.nombre)).map(v => [v.id, v.nombre]), sel, blank);
function itemVisita(v) {
  const c = cliente(v.clienteId), n = (v.fotoUrls?.length || v.fotos?.length || 0);
  return `<button class="item" data-act="verVisita" data-id="${v.id}">
    <span class="ic ${claseTipo(v.tipo)}">${esc((v.tipo || '?').slice(0, 2).toUpperCase())}</span>
    <span class="grow"><b>${esc(c?.nombre || v.clienteNombre || 'Cliente')}</b>
      <span class="meta"><span>${ICON.clock} ${fFecha(v.fecha)}</span>${esAdmin() ? `<span>${ICON.user} ${esc(vNombre(v.vendedorId))}</span>` : ''}
      ${v.lat != null ? `<span>${ICON.pin} ±${v.precision ?? '?'} m</span>` : '<span class="badge warn">Sin GPS</span>'}
      ${n ? `<span>${ICON.cam} ${n}</span>` : ''}${v.synced ? '' : `<span title="Pendiente por enviar">${ICON.cloudOff}</span>`}</span></span>
    <span class="r"><span class="badge ${claseTipo(v.tipo)}">${esc(v.tipo)}</span></span></button>`;
}

/* ---------- inicio ---------- */
function vInicio() {
  const vis = misVisitas(), h = hoy();
  const vHoy = vis.filter(v => ymd(v.fecha) === h).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const meta = Number(G.META_DIARIA) || 0;
  let equipo = '';
  if (esAdmin()) {
    const filas = S.vendedores.filter(v => v.activo !== false).map(vd => ({ n: vd.nombre, t: vHoy.filter(v => v.vendedorId === vd.id).length, u: vHoy.find(v => v.vendedorId === vd.id) })).sort((a, b) => b.t - a.t);
    equipo = `<div class="sec-h"><h3>Equipo hoy</h3></div><div class="card"><table class="t"><thead><tr><th>Vendedor</th><th class="n">Visitas</th><th class="n">Última</th></tr></thead>
      <tbody>${filas.map(f => `<tr><td>${esc(f.n)}</td><td class="n">${f.t}${meta ? ` / ${meta}` : ''}</td><td class="n">${f.u ? fHora(f.u.fecha) : '—'}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">Sin vendedores</td></tr>'}</tbody></table></div>`;
  }
  return `
  <button class="start" data-act="nueva">${ICON.play}Iniciar visita<small>Se registran la fecha, la hora y tu ubicación</small></button>
  <div class="today"><span><small class="muted">${new Date().toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long' })}</small><br><b>${vHoy.length}</b> <span class="muted">visita(s) hoy${meta && !esAdmin() ? ` de ${meta}` : ''}</span></span>
    ${pendientes() ? `<span class="badge warn">${pendientes()} por enviar</span>` : ''}</div>
  ${meta && !esAdmin() ? `<div class="bar" style="margin-bottom:14px"><i style="width:${Math.min(100, vHoy.length / meta * 100)}%"></i></div>` : ''}
  <div class="list">${vHoy.map(itemVisita).join('') || vacio('Aún no hay visitas hoy.')}</div>
  ${equipo}`;
}

/* ---------- formulario de visita ---------- */
const GPS = {
  watch: null, best: null, timer: null,
  start(cb) {
    this.stop(); this.best = null;
    if (!('geolocation' in navigator)) return cb({ err: 'Este dispositivo no permite obtener la ubicación.' });
    if (!window.isSecureContext) return cb({ err: 'El GPS requiere abrir la app por https.' });
    this.watch = navigator.geolocation.watchPosition(p => {
      const c = { lat: p.coords.latitude, lng: p.coords.longitude, acc: Math.round(p.coords.accuracy) };
      if (!this.best || c.acc <= this.best.acc) this.best = c;
      cb({ pos: this.best });
      if (this.best.acc <= 15) this.stop();
    }, e => cb({ err: ({ 1: 'Permiso de ubicación denegado. Actívalo en el navegador y toca Reintentar.', 2: 'No se pudo obtener la señal GPS.', 3: 'El GPS tardó demasiado.' })[e.code] || e.message }),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 });
    this.timer = setTimeout(() => this.stop(), 90000);
  },
  stop() { if (this.watch != null) navigator.geolocation.clearWatch(this.watch); this.watch = null; clearTimeout(this.timer); }
};
let FV = null;
function abrirFormVisita(clienteId) {
  FV = { id: uid(), inicio: new Date().toISOString(), clienteId: clienteId || '', tipo: '', fotos: [], gps: null, nuevo: false };
  abrirModal(`<div class="sheet-h"><h2>Nueva visita</h2><button class="icon-btn" data-act="cancelarVisita" aria-label="Cerrar">${ICON.x}</button></div>
  <div class="sheet-b" id="formVisita">
    <div><span class="lbl">1. Cliente</span><div id="cliBox"></div></div>
    <div class="grid2">
      <div><span class="lbl">Fecha y hora</span><div class="fixed">${ICON.clock}<span><span class="v">${new Date(FV.inicio).toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span><small>${fHora(FV.inicio)}</small></span></div></div>
      <div><span class="lbl">Ubicación GPS</span><div class="fixed gps busy" id="gpsBox" style="padding:11px 12px"><span class="dot"></span><span id="gpsTxt" class="v">Buscando…</span></div></div>
    </div>
    <div><span class="lbl">2. Tipo de visita</span><div class="tipos">${TIPOS.map(t => `<button type="button" data-act="tipo" data-k="${t.k}">${t.k}</button>`).join('')}</div></div>
    <label class="f"><span class="lbl" style="margin:0">3. Observaciones</span><textarea id="obs" placeholder="¿Qué se habló? Acuerdos, pedidos, pagos, próximos pasos…"></textarea></label>
    <div><span class="lbl">Foto (opcional)</span><div class="photos" id="fotosBox"></div></div>
  </div>
  <div class="sheet-f"><button class="btn" data-act="cancelarVisita">Cancelar</button><button class="btn pri" data-act="guardarVisita">Guardar visita</button></div>`);
  pintarCliente(); pintarFotos(); iniciarGPS();
}
function pintarCliente() {
  const box = $('#cliBox'); if (!box) return;
  const c = cliente(FV.clienteId);
  if (c) {
    const u = ultimaVisita(c.id), d = FV.gps ? distanciaM(FV.gps, c) : null;
    box.innerHTML = `<div class="sel"><span class="grow"><b>${esc(c.nombre)}</b><small>${esc([c.rif, c.zona].filter(Boolean).join(' · '))}</small>
      <small>${u ? 'Última visita: ' + fFecha(u.fecha) : 'Primera visita'}${d != null ? ' · a ' + fDist(d) : ''}</small></span>
      <button class="btn sm" data-act="cambiarCliente">Cambiar</button></div>`;
  } else if (FV.nuevo) {
    box.innerHTML = `<div class="card stack" style="padding:12px"><label class="f">Nombre o razón social<input id="nNombre" autocomplete="off"></label>
      <div class="grid2"><label class="f">RIF / C.I.<input id="nRif"></label><label class="f">Teléfono<input id="nTel" inputmode="tel"></label></div>
      <button class="linkbtn" data-act="buscarCliente" style="justify-self:start">← Buscar en la lista de clientes</button></div>`;
    setTimeout(() => $('#nNombre')?.focus(), 30);
  } else {
    box.innerHTML = `<div style="position:relative"><input id="cliQ" type="search" placeholder="Escribe el nombre o RIF del cliente…" autocomplete="off"></div>
      <div class="results" id="cliRes"></div>`;
    setTimeout(() => $('#cliQ')?.focus(), 30);
    buscarClientes('');
  }
}
function buscarClientes(q) {
  const res = $('#cliRes'); if (!res) return;
  const n = norm(q);
  if (n.length < 2) { res.innerHTML = `<small class="muted">Escribe al menos 2 letras. ${S.clientes.length} clientes disponibles.</small>`; return; }
  const partes = n.split(/\s+/);
  const l = S.clientes.filter(c => partes.every(p => c._q.includes(p))).slice(0, 12);
  res.innerHTML = l.map(c => `<button data-act="elegirCliente" data-id="${c.id}"><b>${esc(c.nombre)}</b><small>${esc([c.rif, c.zona, c.direccion].filter(Boolean).join(' · '))}</small></button>`).join('')
    + `<button data-act="clienteNuevo" style="border-style:dashed"><b>+ Cliente nuevo</b><small>No está en la lista</small></button>`;
}
function iniciarGPS() {
  const box = $('#gpsBox'), txt = $('#gpsTxt'); if (!box) return;
  box.className = 'fixed gps busy'; txt.textContent = 'Buscando…';
  GPS.start(({ pos, err }) => {
    if (!FV || !$('#gpsBox')) { GPS.stop(); return; }
    if (err) { FV.gpsErr = err; if (!FV.gps) { box.className = 'fixed gps bad'; txt.innerHTML = `Sin señal <button class="linkbtn" data-act="regps">Reintentar</button>`; toast(err, 4500); } return; }
    FV.gps = pos;
    box.className = 'fixed gps ' + (pos.acc <= 50 ? 'ok' : 'warn');
    txt.innerHTML = `±${pos.acc} m<small>${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}</small>`;
    if (cliente(FV.clienteId)) pintarCliente();
  });
}
function pintarFotos() {
  const b = $('#fotosBox'); if (!b) return;
  b.innerHTML = FV.fotos.map((src, i) => `<div class="photo"><img src="${src}" data-act="zoom" alt="Foto ${i + 1}"><button type="button" data-act="quitarFoto" data-i="${i}" aria-label="Quitar">×</button></div>`).join('')
    + (FV.fotos.length < 3 ? `<label class="add-photo">${ICON.cam}<span>Tomar foto</span><input type="file" accept="image/*" capture="environment" data-act="foto"></label>` : '');
}
function cargarImagen(file) { return new Promise((res, rej) => { const u = URL.createObjectURL(file), i = new Image(); i.onload = () => { URL.revokeObjectURL(u); res(i); }; i.onerror = () => rej(new Error('Imagen no válida')); i.src = u; }); }
async function procesarFoto(file) {
  const img = await cargarImagen(file);
  const r = Math.min(1, 1280 / Math.max(img.width, img.height)), w = Math.round(img.width * r), h = Math.round(img.height * r);
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d'); ctx.drawImage(img, 0, 0, w, h);
  const c = cliente(FV.clienteId);
  const lines = [new Date().toLocaleString('es-VE'), c?.nombre || $('#nNombre')?.value || '', FV.gps ? `GPS ${FV.gps.lat.toFixed(6)}, ${FV.gps.lng.toFixed(6)} ±${FV.gps.acc}m` : 'Sin GPS', yo().nombre].filter(Boolean);
  const fs = Math.max(13, Math.round(w / 42)), lh = fs * 1.35, bh = lh * lines.length + fs * .7;
  ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, h - bh, w, bh);
  ctx.fillStyle = '#fff'; ctx.font = `600 ${fs}px system-ui,sans-serif`; ctx.textBaseline = 'top';
  lines.forEach((l, i) => ctx.fillText(l.slice(0, 80), fs * .6, h - bh + fs * .35 + lh * i));
  return cv.toDataURL('image/jpeg', .72);
}
async function guardarVisita() {
  if (!FV) return;
  let c = cliente(FV.clienteId);
  if (!c && FV.nuevo) {
    const nombre = $('#nNombre').value.trim(); if (!nombre) return toast('Escribe el nombre del cliente nuevo');
    c = { id: uid(), codigo: $('#nRif').value.trim(), nombre, rif: $('#nRif').value.trim(), telefono: $('#nTel').value.trim(), email: '', direccion: '', zona: '', vendedorId: yo().id, lat: FV.gps?.lat ?? null, lng: FV.gps?.lng ?? null, notas: '', prospecto: true, actualizado: new Date().toISOString(), dirty: true };
    S.clientes.push(c); c._q = norm([c.nombre, c.rif].join(' ')); await DB.put('clientes', (({ _q, ...x }) => x)(c));
  }
  if (!c) return toast('Busca y selecciona el cliente');
  if (!FV.tipo) return toast('Elige el tipo de visita');
  if (!FV.gps && !confirm('No se obtuvo la ubicación GPS. ¿Guardar la visita sin ubicación?')) return;
  if (FV.gps && c.lat == null) { c.lat = FV.gps.lat; c.lng = FV.gps.lng; c.dirty = true; await DB.put('clientes', (({ _q, ...x }) => x)(c)); }
  GPS.stop();
  const v = {
    id: FV.id, fecha: FV.inicio, inicio: FV.inicio, fin: new Date().toISOString(), vendedorId: yo().id,
    clienteId: c.id, clienteNombre: c.nombre, clienteCodigo: c.codigo || c.rif || '', tipo: FV.tipo, resultado: '', monto: '', proxima: '',
    notas: $('#obs').value.trim(), fotos: FV.fotos, fotoUrls: [],
    lat: FV.gps?.lat ?? null, lng: FV.gps?.lng ?? null, precision: FV.gps?.acc ?? null, sinGps: !FV.gps,
    synced: false, actualizado: new Date().toISOString()
  };
  S.visitas.push(v); await DB.put('visitas', v);
  FV = null; cerrarModal(); ir('inicio');
  toast(v.sinGps ? 'Visita guardada (sin GPS)' : 'Visita guardada ✓');
  if (navigator.onLine) sincronizar(true);
}

/* ---------- detalle de visita ---------- */
function driveThumb(u) { const m = String(u).match(/[-\w]{25,}/); return m ? `https://drive.google.com/thumbnail?id=${m[0]}&sz=w600` : u; }
function verVisita(id) {
  const v = S.visitas.find(x => x.id === id); if (!v) return;
  const c = cliente(v.clienteId), dist = c ? distanciaM(v, c) : null;
  const fotos = (v.fotos?.length ? v.fotos.map((s, i) => `<div class="photo"><img src="${s}" data-act="zoom" alt="Foto ${i + 1}"></div>`)
    : (v.fotoUrls || []).map((u, i) => `<div class="photo"><a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(driveThumb(u))}" alt="Foto ${i + 1}" loading="lazy"></a></div>`)).join('');
  abrirModal(`<div class="sheet-h"><h2>${esc(c?.nombre || v.clienteNombre)}</h2><button class="icon-btn" data-act="cerrar" aria-label="Cerrar">${ICON.x}</button></div>
  <div class="sheet-b">
    <div class="row wrap"><span class="badge ${claseTipo(v.tipo)}">${esc(v.tipo)}</span>${v.synced ? '<span class="badge ok">Enviada</span>' : '<span class="badge warn">Pendiente por enviar</span>'}</div>
    <dl class="dl card">
      <dt>Fecha y hora</dt><dd>${fFecha(v.fecha)}</dd>
      <dt>Vendedor</dt><dd>${esc(vNombre(v.vendedorId))}</dd>
      <dt>Cliente</dt><dd>${esc(c?.rif ? c.rif + ' · ' : '')}${esc(c?.nombre || v.clienteNombre)}</dd>
      <dt>Ubicación</dt><dd>${v.lat != null ? `±${v.precision ?? '?'} m · <a href="https://www.google.com/maps?q=${v.lat},${v.lng}" target="_blank" rel="noopener">Ver en mapa</a>${dist != null && c?.lat != null ? `<br>a ${fDist(dist)} del cliente ${dist > 300 ? '<span class="badge warn">lejos</span>' : '<span class="badge ok">en sitio</span>'}` : ''}` : '<span class="badge warn">Sin GPS</span>'}</dd>
      <dt>Observaciones</dt><dd>${v.notas ? esc(v.notas).replace(/\n/g, '<br>') : '<span class="muted">—</span>'}</dd>
    </dl>
    ${fotos ? `<div class="photos">${fotos}</div>` : ''}
  </div>
  ${esAdmin() ? `<div class="sheet-f"><button class="btn danger" data-act="borrarVisita" data-id="${v.id}">Eliminar visita</button></div>` : ''}`);
}

/* ---------- historial ---------- */
function filtrarVisitas() {
  const f = S.f, q = norm(f.q);
  return misVisitas().filter(v => {
    const d = ymd(v.fecha);
    if (f.desde && d < f.desde) return false;
    if (f.hasta && d > f.hasta) return false;
    if (f.vendedor && v.vendedorId !== f.vendedor) return false;
    if (f.tipo && v.tipo !== f.tipo) return false;
    if (q && !norm([cliente(v.clienteId)?.nombre, v.clienteNombre, v.notas, vNombre(v.vendedorId)].join(' ')).includes(q)) return false;
    return true;
  }).sort((a, b) => b.fecha.localeCompare(a.fecha));
}
function vHistorial() {
  const f = S.f;
  return `<div class="sec-h"><h2>${esAdmin() ? 'Visitas' : 'Mis visitas'}</h2>${esAdmin() ? `<button class="btn sm" data-act="exportVisitas">${ICON.down} Excel</button>` : ''}</div>
  <div class="card filters">
    <input class="q" type="search" placeholder="Buscar cliente u observación…" data-f="q" value="${esc(f.q)}">
    <label class="f">Desde<input type="date" data-f="desde" value="${f.desde}"></label>
    <label class="f">Hasta<input type="date" data-f="hasta" value="${f.hasta}"></label>
    ${esAdmin() ? `<label class="f">Vendedor<select data-f="vendedor">${vendedoresOpts(f.vendedor)}</select></label>` : ''}
    <label class="f">Tipo<select data-f="tipo">${opts(TIPOS.map(t => t.k), f.tipo, 'Todos')}</select></label>
  </div>
  <div id="listaVisitas" style="margin-top:12px">${listaVisitasHTML()}</div>`;
}
function listaVisitasHTML() {
  const l = filtrarVisitas();
  const cont = TIPOS.map(t => `${t.k}: ${l.filter(v => v.tipo === t.k).length}`).join(' · ');
  return `<p class="muted" style="margin:0 0 8px;font-size:.85rem">${l.length} visita(s) · ${cont}</p>
  <div class="list">${l.slice(0, 300).map(itemVisita).join('') || vacio('No hay visitas en estas fechas.')}</div>`;
}

/* ---------- clientes (administrador) ---------- */
function filtrarClientes() {
  const q = norm(S.fc.q), partes = q ? q.split(/\s+/) : [];
  return S.clientes.filter(c => (!S.fc.zona || c.zona === S.fc.zona) && (!S.fc.vendedor || (S.fc.vendedor === '-' ? !c.vendedorId : c.vendedorId === S.fc.vendedor)) && partes.every(p => c._q.includes(p)))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}
function vClientes() {
  const zonas = [...new Set(S.clientes.map(c => c.zona).filter(Boolean))].sort();
  const l = filtrarClientes();
  return `<div class="sec-h"><h2>Clientes <small>(${S.clientes.length})</small></h2>
    <div class="row"><button class="btn sm" data-act="importar">${ICON.up} Importar</button><button class="btn sm pri" data-act="editarCliente">+ Cliente</button></div></div>
  <div class="card filters">
    <input class="q" type="search" placeholder="Buscar por nombre o RIF…" data-fc="q" value="${esc(S.fc.q)}">
    <label class="f">Zona<select data-fc="zona">${opts(zonas, S.fc.zona, 'Todas')}</select></label>
    <label class="f">Vendedor<select data-fc="vendedor">${opts([['-', 'Sin asignar'], ...S.vendedores.map(v => [v.id, v.nombre])], S.fc.vendedor, 'Todos')}</select></label>
  </div>
  <div class="card row wrap" style="margin-top:10px;gap:8px">
    <span class="grow" style="font-size:.88rem"><b>${l.length}</b> cliente(s) en el filtro. Asignar todos a:</span>
    <select id="asigVend" style="width:auto;min-width:160px">${vendedoresOpts('', 'Elige vendedor…')}<option value="-">— Sin asignar —</option></select>
    <button class="btn sm pri" data-act="asignarFiltro">Asignar</button>
  </div>
  <div id="listaClientes" class="list" style="margin-top:12px">${listaClientesHTML(l)}</div>`;
}
function listaClientesHTML(l = filtrarClientes()) {
  if (!S.clientes.length) return vacio('Aún no hay clientes. Usa <b>Importar</b> o sincroniza.');
  return l.slice(0, 200).map(c => {
    const u = ultimaVisita(c.id), d = u ? diasDesde(u.fecha) : null;
    return `<button class="item" data-act="editarCliente" data-id="${c.id}"><span class="ic ${d == null ? '' : d > 30 ? 'warn' : 'ok'}">${d == null ? '—' : d + 'd'}</span>
      <span class="grow"><b>${esc(c.nombre)}</b><span class="meta">${c.rif ? `<span>${esc(c.rif)}</span>` : ''}${c.zona ? `<span>${esc(c.zona)}</span>` : ''}<span>${ICON.user} ${esc(vNombre(c.vendedorId))}</span>${c.lat != null ? `<span>${ICON.pin}</span>` : ''}${c.prospecto ? '<span class="badge info">Nuevo</span>' : ''}</span></span></button>`;
  }).join('') + (l.length > 200 ? '<p class="muted">Mostrando 200. Usa la búsqueda para encontrar más.</p>' : '') || vacio('Sin resultados.');
}
async function asignarFiltro() {
  const vid = $('#asigVend').value; if (!vid) return toast('Elige el vendedor');
  const l = filtrarClientes(); if (!l.length) return;
  const nombre = vid === '-' ? 'sin asignar' : vNombre(vid);
  if (!confirm(`¿Asignar ${l.length} cliente(s) a ${nombre}?`)) return;
  l.forEach(c => { c.vendedorId = vid === '-' ? '' : vid; c.actualizado = new Date().toISOString(); c.dirty = true; });
  await DB.putMany('clientes', l.map(({ _q, ...c }) => c));
  render(); toast(`${l.length} cliente(s) asignados`);
  sincronizar(false);
}
function editarCliente(id) {
  const c = id ? cliente(id) : { nombre: '', rif: '', telefono: '', email: '', direccion: '', zona: '', vendedorId: '', notas: '' };
  abrirModal(`<div class="sheet-h"><h2>${id ? 'Cliente' : 'Nuevo cliente'}</h2><button class="icon-btn" data-act="cerrar" aria-label="Cerrar">${ICON.x}</button></div>
  <form class="sheet-b" id="formCliente">
    <label class="f">Nombre o razón social *<input name="nombre" required value="${esc(c.nombre)}"></label>
    <div class="grid2"><label class="f">RIF / C.I.<input name="rif" value="${esc(c.rif)}"></label><label class="f">Teléfono<input name="telefono" value="${esc(c.telefono)}"></label></div>
    <label class="f">Dirección<input name="direccion" value="${esc(c.direccion)}"></label>
    <div class="grid2"><label class="f">Zona<input name="zona" value="${esc(c.zona)}"></label><label class="f">Vendedor<select name="vendedorId">${vendedoresOpts(c.vendedorId, 'Sin asignar')}</select></label></div>
    <label class="f">Notas<textarea name="notas">${esc(c.notas)}</textarea></label>
    ${c.lat != null ? `<a href="https://www.google.com/maps?q=${c.lat},${c.lng}" target="_blank" rel="noopener">${ICON.pin} Ver ubicación registrada</a>` : '<small class="muted">La ubicación se guarda sola en la primera visita.</small>'}
  </form>
  <div class="sheet-f">${id ? `<button class="btn danger" data-act="borrarCliente" data-id="${id}">Eliminar</button>` : ''}<button class="btn pri" data-act="guardarCliente" data-id="${esc(id || '')}">Guardar</button></div>`);
}
async function guardarCliente(id) {
  const d = Object.fromEntries(new FormData($('#formCliente')));
  if (!d.nombre.trim()) return toast('El nombre es obligatorio');
  const base = id ? cliente(id) : { id: uid(), codigo: d.rif, lat: null, lng: null, email: '' };
  const c = Object.assign(base, d, { nombre: d.nombre.trim(), codigo: base.codigo || d.rif, actualizado: new Date().toISOString(), dirty: true });
  c._q = norm([c.nombre, c.rif, c.codigo, c.zona].join(' '));
  if (!id) S.clientes.push(c);
  await DB.put('clientes', (({ _q, ...x }) => x)(c)); cerrarModal(); render(); toast('Cliente guardado');
  sincronizar(true);
}

/* ---------- importación de clientes (administrador) ---------- */
const ALIAS = {
  nombre: ['nombre', 'cliente', 'razon social', 'nombre cliente', 'empresa'], rif: ['rif', 'ci', 'cedula', 'rif/ci', 'documento'],
  telefono: ['telefono', 'tlf', 'tel', 'celular', 'movil', 'whatsapp'], email: ['email', 'correo', 'e-mail'], direccion: ['direccion', 'domicilio'],
  zona: ['zona', 'ruta', 'estado', 'ciudad', 'sector'], vendedor: ['vendedor', 'asesor', 'ejecutivo'], notas: ['notas', 'observaciones']
};
let IMP = null;
function pedirArchivo() {
  if (!window.XLSX) return toast('Se necesita internet para leer Excel');
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.xlsx,.xls,.csv';
  inp.onchange = async () => {
    const file = inp.files[0]; if (!file) return;
    try {
      const buf = await file.arrayBuffer(); let wb;
      if (/\.csv$/i.test(file.name)) { let t = new TextDecoder('utf-8').decode(buf); if (t.includes('�')) t = new TextDecoder('windows-1252').decode(buf); const l0 = t.split('\n')[0]; wb = XLSX.read(t.replace(/^﻿/, ''), { type: 'string', FS: (l0.match(/;/g) || []).length > (l0.match(/,/g) || []).length ? ';' : ',', raw: true }); }
      else wb = XLSX.read(buf, { type: 'array' });
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '', raw: false });
      const hi = rows.findIndex(r => r.filter(x => String(x).trim()).length >= 2); if (hi < 0) throw new Error('Archivo vacío');
      const hs = rows[hi].map(norm), map = {};
      Object.entries(ALIAS).forEach(([k, al]) => { const i = hs.findIndex(h => al.includes(h)); if (i >= 0) map[k] = i; });
      if (map.nombre == null) throw new Error('No encontré la columna "nombre"');
      IMP = { data: rows.slice(hi + 1).filter(r => r.some(x => String(x).trim())), map };
      abrirModal(`<div class="sheet-h"><h2>Importar clientes</h2><button class="icon-btn" data-act="cerrar">${ICON.x}</button></div>
        <div class="sheet-b"><p style="margin:0">${esc(file.name)}: <b>${IMP.data.length}</b> filas. Columnas reconocidas: ${Object.keys(map).join(', ')}.</p>
        <small class="muted">Si el RIF ya existe, el cliente se actualiza. Los vendedores se asignan por nombre.</small></div>
        <div class="sheet-f"><button class="btn" data-act="cerrar">Cancelar</button><button class="btn pri" data-act="confirmarImport">Importar</button></div>`);
    } catch (e) { toast('No se pudo leer: ' + e.message, 4000); }
  };
  inp.click();
}
async function confirmarImport() {
  const { data, map } = IMP, g = (r, k) => map[k] != null ? String(r[map[k]] ?? '').trim() : '';
  const porRif = new Map(S.clientes.filter(c => c.rif).map(c => [norm(c.rif), c])), out = []; let n = 0, u = 0, sinV = 0;
  for (const r of data) {
    const nombre = g(r, 'nombre'); if (!nombre) continue;
    const rif = g(r, 'rif'); let c = rif && porRif.get(norm(rif));
    if (c) u++; else { c = { id: uid(), lat: null, lng: null, vendedorId: '' }; S.clientes.push(c); n++; if (rif) porRif.set(norm(rif), c); }
    Object.assign(c, { nombre, rif: rif || c.rif || '', codigo: rif || c.codigo || '', actualizado: new Date().toISOString(), dirty: true });
    ['telefono', 'email', 'direccion', 'zona', 'notas'].forEach(k => { const v = g(r, k); if (v) c[k] = v; else if (c[k] == null) c[k] = ''; });
    if (map.vendedor != null) { const vn = norm(g(r, 'vendedor')); const vd = S.vendedores.find(v => norm(v.nombre) === vn || norm(v.usuario) === vn); if (vd) c.vendedorId = vd.id; else if (vn) sinV++; }
    c._q = norm([c.nombre, c.rif, c.codigo, c.zona].join(' ')); out.push(c);
  }
  await DB.putMany('clientes', out.map(({ _q, ...c }) => c));
  IMP = null; cerrarModal(); render();
  toast(`${n} nuevos, ${u} actualizados${sinV ? ` · ${sinV} con vendedor no reconocido` : ''}`, 5000);
  sincronizar(false);
}

/* ---------- mapa ---------- */
function vMapa() {
  return `<div class="sec-h"><h2>Mapa</h2><div class="seg">${[['hoy', 'Hoy'], ['7', '7 días'], ['30', '30 días']].map(([k, t]) => `<button data-act="mapaRango" data-k="${k}" class="${S.mapa.rango === k ? 'on' : ''}">${t}</button>`).join('')}</div></div>
  <div class="row wrap" style="margin-bottom:10px;font-size:.84rem;gap:12px">${TIPOS.map(t => `<span><span class="badge ${t.c}">●</span> ${t.k}</span>`).join('')}
    <label class="row" style="gap:6px"><input type="checkbox" data-act="mapaCli" ${S.mapa.clientes ? 'checked' : ''} style="width:auto"> Clientes con ubicación</label></div>
  <div id="map"></div>`;
}
function initMapa() {
  if (!window.L) { $('#map').innerHTML = vacio('El mapa necesita internet.'); return; }
  mapObj = L.map('map').setView([10.48, -66.9], 7);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(mapObj);
  const css = getComputedStyle(document.documentElement), col = k => css.getPropertyValue('--' + k).trim();
  const color = { venta: col('ok'), cobranza: col('info'), visita: col('warn') };
  const desde = S.mapa.rango === 'hoy' ? hoy() : ymd(addDays(new Date(), -Number(S.mapa.rango) + 1)), pts = [];
  if (S.mapa.clientes) S.clientes.filter(c => c.lat != null).forEach(c => { pts.push([c.lat, c.lng]); L.circleMarker([c.lat, c.lng], { radius: 5, color: col('muted'), weight: 1.5, fillOpacity: .25 }).addTo(mapObj).bindPopup(`<b>${esc(c.nombre)}</b><br>${esc(c.zona || '')}`); });
  misVisitas().filter(v => v.lat != null && ymd(v.fecha) >= desde).forEach(v => {
    pts.push([v.lat, v.lng]);
    L.circleMarker([v.lat, v.lng], { radius: 9, color: '#fff', weight: 2, fillColor: color[claseTipo(v.tipo)], fillOpacity: .95 }).addTo(mapObj)
      .bindPopup(`<b>${esc(cliente(v.clienteId)?.nombre || v.clienteNombre)}</b><br>${fFecha(v.fecha)} · ${esc(v.tipo)}<br>${esc(vNombre(v.vendedorId))}`);
  });
  if (pts.length) mapObj.fitBounds(pts, { padding: [30, 30], maxZoom: 16 });
  setTimeout(() => mapObj && mapObj.invalidateSize(), 100);
}

/* ---------- estadísticas ---------- */
function datosStats() {
  const desde = ymd(addDays(new Date(), -S.st.rango + 1));
  let l = S.visitas.filter(v => ymd(v.fecha) >= desde);
  if (S.st.vendedor) l = l.filter(v => v.vendedorId === S.st.vendedor);
  return l;
}
function vStats() {
  const l = datosStats(), pct = (a, b) => b ? Math.round(a / b * 100) : 0;
  const cart = S.st.vendedor ? S.clientes.filter(c => c.vendedorId === S.st.vendedor) : S.clientes;
  const unicos = new Set(l.map(v => v.clienteId)).size, dias = new Set(l.map(v => ymd(v.fecha))).size || 1;
  const rank = S.vendedores.map(vd => { const x = l.filter(v => v.vendedorId === vd.id); return { n: vd.nombre, t: x.length, d: new Set(x.map(v => ymd(v.fecha))).size, tipos: TIPOS.map(t => x.filter(v => v.tipo === t.k).length), g: pct(x.filter(v => v.lat != null).length, x.length), c: new Set(x.map(v => v.clienteId)).size }; }).filter(r => r.t).sort((a, b) => b.t - a.t);
  return `<div class="sec-h"><h2>Estadísticas</h2><div class="seg">${[7, 30, 90].map(n => `<button data-act="stRango" data-k="${n}" class="${S.st.rango === n ? 'on' : ''}">${n} d</button>`).join('')}</div></div>
  <label class="f" style="margin-bottom:12px">Vendedor<select data-st="vendedor">${vendedoresOpts(S.st.vendedor, 'Todo el equipo')}</select></label>
  <div class="kpis">
    <div class="kpi"><small>Visitas</small><b>${l.length}</b><span class="sub">${(l.length / dias).toFixed(1)} por día trabajado</span></div>
    ${TIPOS.map(t => `<div class="kpi"><small>${t.k}</small><b>${l.filter(v => v.tipo === t.k).length}</b><span class="sub">${pct(l.filter(v => v.tipo === t.k).length, l.length)}% del total</span></div>`).join('')}
    <div class="kpi"><small>Clientes visitados</small><b>${unicos}</b><span class="sub">${pct(unicos, cart.length)}% de ${cart.length}</span></div>
    <div class="kpi"><small>Con GPS</small><b>${pct(l.filter(v => v.lat != null).length, l.length)}%</b><span class="sub">en sitio: ${pct(l.filter(v => { const c = cliente(v.clienteId); const d = distanciaM(v, c); return d != null && d <= 300; }).length, l.filter(v => cliente(v.clienteId)?.lat != null && v.lat != null).length)}%</span></div>
  </div>
  <div class="card" style="margin-top:12px"><h3>Visitas por día</h3><div class="chart-box"><canvas id="chDias"></canvas></div></div>
  <div class="card" style="margin-top:12px"><h3>Por hora del día</h3><div class="chart-box"><canvas id="chHora"></canvas></div></div>
  ${!S.st.vendedor ? `<div class="card" style="margin-top:12px"><h3 style="margin-bottom:8px">Por vendedor</h3><div class="tscroll"><table class="t">
    <thead><tr><th>Vendedor</th><th class="n">Visitas</th>${TIPOS.map(t => `<th class="n">${t.k}</th>`).join('')}<th class="n">Clientes</th><th class="n">Días</th><th class="n">GPS</th></tr></thead>
    <tbody>${rank.map(r => `<tr><td>${esc(r.n)}</td><td class="n">${r.t}</td>${r.tipos.map(x => `<td class="n">${x}</td>`).join('')}<td class="n">${r.c}</td><td class="n">${r.d}</td><td class="n">${r.g}%</td></tr>`).join('') || '<tr><td colspan="7" class="muted">Sin datos en el periodo</td></tr>'}</tbody></table></div></div>` : ''}
  <div class="row" style="margin-top:12px"><button class="btn sm" data-act="exportStats">${ICON.down} Exportar resumen</button></div>`;
}
function initCharts() {
  if (!window.Chart) return;
  const l = datosStats(), css = getComputedStyle(document.documentElement), col = k => css.getPropertyValue('--' + k).trim();
  Chart.defaults.color = col('muted'); Chart.defaults.borderColor = col('line');
  const colores = { venta: col('ok'), cobranza: col('info'), visita: col('warn') };
  const dias = []; for (let i = Math.min(S.st.rango, 60) - 1; i >= 0; i--) dias.push(ymd(addDays(new Date(), -i)));
  charts.push(new Chart($('#chDias'), {
    type: 'bar', data: { labels: dias.map(d => d.slice(8) + '/' + d.slice(5, 7)), datasets: TIPOS.map(t => ({ label: t.k, data: dias.map(d => l.filter(v => ymd(v.fecha) === d && v.tipo === t.k).length), backgroundColor: colores[t.c], borderRadius: 3, stack: 's' })) },
    options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } } } }
  }));
  const horas = Array.from({ length: 14 }, (_, i) => i + 6);
  charts.push(new Chart($('#chHora'), { type: 'bar', data: { labels: horas.map(h => h + 'h'), datasets: [{ label: 'Visitas', data: horas.map(h => l.filter(v => new Date(v.fecha).getHours() === h).length), backgroundColor: col('pri'), borderRadius: 4 }] }, options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { beginAtZero: true, ticks: { precision: 0 } } } } }));
}

/* ---------- cuenta / ajustes ---------- */
function vCuenta() {
  const usuarios = S.vendedores.slice().sort((a, b) => a.nombre.localeCompare(b.nombre));
  return `<div class="sec-h"><h2>${esAdmin() ? 'Ajustes' : 'Mi cuenta'}</h2></div><div class="stack">
  <div class="card stack"><div class="row between"><span><b>${esc(yo().nombre)}</b><br><small>Usuario: ${esc(yo().usuario || '')}${esAdmin() ? ' · Administrador' : ''}</small></span><button class="btn sm danger" data-act="salir">Cerrar sesión</button></div>
    <div class="row wrap"><button class="btn sm" data-act="cambiarClave">Cambiar mi clave</button><button class="btn sm" data-act="sync">Sincronizar ahora</button></div>
    <small class="muted">Última sincronización: ${S.lastSync ? fFecha(S.lastSync) : 'nunca'} · Pendientes: ${pendientes()}</small></div>
  ${esAdmin() ? `<div class="card stack"><div class="row between"><h3>Usuarios (${usuarios.length})</h3><button class="btn sm pri" data-act="editarUsuario">+ Usuario</button></div>
    ${sinUsuarioConCodigo().length ? `<div class="banner info row between wrap" style="gap:8px"><span><b>${sinUsuarioConCodigo().length}</b> vendedor(es) activos sin usuario.</span><button class="btn sm pri" data-act="crearUsuariosMasivo">Crear usuarios con su código</button></div>` : ''}
    <small class="muted">Cada vendedor entra con el usuario y la clave que le asignes aquí. Los administradores solo pueden crearse por otro administrador.</small>
    <div class="list">${usuarios.map(v => `<button class="item" data-act="editarUsuario" data-id="${v.id}"><span class="ic ${v.rol === 'admin' ? 'info' : ''}">${esc(v.nombre.slice(0, 2).toUpperCase())}</span>
      <span class="grow"><b>${esc(v.nombre)}</b><span class="meta"><span>${v.usuario ? 'Usuario: ' + esc(v.usuario) : '<span class="badge warn">Sin usuario: no puede entrar</span>'}</span><span>${S.clientes.filter(c => c.vendedorId === v.id).length} clientes</span></span></span>
      ${v.rol === 'admin' ? '<span class="badge info">Admin</span>' : ''}${v.activo === false ? '<span class="badge">Inactivo</span>' : ''}</button>`).join('')}</div></div>
  <div class="card stack"><h3>Exportar</h3><div class="row wrap"><button class="btn sm" data-act="exportVisitas">${ICON.down} Visitas</button><button class="btn sm" data-act="exportClientes">${ICON.down} Clientes</button></div></div>` : ''}
  <p class="muted" style="text-align:center;font-size:.8rem">Gestor de Visitas v2.1 · <a href="../">Portal de aplicaciones</a></p></div>`;
}
function editarUsuario(id) {
  const v = id ? vendedor(id) : { nombre: '', usuario: '', telefono: '', email: '', rol: 'vendedor', activo: true };
  const sugerido = v.usuario || '';
  abrirModal(`<div class="sheet-h"><h2>${id ? 'Editar usuario' : 'Nuevo usuario'}</h2><button class="icon-btn" data-act="cerrar">${ICON.x}</button></div>
  <form class="sheet-b" id="formUsuario" autocomplete="off">
    <label class="f">Nombre completo *<input name="nombre" value="${esc(v.nombre)}" required></label>
    <div class="grid2"><label class="f">Usuario *<input name="usuario" value="${esc(sugerido)}" autocapitalize="none" spellcheck="false" placeholder="ej. eveliz"></label>
    <label class="f">${id && v.usuario ? 'Nueva clave (vacío = no cambiar)' : 'Clave *'}<input name="clave" type="text" autocomplete="new-password" placeholder="mínimo 4 caracteres"></label></div>
    <div class="grid2"><label class="f">Teléfono<input name="telefono" value="${esc(v.telefono || '')}"></label><label class="f">Rol<select name="rol">${opts([['vendedor', 'Vendedor'], ['admin', 'Administrador']], v.rol || 'vendedor')}</select></label></div>
    <label class="row"><input type="checkbox" name="activo" ${v.activo !== false ? 'checked' : ''} style="width:auto"> Activo (puede entrar)</label>
    <div class="err" id="usrErr"></div>
  </form>
  <div class="sheet-f"><button class="btn pri" data-act="guardarUsuario" data-id="${esc(id || '')}">Guardar</button></div>`);
  if (!sugerido && codigoDe(v)) $('[name=usuario]').value = codigoDe(v).toLowerCase(); else if (!sugerido && v.nombre) { const p = norm(v.nombre).split(/\s+/); $('[name=usuario]').value = (p[0][0] + (p[1] || p[0])).replace(/[^a-z0-9]/g, ''); }
}
async function guardarUsuario(id, btn) {
  const f = $('#formUsuario'), err = $('#usrErr');
  const d = { id: id || '', nombre: f.nombre.value.trim(), usuario: f.usuario.value.trim().toLowerCase(), clave: f.clave.value, telefono: f.telefono.value.trim(), rol: f.rol.value, activo: f.activo.checked };
  if (!navigator.onLine) { err.textContent = 'Necesitas internet para guardar usuarios.'; return; }
  btn.disabled = true; err.textContent = '';
  try {
    const j = await api({ action: 'guardarUsuario', usuario: d });
    const i = S.vendedores.findIndex(x => x.id === j.vendedor.id); if (i >= 0) S.vendedores[i] = j.vendedor; else S.vendedores.push(j.vendedor);
    await DB.put('vendedores', j.vendedor); cerrarModal(); render();
    toast(d.clave ? `Guardado. Entrega a ${d.nombre}: usuario "${d.usuario}" y la clave que escribiste.` : 'Usuario guardado', 5000);
  } catch (e) { err.textContent = e.message; } finally { btn.disabled = false; }
}
const codigoDe = v => (String(v.nombre || '').match(/\(([A-Z]{2,4}-\d{4,5})\)\s*$/) || [])[1] || '';
const sinUsuarioConCodigo = () => S.vendedores.filter(v => v.activo !== false && !v.usuario && codigoDe(v));
function crearUsuariosMasivo() {
  const l = sinUsuarioConCodigo();
  abrirModal(`<div class="sheet-h"><h2>Crear usuarios</h2><button class="icon-btn" data-act="cerrar">${ICON.x}</button></div>
  <div class="sheet-b"><p style="margin:0">Se creará el acceso de <b>${l.length}</b> vendedor(es) activos. Su <b>usuario será su código de vendedor</b> (ej. ${esc(codigoDe(l[0]).toLowerCase())}) y todos tendrán la misma clave inicial.</p>
    <label class="f">Clave inicial para todos<input id="claveMasiva" type="text" autocomplete="off" placeholder="mínimo 4 caracteres"></label>
    <small class="muted">Pide a cada vendedor que la cambie en <b>Mi cuenta → Cambiar mi clave</b> al entrar por primera vez.</small>
    <div id="masivoProg" class="muted"></div><div class="err" id="masivoErr"></div></div>
  <div class="sheet-f"><button class="btn" data-act="cerrar">Cancelar</button><button class="btn pri" data-act="ejecutarMasivo">Crear ${l.length} usuarios</button></div>`);
}
async function ejecutarMasivo(btn) {
  const clave = $('#claveMasiva').value, prog = $('#masivoProg'), err = $('#masivoErr');
  if (clave.length < 4) { err.textContent = 'La clave debe tener al menos 4 caracteres'; return; }
  if (!navigator.onLine) { err.textContent = 'Necesitas internet'; return; }
  const l = sinUsuarioConCodigo(); btn.disabled = true; $('#claveMasiva').disabled = true; let ok = 0; const fallos = [];
  for (const v of l) {
    const usuario = codigoDe(v).toLowerCase();
    try {
      const j = await api({ action: 'guardarUsuario', usuario: { id: v.id, nombre: v.nombre, usuario, clave, telefono: v.telefono || '', rol: v.rol || 'vendedor', activo: true } });
      Object.assign(v, j.vendedor); ok++;
    } catch (e) { fallos.push(usuario + ': ' + e.message); }
    prog.textContent = `Creando… ${ok + fallos.length} de ${l.length}`;
  }
  await DB.clear('vendedores'); await DB.putMany('vendedores', S.vendedores);
  prog.textContent = `Listo: ${ok} usuarios creados.`; err.textContent = fallos.join(' · ');
  btn.textContent = 'Cerrar'; btn.disabled = false; btn.dataset.act = 'cerrarRender';
}
function cambiarClave() {
  abrirModal(`<div class="sheet-h"><h2>Cambiar mi clave</h2><button class="icon-btn" data-act="cerrar">${ICON.x}</button></div>
  <form class="sheet-b" id="formClave"><label class="f">Clave actual<input name="actual" type="password" autocomplete="current-password"></label>
  <label class="f">Nueva clave<input name="nueva" type="password" autocomplete="new-password"></label><div class="err" id="clvErr"></div></form>
  <div class="sheet-f"><button class="btn pri" data-act="guardarClave">Cambiar</button></div>`);
}

/* ---------- exportación ---------- */
function descargarXLSX(rows, nombre, hoja) {
  if (!window.XLSX) return toast('Se necesita internet para generar Excel');
  if (!rows.length) return toast('No hay datos para exportar');
  const wb = XLSX.utils.book_new(), ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = Object.keys(rows[0]).map(k => ({ wch: Math.min(45, Math.max(10, k.length + 2, ...rows.slice(0, 50).map(r => String(r[k] ?? '').length))) }));
  XLSX.utils.book_append_sheet(wb, ws, hoja); XLSX.writeFile(wb, nombre);
}
const exportVisitas = () => descargarXLSX(filtrarVisitas().slice().reverse().map(v => { const c = cliente(v.clienteId); return { Fecha: new Date(v.fecha).toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' }), Hora: fHora(v.fecha).replace(/\u00a0/g, ' '), Vendedor: vNombre(v.vendedorId), Cliente: c?.nombre || v.clienteNombre, 'Tipo de visita': v.tipo, Latitud: v.lat ?? 'Sin GPS', Longitud: v.lng ?? 'Sin GPS', 'Google Maps': v.lat != null ? `https://www.google.com/maps?q=${v.lat},${v.lng}` : '' }; }), `visitas_${S.f.desde}_a_${S.f.hasta}.xlsx`, 'Visitas');
const exportClientes = () => descargarXLSX(S.clientes.map(c => { const u = ultimaVisita(c.id); return { rif: c.rif, nombre: c.nombre, telefono: c.telefono, email: c.email, direccion: c.direccion, zona: c.zona, vendedor: c.vendedorId ? vNombre(c.vendedorId) : '', latitud: c.lat ?? '', longitud: c.lng ?? '', notas: c.notas || '', 'última visita': u ? ymd(u.fecha) : '' }; }), `clientes_${hoy()}.xlsx`, 'Clientes');
const exportStats = () => { const l = datosStats(); descargarXLSX(S.vendedores.map(vd => { const x = l.filter(v => v.vendedorId === vd.id); const o = { Vendedor: vd.nombre, Visitas: x.length }; TIPOS.forEach(t => o[t.k] = x.filter(v => v.tipo === t.k).length); o['Clientes visitados'] = new Set(x.map(v => v.clienteId)).size; o['Días con visitas'] = new Set(x.map(v => ymd(v.fecha))).size; o['Con GPS %'] = x.length ? Math.round(x.filter(v => v.lat != null).length / x.length * 100) : 0; return o; }).filter(r => r.Visitas), `resumen_${S.st.rango}d_${hoy()}.xlsx`, 'Resumen'); };

/* ---------- modal ---------- */
function abrirModal(html) { $('#modalBody').innerHTML = html; $('#modal').hidden = false; document.body.style.overflow = 'hidden'; }
function cerrarModal() { $('#modal').hidden = true; $('#modalBody').innerHTML = ''; document.body.style.overflow = ''; GPS.stop(); FV = null; }

/* ---------- eventos ---------- */
async function onClick(e) {
  const go = e.target.closest('[data-go]'); if (go) { ir(go.dataset.go); return; }
  const el = e.target.closest('[data-act]'); if (!el) return;
  const a = el.dataset.act, id = el.dataset.id;
  if (el.tagName === 'INPUT' && a !== 'mapaCli') return;
  const SOLO_ADMIN = ['importar', 'confirmarImport', 'exportVisitas', 'exportClientes', 'exportStats', 'editarCliente', 'guardarCliente', 'borrarCliente', 'asignarFiltro', 'editarUsuario', 'guardarUsuario', 'borrarVisita', 'crearUsuariosMasivo', 'ejecutarMasivo'];
  if (SOLO_ADMIN.includes(a) && !esAdmin()) return toast('Solo el administrador puede hacer esto');
  switch (a) {
    case 'nueva': abrirFormVisita(); break;
    case 'cerrar': cerrarModal(); break;
    case 'cancelarVisita': if (!FV || (!FV.clienteId && !FV.tipo && !$('#obs')?.value) || confirm('¿Descartar esta visita?')) cerrarModal(); break;
    case 'elegirCliente': FV.clienteId = id; FV.nuevo = false; pintarCliente(); break;
    case 'cambiarCliente': case 'buscarCliente': FV.clienteId = ''; FV.nuevo = false; pintarCliente(); break;
    case 'clienteNuevo': FV.nuevo = true; FV.clienteId = ''; pintarCliente(); break;
    case 'tipo': FV.tipo = el.dataset.k; $$('.tipos button').forEach(b => b.classList.toggle('on', b === el)); break;
    case 'regps': iniciarGPS(); break;
    case 'quitarFoto': FV.fotos.splice(+el.dataset.i, 1); pintarFotos(); break;
    case 'zoom': { const lb = $('#lightbox'); $('img', lb).src = el.src; lb.hidden = false; break; }
    case 'guardarVisita': el.disabled = true; try { await guardarVisita(); } finally { el.disabled = false; } break;
    case 'verVisita': verVisita(id); break;
    case 'borrarVisita': if (confirm('¿Eliminar esta visita de la base de datos?')) { try { await api({ action: 'borrar', hoja: 'Visitas', id }); S.visitas = S.visitas.filter(v => v.id !== id); await DB.del('visitas', id); cerrarModal(); render(); } catch (err) { toast(err.message); } } break;
    case 'editarCliente': editarCliente(id); break;
    case 'guardarCliente': guardarCliente(id); break;
    case 'borrarCliente': if (confirm('¿Eliminar este cliente? Sus visitas se conservan.')) { try { await api({ action: 'borrar', hoja: 'Clientes', id }); S.clientes = S.clientes.filter(c => c.id !== id); await DB.del('clientes', id); cerrarModal(); render(); } catch (err) { toast(err.message); } } break;
    case 'asignarFiltro': asignarFiltro(); break;
    case 'importar': pedirArchivo(); break;
    case 'confirmarImport': confirmarImport(); break;
    case 'mapaRango': S.mapa.rango = el.dataset.k; render(); break;
    case 'mapaCli': S.mapa.clientes = el.checked; render(); break;
    case 'stRango': S.st.rango = +el.dataset.k; render(); break;
    case 'sync': sincronizar(false); break;
    case 'salir': salir(); break;
    case 'editarUsuario': editarUsuario(id); break;
    case 'guardarUsuario': guardarUsuario(id, el); break;
    case 'cambiarClave': cambiarClave(); break;
    case 'crearUsuariosMasivo': crearUsuariosMasivo(); break;
    case 'ejecutarMasivo': ejecutarMasivo(el); break;
    case 'cerrarRender': cerrarModal(); render(); break;
    case 'guardarClave': { const f = $('#formClave'); try { await api({ action: 'cambiarClave', actual: f.actual.value, nueva: f.nueva.value }); cerrarModal(); toast('Clave cambiada ✓'); } catch (err) { $('#clvErr').textContent = err.message; } break; }
    case 'exportVisitas': exportVisitas(); break;
    case 'exportClientes': exportClientes(); break;
    case 'exportStats': exportStats(); break;
  }
}
let tDeb;
function onInput(e) {
  const t = e.target;
  if (t.id === 'cliQ') { clearTimeout(tDeb); tDeb = setTimeout(() => buscarClientes(t.value), 120); }
  if (t.dataset.f) { S.f[t.dataset.f] = t.value; clearTimeout(tDeb); tDeb = setTimeout(() => { const l = $('#listaVisitas'); if (l) l.innerHTML = listaVisitasHTML(); }, 150); }
  if (t.dataset.fc === 'q') { S.fc.q = t.value; clearTimeout(tDeb); tDeb = setTimeout(() => render(), 250); }
}
async function onChange(e) {
  const t = e.target;
  if (t.dataset.fc && t.dataset.fc !== 'q') { S.fc[t.dataset.fc] = t.value; render(); }
  if (t.dataset.st) { S.st[t.dataset.st] = t.value; render(); }
  if (t.dataset.act === 'foto' && t.files?.length && FV) {
    const f = t.files[0]; t.value = ''; toast('Procesando foto…', 1500);
    try { FV.fotos.push(await procesarFoto(f)); } catch (err) { toast(err.message); }
    pintarFotos();
  }
}

init().catch(e => { document.body.innerHTML = `<p style="padding:20px">No se pudo iniciar la app: ${esc(e.message)}</p>`; });
