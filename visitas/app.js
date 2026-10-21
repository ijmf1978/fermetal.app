/* Gestor de Visitas — app.js
 * PWA offline-first. Los datos se guardan en el dispositivo (IndexedDB) y se
 * sincronizan con la base compartida (Google Sheets + Drive de la cuenta
 * desarrolloapps.ve@gmail.com) a través de Apps Script.
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
const money = n => '$' + (Number(n) || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fFecha = d => d ? new Date(d).toLocaleString('es-VE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const fDia = d => d ? new Date(d + (String(d).length === 10 ? 'T12:00' : '')).toLocaleDateString('es-VE', { weekday: 'short', day: '2-digit', month: 'short' }) : '—';
const diasDesde = d => Math.floor((Date.now() - new Date(d).getTime()) / 864e5);
function distanciaM(a, b) {
  if (!a || !b || a.lat == null || b.lat == null) return null;
  const R = 6371e3, r = x => x * Math.PI / 180;
  const dLat = r(b.lat - a.lat), dLng = r(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}
const fDist = m => m == null ? '' : m < 1000 ? m + ' m' : (m / 1000).toFixed(1) + ' km';
function toast(msg, ms = 2600) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => t.hidden = true, ms); }
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
  wa: '<svg viewBox="0 0 24 24"><path d="M4 20l1.3-4A8 8 0 1 1 8 18.7z"/></svg>'
};

/* ---------- catálogos ---------- */
const TIPOS = ['Venta', 'Cobranza', 'Seguimiento', 'Prospección', 'Entrega', 'Postventa / reclamo'];
const RESULTADOS = [
  { k: 'pedido', t: 'Pedido tomado', ef: true, c: 'ok' },
  { k: 'cobro', t: 'Cobro realizado', ef: true, c: 'ok' },
  { k: 'cotizacion', t: 'Cotización / interesado', ef: true, c: 'info' },
  { k: 'seguimiento', t: 'Requiere seguimiento', ef: false, c: 'warn' },
  { k: 'sin_compra', t: 'Sin compra', ef: false, c: '' },
  { k: 'ausente', t: 'Ausente / cerrado', ef: false, c: 'bad' }
];
const RES = Object.fromEntries(RESULTADOS.map(r => [r.k, r]));
const resultadoDe = k => RES[k] || { k, t: k || '—', ef: false, c: '' };

/* ---------- base de datos local (IndexedDB) ---------- */
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
  put(s, o) { return this.tx(s, 'readwrite', st => st.put(o)); },
  putMany(s, arr) { return this.tx(s, 'readwrite', st => { arr.forEach(o => st.put(o)); }); },
  del(s, id) { return this.tx(s, 'readwrite', st => st.delete(id)); },
  clear(s) { return this.tx(s, 'readwrite', st => st.clear()); }
};

/* ---------- estado ---------- */
const G = window.GV_CONFIG || {};
const S = {
  clientes: [], visitas: [], vendedores: [], view: 'inicio',
  cfg: { perfil: '', admin: false, pin: '1234', apiUrl: '', clave: '', empresa: G.EMPRESA || 'Gestor de Visitas', metaDiaria: G.META_DIARIA || 6, lastSync: 0, tema: '' },
  f: { desde: ymd(addDays(new Date(), -29)), hasta: hoy(), vendedor: '', tipo: '', resultado: '', q: '' },
  fc: { q: '', zona: '', orden: 'nombre' },
  st: { rango: 30, vendedor: '' },
  mapa: { rango: 'hoy', clientes: true }
};
const apiUrl = () => (S.cfg.apiUrl || G.API_URL || '').trim();
const apiClave = () => S.cfg.clave || G.CLAVE || '';
async function setCfg(k, v) { S.cfg[k] = v; await DB.put('kv', { k, v }); }

const esAdmin = () => !!S.cfg.admin;
const vendedor = id => S.vendedores.find(v => v.id === id);
const vNombre = id => vendedor(id)?.nombre || (id ? '—' : 'Sin asignar');
const cliente = id => S.clientes.find(c => c.id === id);
const misClientes = () => (esAdmin() || !S.cfg.perfil) ? S.clientes : S.clientes.filter(c => !c.vendedorId || c.vendedorId === S.cfg.perfil);
const misVisitas = () => (esAdmin() || !S.cfg.perfil) ? S.visitas : S.visitas.filter(v => v.vendedorId === S.cfg.perfil);
const ultimaVisita = cid => { let u = null; for (const v of S.visitas) if (v.clienteId === cid && (!u || v.fecha > u.fecha)) u = v; return u; };
const pendientes = () => S.visitas.filter(v => !v.synced).length + S.clientes.filter(c => c.dirty).length;

/* ---------- arranque ---------- */
async function init() {
  await DB.open();
  [S.clientes, S.visitas, S.vendedores] = await Promise.all(['clientes', 'visitas', 'vendedores'].map(s => DB.all(s)));
  (await DB.all('kv')).forEach(x => S.cfg[x.k] = x.v);
  aplicarTema();
  document.addEventListener('click', onClick);
  document.addEventListener('input', onInput);
  document.addEventListener('change', onChange);
  $('#modal').addEventListener('click', e => { if (e.target.id === 'modal') cerrarModal(); });
  $('#lightbox').addEventListener('click', () => $('#lightbox').hidden = true);
  window.addEventListener('online', () => { estadoRed(); sincronizar(true); });
  window.addEventListener('offline', estadoRed);
  window.addEventListener('hashchange', () => ir(location.hash.slice(1) || 'inicio', false));
  estadoRed();
  ir(location.hash.slice(1) || (S.cfg.perfil || esAdmin() ? 'inicio' : 'config'), false);
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => { });
  if (apiUrl() && navigator.onLine) sincronizar(true);
  setInterval(() => { if (apiUrl() && navigator.onLine && pendientes()) sincronizar(true); }, 120000);
}
function aplicarTema() { if (S.cfg.tema) document.documentElement.dataset.theme = S.cfg.tema; else delete document.documentElement.dataset.theme; }
function estadoRed() { $('#netDot').classList.toggle('off', !navigator.onLine); $('#netDot').title = navigator.onLine ? 'En línea' : 'Sin conexión (los datos se guardan y se envían luego)'; }
function cabecera() {
  $('#hdrEmpresa').textContent = S.cfg.empresa || 'Gestor de Visitas';
  $('#hdrPerfil').textContent = (S.cfg.perfil ? vNombre(S.cfg.perfil) : 'Sin perfil') + (esAdmin() ? ' · Administrador' : '');
  const p = pendientes(); $('#pendBadge').hidden = !p; $('#btnSync').title = p ? `${p} cambio(s) por enviar` : 'Sincronizar';
}

/* ---------- navegación ---------- */
const VISTAS = { inicio: vInicio, visitas: vVisitas, clientes: vClientes, mapa: vMapa, stats: vStats, config: vConfig };
let mapObj = null, charts = [];
function ir(v, push = true) {
  if (!VISTAS[v]) v = 'inicio';
  S.view = v;
  if (push && location.hash !== '#' + v) history.pushState(null, '', '#' + v);
  $$('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.go === v));
  render();
  window.scrollTo(0, 0);
}
function render() {
  charts.forEach(c => c.destroy()); charts = [];
  if (mapObj) { mapObj.remove(); mapObj = null; }
  $('#view').innerHTML = VISTAS[S.view]();
  cabecera();
  if (S.view === 'mapa') initMapa();
  if (S.view === 'stats') initCharts();
}

/* ---------- componentes ---------- */
function itemVisita(v) {
  const r = resultadoDe(v.resultado), c = cliente(v.clienteId);
  const nFotos = (v.fotos?.length || 0) || (v.fotoUrls?.length || 0);
  return `<button class="item" data-act="verVisita" data-id="${v.id}">
    <span class="ic ${r.c}">${esc((v.tipo || '?').slice(0, 2).toUpperCase())}</span>
    <span class="grow"><b>${esc(c?.nombre || v.clienteNombre || 'Cliente')}</b>
      <span class="meta"><span>${ICON.clock} ${fFecha(v.fecha)}</span>${esAdmin() ? `<span>${ICON.user} ${esc(vNombre(v.vendedorId))}</span>` : ''}
      ${v.lat != null ? `<span>${ICON.pin} ±${v.precision ?? '?'} m</span>` : '<span class="badge warn">Sin GPS</span>'}
      ${nFotos ? `<span>${ICON.cam} ${nFotos}</span>` : ''}${v.synced ? '' : `<span title="Pendiente por enviar">${ICON.cloudOff}</span>`}</span></span>
    <span class="r"><span class="badge ${r.c}">${esc(r.t)}</span>${v.monto ? `<br><b style="color:var(--ink)">${money(v.monto)}</b>` : ''}</span>
  </button>`;
}
const vacio = t => `<div class="empty">${t}</div>`;
const opts = (arr, sel, blank) => (blank != null ? `<option value="">${esc(blank)}</option>` : '') + arr.map(o => { const [v, t] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}" ${String(v) === String(sel) ? 'selected' : ''}>${esc(t)}</option>`; }).join('');
const vendedoresOpts = (sel, blank = 'Todos los vendedores') => opts(S.vendedores.filter(v => v.activo !== false).sort((a, b) => a.nombre.localeCompare(b.nombre)).map(v => [v.id, v.nombre]), sel, blank);

/* ---------- vista: inicio ---------- */
function vInicio() {
  const vis = misVisitas(), h = hoy();
  const vHoy = vis.filter(v => ymd(v.fecha) === h);
  const meta = Number(S.cfg.metaDiaria) || 6;
  const metaTotal = esAdmin() ? meta * Math.max(1, S.vendedores.filter(v => v.activo !== false).length) : meta;
  const sem = vis.filter(v => new Date(v.fecha) >= addDays(new Date(), -6).setHours(0, 0, 0, 0));
  const efect = sem.length ? Math.round(sem.filter(v => resultadoDe(v.resultado).ef).length / sem.length * 100) : 0;
  const monto = sem.filter(v => v.resultado === 'pedido').reduce((a, v) => a + (Number(v.monto) || 0), 0);
  const cart = misClientes();
  const sinVisita = cart.filter(c => { const u = ultimaVisita(c.id); return !u || diasDesde(u.fecha) > 30; });
  const prox = vis.filter(v => v.proxima && v.proxima >= h && v.proxima <= ymd(addDays(new Date(), 7)))
    .sort((a, b) => a.proxima.localeCompare(b.proxima)).slice(0, 8);
  const sinPerfil = !S.cfg.perfil && !esAdmin();
  return `
  ${sinPerfil ? `<div class="banner" style="margin-bottom:12px">Elige tu nombre de vendedor en <a href="#config">Configuración</a> para registrar visitas a tu nombre.</div>` : ''}
  ${!apiUrl() ? `<div class="banner info" style="margin-bottom:12px">Modo local: los datos solo están en este dispositivo hasta configurar la conexión con la base de datos compartida.</div>` : ''}
  <div class="sec-h"><h2>Hoy, ${new Date().toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long' })}</h2></div>
  <div class="kpis">
    <div class="kpi"><small>Visitas hoy</small><b>${vHoy.length} <span class="sub">/ ${metaTotal}</span></b><div class="bar"><i style="width:${Math.min(100, vHoy.length / metaTotal * 100)}%"></i></div></div>
    <div class="kpi"><small>Efectividad 7 días</small><b>${efect}%</b><span class="sub">${sem.length} visitas</span></div>
    <div class="kpi"><small>Pedidos 7 días</small><b>${money(monto)}</b><span class="sub">${sem.filter(v => v.resultado === 'pedido').length} pedidos</span></div>
    <div class="kpi"><small>Clientes sin visita +30 días</small><b>${sinVisita.length}</b><span class="sub">de ${cart.length} en cartera</span></div>
  </div>
  <div class="sec-h"><h3>Próximas visitas programadas</h3><small>7 días</small></div>
  <div class="list">${prox.length ? prox.map(v => { const c = cliente(v.clienteId); return `<div class="item" style="cursor:default">
      <span class="ic info">${esc(fDia(v.proxima).split(' ')[0])}</span>
      <span class="grow"><b>${esc(c?.nombre || v.clienteNombre)}</b><span class="meta"><span>${fDia(v.proxima)}</span><span>${esc(v.tipo)}</span>${esAdmin() ? `<span>${esc(vNombre(v.vendedorId))}</span>` : ''}</span></span>
      <span class="r"><span class="btn sm pri" data-act="nueva" data-cliente="${esc(v.clienteId)}">Visitar</span></span></div>`; }).join('') : vacio('No hay visitas programadas para esta semana.')}</div>
  <div class="sec-h"><h3>Visitas de hoy</h3><a href="#visitas" class="btn sm">Ver todas</a></div>
  <div class="list">${vHoy.length ? vHoy.sort((a, b) => b.fecha.localeCompare(a.fecha)).map(itemVisita).join('') : vacio('Aún no hay visitas hoy. Toca <b>Nueva visita</b> al llegar al cliente.')}</div>
  ${sinVisita.length ? `<div class="sec-h"><h3>Por visitar (más de 30 días)</h3><a href="#clientes" class="btn sm">Cartera</a></div>
  <div class="list">${sinVisita.slice(0, 6).map(itemCliente).join('')}</div>` : ''}`;
}

/* ---------- vista: visitas ---------- */
function filtrarVisitas() {
  const f = S.f, q = norm(f.q);
  return misVisitas().filter(v => {
    const d = ymd(v.fecha);
    if (f.desde && d < f.desde) return false;
    if (f.hasta && d > f.hasta) return false;
    if (f.vendedor && v.vendedorId !== f.vendedor) return false;
    if (f.tipo && v.tipo !== f.tipo) return false;
    if (f.resultado && v.resultado !== f.resultado) return false;
    if (q) { const c = cliente(v.clienteId); if (!norm([c?.nombre, c?.codigo, v.clienteNombre, v.notas, vNombre(v.vendedorId)].join(' ')).includes(q)) return false; }
    return true;
  }).sort((a, b) => b.fecha.localeCompare(a.fecha));
}
function vVisitas() {
  const f = S.f;
  return `<div class="sec-h"><h2>Visitas</h2><button class="btn sm" data-act="exportVisitas">${ICON.down} Exportar Excel</button></div>
  <div class="card filters">
    <input class="q" type="search" placeholder="Buscar cliente, nota, vendedor…" data-f="q" value="${esc(f.q)}">
    <label class="f">Desde<input type="date" data-f="desde" value="${f.desde}"></label>
    <label class="f">Hasta<input type="date" data-f="hasta" value="${f.hasta}"></label>
    ${esAdmin() ? `<label class="f">Vendedor<select data-f="vendedor">${vendedoresOpts(f.vendedor)}</select></label>` : ''}
    <label class="f">Tipo<select data-f="tipo">${opts(TIPOS, f.tipo, 'Todos')}</select></label>
    <label class="f">Resultado<select data-f="resultado">${opts(RESULTADOS.map(r => [r.k, r.t]), f.resultado, 'Todos')}</select></label>
  </div>
  <div id="listaVisitas" style="margin-top:12px">${listaVisitasHTML()}</div>`;
}
function listaVisitasHTML() {
  const l = filtrarVisitas();
  const monto = l.filter(v => v.resultado === 'pedido').reduce((a, v) => a + (Number(v.monto) || 0), 0);
  return `<p class="muted" style="margin:0 0 8px;font-size:.85rem">${l.length} visita(s) · pedidos ${money(monto)}</p>
  <div class="list">${l.slice(0, 300).map(itemVisita).join('') || vacio('No hay visitas con estos filtros.')}</div>
  ${l.length > 300 ? '<p class="muted">Mostrando las 300 más recientes. Usa los filtros o exporta a Excel.</p>' : ''}`;
}

function verVisita(id) {
  const v = S.visitas.find(x => x.id === id); if (!v) return;
  const c = cliente(v.clienteId), r = resultadoDe(v.resultado);
  const dist = c ? distanciaM(v, c) : null;
  const dur = v.inicio && v.fin ? Math.max(1, Math.round((new Date(v.fin) - new Date(v.inicio)) / 60000)) : null;
  const fotos = (v.fotos || []).map((src, i) => `<div class="photo"><img src="${src}" data-act="zoom" alt="Foto ${i + 1}"></div>`).join('')
    + (!(v.fotos || []).length ? (v.fotoUrls || []).map((u, i) => `<div class="photo"><a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(driveThumb(u))}" alt="Foto ${i + 1}" loading="lazy"></a></div>`).join('') : '');
  const puede = esAdmin() || v.vendedorId === S.cfg.perfil;
  abrirModal(`<div class="sheet-h"><h2>${esc(c?.nombre || v.clienteNombre)}</h2><button class="icon-btn" data-act="cerrar" aria-label="Cerrar">${ICON.x}</button></div>
  <div class="sheet-b">
    <div class="row wrap"><span class="badge ${r.c}">${esc(r.t)}</span><span class="badge">${esc(v.tipo)}</span>${v.synced ? '<span class="badge ok">Sincronizada</span>' : '<span class="badge warn">Pendiente por enviar</span>'}</div>
    <dl class="dl card">
      <dt>Fecha</dt><dd>${fFecha(v.fecha)}${dur ? ` · ${dur} min` : ''}</dd>
      <dt>Vendedor</dt><dd>${esc(vNombre(v.vendedorId))}</dd>
      <dt>Cliente</dt><dd>${esc(c?.codigo ? c.codigo + ' · ' : '')}${esc(c?.nombre || v.clienteNombre)}</dd>
      ${v.monto ? `<dt>Monto</dt><dd><b>${money(v.monto)}</b></dd>` : ''}
      ${v.proxima ? `<dt>Próxima visita</dt><dd>${fDia(v.proxima)}</dd>` : ''}
      <dt>Ubicación</dt><dd>${v.lat != null ? `${v.lat.toFixed(6)}, ${v.lng.toFixed(6)} (±${v.precision ?? '?'} m)<br><a href="https://www.google.com/maps?q=${v.lat},${v.lng}" target="_blank" rel="noopener">Ver en Google Maps</a>${dist != null ? ` · a ${fDist(dist)} de la ubicación del cliente ${dist > 300 ? '<span class="badge warn">lejos</span>' : '<span class="badge ok">en sitio</span>'}` : ''}` : '<span class="badge warn">Registrada sin GPS</span>'}</dd>
      ${v.notas ? `<dt>Notas</dt><dd>${esc(v.notas).replace(/\n/g, '<br>')}</dd>` : ''}
    </dl>
    ${fotos ? `<div><h3 style="margin-bottom:8px">Evidencia fotográfica</h3><div class="photos">${fotos}</div></div>` : ''}
  </div>
  ${puede ? `<div class="sheet-f"><button class="btn danger" data-act="borrarVisita" data-id="${v.id}">Eliminar</button><button class="btn pri" data-act="editarVisita" data-id="${v.id}">Editar</button></div>` : ''}`);
}
function driveThumb(u) { const m = String(u).match(/[-\w]{25,}/); return m ? `https://drive.google.com/thumbnail?id=${m[0]}&sz=w600` : u; }

/* ---------- formulario de visita (GPS + fotos) ---------- */
const GPS = {
  watch: null, best: null, timer: null,
  start(cb) {
    this.stop(); this.best = null;
    if (!('geolocation' in navigator)) { cb({ err: 'Este dispositivo no permite obtener la ubicación.' }); return; }
    if (!window.isSecureContext) { cb({ err: 'El GPS requiere abrir la app por https (GitHub Pages).' }); return; }
    this.watch = navigator.geolocation.watchPosition(p => {
      const c = { lat: p.coords.latitude, lng: p.coords.longitude, acc: Math.round(p.coords.accuracy) };
      if (!this.best || c.acc <= this.best.acc) this.best = c;
      cb({ pos: this.best });
      if (this.best.acc <= 15) this.stop();
    }, e => cb({ err: ({ 1: 'Permiso de ubicación denegado. Actívalo en el navegador.', 2: 'No se pudo obtener la señal GPS.', 3: 'El GPS tardó demasiado.' })[e.code] || e.message }),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 });
    this.timer = setTimeout(() => this.stop(), 90000);
  },
  stop() { if (this.watch != null) navigator.geolocation.clearWatch(this.watch); this.watch = null; clearTimeout(this.timer); }
};
let FV = null; // estado del formulario abierto

function abrirFormVisita({ id, clienteId } = {}) {
  if (!S.cfg.perfil && !esAdmin()) { toast('Primero elige tu nombre de vendedor'); ir('config'); return; }
  const ed = id ? S.visitas.find(v => v.id === id) : null;
  FV = ed ? { ...ed, fotos: [...(ed.fotos || [])], editando: true } : {
    id: uid(), inicio: new Date().toISOString(), clienteId: clienteId || '', tipo: 'Venta', resultado: '', monto: '', notas: '', proxima: '', fotos: [],
    vendedorId: S.cfg.perfil, gps: null, gpsErr: '', nuevo: false
  };
  const cart = misClientes().slice().sort((a, b) => a.nombre.localeCompare(b.nombre));
  const cSel = cliente(FV.clienteId);
  abrirModal(`<div class="sheet-h"><h2>${ed ? 'Editar visita' : 'Nueva visita'}</h2><button class="icon-btn" data-act="cerrar" aria-label="Cerrar">${ICON.x}</button></div>
  <form class="sheet-b" id="formVisita" autocomplete="off">
    ${ed ? `<div class="gps ${ed.lat != null ? 'ok' : 'warn'}"><span class="dot"></span><span class="grow">${ed.lat != null ? `Ubicación registrada: ±${ed.precision} m` : 'Esta visita se registró sin GPS'}<br><small>La ubicación original no se modifica al editar.</small></span></div>`
      : `<div class="gps busy" id="gpsBox"><span class="dot"></span><span class="grow" id="gpsTxt">Obteniendo ubicación GPS…</span><button type="button" class="btn sm" data-act="regps">Reintentar</button></div>`}
    ${esAdmin() ? `<label class="f">Vendedor<select name="vendedorId" required>${vendedoresOpts(FV.vendedorId, 'Selecciona…')}</select></label>` : ''}
    <div id="clienteWrap">
      <label class="f">Cliente
        <input name="clienteTxt" list="dlClientes" placeholder="Escribe código o nombre…" value="${cSel ? esc(etiquetaCliente(cSel)) : ''}" ${FV.nuevo ? 'disabled' : ''}>
      </label>
      <datalist id="dlClientes">${cart.map(c => `<option value="${esc(etiquetaCliente(c))}">`).join('')}</datalist>
      ${ed ? '' : `<label class="row" style="margin-top:8px;font-size:.88rem"><input type="checkbox" name="nuevo" style="width:auto"> Cliente nuevo / prospecto</label>`}
      <div id="nuevoCli" class="grid2 hide" style="margin-top:8px">
        <label class="f">Nombre o razón social<input name="nNombre"></label>
        <label class="f">Teléfono<input name="nTelefono" inputmode="tel"></label>
        <label class="f">RIF / C.I.<input name="nRif"></label>
        <label class="f">Zona<input name="nZona"></label>
      </div>
      <div id="cliInfo" class="muted" style="font-size:.84rem;margin-top:6px"></div>
    </div>
    <label class="f">Tipo de visita<select name="tipo">${opts(TIPOS, FV.tipo)}</select></label>
    <div><span class="muted" style="font-size:.84rem;font-weight:500">Resultado</span>
      <div class="chips" style="margin-top:6px">${RESULTADOS.map(r => `<button type="button" class="chip ${FV.resultado === r.k ? 'on' : ''}" data-act="res" data-k="${r.k}">${esc(r.t)}</button>`).join('')}</div></div>
    <div class="grid2">
      <label class="f">Monto (USD)<input name="monto" type="number" step="0.01" min="0" inputmode="decimal" value="${esc(FV.monto ?? '')}" placeholder="0.00"></label>
      <label class="f">Próxima visita<input name="proxima" type="date" value="${esc(FV.proxima || '')}"></label>
    </div>
    <label class="f">Notas / observaciones<textarea name="notas" placeholder="Qué se habló, productos de interés, competencia, acuerdos…">${esc(FV.notas || '')}</textarea></label>
    <div><span class="muted" style="font-size:.84rem;font-weight:500">Fotos de evidencia</span>
      <div class="photos" id="fotosBox" style="margin-top:6px"></div></div>
    <label class="row hide" id="guardarUbic" style="font-size:.88rem"><input type="checkbox" name="guardarUbic" checked style="width:auto"> Guardar esta ubicación como la dirección GPS del cliente</label>
  </form>
  <div class="sheet-f"><button class="btn" data-act="cerrar">Cancelar</button><button class="btn pri" data-act="guardarVisita">Guardar visita</button></div>`);
  pintarFotos(); infoCliente();
  if (!ed) iniciarGPS();
}
const etiquetaCliente = c => (c.codigo ? c.codigo + ' · ' : '') + c.nombre;
function clienteDeTexto(t) { const n = norm(t); if (!n) return null; return misClientes().find(c => norm(etiquetaCliente(c)) === n) || misClientes().find(c => norm(c.nombre) === n || norm(c.codigo) === n); }
function iniciarGPS() {
  const box = $('#gpsBox'), txt = $('#gpsTxt'); if (!box) return;
  box.className = 'gps busy'; txt.textContent = 'Obteniendo ubicación GPS…';
  GPS.start(({ pos, err }) => {
    if (!FV || !$('#gpsBox')) { GPS.stop(); return; }
    if (err) { FV.gpsErr = err; if (!FV.gps) { box.className = 'gps bad'; txt.innerHTML = esc(err) + '<br><small>Puedes guardar igual; quedará marcada “sin GPS”.</small>'; } return; }
    FV.gps = pos;
    box.className = 'gps ' + (pos.acc <= 50 ? 'ok' : 'warn');
    txt.innerHTML = `Ubicación capturada · precisión ±${pos.acc} m<br><small>${pos.lat.toFixed(6)}, ${pos.lng.toFixed(6)}${GPS.watch != null ? ' · afinando…' : ''}</small>`;
    infoCliente();
  });
}
function infoCliente() {
  const f = $('#formVisita'); if (!f || !FV) return;
  const c = FV.nuevo ? null : clienteDeTexto(f.clienteTxt.value);
  const info = $('#cliInfo'), gu = $('#guardarUbic');
  if (!c) { info.textContent = ''; gu.classList.add('hide'); return; }
  const u = ultimaVisita(c.id), d = FV.gps ? distanciaM(FV.gps, c) : null;
  info.innerHTML = [c.zona && esc(c.zona), u && `Última visita: ${fFecha(u.fecha)} (${esc(resultadoDe(u.resultado).t)})`, d != null && `Distancia al cliente: <b>${fDist(d)}</b>`].filter(Boolean).join(' · ');
  gu.classList.toggle('hide', !(FV.gps && c.lat == null && !FV.editando));
}
function pintarFotos() {
  const b = $('#fotosBox'); if (!b) return;
  b.innerHTML = FV.fotos.map((src, i) => `<div class="photo"><img src="${src}" data-act="zoom" alt="Foto ${i + 1}"><button type="button" data-act="quitarFoto" data-i="${i}" aria-label="Quitar">×</button></div>`).join('')
    + (FV.fotos.length < 6 ? `<label class="add-photo">${ICON.cam}<span>Tomar foto</span><input type="file" accept="image/*" capture="environment" data-act="foto"></label>
      <label class="add-photo"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/></svg><span>Galería</span><input type="file" accept="image/*" multiple data-act="foto"></label>` : '');
}
function cargarImagen(file) { return new Promise((res, rej) => { const u = URL.createObjectURL(file), i = new Image(); i.onload = () => { URL.revokeObjectURL(u); res(i); }; i.onerror = () => rej(new Error('Imagen no válida')); i.src = u; }); }
async function procesarFoto(file) {
  const img = await cargarImagen(file);
  const max = 1280, r = Math.min(1, max / Math.max(img.width, img.height));
  const w = Math.round(img.width * r), h = Math.round(img.height * r);
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d'); ctx.drawImage(img, 0, 0, w, h);
  // sello de evidencia: fecha, cliente, coordenadas y vendedor
  const f = $('#formVisita');
  const cli = FV.nuevo ? (f?.nNombre.value || 'Prospecto') : (clienteDeTexto(f?.clienteTxt.value || '')?.nombre || f?.clienteTxt.value || '');
  const lines = [new Date().toLocaleString('es-VE'), cli, FV.gps ? `GPS ${FV.gps.lat.toFixed(6)}, ${FV.gps.lng.toFixed(6)} ±${FV.gps.acc}m` : (FV.lat != null ? `GPS ${FV.lat.toFixed(6)}, ${FV.lng.toFixed(6)}` : 'Sin GPS'), vNombre(FV.vendedorId) + ' · ' + (S.cfg.empresa || '')].filter(Boolean);
  const fs = Math.max(13, Math.round(w / 42)), lh = fs * 1.35, bh = lh * lines.length + fs * .7;
  ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, h - bh, w, bh);
  ctx.fillStyle = '#fff'; ctx.font = `600 ${fs}px system-ui,sans-serif`; ctx.textBaseline = 'top';
  lines.forEach((l, i) => ctx.fillText(l.slice(0, 80), fs * .6, h - bh + fs * .35 + lh * i));
  return cv.toDataURL('image/jpeg', .72);
}

async function guardarVisita() {
  const f = $('#formVisita'); if (!f || !FV) return;
  if (!FV.resultado) { toast('Selecciona el resultado de la visita'); return; }
  const vendedorId = esAdmin() ? f.vendedorId.value : S.cfg.perfil;
  if (!vendedorId) { toast('Selecciona el vendedor'); return; }
  let c;
  if (FV.nuevo) {
    const nombre = f.nNombre.value.trim(); if (!nombre) { toast('Escribe el nombre del cliente nuevo'); return; }
    c = { id: uid(), codigo: 'P-' + Date.now().toString(36).toUpperCase().slice(-5), nombre, telefono: f.nTelefono.value.trim(), rif: f.nRif.value.trim(), zona: f.nZona.value.trim(), vendedorId, prospecto: true, lat: FV.gps?.lat ?? null, lng: FV.gps?.lng ?? null, actualizado: new Date().toISOString(), dirty: true };
    S.clientes.push(c); await DB.put('clientes', c);
  } else {
    c = clienteDeTexto(f.clienteTxt.value);
    if (!c) { toast('Elige un cliente de la lista o marca “Cliente nuevo”'); return; }
    if (FV.gps && c.lat == null && f.guardarUbic?.checked && !FV.editando) { c.lat = FV.gps.lat; c.lng = FV.gps.lng; c.actualizado = new Date().toISOString(); c.dirty = true; await DB.put('clientes', c); }
  }
  GPS.stop();
  const v = {
    id: FV.id, fecha: FV.fecha || new Date().toISOString(), inicio: FV.inicio, fin: FV.fin || new Date().toISOString(),
    vendedorId, clienteId: c.id, clienteNombre: c.nombre, clienteCodigo: c.codigo || '', tipo: f.tipo.value, resultado: FV.resultado,
    monto: num(f.monto.value), notas: f.notas.value.trim(), proxima: f.proxima.value || '', fotos: FV.fotos, fotoUrls: FV.fotoUrls || [],
    lat: FV.editando ? FV.lat ?? null : FV.gps?.lat ?? null, lng: FV.editando ? FV.lng ?? null : FV.gps?.lng ?? null,
    precision: FV.editando ? FV.precision ?? null : FV.gps?.acc ?? null, sinGps: FV.editando ? !!FV.sinGps : !FV.gps,
    synced: false, actualizado: new Date().toISOString()
  };
  v.fotosSubidas = FV.editando ? (FV.fotosSubidas || 0) : 0; // cuántas fotos locales ya están en Drive
  const i = S.visitas.findIndex(x => x.id === v.id); if (i >= 0) S.visitas[i] = v; else S.visitas.push(v);
  await DB.put('visitas', v);
  FV = null; cerrarModal(); render();
  toast(v.sinGps ? 'Visita guardada (sin GPS)' : 'Visita guardada con ubicación ✓');
  if (apiUrl() && navigator.onLine) sincronizar(true);
}

/* ---------- vista: clientes ---------- */
function itemCliente(c) {
  const u = ultimaVisita(c.id), d = u ? diasDesde(u.fecha) : null;
  const cls = d == null ? 'bad' : d > 30 ? 'warn' : 'ok';
  return `<button class="item" data-act="verCliente" data-id="${c.id}">
    <span class="ic ${cls}">${d == null ? '—' : d + 'd'}</span>
    <span class="grow"><b>${esc(c.nombre)}</b><span class="meta">${c.codigo ? `<span>${esc(c.codigo)}</span>` : ''}${c.zona ? `<span>${esc(c.zona)}</span>` : ''}${esAdmin() ? `<span>${ICON.user} ${esc(vNombre(c.vendedorId))}</span>` : ''}${c.lat != null ? `<span>${ICON.pin}</span>` : ''}${c.prospecto ? '<span class="badge info">Prospecto</span>' : ''}</span></span>
    <span class="r"><span class="btn sm pri" data-act="nueva" data-cliente="${c.id}">Visitar</span></span></button>`;
}
function filtrarClientes() {
  const q = norm(S.fc.q);
  let l = misClientes().filter(c => (!S.fc.zona || c.zona === S.fc.zona) && (!q || norm([c.nombre, c.codigo, c.rif, c.zona, c.telefono, c.direccion].join(' ')).includes(q)));
  if (S.fc.orden === 'antiguedad') l.sort((a, b) => (ultimaVisita(a.id)?.fecha || '').localeCompare(ultimaVisita(b.id)?.fecha || ''));
  else l.sort((a, b) => a.nombre.localeCompare(b.nombre));
  return l;
}
function vClientes() {
  const zonas = [...new Set(misClientes().map(c => c.zona).filter(Boolean))].sort();
  return `<div class="sec-h"><h2>Clientes <small>(${misClientes().length})</small></h2>
    <div class="row">${esAdmin() ? `<button class="btn sm" data-act="importar" data-tipo="clientes">${ICON.up} Importar</button><button class="btn sm pri" data-act="editarCliente">+ Cliente</button>` : ''}</div></div>
  <div class="card filters">
    <input class="q" type="search" placeholder="Buscar por nombre, código, RIF…" data-fc="q" value="${esc(S.fc.q)}">
    <label class="f">Zona<select data-fc="zona">${opts(zonas, S.fc.zona, 'Todas')}</select></label>
    <label class="f">Ordenar<select data-fc="orden">${opts([['nombre', 'Nombre'], ['antiguedad', 'Más tiempo sin visita']], S.fc.orden)}</select></label>
  </div>
  <div id="listaClientes" class="list" style="margin-top:12px">${listaClientesHTML()}</div>`;
}
function listaClientesHTML() {
  const l = filtrarClientes();
  if (!S.clientes.length) return vacio(esAdmin() ? 'Aún no hay clientes. Usa <b>Importar</b> para cargar tu cartera desde Excel o CSV.' : 'Aún no hay clientes. Sincroniza para descargar tu cartera.');
  return l.slice(0, 300).map(itemCliente).join('') || vacio('Sin resultados.');
}
function verCliente(id) {
  const c = cliente(id); if (!c) return;
  const vs = S.visitas.filter(v => v.clienteId === id).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const tel = String(c.telefono || '').replace(/\D/g, '');
  abrirModal(`<div class="sheet-h"><h2>${esc(c.nombre)}</h2><button class="icon-btn" data-act="cerrar" aria-label="Cerrar">${ICON.x}</button></div>
  <div class="sheet-b">
    <dl class="dl card">
      ${c.codigo ? `<dt>Código</dt><dd>${esc(c.codigo)}</dd>` : ''}${c.rif ? `<dt>RIF</dt><dd>${esc(c.rif)}</dd>` : ''}
      ${c.telefono ? `<dt>Teléfono</dt><dd>${esc(c.telefono)}</dd>` : ''}${c.email ? `<dt>Email</dt><dd>${esc(c.email)}</dd>` : ''}
      ${c.direccion ? `<dt>Dirección</dt><dd>${esc(c.direccion)}</dd>` : ''}${c.zona ? `<dt>Zona</dt><dd>${esc(c.zona)}</dd>` : ''}
      <dt>Vendedor</dt><dd>${esc(vNombre(c.vendedorId))}</dd>
      <dt>Visitas</dt><dd>${vs.length} · efectivas ${vs.filter(v => resultadoDe(v.resultado).ef).length} · pedidos ${money(vs.filter(v => v.resultado === 'pedido').reduce((a, v) => a + (+v.monto || 0), 0))}</dd>
      ${c.notas ? `<dt>Notas</dt><dd>${esc(c.notas)}</dd>` : ''}
    </dl>
    <div class="row wrap">
      ${c.lat != null ? `<a class="btn sm" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}">${ICON.nav} Cómo llegar</a>` : '<span class="badge">Sin ubicación GPS (se guarda en la primera visita)</span>'}
      ${tel ? `<a class="btn sm" target="_blank" rel="noopener" href="https://wa.me/${tel.length === 10 ? '58' + tel : tel.replace(/^0/, '58')}">${ICON.wa} WhatsApp</a><a class="btn sm" href="tel:${esc(c.telefono)}">Llamar</a>` : ''}
    </div>
    <div><h3 style="margin-bottom:8px">Historial</h3><div class="list">${vs.slice(0, 30).map(itemVisita).join('') || vacio('Sin visitas registradas.')}</div></div>
  </div>
  <div class="sheet-f">${esAdmin() ? `<button class="btn" data-act="editarCliente" data-id="${c.id}">Editar</button>` : ''}<button class="btn pri" data-act="nueva" data-cliente="${c.id}">Registrar visita</button></div>`);
}
function editarCliente(id) {
  const c = id ? cliente(id) : { id: '', codigo: '', nombre: '', rif: '', telefono: '', email: '', direccion: '', zona: '', vendedorId: '', notas: '' };
  abrirModal(`<div class="sheet-h"><h2>${id ? 'Editar cliente' : 'Nuevo cliente'}</h2><button class="icon-btn" data-act="cerrar" aria-label="Cerrar">${ICON.x}</button></div>
  <form class="sheet-b" id="formCliente">
    <div class="grid2"><label class="f">Código<input name="codigo" value="${esc(c.codigo)}"></label><label class="f">RIF / C.I.<input name="rif" value="${esc(c.rif)}"></label></div>
    <label class="f">Nombre o razón social *<input name="nombre" required value="${esc(c.nombre)}"></label>
    <div class="grid2"><label class="f">Teléfono<input name="telefono" value="${esc(c.telefono)}"></label><label class="f">Email<input name="email" type="email" value="${esc(c.email)}"></label></div>
    <label class="f">Dirección<input name="direccion" value="${esc(c.direccion)}"></label>
    <div class="grid2"><label class="f">Zona / ruta<input name="zona" value="${esc(c.zona)}"></label><label class="f">Vendedor<select name="vendedorId">${vendedoresOpts(c.vendedorId, 'Sin asignar')}</select></label></div>
    <div class="grid2"><label class="f">Latitud<input name="lat" inputmode="decimal" value="${c.lat ?? ''}"></label><label class="f">Longitud<input name="lng" inputmode="decimal" value="${c.lng ?? ''}"></label></div>
    <label class="f">Notas<textarea name="notas">${esc(c.notas)}</textarea></label>
  </form>
  <div class="sheet-f">${id ? `<button class="btn danger" data-act="borrarCliente" data-id="${id}">Eliminar</button>` : ''}<button class="btn pri" data-act="guardarCliente" data-id="${esc(id || '')}">Guardar</button></div>`);
}
async function guardarCliente(id) {
  const f = $('#formCliente'), d = Object.fromEntries(new FormData(f));
  if (!d.nombre.trim()) { toast('El nombre es obligatorio'); return; }
  const base = id ? cliente(id) : { id: uid() };
  const c = { ...base, ...d, nombre: d.nombre.trim(), lat: num(d.lat), lng: num(d.lng), actualizado: new Date().toISOString(), dirty: true };
  const i = S.clientes.findIndex(x => x.id === c.id); if (i >= 0) S.clientes[i] = c; else S.clientes.push(c);
  await DB.put('clientes', c); cerrarModal(); render(); toast('Cliente guardado');
  if (apiUrl() && navigator.onLine) sincronizar(true);
}

/* ---------- vista: mapa ---------- */
function vMapa() {
  const m = S.mapa;
  return `<div class="sec-h"><h2>Mapa de visitas</h2>
    <div class="seg">${[['hoy', 'Hoy'], ['7', '7 días'], ['30', '30 días']].map(([k, t]) => `<button data-act="mapaRango" data-k="${k}" class="${m.rango === k ? 'on' : ''}">${t}</button>`).join('')}</div></div>
  <div class="row wrap" style="margin-bottom:10px;font-size:.84rem">
    <label class="row" style="gap:6px"><input type="checkbox" data-act="mapaCli" ${m.clientes ? 'checked' : ''} style="width:auto"> Mostrar clientes con ubicación</label>
    <span class="row" style="gap:10px"><span><span class="badge ok">●</span> efectiva</span><span><span class="badge warn">●</span> seguimiento</span><span><span class="badge bad">●</span> no efectiva</span><span><span class="badge">◆</span> cliente</span></span>
  </div>
  <div id="map"></div>`;
}
function initMapa() {
  if (!window.L) { $('#map').innerHTML = vacio('El mapa necesita conexión a internet la primera vez.'); return; }
  mapObj = L.map('map').setView([10.48, -66.9], 11);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(mapObj);
  const css = getComputedStyle(document.documentElement), col = k => css.getPropertyValue('--' + k).trim();
  const desde = S.mapa.rango === 'hoy' ? hoy() : ymd(addDays(new Date(), -Number(S.mapa.rango) + 1));
  const pts = [];
  if (S.mapa.clientes) misClientes().filter(c => c.lat != null).forEach(c => {
    pts.push([c.lat, c.lng]);
    L.circleMarker([c.lat, c.lng], { radius: 5, color: col('muted'), weight: 1.5, fillOpacity: .25 }).addTo(mapObj)
      .bindPopup(`<b>${esc(c.nombre)}</b><br>${esc(c.zona || '')}<br><a href="https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}" target="_blank">Cómo llegar</a>`);
  });
  misVisitas().filter(v => v.lat != null && ymd(v.fecha) >= desde).forEach(v => {
    const r = resultadoDe(v.resultado), color = r.ef ? col('ok') : r.c === 'warn' ? col('warn') : col('bad');
    pts.push([v.lat, v.lng]);
    L.circleMarker([v.lat, v.lng], { radius: 9, color: '#fff', weight: 2, fillColor: color, fillOpacity: .95 }).addTo(mapObj)
      .bindPopup(`<b>${esc(cliente(v.clienteId)?.nombre || v.clienteNombre)}</b><br>${fFecha(v.fecha)}<br>${esc(r.t)}${v.monto ? ' · ' + money(v.monto) : ''}<br>${esc(vNombre(v.vendedorId))}`);
  });
  if (pts.length) mapObj.fitBounds(pts, { padding: [30, 30], maxZoom: 16 });
  else if (navigator.geolocation) navigator.geolocation.getCurrentPosition(p => mapObj && mapObj.setView([p.coords.latitude, p.coords.longitude], 13), () => { }, { timeout: 8000 });
  setTimeout(() => mapObj && mapObj.invalidateSize(), 100);
}

/* ---------- vista: estadísticas ---------- */
function datosStats() {
  const desde = ymd(addDays(new Date(), -S.st.rango + 1));
  let l = misVisitas().filter(v => ymd(v.fecha) >= desde);
  if (S.st.vendedor) l = l.filter(v => v.vendedorId === S.st.vendedor);
  return { l, desde };
}
function vStats() {
  const { l } = datosStats();
  const ef = l.filter(v => resultadoDe(v.resultado).ef).length;
  const pedidos = l.filter(v => v.resultado === 'pedido'), cobros = l.filter(v => v.resultado === 'cobro');
  const sumM = a => a.reduce((s, v) => s + (+v.monto || 0), 0);
  const clientesUnicos = new Set(l.map(v => v.clienteId)).size;
  const cart = S.st.vendedor ? S.clientes.filter(c => c.vendedorId === S.st.vendedor) : misClientes();
  const dias = new Set(l.map(v => ymd(v.fecha))).size || 1;
  const durs = l.filter(v => v.inicio && v.fin).map(v => (new Date(v.fin) - new Date(v.inicio)) / 60000).filter(m => m > 0 && m < 600);
  const conGps = l.filter(v => v.lat != null).length, conFoto = l.filter(v => (v.fotos?.length || v.fotoUrls?.length)).length;
  const rank = S.vendedores.map(vd => {
    const x = l.filter(v => v.vendedorId === vd.id), e = x.filter(v => resultadoDe(v.resultado).ef).length;
    return { n: vd.nombre, t: x.length, e, p: x.length ? Math.round(e / x.length * 100) : 0, m: sumM(x.filter(v => v.resultado === 'pedido')), g: x.length ? Math.round(x.filter(v => v.lat != null).length / x.length * 100) : 0, d: new Set(x.map(v => ymd(v.fecha))).size };
  }).filter(r => r.t).sort((a, b) => b.t - a.t);
  return `<div class="sec-h"><h2>Estadísticas</h2>
    <div class="seg">${[7, 30, 90, 365].map(n => `<button data-act="stRango" data-k="${n}" class="${S.st.rango === n ? 'on' : ''}">${n === 365 ? '1 año' : n + ' d'}</button>`).join('')}</div></div>
  ${esAdmin() ? `<label class="f" style="margin-bottom:12px">Vendedor<select data-st="vendedor">${vendedoresOpts(S.st.vendedor, 'Todo el equipo')}</select></label>` : ''}
  <div class="kpis">
    <div class="kpi"><small>Visitas</small><b>${l.length}</b><span class="sub">${(l.length / dias).toFixed(1)} por día trabajado</span></div>
    <div class="kpi"><small>Efectividad</small><b>${l.length ? Math.round(ef / l.length * 100) : 0}%</b><span class="sub">${ef} efectivas</span></div>
    <div class="kpi"><small>Pedidos</small><b>${money(sumM(pedidos))}</b><span class="sub">${pedidos.length} pedidos · ticket ${money(pedidos.length ? sumM(pedidos) / pedidos.length : 0)}</span></div>
    <div class="kpi"><small>Cobranza</small><b>${money(sumM(cobros))}</b><span class="sub">${cobros.length} cobros</span></div>
    <div class="kpi"><small>Cobertura de cartera</small><b>${cart.length ? Math.round(clientesUnicos / cart.length * 100) : 0}%</b><span class="sub">${clientesUnicos} de ${cart.length} clientes</span></div>
    <div class="kpi"><small>Duración promedio</small><b>${durs.length ? Math.round(durs.reduce((a, b) => a + b, 0) / durs.length) : 0} min</b><span class="sub">por visita</span></div>
    <div class="kpi"><small>Con GPS</small><b>${l.length ? Math.round(conGps / l.length * 100) : 0}%</b><span class="sub">${conGps} visitas</span></div>
    <div class="kpi"><small>Con foto</small><b>${l.length ? Math.round(conFoto / l.length * 100) : 0}%</b><span class="sub">${conFoto} visitas</span></div>
  </div>
  <div class="card" style="margin-top:12px"><h3>Visitas por día</h3><div class="chart-box"><canvas id="chDias"></canvas></div></div>
  <div class="grid2" style="margin-top:12px;grid-template-columns:repeat(auto-fit,minmax(280px,1fr))">
    <div class="card"><h3>Por resultado</h3><div class="chart-box"><canvas id="chRes"></canvas></div></div>
    <div class="card"><h3>Por hora del día</h3><div class="chart-box"><canvas id="chHora"></canvas></div></div>
  </div>
  ${esAdmin() && !S.st.vendedor ? `<div class="card" style="margin-top:12px"><h3 style="margin-bottom:8px">Ranking de vendedores</h3><div class="tscroll"><table class="t">
    <thead><tr><th>Vendedor</th><th class="n">Visitas</th><th class="n">Días</th><th class="n">Efect.</th><th class="n">Pedidos</th><th class="n">GPS</th></tr></thead>
    <tbody>${rank.map(r => `<tr><td>${esc(r.n)}</td><td class="n">${r.t}</td><td class="n">${r.d}</td><td class="n">${r.p}%</td><td class="n">${money(r.m)}</td><td class="n">${r.g}%</td></tr>`).join('') || '<tr><td colspan="6" class="muted">Sin datos en el periodo</td></tr>'}</tbody></table></div></div>` : ''}
  <div class="row" style="margin-top:12px"><button class="btn sm" data-act="exportStats">${ICON.down} Exportar resumen a Excel</button></div>`;
}
function initCharts() {
  if (!window.Chart) return;
  const { l } = datosStats();
  const css = getComputedStyle(document.documentElement), col = k => css.getPropertyValue('--' + k).trim();
  Chart.defaults.color = col('muted'); Chart.defaults.borderColor = col('line'); Chart.defaults.font.family = 'system-ui,sans-serif';
  const dias = []; for (let i = Math.min(S.st.rango, 60) - 1; i >= 0; i--) dias.push(ymd(addDays(new Date(), -i)));
  const porDia = k => dias.map(d => l.filter(v => ymd(v.fecha) === d && (k ? resultadoDe(v.resultado).ef : !resultadoDe(v.resultado).ef)).length);
  charts.push(new Chart($('#chDias'), {
    type: 'bar', data: { labels: dias.map(d => d.slice(8) + '/' + d.slice(5, 7)), datasets: [{ label: 'Efectivas', data: porDia(true), backgroundColor: col('pri'), borderRadius: 4, stack: 's' }, { label: 'No efectivas', data: porDia(false), backgroundColor: col('line'), borderRadius: 4, stack: 's' }] },
    options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { x: { grid: { display: false } }, y: { beginAtZero: true, ticks: { precision: 0 } } } }
  }));
  const cmap = { ok: col('ok'), info: col('info'), warn: col('warn'), bad: col('bad'), '': col('muted') };
  const rs = RESULTADOS.map(r => ({ r, n: l.filter(v => v.resultado === r.k).length })).filter(x => x.n);
  charts.push(new Chart($('#chRes'), { type: 'doughnut', data: { labels: rs.map(x => x.r.t), datasets: [{ data: rs.map(x => x.n), backgroundColor: rs.map(x => cmap[x.r.c]), borderColor: col('card'), borderWidth: 2 }] }, options: { maintainAspectRatio: false, cutout: '62%', plugins: { legend: { position: 'right', labels: { boxWidth: 12 } } } } }));
  const horas = Array.from({ length: 14 }, (_, i) => i + 6);
  charts.push(new Chart($('#chHora'), { type: 'bar', data: { labels: horas.map(h => h + 'h'), datasets: [{ label: 'Visitas', data: horas.map(h => l.filter(v => new Date(v.fecha).getHours() === h).length), backgroundColor: col('info'), borderRadius: 4 }] }, options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { beginAtZero: true, ticks: { precision: 0 } } } } }));
}

/* ---------- vista: configuración ---------- */
function vConfig() {
  const act = S.vendedores.filter(v => v.activo !== false).sort((a, b) => a.nombre.localeCompare(b.nombre));
  return `<div class="sec-h"><h2>Configuración</h2></div>
  <div class="stack">
  <div class="card stack"><h3>Mi perfil</h3>
    ${S.vendedores.length ? `<label class="f">¿Quién usa este dispositivo?<select data-cfg="perfil">${opts(act.map(v => [v.id, v.nombre]), S.cfg.perfil, 'Selecciona tu nombre…')}</select></label>`
      : `<p class="muted" style="margin:0">No hay vendedores cargados. ${apiUrl() ? 'Toca <b>Sincronizar</b> para descargarlos' : 'Activa el modo administrador para crearlos o importarlos'}.</p>`}
    <div class="row between"><span>Modo administrador ${esAdmin() ? '<span class="badge ok">activo</span>' : ''}</span><button class="btn sm" data-act="admin">${esAdmin() ? 'Salir' : 'Entrar'}</button></div>
    <label class="f">Tema<select data-cfg="tema">${opts([['', 'Automático'], ['light', 'Claro'], ['dark', 'Oscuro']], S.cfg.tema)}</select></label>
  </div>

  <div class="card stack"><h3>Base de datos compartida</h3>
    <p class="muted" style="margin:0;font-size:.88rem">Los datos se guardan en Google Sheets y las fotos en Google Drive de la cuenta <b>desarrolloapps.ve@gmail.com</b>. Sin internet todo se guarda en el teléfono y se envía al reconectar.</p>
    <div class="row wrap"><span class="badge ${apiUrl() ? 'ok' : 'warn'}">${apiUrl() ? 'Conectada' : 'Sin configurar'}</span><small>Última sincronización: ${S.cfg.lastSync ? fFecha(S.cfg.lastSync) : 'nunca'}</small><small>Pendientes: ${pendientes()}</small></div>
    <div class="row wrap"><button class="btn sm pri" data-act="sync">Sincronizar ahora</button>${esAdmin() ? '<button class="btn sm" data-act="publicarCartera">Publicar cartera completa</button><button class="btn sm" data-act="probarApi">Probar conexión</button>' : ''}</div>
    ${esAdmin() ? `<details><summary class="muted" style="cursor:pointer">Ajustes avanzados de conexión</summary><div class="stack" style="margin-top:10px">
      <label class="f">URL de Apps Script (deja vacío para usar la de config.js)<input data-cfg="apiUrl" value="${esc(S.cfg.apiUrl)}" placeholder="${esc(G.API_URL || 'https://script.google.com/macros/s/…/exec')}"></label>
      <label class="f">Clave API<input data-cfg="clave" value="${esc(S.cfg.clave)}" placeholder="${G.CLAVE ? '(definida en config.js)' : 'opcional'}"></label></div></details>` : ''}
  </div>

  ${esAdmin() ? `<div class="card stack"><h3>Empresa y metas</h3>
    <div class="grid2"><label class="f">Nombre de la empresa<input data-cfg="empresa" value="${esc(S.cfg.empresa)}"></label>
    <label class="f">Meta de visitas diarias por vendedor<input type="number" min="1" data-cfg="metaDiaria" value="${esc(S.cfg.metaDiaria)}"></label></div>
    <label class="f">PIN de administrador<input data-cfg="pin" value="${esc(S.cfg.pin)}" inputmode="numeric"></label>
  </div>
  <div class="card stack"><div class="row between"><h3>Vendedores (${act.length})</h3><button class="btn sm pri" data-act="editarVendedor">+ Vendedor</button></div>
    <div class="list">${S.vendedores.sort((a, b) => a.nombre.localeCompare(b.nombre)).map(v => `<button class="item" data-act="editarVendedor" data-id="${v.id}"><span class="ic">${esc(v.nombre.slice(0, 2).toUpperCase())}</span><span class="grow"><b>${esc(v.nombre)}</b><span class="meta">${esc(v.telefono || '')} ${esc(v.email || '')} · ${misClientesDe(v.id)} clientes</span></span>${v.activo === false ? '<span class="badge">inactivo</span>' : ''}</button>`).join('') || vacio('Sin vendedores. Se crean automáticamente al importar clientes con la columna “vendedor”.')}</div>
  </div>
  <div class="card stack"><h3>Importar información</h3>
    <p class="muted" style="margin:0;font-size:.88rem">Acepta Excel (.xlsx, .xls) o CSV. Las columnas se reconocen por nombre (código, nombre, RIF, teléfono, dirección, zona, vendedor, latitud, longitud…). Si el código ya existe, el registro se actualiza.</p>
    <div class="row wrap"><button class="btn sm pri" data-act="importar" data-tipo="clientes">${ICON.up} Clientes</button><button class="btn sm" data-act="importar" data-tipo="vendedores">${ICON.up} Vendedores</button><button class="btn sm" data-act="importar" data-tipo="visitas">${ICON.up} Visitas históricas</button></div>
    <div class="row wrap"><button class="btn sm" data-act="plantilla" data-tipo="clientes">${ICON.down} Plantilla clientes</button><button class="btn sm" data-act="plantilla" data-tipo="vendedores">${ICON.down} Plantilla vendedores</button><button class="btn sm" data-act="plantilla" data-tipo="visitas">${ICON.down} Plantilla visitas</button></div>
  </div>` : ''}

  <div class="card stack"><h3>Exportar y respaldo</h3>
    <div class="row wrap"><button class="btn sm" data-act="exportVisitas">${ICON.down} Visitas (Excel)</button><button class="btn sm" data-act="exportClientes">${ICON.down} Clientes (Excel)</button><button class="btn sm" data-act="backup">${ICON.down} Respaldo completo</button>${esAdmin() ? `<label class="btn sm">${ICON.up} Restaurar respaldo<input type="file" accept=".json" data-act="restore" hidden></label>` : ''}</div>
    ${esAdmin() ? '<button class="btn sm danger" data-act="borrarTodo" style="justify-self:start">Borrar datos de este dispositivo</button>' : ''}
  </div>
  <p class="muted" style="text-align:center;font-size:.8rem">Gestor de Visitas v1.0 · <a href="../">Volver al portal de aplicaciones</a></p>
  </div>`;
}
const misClientesDe = id => S.clientes.filter(c => c.vendedorId === id).length;
function pedirAdmin() {
  abrirModal(`<div class="sheet-h"><h2>Modo administrador</h2><button class="icon-btn" data-act="cerrar" aria-label="Cerrar">${ICON.x}</button></div>
  <div class="sheet-b"><label class="f">PIN<input id="pinIn" type="password" inputmode="numeric" autofocus></label><small>PIN inicial: 1234 (cámbialo en Configuración).</small></div>
  <div class="sheet-f"><button class="btn pri" data-act="validarPin">Entrar</button></div>`);
  setTimeout(() => $('#pinIn')?.focus(), 50);
}
function editarVendedor(id) {
  const v = id ? vendedor(id) : { nombre: '', telefono: '', email: '', activo: true };
  abrirModal(`<div class="sheet-h"><h2>${id ? 'Editar' : 'Nuevo'} vendedor</h2><button class="icon-btn" data-act="cerrar" aria-label="Cerrar">${ICON.x}</button></div>
  <form class="sheet-b" id="formVend"><label class="f">Nombre *<input name="nombre" value="${esc(v.nombre)}" required></label>
    <div class="grid2"><label class="f">Teléfono<input name="telefono" value="${esc(v.telefono || '')}"></label><label class="f">Email<input name="email" value="${esc(v.email || '')}"></label></div>
    <label class="row"><input type="checkbox" name="activo" ${v.activo !== false ? 'checked' : ''} style="width:auto"> Activo</label></form>
  <div class="sheet-f"><button class="btn pri" data-act="guardarVendedor" data-id="${esc(id || '')}">Guardar</button></div>`);
}
async function guardarVendedor(id) {
  const f = $('#formVend'); const nombre = f.nombre.value.trim(); if (!nombre) { toast('Escribe el nombre'); return; }
  const v = { ...(id ? vendedor(id) : { id: uid() }), nombre, telefono: f.telefono.value.trim(), email: f.email.value.trim(), activo: f.activo.checked, dirty: true };
  const i = S.vendedores.findIndex(x => x.id === v.id); if (i >= 0) S.vendedores[i] = v; else S.vendedores.push(v);
  await DB.put('vendedores', v); cerrarModal(); render();
  if (apiUrl() && navigator.onLine) sincronizar(true);
}

/* ---------- importación ---------- */
const ALIAS = {
  codigo: ['codigo', 'cod', 'code', 'codigo cliente', 'cod cliente', 'id cliente', 'nro', 'numero'],
  nombre: ['nombre', 'cliente', 'razon social', 'name', 'nombre cliente', 'empresa', 'descripcion', 'vendedor nombre'],
  rif: ['rif', 'ci', 'cedula', 'c.i.', 'rif/ci', 'nit', 'ruc', 'documento'],
  telefono: ['telefono', 'tlf', 'tel', 'celular', 'movil', 'phone', 'whatsapp', 'telefonos'],
  email: ['email', 'correo', 'e-mail', 'mail', 'correo electronico'],
  direccion: ['direccion', 'address', 'domicilio', 'direccion fiscal'],
  zona: ['zona', 'ruta', 'sector', 'ciudad', 'estado', 'region', 'municipio'],
  vendedor: ['vendedor', 'asesor', 'seller', 'ejecutivo', 'vendedor asignado'],
  lat: ['lat', 'latitud', 'latitude'],
  lng: ['lng', 'lon', 'long', 'longitud', 'longitude'],
  notas: ['notas', 'observaciones', 'nota', 'comentarios'],
  fecha: ['fecha', 'date', 'fecha visita', 'dia'],
  tipo: ['tipo', 'tipo visita', 'motivo'],
  resultado: ['resultado', 'estatus', 'status', 'estado visita'],
  monto: ['monto', 'total', 'importe', 'venta', 'monto usd'],
  activo: ['activo']
};
const CAMPOS = {
  clientes: ['codigo', 'nombre', 'rif', 'telefono', 'email', 'direccion', 'zona', 'vendedor', 'lat', 'lng', 'notas'],
  vendedores: ['nombre', 'telefono', 'email', 'activo'],
  visitas: ['fecha', 'codigo', 'nombre', 'vendedor', 'tipo', 'resultado', 'monto', 'notas', 'lat', 'lng']
};
function mapearCols(headers, tipo) {
  const m = {}, hs = headers.map(norm);
  CAMPOS[tipo].forEach(campo => {
    let al = ALIAS[campo];
    if (tipo === 'visitas' && campo === 'nombre') al = ['cliente', 'nombre', 'razon social', 'nombre cliente'];
    if (tipo === 'vendedores' && campo === 'nombre') al = ['nombre', 'vendedor', 'asesor'];
    let i = hs.findIndex(h => al.includes(h));
    if (i < 0) i = hs.findIndex(h => al.some(a => a.length > 3 && h.includes(a)));
    if (i >= 0 && !Object.values(m).includes(i)) m[campo] = i;
  });
  return m;
}
let IMP = null;
function pedirArchivo(tipo) {
  if (!window.XLSX) { toast('Se necesita internet para leer Excel'); return; }
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.xlsx,.xls,.csv,.ods';
  inp.onchange = async () => {
    const file = inp.files[0]; if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      let wb;
      if (/\.(csv|txt)$/i.test(file.name)) { // CSV: detectar UTF-8 o Windows-1252 (Excel en español)
        let txt = new TextDecoder('utf-8').decode(buf);
        if (txt.includes('�')) txt = new TextDecoder('windows-1252').decode(buf);
        const sep = (txt.split('\n')[0].match(/;/g) || []).length > (txt.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
        wb = XLSX.read(txt.replace(/^﻿/, ''), { type: 'string', FS: sep, raw: true });
      } else wb = XLSX.read(buf, { type: 'array', cellDates: true });
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '', raw: false, dateNF: 'yyyy-mm-dd hh:mm' });
      let hi = rows.findIndex(r => r.filter(x => String(x).trim()).length >= 2); if (hi < 0) throw new Error('El archivo está vacío');
      const headers = rows[hi].map(String), data = rows.slice(hi + 1).filter(r => r.some(x => String(x).trim()));
      IMP = { tipo, headers, data, map: mapearCols(headers, tipo), file: file.name };
      vistaImport();
    } catch (e) { toast('No se pudo leer el archivo: ' + e.message, 4000); }
  };
  inp.click();
}
function vistaImport() {
  const { tipo, headers, data, map, file } = IMP;
  abrirModal(`<div class="sheet-h"><h2>Importar ${tipo}</h2><button class="icon-btn" data-act="cerrar" aria-label="Cerrar">${ICON.x}</button></div>
  <div class="sheet-b"><p class="muted" style="margin:0">${esc(file)} · <b>${data.length}</b> filas. Revisa qué columna corresponde a cada campo:</p>
    <div class="grid2">${CAMPOS[tipo].map(c => `<label class="f">${c}${(c === 'nombre' && tipo !== 'visitas') ? ' *' : ''}<select data-imp="${c}">${opts(headers.map((h, i) => [i, h || `Columna ${i + 1}`]), map[c] ?? '', '— no importar —')}</select></label>`).join('')}</div>
    <div class="tscroll card" style="padding:6px"><table class="t"><thead><tr>${CAMPOS[tipo].filter(c => map[c] != null).map(c => `<th>${c}</th>`).join('')}</tr></thead>
    <tbody>${data.slice(0, 4).map(r => `<tr>${CAMPOS[tipo].filter(c => map[c] != null).map(c => `<td>${esc(r[map[c]])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
  </div><div class="sheet-f"><button class="btn" data-act="cerrar">Cancelar</button><button class="btn pri" data-act="confirmarImport">Importar ${data.length} filas</button></div>`);
}
function vendedorPorNombre(nombre, crear) {
  const n = norm(nombre); if (!n) return '';
  let v = S.vendedores.find(x => norm(x.nombre) === n);
  if (!v && crear) { v = { id: uid(), nombre: String(nombre).trim(), activo: true, dirty: true }; S.vendedores.push(v); crear.push(v); }
  return v ? v.id : '';
}
function parseFecha(s) {
  if (!s) return null; s = String(s).trim();
  let m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (m) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; return new Date(+y, +m[2] - 1, +m[1], +(m[4] || 12), +(m[5] || 0)).toISOString(); }
  const d = new Date(s.length === 10 ? s + 'T12:00' : s); return isNaN(d) ? null : d.toISOString();
}
function resultadoDeTexto(t) {
  const n = norm(t); if (!n) return 'sin_compra';
  const r = RESULTADOS.find(r => r.k === n || norm(r.t) === n); if (r) return r.k;
  if (n.includes('pedido') || n.includes('venta')) return 'pedido';
  if (n.includes('cobr') || n.includes('pago')) return 'cobro';
  if (n.includes('cotiz') || n.includes('interes')) return 'cotizacion';
  if (n.includes('seguim')) return 'seguimiento';
  if (n.includes('ausen') || n.includes('cerrad')) return 'ausente';
  return 'sin_compra';
}
async function confirmarImport() {
  const { tipo, data, map } = IMP; const g = (r, c) => map[c] != null ? String(r[map[c]] ?? '').trim() : '';
  const nuevosV = [], ahora = new Date().toISOString(); let n = 0, upd = 0;
  if (tipo === 'clientes') {
    if (map.nombre == null) { toast('Indica la columna del nombre'); return; }
    const out = [];
    for (const r of data) {
      const nombre = g(r, 'nombre'); if (!nombre) continue;
      const codigo = g(r, 'codigo');
      const ex = S.clientes.find(c => codigo ? c.codigo === codigo : norm(c.nombre) === norm(nombre));
      const c = { ...(ex || { id: uid() }), codigo, nombre, actualizado: ahora, dirty: true };
      ['rif', 'telefono', 'email', 'direccion', 'zona', 'notas'].forEach(k => { const v = g(r, k); if (v || !ex) c[k] = v; });
      if (map.vendedor != null) c.vendedorId = vendedorPorNombre(g(r, 'vendedor'), nuevosV);
      const la = num(g(r, 'lat')), lo = num(g(r, 'lng')); if (la != null && lo != null) { c.lat = la; c.lng = lo; } else if (!ex) { c.lat = null; c.lng = null; }
      if (ex) { Object.assign(ex, c); upd++; } else { S.clientes.push(c); n++; }
      out.push(c);
    }
    await DB.putMany('clientes', out);
  } else if (tipo === 'vendedores') {
    for (const r of data) {
      const nombre = g(r, 'nombre'); if (!nombre) continue;
      let v = S.vendedores.find(x => norm(x.nombre) === norm(nombre));
      if (v) upd++; else { v = { id: uid(), nombre }; S.vendedores.push(v); n++; }
      Object.assign(v, { telefono: g(r, 'telefono') || v.telefono || '', email: g(r, 'email') || v.email || '', activo: !/^(no|0|false|inactivo)$/i.test(g(r, 'activo')), dirty: true });
      nuevosV.push(v);
    }
  } else {
    const out = [];
    for (const r of data) {
      const fecha = parseFecha(g(r, 'fecha')); if (!fecha) continue;
      const codigo = g(r, 'codigo'), nombre = g(r, 'nombre');
      let c = S.clientes.find(x => (codigo && x.codigo === codigo) || (nombre && norm(x.nombre) === norm(nombre)));
      if (!c && nombre) { c = { id: uid(), codigo, nombre, actualizado: ahora, dirty: true, lat: null, lng: null }; S.clientes.push(c); await DB.put('clientes', c); }
      if (!c) continue;
      const vid = vendedorPorNombre(g(r, 'vendedor'), nuevosV) || c.vendedorId || S.cfg.perfil;
      const v = { id: uid(), fecha, inicio: fecha, fin: fecha, vendedorId: vid, clienteId: c.id, clienteNombre: c.nombre, clienteCodigo: c.codigo || '', tipo: g(r, 'tipo') || 'Venta', resultado: resultadoDeTexto(g(r, 'resultado')), monto: num(g(r, 'monto')), notas: g(r, 'notas'), proxima: '', fotos: [], fotoUrls: [], lat: num(g(r, 'lat')), lng: num(g(r, 'lng')), precision: null, importada: true, synced: false, actualizado: ahora };
      v.sinGps = v.lat == null; S.visitas.push(v); out.push(v); n++;
    }
    await DB.putMany('visitas', out);
  }
  if (nuevosV.length) await DB.putMany('vendedores', nuevosV);
  IMP = null; cerrarModal(); render();
  toast(`Importación lista: ${n} nuevos, ${upd} actualizados${nuevosV.length && tipo !== 'vendedores' ? `, ${nuevosV.length} vendedores creados` : ''}`, 4000);
  if (apiUrl() && navigator.onLine) sincronizar(true);
}
function plantilla(tipo) {
  const ej = {
    clientes: [{ codigo: 'C001', nombre: 'Ferretería El Tornillo C.A.', rif: 'J-12345678-9', telefono: '0414-1234567', email: 'compras@eltornillo.com', direccion: 'Av. Principal, Local 4', zona: 'Caracas Este', vendedor: 'María Pérez', latitud: '', longitud: '', notas: '' }],
    vendedores: [{ nombre: 'María Pérez', telefono: '0414-1234567', email: 'maria@empresa.com', activo: 'si' }],
    visitas: [{ fecha: '15/10/2026 10:30', codigo: 'C001', cliente: 'Ferretería El Tornillo C.A.', vendedor: 'María Pérez', tipo: 'Venta', resultado: 'Pedido tomado', monto: 350, notas: 'Pidió catálogo de grifería', latitud: '', longitud: '' }]
  }[tipo];
  descargarXLSX(ej, `plantilla_${tipo}.xlsx`, tipo);
}

/* ---------- exportación y respaldo ---------- */
function descargarXLSX(rows, nombre, hoja = 'Datos') {
  if (!window.XLSX) { toast('Se necesita internet para generar Excel'); return; }
  const wb = XLSX.utils.book_new(), ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = Object.keys(rows[0] || {}).map(k => ({ wch: Math.min(40, Math.max(10, k.length + 2, ...rows.slice(0, 50).map(r => String(r[k] ?? '').length))) }));
  XLSX.utils.book_append_sheet(wb, ws, hoja.slice(0, 31)); XLSX.writeFile(wb, nombre);
}
const filaVisita = v => { const c = cliente(v.clienteId); return { Fecha: new Date(v.fecha).toLocaleString('es-VE'), Vendedor: vNombre(v.vendedorId), Código: c?.codigo || v.clienteCodigo || '', Cliente: c?.nombre || v.clienteNombre, Zona: c?.zona || '', Tipo: v.tipo, Resultado: resultadoDe(v.resultado).t, Efectiva: resultadoDe(v.resultado).ef ? 'Sí' : 'No', 'Monto USD': v.monto ?? '', 'Duración min': v.inicio && v.fin ? Math.round((new Date(v.fin) - new Date(v.inicio)) / 60000) : '', 'Próxima visita': v.proxima || '', Notas: v.notas || '', Latitud: v.lat ?? '', Longitud: v.lng ?? '', 'Precisión m': v.precision ?? '', Mapa: v.lat != null ? `https://www.google.com/maps?q=${v.lat},${v.lng}` : '', Fotos: (v.fotoUrls || []).join(' ') || (v.fotos?.length ? v.fotos.length + ' en dispositivo' : '') }; };
function exportVisitas() { const l = S.view === 'visitas' ? filtrarVisitas() : misVisitas().slice().sort((a, b) => b.fecha.localeCompare(a.fecha)); if (!l.length) return toast('No hay visitas para exportar'); descargarXLSX(l.map(filaVisita), `visitas_${hoy()}.xlsx`, 'Visitas'); }
function exportClientes() { const l = misClientes(); if (!l.length) return toast('No hay clientes'); descargarXLSX(l.map(c => { const u = ultimaVisita(c.id); return { codigo: c.codigo, nombre: c.nombre, rif: c.rif, telefono: c.telefono, email: c.email, direccion: c.direccion, zona: c.zona, vendedor: vNombre(c.vendedorId), latitud: c.lat ?? '', longitud: c.lng ?? '', notas: c.notas || '', 'última visita': u ? ymd(u.fecha) : '', 'días sin visita': u ? diasDesde(u.fecha) : '' }; }), `clientes_${hoy()}.xlsx`, 'Clientes'); }
function exportStats() {
  const { l } = datosStats();
  const filas = S.vendedores.map(vd => { const x = l.filter(v => v.vendedorId === vd.id), e = x.filter(v => resultadoDe(v.resultado).ef).length; return { Vendedor: vd.nombre, Visitas: x.length, Efectivas: e, 'Efectividad %': x.length ? Math.round(e / x.length * 100) : 0, Pedidos: x.filter(v => v.resultado === 'pedido').length, 'Monto pedidos': x.filter(v => v.resultado === 'pedido').reduce((a, v) => a + (+v.monto || 0), 0), Cobros: x.filter(v => v.resultado === 'cobro').reduce((a, v) => a + (+v.monto || 0), 0), 'Clientes visitados': new Set(x.map(v => v.clienteId)).size, 'Con GPS %': x.length ? Math.round(x.filter(v => v.lat != null).length / x.length * 100) : 0 }; }).filter(r => r.Visitas);
  if (!filas.length) return toast('Sin datos en el periodo'); descargarXLSX(filas, `resumen_${S.st.rango}d_${hoy()}.xlsx`, 'Resumen');
}
function descargar(blob, nombre) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nombre; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
function backup() { descargar(new Blob([JSON.stringify({ app: 'gestor-visitas', v: 1, fecha: new Date().toISOString(), clientes: S.clientes, vendedores: S.vendedores, visitas: S.visitas }, null, 1)], { type: 'application/json' }), `respaldo_visitas_${hoy()}.json`); }
async function restore(file) {
  try {
    const d = JSON.parse(await file.text()); if (d.app !== 'gestor-visitas') throw new Error('No es un respaldo del Gestor de Visitas');
    if (!confirm(`Restaurar ${d.clientes.length} clientes, ${d.vendedores.length} vendedores y ${d.visitas.length} visitas? Se combinarán con los datos actuales.`)) return;
    await DB.putMany('clientes', d.clientes); await DB.putMany('vendedores', d.vendedores); await DB.putMany('visitas', d.visitas);
    [S.clientes, S.visitas, S.vendedores] = await Promise.all(['clientes', 'visitas', 'vendedores'].map(s => DB.all(s)));
    render(); toast('Respaldo restaurado');
  } catch (e) { toast('Error: ' + e.message, 4000); }
}

/* ---------- sincronización con Apps Script (desarrolloapps.ve) ---------- */
async function api(body) {
  const r = await fetch(apiUrl(), { method: 'POST', body: JSON.stringify({ ...body, clave: apiClave() }) }); // text/plain: sin preflight CORS
  const j = await r.json(); if (!j.ok) throw new Error(j.error || 'Error del servidor'); return j;
}
let sincronizando = false;
async function sincronizar(silencioso) {
  if (sincronizando) return;
  if (!apiUrl()) { if (!silencioso) toast('Falta configurar la conexión (config.js)'); return; }
  if (!navigator.onLine) { if (!silencioso) toast('Sin conexión: se enviará al volver internet'); return; }
  sincronizando = true; $('#btnSync').classList.add('spin');
  try {
    // 1. vendedores y clientes modificados
    const dv = S.vendedores.filter(v => v.dirty), dc = S.clientes.filter(c => c.dirty);
    if (dv.length || dc.length) {
      for (let i = 0; i < Math.max(dc.length, 1); i += 400) await api({ action: 'pushClientes', clientes: dc.slice(i, i + 400).map(limpiarCliente), vendedores: i === 0 ? dv.map(limpiarVendedor) : [] });
      dv.forEach(v => delete v.dirty); dc.forEach(c => delete c.dirty);
      await DB.putMany('vendedores', dv); await DB.putMany('clientes', dc);
    }
    // 2. visitas pendientes (con fotos), en lotes pequeños
    const pend = S.visitas.filter(v => !v.synced);
    for (let i = 0; i < pend.length; i += 3) {
      const lote = pend.slice(i, i + 3);
      const res = await api({ action: 'pushVisitas', visitas: lote.map(v => ({ ...v, vendedor: vNombre(v.vendedorId), fotos: (v.fotos || []).slice(v.fotosSubidas || 0) })) });
      for (const v of lote) { v.synced = true; v.fotosSubidas = (v.fotos || []).length; if (res.fotos && res.fotos[v.id]) v.fotoUrls = res.fotos[v.id]; await DB.put('visitas', v); }
    }
    // 3. descargar datos del equipo
    const j = await api({ action: 'pull', vendedor: esAdmin() ? '' : S.cfg.perfil });
    const remV = (j.vendedores || []).map(v => ({ ...v, activo: !(v.activo === false || v.activo === 'false') }));
    for (const v of remV) { const i = S.vendedores.findIndex(x => x.id === v.id); if (i < 0) S.vendedores.push(v); else if (!S.vendedores[i].dirty) S.vendedores[i] = v; }
    await DB.putMany('vendedores', remV.filter(v => !S.vendedores.find(x => x.id === v.id)?.dirty));
    const remC = (j.clientes || []).map(c => ({ ...c, lat: num(c.lat), lng: num(c.lng), prospecto: c.prospecto === true || c.prospecto === 'true' }));
    const putC = [];
    for (const c of remC) { const i = S.clientes.findIndex(x => x.id === c.id); if (i < 0) { S.clientes.push(c); putC.push(c); } else if (!S.clientes[i].dirty) { S.clientes[i] = c; putC.push(c); } }
    await DB.putMany('clientes', putC);
    const putV = [];
    for (const r of (j.visitas || [])) {
      const v = { ...r, monto: num(r.monto), lat: num(r.lat), lng: num(r.lng), precision: num(r.precision), sinGps: r.sinGps === true || r.sinGps === 'true', fotoUrls: Array.isArray(r.fotoUrls) ? r.fotoUrls : String(r.fotoUrls || '').split(/\s+/).filter(Boolean), synced: true };
      const i = S.visitas.findIndex(x => x.id === v.id);
      if (i < 0) { v.fotos = []; v.fotosSubidas = 0; S.visitas.push(v); putV.push(v); }
      else if (S.visitas[i].synced) { v.fotos = S.visitas[i].fotos || []; v.fotosSubidas = S.visitas[i].fotosSubidas || 0; S.visitas[i] = v; putV.push(v); }
    }
    await DB.putMany('visitas', putV);
    await setCfg('lastSync', Date.now());
    if (!silencioso) toast('Sincronizado ✓');
    if (!$('#modal').hidden) cabecera(); else render();
  } catch (e) {
    console.error(e); if (!silencioso) toast('No se pudo sincronizar: ' + e.message, 4500);
  } finally { sincronizando = false; $('#btnSync').classList.remove('spin'); cabecera(); }
}
const limpiarCliente = c => { const { dirty, ...x } = c; return x; };
const limpiarVendedor = v => { const { dirty, ...x } = v; return x; };
async function publicarCartera() {
  if (!confirm(`Enviar ${S.clientes.length} clientes y ${S.vendedores.length} vendedores a la base compartida?`)) return;
  S.clientes.forEach(c => c.dirty = true); S.vendedores.forEach(v => v.dirty = true);
  await sincronizar(false);
}

/* ---------- modal ---------- */
function abrirModal(html) { $('#modalBody').innerHTML = html; $('#modal').hidden = false; document.body.style.overflow = 'hidden'; }
function cerrarModal() { $('#modal').hidden = true; $('#modalBody').innerHTML = ''; document.body.style.overflow = ''; GPS.stop(); FV = null; }

/* ---------- eventos ---------- */
async function onClick(e) {
  const go = e.target.closest('[data-go]'); if (go) { ir(go.dataset.go); return; }
  const el = e.target.closest('[data-act]'); if (!el) return;
  const a = el.dataset.act, id = el.dataset.id;
  if (el.tagName === 'INPUT' && el.type !== 'checkbox') return; // inputs de archivo se manejan en change
  if (el.tagName === 'INPUT' && el.type === 'checkbox' && a !== 'mapaCli') return;
  switch (a) {
    case 'nueva': e.stopPropagation(); abrirFormVisita({ clienteId: el.dataset.cliente }); break;
    case 'cerrar': cerrarModal(); break;
    case 'verVisita': verVisita(id); break;
    case 'editarVisita': { cerrarModal(); abrirFormVisita({ id }); break; }
    case 'borrarVisita': if (confirm('¿Eliminar esta visita?')) { S.visitas = S.visitas.filter(v => v.id !== id); await DB.del('visitas', id); if (apiUrl()) api({ action: 'borrar', hoja: 'Visitas', id }).catch(() => { }); cerrarModal(); render(); } break;
    case 'res': FV.resultado = el.dataset.k; $$('.chip', el.parentNode).forEach(c => c.classList.toggle('on', c === el)); break;
    case 'regps': iniciarGPS(); break;
    case 'quitarFoto': FV.fotos.splice(+el.dataset.i, 1); pintarFotos(); break;
    case 'zoom': { const lb = $('#lightbox'); $('img', lb).src = el.src; lb.hidden = false; break; }
    case 'guardarVisita': el.disabled = true; try { await guardarVisita(); } finally { el.disabled = false; } break;
    case 'verCliente': verCliente(id); break;
    case 'editarCliente': editarCliente(id); break;
    case 'guardarCliente': guardarCliente(id); break;
    case 'borrarCliente': if (confirm('¿Eliminar este cliente? Sus visitas se conservan.')) { S.clientes = S.clientes.filter(c => c.id !== id); await DB.del('clientes', id); if (apiUrl()) api({ action: 'borrar', hoja: 'Clientes', id }).catch(() => { }); cerrarModal(); render(); } break;
    case 'mapaRango': S.mapa.rango = el.dataset.k; render(); break;
    case 'mapaCli': S.mapa.clientes = el.checked; render(); break;
    case 'stRango': S.st.rango = +el.dataset.k; render(); break;
    case 'sync': sincronizar(false); break;
    case 'publicarCartera': publicarCartera(); break;
    case 'probarApi': try { const j = await api({ action: 'ping' }); toast('Conexión correcta ✓ ' + (j.cuenta || '')); } catch (err) { toast('Error: ' + err.message, 4500); } break;
    case 'admin': if (esAdmin()) { await setCfg('admin', false); render(); } else pedirAdmin(); break;
    case 'validarPin': if ($('#pinIn').value === String(S.cfg.pin || '1234')) { await setCfg('admin', true); cerrarModal(); render(); toast('Modo administrador activo'); } else toast('PIN incorrecto'); break;
    case 'editarVendedor': editarVendedor(id); break;
    case 'guardarVendedor': guardarVendedor(id); break;
    case 'importar': pedirArchivo(el.dataset.tipo); break;
    case 'confirmarImport': confirmarImport(); break;
    case 'plantilla': plantilla(el.dataset.tipo); break;
    case 'exportVisitas': exportVisitas(); break;
    case 'exportClientes': exportClientes(); break;
    case 'exportStats': exportStats(); break;
    case 'backup': backup(); break;
    case 'borrarTodo': if (confirm('Esto borra TODOS los datos guardados en este dispositivo (no en la base compartida). ¿Continuar?')) { if (pendientes() && !confirm(`Hay ${pendientes()} cambios sin enviar que se perderán. ¿Seguro?`)) break; for (const s of ['clientes', 'visitas', 'vendedores']) await DB.clear(s); S.clientes = []; S.visitas = []; S.vendedores = []; render(); } break;
  }
}
let tDeb;
function onInput(e) {
  const t = e.target;
  if (t.dataset.f) { S.f[t.dataset.f] = t.value; clearTimeout(tDeb); tDeb = setTimeout(() => { const l = $('#listaVisitas'); if (l) l.innerHTML = listaVisitasHTML(); }, 150); }
  if (t.dataset.fc) { S.fc[t.dataset.fc] = t.value; clearTimeout(tDeb); tDeb = setTimeout(() => { const l = $('#listaClientes'); if (l) l.innerHTML = listaClientesHTML(); }, 150); }
  if (t.name === 'clienteTxt') infoCliente();
}
async function onChange(e) {
  const t = e.target;
  if (t.dataset.cfg) { let v = t.value; if (t.dataset.cfg === 'metaDiaria') v = Math.max(1, +v || 6); await setCfg(t.dataset.cfg, v); if (t.dataset.cfg === 'tema') aplicarTema(); if (['perfil', 'apiUrl'].includes(t.dataset.cfg)) { render(); if (t.dataset.cfg === 'apiUrl' && v) sincronizar(false); } else cabecera(); toast('Guardado'); }
  if (t.dataset.st) { S.st[t.dataset.st] = t.value; render(); }
  if (t.dataset.imp) { IMP.map[t.dataset.imp] = t.value === '' ? undefined : +t.value; vistaImport(); }
  if (t.name === 'nuevo' && FV) { FV.nuevo = t.checked; $('#nuevoCli').classList.toggle('hide', !t.checked); $('[name=clienteTxt]').disabled = t.checked; infoCliente(); }
  if (t.name === 'clienteTxt') infoCliente();
  if (t.dataset.act === 'foto' && t.files?.length && FV) {
    const files = [...t.files].slice(0, 6 - FV.fotos.length); t.value = '';
    toast('Procesando foto…', 1500);
    for (const f of files) { try { FV.fotos.push(await procesarFoto(f)); } catch (err) { toast(err.message); } }
    pintarFotos();
  }
  if (t.dataset.act === 'restore' && t.files?.[0]) restore(t.files[0]);
}

init().catch(e => { document.body.innerHTML = `<p style="padding:20px">No se pudo iniciar la app: ${esc(e.message)}</p>`; });
