/**
 * GESTOR DE VISITAS — Backend en Google Apps Script
 * Cuenta: desarrolloapps.ve@gmail.com (la misma de los datos del cotizador y el CRM)
 *
 * Guarda:
 *   - Base de datos:  Drive > apps fermetal > app visitas > "Gestor de Visitas - Base de datos" (Google Sheets)
 *   - Fotos:          Drive > apps fermetal > app visitas > Fotos de visitas > AAAA-MM
 *
 * Instalación (una sola vez, con la sesión de desarrolloapps.ve@gmail.com):
 *   1. https://script.google.com > Nuevo proyecto > pega este archivo completo.
 *   2. Ejecuta la función  instalar  (autoriza los permisos que pida).
 *   3. Implementar > Nueva implementación > Tipo: Aplicación web
 *        Ejecutar como: Yo (desarrolloapps.ve@gmail.com)
 *        Quién tiene acceso: Cualquier usuario
 *   4. Copia la URL que termina en /exec y pégala en visitas/config.js (API_URL).
 */

const CLAVE_API = '';                 // opcional: si pones una clave aquí, ponla también en config.js
const CARPETA_RAIZ = 'apps fermetal';
const CARPETA_APP = 'app visitas';
const NOMBRE_HOJA = 'Gestor de Visitas - Base de datos';
const DIAS_HISTORIAL = 180;           // visitas que se descargan a los teléfonos

const HOJAS = {
  Vendedores: ['id', 'nombre', 'telefono', 'email', 'activo'],
  Clientes: ['id', 'codigo', 'nombre', 'rif', 'telefono', 'email', 'direccion', 'zona', 'vendedorId', 'lat', 'lng', 'notas', 'prospecto', 'actualizado'],
  Visitas: ['id', 'fecha', 'vendedorId', 'vendedor', 'clienteId', 'clienteCodigo', 'clienteNombre', 'tipo', 'resultado', 'monto', 'notas', 'proxima',
    'lat', 'lng', 'precision', 'sinGps', 'inicio', 'fin', 'fotoUrls', 'mapa', 'actualizado', 'recibido']
};

/* ---------------- instalación ---------------- */
function instalar() {
  const ss = libro_();
  Object.keys(HOJAS).forEach(hoja_);
  const def = ss.getSheetByName('Hoja 1') || ss.getSheetByName('Sheet1');
  if (def && ss.getSheets().length > 1) ss.deleteSheet(def);
  carpetaFotos_();
  Logger.log('Listo. Base de datos: ' + ss.getUrl());
  Logger.log('Ahora: Implementar > Nueva implementación > Aplicación web (acceso: Cualquier usuario).');
}

function carpeta_(padre, nombre) {
  const it = padre ? padre.getFoldersByName(nombre) : DriveApp.getFoldersByName(nombre);
  return it.hasNext() ? it.next() : (padre || DriveApp.getRootFolder()).createFolder(nombre);
}
function carpetaApp_() { return carpeta_(carpeta_(null, CARPETA_RAIZ), CARPETA_APP); }
function carpetaFotos_() {
  const p = PropertiesService.getScriptProperties(), id = p.getProperty('FOTOS_ID');
  if (id) try { return DriveApp.getFolderById(id); } catch (e) { }
  const f = carpeta_(carpetaApp_(), 'Fotos de visitas'); p.setProperty('FOTOS_ID', f.getId()); return f;
}
function libro_() {
  const p = PropertiesService.getScriptProperties(), id = p.getProperty('SHEET_ID');
  if (id) try { return SpreadsheetApp.openById(id); } catch (e) { }
  const ss = SpreadsheetApp.create(NOMBRE_HOJA);
  const file = DriveApp.getFileById(ss.getId());
  carpetaApp_().addFile(file); DriveApp.getRootFolder().removeFile(file);
  p.setProperty('SHEET_ID', ss.getId());
  return ss;
}
function hoja_(nombre) {
  const ss = libro_(); let sh = ss.getSheetByName(nombre);
  if (!sh) {
    sh = ss.insertSheet(nombre);
    const cols = HOJAS[nombre];
    sh.getRange(1, 1, sh.getMaxRows(), cols.length).setNumberFormat('@'); // texto: conserva códigos con ceros, fechas ISO, etc.
    sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold').setBackground('#0f766e').setFontColor('#ffffff');
    sh.setFrozenRows(1);
  }
  return sh;
}

/* ---------------- lectura / escritura ---------------- */
function leer_(nombre) {
  const sh = hoja_(nombre), v = sh.getDataRange().getValues(), h = v.shift();
  return v.filter(r => r[0] !== '').map(r => {
    const o = {}; h.forEach((k, i) => { const x = r[i]; o[k] = x instanceof Date ? x.toISOString() : x; }); return o;
  });
}
function valor_(x) { if (x === undefined || x === null) return ''; if (Array.isArray(x)) return x.join(' '); if (typeof x === 'object') return JSON.stringify(x); return String(x); }
function upsert_(nombre, objs) {
  if (!objs || !objs.length) return;
  const sh = hoja_(nombre), cols = HOJAS[nombre], data = sh.getDataRange().getValues(), idx = {};
  for (let i = 1; i < data.length; i++) idx[data[i][0]] = i + 1;
  const nuevos = [];
  objs.forEach(o => {
    if (!o || !o.id) return;
    const row = cols.map(c => valor_(o[c]));
    if (idx[o.id]) sh.getRange(idx[o.id], 1, 1, cols.length).setValues([row]);
    else { nuevos.push(row); idx[o.id] = -1; }
  });
  if (nuevos.length) sh.getRange(sh.getLastRow() + 1, 1, nuevos.length, cols.length).setNumberFormat('@').setValues(nuevos);
}
function borrar_(nombre, id) {
  const sh = hoja_(nombre), ids = sh.getRange(1, 1, sh.getLastRow(), 1).getValues();
  for (let i = ids.length - 1; i >= 1; i--) if (ids[i][0] === id) sh.deleteRow(i + 1);
}

/* ---------------- acciones ---------------- */
function pull_(d) {
  let clientes = leer_('Clientes'), visitas = leer_('Visitas');
  const desde = new Date(Date.now() - DIAS_HISTORIAL * 864e5).toISOString();
  visitas = visitas.filter(v => String(v.fecha) >= desde);
  if (d.vendedor) {
    clientes = clientes.filter(c => !c.vendedorId || c.vendedorId === d.vendedor);
    visitas = visitas.filter(v => v.vendedorId === d.vendedor);
  }
  visitas.forEach(v => { v.fotoUrls = String(v.fotoUrls || '').split(/\s+/).filter(String); delete v.mapa; delete v.recibido; });
  return { ok: true, vendedores: leer_('Vendedores'), clientes: clientes, visitas: visitas };
}

function pushVisitas_(lista) {
  const existentes = {}; leer_('Visitas').forEach(v => existentes[v.id] = String(v.fotoUrls || '').split(/\s+/).filter(String));
  const raiz = carpetaFotos_(), fotos = {}, filas = [];
  lista.forEach(v => {
    const urls = (existentes[v.id] && existentes[v.id].length ? existentes[v.id] : (v.fotoUrls || [])).slice();
    const mes = String(v.fecha || new Date().toISOString()).slice(0, 7);
    const carpeta = (v.fotos && v.fotos.length) ? carpeta_(raiz, mes) : null;
    (v.fotos || []).forEach(src => {
      const m = String(src).match(/^data:(image\/\w+);base64,(.+)$/); if (!m) return;
      const nombre = [String(v.fecha).slice(0, 10), (v.clienteCodigo || v.clienteNombre || 'cliente').replace(/[^\w\- ]/g, ''), (v.vendedor || ''), v.id, urls.length + 1].join('_') + '.jpg';
      const file = carpeta.createFile(Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], nombre));
      try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) { }
      urls.push('https://drive.google.com/file/d/' + file.getId() + '/view');
    });
    fotos[v.id] = urls;
    filas.push(Object.assign({}, v, {
      fotoUrls: urls, recibido: new Date().toISOString(),
      mapa: v.lat !== null && v.lat !== '' && v.lat !== undefined ? 'https://www.google.com/maps?q=' + v.lat + ',' + v.lng : ''
    }));
  });
  upsert_('Visitas', filas);
  return { ok: true, fotos: fotos };
}

/* ---------------- web app ---------------- */
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function doGet() { return json_({ ok: true, app: 'gestor-visitas', version: 1 }); }

function doPost(e) {
  let d;
  try { d = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'Solicitud inválida' }); }
  if (CLAVE_API && d.clave !== CLAVE_API) return json_({ ok: false, error: 'Clave API incorrecta' });
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    switch (d.action) {
      case 'ping': return json_({ ok: true, cuenta: Session.getEffectiveUser().getEmail(), hoja: libro_().getUrl() });
      case 'pull': return json_(pull_(d));
      case 'pushVisitas': return json_(pushVisitas_(d.visitas || []));
      case 'pushClientes':
        upsert_('Vendedores', d.vendedores || []);
        upsert_('Clientes', d.clientes || []);
        return json_({ ok: true });
      case 'borrar':
        if (['Visitas', 'Clientes', 'Vendedores'].indexOf(d.hoja) < 0) throw new Error('Hoja no válida');
        borrar_(d.hoja, d.id); return json_({ ok: true });
      default: return json_({ ok: false, error: 'Acción desconocida: ' + d.action });
    }
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  } finally { try { lock.releaseLock(); } catch (e) { } }
}
