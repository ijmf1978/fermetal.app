# Aplicaciones Fermetal

Portal web con las aplicaciones comerciales del equipo y la nueva app **Gestor de Visitas**.

```
├── index.html              ← Portal (lista de aplicaciones con botón Abrir, QR y copiar enlace)
├── apps.json               ← Aplicaciones que muestra el portal (edítalo para agregar/quitar)
├── visitas/                ← Gestor de Visitas (PWA instalable en el celular)
│   ├── index.html · app.js · styles.css · sw.js · manifest.webmanifest · icon.svg
│   └── config.js           ← AQUÍ va la URL del backend (Apps Script de desarrolloapps.ve)
├── backend/Code.gs         ← Backend en Google Apps Script (NO se publica, se pega en script.google.com)
└── plantillas/             ← Ejemplos CSV para importar clientes, vendedores y visitas
```

---

## 1. Base de datos en la cuenta desarrolloapps.ve@gmail.com

Igual que el cotizador y el CRM, los datos viven en el Drive de **desarrolloapps.ve@gmail.com**:

- `apps fermetal / app visitas / Gestor de Visitas - Base de datos` (Google Sheets: hojas Vendedores, Clientes, Visitas)
- `apps fermetal / app visitas / Fotos de visitas / AAAA-MM /` (fotos de evidencia, una carpeta por mes)

Pasos (una sola vez, **con la sesión de desarrolloapps.ve@gmail.com abierta**):

1. Entra a <https://script.google.com> → **Nuevo proyecto**. Nómbralo “Gestor de Visitas API”.
2. Borra el contenido y pega todo `backend/Code.gs`. Guarda.
3. En la barra superior elige la función **instalar** → **Ejecutar** → autoriza los permisos (Drive y Hojas de cálculo).
   Crea la hoja de cálculo y las carpetas automáticamente.
4. **Implementar → Nueva implementación** → tipo **Aplicación web**:
   - Ejecutar como: **Yo (desarrolloapps.ve@gmail.com)**
   - Quién tiene acceso: **Cualquier usuario**
5. Copia la **URL de la aplicación web** (termina en `/exec`).
6. Abre `visitas/config.js` y pégala en `API_URL`. (Opcional: define una `CLAVE_API` en Code.gs y la misma en `CLAVE`.)

> Al modificar `Code.gs` más adelante: **Implementar → Administrar implementaciones → editar (lápiz) → Versión: Nueva** para conservar la misma URL.

## 2. Publicar en GitHub Pages

Recomendado: repositorio **`ijmf1978.github.io`** → el portal queda en `https://ijmf1978.github.io/` y el gestor en `https://ijmf1978.github.io/visitas/`.
Los repos `cotizador`, `cotizador2` y `crm` siguen funcionando en sus rutas de siempre.

1. <https://github.com/new> → nombre `ijmf1978.github.io` → Público → Create.
2. **Add file → Upload files** → arrastra **todo el contenido** de esta carpeta (incluye las carpetas `visitas`, `backend`, `plantillas`) → Commit.
3. **Settings → Pages** → Source: *Deploy from a branch* → rama `main`, carpeta `/ (root)` → Save.
4. En 1–2 minutos: `https://ijmf1978.github.io/`.

(Si prefieres otro nombre de repo, p. ej. `apps`, todo funciona igual en `https://ijmf1978.github.io/apps/`.)

## 3. Primer uso del Gestor de Visitas

1. Abre `/visitas/` → **Configuración** → **Modo administrador** (PIN inicial `1234`, cámbialo).
2. **Importar información** → *Clientes* (Excel o CSV). Las columnas se detectan solas: código, nombre, RIF, teléfono, email,
   dirección, zona, vendedor, latitud, longitud, notas. Los vendedores se crean automáticamente desde la columna “vendedor”.
   También puedes importar *Vendedores* y *Visitas históricas*. Descarga las plantillas desde la misma pantalla.
3. **Publicar cartera completa** → sube clientes y vendedores a la base compartida.
4. Cada vendedor abre el enlace en su celular, lo **agrega a la pantalla de inicio**, y en Configuración elige su nombre.
   Solo verá sus clientes y sus visitas.

## Funciones

| | |
|---|---|
| **Visita con GPS** | Al tocar *Nueva visita* se captura la ubicación automáticamente (afina hasta ±15 m) y se muestra la distancia al cliente. Si el cliente no tiene coordenadas, la primera visita las guarda. |
| **Fotos de evidencia** | Cámara o galería, hasta 6 por visita. Cada foto lleva un sello con fecha, hora, cliente, coordenadas y vendedor. Se comprimen (~150 KB) y se guardan en Drive. |
| **Sin internet** | Todo se guarda en el teléfono y se envía solo al recuperar señal (indicador en la cabecera). |
| **Estadísticas** | Visitas por día, efectividad, pedidos, cobranza, cobertura de cartera, duración promedio, % con GPS y con foto, visitas por hora y ranking de vendedores. |
| **Mapa** | Visitas del día/7/30 días por color de resultado y clientes georreferenciados con “Cómo llegar”. |
| **Control** | Meta diaria, próximas visitas programadas, clientes sin visita en +30 días, historial por cliente, WhatsApp y llamada directa. |
| **Exportar** | Visitas, clientes y resumen por vendedor a Excel; respaldo completo en JSON. |

## Notas importantes

- El GPS y la cámara requieren **https** (GitHub Pages ya lo es). El navegador pedirá permiso la primera vez.
- El PIN de administrador controla el uso diario pero no es seguridad de servidor. Para proteger la API usa `CLAVE_API`.
- Las fotos en Drive quedan con “cualquiera con el enlace puede ver” para poder verlas desde la app.
- Para agregar o cambiar apps del portal, edita `apps.json` (nombre, descripción, url, color, icono: `pin`, `doc`, `users`, `chart`, `box`).
