# WorshipDeck

> Suite local-first de presentación y gestión litúrgica para iglesias que convierte el programa de culto en diapositivas listas para proyectar: genera presentaciones PowerPoint (.pptx) sin conexión con fuentes incrustadas, consola de operador para proyector de dos pantallas y control remoto para smartphones mediante Wi-Fi local.

[English](README.md) | [Bahasa Indonesia](README.id.md) | [简体中文](README.zh-CN.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md) | [Deutsch](README.de.md) | [Français](README.fr.md) | [Português (Brasil)](README.pt-BR.md) | [Русский](README.ru.md)  
[Website](https://wiradelta.id/worship-deck) | [Download for Windows](https://github.com/wiradeltaid/worship-deck/releases) | [Changelog](CHANGELOG.md) | [Contributing](CONTRIBUTING.md) | [License](LICENSE) | [Security](SECURITY.md) | [Privacy](PRIVACY.md) | [Attributions](ATTRIBUTIONS.md)

---

> **Aviso de traducción:** Este archivo es una traducción de [README.md](README.md) sólo para fines de conveniencia. En caso de discrepancia o conflicto de interpretación, la versión oficial en inglés (`README.md`) prevalece como autorizada. Toda la documentación técnica profunda y los documentos legales se mantienen en inglés.

Diseñado para congregaciones cristianas e iglesias litúrgicas. Las plantillas se gestionan como datos configurables y no como código estático, lo que permite a cualquier iglesia con un orden litúrgico similar adaptarlo directamente desde el navegador.

## Problema que Resuelve

Preparar manualmente las diapositivas de cada servicio lleva entre 2 y 4 horas semanales, gran parte de las cuales se desperdician en volver a escribir letras de himnos ya digitalizadas anteriormente. Un cambio imprevisto de canciones obliga a rehacer la presentación desde cero, y los conocimientos técnicos suelen depender de un único voluntario.

WorshipDeck toma el guión del culto preparado por los líderes (copiado en un formulario o enviado vía bot de mensajería) y estructura automáticamente diapositivas limpias y consistentes.

```text
texto del programa  →  análisis del culto  →  plan de diapositivas  →  ┬→  PowerPoint (.pptx) sin conexión
                                                                       ├→  presentación web a pantalla completa
                                                                       └→  consola de operador + proyector
```

Las letras de los himnos se consultan directamente por número en la base de datos local. Las plantillas visuales se editan en el navegador a través de un registro SQLite. Una vez descargado el archivo PowerPoint, la proyección no requiere conexión a Internet, lo que garantiza un culto sin interrupciones incluso ante fallas de red en el templo.

## Características Principales

- **Ingesta automática del programa de culto:** Pegue texto plano o envíelo vía webhook autenticado. Las líneas no reconocidas se muestran con total transparencia.
- **División automática de estrofas y coros:** Los himnos referenciados por número se desglosan en título, estrofas y coros repetitivos para facilitar el canto de la congregación.
- **Editor visual de plantillas (WYSIWYG):** 38 plantillas integradas con manipulación en lienzo: arrastre, redimensione, personalice tipografías y agregue elementos gráficos.
- **Un diseño para cuatro salidas (16:9 panorámico):** Una única estructura de datos alimenta presentaciones PPTX, visualización web, proyector de congregación y vista previa en vivo en proporción 1:1.
- **Modo operador de dos pantallas:** Vista de diapositiva actual y siguiente, tira de fotogramas en miniatura, lista de servicio y ventana independiente para arrastrar al proyector.
- **Función de pantalla en negro (Blank Screen):** Oculte instantáneamente la imagen del proyector y recupérela sin perder el punto de avance (`B`).
- **Transiciones configurables:** Corte, fundido, disolución y desplazamiento aplicados de forma idéntica en web y PowerPoint.
- **Consulta inmediata de pasajes bíblicos:** Proyecte lecturas bíblicas (KJV) durante la predicación y retírelas al instante.
- **Gestión de anuncios:** Administración de volantes y afiches desde almacenamiento local o URLs autorizadas.
- **Incrustación de fuentes personalizadas:** Incrustación ECMA-376 para renderizado fiel en cualquier equipo con Microsoft PowerPoint.
- **Cuentas y roles:** Separación entre administradores y operadores, limitación de intentos de acceso y sesiones revocables.
- **Parser de programas y diseño de formulario configurables:** Cree perfiles de análisis con nombre y organice los campos/agrupaciones del formulario de Servicio desde el panel de administración, sin tocar código.
- **Biblioteca de medios:** Un conjunto reutilizable de imágenes de fondo y volantes, independiente de cualquier plantilla.
- **Sincronización manual entre dispositivos** *(experimental — aún no verificada entre dos máquinas reales)*: Envíe y reciba Servicios, entradas de Song Set, fondos y anuncios entre dos instancias de WorshipDeck en la misma red local, bajo demanda. Sin nube, sin sincronización en segundo plano.

## Requisitos del Sistema

- **Aplicación de Escritorio:** Windows 10/11 de 64 bits.
- **Compilación desde el Código Fuente:** Go 1.24+ y Node.js 22+. Utiliza SQLite embebido sin necesidad de configurar servidores de bases de datos externos.

## Instalación

### Instalador de Escritorio para Windows (Recomendado)

Descargue `WorshipDeckSetup.exe` desde la [página oficial de lanzamientos](https://github.com/wiradeltaid/worship-deck/releases) y complete el asistente de instalación.

> **Nota sobre Windows SmartScreen:** Dado que esta compilación aún no cuenta con un certificado de firma de código EV comercial de alto costo, Windows SmartScreen puede mostrar una advertencia. Haga clic en **"Más información"** y luego en **"Ejecutar de todas formas"**.

### Ejecución desde el Código Fuente

```bash
git clone https://github.com/wiradeltaid/worship-deck.git
cd worship-deck
npm install
npm run setup
npm run dev
```

`npm run setup` genera el archivo `.env`, inicializa la base de datos SQLite, registra las plantillas por defecto e imprime la contraseña inicial del administrador. `npm run dev` inicia la API de Go en <http://localhost:3000> y el SPA de React en <http://localhost:5173> (Vite redirige `/api` a Go). Inicie sesión como `admin` en el SPA. Para un solo origen: `npm run spa:build && npm start` y abra el puerto 3000. Volver a ejecutar `setup` es seguro: nunca sobrescribe un `.env` o una base de datos existentes.

Lea [`.constitution/project/private-data.md`](.constitution/project/private-data.md) antes de introducir los datos de su propia congregación.

### Crear un servicio

**Servicios → Nuevo.** Pegue un programa de culto en el cuadro de texto sin formato. La forma que se espera es la siguiente (nombres sintéticos):

```text
SABBATH, MARCH 14, 2026

BIBLE TALK (09.30-10.50 /80 min)
》welcome remarks: Mrs. Lestari
Song Leader : Ms. Ayu
[  ] Opening song : SDAH #159 The Old Rugged Cross
Memory Verse & Opening Prayer : Mr. Bagas
Closing Prayer : Mr. Damar (1m)

DIVINE SERVICE (10.50- 12.05/ 75 min)
Song Leader : Ms. Kirana
[  ] Opening Song : SDAH #83 O Worship the King
Intercessory Prayer: Mr. Farid (5m)
Sermon : Pr. Andi Hartono "Working Out" (45m)
[  ] Closing Song : SDAH #249 Praise Him! Praise Him!
```

Pulse **Analizar**. Los roles, los tiempos y los números de himno se extraen al formulario; los himnos se resuelven a títulos desde el corpus local. Todo lo que el analizador no pudo ubicar se muestra en una lista en lugar de descartarse.

Complete el volante del sermón y las fotos familiares/juveniles si las tiene, y luego guarde.

### Presentarlo

Desde la página del servicio:

- **Descargar PPTX** — el paquete offline. Este es el que mantiene el culto en marcha si la red, el portátil o el hub le fallan.
- **Presentar** — la consola del operador. Diapositiva actual y siguiente, tira de fotogramas, lista de diapositivas y **Todas las diapositivas** para saltar a cualquier parte.
- **Abrir proyector** — una ventana separada para arrastrar a la segunda pantalla. Las teclas de flecha avanzan ambas. `B` oculta el proyector y lo restaura.

### Extras opcionales

**Consulta de las Escrituras.** El modo presentador puede colocar un pasaje KJV en el proyector. El corpus se distribuye en `data/en/bible-translation/kjv.json` y se concilia a partir de ese archivo en cada arranque.

**Ingesta por chat.** `POST /api/webhook` con un encabezado `x-webhook-secret` acepta un programa de culto como JSON, para que un bot pueda crear o corregir un servicio. El secreto vive en `.env`; el endpoint está protegido solo por él, nunca por una sesión.

### Solución de problemas

**`Missing song book corpus`** — falta `data/song-book/sdah.json`. Se distribuye con el repositorio, así que restáurelo desde el control de versiones: `git checkout -- data/song-book/sdah.json`. Luego ejecute `npm run corpus:verify` para confirmar que ambos corpus están completos.

**Bloqueado** — `npm run auth:set-password -- admin` establece una nueva contraseña desde un prompt interactivo. `npm run auth:unlock -- --list` muestra y borra la limitación de intentos de acceso.

**Faltan imágenes en el paquete** — las imágenes remotas deben pasar las reglas de seguridad de URL. Subir la imagen al hub siempre funciona.

## Cómo personalizarlo

El registro distribuido es un ejemplo de trabajo — un orden de culto real con datos de contacto y pago ficticios. Dos cosas para cambiar:

1. **Plantillas de diapositivas.** Inicie sesión como administrador y abra `/admin/artifacts`. Cada plantilla es editable en un lienzo; las diapositivas fijas (ofrenda, oración de miércoles, contacto) son donde van sus propios datos.
2. **Anulaciones privadas.** Si prefiere mantener el registro de su congregación completamente fuera de git, colóquelo en `data/local/default-registry.json` y la aplicación sembrará desde ahí en su lugar. Esa ruta está ignorada por git. Vea [`.constitution/project/private-data.md`](.constitution/project/private-data.md).

## Corpus incluidos

Se distribuyen dos corpus predeterminados, de modo que un clon resuelve un número de himno y una referencia bíblica sin ningún archivo entregado y sin red al arrancar:

| Archivo | Contiene | Al arrancar |
| --- | --- | --- |
| `data/song-book/sdah.json` | 695 himnos del Himnario Adventista del Séptimo Día | título y letra reaplicados desde el archivo |
| `data/en/bible-translation/kjv.json` | 66 libros, 1189 capítulos, 31102 versículos KJV | conciliado desde el archivo confirmado en cada arranque (~130–150 ms medidos) |

`npm run corpus:verify` confirma que ambos están completos. Ninguno tiene generador: los volcados de los que se convirtieron ya no existen, así que estos archivos son la fuente de registro — restaure desde el control de versiones en lugar de reconstruir.

Lea [ATTRIBUTIONS.md](ATTRIBUTIONS.md) — nombra a los titulares de derechos de autor, indica el propósito congregacional sin fines de lucro y da un contacto para solicitudes de eliminación. Cada corpus también lleva su propio texto de licencia dentro del archivo.

Si está adaptando esto para un himnario diferente, agregue su corpus en `data/song-book/<book-code>.json` con la misma forma. Los himnos se indexan por `(book_code, number)`, así que un segundo libro se coloca junto al distribuido en lugar de reemplazarlo.

## Despliegue

Compile la API de Go y el SPA, ejecute `./api` (o `npm start`) en un host con Node 22 en `PATH` para el worker de PPTX — vea [`.constitution/project/deployment.md`](.constitution/project/deployment.md). SQLite, las imágenes subidas y la caché del paquete necesitan rutas de host duraderas; ese archivo cubre cuáles.

## Historia del proyecto

Este proyecto comenzó como un repositorio privado para una sola congregación. Esa historia no se traslada aquí, porque contenía nombres reales de miembros, fotografías de personas identificables incluyendo menores, capturas de pantalla de mensajes privados y un código de pago en vivo — nada de lo cual pertenecía a un repositorio público, y nada de lo cual puede des-publicarse una vez indexado.

Este repositorio, por lo tanto, comienza desde un único commit inicial con una congregación de ejemplo sintética. Por qué el sistema tiene la forma que tiene vive en `.what/` y `.how/` (DEC-001).

Colaboradores: lean [`.constitution/project/private-data.md`](.constitution/project/private-data.md) antes de su primer commit. Hay una prueba que falla si datos de congregación llegan a un archivo rastreado, y está ahí por una razón.

## Licencia y Marca Registrada

- **Licencia de Código:** Distribuido bajo la [Licencia MIT](LICENSE).
- **Atribuciones y Contenidos:** Himnarios, versiones bíblicas y componentes de terceros están detallados en [ATTRIBUTIONS.md](ATTRIBUTIONS.md).
- **Privacidad y Seguridad:** Sin backend en la nube y cero telemetría — cada solicitud permanece en su equipo o en la red local de su iglesia. La única función que se comunica con otro host es la Sincronización Manual, y ese host es otra instancia de WorshipDeck que usted mismo ejecuta, alcanzada solo cuando un operador la activa (consulte [PRIVACY.md](PRIVACY.md) y [SECURITY.md](SECURITY.md)).
- **Nombre e Icono:** La licencia MIT concede derechos sobre el código fuente, no sobre los nombres ni logotipos. Los nombres **WorshipDeck** y **Wira Delta Indonesia**, así como el icono del producto, son propiedad exclusiva de PT Wira Delta Indonesia.
