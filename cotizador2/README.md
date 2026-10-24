# Cotizador 2 · Fermetal

Cotizador web de **Fermetal**. Funciona en el celular y en la computadora, sin usuario ni contraseña. Todos los vendedores trabajan sobre la misma base de datos, que vive en Google Sheets.

**Dirección para los usuarios:** https://ijmf1978.github.io/cotizador2/

> Es un **duplicado con datos separados**: tiene su propio servidor, su propia hoja de cálculo y su propia numeración. Nada de lo que se haga aquí aparece en el cotizador principal (https://ijmf1978.github.io/cotizador/).

---

## Archivos de este repositorio

| Archivo | Dónde va | Para qué sirve |
|---|---|---|
| `index.html` | Aquí, en GitHub (repositorio `cotizador2`) | Es la app que abren los vendedores |
| `Code.gs` | En Google Apps Script (cuenta desarrolloapps.ve@gmail.com) | Es el servidor: guarda los datos en la hoja **"Cotizador 2 - Base de datos"** y actualiza la tasa BCV |
| `README.md` | Aquí, en GitHub | Este instructivo |

> `Code.gs` se guarda aquí solo como respaldo. GitHub no lo ejecuta; el que trabaja es la copia pegada en Apps Script.

---

## Qué hace la app

- **Cotizaciones**
  - El número, la fecha y la validez se asignan automáticamente.
  - Hay un historial para buscar, editar o duplicar cotizaciones.
  - Se pueden imprimir, descargar en PDF y enviar por WhatsApp (el PDF o un resumen en texto).
- **Clientes**
  - Se guardan RIF/C.I., contacto, teléfono, email y condición de pago.
  - En la cotización, el cliente se busca escribiendo nombre, RIF, contacto o teléfono.
- **Productos**
  - Se guardan código, descripción, categoría, unidad, precio en USD y tipo de IVA.
  - **El precio no se puede cambiar dentro de la cotización.** Sale siempre del catálogo; para cambiarlo hay que editar el producto en la pestaña *Productos*.
  - No hay descuentos por línea.
- **Precios y tasa**
  - Los precios están en USD, con conversión automática a Bs con la tasa BCV.
  - El IVA (general y reducido) se configura en *Ajustes*.
- **Importar y exportar en Excel:** clientes y productos se cargan desde un archivo `.xlsx`. En la app se pueden descargar las plantillas.
- **Datos compartidos:** cada teléfono revisa cambios cada 45 segundos y solo descarga cuando algo cambió. El nombre del vendedor se pide una vez en cada dispositivo.

---

## Tasa BCV automática (todos los días a las 5:00 a.m.)

- **Cuándo se actualiza:** el servidor (`Code.gs`) consulta la tasa oficial una vez al día, a las 5:00 a.m. hora de Venezuela. Puede tardar hasta 15 minutos por el margen de Google. La tasa se comparte con todo el equipo.
- **De dónde la toma:** de `ve.dolarapi.com`. Si no responde, la toma de `pydolarve.org`.
- **Si falla:**
  - El servidor reintenta cada 30 minutos, hasta 6 veces.
  - Además, si a las 5:00 a.m. no se actualizó, el primer teléfono que abra la app después de esa hora la consulta.
  - Antes de las 5:00 a.m. la app no busca tasa nueva.
- **Tasa manual:** se puede fijar en cualquier momento tocando el indicador **BCV** arriba a la derecha.

---

## Instalación del servidor (una sola vez, desde una computadora)

1. Entra a **script.google.com** con la cuenta **desarrolloapps.ve@gmail.com**.
2. Crea un **Nuevo proyecto**. Borra todo lo que trae el editor (Ctrl+A y Suprimir) y pega **todo** el contenido de `Code.gs`. Guarda.
   - ⚠️ No lo pegues dentro de `function myFunction() { }`. El editor debe quedar solo con el código de `Code.gs`.
3. **Implementar → Nueva implementación →** ⚙️ **Aplicación web**, con esta configuración:
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier persona**
4. Presiona **Implementar** y autoriza los permisos.
5. Copia la URL que termina en `/exec`. Debe coincidir con la que tiene `index.html` en la línea `API_URL`:
   ```
   https://script.google.com/macros/s/AKfycbxkas3BktlxAniSVH1ipYzh7xY5v7XvIk8up-O8U7SWkTTxJT7wMFr9ONT0tyHQK9Q/exec
   ```
6. **Activa la tasa diaria:** en la lista de funciones de arriba elige **`instalarTasaDiaria`** → **▶ Ejecutar** → autoriza.
   - Eso guarda la tasa de inmediato y deja programada la actualización diaria.
   - Para desactivarla, ejecuta `desinstalarTasaDiaria`.

La primera vez que alguien abre la app, el servidor crea solo la hoja **"Cotizador 2 - Base de datos"** en el Drive de esa cuenta.

### Actualizar el servidor más adelante

- **Si solo cambiaste funciones de la tasa:** pega el código nuevo, guarda y vuelve a ejecutar `instalarTasaDiaria`. No hace falta una implementación nueva.
- **Si cambiaste cómo responde la app (`doGet`/`doPost`):** ve a **Implementar → Gestionar implementaciones → ✏️ Editar → Versión: Nueva versión → Implementar**. Así la URL `/exec` no cambia.

---

## Publicar o actualizar la app en GitHub

1. Entra al repositorio **ijmf1978/cotizador2**.
2. **Add file → Upload files**. Arrastra el `index.html` nuevo (reemplaza al anterior) y presiona **Commit changes**.
3. Solo la primera vez: **Settings → Pages →** *Branch:* `main` / `(root)` → **Save**.
4. Espera 1 o 2 minutos y abre https://ijmf1978.github.io/cotizador2/. En el celular, si ves la versión vieja, recarga la página.

> El archivo **debe llamarse exactamente `index.html`** y estar en la raíz del repositorio. Si no, GitHub muestra error 404.

---

## Solución de problemas

| Mensaje o síntoma | Causa probable | Solución |
|---|---|---|
| **"Sin conexión"** con un recuadro amarillo | El servidor no responde bien | Toca el enlace *"el servidor"* que aparece en ese recuadro. Debe mostrar solo el texto **"Servidor del cotizador activo."** |
| El enlace del servidor pide iniciar sesión | El acceso no está en "Cualquier persona" | Edita la implementación y elige **Cualquier persona** |
| *"Script function not found: doGet"* | El código quedó dentro de `myFunction` o el editor no estaba vacío | Borra todo, pega `Code.gs` completo y crea una versión nueva |
| Error 404 en GitHub | Falta `index.html` en la raíz o Pages no está activo | Revisa los pasos de *Publicar en GitHub* |
| La tasa no se actualizó | No se ejecutó `instalarTasaDiaria` o las fuentes no respondieron | En Apps Script, ejecuta `tasaDiaria` y revisa el **Registro de ejecución**. También puedes fijarla a mano con el indicador **BCV** |
| El PDF sale cortado | Versión vieja de `index.html` | Sube el `index.html` más reciente |

---

## Datos técnicos

- **App:** un solo archivo HTML/JS, sin instalación.
  - Librerías desde cdnjs: SheetJS (Excel) y html2pdf (PDF).
  - Guarda en `localStorage` con el prefijo `cotizador2_`, solo como caché, el nombre del vendedor y preferencias.
- **Servidor:** Google Apps Script con Google Sheets.
  - Los cambios se escriben con bloqueo (`LockService`) y la numeración la asigna el servidor, así que no hay números repetidos.
  - Hay una versión de datos (`rev`) para que los teléfonos solo descarguen cuando algo cambió.

---

## Fotos de productos

El Cotizador 2 usa la **misma base de fotos del cotizador principal**: la lee de `https://ijmf1978.github.io/cotizador/fotos-index.json`. No hace falta subir las fotos a este repositorio; basta con que estén en el repositorio `cotizador`.

La foto se muestra en el editor, en *Productos* y en la cotización (vista, PDF, impresión y WhatsApp). Para no mostrarla en la cotización: **Ajustes →** desmarcar "Mostrar la foto de cada producto".
