// ==========================================================
//  CONFIGURACIÓN GLOBAL DEL GESTOR DE VISITAS
//  Pega aquí la URL de la aplicación web de Apps Script
//  desplegada con la cuenta desarrolloapps.ve@gmail.com
//  (termina en /exec). Así todos los vendedores quedan
//  conectados a la misma base de datos sin configurar nada.
// ==========================================================
window.GV_CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbwXDK-zTZ91KIshAe_9i1pAoTArB1VjF7UZEeynO35tLs6ibrFRpHHesOKhHJgKCfY-fA/exec',
  CLAVE: '',              // opcional: misma CLAVE_API definida en Code.gs
  EMPRESA: 'Fermetal',    // nombre que aparece en la cabecera
  META_DIARIA: 6          // visitas por día por vendedor (valor por defecto)
};
