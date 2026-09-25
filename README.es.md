# WorshipDeck

> Suite local-first de presentación y gestión litúrgica para iglesias que convierte el programa de culto en diapositivas listas para proyectar: genera presentaciones PowerPoint (.pptx) con fuentes incrustadas para uso sin conexión, consola de operador para la pantalla de la congregación y control remoto para smartphones mediante Wi-Fi local.

[English](README.md) | [Bahasa Indonesia](README.id.md) | [简体中文](README.zh-CN.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md) | [Deutsch](README.de.md) | [Français](README.fr.md) | [Português (Brasil)](README.pt-BR.md) | [Русский](README.ru.md)  
[Website](https://wiradelta.id/worship-deck) | [Download for Windows](https://github.com/wiradeltaid/worship-deck/releases) | [Changelog](CHANGELOG.md) | [Contributing](CONTRIBUTING.md) | [License](LICENSE) | [Security](SECURITY.md) | [Privacy](PRIVACY.md) | [Attributions](ATTRIBUTIONS.md)

---

> **Aviso de traducción:** Este archivo es una traducción de [README.md](README.md) sólo para fines de conveniencia. En caso de discrepancia o conflicto de interpretación, la versión oficial en inglés (`README.md`) prevalece como autorizada. Toda la documentación técnica profunda y los documentos legales se mantienen en inglés.

Diseñado para congregaciones cristianas e iglesias litúrgicas. Los diseños de diapositiva se gestionan como datos configurables y no como código estático, lo que permite a cualquier iglesia con un orden litúrgico similar adaptarlo directamente desde el navegador.

## Problema que Resuelve

Preparar manualmente las diapositivas de cada servicio lleva entre 2 y 4 horas semanales, gran parte de las cuales se desperdician en volver a escribir letras de himnos ya digitalizadas anteriormente. Un cambio imprevisto de canciones obliga a rehacer la presentación desde cero, y los conocimientos técnicos suelen depender de un único voluntario.

WorshipDeck toma el guión del culto preparado por los líderes desde un mensaje de chat o un formulario y estructura automáticamente diapositivas limpias y consistentes.

```text
texto del programa  ->  análisis del culto  ->  plan de diapositivas  ->  +->  PowerPoint (.pptx) sin conexión
                                                                          +->  presentación web a pantalla completa
                                                                          +->  consola de operador + pantalla de congregación
```

Las letras de los himnos se consultan directamente por número en la base de datos local. Los diseños se editan en el navegador a través de un registro SQLite. Una vez descargado el archivo PowerPoint, la proyección no requiere conexión a Internet, lo que garantiza un culto sin interrupciones incluso ante fallas de red en el templo.

## Características Principales

- **Ingesta automática del programa de culto:** Pegue texto plano en el formulario web. Las líneas no reconocidas se muestran con total transparencia. (La recepción mediante webhook estará disponible en una próxima versión.)
- **División automática de estrofas y coros:** Los himnos referenciados por número se desglosan en título, estrofas y coros repetitivos para facilitar el canto de la congregación.
- **Diseños de diapositiva editables:** Administre diseños en un registro SQLite con editor en lienzo para navegador. Mueva, redimensione y aplique estilos a elementos, agregue formas o importe diseños desde PowerPoint. Un conjunto opcional de 38 diseños de muestra está disponible mediante inicialización de demostración.
- **Un diseño para cuatro salidas:** Una única estructura de datos alimenta presentaciones PPTX, visualización web, pantalla de congregación y vista previa en vivo en proporción panorámica 16:9.
- **Modo operador de dos pantallas:** Vista de diapositiva actual y siguiente, tira de fotogramas en miniatura, lista de servicio, cuadrícula de salto rápido y ventana independiente para la pantalla de la congregación.
- **Función de pantalla en negro (Blank Screen):** Oculte instantáneamente la pantalla de la congregación y recupérela sin perder el punto de avance (`B`).
- **Transiciones configurables:** Corte, fundido, disolución y desplazamiento aplicados de forma idéntica en web y PowerPoint.
- **Consulta inmediata de pasajes bíblicos:** Proyecte lecturas bíblicas (KJV) durante el culto y retírelas al instante.
- **Gestión de anuncios:** Administración de volantes y afiches desde almacenamiento local o URLs autorizadas.
- **Tipografía personalizada:** 41 familias tipográficas empaquetadas localmente sin conexión, además de incrustación ECMA-376 para fuentes personalizadas en PowerPoint.
- **Cuentas y roles:** Separación entre administradores y operadores, limitación de intentos de acceso y sesiones revocables.
- **Diseño de formulario y análisis dinámicos:** Configure campos predefinidos con expresiones regulares personalizadas y organice agrupaciones de formulario directamente desde el panel de administración.
- **Biblioteca de medios:** Un conjunto reutilizable de imágenes de fondo y volantes, independiente de cualquier diseño específico.
- **Sincronización manual entre dispositivos (experimental):** Envíe y reciba Servicios, entradas de Song Set, fondos y anuncios entre dos instancias de WorshipDeck en la misma red local, bajo demanda. Sin nube, sin sincronización en segundo plano. Verificado en un solo equipo; la sincronización entre distintas máquinas continúa siendo experimental.

## Requisitos del Sistema

- **Instalación en Servidor (Recomendado):** Linux (probado en Ubuntu), Windows 10/11 o entorno POSIX con Go 1.24+ y Node.js 22.12+. Desarrollado con React 19. Utiliza SQLite embebido sin necesidad de configurar servidores de bases de datos externos.
- **Aplicación de Escritorio Windows (Experimental):** Windows 10/11 de 64 bits.
- **macOS:** No probado oficialmente.

## Instalación

### Servidor Local Autónomo (Recomendado)

Ejecutar WorshipDeck como servidor local autónomo es el modelo de despliegue principal y recomendado:

```bash
git clone https://github.com/wiradeltaid/worship-deck.git
cd worship-deck
npm install
npm run setup
npm run dev
```

`npm run setup` genera el archivo `.env` con credenciales nuevas, inicializa la base de datos SQLite y muestra la contraseña generada para el usuario `admin`. `npm run dev` inicia la API en Go en <http://localhost:3000> y la aplicación web en React en <http://localhost:5173>. Inicie sesión como `admin`. Para despliegue de producción en un solo puerto, ejecute `npm run spa:build && npm start` y abra el puerto 3000.

Consulte [`.constitution/project/private-data.md`](.constitution/project/private-data.md) antes de ingresar datos de su congregación.

### Instalador para Windows (Experimental)

Descargue `WorshipDeck-0.1.0-x64-setup.exe` y `SHA256SUMS` desde la [página oficial de versiones](https://github.com/wiradeltaid/worship-deck/releases) y ejecute el asistente de instalación.

Verifique el archivo antes de ejecutarlo: compare el hash SHA-256 calculado con el registrado en `SHA256SUMS`.

> **Nota sobre Windows SmartScreen:** Dado que esta compilación aún no cuenta con firma digital comercial, Windows SmartScreen puede mostrar una advertencia. Haga clic en **Más información** y luego en **Ejecutar de todas formas**.

### Crear un Culto

Vaya a **Services -> New**. Pegue el programa en el campo de texto. El formato esperado es:

```text
SABBATH, MARCH 14, 2026

BIBLE TALK (09.30-10.50 / 80 min)
>> welcome remarks: Mrs. Lestari
Song Leader : Ms. Ayu
[  ] Opening song : SDAH #159 The Old Rugged Cross
Memory Verse & Opening Prayer : Mr. Bagas
Closing Prayer : Mr. Damar (1m)

DIVINE SERVICE (10.50-12.05 / 75 min)
Song Leader : Ms. Kirana
[  ] Opening Song : SDAH #83 O Worship the King
Intercessory Prayer: Mr. Farid (5m)
Sermon : Pr. Andi Hartono "Working Out" (45m)
[  ] Closing Song : SDAH #249 Praise Him! Praise Him!
```

Haga clic en **Baca susunan acara** (o **Parse** en inglés). Los roles, tiempos y números de himno se extraen al formulario, y los himnos se resuelven contra la base de datos local. Los elementos no reconocidos se muestran para su revisión.

Complete el volante del sermón y fotografías si las tiene, y guarde el culto.

### Presentación

Desde la página del culto:

- **Descargar PPTX:** Presentación PowerPoint para uso sin conexión ante cualquier imprevisto técnico.
- **Presentar:** Consola de operador con vista de diapositiva actual y siguiente, tira en miniatura y salto rápido.
- **Abrir pantalla de congregación:** Ventana limpia sin controles para proyectar en la segunda pantalla. Tecla `B` para pantalla en negro.

### Opciones Adicionales

**Búsqueda bíblica:** Muestre pasajes de la Biblia KJV en la pantalla de la congregación desde `data/en/bible-translation/kjv.json`.

**Ingesta por chat:** La recepción de programas vía webhook estará disponible en una versión próxima.

### Solución de Problemas

**`Missing song book corpus`:** Falta `data/song-book/sdah.json`. Restáurelo desde Git con `git checkout -- data/song-book/sdah.json` y ejecute `npm run corpus:verify`.

**Bloqueo de acceso:** Ejecute `npm run auth:set-password -- admin` para configurar una nueva contraseña. Ejecute `npm run auth:unlock -- --list` para desbloquear límites de inicio de sesión.

**Imágenes no visibles:** Las imágenes remotas deben cumplir con las reglas de seguridad de URL. Subir archivos localmente siempre funciona.

## Personalización

La instalación estándar comienza con un registro limpio para sus propios diseños:

1. **Diseños de diapositiva:** Inicie sesión como administrador y abra `/admin/artifacts`. Puede crear diseños en el lienzo o importarlos desde PowerPoint. Se pueden cargar 38 diseños de ejemplo con `npm run seed:demo`.
2. **Registro privado:** Puede guardar la información de su iglesia en `data/local/default-registry.json` para que la aplicación la lea automáticamente. Esta ruta está ignorada por Git. Consulte [`.constitution/project/private-data.md`](.constitution/project/private-data.md).

## Corpus Incluidos

Se incluyen dos colecciones de texto verificadas:

| Archivo | Contenido | Al Iniciar |
| --- | --- | --- |
| `data/song-book/sdah.json` | 695 himnos del Seventh-day Adventist Hymnal | títulos y letras leídos desde el archivo |
| `data/en/bible-translation/kjv.json` | 66 libros, 1189 capítulos, 31102 versículos KJV | sincronizados desde el archivo local (~130 a 150 ms) |

Ejecute `npm run corpus:verify` para validar la integridad de los datos.

Consulte [ATTRIBUTIONS.md](ATTRIBUTIONS.md) para detalles de derechos de autor y solicitudes de retiro.

## Despliegue

Compile la API en Go y la aplicación React, y ejecute `./api` (o `npm start`) en un servidor con Node 22 disponible en `PATH`. Consulte [`.constitution/project/deployment.md`](.constitution/project/deployment.md).

## Historia del Proyecto y Privacidad

Este proyecto inició como repositorio privado para una congregación local. El historial público se reconstruyó desde cero con datos sintéticos de muestra (*Harborlight Adventist Fellowship*) para proteger la privacidad de los miembros.

Los colaboradores deben consultar [`.constitution/project/private-data.md`](.constitution/project/private-data.md) antes de enviar cambios.

## Licencia y Marcas

- **Licencia del Código:** Distribuido bajo la [Licencia MIT](LICENSE).
- **Atribuciones y Corpus:** Himnarios, traducciones bíblicas y avisos de terceros se detallan en [ATTRIBUTIONS.md](ATTRIBUTIONS.md).
- **Fuentes Tipográficas de Terceros:** Avisos de derechos de autor y licencias completas SIL OFL 1.1 y Apache 2.0 para 41 familias tipográficas se encuentran en [THIRD-PARTY-NOTICES](THIRD-PARTY-NOTICES).
- **Privacidad y Seguridad:** 100% offline-first. Los datos permanecen estrictamente en su equipo; cero telemetría y cero analítica (consulte [PRIVACY.md](PRIVACY.md) y [SECURITY.md](SECURITY.md)).
- **Nombre y Logotipo:** La licencia MIT cubre el código fuente, no las marcas comerciales. Los nombres **WorshipDeck** y **Wira Delta Indonesia**, así como los logotipos del producto, son propiedad exclusiva de PT Wira Delta Indonesia.
