// ==========================================================
//  CONFIGURACIÓN GLOBAL DEL GESTOR DE VISITAS
//  Pega aquí la URL de la aplicación web de Apps Script
//  desplegada con la cuenta desarrolloapps.ve@gmail.com
//  (termina en /exec). Así todos los vendedores quedan
//  conectados a la misma base de datos sin configurar nada.
// ==========================================================
window.GV_CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbzddNU9Z-5GA0CmCIV1y5ruZSPu9qhf7OnO354gQbUIqNgz-Ps9Ri8FwfqD8YVfqi4/exec',
  CLAVE: '',              // opcional: misma CLAVE_API definida en Code.gs
  EMPRESA: 'Fermetal',    // nombre que aparece en la cabecera
  META_DIARIA: 12         // visitas por día por vendedor (valor por defecto)
};
